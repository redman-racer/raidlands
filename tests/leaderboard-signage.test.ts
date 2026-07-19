import { describe, expect, it } from "vitest";
import {
  fitSignageText, industrialSignDetail, industrialSignVariantForRank, INDUSTRIAL_SIGN_PROFILES,
  playerSignageText, playerSignageTransform,
} from "../assets/ts/leaderboard-podium/signage";

describe("leaderboard 3D signage", () => {
  it("formats leader and empty plaque content through the podium metric policy", () => {
    expect(playerSignageText({ display_name: "Ferris", kills: 42 }, 1, "players", "kills"))
      .toEqual({ rank: 1, name: "Ferris", value: "42", label: "kills" });
    expect(playerSignageText(undefined, 2, "players", "kills"))
      .toEqual({ rank: 2, name: "Awaiting contender", value: "0", label: "kills" });
  });

  it("shrinks then truncates long names deterministically", () => {
    const measure = (text: string, size: number) => text.length * size;
    expect(fitSignageText("Short", 300, measure)).toEqual({ text: "Short", fontSize: 54 });
    const fitted = fitSignageText("An exceptionally long survivor name", 280, measure);
    expect(fitted.fontSize).toBe(34);
    expect(fitted.text.endsWith("…")).toBe(true);
    expect(measure(fitted.text, fitted.fontSize)).toBeLessThanOrEqual(280);
  });

  it("keeps rank one centered and compensates mobile plaques for the wider camera framing", () => {
    expect(playerSignageTransform(1, false).position[0]).toBe(0);
    expect(playerSignageTransform(2, false).position[0]).toBeLessThan(0);
    expect(playerSignageTransform(3, false).position[0]).toBeGreaterThan(0);
    expect(playerSignageTransform(1, true).scale).toBeGreaterThan(playerSignageTransform(1, false).scale);
  });

  it("mounts side signs to runtime podium centers and angles them toward the arena center", () => {
    const second = playerSignageTransform(2, false, -4.35);
    const third = playerSignageTransform(3, false, 4.35);
    expect(second.position[0]).toBe(-4.35);
    expect(third.position[0]).toBe(4.35);
    expect(second.yaw).toBeGreaterThan(0);
    expect(third.yaw).toBeLessThan(0);
    expect(second.position[2]).toBeCloseTo(1.28);
    expect(second.position[2]).toBeGreaterThan(third.position[2]);
    expect(second.position[2]).toBeLessThan(playerSignageTransform(1, false).position[2]);
  });

  it("selects a heavier winner housing and reduced mobile detail deterministically", () => {
    expect(industrialSignVariantForRank(1)).toBe("winner");
    expect(industrialSignVariantForRank(2)).toBe("side");
    expect(industrialSignVariantForRank(3)).toBe("side");
    expect(industrialSignDetail(false)).toBe("desktop");
    expect(industrialSignDetail(true)).toBe("mobile");
    expect(INDUSTRIAL_SIGN_PROFILES.winner.width).toBeGreaterThan(INDUSTRIAL_SIGN_PROFILES.side.width);
    expect(INDUSTRIAL_SIGN_PROFILES.category.depth).toBeGreaterThan(INDUSTRIAL_SIGN_PROFILES.side.depth);
  });
});
