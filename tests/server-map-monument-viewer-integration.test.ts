import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("shared Home and Server monument viewer", () => {
  it("uses the same three-tier runtime and Auto-compatible persisted setting on both pages", () => {
    for (const page of ["home.php", "server.php"]) {
      const source = readFileSync(resolve("pages", page), "utf8");
      expect(source).toContain("build/airstrike-animation-editor/server-map-viewer.js");
      expect(source).toContain("data-server-map-viewer");
      expect(source).toContain('data-detailed-monuments="true"');
    }
  });

  it("exposes manifest, tier, resource, queue, and failure diagnostics", () => {
    const source = readFileSync(resolve("assets/ts/server-map-viewer/app.ts"), "utf8");
    for (const diagnostic of [
      "monumentManifestVersion", "monumentRecipeVersion", "monumentSourceRevision",
      "monumentMapLoaded", "monumentMidLoaded", "monumentCloseLoaded", "monumentActiveAssets",
      "monumentLoadedBytes", "monumentApproxTriangles", "monumentApproxDrawCalls",
      "monumentDecodeQueue", "monumentFailedAssets",
    ]) expect(source).toContain(diagnostic);
  });

  it("wires replay events and adaptive performance into the cinematic director", () => {
    const source = readFileSync(resolve("assets/ts/server-map-viewer/app.ts"), "utf8");
    expect(source).toContain("directorActionSubjects()");
    expect(source).toContain("replayWorldEventRoute(event)");
    expect(source).toContain("updateDirectorFpsState(this.directorFps, frameMs)");
    expect(source).toContain('if (this.cameraMode === "orbit"');
  });

  it("defaults both shared viewers to the recorded-time Live stream", () => {
    for (const page of ["home.php", "server.php"]) {
      const source = readFileSync(resolve("pages", page), "utf8");
      expect(source).toContain("api/server/timeline.php");
      expect(source).toContain('data-overlay-mode="live"');
      expect(source).not.toContain("data-overlay-playback");
    }

    const server = readFileSync(resolve("pages/server.php"), "utf8");
    expect(server).toContain('data-map-viewer-timeline-mode="live"');
    expect(server).toContain('data-map-viewer-timeline-mode="replay"');
    expect(server).not.toContain("data-map-viewer-heatmap-playback");

    const viewer = readFileSync(resolve("assets/ts/server-map-viewer/app.ts"), "utf8");
    expect(viewer).toContain("loadForcedReplayEvents(root, hooks.selectedRange(), 72)");
    expect(viewer).toContain("seekEvent(latest)");
  });
});
