import { describe, expect, it } from "vitest";
import { monumentRenderClass, monumentUsesMapProxyInAuto } from "../assets/ts/server-map-viewer/monument-render-policy";

describe("monument render policy", () => {
  it("allows major landmarks to promote through Map, Mid, and Close in Auto", () => {
    for (const id of ["compound", "launch_site_1", "harbor_1", "oilrig_1", "radtown_small_3"]) {
      expect(monumentRenderClass(id)).toBe("recipe-lod");
      expect(monumentUsesMapProxyInAuto(id)).toBe(false);
    }
  });

  it("keeps cave and train-tunnel recipes above-ground-only", () => {
    expect(monumentRenderClass("cave_large_medium")).toBe("surface-entrance");
    expect(monumentRenderClass("entrance_bunker_d")).toBe("surface-entrance");
  });

  it("uses the same recipe policy for repeated and military-base families", () => {
    expect(monumentRenderClass("power_sub_big_1")).toBe("recipe-lod");
    expect(monumentRenderClass("water_well_a")).toBe("recipe-lod");
    for (const variant of ["a", "b", "c", "d"]) {
      expect(monumentRenderClass(`desert_military_base_${variant}`)).toBe("recipe-lod");
    }
  });

  it("leaves unknown prefabs on the procedural fallback", () => {
    expect(monumentRenderClass("unknown_monument")).toBe("procedural-fallback");
    expect(monumentUsesMapProxyInAuto("unknown_monument")).toBe(true);
  });
});
