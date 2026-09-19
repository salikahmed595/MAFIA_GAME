import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import type { Room } from "../src/lib/game";
let db: PGlite;
const ids = Array.from(
  { length: 18 },
  (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(
    readFileSync(
      new URL("../supabase/migrations/202609190001_mafia.sql", import.meta.url),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => {
  await db.exec("reset role; truncate public.rooms cascade;");
});
async function rpc(
  user: number,
  action: string,
  code = "",
  payload: Record<string, unknown> = {},
): Promise<Room> {
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [
    ids[user],
  ]);
  await db.exec("set role authenticated");
  try {
    const { rows } = await db.query<{ result: Room }>(
      "select public.game_command($1,$2,$3::jsonb) as result",
      [action, code, JSON.stringify(payload)],
    );
    return rows[0].result;
  } finally {
    await db.exec("reset role");
  }
}
async function setup(n = 5) {
  let r = await rpc(0, "create", "", {
    nickname: "Player 0",
    capacity: n,
    duration: 30,
  });
  for (let i = 1; i < n; i++)
    await rpc(i, "join", r.code, { nickname: `Player ${i}` });
  for (let i = 0; i < n; i++) await rpc(i, "ready", r.code);
  r = await rpc(0, "start", r.code);
  return r;
}
async function expire(code: string) {
  await db.query(
    `update private.games set deadline=now()-interval '1 second' where code=$1`,
    [code],
  );
}
describe("authoritative PostgreSQL multiplayer", () => {
  it("creates unique rooms, enforces nicknames and restores sessions", async () => {
    const a = await rpc(0, "create", "", {
      nickname: "Alice",
      capacity: 5,
      duration: 30,
    });
    const b = await rpc(1, "create", "", { nickname: "Bob" });
    expect(a.code).not.toBe(b.code);
    expect(a.code).toMatch(/^[A-Z0-9]{6}$/);
    await expect(rpc(2, "join", a.code, { nickname: "alice" })).rejects.toThrow(
      "nickname is taken",
    );
    expect(
      (await rpc(0, "join", a.code, { nickname: "Changed" })).players[0]
        .nickname,
    ).toBe("Alice");
    await expect(rpc(1, "state", a.code)).rejects.toThrow(
      "Enter your nickname",
    );
  });
  it("enforces room capacity, minimum players and host control", async () => {
    const r = await rpc(0, "create", "", { nickname: "Host", capacity: 5 });
    await expect(rpc(0, "start", r.code)).rejects.toThrow("five");
    for (let i = 1; i < 5; i++)
      await rpc(i, "join", r.code, { nickname: `Guest ${i}` });
    await expect(
      rpc(5, "join", r.code, { nickname: "Overflow" }),
    ).rejects.toThrow("full");
    await expect(rpc(1, "start", r.code)).rejects.toThrow("Only the host");
    await expect(rpc(0, "start", r.code)).rejects.toThrow("ready");
  });
  it("deals correct roles without exposing other identities or permitting direct reads/writes", async () => {
    const r = await setup(8);
    expect(r.players.every((p) => !("role" in p))).toBe(true);
    const states = [];
    for (let i = 0; i < 8; i++) states.push(await rpc(i, "state", r.code));
    expect(states.filter((s) => s.role === "mafia")).toHaveLength(2);
    expect(states.filter((s) => s.role === "doctor")).toHaveLength(1);
    expect(states.filter((s) => s.role === "detective")).toHaveLength(1);
    expect(
      states
        .filter((s) => s.role !== "mafia")
        .every((s) => s.allies.length === 0),
    ).toBe(true);
    await db.exec("set role authenticated");
    await expect(db.exec("select * from private.players")).rejects.toThrow();
    await expect(
      db.exec("update public.rooms set revision=900"),
    ).rejects.toThrow();
    await expect(
      db.query("select private.snapshot($1)", [r.code]),
    ).rejects.toThrow();
    await db.exec("reset role");
  });
  it("filters realtime revision rows to room members with RLS", async () => {
    const r = await setup();
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [
      ids[10],
    ]);
    await db.exec("set role authenticated");
    expect((await db.query("select * from public.rooms")).rows).toHaveLength(0);
    await db.exec("reset role");
    await rpc(0, "state", r.code);
    await db.exec("set role authenticated");
    expect((await db.query("select * from public.rooms")).rows).toHaveLength(1);
    await db.exec("reset role");
  });
  it("blocks unauthorized targets, action changes, dead players and late actions", async () => {
    const r = await setup();
    const roles = (
      await db.query<{ id: string; role: string }>(
        "select id,role from private.players where room_code=$1",
        [r.code],
      )
    ).rows;
    const mafia = ids.indexOf(roles.find((p) => p.role === "mafia")!.id);
    const villager = ids.indexOf(roles.find((p) => p.role === "villager")!.id);
    await expect(
      rpc(villager, "submit", r.code, { target: ids[mafia] }),
    ).rejects.toThrow("no night action");
    await expect(
      rpc(mafia, "submit", r.code, { target: ids[17] }),
    ).rejects.toThrow("living player");
    await expect(
      rpc(mafia, "submit", r.code, { target: ids[mafia] }),
    ).rejects.toThrow("yourself");
    await rpc(mafia, "submit", r.code, { target: ids[villager] });
    await expect(
      rpc(mafia, "submit", r.code, { target: ids[villager] }),
    ).rejects.toThrow("locked in");
    await expire(r.code);
    await expect(
      rpc(mafia, "submit", r.code, { target: ids[villager] }),
    ).rejects.toThrow("window is closed");
    const dawn = await rpc(0, "state", r.code);
    expect(dawn.players.find((p) => p.id === ids[villager])!.alive).toBe(false);
    await expire(r.code);
    await rpc(0, "state", r.code);
    await expect(
      rpc(villager, "submit", r.code, { target: ids[mafia] }),
    ).rejects.toThrow("Eliminated");
  });
  it("resolves protection and private investigation before advancing once at deadline", async () => {
    const r = await setup();
    const roles = (
      await db.query<{ id: string; role: string }>(
        "select id,role from private.players where room_code=$1",
        [r.code],
      )
    ).rows;
    const mafia = ids.indexOf(roles.find((p) => p.role === "mafia")!.id),
      doctor = ids.indexOf(roles.find((p) => p.role === "doctor")!.id),
      detective = ids.indexOf(roles.find((p) => p.role === "detective")!.id);
    await rpc(mafia, "submit", r.code, { target: ids[doctor] });
    await rpc(doctor, "submit", r.code, { target: ids[doctor] });
    await rpc(detective, "submit", r.code, { target: ids[mafia] });
    expect((await rpc(0, "state", r.code)).phase).toBe("night");
    await expire(r.code);
    const dawn = await rpc(detective, "state", r.code);
    expect(dawn.phase).toBe("discussion");
    expect(dawn.players.every((p) => p.alive)).toBe(true);
    expect(dawn.investigation).toContain("is Mafia.");
    expect((await rpc(doctor, "state", r.code)).investigation).toBeNull();
    expect((await rpc(detective, "state", r.code)).phase).toBe("discussion");
    await expect(rpc(7, "join", r.code, { nickname: "Late" })).rejects.toThrow(
      "already started",
    );
  });
  it("handles ties, town victory, role reveal and clean restart", async () => {
    const r = await setup();
    await expire(r.code);
    await rpc(0, "state", r.code);
    await expire(r.code);
    await rpc(0, "state", r.code);
    await rpc(0, "submit", r.code, { target: ids[1] });
    await rpc(1, "submit", r.code, { target: ids[0] });
    await expire(r.code);
    const tied = await rpc(0, "state", r.code);
    expect(tied.players.every((p) => p.alive)).toBe(true);
    const mafia = (
      await db.query<{ id: string }>(
        "select id from private.players where room_code=$1 and role='mafia'",
        [r.code],
      )
    ).rows[0].id;
    await expire(r.code);
    await rpc(0, "state", r.code);
    await expire(r.code);
    await rpc(0, "state", r.code);
    for (let i = 0; i < 5; i++)
      if (ids[i] !== mafia) await rpc(i, "submit", r.code, { target: mafia });
    await expire(r.code);
    const end = await rpc(0, "state", r.code);
    expect(end.winner).toBe("town");
    expect(end.phase).toBe("finished");
    expect(end.players.every((p) => p.role)).toBe(true);
    await expect(rpc(1, "restart", r.code)).rejects.toThrow("Only the host");
    const reset = await rpc(0, "restart", r.code);
    expect(reset.phase).toBe("lobby");
    expect(reset.role).toBeNull();
    expect(reset.players.every((p) => !p.ready && p.alive && !p.role)).toBe(
      true,
    );
  });
  it("handles Mafia parity and cannot restart an active game", async () => {
    const r = await setup();
    await expect(rpc(0, "restart", r.code)).rejects.toThrow();
    await db.query(
      "update private.players set alive=false where room_code=$1 and role='villager'",
      [r.code],
    );
    const roles = (
      await db.query<{ id: string; role: string }>(
        "select id,role from private.players where room_code=$1",
        [r.code],
      )
    ).rows;
    const mafia = ids.indexOf(roles.find((p) => p.role === "mafia")!.id);
    await rpc(mafia, "submit", r.code, {
      target: roles.find((p) => p.role === "doctor")!.id,
    });
    await expire(r.code);
    expect((await rpc(0, "state", r.code)).winner).toBe("mafia");
  });
  it("allows host transfer on lobby leave and closes expired rooms", async () => {
    const r = await rpc(0, "create", "", { nickname: "Host" });
    await rpc(1, "join", r.code, { nickname: "Next host" });
    await rpc(0, "leave", r.code);
    expect((await rpc(1, "state", r.code)).host_id).toBe(ids[1]);
    await db.query(
      "update private.games set expires_at=now()-interval '1 second' where code=$1",
      [r.code],
    );
    await expect(rpc(1, "state", r.code)).rejects.toThrow("closed");
  });
  it("rejects unsigned access to the command endpoint", async () => {
    await db.exec("set role anon");
    await expect(
      db.query(
        "select public.game_command('create','', '{\"nickname\":\"Anon\"}')",
      ),
    ).rejects.toThrow();
    await db.exec("reset role");
  });
});
