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
  const targetingEl = loader.querySelector("[data-loader-targeting]");
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const startedAt = performance.now();
  const bootSteps = Array.isArray(data.lines) ? data.lines : [];
  const hasLoadGate = bootSteps.some(step => step && step.wait === "load");
  const startupMs = reducedMotion ? 90 : clamp(Number(data.startupMs) || 1500, 700, 2200);
  const startupColdMs = reducedMotion ? 0 : clamp(Number(data.startupColdMs) || 340, 120, Math.max(120, startupMs - 420));
  const startupFlickerMs = Math.max(360, startupMs - startupColdMs);
  const minVisibleMs = reducedMotion ? 120 : clamp(Number(data.minVisibleMs) || startupMs, startupMs, 2200);
  const fastTrackAfterMs = reducedMotion ? 0 : clamp(Number(data.fastTrackAfterMs) || 260, 80, 800);
  const fadeMs = reducedMotion ? 80 : clamp(Number(data.fadeMs) || 360, 160, 640);
  const maxVisibleMs = clamp(Number(data.maxVisibleMs) || 5000, 2200, 10000);
  const domReadyPromise = waitForDomReady();
  const pageLoadPromise = waitForPageLoad();
  const statusResultPromise = requestServerStatus();
  let releaseBootConsole = () => {};
  const bootConsolePromise = new Promise(resolve => {
    releaseBootConsole = resolve;
  });
  let bootProgressLocked = !reducedMotion;
  const startupPromise = playStartupFlicker();

  let currentProgress = 0;
  let domReady = document.readyState !== "loading";
  let pageLoaded = document.readyState === "complete";
  let loadGateComplete = !hasLoadGate && pageLoaded;
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
    if (!hasLoadGate) {
      loadGateComplete = true;
    }
    setProgress(Math.max(currentProgress, 86));
    queueScopeSimulation();
  });

  const progressTimer = window.setInterval(tickProgress, reducedMotion ? 180 : 80);
  const tipTimer = startTipRotation();
  const hardStopTimer = window.setTimeout(() => {
    updateState("Load guard released");
    exitLoader();
  }, maxVisibleMs);
  const earlyScopeTimer = window.setTimeout(() => {
    if (!closed && !scopeCleanup && !reducedMotion && targetingEl) {
      scopeCleanup = startScopeSimulation();
    }
  }, reducedMotion ? 0 : 460);

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
    const steps = bootSteps;
    const totalLines = Math.max(1, steps.reduce((total, step) => total + (step.wait ? 2 : 1), 0));
    expectedLines = totalLines;
    await bootConsolePromise;

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      if (closed) return;

      if (isDecorativeStep(step) && canLeaveBootSequence()) {
        break;
      }

      await processStep(step, totalLines);

      if (canLeaveBootSequence() && remainingStepsAreDecorative(steps, index + 1)) {
        break;
      }
    }

    linesComplete = true;
    await pageLoadPromise;
    await startupPromise;
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
      loadGateComplete = true;
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

  function playStartupFlicker() {
    if (reducedMotion) {
      loader.classList.remove("is-power-cold", "is-powering-on");
      bootProgressLocked = false;
      releaseBootConsole();
      return delay(startupMs);
    }

    loader.classList.add("is-power-cold");
    loader.classList.remove("is-powering-on");
    loader.style.setProperty("--loader-startup-ms", `${startupFlickerMs}ms`);

    return delay(startupColdMs)
      .then(waitForNextPaint)
      .then(() => {
        loader.classList.remove("is-power-cold");
        loader.getBoundingClientRect();
        loader.classList.add("is-powering-on");
        return delay(startupFlickerMs);
      })
      .then(() => {
        loader.classList.remove("is-powering-on");
        bootProgressLocked = false;
        setProgress(0);
        releaseBootConsole();
      });
  }

  function canLeaveBootSequence() {
    return loadGateComplete && pageLoaded;
  }

  function isDecorativeStep(step) {
    return Boolean(step && step.decorative);
  }

  function remainingStepsAreDecorative(steps, startIndex) {
    for (let index = startIndex; index < steps.length; index += 1) {
      if (!isDecorativeStep(steps[index])) {
        return false;
      }
    }

    return true;
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
    currentProgress = bootProgressLocked ? 0 : clamp(value, 0, 100);
    const progressStartAngle = -90;
    const progressSweep = currentProgress * 3.6;
    const progressAngle = progressStartAngle + progressSweep;
    const progressTipAngle = progressAngle - 90;

    loader.style.setProperty("--loader-progress", currentProgress.toFixed(2));
    loader.style.setProperty("--loader-progress-sweep", `${progressSweep.toFixed(2)}deg`);
    loader.style.setProperty("--loader-progress-angle", `${progressAngle.toFixed(2)}deg`);
    loader.style.setProperty("--loader-progress-tip-angle", `${progressTipAngle.toFixed(2)}deg`);
    loader.style.setProperty("--loader-progress-tip-counter-angle", `${(-progressTipAngle).toFixed(2)}deg`);
    loader.style.setProperty("--loader-progress-tip-opacity", currentProgress > 4 ? "1" : "0");

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
    if (reducedMotion || !targetingEl || scopeCleanup) return;

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
    const layer = targetingEl;
    const reticle = document.createElement("div");
    const reticleDot = document.createElement("span");
    const timers = new Set();
    const dynamicNodes = new Set();

    let stopped = false;

    layer.style.setProperty("--reticle-x", window.innerWidth < 700 ? "50%" : "48%");
    layer.style.setProperty("--reticle-y", window.innerWidth < 700 ? "58%" : "44%");
    reticle.className = "raidlands-loader-reticle";
    reticleDot.className = "raidlands-loader-reticle-dot";
    reticle.appendChild(reticleDot);
    layer.append(reticle);
    seedDormantTargets(layer);

    window.requestAnimationFrame(() => {
      if (!stopped) {
        layer.classList.add("is-active");
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
      if (stopped || closed || !layer.isConnected) return;

      const target = randomScopeTarget();
      const marker = createTargetMarker(target);

      dynamicNodes.add(marker);
      layer.appendChild(marker);

      window.requestAnimationFrame(() => {
        if (!stopped) {
          marker.classList.add("is-visible");
          layer.style.setProperty("--reticle-x", `${target.x}%`);
          layer.style.setProperty("--reticle-y", `${target.y}%`);
        }
      });

      setManagedTimeout(() => {
        if (stopped || closed) return;

        marker.classList.add("is-locked");
      }, 180);

      setManagedTimeout(() => {
        if (stopped || closed) return;

        marker.classList.add("is-hit");
        reticle.classList.remove("is-recoiling");
        void reticle.offsetWidth;
        reticle.classList.add("is-recoiling");
        createShot(target, layer, dynamicNodes);
        createImpact(target, layer, dynamicNodes);
      }, 320);

      setManagedTimeout(() => {
        dynamicNodes.delete(marker);
        marker.remove();
      }, 1440);

      setManagedTimeout(fireCycle, randomBetween(980, 1420));
    };

    setManagedTimeout(fireCycle, 90);

    return (remove = false) => {
      stopped = true;
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();

      if (remove) {
        dynamicNodes.forEach(node => node.remove());
        dynamicNodes.clear();
        layer.replaceChildren();
        layer.classList.remove("is-active");
      }
    };
  }

  function seedDormantTargets(layer) {
    const markers = window.innerWidth < 700
      ? [
          { x: 22, y: 68, distance: "87m" },
          { x: 82, y: 54, distance: "104m" }
        ]
      : [
          { x: 86, y: 18, distance: "104m" },
          { x: 86, y: 75, distance: "87m" },
          { x: 48, y: 52, distance: "121m" }
        ];

    markers.forEach(marker => {
      layer.appendChild(createTargetMarker(marker, true));
    });
  }

  function createTargetMarker(target, dormant = false) {
    const marker = document.createElement("span");
    const core = document.createElement("span");
    const frame = document.createElement("span");
    const label = document.createElement("span");

    marker.className = `raidlands-loader-target${dormant ? " is-dormant is-visible" : ""}`;
    marker.style.setProperty("--target-x", `${target.x}%`);
    marker.style.setProperty("--target-y", `${target.y}%`);
    marker.style.setProperty("--target-color", dormant ? "#7f9330" : "#ff8a28");
    core.className = "raidlands-loader-target-core";
    frame.className = "raidlands-loader-target-frame";
    label.className = "raidlands-loader-target-label";
    label.textContent = target.distance || `${Math.round(randomBetween(83, 128))}m`;
    marker.append(core, frame, label);

    return marker;
  }

  function createShot(target, layer, dynamicNodes) {
    const rect = layer.getBoundingClientRect();
    const targetX = rect.width * target.x / 100;
    const targetY = rect.height * target.y / 100;
    const sourceX = clamp(
      targetX + (target.x > 54 ? -randomBetween(rect.width * .18, rect.width * .34) : randomBetween(rect.width * .18, rect.width * .32)),
      18,
      rect.width - 18
    );
    const sourceY = clamp(targetY + randomBetween(rect.height * .14, rect.height * .30), 18, rect.height - 18);
    const deltaX = targetX - sourceX;
    const deltaY = targetY - sourceY;
    const shot = document.createElement("span");

    shot.className = "raidlands-loader-shot";
    shot.style.setProperty("--shot-x", `${sourceX.toFixed(1)}px`);
    shot.style.setProperty("--shot-y", `${sourceY.toFixed(1)}px`);
    shot.style.setProperty("--shot-length", `${Math.hypot(deltaX, deltaY).toFixed(1)}px`);
    shot.style.setProperty("--shot-angle", `${(Math.atan2(deltaY, deltaX) * 180 / Math.PI).toFixed(2)}deg`);
    dynamicNodes.add(shot);
    layer.appendChild(shot);

    window.setTimeout(() => {
      dynamicNodes.delete(shot);
      shot.remove();
    }, 460);
  }

  function createImpact(target, layer, dynamicNodes) {
    const impact = document.createElement("span");

    impact.className = "raidlands-loader-impact";
    impact.style.setProperty("--impact-x", `${target.x}%`);
    impact.style.setProperty("--impact-y", `${target.y}%`);
    dynamicNodes.add(impact);
    layer.appendChild(impact);

    window.setTimeout(() => {
      dynamicNodes.delete(impact);
      impact.remove();
    }, 760);
  }

  function randomScopeTarget() {
    if (window.innerWidth < 700) {
      const mobileLeft = Math.random() > .5;

      return {
        x: Math.round(mobileLeft ? randomBetween(22, 38) : randomBetween(64, 82)),
        y: Math.round(randomBetween(46, 72)),
        distance: `${Math.round(randomBetween(74, 118))}m`
      };
    }

    const zone = Math.random();
    const x = zone < .56
      ? randomBetween(46, 52)
      : zone < .86
        ? randomBetween(82, 90)
        : randomBetween(80, 88);
    const y = zone < .86
      ? randomBetween(28, 58)
      : randomBetween(60, 76);

    return {
      x: Math.round(x),
      y: Math.round(y),
      distance: `${Math.round(randomBetween(83, 128))}m`
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

  function waitForNextPaint() {
    return new Promise(resolve => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(resolve);
      });
    });
  }

  function exitLoader() {
    if (closed || exitStarted) return;

    exitStarted = true;
    closed = true;
    markLoaderSeen();
    window.clearInterval(progressTimer);
    window.clearTimeout(earlyScopeTimer);

    if (tipTimer) {
      window.clearInterval(tipTimer);
    }

    if (scopeCleanup) {
      scopeCleanup();
      scopeCleanup = null;
    }

    const exitFadeMs = reducedMotion ? Math.max(fadeMs, 320) : Math.max(fadeMs, 420);
    const breachLeadMs = reducedMotion ? 260 : 1220;
    const siteRevealDelayMs = reducedMotion ? 240 : 1320;

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
    if (loader.classList.contains("is-exploding")) return;

    const breachOrigin = getBreachOrigin();
    const originX = breachOrigin.x;
    const originY = breachOrigin.y;

    loader.style.setProperty("--breach-x", `${originX}%`);
    loader.style.setProperty("--breach-y", `${originY}%`);
    loader.style.setProperty("--explosion-origin-x", `${originX}%`);
    loader.style.setProperty("--explosion-origin-y", `${originY}%`);

    if (!reducedMotion) {
      prepareLoaderElementBlast(originX, originY);
    }

    loader.classList.add("is-breaching", "is-exploding");
  }

  function prepareLoaderElementBlast(originXPercent, originYPercent) {
    const loaderRect = loader.getBoundingClientRect();
    const originX = loaderRect.left + loaderRect.width * originXPercent / 100;
    const originY = loaderRect.top + loaderRect.height * originYPercent / 100;
    const diagonal = Math.hypot(loaderRect.width, loaderRect.height) || 1;
    const progressShell = progressEl ? progressEl.closest(".raidlands-loader-progress") : null;
    const tipShell = tipEl ? tipEl.closest(".raidlands-loader-tip") : null;
    const consoleShell = consoleEl ? consoleEl.closest(".raidlands-loader-console") : null;
    const pieces = [
      ...loader.querySelectorAll(".raidlands-loader-line"),
      consoleShell,
      loader.querySelector(".raidlands-loader-logo"),
      progressShell,
      stateEl,
      tipShell,
      loader.querySelector(".raidlands-loader-targeting"),
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

  function getBreachOrigin() {
    return {
      x: 50,
      y: window.innerWidth < 700 ? 78 : 76
    };
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
