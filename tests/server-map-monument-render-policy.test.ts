import { describe, expect, it } from "vitest";
import { monumentRenderClass, monumentUsesMapProxyInAuto } from "../assets/ts/server-map-viewer/monument-render-policy";

describe("monument render policy", () => {
  it("keeps large landmarks on compact map silhouettes in Auto mode", () => {
    for (const id of ["compound", "launch_site_1", "harbor_1", "oilrig_1", "radtown_small_3", "desert_military_base_d"]) {
      expect(monumentRenderClass(id)).toBe("landmark-map");
      expect(monumentUsesMapProxyInAuto(id)).toBe(true);
    }
  });

  it("uses above-ground-only entrance geometry for caves and train tunnels", () => {
    expect(monumentRenderClass("cave_large_medium")).toBe("surface-entrance");
    expect(monumentRenderClass("entrance_bunker_d")).toBe("surface-entrance");
  });

  it("allows small repeated assets to share detail models", () => {
    expect(monumentRenderClass("power_sub_big_1")).toBe("shared-detail");
    expect(monumentRenderClass("water_well_a")).toBe("shared-detail");
  });
});
