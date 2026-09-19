export type Role = "mafia" | "doctor" | "detective" | "villager";
export type Phase = "lobby" | "night" | "discussion" | "voting" | "finished";
export interface Player {
  id: string;
  nickname: string;
  alive: boolean;
  ready: boolean;
  role?: Role;
}
export interface Room {
  code: string;
  host_id: string;
  phase: Phase;
  round: number;
  deadline: string | null;
  players: Player[];
  role: Role | null;
  allies: string[];
  log: string[];
  winner: string | null;
  submitted: boolean;
  investigation: string | null;
  server_now: string;
  capacity: number;
  duration: number;
}
export const roleInfo: Record<
  Role,
  { name: string; description: string; symbol: string }
> = {
  mafia: {
    name: "Mafia",
    description:
      "Blend in by day. Choose a victim each night. Win when your numbers equal the town.",
    symbol: "◆",
  },
  doctor: {
    name: "Doctor",
    description:
      "Protect one person each night, including yourself. Keep the town alive.",
    symbol: "✚",
  },
  detective: {
    name: "Detective",
    description:
      "Investigate one person each night. Only you see whether they are Mafia.",
    symbol: "◎",
  },
  villager: {
    name: "Villager",
    description:
      "Listen closely, question everyone, and vote out the Mafia. Your voice is your power.",
    symbol: "◇",
  },
};
export function winningTeam(roles: Role[]) {
  const mafia = roles.filter((r) => r === "mafia").length;
  return mafia === 0 ? "town" : mafia >= roles.length - mafia ? "mafia" : null;
}
export function plurality(votes: string[]): string | null {
  const counts = new Map<string, number>();
  votes.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  const order = [...counts].sort((a, b) => b[1] - a[1]);
  return !order.length || (order[1] && order[0][1] === order[1][1])
    ? null
    : order[0][0];
}
export function validNickname(n: string) {
  return n.trim().length >= 2 && n.trim().length <= 20;
}
