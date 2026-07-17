export type RecordedTimelineMode = "live" | "replay";

export const RECORDED_PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512] as const;

export type RecordedTimelineTick = {
  cursorMs: number;
  waiting: boolean;
  needsTailCheck: boolean;
  wrapped: boolean;
  stopped: boolean;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function recordedBatchSpanSeconds(speed: number): number {
  return clamp(Math.round(Math.max(0.25, speed) * 120), 15 * 60, 6 * 60 * 60);
}

export function recordedSampleEverySeconds(speed: number): number {
  return speed <= 12 ? 0 : Math.ceil(speed / 12);
}

export function recordedPrefetchThresholdMs(speed: number): number {
  return Math.max(0.25, speed) * 30_000;
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

export class RecordedTimelineClock {
  public mode: RecordedTimelineMode = "live";
  public cursorMs = 0;
  public headMs = 0;
  public rangeStartMs = 0;
  public rangeEndMs = 0;
  public cycleEndMs = 0;
  public speed = 1;
  public playing = true;
  public loop = false;
  private tailChecked = false;

  public configureLive(cursorMs: number, headMs: number): void {
    this.mode = "live";
    this.cursorMs = Number.isFinite(cursorMs) ? cursorMs : headMs;
    this.headMs = Math.max(this.cursorMs, headMs);
    this.speed = 1;
    this.playing = true;
    this.loop = false;
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
    playing?: boolean;
    loop?: boolean;
  }): void {
    const startMs = Math.min(options.startMs, options.endMs);
    const endMs = Math.max(startMs + 1, options.endMs);
    this.mode = "replay";
    this.rangeStartMs = startMs;
    this.rangeEndMs = endMs;
    this.cycleEndMs = endMs;
    this.cursorMs = clamp(options.cursorMs ?? startMs, startMs, endMs);
    this.speed = clamp(options.speed ?? 1, 0.25, 512);
    this.playing = options.playing ?? true;
    this.loop = options.loop ?? false;
    this.tailChecked = false;
  }

  public setReplaySpeed(speed: number): void {
    this.speed = clamp(speed, 0.25, 512);
  }

  public setReplayLoop(loop: boolean): void {
    this.loop = loop;
  }

  public seek(cursorMs: number): void {
    const maximum = this.mode === "live" ? this.headMs : this.cycleEndMs;
    const minimum = this.mode === "live" ? Math.min(this.cursorMs, maximum) : this.rangeStartMs;
    this.cursorMs = clamp(cursorMs, minimum, maximum);
  }

  public tick(wallDeltaMs: number): RecordedTimelineTick {
    const result: RecordedTimelineTick = { cursorMs: this.cursorMs, waiting: false, needsTailCheck: false, wrapped: false, stopped: false };
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

    this.cursorMs = Math.min(this.cycleEndMs, this.cursorMs + wallDeltaMs * this.speed);
    result.cursorMs = this.cursorMs;
    if (this.cursorMs < this.cycleEndMs) return result;
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
      return { cursorMs: this.cursorMs, waiting: false, needsTailCheck: false, wrapped: false, stopped: false };
    }
    this.wrapReplayCycle();
    return { cursorMs: this.cursorMs, waiting: false, needsTailCheck: false, wrapped: true, stopped: false };
  }

  private wrapReplayCycle(): void {
    const duration = Math.max(1, this.rangeEndMs - this.rangeStartMs);
    this.rangeEndMs = this.cycleEndMs;
    this.rangeStartMs = this.rangeEndMs - duration;
    this.cursorMs = this.rangeStartMs;
    this.cycleEndMs = this.rangeEndMs;
    this.tailChecked = false;
    this.playing = true;
  }
}
