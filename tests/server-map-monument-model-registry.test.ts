import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { monumentModelAssetName, monumentModelAssetNames, monumentModelCount, monumentModelMetadata, monumentPrefabId } from "../assets/ts/server-map-viewer/monument-model-registry";

describe("RustRelay monument model registry", () => {
  it("normalizes Rust prefab paths and extensions", () => {
    expect(monumentPrefabId("assets/bundled/prefabs/autospawn/monument/medium/compound.prefab")).toBe("compound");
    expect(monumentPrefabId("POWER_SUB_BIG_1.GLB")).toBe("power_sub_big_1");
  });

  it("maps dedicated monuments and the additional live-world prefab families", () => {
    expect(monumentModelAssetName("compound")).toBe("compound.glb");
    expect(monumentModelAssetName("entrance_bunker_d")).toBe("entrance_bunker_d.glb");
    expect(monumentModelAssetName("power_sub_small_2")).toBe("power_sub_small_2.glb");
    expect(monumentModelAssetName("ue_jungle_swamp_a")).toBe("ue_jungle_swamp_a.glb");
    expect(monumentModelCount()).toBe(78);
  });

  it("leaves unsupported monuments on the procedural fallback", () => {
    expect(monumentModelAssetName("not_a_real_monument")).toBeNull();
  });

  it("has one installed GLB for every registered RustRelay prefab", () => {
    const modelDirectory = resolve("assets/media/models/monuments");
    const installed = readdirSync(modelDirectory).filter((name) => name.endsWith(".glb")).sort();
    expect(installed).toEqual(monumentModelAssetNames());
  });

  it("has generated map metadata and assets for every registered monument", () => {
    const modelDirectory = resolve("assets/media/models/monuments-map");
    const installed = readdirSync(modelDirectory).filter((name) => name.endsWith(".glb")).sort();
    const expected = monumentModelAssetNames().filter((name) => monumentModelMetadata(name)?.map === name);
    expect(installed).toEqual(expected);
    expect(installed).toHaveLength(78);
    let totalBytes = 0;
    for (const name of monumentModelAssetNames()) {
      const metadata = monumentModelMetadata(name)!;
      expect(metadata.map).toBe(name);
      expect(["authored-hlod", "generated-proxy"]).toContain(metadata.mapKind);
      expect(metadata.triangles).toBeGreaterThan(0);
      expect(metadata.drawCalls).toBeGreaterThan(0);
      expect(metadata.outputBytes).toBeLessThanOrEqual(250 * 1024);
      expect(metadata.overTriangleTarget).toBe(metadata.triangleRatio > 0.03);
      expect(metadata.bounds.min).toHaveLength(3);
      expect(metadata.bounds.max).toHaveLength(3);
      expect(metadata.sourceBounds.min).toHaveLength(3);
      expect(metadata.sourceBounds.max).toHaveLength(3);
      expect(metadata.outputSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(metadata.sourceDrawCalls).toBeGreaterThan(0);
      const sourceFootprint = Math.max(
        metadata.sourceBounds.max[0]! - metadata.sourceBounds.min[0]!,
        metadata.sourceBounds.max[2]! - metadata.sourceBounds.min[2]!,
      );
      const mapFootprint = Math.max(
        metadata.bounds.max[0]! - metadata.bounds.min[0]!,
        metadata.bounds.max[2]! - metadata.bounds.min[2]!,
      );
      const sourceCenter = [0, 2].map((axis) => (metadata.sourceBounds.min[axis]! + metadata.sourceBounds.max[axis]!) / 2);
      const mapCenter = [0, 2].map((axis) => (metadata.bounds.min[axis]! + metadata.bounds.max[axis]!) / 2);
      const normalizedCenterOffset = Math.hypot(mapCenter[0]! - sourceCenter[0]!, mapCenter[1]! - sourceCenter[1]!) / sourceFootprint;
      expect(mapFootprint / sourceFootprint).toBeGreaterThan(0.55);
      expect(normalizedCenterOffset).toBeLessThan(0.25);
      totalBytes += metadata.outputBytes;
    }
    expect(totalBytes).toBeLessThan(20 * 1024 * 1024);
  });

  it("uses the authored exterior-shell recipe for Launch Site", () => {
    const launchSite = monumentModelMetadata("launch_site_1");
    expect(launchSite).not.toBeNull();
    expect(launchSite!.sourceNodes).toContain("rocket_factory_exterior_LOD0");
    expect(launchSite!.sourceNodes).toContain("space_center_office_bld_a_LOD0");
    expect(launchSite!.sourceNodes.some((name) => /interior|office_[ab]_floor|rocket_crane_floor/i.test(name))).toBe(false);
    expect(launchSite!.triangles).toBeLessThan(30_000);
  });

  it("covers every monument instance in the current terrain export", () => {
    const terrain = JSON.parse(readFileSync(resolve("assets/media/maps/raidlands-main/current-terrain.json"), "utf8")) as {
      monuments?: Array<{ prefab?: string }>;
    };
    const monuments = terrain.monuments || [];
    const unmapped = monuments.filter((monument) => !monumentModelAssetName(String(monument.prefab || "")));

    expect(monuments.length).toBeGreaterThan(0);
    expect(unmapped).toEqual([]);
  });
});
