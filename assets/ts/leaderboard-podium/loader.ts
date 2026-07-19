type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
};

const hosts = [...document.querySelectorAll<HTMLElement>("[data-leaderboard-podium]")];
let loading: Promise<unknown> | undefined;

function setPhase(state: string, message: string) {
  hosts.forEach((host) => {
    if (host.dataset.podiumState === "ready" || host.dataset.podiumState === "fallback") return;
    host.dataset.podiumState = state;
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
