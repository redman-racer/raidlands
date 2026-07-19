import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, "..", path), "utf8");

describe("leaderboard 3D loading plan", () => {
  it("ships a lightweight viewport and idle-gated module loader", () => {
    const loader = read("assets/ts/leaderboard-podium/loader.ts");
    const page = read("pages/leaderboard.php");
    expect(loader).toContain("IntersectionObserver");
    expect(loader).toContain("requestIdleCallback");
    expect(loader).toContain('import("./app")');
    expect(page).toContain("leaderboard-podium-loader.js");
    expect(page).not.toContain("build/airstrike-animation-editor/leaderboard-podium.js')) ?>\"></script>");
  });

  it("reveals the winner before loading secondary characters and arena detail", () => {
    const app = read("assets/ts/leaderboard-podium/app.ts");
    const winner = app.indexOf("const winner = await this.buildCharacter");
    const ready = app.indexOf('this.host.dataset.podiumState = "ready"', winner);
    const secondary = app.indexOf("const secondaryCharacters = await Promise.all", ready);
    const enhancement = app.indexOf("this.arenaEnhancement", secondary);
    expect(winner).toBeGreaterThan(-1);
    expect(ready).toBeGreaterThan(winner);
    expect(secondary).toBeGreaterThan(ready);
    expect(enhancement).toBeGreaterThan(secondary);
  });

  it("keeps large textures and arena placements out of the shell's critical path", () => {
    const app = read("assets/ts/leaderboard-podium/app.ts");
    const shell = app.slice(app.indexOf("private async buildArenaStage"), app.indexOf("private buildInitialFloor"));
    expect(shell).not.toContain("buildArenaEnvironment()");
    expect(shell).not.toContain("buildSolidFloor()");
    expect(shell).not.toContain("loadPlacementBatch(");
  });
});
