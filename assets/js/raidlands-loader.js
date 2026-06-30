(() => {
  const root = document.documentElement;
  const loader = document.querySelector("[data-raidlands-loader]");
  const dataNode = document.getElementById("raidlands-loader-data");

  if (window.__raidlandsLoaderFallback) {
    window.clearTimeout(window.__raidlandsLoaderFallback);
    window.__raidlandsLoaderFallback = null;
  }

  if (!loader || !dataNode) {
    root.classList.remove("raidlands-loading");
    return;
  }

  const data = readLoaderData(dataNode);
  const consoleEl = loader.querySelector("[data-loader-console]");
  const stateEl = loader.querySelector("[data-loader-state]");
  const progressEl = loader.querySelector("[data-loader-progress]");
  const tipEl = loader.querySelector("[data-loader-tip]");
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const startedAt = performance.now();
  const minVisibleMs = reducedMotion ? 350 : clamp(Number(data.minVisibleMs) || 1850, 800, 6000);
  const fadeMs = reducedMotion ? 80 : clamp(Number(data.fadeMs) || 520, 220, 900);
  const maxVisibleMs = clamp(Number(data.maxVisibleMs) || 11000, 5000, 20000);
  const domReadyPromise = waitForDomReady();
  const pageLoadPromise = waitForPageLoad();
  const statusResultPromise = requestServerStatus();

  let currentProgress = 0;
  let domReady = document.readyState !== "loading";
  let pageLoaded = document.readyState === "complete";
  let linesComplete = false;
  let closed = false;
  let typedLines = 0;
  let expectedLines = 1;
  let tipIndex = 0;

  window.__raidlandsServerStatusPromise = statusResultPromise
    .then(result => result && result.status ? result.status : null)
    .catch(() => null);

  domReadyPromise.then(() => {
    domReady = true;
    setProgress(Math.max(currentProgress, 62));
  });

  pageLoadPromise.then(() => {
    pageLoaded = true;
    setProgress(Math.max(currentProgress, 86));
  });

  const progressTimer = window.setInterval(tickProgress, reducedMotion ? 180 : 80);
  const tipTimer = startTipRotation();
  const hardStopTimer = window.setTimeout(() => {
    updateState("Load guard released");
    exitLoader();
  }, maxVisibleMs);

  runLoader().catch(error => {
    console.warn("Raidlands loader failed open.", error);
    exitLoader();
  });

  function readLoaderData(node) {
    try {
      return JSON.parse(node.textContent || "{}");
    } catch (error) {
      console.warn("Raidlands loader data could not be parsed.", error);
      return {};
    }
  }

  async function runLoader() {
    const steps = Array.isArray(data.lines) ? data.lines : [];
    const totalLines = Math.max(1, steps.reduce((total, step) => total + (step.wait ? 2 : 1), 0));
    expectedLines = totalLines;

    for (const step of steps) {
      if (closed) return;
      await processStep(step, totalLines);
    }

    linesComplete = true;
    await pageLoadPromise;
    await waitForElapsed(minVisibleMs);
    setProgress(100);
    updateState("Entering Raidlands");
    await delay(reducedMotion ? 30 : 260);
    window.clearTimeout(hardStopTimer);
    exitLoader();
  }

  async function processStep(step, totalLines) {
    const normalized = normalizeLine(step);

    await typeLine(normalized);
    markLineComplete(totalLines);

    if (step.wait === "server") {
      updateState("Querying Rust status");
      const result = await statusResultPromise;
      await typeLine(statusLineFromResult(result));
      markLineComplete(totalLines);
      return;
    }

    if (step.wait === "dom") {
      updateState("Parsing route markup");
      await domReadyPromise;
      await typeLine({
        level: "ok",
        text: String(step.successText || "[OK] Route markup parsed")
      });
      markLineComplete(totalLines);
      return;
    }

    if (step.wait === "load") {
      updateState("Mounting visual assets");
      await pageLoadPromise;
      await typeLine({
        level: "ok",
        text: String(step.successText || "[OK] Visual assets mounted")
      });
      markLineComplete(totalLines);
    }
  }

  function normalizeLine(line) {
    return {
      level: String(line.level || "info"),
      text: String(line.text || "")
    };
  }

  function markLineComplete(totalLines) {
    typedLines += 1;
    const target = 8 + (typedLines / totalLines) * 84;
    setProgress(Math.max(currentProgress, Math.min(94, target)));
  }

  async function typeLine(line) {
    if (closed || !consoleEl) return;

    const row = document.createElement("div");
    const prompt = document.createElement("span");
    const text = document.createElement("span");

    row.className = `raidlands-loader-line is-${line.level}`;
    prompt.className = "raidlands-loader-prompt";
    prompt.textContent = ">";
    text.className = "raidlands-loader-text";
    row.append(prompt, text);
    consoleEl.appendChild(row);
    consoleEl.scrollTop = consoleEl.scrollHeight;

    updateState(stripStatusPrefix(line.text));

    if (reducedMotion) {
      text.textContent = line.text;
      await delay(20);
      return;
    }

    for (let index = 0; index < line.text.length; index += 1) {
      if (closed) return;
      text.textContent += line.text[index];
      consoleEl.scrollTop = consoleEl.scrollHeight;
      await delay(characterDelay(line.text[index]));
    }

    await delay(pageLoaded ? 24 : 58);
  }

  function characterDelay(character) {
    if (character === " ") return pageLoaded ? 1 : 2;
    if (character === "." || character === ":" || character === ";") return pageLoaded ? 9 : 18;
    if (character === "[" || character === "]") return pageLoaded ? 5 : 10;

    const base = pageLoaded ? 3 : domReady ? 5 : 7;
    return base + Math.random() * (pageLoaded ? 3 : 5);
  }

  async function requestServerStatus() {
    const url = String(data.serverStatusUrl || "");
    const timeoutMs = clamp(Number(data.statusProbeTimeoutMs) || 2200, 600, 5000);
    const started = performance.now();

    if (!url || !window.fetch) {
      return {
        status: null,
        durationMs: performance.now() - started,
        reason: "Status fetch unavailable"
      };
    }

    const controller = "AbortController" in window ? new AbortController() : null;
    let timeoutId = 0;
    const timeoutPromise = new Promise(resolve => {
      timeoutId = window.setTimeout(() => {
        if (controller) controller.abort();
        resolve({ timedOut: true });
      }, timeoutMs);
    });
    const fetchOptions = {
      cache: "default",
      headers: {
        Accept: "application/json"
      }
    };

    if (controller) {
      fetchOptions.signal = controller.signal;
    }

    const fetchPromise = window.fetch(url, fetchOptions)
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Status API returned ${response.status}`);
        }

        return {
          status: await response.json()
        };
      })
      .catch(error => ({
        error
      }));

    const result = await Promise.race([fetchPromise, timeoutPromise]);
    window.clearTimeout(timeoutId);

    if (result && result.timedOut) {
      return {
        status: null,
        durationMs: performance.now() - started,
        reason: "Live status probe timed out"
      };
    }

    if (result && result.error) {
      return {
        status: null,
        durationMs: performance.now() - started,
        reason: result.error.message || "Live status probe failed"
      };
    }

    return {
      status: result ? result.status : null,
      durationMs: performance.now() - started,
      reason: ""
    };
  }

  function statusLineFromResult(result) {
    const fallback = data.fallbackStatus || {};
    const status = result && result.status ? result.status : fallback;
    const source = status.source === "battlemetrics" ? "BattleMetrics" : status.source === "fallback" ? "site fallback" : "PHP config";
    const players = statValue(status.players, fallback.players, "0");
    const maxPlayers = statValue(status.maxPlayers, fallback.maxPlayers, "0");
    const queue = statValue(status.queue, fallback.queue, "0");
    const duration = result && result.durationMs ? ` in ${Math.round(result.durationMs)}ms` : "";

    if (!result || !result.status) {
      return {
        level: "warn",
        text: `[WARN] Live status delayed; ${source} says ${status.statusLabel || "Unknown"} ${players}/${maxPlayers}, queue ${queue}`
      };
    }

    if (status.online === true) {
      return {
        level: status.stale ? "warn" : "ok",
        text: `[OK] Server online: ${players}/${maxPlayers}, queue ${queue} (${source}${status.cached ? " cache" : ""}${status.stale ? ", stale" : ""}${duration})`
      };
    }

    if (status.online === false) {
      return {
        level: "warn",
        text: `[WARN] Server reports ${status.statusLabel || "offline"} (${source}${duration})`
      };
    }

    return {
      level: "warn",
      text: `[WARN] Server status unknown; ${source}${duration}`
    };
  }

  function statValue(value, fallback, emptyFallback) {
    if (value === null || value === undefined || value === "") {
      return fallback === null || fallback === undefined || fallback === "" ? emptyFallback : String(fallback);
    }

    return String(value);
  }

  function tickProgress() {
    const readinessCap = linesComplete
      ? (pageLoaded ? 100 : 94)
      : (pageLoaded ? 94 : domReady ? 78 : 48);
    const lineCap = 8 + (typedLines / expectedLines) * 84;
    const cap = linesComplete ? readinessCap : Math.min(readinessCap, lineCap + 18);
    const next = currentProgress + Math.max(.12, (cap - currentProgress) * .03);
    setProgress(Math.min(cap, next));
  }

  function setProgress(value) {
    currentProgress = clamp(value, 0, 100);
    loader.style.setProperty("--loader-progress", currentProgress.toFixed(2));

    if (progressEl) {
      progressEl.textContent = String(Math.round(currentProgress)).padStart(2, "0");
    }
  }

  function updateState(message) {
    if (!stateEl || !message) return;

    stateEl.textContent = message;
  }

  function stripStatusPrefix(message) {
    return String(message || "").replace(/^\[[A-Z]+\]\s*/, "");
  }

  function startTipRotation() {
    const tips = Array.isArray(data.tips) ? data.tips.filter(Boolean) : [];

    if (!tipEl || tips.length < 2 || reducedMotion) {
      return 0;
    }

    tipIndex = Math.floor(Math.random() * tips.length);
    tipEl.textContent = tips[tipIndex];

    return window.setInterval(() => {
      tipIndex = (tipIndex + 1) % tips.length;
      tipEl.textContent = tips[tipIndex];
    }, 1700);
  }

  function waitForDomReady() {
    if (document.readyState !== "loading") {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      document.addEventListener("DOMContentLoaded", resolve, { once: true });
    });
  }

  function waitForPageLoad() {
    if (document.readyState === "complete") {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      window.addEventListener("load", resolve, { once: true });
    });
  }

  async function waitForElapsed(ms) {
    const remaining = ms - (performance.now() - startedAt);

    if (remaining > 0) {
      await delay(remaining);
    }
  }

  function exitLoader() {
    if (closed) return;

    closed = true;
    window.clearInterval(progressTimer);

    if (tipTimer) {
      window.clearInterval(tipTimer);
    }

    loader.style.setProperty("--loader-fade-ms", `${fadeMs}ms`);
    loader.classList.add("is-exiting");
    root.classList.add("raidlands-loader-fading");

    window.setTimeout(() => {
      root.classList.remove("raidlands-loading", "raidlands-loader-fading");
      loader.remove();
    }, fadeMs);
  }

  function delay(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
})();
