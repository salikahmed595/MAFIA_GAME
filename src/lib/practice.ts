import { plurality, winningTeam, type Room, type Role } from "./game";
const names = [
  "You",
  "Vivian",
  "Arthur",
  "Lucia",
  "Felix",
  "Iris",
  "Vincent",
  "Evelyn",
];
const roles: Role[] = [
  "detective",
  "mafia",
  "villager",
  "doctor",
  "villager",
  "villager",
  "mafia",
  "villager",
];
export function newPractice(): Room {
  return {
    code: "PRACTICE",
    host_id: "0",
    phase: "night",
    round: 1,
    deadline: new Date(Date.now() + 45000).toISOString(),
    players: names.map((nickname, i) => ({
      id: String(i),
      nickname,
      alive: true,
      ready: true,
    })),
    role: "detective",
    allies: [],
    log: ["Night falls over Blackthorn. The council closes its eyes."],
    winner: null,
    submitted: false,
    investigation: null,
    server_now: new Date().toISOString(),
    capacity: 8,
    duration: 45,
  };
}
export function practiceStep(room: Room, target?: string): Room {
  const r = structuredClone(room);
  const alive = r.players.filter((p) => p.alive);
  r.submitted = false;
  if (r.phase === "night") {
    if (target) {
      r.investigation = `${r.players.find((p) => p.id === target)?.nickname} is ${roles[Number(target)] === "mafia" ? "Mafia" : "not Mafia"}.`;
    }
    const victims = alive.filter((p) => roles[Number(p.id)] !== "mafia");
    const victim = victims[Math.floor(Math.random() * victims.length)];
    const protectedPlayer = alive.some((p) => roles[Number(p.id)] === "doctor")
      ? alive[Math.floor(Math.random() * alive.length)]
      : null;
    if (victim && victim.id !== protectedPlayer?.id) {
      r.players.find((p) => p.id === victim.id)!.alive = false;
      r.log.push(`${victim.nickname} did not survive the night.`);
    } else r.log.push("Everyone survived the night.");
    r.phase = "discussion";
  } else if (r.phase === "discussion") {
    r.phase = "voting";
    r.log.push("The council must choose. Cast your vote.");
  } else if (r.phase === "voting") {
    const votes = alive
      .filter((p) => p.id !== "0")
      .map((p) => {
        const targets = alive.filter((t) => t.id !== p.id);
        return targets[Math.floor(Math.random() * targets.length)].id;
      });
    if (target) votes.push(target);
    const victim = plurality(votes);
    if (victim) {
      const p = r.players.find((p) => p.id === victim)!;
      p.alive = false;
      r.log.push(
        `${p.nickname} was voted out. They were ${roles[Number(victim)]}.`,
      );
    } else r.log.push("The vote tied. No one was eliminated.");
    r.round++;
    r.phase = "night";
  }
  r.winner = winningTeam(
    r.players.filter((p) => p.alive).map((p) => roles[Number(p.id)]),
  );
  if (r.winner) {
    r.phase = "finished";
    r.players.forEach((p) => (p.role = roles[Number(p.id)]));
    r.log.push(`${r.winner === "town" ? "The town" : "The Mafia"} wins.`);
  }
  r.deadline = new Date(Date.now() + 45000).toISOString();
  return r;
}
