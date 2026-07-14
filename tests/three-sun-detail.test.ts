import { describe, expect, it } from "vitest";
import {
  parseRaidlandsSunDetail,
  raidlandsSunProfile,
} from "../assets/ts/shared/three-sun-detail";

describe("Raidlands sun detail profiles", () => {
  it("parses supported values and uses the caller-selected fallback", () => {
    expect(parseRaidlandsSunDetail("low", "max")).toBe("low");
    expect(parseRaidlandsSunDetail("medium", "max")).toBe("medium");
    expect(parseRaidlandsSunDetail("max", "low")).toBe("max");
    expect(parseRaidlandsSunDetail("ultra", "max")).toBe("max");
    expect(parseRaidlandsSunDetail(undefined, "low")).toBe("low");
  });

  it("keeps advanced work out of the low shader and enables optics only at max", () => {
    expect(raidlandsSunProfile("low")).toMatchObject({
      shaderLevel: 0,
      useAtmosphericDisc: false,
      useCinematicOptics: false,
      lightingResponse: 0,
    });
    expect(raidlandsSunProfile("medium")).toMatchObject({
      shaderLevel: 1,
      useAtmosphericDisc: true,
      useCinematicOptics: false,
      lightingResponse: 0.55,
    });
    expect(raidlandsSunProfile("max")).toMatchObject({
      shaderLevel: 2,
      useAtmosphericDisc: true,
      useCinematicOptics: true,
      lightingResponse: 1,
    });
  });
});
