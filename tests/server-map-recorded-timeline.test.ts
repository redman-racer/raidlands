import { describe, expect, it } from "vitest";
import {
  RECORDED_PLAYBACK_SPEEDS,
  RecordedTimelineBatchCache,
  RecordedTimelineClock,
  latestRecordedAvailability,
  recordedBatchSpanSeconds,
  recordedPrefetchThresholdMs,
  recordedSampleEverySeconds,
  relativeTimelineCursor,
} from "../assets/ts/server-map-viewer/recorded-timeline";

describe("recorded server timeline", () => {
  it("advances one server second per wall second at 1x and scales only by the selected multiplier", () => {
    const clock = new RecordedTimelineClock();
    clock.configureReplay({ startMs: 0, endMs: 60_000, speed: 1, playing: true });
    expect(clock.tick(1_000).cursorMs).toBe(1_000);
    clock.setReplaySpeed(8);
    expect(clock.tick(1_000).cursorMs).toBe(9_000);
  });

  it("waits at the live head and resumes without jumping when a new frame arrives", () => {
    const clock = new RecordedTimelineClock();
    clock.configureLive(10_000, 12_000);
    expect(clock.tick(5_000)).toMatchObject({ cursorMs: 12_000, waiting: true });
    clock.setLiveHead(17_000);
    expect(clock.tick(1_000)).toMatchObject({ cursorMs: 13_000, waiting: false });
  });

  it("does not invent a Live head for empty or unavailable streams", () => {
    expect(latestRecordedAvailability({ environment: { availableThrough: "" }, players: undefined })).toBeNull();
    expect(latestRecordedAvailability({
      environment: { availableThrough: "2026-07-17T10:00:00Z" },
      events: { availableThrough: "2026-07-17T10:00:05Z" },
    })).toBe(Date.parse("2026-07-17T10:00:05Z"));
  });

  it("checks one frozen tail, plays it, then rolls the same duration without a second check", () => {
    const clock = new RecordedTimelineClock();
    clock.configureReplay({ startMs: 0, endMs: 10_000, cursorMs: 9_000, speed: 1, playing: true, loop: true });
    expect(clock.tick(1_000).needsTailCheck).toBe(true);
    expect(clock.resolveReplayTail(13_000).wrapped).toBe(false);
    expect(clock.tick(3_000).wrapped).toBe(true);
    expect(clock.cursorMs).toBe(3_000);
    expect(clock.rangeStartMs).toBe(3_000);
    expect(clock.rangeEndMs).toBe(13_000);
  });

  it("wraps the existing range after a failed tail check", () => {
    const clock = new RecordedTimelineClock();
    clock.configureReplay({ startMs: 20_000, endMs: 30_000, cursorMs: 30_000, loop: true });
    expect(clock.tick(1).needsTailCheck).toBe(true);
    expect(clock.resolveReplayTail(null)).toMatchObject({ wrapped: true, cursorMs: 20_000 });
  });

  it("maps range changes by relative progress", () => {
    expect(relativeTimelineCursor(25, 0, 100, 1_000, 3_000)).toBe(1_500);
  });

  it("uses bounded batches and recorded-frame decimation only at high speeds", () => {
    expect(recordedBatchSpanSeconds(1)).toBe(900);
    expect(recordedBatchSpanSeconds(512)).toBe(21_600);
    expect(recordedSampleEverySeconds(12)).toBe(0);
    expect(recordedSampleEverySeconds(512)).toBe(43);
    expect(recordedPrefetchThresholdMs(8)).toBe(240_000);
    expect(RECORDED_PLAYBACK_SPEEDS[RECORDED_PLAYBACK_SPEEDS.length - 1]).toBe(512);
  });

  it("keeps four replay state batches and evicts the least recently used batch", () => {
    const cache = new RecordedTimelineBatchCache<number>(4);
    ["a", "b", "c", "d"].forEach((key, index) => cache.set(key, index));
    expect(cache.get("a")).toBe(0);
    cache.set("e", 4);
    expect(cache.keys()).toEqual(["c", "d", "a", "e"]);
    expect(cache.get("b")).toBeUndefined();
  });
});
