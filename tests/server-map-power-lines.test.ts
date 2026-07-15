import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizePowerLines } from "../assets/ts/server-map-viewer/power-line-policy";

describe("server map power lines", () => {
  it("normalizes bounded Rust-authored tower paths", () => {
    const result = normalizePowerLines([{ name: "main", points: [
      { x: -100, y: 20, z: 30 }, { x: 0, y: 24, z: 30 }, { x: 100, y: 22, z: 30 },
    ] }], 1000);
    expect(result).toEqual([{ name: "main", points: [
      { x: -100, y: 20, z: 30 }, { x: 0, y: 24, z: 30 }, { x: 100, y: 22, z: 30 },
    ] }]);
  });

  it("rejects invalid and out-of-world points", () => {
    expect(normalizePowerLines([{ points: [{ x: 9999, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }] }], 1000)).toEqual([]);
  });

  it("installs the four RustRelay tower variants", () => {
    expect(readdirSync(resolve("assets/media/models/infrastructure")).sort()).toEqual([
      "powerline_a.glb", "powerline_b.glb", "powerline_c.glb", "powerline_d.glb",
    ]);
  });
});
