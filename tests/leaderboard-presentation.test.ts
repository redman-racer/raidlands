import { describe, expect, it } from "vitest";
import {
  diffPodiumPresentations,
  podiumPresentationSignatures,
  type PodiumPresentation,
} from "../assets/ts/leaderboard-podium/presentation";

const leader = (steamId: string, name: string, kills: number, preset = "survivor") => ({
  steam_id64: steamId,
  display_name: name,
  kills,
  appearance: { preset, wearables: [{ asset: preset === "hazmat" ? "hazmat" : "hoodie" }] },
});

const presentation = (leaders: PodiumPresentation["leaders"], metric = "kills"): PodiumPresentation => ({
  board: "players",
  metric,
  leaders,
});

describe("leaderboard podium presentation diffing", () => {
  it("does no scene work for an identical top-three payload", () => {
    const current = presentation([leader("1", "Alpha", 12), leader("2", "Bravo", 8)]);
    expect(diffPodiumPresentations(current, structuredClone(current))).toEqual({
      changedRanks: [], removedRanks: [], signageChanged: false, unchanged: true,
    });
  });

  it("updates signage without replacing characters for a metric-only change", () => {
    const leaders = [leader("1", "Alpha", 12), leader("2", "Bravo", 8)];
    const diff = diffPodiumPresentations(presentation(leaders), presentation(leaders, "kdr"));
    expect(diff.signageChanged).toBe(true);
    expect(diff.changedRanks).toEqual([]);
  });

  it("replaces only the rank whose appearance changed", () => {
    const current = presentation([leader("1", "Alpha", 12), leader("2", "Bravo", 8)]);
    const next = presentation([leader("1", "Alpha", 12), leader("2", "Bravo", 8, "hazmat")]);
    expect(diffPodiumPresentations(current, next).changedRanks).toEqual([1]);
  });

  it("replaces both affected slots when leaders reorder", () => {
    const alpha = leader("1", "Alpha", 12); const bravo = leader("2", "Bravo", 8);
    expect(diffPodiumPresentations(presentation([alpha, bravo]), presentation([bravo, alpha])).changedRanks).toEqual([0, 1]);
  });

  it("removes an emptied rank while retaining the others", () => {
    const current = presentation([leader("1", "Alpha", 12), leader("2", "Bravo", 8)]);
    const diff = diffPodiumPresentations(current, presentation([leader("1", "Alpha", 12)]));
    expect(diff.changedRanks).toEqual([1]);
    expect(diff.removedRanks).toEqual([1]);
    expect(diff.signageChanged).toBe(true);
  });

  it("normalizes appearance object key order before signing", () => {
    const first = presentation([{ steam_id64: "1", display_name: "Alpha", kills: 12, appearance: { preset: "survivor", label: "Survivor" } }]);
    const second = presentation([{ steam_id64: "1", display_name: "Alpha", kills: 12, appearance: { label: "Survivor", preset: "survivor" } }]);
    expect(podiumPresentationSignatures(first)).toEqual(podiumPresentationSignatures(second));
  });
});
