import { createClient } from "@supabase/supabase-js";
import type { Room } from "./game";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
let pendingIdentity: Promise<string> | null = null;
export function identity(): Promise<string> {
  if (!pendingIdentity) {
    pendingIdentity = resolveIdentity().finally(() => {
      pendingIdentity = null;
    });
  }
  return pendingIdentity;
}
async function resolveIdentity() {
  if (!supabase)
    throw new Error(
      "Multiplayer needs Supabase setup. Try the practice game, or follow the README to connect your project.",
    );
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return session.user.id;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user!.id;
}
export async function command(
  action: string,
  code = "",
  payload: Record<string, unknown> = {},
): Promise<Room> {
  await identity();
  const { data, error } = await supabase!.rpc("game_command", {
    p_action: action,
    p_code: code,
    p_payload: payload,
  });
  if (error) throw new Error(error.message);
  return data as Room;
}
