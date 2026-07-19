import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, "..", path), "utf8");

describe("leaderboard 3D progressive loading", () => {
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
    expect(builtLoader).toContain("./chunks/three.module-");
    expect(builtLoader).not.toContain('return"/"');
  });

  it("warms 3D routes only on user intent and compresses only text assets", () => {
    const site = read("assets/js/site.js");
    const apache = read(".htaccess");
    expect(site).toContain("init3dRouteWarmup()");
    expect(site).toContain('preload.rel = "modulepreload"');
    expect(site).toContain("connection.saveData || slowConnection");
    expect(apache).toContain("max-age=31536000, immutable");
    expect(apache).toContain("DEFLATE application/javascript text/javascript application/json");
    expect(apache).toContain('Request_URI "\\.(?:glb|webp|hdr)$" no-gzip');
  });

  it("reveals the winner in an interactive scene before secondary characters", () => {
    const app = read("assets/ts/leaderboard-podium/app.ts");
    const winner = app.indexOf("const winner = await this.buildCharacter");
    const interactive = app.indexOf('this.host.dataset.podiumState = "interactive"', winner);
    const secondary = app.indexOf("for (let index = 1; index < sceneLeaders.length", interactive);
    const details = app.indexOf('this.host.dataset.podiumState = "details"', secondary);
    expect(winner).toBeGreaterThan(-1);
    expect(interactive).toBeGreaterThan(winner);
    expect(secondary).toBeGreaterThan(interactive);
    expect(details).toBeGreaterThan(secondary);
    expect(app).toContain('Array.from({ length: 3 }, (_, index) => leaders[index] || {})');
  });

  it("prefetches winner wearables together but parses and assembles them sequentially", () => {
    const app = read("assets/ts/leaderboard-podium/app.ts");
    const character = app.slice(app.indexOf("private async buildCharacter"), app.indexOf("private async prepareCharacterPiece"));
    expect(character).toContain("urls.forEach((url) => { void this.scheduler.prefetch");
    expect(character).toContain("for (const url of urls)");
    expect(character).not.toContain("Promise.all");
    expect(app).toContain("this.loader.parseAsync(buffer");
    expect(app).toContain("this.draco.setWorkerLimit(1); this.draco.preload()");
    expect(app).not.toContain("MeshoptDecoder");
  });

  it("builds a lightweight direct-rendered shell before HDR and effects", () => {
    const app = read("assets/ts/leaderboard-podium/app.ts");
    const shell = app.slice(app.indexOf("private async buildArenaStage"), app.indexOf("private buildInitialFloor"));
    expect(shell).toContain("await this.buildBackdropPanels()");
    expect(shell).toContain("this.buildArenaPodiums(manifest)");
    expect(shell).toContain("this.buildInitialFloor()");
    expect(shell).not.toContain("buildArenaEnvironment");
    expect(shell).not.toContain("setupComposer");
    expect(app).toContain('this.host.dataset.sceneEffects = "direct"');
  });

  it("streams the complete policy-selected placement set one attachment at a time", () => {
    const app = read("assets/ts/leaderboard-podium/app.ts");
    const enhancement = app.slice(app.indexOf("private async enhanceArena"), app.indexOf("private async buildArenaEnvironment"));
    const queue = app.slice(app.indexOf("private async loadPlacementQueue"), app.indexOf("private async createPlacement"));
    expect(enhancement).toContain("loadPlacementQueue(placements");
    expect(enhancement).toContain("scenePlacementsTotal");
    expect(enhancement).toContain("let missing = placements.filter");
    expect(enhancement).toContain("loadPlacementQueue(missing");
    expect(queue).toContain("for (const placement of placements)");
    expect(queue).not.toContain("Promise.all");
    expect(app).not.toMatch(/placements\.slice\s*\(/);
    expect(app).not.toMatch(/placements\.splice\s*\(/);
    expect(app).toContain('url.searchParams.set("v", hash)');
    expect(app).toContain("this.modelCache.delete(url)");
  });

  it("replaces the blocking overlay with a small interactive streaming status", () => {
    const page = read("pages/leaderboard.php");
    const styles = read("assets/css/styles.css");
    const loader = read("assets/ts/leaderboard-podium/loader.ts");
    expect(page).toContain("data-podium-streaming-status");
    expect(page).toContain("Loading arena detail — 0/0");
    expect(styles).toContain('[data-podium-state="interactive"]');
    expect(styles).toContain('[data-podium-state="details"]');
    expect(styles).toContain(".leaderboard-podium-streaming");
    expect(loader).toContain("interactive: 83");
  });

  it("loads HDR and a dynamically imported effects pipeline after scene assembly", () => {
    const app = read("assets/ts/leaderboard-podium/app.ts");
    const effects = read("assets/ts/leaderboard-podium/effects.ts");
    const complete = app.slice(app.indexOf("private async completePresentation"), app.indexOf("private characterAnchor"));
    expect(complete.indexOf("this.arenaEnhancement()")).toBeLessThan(complete.indexOf("this.buildArenaEnvironment()"));
    expect(complete.indexOf("this.buildArenaEnvironment()")).toBeLessThan(complete.indexOf("this.setupComposer()"));
    expect(app).toContain('import("./effects")');
    expect(app).not.toContain('from "three/addons/postprocessing/');
    expect(effects.indexOf("new RenderPass")).toBeLessThan(effects.indexOf("new ShaderPass"));
    expect(effects.indexOf("new ShaderPass")).toBeLessThan(effects.indexOf("new SSAOPass"));
    expect(effects.indexOf("new SSAOPass")).toBeLessThan(effects.indexOf("new UnrealBloomPass"));
    expect(app).toContain('this.host.dataset.sceneEnvironment = "hdri"');
    expect(app).toContain('this.host.dataset.sceneEffects = "full"');
  });

  it("only reports ready after placements, HDR, and effects complete", () => {
    const app = read("assets/ts/leaderboard-podium/app.ts");
    const completion = app.indexOf("complete = await this.completePresentation");
    const ready = app.indexOf('this.host.dataset.podiumState = "ready"', completion);
    expect(completion).toBeGreaterThan(-1);
    expect(ready).toBeGreaterThan(completion);
    expect(app).toContain('this.host.dataset.podiumDetail = "partial"');
    expect(app).toContain("Arena is interactive; some detail could not be loaded.");
  });
});
