import { describe, it, expect } from "vitest";
import { plurality, validNickname, winningTeam } from "../src/lib/game";
import { newPractice, practiceStep } from "../src/lib/practice";
describe("game rules", () => {
  it("awards town victory only after the last Mafia is gone", () => {
    expect(winningTeam(["doctor", "villager"])).toBe("town");
    expect(winningTeam(["mafia", "doctor", "villager"])).toBeNull();
  });
  it("awards Mafia victory at parity", () => {
    expect(winningTeam(["mafia", "villager"])).toBe("mafia");
  });
  it("eliminates nobody on a tied or empty vote", () => {
    expect(plurality([])).toBeNull();
    expect(plurality(["a", "b"])).toBeNull();
    expect(plurality(["a", "b", "a"])).toBe("a");
  });
  it("validates trimmed nickname length", () => {
    expect(validNickname(" a ")).toBe(false);
    expect(validNickname(" Vivian ")).toBe(true);
    expect(validNickname("x".repeat(21))).toBe(false);
  });
  it("practice reveals an investigation and advances to discussion", () => {
    const r = practiceStep(newPractice(), "1");
    expect(r.investigation).toBe("Vivian is Mafia.");
    expect(r.phase).toBe("discussion");
    expect(r.players).toHaveLength(8);
  });
});
