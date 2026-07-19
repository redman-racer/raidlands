type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
};

const hosts = [...document.querySelectorAll<HTMLElement>("[data-leaderboard-podium]")];
let loading: Promise<unknown> | undefined;

const phaseProgress: Record<string, number> = { poster: 0, queued: 14, loading: 30, initializing: 46, scene: 62, characters: 76, details: 88, ready: 100, fallback: 100 };

function setProgress(host: HTMLElement, progress: number) {
  const value = Math.max(0, Math.min(100, Math.round(progress)));
  host.style.setProperty("--loader-progress", String(value));
  host.style.setProperty("--loader-progress-sweep", `${value * 3.6}deg`);
  host.style.setProperty("--loader-progress-tip-opacity", value > 0 && value < 100 ? "1" : "0");
  host.style.setProperty("--loader-progress-tip-angle", `${value * 3.6 - 180}deg`);
  host.style.setProperty("--loader-progress-tip-counter-angle", `${180 - value * 3.6}deg`);
  const progressValue = host.querySelector<HTMLElement>("[data-podium-progress-value]");
  if (progressValue) progressValue.textContent = String(value).padStart(2, "0");
}

function setPhase(state: string, message: string) {
  hosts.forEach((host) => {
    if (host.dataset.podiumState === "ready" || host.dataset.podiumState === "fallback") return;
    host.dataset.podiumState = state;
    setProgress(host, phaseProgress[state] ?? 0);
    const status = host.querySelector<HTMLElement>("[data-podium-status]");
    if (status) status.textContent = message;
  });
}

function loadPodium() {
  if (loading) return loading;
  setPhase("loading", "Downloading the interactive arena…");
  loading = import("./app").catch((error) => {
    console.warn("Raidlands podium module failed to load.", error);
    setPhase("fallback", "3D unavailable. Leaderboard results are still ready below.");
  });
  return loading;
}

function scheduleLoad() {
  const start = () => {
    setPhase("queued", "Preparing the interactive arena…");
    const idleWindow = window as IdleWindow;
    if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(() => void loadPodium(), { timeout: 1200 });
    else window.setTimeout(() => void loadPodium(), 80);
  };
  if (document.readyState === "complete") requestAnimationFrame(() => requestAnimationFrame(start));
  else window.addEventListener("load", () => requestAnimationFrame(start), { once: true });
}

if (hosts.length) {
  const visibleHost = hosts.find((host) => !host.closest<HTMLElement>("[data-leaderboard-panel]")?.hidden) || hosts[0];
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect(); scheduleLoad();
    }, { rootMargin: "320px 0px" });
    observer.observe(visibleHost);
  } else scheduleLoad();
}
