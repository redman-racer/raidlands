(() => {
  const root = document.documentElement;
  const loader = document.querySelector("[data-raidlands-loader]");
  const dataNode = document.getElementById("raidlands-loader-data");
  const loaderSession = getLoaderSession();

  if (window.__raidlandsLoaderFallback) {
    window.clearTimeout(window.__raidlandsLoaderFallback);
    window.__raidlandsLoaderFallback = null;
  }

  if (!loaderSession.shouldShow) {
    root.classList.remove("raidlands-loading", "raidlands-loader-fading");
    if (loader) {
      loader.remove();
    }
    return;
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
  const coreEl = loader.querySelector(".raidlands-loader-core");
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const startedAt = performance.now();
  const minVisibleMs = reducedMotion ? 220 : clamp(Number(data.minVisibleMs) || 520, 260, 2600);
  const fastTrackAfterMs = reducedMotion ? 0 : clamp(Number(data.fastTrackAfterMs) || 360, 160, 1200);
  const fadeMs = reducedMotion ? 80 : clamp(Number(data.fadeMs) || 360, 160, 640);
  const maxVisibleMs = clamp(Number(data.maxVisibleMs) || 5000, 2200, 10000);
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
  let scopeCleanup = null;
  let exitStarted = false;
  let siteRevealDispatched = false;

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
    queueScopeSimulation();
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

  function getLoaderSession() {
    const session = window.__raidlandsLoaderSession || {};

    return {
      storageKey: String(session.storageKey || "raidlands-loader-seen"),
      navigationType: String(session.navigationType || "navigate"),
      shouldShow: session.shouldShow !== false
    };
  }

  function markLoaderSeen() {
    try {
      window.sessionStorage.setItem(loaderSession.storageKey, "true");
    } catch (error) {
      // Browsers can disable sessionStorage; the loader simply falls back to showing.
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
    await delay(reducedMotion ? 16 : 35);
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

    if (reducedMotion || shouldFastTrack()) {
      text.textContent = line.text;
      await delay(reducedMotion ? 12 : 10);
      return;
    }

    for (let index = 0; index < line.text.length; index += 1) {
      if (closed) return;
      text.textContent += line.text[index];
      consoleEl.scrollTop = consoleEl.scrollHeight;
      await delay(characterDelay(line.text[index]));
    }

    await delay(shouldFastTrack() ? 4 : pageLoaded ? 10 : 24);
  }

  function characterDelay(character) {
    if (shouldFastTrack()) {
      if (character === " ") return 0;
      if (character === "." || character === ":" || character === ";") return 1.5;
      if (character === "[" || character === "]") return 1;

      return .8 + Math.random() * 1.4;
    }

    if (character === " ") return 0;
    if (character === "." || character === ":" || character === ";") return 4;
    if (character === "[" || character === "]") return 2.5;

    const base = pageLoaded ? 1.4 : domReady ? 2.2 : 3.2;
    return base + Math.random() * (pageLoaded ? 1.8 : 2.8);
  }

  function shouldFastTrack() {
    return pageLoaded || performance.now() - startedAt >= fastTrackAfterMs;
  }

  async function requestServerStatus() {
    const url = String(data.serverStatusUrl || "");
    const timeoutMs = clamp(Number(data.statusProbeTimeoutMs) || 750, 350, 2200);
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

  function queueScopeSimulation() {
    if (reducedMotion || !coreEl || scopeCleanup) return;

    const start = () => {
      if (closed || scopeCleanup) return;

      scopeCleanup = startScopeSimulation();
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(start, { timeout: 900 });
      return;
    }

    window.setTimeout(start, 380);
  }

  function startScopeSimulation() {
    const scope = document.createElement("div");
    const reticle = document.createElement("div");
    const reticleDot = document.createElement("span");
    const timers = new Set();

    let stopped = false;

    scope.className = "raidlands-loader-scope";
    scope.setAttribute("aria-hidden", "true");
    scope.style.setProperty("--scope-x", "52%");
    scope.style.setProperty("--scope-y", "46%");
    reticle.className = "raidlands-loader-reticle";
    reticleDot.className = "raidlands-loader-reticle-dot";
    reticle.appendChild(reticleDot);
    scope.appendChild(reticle);
    coreEl.prepend(scope);

    window.requestAnimationFrame(() => {
      if (!stopped) {
        scope.classList.add("is-active");
      }
    });

    const setManagedTimeout = (callback, ms) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        callback();
      }, ms);

      timers.add(timer);
      return timer;
    };

    const fireCycle = () => {
      if (stopped || closed || !scope.isConnected) return;

      const target = randomScopeTarget();
      const shadow = document.createElement("span");

      shadow.className = "raidlands-loader-shadow";
      shadow.style.setProperty("--target-x", `${target.x}%`);
      shadow.style.setProperty("--target-y", `${target.y}%`);
      scope.appendChild(shadow);

      window.requestAnimationFrame(() => {
        if (!stopped) {
          shadow.classList.add("is-visible");
          scope.style.setProperty("--scope-x", `${target.x}%`);
          scope.style.setProperty("--scope-y", `${target.y}%`);
        }
      });

      setManagedTimeout(() => {
        if (stopped || closed) return;

        shadow.classList.add("is-hit");
        reticle.classList.remove("is-recoiling");
        void reticle.offsetWidth;
        reticle.classList.add("is-recoiling");
      }, 520);

      setManagedTimeout(() => {
        shadow.remove();
      }, 1280);

      setManagedTimeout(fireCycle, randomBetween(1080, 1540));
    };

    setManagedTimeout(fireCycle, 220);

    return (remove = false) => {
      stopped = true;
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();

      if (remove) {
        scope.remove();
      }
    };
  }

  function randomScopeTarget() {
    const leftSide = Math.random() > .5;
    const x = leftSide ? randomBetween(24, 38) : randomBetween(62, 76);

    return {
      x: Math.round(x),
      y: Math.round(randomBetween(34, 66))
    };
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
    if (closed || exitStarted) return;

    exitStarted = true;
    closed = true;
    markLoaderSeen();
    window.clearInterval(progressTimer);

    if (tipTimer) {
      window.clearInterval(tipTimer);
    }

    if (scopeCleanup) {
      scopeCleanup();
      scopeCleanup = null;
    }

    const exitFadeMs = reducedMotion ? fadeMs : Math.max(fadeMs, 900);
    const breachLeadMs = reducedMotion ? 0 : 220;
    const siteRevealDelayMs = reducedMotion ? 0 : breachLeadMs + Math.round(exitFadeMs * .32);

    setProgress(100);
    updateState("Raidlands breach confirmed");
    loader.style.setProperty("--loader-fade-ms", `${exitFadeMs}ms`);
    playExitBreach();

    window.setTimeout(startLoaderFade, breachLeadMs);
    window.setTimeout(dispatchSiteReveal, siteRevealDelayMs);

    window.setTimeout(() => {
      dispatchSiteReveal();
      root.classList.remove("raidlands-loading", "raidlands-loader-fading");
      loader.remove();
    }, breachLeadMs + exitFadeMs + 80);
  }

  function startLoaderFade() {
    loader.getBoundingClientRect();

    window.requestAnimationFrame(() => {
      root.classList.add("raidlands-loader-fading");
      loader.classList.add("is-exiting");
    });
  }

  function dispatchSiteReveal() {
    if (siteRevealDispatched) return;

    siteRevealDispatched = true;
    window.dispatchEvent(new CustomEvent("raidlands:site-reveal"));
  }

  function playExitBreach() {
    if (reducedMotion || loader.querySelector(".raidlands-loader-breach")) return;

    const breach = document.createElement("div");
    const flash = document.createElement("div");
    const fireball = document.createElement("div");
    const engulf = document.createElement("div");
    const title = document.createElement("div");
    const fragments = document.createDocumentFragment();
    const particleTotal = window.innerWidth < 700 ? 58 : 106;
    const smokeTotal = window.innerWidth < 700 ? 13 : 22;
    const debrisTotal = window.innerWidth < 700 ? 18 : 34;
    const originX = 50;
    const originY = window.innerWidth < 700 ? 70 : 73;

    breach.className = "raidlands-loader-breach";
    breach.setAttribute("aria-hidden", "true");
    breach.style.setProperty("--breach-x", `${originX}%`);
    breach.style.setProperty("--breach-y", `${originY}%`);
    loader.style.setProperty("--breach-x", `${originX}%`);
    loader.style.setProperty("--breach-y", `${originY}%`);
    prepareLoaderElementBlast(originX, originY);
    flash.className = "raidlands-loader-breach-flash";
    fireball.className = "raidlands-loader-breach-core";
    engulf.className = "raidlands-loader-breach-engulf";
    title.className = "raidlands-loader-breach-title";
    title.innerHTML = "<span>Raidlands</span><strong>BREACH LIVE</strong><em>1000x raid route open</em>";

    for (let index = 0; index < 4; index += 1) {
      const wave = document.createElement("span");
      wave.className = "raidlands-loader-breach-wave";
      wave.style.setProperty("--delay", `${(index * 92).toFixed(0)}ms`);
      wave.style.setProperty("--wave-scale", (1.35 + index * .34).toFixed(2));
      fragments.appendChild(wave);
    }

    for (let index = 0; index < particleTotal; index += 1) {
      const spark = document.createElement("span");
      const angle = randomBetween(0, Math.PI * 2);
      const distance = randomBetween(120, window.innerWidth < 700 ? 420 : 760);
      const size = randomBetween(2, 7);
      const vertical = Math.sin(angle) * distance * .62 - Math.max(0, Math.cos(angle)) * randomBetween(12, 72);

      spark.className = "raidlands-loader-breach-spark";
      spark.style.setProperty("--tx", `${Math.cos(angle) * distance}px`);
      spark.style.setProperty("--ty", `${vertical}px`);
      spark.style.setProperty("--size", `${size}px`);
      spark.style.setProperty("--spin", `${randomBetween(-220, 220).toFixed(0)}deg`);
      spark.style.setProperty("--delay", `${randomBetween(0, 90).toFixed(0)}ms`);
      spark.style.setProperty("--duration", `${randomBetween(650, 1050).toFixed(0)}ms`);
      fragments.appendChild(spark);
    }

    for (let index = 0; index < smokeTotal; index += 1) {
      const smoke = document.createElement("span");
      const angle = randomBetween(0, Math.PI * 2);
      const distance = randomBetween(80, window.innerWidth < 700 ? 240 : 420);

      smoke.className = "raidlands-loader-breach-smoke";
      smoke.style.setProperty("--tx", `${Math.cos(angle) * distance}px`);
      smoke.style.setProperty("--ty", `${Math.sin(angle) * distance * .46 - randomBetween(62, 170)}px`);
      smoke.style.setProperty("--scale", randomBetween(1.2, 2.9).toFixed(2));
      smoke.style.setProperty("--delay", `${randomBetween(45, 190).toFixed(0)}ms`);
      smoke.style.setProperty("--duration", `${randomBetween(850, 1280).toFixed(0)}ms`);
      fragments.appendChild(smoke);
    }

    for (let index = 0; index < debrisTotal; index += 1) {
      const debris = document.createElement("span");
      const angle = randomBetween(0, Math.PI * 2);
      const distance = randomBetween(100, window.innerWidth < 700 ? 360 : 650);
      const debrisLift = randomBetween(22, 145);

      debris.className = "raidlands-loader-breach-debris";
      debris.style.setProperty("--tx", `${Math.cos(angle) * distance}px`);
      debris.style.setProperty("--ty", `${Math.sin(angle) * distance * .54 - debrisLift}px`);
      debris.style.setProperty("--w", `${randomBetween(5, 20)}px`);
      debris.style.setProperty("--h", `${randomBetween(2, 6)}px`);
      debris.style.setProperty("--spin", `${randomBetween(-540, 540).toFixed(0)}deg`);
      debris.style.setProperty("--delay", `${randomBetween(0, 110).toFixed(0)}ms`);
      debris.style.setProperty("--duration", `${randomBetween(680, 1120).toFixed(0)}ms`);
      fragments.appendChild(debris);
    }

    breach.append(flash, fireball, engulf, title, fragments);
    loader.appendChild(breach);
    loader.classList.add("is-breaching");
  }

  function prepareLoaderElementBlast(originXPercent, originYPercent) {
    const loaderRect = loader.getBoundingClientRect();
    const originX = loaderRect.left + loaderRect.width * originXPercent / 100;
    const originY = loaderRect.top + loaderRect.height * originYPercent / 100;
    const diagonal = Math.hypot(loaderRect.width, loaderRect.height) || 1;
    const progressShell = progressEl ? progressEl.closest(".raidlands-loader-progress") : null;
    const tipShell = tipEl ? tipEl.closest(".raidlands-loader-tip") : null;
    const pieces = [
      ...loader.querySelectorAll(".raidlands-loader-line"),
      loader.querySelector(".raidlands-loader-logo"),
      progressShell,
      stateEl,
      tipShell,
      loader.querySelector(".raidlands-loader-scope")
    ].filter(Boolean);

    pieces.forEach((piece, index) => {
      const rect = piece.getBoundingClientRect();

      if (!rect.width || !rect.height) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const offsetX = centerX - originX;
      const offsetY = centerY - originY;
      const distanceFromOrigin = Math.hypot(offsetX, offsetY) || 1;
      const normalX = offsetX / distanceFromOrigin;
      const normalY = offsetY / distanceFromOrigin;
      const isConsoleLine = piece.classList.contains("raidlands-loader-line");
      const isScope = piece.classList.contains("raidlands-loader-scope");
      const nearCenterBias = Math.abs(offsetX) < 42
        ? (index % 2 === 0 ? -1 : 1) * randomBetween(isConsoleLine ? 8 : 34, isConsoleLine ? 24 : 118)
        : 0;
      const travel = clamp(distanceFromOrigin * (isConsoleLine ? .44 : .36) + randomBetween(isConsoleLine ? 96 : 150, isConsoleLine ? 210 : 290), isConsoleLine ? 138 : 170, isScope ? 520 : 620);
      const lift = randomBetween(isConsoleLine ? 38 : 68, isConsoleLine ? 118 : 170);
      const translateX = normalX * travel + nearCenterBias;
      const translateY = normalY * travel - lift;
      const distanceDelay = clamp(distanceFromOrigin / diagonal, 0, 1) * 80;
      const heightDelay = clamp((originY - centerY) / Math.max(loaderRect.height, 1), 0, 1) * 110;
      const delay = clamp(distanceDelay + heightDelay + randomBetween(0, isConsoleLine ? 42 : 64), 0, 210);
      const duration = randomBetween(isConsoleLine ? 860 : 900, isConsoleLine ? 1160 : 1240);
      const rotate = clamp(normalX * randomBetween(7, 18) + randomBetween(-8, 8), -22, 22);
      const scale = randomBetween(isConsoleLine ? .48 : .36, isConsoleLine ? .7 : .62);

      piece.dataset.loaderBlastPiece = "";
      piece.style.setProperty("--blast-x", `${translateX.toFixed(1)}px`);
      piece.style.setProperty("--blast-y", `${translateY.toFixed(1)}px`);
      piece.style.setProperty("--blast-x-early", `${(translateX * .16).toFixed(1)}px`);
      piece.style.setProperty("--blast-y-early", `${(translateY * .16).toFixed(1)}px`);
      piece.style.setProperty("--blast-x-mid", `${(translateX * .54).toFixed(1)}px`);
      piece.style.setProperty("--blast-y-mid", `${(translateY * .54).toFixed(1)}px`);
      piece.style.setProperty("--blast-rotate", `${rotate.toFixed(1)}deg`);
      piece.style.setProperty("--blast-rotate-early", `${(rotate * .24).toFixed(1)}deg`);
      piece.style.setProperty("--blast-rotate-mid", `${(rotate * .62).toFixed(1)}deg`);
      piece.style.setProperty("--blast-scale", scale.toFixed(2));
      piece.style.setProperty("--blast-delay", `${delay.toFixed(0)}ms`);
      piece.style.setProperty("--blast-duration", `${duration.toFixed(0)}ms`);

      if (isScope) {
        piece.style.setProperty("--blast-scope-x", `${translateX.toFixed(1)}px`);
        piece.style.setProperty("--blast-scope-y", `${translateY.toFixed(1)}px`);
      }
    });
  }

  function delay(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
})();
