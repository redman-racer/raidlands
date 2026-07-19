export type PodiumLoadPriority = number;

export type PodiumSchedulerSnapshot = {
  networkActive: number;
  networkQueued: number;
  mainActive: number;
  mainQueued: number;
  paused: boolean;
};

export type PodiumAssetSchedulerOptions = {
  networkConcurrency?: number;
  fetcher?: typeof fetch;
  yieldControl?: () => Promise<void>;
  onSnapshot?: (snapshot: PodiumSchedulerSnapshot) => void;
};

type FetchJob = {
  url: string;
  priority: PodiumLoadPriority;
  sequence: number;
  controller: AbortController;
  resolve: (buffer: ArrayBuffer) => void;
  reject: (error: unknown) => void;
};

type MainJob<T = unknown> = {
  priority: PodiumLoadPriority;
  sequence: number;
  work: () => T | Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function priorityOrder(left: { priority: number; sequence: number }, right: { priority: number; sequence: number }): number {
  return left.priority - right.priority || left.sequence - right.sequence;
}

function abortError(): Error {
  try { return new DOMException("Podium asset loading was cancelled.", "AbortError"); }
  catch { const error = new Error("Podium asset loading was cancelled."); error.name = "AbortError"; return error; }
}

export function yieldThroughPaint(): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => window.setTimeout(resolve, 0);
    if (document.hidden) window.setTimeout(resolve, 16);
    else window.requestAnimationFrame(finish);
  });
}

export class PodiumAssetScheduler {
  private readonly fetcher: typeof fetch;
  private readonly networkConcurrency: number;
  private readonly yieldControl: () => Promise<void>;
  private readonly onSnapshot?: (snapshot: PodiumSchedulerSnapshot) => void;
  private readonly downloads = new Map<string, Promise<ArrayBuffer>>();
  private readonly fetchJobs = new Map<string, FetchJob>();
  private readonly fetchQueue: FetchJob[] = [];
  private readonly activeControllers = new Set<AbortController>();
  private readonly mainQueue: MainJob<any>[] = [];
  private readonly resumeWaiters: Array<() => void> = [];
  private networkActive = 0;
  private mainActive = 0;
  private activeMainJob?: MainJob<any>;
  private mainDraining = false;
  private sequence = 0;
  private paused = false;
  private disposed = false;

  public constructor(options: PodiumAssetSchedulerOptions = {}) {
    this.fetcher = options.fetcher || fetch.bind(window);
    this.networkConcurrency = Math.max(1, Math.min(4, Math.round(options.networkConcurrency || 4)));
    this.yieldControl = options.yieldControl || yieldThroughPaint;
    this.onSnapshot = options.onSnapshot;
  }

  public prefetch(url: string, priority: PodiumLoadPriority): Promise<ArrayBuffer> {
    if (this.disposed) return Promise.reject(abortError());
    const cached = this.downloads.get(url);
    if (cached) {
      const queued = this.fetchJobs.get(url);
      if (queued && priority < queued.priority) {
        queued.priority = priority;
        this.fetchQueue.sort(priorityOrder);
        this.emit();
      }
      return cached;
    }

    const controller = new AbortController();
    const promise = new Promise<ArrayBuffer>((resolve, reject) => {
      const job: FetchJob = { url, priority, sequence: this.sequence++, controller, resolve, reject };
      this.fetchJobs.set(url, job);
      this.fetchQueue.push(job);
      this.fetchQueue.sort(priorityOrder);
      this.drainNetwork();
      this.emit();
    });
    this.downloads.set(url, promise);
    promise.catch(() => this.downloads.delete(url));
    return promise;
  }

  public releaseDownload(url: string): void {
    this.downloads.delete(url);
  }

  public runMain<T>(priority: PodiumLoadPriority, work: () => T | Promise<T>): Promise<T> {
    if (this.disposed) return Promise.reject(abortError());
    const promise = new Promise<T>((resolve, reject) => {
      this.mainQueue.push({ priority, sequence: this.sequence++, work, resolve, reject } as MainJob<T>);
      this.mainQueue.sort(priorityOrder);
      void this.drainMain();
      this.emit();
    });
    return promise;
  }

  public setPaused(paused: boolean): void {
    if (this.disposed || this.paused === paused) return;
    this.paused = paused;
    if (!paused) this.resumeWaiters.splice(0).forEach((resolve) => resolve());
    this.emit();
    if (!paused) void this.drainMain();
  }

  public snapshot(): PodiumSchedulerSnapshot {
    return {
      networkActive: this.networkActive,
      networkQueued: this.fetchQueue.length,
      mainActive: this.mainActive,
      mainQueued: this.mainQueue.length,
      paused: this.paused,
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const error = abortError();
    this.fetchQueue.splice(0).forEach((job) => { job.controller.abort(); job.reject(error); });
    this.fetchJobs.forEach((job) => job.controller.abort());
    this.fetchJobs.clear();
    this.activeControllers.forEach((controller) => controller.abort());
    this.activeControllers.clear();
    this.mainQueue.splice(0).forEach((job) => job.reject(error));
    this.activeMainJob?.reject(error);
    this.activeMainJob = undefined;
    this.resumeWaiters.splice(0).forEach((resolve) => resolve());
    this.downloads.clear();
    this.emit();
  }

  private drainNetwork(): void {
    while (!this.disposed && this.networkActive < this.networkConcurrency && this.fetchQueue.length) {
      const job = this.fetchQueue.shift()!;
      this.fetchJobs.delete(job.url);
      this.networkActive += 1;
      this.activeControllers.add(job.controller);
      this.emit();
      void this.fetcher(job.url, { cache: "force-cache", signal: job.controller.signal, headers: { Accept: "application/octet-stream,*/*" } })
        .then((response) => {
          if (!response.ok) throw new Error(`podium asset returned ${response.status}: ${job.url}`);
          return response.arrayBuffer();
        })
        .then(job.resolve, job.reject)
        .finally(() => {
          this.networkActive -= 1;
          this.activeControllers.delete(job.controller);
          this.emit();
          this.drainNetwork();
        });
    }
  }

  private async drainMain(): Promise<void> {
    if (this.disposed || this.mainDraining || !this.mainQueue.length) return;
    this.mainDraining = true;
    let job: MainJob<any> | undefined;
    try {
      if (this.paused) {
        await new Promise<void>((resolve) => this.resumeWaiters.push(resolve));
        if (this.disposed) return;
      }
      job = this.mainQueue.shift();
      if (!job) return;
      this.activeMainJob = job;
      this.mainActive = 1;
      this.emit();
      await this.yieldControl();
      if (this.disposed) throw abortError();
      const value = await job.work();
      if (this.disposed) throw abortError();
      job.resolve(value);
    } catch (error) {
      job?.reject(error);
    } finally {
      this.mainActive = 0;
      if (this.activeMainJob === job) this.activeMainJob = undefined;
      this.mainDraining = false;
      this.emit();
      if (!this.disposed) void this.drainMain();
    }
  }

  private emit(): void {
    this.onSnapshot?.(this.snapshot());
  }
}
