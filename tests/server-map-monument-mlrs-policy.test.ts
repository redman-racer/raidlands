import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Group } from "three";
import { describe, expect, it } from "vitest";
import {
  attachMilitaryBaseMlrs,
  attachMilitaryBaseCompositeAsset,
  MILITARY_BASE_COMPOSITE_ASSETS,
  MILITARY_BASE_MLRS_ASSET,
  MILITARY_BASE_MLRS_SHA256,
  militaryBaseMlrsPlacement,
  usesEnhancedMilitaryBaseMapModel,
} from "../assets/ts/server-map-viewer/monument-mlrs-policy";

describe("abandoned military base MLRS policy", () => {
  it("assigns an authored MLRS placement to every military-base variant", () => {
    for (const variant of ["a", "b", "c", "d"]) {
      expect(militaryBaseMlrsPlacement(`desert_military_base_${variant}`)).not.toBeNull();
      expect(usesEnhancedMilitaryBaseMapModel(`desert_military_base_${variant}`)).toBe(true);
    }
    expect(militaryBaseMlrsPlacement("compound")).toBeNull();
    expect(usesEnhancedMilitaryBaseMapModel("compound")).toBe(false);
  });

  it("installs the exact RustRelay MLRS asset", () => {
    const file = resolve("assets", MILITARY_BASE_MLRS_ASSET.replace(/^media\//, "media/"));
    expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(MILITARY_BASE_MLRS_SHA256);
  });

  it("installs the exact modular assets used to complete the military base", () => {
    expect(MILITARY_BASE_COMPOSITE_ASSETS.map((asset) => asset.id)).toEqual([
      "hangar", "field-tent", "shipping-container", "sandbags", "generator", "fuel-tank",
    ]);
    for (const asset of MILITARY_BASE_COMPOSITE_ASSETS) {
      const file = resolve("assets", asset.path.replace(/^media\//, "media/"));
      expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(asset.sha256);
      expect(asset.placements.length).toBeGreaterThan(0);
    }
  });

  it("exposes stable animation roles and a launch origin", () => {
    const monument = new Group();
    const source = new Group();
    for (const name of ["hRotator", "vRotator", "mlrs_rocket_launcher"]) {
      const node = new Group();
      node.name = name;
      source.add(node);
    }
    const mlrs = attachMilitaryBaseMlrs(monument, source, "desert_military_base_a");
    expect(mlrs?.userData.raidlandsAnimationReady).toBe(true);
    expect(mlrs?.userData.raidlandsResidentVehicle).toBe(true);
    expect(monument.userData.raidlandsResidentMlrs).toBe(true);
    expect(mlrs?.scale.x).toBe(1.35);
    expect(mlrs?.getObjectByName("hRotator")?.userData.raidlandsAnimationRole).toBe("launcher-yaw");
    expect(mlrs?.getObjectByName("vRotator")?.userData.raidlandsAnimationRole).toBe("launcher-pitch");
    expect(mlrs?.getObjectByName("raidlands-mlrs-launch-origin")?.userData.raidlandsAnimationRole).toBe("rocket-origin");
  });

  it("clones repeated modular props while preserving shared source geometry", () => {
    const monument = new Group();
    const source = new Group();
    source.name = "sandbag-source";
    const sandbags = MILITARY_BASE_COMPOSITE_ASSETS.find((asset) => asset.id === "sandbags")!;
    const instances = attachMilitaryBaseCompositeAsset(monument, source, sandbags);
    expect(instances).toHaveLength(4);
    expect(monument.children).toHaveLength(4);
    expect(instances.every((instance) => instance.userData.raidlandsMilitaryBaseDetail === "sandbags")).toBe(true);
  });
});
