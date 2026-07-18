export type MapViewerRendererCounters = {
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
};

export type MapViewerDiagnosticsSnapshot = {
  generatedAt: string;
  fps: { rolling: number; average: number; p95: number };
  frameTimeMs: { rolling: number; average: number; p95: number; peak: number };
  longestRafGapMs: number;
  longTasks: { count: number; totalDurationMs: number; longestDurationMs: number; recent: Array<{ startTime: number; duration: number }> };
  heap: { usedBytes: number; totalBytes: number; limitBytes: number } | null;
  renderer: MapViewerRendererCounters;
  quality: { requested: string; resolved: string; runtime: string; performanceTier: string };
  replay: {
    mode: string;
    state: string;
    speed: number;
    targetSpeed: number;
    effectiveSpeed: number;
    followingHead: boolean;
    schedulerTier: string;
    pausedReason: string;
    rangeStartMs: number;
    rangeEndMs: number;
    cursorMs: number;
    wipeStartMs: number;
  };
  buffer: { chunks: number; bytes: number; activeRequests: number; eventPages: number; eventsComplete: boolean; eventBacklog: number };
  timingsMs: { request: number; download: number; parseQueue: number; parse: number; merge: number; bufferPlan: number; cursorRender: number };
  activeObjects: { objects: number; meshes: number; instancedMeshes: number; lines: number; sprites: number };
  lod: {
    monument: { queued: number; active: number; cached: number; map: number; mid: number; close: number };
    tree: { queued: number; active: number; cached: number; map: number; mid: number; close: number };
  };
  capture: { active: boolean; name: string; startedAt: string | null; samples: number };
};

export type MapViewerDiagnosticsCapture = {
  name: string;
  startedAt: string;
  stoppedAt: string;
  samples: MapViewerDiagnosticsSnapshot[];
};

export type RaidlandsMapDiagnosticsApi = {
  getSnapshot: () => MapViewerDiagnosticsSnapshot;
  startCapture: (name?: string) => void;
  stopCapture: () => MapViewerDiagnosticsCapture | null;
  resetPeaks: () => void;
};

declare global {
  interface Window {
    raidlandsMapDiagnostics?: RaidlandsMapDiagnosticsApi;
  }
}

const MAX_FRAME_SAMPLES = 900;
const MAX_CAPTURE_SAMPLES = 600;
const MAX_LONG_TASKS = 240;
const activeMapViewerDiagnostics = new Set<MapViewerDiagnostics>();

function finite(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rounded(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round(finite(value) * scale) / scale;
}

export function diagnosticPercentile(values: number[], percentile: number): number {
  const finiteValues = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finiteValues.length === 0) return 0;
  const bounded = Math.min(1, Math.max(0, percentile));
  const index = Math.max(0, Math.ceil(bounded * finiteValues.length) - 1);
  return finiteValues[index] || 0;
}

export function diagnosticPeak(previous: number, candidate: number): number {
  return Math.max(finite(previous), finite(candidate));
}

export function mapViewerDiagnosticsEnabled(location: Pick<Location, "hostname" | "search"> = window.location): boolean {
  const override = new URLSearchParams(location.search).get("mapDebug");
  if (override === "0") return false;
  if (override === "1") return true;
  return ["localhost", "127.0.0.1", "::1"].includes(location.hostname.toLowerCase());
}

export class MapViewerDiagnostics {
  private readonly frames: number[] = [];
  private readonly longTasks: Array<{ startTime: number; duration: number }> = [];
  private renderer: MapViewerRendererCounters = { calls: 0, triangles: 0, points: 0, lines: 0, geometries: 0, textures: 0 };
  private longestRafGapMs = 0;
  private framePeakMs = 0;
  private visible = true;
  private captureName = "";
  private captureStartedAt: string | null = null;
  private captureSamples: MapViewerDiagnosticsSnapshot[] = [];
  private hud: HTMLElement | null = null;
  private hudOutput: HTMLElement | null = null;
  private refreshTimer = 0;
  private longTaskObserver: PerformanceObserver | null = null;
  private readonly publicApi: RaidlandsMapDiagnosticsApi = {
    getSnapshot: () => this.getSnapshot(),
    startCapture: (name?: string) => this.startCapture(name),
    stopCapture: () => this.stopCapture(),
    resetPeaks: () => this.resetPeaks(),
  };

  public constructor(private readonly root: HTMLElement) {
    activeMapViewerDiagnostics.add(this);
    this.observeLongTasks();
    this.createHud();
    this.refreshTimer = window.setInterval(() => this.refresh(), 500);
    this.refresh();
  }

  public recordFrame(frameMs: number): void {
    if (!this.visible || !Number.isFinite(frameMs) || frameMs <= 0) return;
    this.frames.push(frameMs);
    if (this.frames.length > MAX_FRAME_SAMPLES) this.frames.splice(0, this.frames.length - MAX_FRAME_SAMPLES);
    this.framePeakMs = diagnosticPeak(this.framePeakMs, frameMs);
    this.longestRafGapMs = diagnosticPeak(this.longestRafGapMs, frameMs);
  }

  public recordRenderer(counters: MapViewerRendererCounters): void {
    this.renderer = { ...counters };
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
  }

  public getSnapshot(): MapViewerDiagnosticsSnapshot {
    const rollingFrames = this.frames.slice(-120);
    const averageFrame = this.average(this.frames);
    const rollingFrame = this.average(rollingFrames);
    const fpsValues = this.frames.map((frame) => 1000 / Math.max(0.01, frame));
    const dataset = this.root.dataset;
    const heapMemory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    const recentLongTasks = this.longTasks.slice(-20);
    return {
      generatedAt: new Date().toISOString(),
      fps: {
        rolling: rounded(rollingFrame > 0 ? 1000 / rollingFrame : 0),
        average: rounded(averageFrame > 0 ? 1000 / averageFrame : 0),
        p95: rounded(diagnosticPercentile(fpsValues, 0.95)),
      },
      frameTimeMs: {
        rolling: rounded(rollingFrame),
        average: rounded(averageFrame),
        p95: rounded(diagnosticPercentile(this.frames, 0.95)),
        peak: rounded(this.framePeakMs),
      },
      longestRafGapMs: rounded(this.longestRafGapMs),
      longTasks: {
        count: this.longTasks.length,
        totalDurationMs: rounded(this.longTasks.reduce((sum, task) => sum + task.duration, 0)),
        longestDurationMs: rounded(this.longTasks.reduce((peak, task) => Math.max(peak, task.duration), 0)),
        recent: recentLongTasks.map((task) => ({ startTime: rounded(task.startTime), duration: rounded(task.duration) })),
      },
      heap: heapMemory ? {
        usedBytes: finite(heapMemory.usedJSHeapSize),
        totalBytes: finite(heapMemory.totalJSHeapSize),
        limitBytes: finite(heapMemory.jsHeapSizeLimit),
      } : null,
      renderer: { ...this.renderer },
      quality: {
        requested: dataset.environmentQualityRequested || "",
        resolved: dataset.environmentQualityResolved || "",
        runtime: dataset.environmentQualityRuntime || "",
        performanceTier: dataset.cameraPerformanceTier || "",
      },
      replay: {
        mode: dataset.timelineMode || "",
        state: dataset.timelineState || "",
        speed: finite(dataset.timelineSpeed, 1),
        targetSpeed: finite(dataset.timelineTargetSpeed, 1),
        effectiveSpeed: finite(dataset.timelineEffectiveSpeed, 1),
        followingHead: dataset.timelineFollowingHead === "true",
        schedulerTier: dataset.timelineSchedulerTier || "",
        pausedReason: dataset.timelinePausedReason || "",
        rangeStartMs: finite(dataset.timelineRangeStartMs),
        rangeEndMs: finite(dataset.timelineRangeEndMs),
        cursorMs: finite(dataset.timelineCursorMs),
        wipeStartMs: finite(dataset.timelineWipeStartMs),
      },
      buffer: {
        chunks: finite(dataset.timelineBufferChunks),
        bytes: finite(dataset.timelineBufferBytes),
        activeRequests: finite(dataset.timelineActiveRequests),
        eventPages: finite(dataset.timelineEventPages),
        eventsComplete: dataset.timelineEventsComplete !== "false",
        eventBacklog: finite(dataset.timelineEventBacklog),
      },
      timingsMs: {
        request: finite(dataset.timelineRequestMs),
        download: finite(dataset.timelineDownloadMs),
        parseQueue: finite(dataset.timelineParseQueueMs),
        parse: finite(dataset.timelineParseMs),
        merge: finite(dataset.timelineMergeMs),
        bufferPlan: finite(dataset.timelineBufferPlanMs),
        cursorRender: finite(dataset.timelineCursorRenderMs),
      },
      activeObjects: {
        objects: finite(dataset.viewerObjects),
        meshes: finite(dataset.viewerMeshes),
        instancedMeshes: finite(dataset.viewerInstancedMeshes),
        lines: finite(dataset.viewerLines),
        sprites: finite(dataset.viewerSprites),
      },
      lod: {
        monument: {
          queued: finite(dataset.monumentDecodeQueue),
          active: finite(dataset.monumentActiveLoads),
          cached: finite(dataset.monumentCacheEntries),
          map: finite(dataset.monumentMapLoaded),
          mid: finite(dataset.monumentMidLoaded),
          close: finite(dataset.monumentCloseLoaded),
        },
        tree: {
          queued: finite(dataset.treeDecodeQueue),
          active: finite(dataset.treeActiveLoads),
          cached: finite(dataset.treeLoadedAssets),
          map: finite(dataset.treeMapInstances),
          mid: finite(dataset.treeMidInstances),
          close: finite(dataset.treeCloseInstances),
        },
      },
      capture: {
        active: this.captureStartedAt !== null,
        name: this.captureName,
        startedAt: this.captureStartedAt,
        samples: this.captureSamples.length,
      },
    };
  }

  public startCapture(name = "map-playback"): void {
    this.captureName = String(name || "map-playback").slice(0, 80);
    this.captureStartedAt = new Date().toISOString();
    this.captureSamples = [];
    this.frames.length = 0;
    this.resetPeaks();
    this.refresh();
  }

  public stopCapture(): MapViewerDiagnosticsCapture | null {
    if (!this.captureStartedAt) return null;
    const result = {
      name: this.captureName,
      startedAt: this.captureStartedAt,
      stoppedAt: new Date().toISOString(),
      samples: [...this.captureSamples],
    };
    this.captureStartedAt = null;
    this.refresh();
    return result;
  }

  public resetPeaks(): void {
    this.longestRafGapMs = 0;
    this.framePeakMs = 0;
    this.longTasks.length = 0;
  }

  public dispose(): void {
    window.clearInterval(this.refreshTimer);
    this.longTaskObserver?.disconnect();
    this.hud?.remove();
    activeMapViewerDiagnostics.delete(this);
    if (window.raidlandsMapDiagnostics === this.publicApi) {
      const active = [...activeMapViewerDiagnostics];
      const fallback = active[active.length - 1];
      if (fallback) window.raidlandsMapDiagnostics = fallback.api();
      else delete window.raidlandsMapDiagnostics;
    }
  }

  public api(): RaidlandsMapDiagnosticsApi {
    return this.publicApi;
  }

  private average(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  private observeLongTasks(): void {
    if (!("PerformanceObserver" in window)) return;
    try {
      this.longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        });
        if (this.longTasks.length > MAX_LONG_TASKS) this.longTasks.splice(0, this.longTasks.length - MAX_LONG_TASKS);
      });
      this.longTaskObserver.observe({ type: "longtask", buffered: true });
    } catch {
      this.longTaskObserver = null;
    }
  }

  private createHud(): void {
    const hud = document.createElement("aside");
    hud.className = "server-map-debug-hud";
    hud.dataset.mapDebugHud = "true";
    hud.setAttribute("aria-label", "3D map diagnostics");
    hud.innerHTML = `
      <div class="server-map-debug-hud__actions">
        <button type="button" data-map-debug-capture>Start capture</button>
        <button type="button" data-map-debug-copy>Copy JSON</button>
        <button type="button" data-map-debug-reset>Reset peaks</button>
      </div>
      <pre class="server-map-debug-hud__output" data-map-debug-output></pre>
    `;
    this.root.appendChild(hud);
    this.hud = hud;
    this.hudOutput = hud.querySelector<HTMLElement>("[data-map-debug-output]");
    hud.querySelector<HTMLButtonElement>("[data-map-debug-capture]")?.addEventListener("click", (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      if (this.captureStartedAt) {
        this.stopCapture();
        button.textContent = "Start capture";
      } else {
        this.startCapture();
        button.textContent = "Stop capture";
      }
    });
    hud.querySelector<HTMLButtonElement>("[data-map-debug-copy]")?.addEventListener("click", () => {
      void navigator.clipboard?.writeText(JSON.stringify(this.getSnapshot(), null, 2));
    });
    hud.querySelector<HTMLButtonElement>("[data-map-debug-reset]")?.addEventListener("click", () => this.resetPeaks());
  }

  private refresh(): void {
    const snapshot = this.getSnapshot();
    if (this.captureStartedAt) {
      this.captureSamples.push(snapshot);
      if (this.captureSamples.length > MAX_CAPTURE_SAMPLES) this.captureSamples.shift();
    }
    if (!this.hudOutput) return;
    this.hudOutput.textContent = [
      `FPS ${snapshot.fps.rolling} avg ${snapshot.fps.average} | p95 frame ${snapshot.frameTimeMs.p95}ms`,
      `rAF peak ${snapshot.longestRafGapMs}ms | long tasks ${snapshot.longTasks.count} (${snapshot.longTasks.longestDurationMs}ms max)`,
      `renderer ${snapshot.renderer.calls} calls | ${snapshot.renderer.triangles.toLocaleString()} tris | ${snapshot.renderer.geometries} geom | ${snapshot.renderer.textures} tex`,
      `quality ${snapshot.quality.runtime}/${snapshot.quality.performanceTier} | replay ${snapshot.replay.state} ${snapshot.replay.targetSpeed}x/${snapshot.replay.effectiveSpeed}x`,
      `buffer ${snapshot.buffer.chunks} chunks ${Math.round(snapshot.buffer.bytes / 1024)}KB | req ${snapshot.buffer.activeRequests} | events ${snapshot.buffer.eventBacklog} across ${snapshot.buffer.eventPages} pages ${snapshot.buffer.eventsComplete ? "complete" : "pending"}`,
      `timeline req ${snapshot.timingsMs.request} queue ${snapshot.timingsMs.parseQueue} parse ${snapshot.timingsMs.parse} merge ${snapshot.timingsMs.merge} render ${snapshot.timingsMs.cursorRender}ms`,
      `monument q/a/cache ${snapshot.lod.monument.queued}/${snapshot.lod.monument.active}/${snapshot.lod.monument.cached} | tree ${snapshot.lod.tree.queued}/${snapshot.lod.tree.active}/${snapshot.lod.tree.cached}`,
      snapshot.heap ? `heap ${Math.round(snapshot.heap.usedBytes / 1048576)}MB / ${Math.round(snapshot.heap.totalBytes / 1048576)}MB` : "heap unavailable",
    ].join("\n");
  }
}

export function installMapViewerDiagnostics(root: HTMLElement): MapViewerDiagnostics | null {
  if (!mapViewerDiagnosticsEnabled()) return null;
  const diagnostics = new MapViewerDiagnostics(root);
  window.raidlandsMapDiagnostics = diagnostics.api();
  return diagnostics;
}
