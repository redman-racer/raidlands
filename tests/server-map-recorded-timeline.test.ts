import { describe, expect, it } from "vitest";
import {
  RECORDED_PLAYBACK_SPEEDS,
  RECORDED_BUFFER_MAX_BYTES,
  RECORDED_BUFFER_SPLIT_BYTES,
  RECORDED_REPLAY_MAX_EVENT_STEP_MS,
  RecordedTimelineBatchCache,
  RecordedTimelineBuffer,
  RecordedTimelineClock,
  effectiveRecordedReplayRange,
  initialRecordedReplayCursor,
  latestRecordedAvailability,
  recordedBatchSpanSeconds,
  recordedPrefetchThresholdMs,
  recordedCoverageDurationMs,
  recordedRangeChangeForegroundBounds,
  recordedSampleEverySeconds,
  recordedTimelineFramesAround,
  recordedTimelineNeedsDetailPressure,
  recordedTimelineRenderIntervalMs,
  recordedReplayWrapPrefetchDue,
  relativeTimelineCursor,
} from "../assets/ts/server-map-viewer/recorded-timeline";

describe("recorded server timeline", () => {
  it("sheds local detail for foreground replay loads but not live or speculative prefetch", () => {
    const base = {
      mode: "replay" as const,
      modeSwitchLoading: false,
      buffering: false,
      tailChecking: false,
      pendingWrap: false,
      activeRequestPriorities: [] as number[],
    };
    expect(recordedTimelineNeedsDetailPressure({ ...base, mode: "live", buffering: true })).toBe(false);
    expect(recordedTimelineNeedsDetailPressure({ ...base, modeSwitchLoading: true })).toBe(true);
    expect(recordedTimelineNeedsDetailPressure({ ...base, activeRequestPriorities: [0] })).toBe(false);
    expect(recordedTimelineNeedsDetailPressure({ ...base, activeRequestPriorities: [2] })).toBe(false);
    expect(recordedTimelineNeedsDetailPressure({ ...base, activeRequestPriorities: [2, 2] })).toBe(true);
  });

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

  it("starts replay at the latest recorded frame", () => {
    expect(initialRecordedReplayCursor(0, 10 * 60_000)).toBe(10 * 60_000);
    expect(initialRecordedReplayCursor(0, 60_000)).toBe(60_000);
  });

  it("uses a narrow foreground window while a historical range change settles", () => {
    expect(recordedRangeChangeForegroundBounds(30 * 60_000, 0, 60 * 60_000)).toEqual({
      startMs: 29.5 * 60_000,
      endMs: 30.5 * 60_000,
    });
    expect(recordedRangeChangeForegroundBounds(60 * 60_000, 0, 60 * 60_000)).toEqual({
      startMs: 59.5 * 60_000,
      endMs: 60 * 60_000,
    });
  });

  it("uses bounded batches and recorded-frame decimation only at high speeds", () => {
    expect(recordedBatchSpanSeconds(1)).toBe(300);
    expect(recordedBatchSpanSeconds(512)).toBe(300);
    expect(recordedSampleEverySeconds(12)).toBe(0);
    expect(recordedSampleEverySeconds(512)).toBe(43);
    expect(recordedPrefetchThresholdMs(8)).toBe(240_000);
    expect(RECORDED_PLAYBACK_SPEEDS[RECORDED_PLAYBACK_SPEEDS.length - 1]).toBe(512);
    expect(recordedTimelineRenderIntervalMs(1)).toBe(33);
    expect(recordedTimelineRenderIntervalMs(16)).toBe(50);
    expect(recordedTimelineRenderIntervalMs(512)).toBe(67);
  });

  it("clamps every replay range to the real wipe start", () => {
    const endMs = Date.parse("2026-07-17T06:00:00Z");
    const wipeStartMs = Date.parse("2026-07-16T17:17:01Z");
    expect(effectiveRecordedReplayRange(endMs, 31 * 24 * 60 * 60_000, wipeStartMs)).toEqual({
      startMs: wipeStartMs,
      endMs,
    });
    expect(effectiveRecordedReplayRange(endMs, 15 * 60_000, wipeStartMs)).toEqual({
      startMs: endMs - 15 * 60_000,
      endMs,
    });
  });

  it("counts only ready coverage inside the effective range", () => {
    expect(recordedCoverageDurationMs([
      { startMs: 0, endMs: 20_000 },
      { startMs: 30_000, endMs: 50_000 },
    ], 10_000, 40_000)).toBe(20_000);
  });

  it("finds surrounding frames with a binary search friendly sorted timeline", () => {
    const frames = [0, 10, 20, 30].map((second) => ({ timestamp: new Date(second * 1_000).toISOString(), second }));
    expect(recordedTimelineFramesAround(frames, 15_000)).toMatchObject({
      lower: { second: 10 },
      upper: { second: 20 },
      progress: 0.5,
    });
    expect(recordedTimelineFramesAround(frames, 40_000)).toMatchObject({
      lower: { second: 30 },
      upper: { second: 30 },
      progress: 0,
    });
  });

  it("keeps four replay state batches and evicts the least recently used batch", () => {
    const cache = new RecordedTimelineBatchCache<number>(4);
    ["a", "b", "c", "d"].forEach((key, index) => cache.set(key, index));
    expect(cache.get("a")).toBe(0);
    cache.set("e", 4);
    expect(cache.keys()).toEqual(["c", "d", "a", "e"]);
    expect(cache.get("b")).toBeUndefined();
  });

  it("queues cursor coverage first and merges adjacent ready coverage", () => {
    const buffer = new RecordedTimelineBuffer<string>();
    buffer.configure(0, 30 * 60_000, 1);
    const later = buffer.ensureAt(12 * 60_000, 2);
    const current = buffer.ensureAt(2 * 60_000, 0);
    expect(buffer.nextQueued()?.key).toBe(current.key);
    buffer.markLoading(current.key);
    buffer.markReady(current.key, "current", 100);
    const adjacent = buffer.ensureAt(6 * 60_000, 1);
    buffer.markLoading(adjacent.key);
    buffer.markReady(adjacent.key, "adjacent", 100);
    expect(buffer.contiguousReadyEnd(2 * 60_000)).toBe(10 * 60_000);
    expect(later.state).toBe("queued");
  });

  it("splits oversized chunks without going below the minimum split span", () => {
    const buffer = new RecordedTimelineBuffer<string>();
    buffer.configure(0, 10 * 60_000, 1);
    const chunk = buffer.ensureAt(0, 0);
    const halves = buffer.split(chunk.key);
    expect(halves).toHaveLength(2);
    expect(halves[0]!.endMs).toBe(halves[1]!.startMs);
    const tiny = buffer.enqueue(0, 30_000, 0);
    expect(buffer.split(tiny.key)).toEqual([]);
    expect(RECORDED_BUFFER_SPLIT_BYTES).toBe(2 * 1024 * 1024);
  });

  it("evicts unprotected ready chunks by count and encoded byte budget", () => {
    const buffer = new RecordedTimelineBuffer<string>(2, 1_000);
    buffer.configure(0, 20 * 60_000, 1);
    const first = buffer.enqueue(0, 60_000, 0);
    const second = buffer.enqueue(60_000, 120_000, 1);
    const third = buffer.enqueue(120_000, 180_000, 2);
    [first, second, third].forEach((entry) => {
      buffer.markLoading(entry.key);
      buffer.markReady(entry.key, entry.key, 600);
    });
    const evicted = buffer.enforceLimits(new Set([third.key]));
    expect(evicted).toEqual([first.key, second.key]);
    expect(buffer.readyEntries().map((entry) => entry.key)).toEqual([third.key]);
    expect(RECORDED_BUFFER_MAX_BYTES).toBe(12 * 1024 * 1024);
  });

  it("reports disjoint resident coverage and discards only pending work", () => {
    const buffer = new RecordedTimelineBuffer<string>();
    buffer.configure(0, 20 * 60_000, 1);
    const ready = buffer.enqueue(0, 60_000, 0);
    const pending = buffer.enqueue(5 * 60_000, 6 * 60_000, 2);
    buffer.markLoading(ready.key);
    buffer.markReady(ready.key, "ready", 100);
    buffer.markLoading(pending.key);
    expect(buffer.coverage("ready")).toEqual([{ startMs: 0, endMs: 60_000, state: "ready" }]);
    buffer.discardPending();
    expect(buffer.readyEntries()).toHaveLength(1);
    expect(buffer.entriesCount()).toBe(1);
  });

  it("keeps ready payloads while the range expands or playback speed increases", () => {
    const buffer = new RecordedTimelineBuffer<string>();
    buffer.configure(11 * 60 * 60_000, 12 * 60 * 60_000, 1);
    const tail = buffer.ensureAt(12 * 60 * 60_000 - 1, 0);
    buffer.markLoading(tail.key);
    buffer.markReady(tail.key, "tail", 100);
    buffer.updateRange(0, 12 * 60 * 60_000);
    buffer.setSpeed(128);
    expect(buffer.entryAt(12 * 60 * 60_000 - 1)?.value).toBe("tail");
    expect(buffer.speed).toBe(128);
  });

  it("discards resident chunks that extend outside a shrunken range", () => {
    const buffer = new RecordedTimelineBuffer<string>();
    buffer.configure(0, 60 * 60_000, 1);
    const old = buffer.enqueue(0, 10 * 60_000, 2);
    const current = buffer.enqueue(45 * 60_000, 50 * 60_000, 0);
    [old, current].forEach((entry) => {
      buffer.markLoading(entry.key);
      buffer.markReady(entry.key, entry.key, 100);
    });
    buffer.updateRange(45 * 60_000, 60 * 60_000);
    expect(buffer.readyEntries().map((entry) => entry.key)).toEqual([current.key]);
  });

  it("backs off failed required chunks and retries them after the deadline", () => {
    const buffer = new RecordedTimelineBuffer<string>();
    buffer.configure(0, 10 * 60_000, 1);
    const entry = buffer.ensureAt(0, 0);
    buffer.markLoading(entry.key);
    const failed = buffer.markError(entry.key, 10_000)!;
    expect(failed.retryAtMs).toBe(11_000);
    expect(buffer.nextQueued(10_999)).toBeNull();
    expect(buffer.nextQueued(11_000)?.key).toBe(entry.key);
  });

  it("evicts the farthest unprotected resident chunk when forward buffering needs room", () => {
    const buffer = new RecordedTimelineBuffer<string>(3, Number.POSITIVE_INFINITY);
    buffer.configure(0, 20 * 60_000, 1);
    const entries = [0, 5, 10].map((minutes) => buffer.enqueue(minutes * 60_000, (minutes + 1) * 60_000, 2));
    entries.forEach((entry) => {
      buffer.markLoading(entry.key);
      buffer.markReady(entry.key, entry.key, 1);
    });
    expect(buffer.evictFarthestFrom(30_000, new Set([entries[0]!.key]))).toBe(entries[2]!.key);
  });

  it("protects contiguous range-start preload coverage from eviction churn", () => {
    const buffer = new RecordedTimelineBuffer<string>(4, Number.POSITIVE_INFINITY);
    buffer.configure(0, 60 * 60_000, 1);
    const startEntries = [0, 5, 10].map((minutes) => buffer.enqueue(minutes * 60_000, (minutes + 5) * 60_000, 1));
    const tail = buffer.enqueue(55 * 60_000, 60 * 60_000, 0);
    [...startEntries, tail].forEach((entry) => {
      buffer.markLoading(entry.key);
      buffer.markReady(entry.key, entry.key, 1);
    });
    const protectedKeys = buffer.contiguousKeysAt(0);
    protectedKeys.add(tail.key);
    expect([...protectedKeys]).toEqual([...startEntries.map((entry) => entry.key), tail.key]);
    expect(buffer.evictFarthestFrom(0, protectedKeys)).toBeNull();
  });

  it("holds replay at an unloaded boundary without clearing playing intent", () => {
    const clock = new RecordedTimelineClock();
    clock.configureReplay({ startMs: 0, endMs: 60_000, speed: 1, playing: true });
    expect(clock.tick(10_000, 5_000)).toMatchObject({ cursorMs: 5_000, waiting: true, buffering: true });
    expect(clock.playing).toBe(true);
    expect(clock.tick(1_000, 20_000)).toMatchObject({ cursorMs: 6_000, buffering: false });
  });

  it("does not wrap a checked replay tail until the destination is ready", () => {
    const clock = new RecordedTimelineClock();
    clock.configureReplay({ startMs: 0, endMs: 10_000, cursorMs: 10_000, loop: true });
    expect(clock.tick(1).needsTailCheck).toBe(true);
    clock.resolveReplayTail(12_000);
    expect(clock.tick(2_000, Number.POSITIVE_INFINITY, false)).toMatchObject({ cursorMs: 12_000, buffering: true, wrapped: false });
    expect(clock.tick(1, Number.POSITIVE_INFINITY, true)).toMatchObject({ cursorMs: 2_000, wrapped: true });
  });

  it("follows the replay head without wrapping and catches up when the head advances", () => {
    const clock = new RecordedTimelineClock();
    clock.configureReplay({ startMs: 0, endMs: 10_000, speed: 8, effectiveSpeed: 4, loop: true, followingHead: true });
    expect(clock.cursorMs).toBe(10_000);
    expect(clock.tick(1_000, 10_000)).toMatchObject({ cursorMs: 10_000, waiting: true, wrapped: false, needsTailCheck: false });
    clock.setReplayHead(18_000);
    expect(clock.tick(1_000, 18_000)).toMatchObject({ cursorMs: 14_000, waiting: false });
    expect(clock.playbackState(false, true)).toBe("performance-limited");
  });

  it("leaves head following after a historical seek and can explicitly reattach", () => {
    const clock = new RecordedTimelineClock();
    clock.configureReplay({ startMs: 0, endMs: 60_000, followingHead: true });
    clock.seek(30_000);
    expect(clock.followingHead).toBe(false);
    expect(clock.playbackState()).toBe("historical-playing");
    clock.followReplayHead();
    expect(clock.followingHead).toBe(true);
    expect(clock.cursorMs).toBe(60_000);
  });

  it("uses effective wall time for historical loop prefetch and never prefetches while following", () => {
    expect(recordedReplayWrapPrefetchDue(8 * 60_000, 10 * 60_000, 1, false)).toBe(false);
    expect(recordedReplayWrapPrefetchDue(590_000, 600_000, 1, false)).toBe(true);
    expect(recordedReplayWrapPrefetchDue(8 * 60_000, 10 * 60_000, 512, false)).toBe(true);
    expect(recordedReplayWrapPrefetchDue(599_000, 600_000, 512, true)).toBe(false);
  });

  it("caps each accelerated cursor step so short event windows cannot be skipped", () => {
    const clock = new RecordedTimelineClock();
    clock.configureReplay({ startMs: 0, endMs: 10 * 60_000, speed: 512, effectiveSpeed: 512, playing: true });
    expect(clock.tick(1_000).cursorMs).toBe(RECORDED_REPLAY_MAX_EVENT_STEP_MS);
    expect(clock.tick(1_000).cursorMs).toBe(RECORDED_REPLAY_MAX_EVENT_STEP_MS * 2);
  });
});
