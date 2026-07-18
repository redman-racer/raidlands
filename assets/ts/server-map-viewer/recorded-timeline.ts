export type RecordedTimelineMode = "live" | "replay";

export type RecordedTimelinePlaybackState =
  | "following-head"
  | "historical-playing"
  | "paused"
  | "buffering"
  | "performance-limited";

export const RECORDED_PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512] as const;

export type RecordedTimelineTick = {
  cursorMs: number;
  waiting: boolean;
  buffering: boolean;
  needsTailCheck: boolean;
  wrapped: boolean;
  stopped: boolean;
};

export type RecordedTimelineChunkState = "queued" | "loading" | "ready" | "error";

export type RecordedTimelineCoverageRange = {
  startMs: number;
  endMs: number;
  state: RecordedTimelineChunkState;
};

export type RecordedTimelineBufferEntry<T> = {
  key: string;
  startMs: number;
  endMs: number;
  state: RecordedTimelineChunkState;
  priority: number;
  encodedBytes: number;
  value?: T;
  failures: number;
  retryAtMs: number;
  lastUsedAt: number;
};

export const RECORDED_BUFFER_MAX_CHUNKS = 6;
export const RECORDED_BUFFER_MAX_BYTES = 12 * 1024 * 1024;
export const RECORDED_BUFFER_SPLIT_BYTES = 2 * 1024 * 1024;
export const RECORDED_BUFFER_MIN_SPLIT_MS = 30_000;
export const RECORDED_REPLAY_LEAD_IN_MS = 2 * 60_000;
export const RECORDED_REPLAY_MAX_EVENT_STEP_MS = 60_000;

export function recordedTimelineNeedsDetailPressure(input: {
  mode: RecordedTimelineMode;
  modeSwitchLoading: boolean;
  buffering: boolean;
  tailChecking: boolean;
  pendingWrap: boolean;
  activeRequestPriorities: number[];
}): boolean {
  if (input.mode !== "replay") return false;
  return input.modeSwitchLoading
    || input.buffering
    || input.tailChecking
    || input.pendingWrap
    || input.activeRequestPriorities.length > 1;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function recordedBatchSpanSeconds(speed: number): number {
  void speed;
  return 5 * 60;
}

export function recordedSampleEverySeconds(speed: number): number {
  return speed <= 12 ? 0 : Math.ceil(speed / 12);
}

export function recordedPrefetchThresholdMs(speed: number): number {
  return Math.max(0.25, speed) * 30_000;
}

export function recordedTimelineRenderIntervalMs(speed: number): number {
  if (speed <= 4) return 33;
  if (speed <= 32) return 50;
  if (speed <= 128) return 50;
  return 67;
}

export function effectiveRecordedReplayRange(
  endMs: number,
  durationMs: number,
  wipeStartMs?: number | null,
): { startMs: number; endMs: number } {
  const safeEnd = Number.isFinite(endMs) ? endMs : 0;
  const safeDuration = Math.max(1, Number.isFinite(durationMs) ? durationMs : 1);
  const requestedStart = safeEnd - safeDuration;
  const minimum = wipeStartMs !== null && wipeStartMs !== undefined && Number.isFinite(wipeStartMs)
    ? wipeStartMs
    : Number.NEGATIVE_INFINITY;
  return { startMs: Math.min(safeEnd, Math.max(requestedStart, minimum)), endMs: safeEnd };
}

export function recordedCoverageDurationMs(
  ranges: Array<Pick<RecordedTimelineCoverageRange, "startMs" | "endMs">>,
  rangeStartMs: number,
  rangeEndMs: number,
): number {
  const minimum = Math.min(rangeStartMs, rangeEndMs);
  const maximum = Math.max(minimum, rangeEndMs);
  return ranges.reduce((sum, range) => {
    const startMs = Math.max(minimum, range.startMs);
    const endMs = Math.min(maximum, range.endMs);
    return sum + Math.max(0, endMs - startMs);
  }, 0);
}

export function recordedTimelineFramesAround<T extends { timestamp: string }>(
  frames: T[],
  cursorMs: number,
): { lower: T | null; upper: T | null; progress: number } {
  if (frames.length === 0) return { lower: null, upper: null, progress: 0 };
  let low = 0;
  let high = frames.length;
  while (low < high) {
    const midpoint = (low + high) >>> 1;
    const timestamp = Date.parse(frames[midpoint]?.timestamp || "");
    if (Number.isFinite(timestamp) && timestamp <= cursorMs) low = midpoint + 1;
    else high = midpoint;
  }
  const upperIndex = low;
  const lower = upperIndex > 0 ? frames[upperIndex - 1] || null : null;
  const upper = frames[upperIndex] || lower || frames[0] || null;
  if (!lower || !upper || lower === upper) return { lower, upper, progress: 0 };
  const lowerMs = Date.parse(lower.timestamp);
  const upperMs = Date.parse(upper.timestamp);
  return {
    lower,
    upper,
    progress: clamp((cursorMs - lowerMs) / Math.max(1, upperMs - lowerMs), 0, 1),
  };
}

export function latestRecordedAvailability(
  streams: Record<string, { availableThrough?: string } | undefined> | null | undefined,
): number | null {
  const timestamps = Object.values(streams || {})
    .map((stream) => Date.parse(String(stream?.availableThrough || "")))
    .filter(Number.isFinite);
  return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

export function relativeTimelineCursor(
  oldCursorMs: number,
  oldStartMs: number,
  oldEndMs: number,
  newStartMs: number,
  newEndMs: number,
): number {
  const oldDuration = Math.max(1, oldEndMs - oldStartMs);
  const progress = clamp((oldCursorMs - oldStartMs) / oldDuration, 0, 1);
  return newStartMs + progress * Math.max(1, newEndMs - newStartMs);
}

export function initialRecordedReplayCursor(rangeStartMs: number, rangeEndMs: number): number {
  const startMs = Math.min(rangeStartMs, rangeEndMs);
  const endMs = Math.max(startMs, rangeEndMs);
  return endMs;
}

export function recordedRangeChangeForegroundBounds(
  cursorMs: number,
  rangeStartMs: number,
  rangeEndMs: number,
  beforeMs = 30_000,
  afterMs = 30_000,
): { startMs: number; endMs: number } {
  const minimum = Math.min(rangeStartMs, rangeEndMs);
  const maximum = Math.max(minimum + 1, rangeEndMs);
  const cursor = clamp(cursorMs, minimum, maximum);
  const startMs = Math.max(minimum, cursor - Math.max(0, beforeMs));
  const endMs = Math.min(maximum, Math.max(startMs + 1, cursor + Math.max(0, afterMs)));
  return { startMs, endMs };
}

export function recordedReplayWrapPrefetchDue(
  cursorMs: number,
  cycleEndMs: number,
  effectiveSpeed: number,
  followingHead: boolean,
  wallLeadSeconds = 10,
): boolean {
  if (followingHead) return false;
  const remainingMs = Math.max(0, cycleEndMs - cursorMs);
  const wallRemainingMs = remainingMs / clamp(effectiveSpeed, 0.25, 512);
  return wallRemainingMs <= Math.max(1, wallLeadSeconds) * 1000;
}

export class RecordedTimelineBatchCache<T> {
  private readonly entries = new Map<string, T>();

  public constructor(private readonly capacity = 4) {}

  public get(key: string): T | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  public set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > Math.max(1, this.capacity)) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  public clear(): void {
    this.entries.clear();
  }

  public values(): IterableIterator<T> {
    return this.entries.values();
  }

  public keys(): string[] {
    return [...this.entries.keys()];
  }
}

function chunkKey(startMs: number, endMs: number): string {
  return `${Math.round(startMs)}:${Math.round(endMs)}`;
}

function mergeCoverageRanges(ranges: RecordedTimelineCoverageRange[]): RecordedTimelineCoverageRange[] {
  const sorted = [...ranges].sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
  const merged: RecordedTimelineCoverageRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && previous.state === range.state && range.startMs <= previous.endMs + 1) {
      previous.endMs = Math.max(previous.endMs, range.endMs);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export class RecordedTimelineBuffer<T> {
  private readonly entries = new Map<string, RecordedTimelineBufferEntry<T>>();
  private sequence = 0;
  public rangeStartMs = 0;
  public rangeEndMs = 1;
  public speed = 1;
  public revision = 0;

  public constructor(
    private readonly maximumChunks = RECORDED_BUFFER_MAX_CHUNKS,
    private readonly maximumBytes = RECORDED_BUFFER_MAX_BYTES,
  ) {}

  public configure(rangeStartMs: number, rangeEndMs: number, speed: number): void {
    this.entries.clear();
    this.rangeStartMs = Math.min(rangeStartMs, rangeEndMs);
    this.rangeEndMs = Math.max(this.rangeStartMs + 1, rangeEndMs);
    this.speed = clamp(speed, 0.25, 512);
    this.revision += 1;
  }

  public clear(): void {
    if (this.entries.size === 0) return;
    this.entries.clear();
    this.revision += 1;
  }

  public discardPending(): void {
    let changed = false;
    for (const [key, entry] of this.entries) {
      if (entry.state === "ready") continue;
      this.entries.delete(key);
      changed = true;
    }
    if (changed) this.revision += 1;
  }

  public updateRange(rangeStartMs: number, rangeEndMs: number): void {
    this.rangeStartMs = Math.min(rangeStartMs, rangeEndMs);
    this.rangeEndMs = Math.max(this.rangeStartMs + 1, rangeEndMs);
    for (const [key, entry] of this.entries) {
      if (entry.startMs < this.rangeStartMs || entry.endMs > this.rangeEndMs) this.entries.delete(key);
    }
    this.revision += 1;
  }

  public setSpeed(speed: number): void {
    const nextSpeed = clamp(speed, 0.25, 512);
    if (nextSpeed === this.speed) return;
    this.speed = nextSpeed;
    this.revision += 1;
  }

  public chunkBounds(cursorMs: number): { startMs: number; endMs: number } {
    const spanMs = recordedBatchSpanSeconds(this.speed) * 1000;
    const cursor = clamp(cursorMs, this.rangeStartMs, Math.max(this.rangeStartMs, this.rangeEndMs - 1));
    const offset = Math.max(0, cursor - this.rangeStartMs);
    const startMs = Math.max(this.rangeStartMs, this.rangeStartMs + Math.floor(offset / spanMs) * spanMs);
    return { startMs, endMs: Math.min(this.rangeEndMs, Math.max(startMs + 1, startMs + spanMs)) };
  }

  public ensureAt(cursorMs: number, priority: number): RecordedTimelineBufferEntry<T> {
    const existing = this.entryAt(cursorMs, false);
    if (existing) {
      existing.priority = Math.min(existing.priority, priority);
      existing.lastUsedAt = ++this.sequence;
      return existing;
    }
    const bounds = this.chunkBounds(cursorMs);
    return this.enqueue(bounds.startMs, bounds.endMs, priority);
  }

  public enqueue(startMs: number, endMs: number, priority: number): RecordedTimelineBufferEntry<T> {
    const start = clamp(Math.min(startMs, endMs), this.rangeStartMs, this.rangeEndMs);
    const end = clamp(Math.max(start + 1, endMs), start + 1, this.rangeEndMs);
    const key = chunkKey(start, end);
    const existing = this.entries.get(key);
    if (existing) {
      existing.priority = Math.min(existing.priority, priority);
      existing.lastUsedAt = ++this.sequence;
      return existing;
    }
    const entry: RecordedTimelineBufferEntry<T> = {
      key,
      startMs: start,
      endMs: end,
      state: "queued",
      priority,
      encodedBytes: 0,
      failures: 0,
      retryAtMs: 0,
      lastUsedAt: ++this.sequence,
    };
    this.entries.set(key, entry);
    this.revision += 1;
    return entry;
  }

  public nextQueued(nowMs = Date.now(), allowSpeculative = true): RecordedTimelineBufferEntry<T> | null {
    const candidates = [...this.entries.values()]
      .filter((entry) => (
        (entry.state === "queued" || (entry.state === "error" && entry.retryAtMs <= nowMs))
        && (allowSpeculative || entry.priority < 2)
      ))
      .sort((left, right) => left.priority - right.priority || left.startMs - right.startMs);
    return candidates[0] || null;
  }

  public markLoading(key: string): RecordedTimelineBufferEntry<T> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    entry.state = "loading";
    entry.lastUsedAt = ++this.sequence;
    this.revision += 1;
    return entry;
  }

  public markReady(key: string, value: T, encodedBytes: number): RecordedTimelineBufferEntry<T> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    entry.state = "ready";
    entry.value = value;
    entry.encodedBytes = Math.max(0, Math.round(encodedBytes));
    entry.failures = 0;
    entry.retryAtMs = 0;
    entry.lastUsedAt = ++this.sequence;
    this.revision += 1;
    return entry;
  }

  public markError(key: string, nowMs = Date.now()): RecordedTimelineBufferEntry<T> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    entry.state = "error";
    entry.value = undefined;
    entry.encodedBytes = 0;
    entry.failures += 1;
    entry.retryAtMs = nowMs + Math.min(15_000, 1_000 * (2 ** Math.max(0, entry.failures - 1)));
    entry.lastUsedAt = ++this.sequence;
    this.revision += 1;
    return entry;
  }

  public requeue(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.state = "queued";
    entry.retryAtMs = 0;
    entry.lastUsedAt = ++this.sequence;
    this.revision += 1;
  }

  public split(key: string): RecordedTimelineBufferEntry<T>[] {
    const entry = this.entries.get(key);
    if (!entry || (entry.endMs - entry.startMs) <= RECORDED_BUFFER_MIN_SPLIT_MS) return [];
    const midpoint = Math.round(entry.startMs + ((entry.endMs - entry.startMs) / 2));
    this.entries.delete(key);
    this.revision += 1;
    return [
      this.enqueue(entry.startMs, midpoint, entry.priority),
      this.enqueue(midpoint, entry.endMs, entry.priority),
    ];
  }

  public remove(key: string): void {
    if (!this.entries.delete(key)) return;
    this.revision += 1;
  }

  public entryAt(cursorMs: number, readyOnly = true): RecordedTimelineBufferEntry<T> | null {
    const matches = [...this.entries.values()]
      .filter((entry) => (!readyOnly || entry.state === "ready") && entry.startMs <= cursorMs && entry.endMs >= cursorMs)
      .sort((left, right) => {
        if (left.state === "ready" && right.state !== "ready") return -1;
        if (right.state === "ready" && left.state !== "ready") return 1;
        return (left.endMs - left.startMs) - (right.endMs - right.startMs);
      });
    const entry = matches[0] || null;
    if (entry) entry.lastUsedAt = ++this.sequence;
    return entry;
  }

  public contiguousReadyEnd(cursorMs: number): number | null {
    const ranges = this.coverage("ready");
    const range = ranges.find((candidate) => candidate.startMs <= cursorMs + 1 && candidate.endMs >= cursorMs - 1);
    return range ? range.endMs : null;
  }

  public contiguousKeysAt(cursorMs: number): Set<string> {
    const sorted = [...this.entries.values()].sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
    const first = sorted.find((entry) => entry.startMs <= cursorMs + 1 && entry.endMs >= cursorMs - 1);
    if (!first) return new Set();
    const keys = new Set<string>([first.key]);
    let endMs = first.endMs;
    let changed = true;
    while (changed) {
      changed = false;
      for (const entry of sorted) {
        if (keys.has(entry.key) || entry.startMs > endMs + 1 || entry.endMs < cursorMs - 1) continue;
        keys.add(entry.key);
        endMs = Math.max(endMs, entry.endMs);
        changed = true;
      }
    }
    return keys;
  }

  public coverage(state?: RecordedTimelineChunkState): RecordedTimelineCoverageRange[] {
    return mergeCoverageRanges([...this.entries.values()]
      .filter((entry) => state === undefined || entry.state === state)
      .map((entry) => ({ startMs: entry.startMs, endMs: entry.endMs, state: entry.state })));
  }

  public readyEntriesAround(cursorMs: number): RecordedTimelineBufferEntry<T>[] {
    const ready = [...this.entries.values()]
      .filter((entry) => entry.state === "ready" && entry.value !== undefined)
      .sort((left, right) => left.startMs - right.startMs);
    let index = ready.findIndex((entry) => entry.startMs <= cursorMs && entry.endMs >= cursorMs);
    if (index < 0) return [];
    if (ready.length <= 3) return ready;
    const start = Math.max(0, Math.min(ready.length - 3, index - 1));
    return ready.slice(start, start + 3);
  }

  public readyEntries(): RecordedTimelineBufferEntry<T>[] {
    return [...this.entries.values()].filter((entry) => entry.state === "ready" && entry.value !== undefined);
  }

  public entriesCount(): number {
    return this.entries.size;
  }

  public encodedBytes(): number {
    return [...this.entries.values()].reduce((sum, entry) => sum + (entry.state === "ready" ? entry.encodedBytes : 0), 0);
  }

  public enforceLimits(protectedKeys: Set<string>): string[] {
    const evicted: string[] = [];
    const overLimit = () => this.readyEntries().length > Math.max(1, this.maximumChunks)
      || this.encodedBytes() > Math.max(1, this.maximumBytes);
    while (overLimit()) {
      const candidate = this.readyEntries()
        .filter((entry) => !protectedKeys.has(entry.key))
        .sort((left, right) => left.lastUsedAt - right.lastUsedAt)[0];
      if (!candidate) break;
      this.entries.delete(candidate.key);
      evicted.push(candidate.key);
      this.revision += 1;
    }
    return evicted;
  }

  public evictFarthestFrom(cursorMs: number, protectedKeys: Set<string>): string | null {
    const candidate = this.readyEntries()
      .filter((entry) => !protectedKeys.has(entry.key))
      .map((entry) => ({
        entry,
        distance: entry.startMs <= cursorMs && entry.endMs >= cursorMs
          ? 0
          : Math.min(Math.abs(cursorMs - entry.startMs), Math.abs(cursorMs - entry.endMs)),
      }))
      .sort((left, right) => right.distance - left.distance || left.entry.lastUsedAt - right.entry.lastUsedAt)[0]?.entry;
    if (!candidate) return null;
    this.entries.delete(candidate.key);
    this.revision += 1;
    return candidate.key;
  }

  public totalReadyDurationMs(): number {
    return this.coverage("ready").reduce((sum, range) => sum + Math.max(0, range.endMs - range.startMs), 0);
  }
}

export class RecordedTimelineClock {
  public mode: RecordedTimelineMode = "live";
  public cursorMs = 0;
  public headMs = 0;
  public rangeStartMs = 0;
  public rangeEndMs = 0;
  public cycleEndMs = 0;
  public speed = 1;
  public effectiveSpeed = 1;
  public playing = true;
  public loop = false;
  public followingHead = false;
  private tailChecked = false;

  public configureLive(cursorMs: number, headMs: number): void {
    this.mode = "live";
    this.cursorMs = Number.isFinite(cursorMs) ? cursorMs : headMs;
    this.headMs = Math.max(this.cursorMs, headMs);
    this.speed = 1;
    this.effectiveSpeed = 1;
    this.playing = true;
    this.loop = false;
    this.followingHead = false;
    this.tailChecked = false;
  }

  public setLiveHead(headMs: number): void {
    if (Number.isFinite(headMs)) this.headMs = Math.max(this.headMs, headMs);
  }

  public configureReplay(options: {
    startMs: number;
    endMs: number;
    cursorMs?: number;
    speed?: number;
    effectiveSpeed?: number;
    playing?: boolean;
    loop?: boolean;
    followingHead?: boolean;
  }): void {
    const startMs = Math.min(options.startMs, options.endMs);
    const endMs = Math.max(startMs + 1, options.endMs);
    this.mode = "replay";
    this.rangeStartMs = startMs;
    this.rangeEndMs = endMs;
    this.cycleEndMs = endMs;
    this.cursorMs = clamp(options.cursorMs ?? startMs, startMs, endMs);
    this.headMs = endMs;
    this.speed = clamp(options.speed ?? 1, 0.25, 512);
    this.effectiveSpeed = clamp(options.effectiveSpeed ?? this.speed, 0.25, this.speed);
    this.playing = options.playing ?? true;
    this.loop = options.loop ?? false;
    this.followingHead = options.followingHead ?? false;
    if (this.followingHead) this.cursorMs = endMs;
    this.tailChecked = false;
  }

  public setReplaySpeed(speed: number): void {
    const unrestricted = this.effectiveSpeed === this.speed;
    this.speed = clamp(speed, 0.25, 512);
    this.effectiveSpeed = unrestricted ? this.speed : Math.min(this.effectiveSpeed, this.speed);
  }

  public setEffectiveReplaySpeed(speed: number): void {
    this.effectiveSpeed = clamp(speed, 0.25, this.speed);
  }

  public setReplayLoop(loop: boolean): void {
    this.loop = loop;
  }

  public followReplayHead(): void {
    if (this.mode !== "replay") return;
    this.followingHead = true;
    this.playing = true;
    this.cursorMs = this.headMs;
    this.cycleEndMs = this.headMs;
    this.tailChecked = false;
  }

  public leaveReplayHead(): void {
    this.followingHead = false;
    this.tailChecked = false;
  }

  public setReplayHead(headMs: number): void {
    if (this.mode !== "replay" || !Number.isFinite(headMs) || headMs <= this.headMs) return;
    const duration = Math.max(1, this.rangeEndMs - this.rangeStartMs);
    this.headMs = headMs;
    this.rangeEndMs = headMs;
    this.rangeStartMs = Math.max(0, headMs - duration);
    this.cycleEndMs = headMs;
    this.tailChecked = false;
  }

  public nearReplayHead(toleranceMs = 1_000): boolean {
    return this.mode === "replay" && this.cursorMs >= this.headMs - Math.max(0, toleranceMs);
  }

  public playbackState(buffering = false, performanceLimited = false): RecordedTimelinePlaybackState {
    if (buffering) return "buffering";
    if (!this.playing) return "paused";
    if (this.followingHead && this.cursorMs >= this.headMs) return "following-head";
    if (performanceLimited) return "performance-limited";
    return this.followingHead ? "following-head" : "historical-playing";
  }

  public seek(cursorMs: number): void {
    const maximum = this.mode === "live" ? this.headMs : this.cycleEndMs;
    const minimum = this.mode === "live" ? Math.min(this.cursorMs, maximum) : this.rangeStartMs;
    this.cursorMs = clamp(cursorMs, minimum, maximum);
    if (this.mode === "replay" && !this.nearReplayHead()) this.leaveReplayHead();
  }

  public tick(
    wallDeltaMs: number,
    playableThroughMs = Number.POSITIVE_INFINITY,
    wrapDestinationReady = true,
  ): RecordedTimelineTick {
    const result: RecordedTimelineTick = { cursorMs: this.cursorMs, waiting: false, buffering: false, needsTailCheck: false, wrapped: false, stopped: false };
    if (!this.playing || wallDeltaMs <= 0) {
      result.waiting = this.mode === "live" && this.cursorMs >= this.headMs;
      return result;
    }
    if (this.mode === "live") {
      this.cursorMs = Math.min(this.headMs, this.cursorMs + wallDeltaMs);
      result.cursorMs = this.cursorMs;
      result.waiting = this.cursorMs >= this.headMs;
      return result;
    }

    const playableEnd = Number.isFinite(playableThroughMs)
      ? clamp(playableThroughMs, this.cursorMs, this.cycleEndMs)
      : this.cycleEndMs;
    const requestedAdvanceMs = wallDeltaMs * this.effectiveSpeed;
    const eventSafeAdvanceMs = Math.min(requestedAdvanceMs, RECORDED_REPLAY_MAX_EVENT_STEP_MS);
    this.cursorMs = Math.min(playableEnd, this.cursorMs + eventSafeAdvanceMs);
    result.cursorMs = this.cursorMs;
    if (this.cursorMs >= playableEnd && playableEnd < this.cycleEndMs) {
      result.waiting = true;
      result.buffering = true;
      return result;
    }
    if (this.cursorMs < this.cycleEndMs) return result;
    if (this.followingHead) {
      result.waiting = true;
      return result;
    }
    if (!this.loop) {
      this.playing = false;
      result.stopped = true;
      return result;
    }
    if (!this.tailChecked) {
      this.tailChecked = true;
      this.playing = false;
      result.needsTailCheck = true;
      return result;
    }
    if (!wrapDestinationReady) {
      result.waiting = true;
      result.buffering = true;
      return result;
    }
    this.wrapReplayCycle();
    result.cursorMs = this.cursorMs;
    result.wrapped = true;
    return result;
  }

  public resolveReplayTail(discoveredEndMs: number | null): RecordedTimelineTick {
    const discovered = discoveredEndMs !== null && Number.isFinite(discoveredEndMs) ? discoveredEndMs : this.cycleEndMs;
    if (discovered > this.cycleEndMs) {
      this.cycleEndMs = discovered;
      this.playing = true;
      return { cursorMs: this.cursorMs, waiting: false, buffering: false, needsTailCheck: false, wrapped: false, stopped: false };
    }
    this.wrapReplayCycle();
    return { cursorMs: this.cursorMs, waiting: false, buffering: false, needsTailCheck: false, wrapped: true, stopped: false };
  }

  private wrapReplayCycle(): void {
    const duration = Math.max(1, this.rangeEndMs - this.rangeStartMs);
    this.rangeEndMs = this.cycleEndMs;
    this.rangeStartMs = this.rangeEndMs - duration;
    this.cursorMs = this.rangeStartMs;
    this.cycleEndMs = this.rangeEndMs;
    this.tailChecked = false;
    this.playing = true;
    this.followingHead = false;
  }
}
