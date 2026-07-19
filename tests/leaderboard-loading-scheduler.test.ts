import { describe, expect, it, vi } from "vitest";
import { PodiumAssetScheduler } from "../assets/ts/leaderboard-podium/loading-scheduler";

function response(bytes: number): Response {
  return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(bytes) } as Response;
}

describe("leaderboard podium asset scheduler", () => {
  it("bounds parallel fetches at four and deduplicates URLs", async () => {
    let active = 0; let peak = 0;
    const releases: Array<() => void> = [];
    const fetcher = vi.fn(async () => {
      active += 1; peak = Math.max(peak, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1; return response(8);
    }) as unknown as typeof fetch;
    const scheduler = new PodiumAssetScheduler({ fetcher, networkConcurrency: 4, yieldControl: async () => {} });
    const requests = Array.from({ length: 7 }, (_, index) => scheduler.prefetch(`/asset-${index}.glb`, 10));
    requests.push(scheduler.prefetch("/asset-0.glb", 0));
    await vi.waitFor(() => expect(releases).toHaveLength(4));
    while (releases.length) releases.shift()!();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(7));
    while (releases.length) releases.shift()!();
    await Promise.all(requests);
    expect(peak).toBe(4);
    expect(fetcher).toHaveBeenCalledTimes(7);
  });

  it("runs main-thread jobs one at a time in stable priority order", async () => {
    let active = 0; let peak = 0;
    const order: string[] = [];
    const scheduler = new PodiumAssetScheduler({ fetcher: vi.fn() as unknown as typeof fetch, yieldControl: async () => {} });
    scheduler.setPaused(true);
    const run = (name: string, priority: number) => scheduler.runMain(priority, async () => {
      active += 1; peak = Math.max(peak, active); order.push(name);
      await Promise.resolve(); active -= 1; return name;
    });
    const jobs = [run("background", 60), run("hero-a", 10), run("hero-b", 10), run("primary", 20)];
    scheduler.setPaused(false);
    await expect(Promise.all(jobs)).resolves.toEqual(["background", "hero-a", "hero-b", "primary"]);
    expect(order).toEqual(["hero-a", "hero-b", "primary", "background"]);
    expect(peak).toBe(1);
  });

  it("aborts queued work when disposed", async () => {
    const fetcher = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })) as unknown as typeof fetch;
    const scheduler = new PodiumAssetScheduler({ fetcher, networkConcurrency: 1, yieldControl: async () => {} });
    const active = scheduler.prefetch("/active.glb", 0);
    const queued = scheduler.prefetch("/queued.glb", 1);
    scheduler.setPaused(true);
    const main = scheduler.runMain(0, () => "never");
    const settled = Promise.allSettled([active, queued, main]);
    scheduler.dispose();
    const results = await settled;
    expect(results).toHaveLength(3);
    results.forEach((result) => {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") expect(result.reason).toMatchObject({ name: "AbortError" });
    });
  });

  it("rejects an active main-thread job immediately when disposed", async () => {
    let markStarted!: () => void; let release!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const work = new Promise<void>((resolve) => { release = resolve; });
    const scheduler = new PodiumAssetScheduler({ fetcher: vi.fn() as unknown as typeof fetch, yieldControl: async () => {} });
    const main = scheduler.runMain(0, async () => { markStarted(); await work; return "late"; });
    await started;
    scheduler.dispose();
    await expect(main).rejects.toMatchObject({ name: "AbortError" });
    release();
  });
});
