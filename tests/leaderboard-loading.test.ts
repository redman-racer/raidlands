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

  it("keeps Vite dependency preloads relative to the nested build directory", () => {
    const vite = read("vite.config.ts");
    const builtLoader = read("assets/build/airstrike-animation-editor/leaderboard-podium-loader.js");
    expect(vite).toContain('base: "./"');
    expect(builtLoader).toContain('./chunks/three.module-');
    expect(builtLoader).not.toContain('return"/"');
  });

  it("warms 3D routes only on user intent and respects constrained connections", () => {
    const site = read("assets/js/site.js");
    const apache = read(".htaccess");
    expect(site).toContain("init3dRouteWarmup()");
    expect(site).toContain('preload.rel = "modulepreload"');
    expect(site).toContain("connection.saveData || slowConnection");
    expect(apache).toContain("max-age=31536000, immutable");
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
    expect(app).toContain('Array.from({ length: 3 }, (_, index) => leaders[index] || {})');
  });

  it("finishes the HDR environment under the loader and defers arena placements", () => {
    const app = read("assets/ts/leaderboard-podium/app.ts");
    const shell = app.slice(app.indexOf("private async buildArenaStage"), app.indexOf("private buildInitialFloor"));
    expect(shell).toContain("await this.buildArenaEnvironment()");
    expect(shell).toContain("if (!hasEnvironment) { await this.buildBackdropPanels()");
    expect(shell).not.toContain("buildSolidFloor()");
    expect(shell).not.toContain("loadPlacementBatch(");
  });

  it("streams the complete approved placement set without long idle gates", () => {
    const app = read("assets/ts/leaderboard-podium/app.ts");
    const enhancement = app.slice(app.indexOf("private async enhanceArena"), app.indexOf("private async buildArenaEnvironment"));
    expect(enhancement).toContain("loadPlacementBatch(placements");
    expect(enhancement).toContain("scenePlacementsTotal");
    expect(enhancement).toContain("let missing = placements.filter");
    expect(enhancement).toContain("arena placements unavailable");
    expect(enhancement).not.toContain("setTimeout(resolve, 3000)");
    expect(app).toContain("if (yieldBetween) await yieldToRenderer()");
    expect(app).toContain("this.modelCache.delete(url)");
  });

  it("uses the Raidlands loader treatment and reveals only after arena detail", () => {
    const page = read("pages/leaderboard.php");
    const app = read("assets/ts/leaderboard-podium/app.ts");
    const styles = read("assets/css/styles.css");
    expect(page).toContain("raidlands-loader--podium");
    expect(page).toContain("data-podium-progress-value");
    expect(styles).toContain(".raidlands-loader--podium .raidlands-loader-progress");
    expect(app.indexOf("await this.completePresentation")).toBeLessThan(app.indexOf('this.host.dataset.podiumState = "ready"', app.indexOf("await this.completePresentation")));
    expect(app).toContain('this.host.dataset.podiumState = "details"');
  });

  it("loads the HDRI background by default before revealing the arena", () => {
    const app = read("assets/ts/leaderboard-podium/app.ts");
    const enhancement = app.slice(app.indexOf("private async enhanceArena"), app.indexOf("private async buildArenaEnvironment"));
    expect(app).toContain('const fallbackOnly = new URLSearchParams(location.search).has("podium-fallback")');
    expect(app).toContain("fallbackOnly ? false : await this.buildArenaEnvironment()");
    expect(enhancement).not.toContain("buildArenaEnvironment");
    expect(app).toContain("this.scene.background = texture");
    expect(app).toContain('this.host.dataset.sceneEnvironment = "hdri"');
    expect(app).toContain("new PMREMGenerator");
    expect(app).toContain("this.scene.environment = target.texture");
    expect(app).toContain('this.host.dataset.sceneEffects = this.composer ? "full" : "direct"');
  });

  it("preserves the original full volumetric fog composer", () => {
    const app = read("assets/ts/leaderboard-podium/app.ts");
    expect(app).toContain("this.buildAtmosphere();\n    this.setupComposer();");
    expect(app).toContain("composer.addPass(fogPass)");
    expect(app).toContain('this.setFogQuality("volumetric")');
    expect(app).toContain("const ssao = new SSAOPass");
    expect(app).toContain("composer.addPass(ssao)");
    expect(app).toContain("composer.addPass(new UnrealBloomPass");
    expect(app).toContain("if (!this.mobile || !this.volumetricFogCapable || this.capture) return");
    expect(app).not.toContain("this.buildSmoke(texture)");
  });
});
