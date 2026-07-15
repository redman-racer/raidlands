import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Group } from "three";
import { describe, expect, it } from "vitest";
import {
  attachMilitaryBaseMlrs,
  MILITARY_BASE_MLRS_ASSET,
  MILITARY_BASE_MLRS_SHA256,
  militaryBaseMlrsPlacement,
} from "../assets/ts/server-map-viewer/monument-mlrs-policy";

describe("abandoned military base MLRS policy", () => {
  it("assigns an authored MLRS placement to every military-base variant", () => {
    for (const variant of ["a", "b", "c", "d"]) {
      expect(militaryBaseMlrsPlacement(`desert_military_base_${variant}`)).not.toBeNull();
    }
    expect(militaryBaseMlrsPlacement("compound")).toBeNull();
  });

  it("installs the exact RustRelay MLRS asset", () => {
    const file = resolve("assets", MILITARY_BASE_MLRS_ASSET.replace(/^media\//, "media/"));
    expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(MILITARY_BASE_MLRS_SHA256);
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
    expect(mlrs?.getObjectByName("hRotator")?.userData.raidlandsAnimationRole).toBe("launcher-yaw");
    expect(mlrs?.getObjectByName("vRotator")?.userData.raidlandsAnimationRole).toBe("launcher-pitch");
    expect(mlrs?.getObjectByName("raidlands-mlrs-launch-origin")?.userData.raidlandsAnimationRole).toBe("rocket-origin");
  });
});
