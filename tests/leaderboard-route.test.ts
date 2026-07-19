import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Panel = { dataset: Record<string, string> };
type HistoryCall = { mode: "push" | "replace"; url: string };

const site = readFileSync(resolve(process.cwd(), "assets/js/site.js"), "utf8");

function sourceBetween(start: string, end: string): string {
  const from = site.indexOf(start);
  const to = site.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Could not locate leaderboard source between ${start} and ${end}.`);
  return site.slice(from, to);
}

function routeRuntime(location: URL) {
  const calls: HistoryCall[] = [];
  const window = {
    location,
    history: {
      pushState: (_state: unknown, _title: string, url: string) => calls.push({ mode: "push", url }),
      replaceState: (_state: unknown, _title: string, url: string) => calls.push({ mode: "replace", url }),
    },
  };
  const source = [
    sourceBetween("function readLeaderboardParams", "async function loadLeaderboardPanel"),
    sourceBetween("function leaderboardPageUrl", "function applyLeaderboardPayload"),
    sourceBetween("function normalizeLeaderboardBoard", "function formatLeaderboardNumber"),
  ].join("\n");
  const factory = new Function("window", `${source}\nreturn { readLeaderboardParams, leaderboardPageUrl, updateLeaderboardHistory, normalizeLeaderboardBoard, normalizeLeaderboardMetric };`);
  return { ...factory(window), calls } as {
    readLeaderboardParams: (panel: Panel, params: URLSearchParams, resetPage: boolean) => void;
    leaderboardPageUrl: (panel: Panel) => string;
    updateLeaderboardHistory: (panel: Panel, mode: "push" | "replace" | "none") => void;
    normalizeLeaderboardBoard: (board: unknown) => string;
    normalizeLeaderboardMetric: (board: string, metric: unknown) => string;
    calls: HistoryCall[];
  };
}

describe("leaderboard SPA route state", () => {
  it.each([
    ["players", "distance", "all-time", "", "", "player name", "4", "50"],
    ["raids", "c4_used", "current", "", "", "raid target", "2", "25"],
    ["bots", "deaths", "wipe", "7", "", "scientist", "3", "100"],
    ["rp-games", "total-won", "wipe", "", "summer-2026", "jackpot", "9", "5"],
  ])("round-trips %s controls through canonical URL state", (board, metric, scope, wipeId, wipeKey, search, page, perPage) => {
    const runtime = routeRuntime(new URL("http://localhost/raidlands/leaderboard/?unrelated=kept"));
    const panel: Panel = { dataset: { board } };
    const params = new URLSearchParams({ board, metric, scope, q: search, page, per_page: perPage });
    if (wipeId) params.set("wipe_id", wipeId);
    if (wipeKey) params.set("wipe_key", wipeKey);

    runtime.readLeaderboardParams(panel, params, false);
    const restored = new URL(runtime.leaderboardPageUrl(panel), "http://localhost").searchParams;

    expect(panel.dataset).toMatchObject({ board, metric, scope, search, page, perPage, wipeId, wipeKey });
    expect(restored.get("board")).toBe(board);
    expect(restored.get("metric")).toBe(metric);
    expect(restored.get("scope")).toBe(scope);
    expect(restored.get("q")).toBe(search);
    expect(restored.get("page")).toBe(page);
    expect(restored.get("per_page")).toBe(perPage);
    expect(restored.get("wipe_id")).toBe(wipeId || null);
    expect(restored.get("wipe_key")).toBe(wipeKey || null);
  });

  it("normalizes invalid boards and each board's metric family", () => {
    const runtime = routeRuntime(new URL("http://localhost/raidlands/leaderboard/"));
    expect(runtime.normalizeLeaderboardBoard("unknown")).toBe("players");
    expect(runtime.normalizeLeaderboardMetric("players", "headshots")).toBe("headshots");
    expect(runtime.normalizeLeaderboardMetric("raids", "rockets_used")).toBe("rockets_used");
    expect(runtime.normalizeLeaderboardMetric("bots", "kills")).toBe("kills");
    expect(runtime.normalizeLeaderboardMetric("rp-games", "anything")).toBe("total-won");
  });

  it("pushes discrete changes, replaces debounced search, and leaves popstate alone", () => {
    const runtime = routeRuntime(new URL("http://localhost/raidlands/leaderboard/?board=players"));
    const panel: Panel = { dataset: { board: "bots", metric: "kdr", scope: "current", page: "1", perPage: "25", search: "" } };
    runtime.updateLeaderboardHistory(panel, "push");
    panel.dataset.search = "heavy";
    runtime.updateLeaderboardHistory(panel, "replace");
    runtime.updateLeaderboardHistory(panel, "none");
    expect(runtime.calls.map(({ mode }) => mode)).toEqual(["push", "replace"]);
    expect(runtime.calls[1].url).toContain("q=heavy");
  });
});
