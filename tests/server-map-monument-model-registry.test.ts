import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  monumentModelAssetName,
  monumentModelAssetNames,
  monumentModelCount,
  monumentModelManifestVersion,
  monumentModelMetadata,
  monumentModelRecipeVersion,
  monumentModelSourceRevision,
  monumentModelTierAssetNames,
  monumentPrefabId,
  type MonumentModelTier,
} from "../assets/ts/server-map-viewer/monument-model-registry";

const tiers: MonumentModelTier[] = ["map", "mid", "close"];

describe("RustRelay monument model registry", () => {
  it("normalizes Rust prefab paths and covers all 78 registered families", () => {
    expect(monumentPrefabId("assets/bundled/prefabs/autospawn/monument/medium/compound.prefab")).toBe("compound");
    expect(monumentPrefabId("POWER_SUB_BIG_1.GLB")).toBe("power_sub_big_1");
    expect(monumentModelAssetName("compound")).toBe("compound.glb");
    expect(monumentModelAssetName("entrance_bunker_d")).toBe("entrance_bunker_d.glb");
    expect(monumentModelAssetName("not_a_real_monument")).toBeNull();
    expect(monumentModelCount()).toBe(78);
  });

  it("pins the manifest, recipe, and source revisions", () => {
    expect(monumentModelManifestVersion()).toBeGreaterThanOrEqual(6);
    expect(monumentModelRecipeVersion()).toBeGreaterThanOrEqual(1);
    expect(monumentModelSourceRevision()).toBe("494242b");
  });

  it("keeps the complete legacy collection installed during rollout", () => {
    const installed = readdirSync(resolve("assets/media/models/monuments")).filter((name) => name.endsWith(".glb")).sort();
    expect(installed).toEqual(monumentModelAssetNames());
  });

  it("installs Map, Mid, and Close assets with complete metrics and hard budgets", () => {
    const modelDirectory = resolve("assets/media/models/monuments-lod");
    const installed = readdirSync(modelDirectory).filter((name) => name.endsWith(".glb")).sort();
    expect(installed).toEqual(monumentModelTierAssetNames());
    expect(installed).toHaveLength(234);
    let totalMapBytes = 0;
    let totalInstanceBatches = 0;
    for (const name of monumentModelAssetNames()) {
      const metadata = monumentModelMetadata(name)!;
      expect(metadata.sourceMatchesRustRelay).toBe(true);
      expect(metadata.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(metadata.layoutSource).toMatch(/\.glb$/);
      expect(["candidate", "approved", "rejected"]).toContain(metadata.reviewStatus);
      expect(metadata.structuralRoles).toEqual(["shell", "roof", "platform", "stairs", "perimeter", "landmark-prop", "ground-pad"]);
      expect(Object.values(metadata.exclusions.policy).every(Boolean)).toBe(true);
      const triangleCounts: number[] = [];
      for (const tierName of tiers) {
        const tier = metadata.tiers[tierName];
        expect(tier.file).toBe(`${metadata.id}-${tierName}.glb`);
        expect(tier.url).toBe(`media/models/monuments-lod/${tier.file}`);
        expect(tier.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(tier.bytes).toBeGreaterThan(0);
        expect(tier.bytes).toBeLessThanOrEqual(tier.maxBytes);
        expect(tier.triangles).toBeGreaterThan(0);
        expect(tier.triangles).toBeLessThanOrEqual(tier.maxTriangles);
        expect(tier.drawCalls).toBeGreaterThan(0);
        expect(tier.drawCalls).toBeLessThanOrEqual(tier.maxDrawCalls);
        expect(tier.instanceBatches).toBeGreaterThanOrEqual(0);
        expect(tier.instances).toBeGreaterThanOrEqual(0);
        expect(tier.bounds.min).toHaveLength(3);
        expect(tier.bounds.max).toHaveLength(3);
        expect(tier.structuralBounds.min).toHaveLength(3);
        expect(tier.structuralBounds.max).toHaveLength(3);
        expect(tier.sourceNodes.length).toBeGreaterThan(0);
        expect(tier.componentResolutions.every((resolution) => resolution.resolution === "standalone-catalog" || resolution.resolution === "embedded-layout")).toBe(true);
        if (metadata.id === "ue_jungle_swamp_a") {
          expect(tier.materialMode).toBe("palette");
          expect(tier.textureBytes).toBe(0);
          expect(tier.textureSize).toBe(0);
        } else {
          expect(tier.materialMode).toBe("textured");
          expect(tier.textureBytes).toBeGreaterThan(0);
          expect(tier.textureSize).toBeGreaterThan(0);
          expect(tier.textureSize).toBeLessThanOrEqual(tierName === "map" ? 128 : tierName === "mid" ? 512 : 1024);
          expect(tier.baseColorTexturedTriangles).toBeGreaterThan(0);
          expect(tier.baseColorTextureCoverage).toBeGreaterThanOrEqual(0.95);
        }
        triangleCounts.push(tier.triangles);
        totalInstanceBatches += tier.instanceBatches;
      }
      expect(triangleCounts[0]).toBeLessThanOrEqual(triangleCounts[1]!);
      expect(triangleCounts[1]).toBeLessThanOrEqual(triangleCounts[2]!);
      expect(metadata.tiers.map.footprintCoverage).toBeGreaterThanOrEqual(0.8);
      expect(metadata.tiers.mid.footprintCoverage).toBeGreaterThanOrEqual(0.95);
      expect(metadata.tiers.close.footprintCoverage).toBeGreaterThanOrEqual(0.95);
      expect(metadata.tiers.map.normalizedCenterOffset).toBeLessThanOrEqual(0.05);
      expect(metadata.tiers.mid.normalizedCenterOffset).toBeLessThanOrEqual(0.05);
      expect(metadata.tiers.close.normalizedCenterOffset).toBeLessThanOrEqual(0.05);
      expect(metadata.tiers.map.normalizedElevationOffset).toBeLessThanOrEqual(0.05);
      expect(metadata.tiers.mid.normalizedElevationOffset).toBeLessThanOrEqual(0.05);
      expect(metadata.tiers.close.normalizedElevationOffset).toBeLessThanOrEqual(0.05);
      totalMapBytes += metadata.tiers.map.bytes;
    }
    expect(totalMapBytes).toBeLessThan(80 * 1024 * 1024);
    expect(totalInstanceBatches).toBeGreaterThan(0);
  });

  it("uses dedicated exterior selections for Launch Site and Outpost", () => {
    const launch = monumentModelMetadata("launch_site_1")!;
    expect(launch.tiers.close.sourceNodes.some((name) => /rocket_factory_exterior/i.test(name))).toBe(true);
    expect(launch.tiers.close.sourceNodes.some((name) => /interior|office_[ab]_floor/i.test(name))).toBe(false);
    const outpost = monumentModelMetadata("compound")!;
    expect(outpost.tiers.close.sourceNodes.some((name) => /rowhouse_3st_9x12/i.test(name))).toBe(true);
    expect(outpost.tiers.close.sourceNodes.some((name) => /compound_wall_straight/i.test(name))).toBe(true);
    expect(outpost.tiers.close.sourceNodes.some((name) => /sewer|tunnel|interior/i.test(name))).toBe(false);
  });

  it("keeps authored HLODs out of Mid and Close assemblies except the complete Apartments exterior", () => {
    for (const assetName of monumentModelAssetNames()) {
      const metadata = monumentModelMetadata(assetName)!;
      const expectsAuthoredExterior = metadata.id === "apartments_complex_1";
      expect(metadata.tiers.mid.sourceNodes.some((name) => /hlod/i.test(name)), metadata.id).toBe(expectsAuthoredExterior);
      expect(metadata.tiers.close.sourceNodes.some((name) => /hlod/i.test(name)), metadata.id).toBe(expectsAuthoredExterior);
    }
  });

  it("publishes complete non-overlapping assemblies for the reported monuments", () => {
    const apartments = monumentModelMetadata("apartments_complex_1")!;
    expect(apartments.tiers.map.sourceNodes.some((name) => /hlod/i.test(name))).toBe(true);
    expect(apartments.tiers.mid.sourceNodes).toEqual(apartments.tiers.map.sourceNodes);
    expect(apartments.tiers.close.sourceNodes).toEqual(apartments.tiers.map.sourceNodes);

    const arctic = monumentModelMetadata("arctic_research_base_a")!;
    expect(arctic.tiers.close.sourceNodes.some((name) => /arctic_base_a_exterior/i.test(name))).toBe(true);
    expect(arctic.tiers.close.sourceNodes.some((name) => /arctic_base_garage/i.test(name))).toBe(true);

    const bandit = monumentModelMetadata("bandit_town")!;
    expect(bandit.tiers.close.sourceNodes.some((name) => /wooden_cabin/i.test(name))).toBe(true);
    expect(bandit.tiers.close.sourceNodes.some((name) => /dradge_metal_structure/i.test(name))).toBe(true);

    const missile = monumentModelMetadata("nuclear_missile_silo")!;
    expect(missile.tiers.close.sourceNodes.some((name) => /nuclear_silo_bunker_hatch/i.test(name))).toBe(true);
    expect(missile.tiers.close.sourceNodes.some((name) => /cliff_tall_/i.test(name))).toBe(true);
    expect(missile.tiers.close.sourceNodes.some((name) => /nuclear_silo_room_|nuclear_silo_tunnel_300|nuclear_silo_tunnel_tube|nuclear_silo_missile|hlod/i.test(name))).toBe(false);
  });

  it("keeps Dome's exterior shell, support pillars, and exterior pipes in every tier", () => {
    const dome = monumentModelMetadata("sphere_tank")!;
    for (const tierName of tiers) {
      const names = dome.tiers[tierName].sourceNodes;
      expect(names.some((name) => /sphere_exterior/i.test(name)), tierName).toBe(true);
      expect(names.some((name) => /sphere_pillars/i.test(name)), tierName).toBe(true);
      expect(names.some((name) => /pipes_exterior/i.test(name)), tierName).toBe(true);
      expect(names.some((name) => /evac_pipes/i.test(name)), tierName).toBe(true);
      expect(names.some((name) => /sphere_interior/i.test(name)), tierName).toBe(false);
    }
  });

  it("builds every Substation Map tier from real structural components", () => {
    for (const id of ["power_sub_big_1", "power_sub_big_2", "power_sub_small_1", "power_sub_small_2"]) {
      const substation = monumentModelMetadata(id)!;
      expect(substation.tiers.map.selectionKind, id).toBe("recipe-structural");
      expect(substation.tiers.map.sourceNodes.some((name) => /substation_[a-g]/i.test(name)), id).toBe(true);
    }
  });

  it("publishes the recipe-owned Abandoned Military Base assembly", () => {
    const military = monumentModelMetadata("desert_military_base_a")!;
    expect(military.standaloneOverrides.map((component) => component.id)).toEqual([
      "hangar", "field-tent", "shipping-container", "sandbags", "generator", "fuel-tank", "mlrs",
    ]);
    expect(military.standaloneOverrides.every((component) => component.sourceSha256.match(/^[a-f0-9]{64}$/) && component.placements.length > 0)).toBe(true);
  });

  it("covers all 96 live terrain instances and never references the 381 MB full-detail collection", () => {
    const terrain = JSON.parse(readFileSync(resolve("assets/media/maps/raidlands-main/current-terrain.json"), "utf8")) as { monuments?: Array<{ prefab?: string }> };
    const monuments = terrain.monuments || [];
    expect(monuments).toHaveLength(96);
    expect(monuments.filter((monument) => !monumentModelMetadata(String(monument.prefab || "")))).toEqual([]);
    expect(monuments.every((monument) => monumentModelMetadata(String(monument.prefab || ""))?.reviewStatus === "approved")).toBe(true);
    const viewerSource = readFileSync(resolve("assets/ts/server-map-viewer/app.ts"), "utf8");
    expect(viewerSource).not.toContain("media/models/monuments/");
    expect(viewerSource).not.toContain("media/models/monuments-map/");
  });
});
