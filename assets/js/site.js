(() => {
  const doc = document.documentElement;
  const app = document.getElementById("raidlands-app");

  if (!app) return;

  const pageId = doc.dataset.page || "home";
  const CONFIG = getSiteConfig();
  const MOBILE_PERFORMANCE_QUERY = "(max-width: 700px), (pointer: coarse)";
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  const RP_GAME_MOTION = {
    coinflip: { minMs: 2200, settleMs: 520, resultLockMs: 1100 },
    dice: { minMs: 2500, settleMs: 620, resultLockMs: 1100 },
    jackpot: { minMs: 1800, settleMs: 520, resultLockMs: 1000 },
    "raid-duel": { minMs: 1100, settleMs: 260, resultLockMs: 900 },
    "supply-run": { minMs: 1100, settleMs: 260, resultLockMs: 900 },
    "high-low": { minMs: 2200, settleMs: 560, resultLockMs: 1100 },
    wheel: { minMs: 3200, settleMs: 1600, resultLockMs: 1200 }
    ,blackjack: { minMs: 500, settleMs: 250, resultLockMs: 700 }
    ,roulette: { minMs: 2400, settleMs: 900, resultLockMs: 1100 }
    ,slots: { minMs: 1900, settleMs: 500, resultLockMs: 1000 }
  };
  const RP_WHEEL_RESULT_ROTATIONS = {
    green: 351,
    orange: 306,
    steel: 207,
    ash: 72
  };
  let serverHistoryPayload = null;
  let serverHistoryRange = "6h";
  let serverHistoryResizeTimer = null;
  let animationDiagnosticFlushTimer = null;
  let animationDiagnosticInFlight = false;
  let resolvedWipeTimeZone = null;
  let latestWipeSignal = normalizeWipeSignal(CONFIG.wipe && CONFIG.wipe.signal);
  const timeZonePartFormatters = new Map();

  function getSiteConfig() {
    const basePath = doc.dataset.base || "./";
    const defaults = {
      connectCommand: "connect raidlands.net:25607",
      steamConnectUrl: "steam://run/252490//+connect%20raidlands.net:25607/",
      discordInviteUrl: "https://discord.gg/raidlands",
      serverStatusUrl: `${basePath}api/server-status.php`,
      serverStatusHistoryUrl: `${basePath}api/server-status-history.php`,
      serverStats: {
        provider: "raidlands",
        exchangeSeconds: 30,
        cacheSeconds: 30,
        staleSeconds: 120
      },
      wipe: {
        days: [4],
        dayNames: ["Thursday"],
        time: "19:00",
        timezone: "Europe/London"
      },
      auth: {
        steamUrl: "",
        discordUrl: ""
      },
      animationDiagnostics: {
        enabled: false,
        endpointUrl: `${basePath}api/animation-diagnostics.php`,
        csrfToken: "",
        maxEvents: 24
      }
    };
    const configNode = document.getElementById("site-config");

    if (!configNode) {
      return defaults;
    }

    try {
      const parsed = JSON.parse(configNode.textContent || "{}");

      return {
        ...defaults,
        ...parsed,
        wipe: {
          ...defaults.wipe,
          ...(parsed.wipe || {})
        },
        auth: {
          ...defaults.auth,
          ...(parsed.auth || {})
        },
        animationDiagnostics: {
          ...defaults.animationDiagnostics,
          ...(parsed.animationDiagnostics || {})
        },
        serverStats: {
          ...defaults.serverStats,
          ...(parsed.serverStats || {})
        }
      };
    } catch (error) {
      console.warn("Raidlands config could not be parsed.", error);
      return defaults;
    }
  }

  function init() {
    initAnimationDiagnostics();
    bindNav();
    bindActions();
    initRpGames();
    initClanManagement();
    initLeaderboards();
    init3dRouteWarmup();
    initStoreCatalog();
    initEffectsWhenLoaderReveals();
    bindServerHistoryControls();
    hydrateDates();
    hydrateServerStatus();
    hydrateServerHistory();
    updateCountdowns();
    window.setInterval(updateCountdowns, 1000);

    if (window.fetch && CONFIG.serverStatusUrl) {
      const refreshSeconds = Math.max(30, Number(CONFIG.serverStats.cacheSeconds) || 60);
      window.setInterval(hydrateServerStatus, refreshSeconds * 1000);
    }

    if (window.fetch && CONFIG.serverStatusHistoryUrl && app.querySelector("[data-server-history]")) {
      const refreshSeconds = Math.max(30, Number(CONFIG.serverStats.cacheSeconds) || 60);
      window.setInterval(hydrateServerHistory, refreshSeconds * 1000);
      window.addEventListener("resize", () => {
        window.clearTimeout(serverHistoryResizeTimer);
        serverHistoryResizeTimer = window.setTimeout(() => drawServerHistoryChart(serverHistoryPayload), 120);
      });
    }
  }

  function init3dRouteWarmup() {
    const connection = navigator.connection || {};
    const slowConnection = /^(?:slow-2g|2g|3g)$/i.test(String(connection.effectiveType || ""));

    if (connection.saveData || slowConnection) return;

    const buildBase = new URL(`${doc.dataset.base || "./"}assets/build/airstrike-animation-editor/`, document.baseURI);
    const routes = {
      leaderboard: new URL("leaderboard-podium.js", buildBase).href,
      server: new URL("server-map-viewer.js", buildBase).href
    };
    const warmed = new Set();

    const warmLink = target => {
      const anchor = target instanceof Element ? target.closest("a[href]") : null;

      if (!anchor) return;

      let destination;

      try {
        const path = new URL(anchor.href, document.baseURI).pathname.replace(/\/+$/, "");
        destination = path.endsWith("/leaderboard") ? "leaderboard" : path.endsWith("/server") ? "server" : "";
      } catch (error) {
        return;
      }

      if (!destination || warmed.has(destination) || pageId === destination) return;

      warmed.add(destination);
      const preload = document.createElement("link");
      preload.rel = "modulepreload";
      preload.href = routes[destination];
      preload.crossOrigin = "anonymous";
      document.head.appendChild(preload);
    };

    document.addEventListener("pointerover", event => warmLink(event.target), { passive: true });
    document.addEventListener("focusin", event => warmLink(event.target));
  }

  function initEffectsWhenLoaderReveals() {
    let started = false;
    const start = reason => {
      if (started) return;

      started = true;
      recordAnimationDiagnostic("effects_start", {
        reason,
        rootClassName: doc.className,
        documentReadyState: document.readyState
      });
      initEffects();
    };

    recordAnimationDiagnostic("effects_gate", {
      rootLoading: doc.classList.contains("raidlands-loading"),
      loaderSkipped: doc.classList.contains("raidlands-loader-skipped"),
      loaderSession: window.__raidlandsLoaderSession || {}
    });

    if (!doc.classList.contains("raidlands-loading")) {
      start("immediate");
      return;
    }

    window.addEventListener("raidlands:site-reveal", () => start("site-reveal"), { once: true });
    window.setTimeout(() => start("loader-timeout"), 9000);
  }

  function initStoreCatalog() {
    const catalog = app.querySelector("[data-store-catalog]");

    if (!catalog) return;

    const grids = Array.from(catalog.querySelectorAll("[data-store-catalog-grid]"));
    const sections = Array.from(catalog.querySelectorAll("[data-store-category]"));
    const searchInput = catalog.querySelector("[data-store-search]");
    const typeFilter = catalog.querySelector("[data-store-type-filter]");
    const offerFilter = catalog.querySelector("[data-store-offer-filter]");
    const sortSelect = catalog.querySelector("[data-store-sort]");
    const resetButton = catalog.querySelector("[data-store-reset]");
    const countNode = catalog.querySelector("[data-store-catalog-count]");
    const emptyNode = catalog.querySelector("[data-store-catalog-empty]");
    const cards = Array.from(catalog.querySelectorAll("[data-store-product]"));

    if (!grids.length || !cards.length) return;

    const readNumber = (card, key, fallback = 0) => {
      const value = Number(card.dataset[key] || fallback);

      return Number.isFinite(value) ? value : fallback;
    };
    const sortCards = () => {
      const mode = sortSelect ? sortSelect.value : "featured";
      grids.forEach(grid => {
        const sorted = Array.from(grid.querySelectorAll("[data-store-product]")).sort((left, right) => {
        if (mode === "name") {
          return String(left.dataset.storeName || "").localeCompare(String(right.dataset.storeName || ""));
        }

        if (mode === "offers") {
          return readNumber(right, "storeOffers") - readNumber(left, "storeOffers")
            || String(left.dataset.storeName || "").localeCompare(String(right.dataset.storeName || ""));
        }

        if (mode === "kits") {
          return readNumber(right, "storeKits") - readNumber(left, "storeKits")
            || String(left.dataset.storeName || "").localeCompare(String(right.dataset.storeName || ""));
        }

        return readNumber(left, "storeSort", 100) - readNumber(right, "storeSort", 100)
          || String(left.dataset.storeName || "").localeCompare(String(right.dataset.storeName || ""));
        });

        sorted.forEach(card => grid.appendChild(card));
      });
    };
    const applyFilters = () => {
      const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
      const type = typeFilter ? typeFilter.value : "all";
      const offer = offerFilter ? offerFilter.value : "all";
      let shown = 0;

      sortCards();

      cards.forEach(card => {
        const matchesSearch = query === "" || String(card.dataset.storeSearch || "").includes(query);
        const matchesType = type === "all" || card.dataset.storeType === type;
        const matchesOffer = offer === "all"
          || (offer === "available" && readNumber(card, "storeOffers") > 0)
          || (offer === "rp" && card.dataset.storeRp === "1")
          || (offer === "cash" && card.dataset.storeCash === "1");
        const visible = matchesSearch && matchesType && matchesOffer;

        card.hidden = !visible;
        if (visible) {
          shown += 1;
        }
      });

      if (countNode) {
        countNode.textContent = String(shown);
      }

      if (emptyNode) {
        emptyNode.hidden = shown !== 0;
      }

      sections.forEach(section => {
        const visibleCards = section.querySelectorAll("[data-store-product]:not([hidden])").length;
        section.hidden = visibleCards === 0;
      });
    };

    [searchInput, typeFilter, offerFilter, sortSelect].forEach(control => {
      if (!control) return;

      control.addEventListener(control === searchInput ? "input" : "change", applyFilters);
    });

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        if (typeFilter) typeFilter.value = "all";
        if (offerFilter) offerFilter.value = "all";
        if (sortSelect) sortSelect.value = "featured";
        applyFilters();
        if (searchInput) searchInput.focus();
      });
    }

    applyFilters();
  }

  function initEffects() {
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobilePerformance = isMobilePerformanceMode();

    doc.classList.toggle("mobile-performance-mode", mobilePerformance);
    recordAnimationDiagnostic("effects_configured", {
      reducedMotion,
      mobilePerformance,
      matchMedia: Boolean(window.matchMedia),
      intersectionObserver: "IntersectionObserver" in window,
      requestIdleCallback: "requestIdleCallback" in window
    });
    initCardGlareTiming(reducedMotion, mobilePerformance);
    initScrollReveals(reducedMotion, mobilePerformance);

    if (!reducedMotion) {
      queueEmberField();
    }
  }

  function initCardGlareTiming(reducedMotion, mobilePerformance) {
    if (reducedMotion) return;

    app.querySelectorAll(".metal-card, .metal-panel, .route-card").forEach(panel => {
      const duration = mobilePerformance ? randomBetween(24, 38) : randomBetween(10.5, 18.5);
      panel.style.setProperty("--surface-glare-duration", `${duration.toFixed(2)}s`);
      panel.style.setProperty("--surface-glare-delay", `${randomBetween(-duration, 0).toFixed(2)}s`);
      panel.style.setProperty("--surface-glare-opacity", randomBetween(mobilePerformance ? .14 : .24, mobilePerformance ? .24 : .44).toFixed(2));
    });
  }

  function queueEmberField() {
    const start = () => createEmberField();
    recordAnimationDiagnostic("ember_field_queued", {
      requestIdleCallback: "requestIdleCallback" in window
    });

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(start, { timeout: 1200 });
      return;
    }

    window.setTimeout(start, 600);
  }

  function createEmberField() {
    const shell = app.querySelector(".app-shell") || (app.classList.contains("app-shell") ? app : null);
    if (!shell || shell.querySelector(".ambient-effects")) {
      recordAnimationDiagnostic("ember_field_skipped", {
        hasShell: Boolean(shell),
        alreadyExists: Boolean(shell && shell.querySelector(".ambient-effects"))
      });
      return;
    }

    const field = document.createElement("div");
    const mobilePerformance = isMobilePerformanceMode();
    const isMobile = mobilePerformance || window.innerWidth < 640;
    const particleCount = mobilePerformance ? 6 : isMobile ? 20 : 40;
    const particles = document.createDocumentFragment();

    field.className = `ambient-effects${mobilePerformance ? " is-lite" : ""}`;
    field.setAttribute("aria-hidden", "true");

    for (let index = 0; index < particleCount; index += 1) {
      const particle = document.createElement("span");
      const isAsh = index % 7 === 0;
      const size = mobilePerformance
        ? randomBetween(isAsh ? 1.4 : 1.8, isAsh ? 2.4 : 3.6)
        : isAsh ? randomBetween(1.5, 3.5) : randomBetween(2, 6);
      const duration = mobilePerformance
        ? randomBetween(isAsh ? 34 : 28, isAsh ? 52 : 44)
        : isAsh ? randomBetween(22, 36) : randomBetween(16, 30);

      particle.className = `ember-particle ${isAsh ? "is-ash" : "is-spark"}`;
      particle.style.setProperty("--x", `${randomBetween(isMobile ? 8 : -4, isMobile ? 92 : 104).toFixed(2)}%`);
      particle.style.setProperty("--drift", `${randomBetween(mobilePerformance ? -18 : isMobile ? -28 : -96, mobilePerformance ? 18 : isMobile ? 28 : 96).toFixed(2)}px`);
      particle.style.setProperty("--size", `${size.toFixed(2)}px`);
      particle.style.setProperty("--duration", `${duration.toFixed(2)}s`);
      particle.style.setProperty("--delay", `${randomBetween(-duration, 0).toFixed(2)}s`);
      particle.style.setProperty("--opacity", randomBetween(mobilePerformance ? .14 : .18, mobilePerformance ? .34 : .56).toFixed(2));
      particle.style.setProperty("--blur", `${randomBetween(0, mobilePerformance ? .35 : 1.4).toFixed(2)}px`);
      particle.style.setProperty("--pulse", `${randomBetween(mobilePerformance ? 4.8 : 2.2, mobilePerformance ? 8.2 : 5.4).toFixed(2)}s`);
      particles.appendChild(particle);
    }

    field.appendChild(particles);
    shell.prepend(field);
    recordAnimationDiagnostic("ember_field_created", {
      particleCount,
      mobilePerformance,
      isMobile
    });
  }

  function initScrollReveals(reducedMotion, mobilePerformance) {
    const revealGroups = [
      [".hero-copy, .page-hero-logo, .page-hero-copy", "reveal-left"],
      [".status-panel, .page-hero .button-row, .image-panel", "reveal-right"],
      [".section-header, .wipe-bar, .quick-feature-wrap, .metal-panel, .metal-card, .route-card, .rule-block, .steps li, .count-box, .footer-inner", "reveal-up"]
    ];
    const elements = [];
    const seen = new Set();

    revealGroups.forEach(([selector, direction]) => {
      app.querySelectorAll(selector).forEach((element, index) => {
        if (seen.has(element)) return;

        seen.add(element);
        element.classList.add("reveal-on-scroll", direction);
        element.style.setProperty("--reveal-delay", `${Math.min(index * (mobilePerformance ? 30 : 55), mobilePerformance ? 160 : 360)}ms`);
        elements.push(element);
      });
    });

    if (reducedMotion || !("IntersectionObserver" in window)) {
      recordAnimationDiagnostic("scroll_reveals_fallback", {
        count: elements.length,
        reason: reducedMotion ? "reduced-motion" : "missing-intersection-observer"
      });
      elements.forEach(element => markRevealVisible(element, true));
      return;
    }

    doc.classList.add("motion-ready");
    recordAnimationDiagnostic("scroll_reveals_initialized", {
      count: elements.length,
      mobilePerformance,
      rootMargin: mobilePerformance ? "0px 0px -4% 0px" : "0px 0px -12% 0px",
      threshold: mobilePerformance ? .05 : .12
    });

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        markRevealVisible(entry.target, mobilePerformance);
        observer.unobserve(entry.target);
      });
    }, {
      rootMargin: mobilePerformance ? "0px 0px -4% 0px" : "0px 0px -12% 0px",
      threshold: mobilePerformance ? .05 : .12
    });

    window.requestAnimationFrame(() => {
      elements.forEach(element => observer.observe(element));
    });
  }

  function markRevealVisible(element, clearImmediately = false) {
    element.classList.add("is-visible");

    if (clearImmediately) {
      element.classList.add("is-reveal-complete");
      return;
    }

    window.setTimeout(() => {
      element.classList.add("is-reveal-complete");
    }, 820);
  }

  function isMobilePerformanceMode() {
    return window.matchMedia && window.matchMedia(MOBILE_PERFORMANCE_QUERY).matches;
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function bindNav() {
    const toggle = app.querySelector("[data-menu-toggle]");
    const dropdowns = Array.from(app.querySelectorAll("[data-nav-dropdown]"));

    const closeDropdowns = except => {
      dropdowns.forEach(dropdown => {
        if (dropdown !== except) dropdown.open = false;
      });
    };

    dropdowns.forEach(dropdown => {
      dropdown.addEventListener("toggle", () => {
        if (dropdown.open) closeDropdowns(dropdown);
      });
    });

    document.addEventListener("click", event => {
      if (!event.target.closest("[data-nav-dropdown]")) closeDropdowns();
    });

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      closeDropdowns();
      document.body.classList.remove("nav-open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    });

    if (!toggle) return;

    toggle.addEventListener("click", () => {
      const open = !document.body.classList.contains("nav-open");
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      if (!open) closeDropdowns();
    });
  }

  function bindActions() {
    app.querySelectorAll("[data-copy-command]").forEach(button => {
      button.addEventListener("click", async () => {
        const copied = await copyText(CONFIG.connectCommand);
        track("connect_command_copied");
        showToast(copied ? "Connect command copied." : `Copy blocked. Use: ${CONFIG.connectCommand}`);
      });
    });

    app.querySelectorAll("[data-copy-value]").forEach(button => {
      button.addEventListener("click", async () => {
        const value = button.dataset.copyValue || "";
        const copied = await copyText(value);
        track("api_key_copied");
        showToast(copied ? "Copied." : "Copy blocked.");
      });
    });

    app.querySelectorAll("[data-track]").forEach(item => {
      item.addEventListener("click", () => track(item.dataset.track));
    });

    app.querySelectorAll('[data-track="join_server_clicked"]').forEach(link => {
      link.addEventListener("click", async () => {
        const copied = await copyText(CONFIG.connectCommand);

        if (copied) {
          showToast("Opening Rust. Connect command copied as a fallback.");
        }
      });
    });

    app.querySelectorAll("[data-auth-provider]").forEach(button => {
      button.addEventListener("click", () => {
        const provider = button.dataset.authProvider;
        const url = provider === "steam" ? CONFIG.auth.steamUrl : CONFIG.auth.discordUrl;
        track(`${provider}_link_started`);

        if (url) {
          window.location.href = url;
          return;
        }

        showToast(`${provider === "steam" ? "Steam sign-in" : "Discord connection"} is not ready yet.`);
      });
    });

    app.querySelectorAll("[data-unlink-provider]").forEach(button => {
      button.addEventListener("click", () => {
        const provider = button.dataset.unlinkProvider;
        track(`${provider}_unlink_clicked`);
        showToast(`${provider === "steam" ? "Steam" : "Discord"} is not connected on this browser.`);
      });
    });
  }

  function initRpGames() {
    const root = app.querySelector("[data-rp-games]");

    if (!root) return;

    const tabs = Array.from(root.querySelectorAll("[data-rp-game-tab]"));
    const panels = Array.from(root.querySelectorAll("[data-rp-game-panel]"));

    if (!tabs.length || !panels.length) return;

    initRpSyncGuide(root);
    initRouletteDirectTable(root);
    initSlotMachine(root);
    renderBlackjack(root.querySelector("[data-blackjack-table]"));
    activateRpGame(root, normalizeRpGameKey(root, window.location.hash) || tabs[0].dataset.rpGameTab || "coinflip", false);

    tabs.forEach(tab => {
      tab.addEventListener("click", event => {
        event.preventDefault();
        activateRpGame(root, tab.dataset.rpGameTab || "", true);
      });
    });

    window.addEventListener("hashchange", () => {
      const key = normalizeRpGameKey(root, window.location.hash);

      if (key) {
        activateRpGame(root, key, false);
      }
    });

    root.addEventListener("submit", event => {
      const form = event.target;

      if (!(form instanceof HTMLFormElement) || !form.matches("[data-rp-game-form]")) {
        return;
      }

      if (!window.fetch) {
        return;
      }

      event.preventDefault();
      submitRpGameForm(root, form, event.submitter);
    });
  }

  function normalizeRpGameKey(root, value) {
    const key = String(value || "")
      .replace(/^#/, "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-");

    if (!key) return "";

    return root.querySelector(`[data-rp-game-panel="${escapeSelector(key)}"]`) ? key : "";
  }

  function activateRpGame(root, gameKey, pushHistory) {
    const key = normalizeRpGameKey(root, gameKey) || "coinflip";

    root.querySelectorAll("[data-rp-game-tab]").forEach(tab => {
      const selected = tab.dataset.rpGameTab === key;

      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });

    root.querySelectorAll("[data-rp-game-panel]").forEach(panel => {
      const selected = panel.dataset.rpGamePanel === key;

      panel.hidden = !selected;
      panel.classList.toggle("is-active", selected);
    });

    root.dataset.activeGame = key;

    if (pushHistory && window.history && window.history.pushState) {
      const next = `${window.location.pathname}${window.location.search}#${key}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (next !== current) {
        window.history.pushState({ rpGame: key }, "", next);
      }
    }
  }

  async function submitRpGameForm(root, form, clickedButton) {
    const panel = form.closest("[data-rp-game-panel]");
    const submitter = form.querySelector('[type="submit"]');
    const gameKey = form.dataset.rpGameForm || panel?.dataset.rpGamePanel || "game";
    const formData = new FormData(form);
    if (clickedButton?.name && clickedButton.value) formData.set(clickedButton.name, clickedButton.value);
    const timing = startRpGameMotion(panel, gameKey);

    form.classList.add("is-submitting");
    setRpGameFormLocked(form, true);

    if (submitter) {
      submitter.dataset.originalText = submitter.textContent || "";
      submitter.textContent = "Saving game...";
    }

    try {
      const actionUrl = form.getAttribute("action") || window.location.href;
      const request = (async () => {
        const response = await fetch(actionUrl, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "fetch"
          }
        });
        const payload = await readJsonResponse(response);

        return { response, payload };
      })();
      const [{ response, payload }] = await Promise.all([request, delay(timing.minMs)]);

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || payload.error || `RP game request failed with HTTP ${response.status}.`);
      }

      if (submitter) {
        submitter.textContent = "Showing result...";
      }

      await settleRpGameMotion(panel, gameKey, payload.result || {}, timing);
      if (shouldShowRpGameOutcome(gameKey, payload.result || {})) {
        showRpGameOutcome(panel, gameKey, payload.result || {}, payload.message || "RP game queued.");
      }
      showRpGamesFlash(root, payload.type || "success", payload.message || "RP game queued.");
      applyRpGamesState(payload.state || {});
      showToast(payload.message || "RP game queued.");
      track(`rp_game_${form.dataset.rpGameForm || "play"}_queued`);
      await delay(timing.resultLockMs);
    } catch (error) {
      const message = error && error.message ? error.message : "RP game could not be queued.";
      stopRpGameMotion(panel);
      showRpGamesFlash(root, "error", message);
      showToast(message);
    } finally {
      form.classList.remove("is-submitting");
      setRpGameFormLocked(form, false);

      if (submitter) {
        submitter.textContent = submitter.dataset.originalText || "Submit";
      }
    }
  }

  function getRpGameTiming(gameKey) {
    const base = RP_GAME_MOTION[gameKey] || RP_GAME_MOTION.coinflip;

    if (window.matchMedia && window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      return {
        minMs: Math.min(650, base.minMs),
        settleMs: 0,
        resultLockMs: Math.min(800, base.resultLockMs)
      };
    }

    return base;
  }

  function shouldShowRpGameOutcome(gameKey, result) {
    if (normalizeRpPlayedGame(gameKey) !== "blackjack") return true;

    const status = String(result?.hand?.status || "").toLowerCase();
    return ["payout_queued", "paid", "lost", "push", "canceled", "failed"].includes(status);
  }

  function startRpGameMotion(panel, gameKey) {
    const timing = getRpGameTiming(gameKey);

    if (!panel) return timing;

    clearRpGameOutcome(panel);
    stopHighLowTicker(panel);
    panel.classList.remove("result-win", "result-loss", "result-push", "result-neutral");
    panel.classList.add("is-spinning");

    const coin = panel.querySelector("[data-rp-coin-strip]");
    if (coin) {
      coin.removeAttribute("data-rp-coin-result");
    }

    const dice = panel.querySelector("[data-rp-dice-strip]");
    if (dice) {
      dice.removeAttribute("data-rp-dice-face");
    }

    const highLow = panel.querySelector(".high-low-machine");
    if (highLow) {
      highLow.removeAttribute("data-rp-outcome");
      const roll = highLow.querySelector("[data-rp-high-low-roll]");

      if (roll) {
        roll.classList.remove("is-settled");
        startHighLowTicker(panel, roll);
      }
    }

    startWheelSpin(panel, timing);
    if (normalizeRpPlayedGame(gameKey) === "slots") startSlotSpin(panel);

    return timing;
  }

  async function settleRpGameMotion(panel, gameKey, result, timing) {
    if (!panel) return;

    const normalized = normalizeRpPlayedGame(gameKey);

    if (normalized === "coinflip") {
      settleCoinFlip(panel, result);
    } else if (normalized === "dice") {
      settleDice(panel, result);
    } else if (normalized === "high-low") {
      settleHighLow(panel, result);
    } else if (normalized === "wheel") {
      settleWheel(panel, result, timing);
    } else if (normalized === "roulette") {
      const target = panel.querySelector("[data-rp-roulette-result]");
      if (target) target.textContent = String(result.roll ?? 0);
    } else if (normalized === "slots") {
      stopSlotSpin(panel);
      await settleSlotReels(panel, result.grid || [], result.winning_lines || []);
    } else if (normalized === "blackjack") {
      const table = panel.querySelector("[data-blackjack-table]");
      if (table && result.hand) { table.dataset.hand = JSON.stringify(result.hand); renderBlackjack(table); }
    }

    await delay(timing.settleMs);
    panel.classList.remove("is-spinning");
  }

  function initRouletteBuilder(root) {
    const form = root.querySelector(".roulette-bet-builder");
    if (!form) return;
    const bets = [], type = form.querySelector("[data-roulette-type]"), numbers = form.querySelector("[data-roulette-numbers]");
    const key = form.querySelector("[data-roulette-key]"), stake = form.querySelector("[data-roulette-stake]");
    const hidden = form.querySelector("[data-roulette-bets-json]"), slip = form.querySelector("[data-roulette-slip]"), total = form.querySelector("[data-roulette-total]");
    const render = () => {
      hidden.value = JSON.stringify(bets); total.textContent = `${bets.reduce((sum, bet) => sum + bet.stake_rp, 0)} RP`;
      slip.innerHTML = bets.length ? "" : "<p>No bets placed.</p>";
      bets.forEach((bet, index) => { const row = document.createElement("button"); row.type="button"; row.className="roulette-slip-row"; row.textContent=`${bet.type === "outside" ? bet.key : bet.numbers.join("/")} — ${bet.stake_rp} RP ×`; row.addEventListener("click",()=>{bets.splice(index,1);render();}); slip.appendChild(row); });
    };
    type.addEventListener("change",()=>{ const outside=type.value==="outside"; form.querySelector("[data-roulette-numbers-field]").hidden=outside; form.querySelector("[data-roulette-key-field]").hidden=!outside; });
    root.querySelectorAll("[data-roulette-straights] [data-number]").forEach(button=>button.addEventListener("click",()=>{type.value="straight";type.dispatchEvent(new Event("change"));numbers.value=button.dataset.number||"";}));
    form.querySelector("[data-roulette-add]").addEventListener("click",()=>{ const amount=Number(stake.value); if(!Number.isInteger(amount)||amount<1){showToast("Enter a positive roulette stake.");return;} const bet={type:type.value,stake_rp:amount}; if(type.value==="outside")bet.key=key.value;else bet.numbers=numbers.value.split(",").map(value=>Number(value.trim())).filter(Number.isInteger); bets.push(bet);render(); });
    form.addEventListener("submit",event=>{if(!bets.length){event.preventDefault();event.stopImmediatePropagation();showToast("Add at least one roulette bet.");}});
  }

  function initRouletteCanvas(root) {
    const form=root.querySelector('.roulette-bet-builder'),canvas=root.querySelector('[data-roulette-canvas]');if(!form||!canvas)return;
    const bets=[],type=form.querySelector('[data-roulette-type]'),hidden=form.querySelector('[data-roulette-bets-json]'),slip=form.querySelector('[data-roulette-slip]'),total=form.querySelector('[data-roulette-total]'),help=root.querySelector('[data-roulette-help]');let chip=50,pending=null;
    const reds=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
    const draw=()=>{const c=canvas.getContext('2d'),left=70,top=24,w=68,h=92;c.clearRect(0,0,960,420);c.fillStyle='#0b5937';c.fillRect(0,0,960,420);c.strokeStyle='rgba(255,255,255,.72)';c.lineWidth=2;c.fillStyle='#08703f';c.fillRect(12,top,left-12,h*3);c.strokeRect(12,top,left-12,h*3);c.fillStyle='#fff';c.font='bold 25px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('0',41,top+h*1.5);for(let col=0;col<12;col++)for(let row=0;row<3;row++){const n=col*3+(3-row),x=left+col*w,y=top+row*h;c.fillStyle=reds.has(n)?'#8b2025':'#15191b';c.fillRect(x,y,w,h);c.strokeRect(x,y,w,h);c.fillStyle='#fff';c.fillText(String(n),x+w/2,y+h/2);}const counts=new Map();bets.filter(b=>b.type==='straight').forEach(b=>counts.set(b.numbers[0],(counts.get(b.numbers[0])||0)+1));counts.forEach((count,n)=>{let x,y;if(n===0){x=41;y=top+h*1.5;}else{const col=Math.floor((n-1)/3),row=2-((n-1)%3);x=left+col*w+w/2;y=top+row*h+h/2;}c.beginPath();c.fillStyle='#f1cf54';c.arc(x+19,y-22,14,0,Math.PI*2);c.fill();c.fillStyle='#19150a';c.font='bold 12px sans-serif';c.fillText(String(count),x+19,y-22);});if(pending!==null){c.fillStyle='#f1cf54';c.font='bold 18px sans-serif';c.fillText(`Split from ${pending}`,480,340);}c.fillStyle='rgba(255,255,255,.82)';c.font='14px sans-serif';c.fillText('Tap numbers to place inside bets',480,392);};
    const render=()=>{hidden.value=JSON.stringify(bets);total.textContent=`${bets.reduce((sum,b)=>sum+b.stake_rp,0)} RP`;slip.innerHTML=bets.length?'':'<p>No bets placed.</p>';bets.forEach((bet,index)=>{const row=document.createElement('button');row.type='button';row.className='roulette-slip-row';row.textContent=`${bet.type==='outside'?bet.key.replaceAll('_',' '):`${bet.type}: ${bet.numbers.join('/')}`} - ${bet.stake_rp} RP (remove)`;row.addEventListener('click',()=>{bets.splice(index,1);render();});slip.appendChild(row);});root.querySelectorAll('[data-roulette-outside]').forEach(button=>button.classList.toggle('has-bet',bets.some(b=>b.key===button.dataset.rouletteOutside)));draw();};
    const add=bet=>{bets.push({...bet,stake_rp:chip});pending=null;render();};
    const numberAt=(x,y)=>{const left=70,top=24,w=68,h=92;if(x>=12&&x<left&&y>=top&&y<top+h*3)return 0;if(x<left||x>=left+w*12||y<top||y>=top+h*3)return null;return Math.floor((x-left)/w)*3+(3-Math.floor((y-top)/h));};
    form.querySelectorAll('[data-roulette-chip]').forEach(button=>button.addEventListener('click',()=>{chip=Number(button.dataset.rouletteChip)||50;form.querySelectorAll('[data-roulette-chip]').forEach(item=>item.classList.toggle('is-selected',item===button));}));
    root.querySelectorAll('[data-roulette-outside]').forEach(button=>button.addEventListener('click',()=>add({type:'outside',key:button.dataset.rouletteOutside})));
    const outsideWrap=root.querySelector('.roulette-outside-bets');[['0-1-2 Trio',[0,1,2]],['0-2-3 Trio',[0,2,3]]].forEach(([label,numbers])=>{const button=document.createElement('button');button.type='button';button.className='roulette-outside';button.textContent=label;button.addEventListener('click',()=>add({type:'street',numbers}));outsideWrap.appendChild(button);});
    form.querySelector('[data-roulette-clear]').addEventListener('click',()=>{bets.splice(0);pending=null;render();});type.addEventListener('change',()=>{pending=null;help.textContent=type.value==='split'?'Tap two adjacent numbers for a split bet.':`Tap the table to place a ${type.options[type.selectedIndex].text.toLowerCase()} bet.`;render();});
    canvas.addEventListener('click',event=>{const rect=canvas.getBoundingClientRect(),n=numberAt((event.clientX-rect.left)*960/rect.width,(event.clientY-rect.top)*420/rect.height);if(n===null)return;const mode=type.value;if(mode==='straight')add({type:'straight',numbers:[n]});else if(mode==='split'){if(pending===null){pending=n;help.textContent=`Now tap a number adjacent to ${n}.`;render();return;}const pair=[pending,n].sort((a,b)=>a-b),[a,b]=pair,valid=(a===0&&[1,2,3].includes(b))||(a>0&&(b-a===3||(b-a===1&&Math.floor((a-1)/3)===Math.floor((b-1)/3))));if(!valid){pending=n;help.textContent='Those numbers do not share an edge. Choose an adjacent number.';render();return;}add({type:'split',numbers:pair});}else if(mode==='street'){if(n===0)add({type:'street',numbers:[0,1,2]});else{const s=Math.floor((n-1)/3)*3+1;add({type:'street',numbers:[s,s+1,s+2]});}}else if(mode==='corner'){if(n===0)return showToast('Corners start on numbered rows.');const s=n%3===0?n-1:n;if(s>32)return showToast('Choose a corner before the final column.');add({type:'corner',numbers:[s,s+1,s+3,s+4]});}else if(mode==='six_line'){if(n===0)return showToast('Six-lines start on numbered rows.');const s=Math.floor((n-1)/3)*3+1;if(s>31)return showToast('Choose one of the first eleven streets.');add({type:'six_line',numbers:[s,s+1,s+2,s+3,s+4,s+5]});}});
    form.addEventListener('submit',event=>{if(!bets.length){event.preventDefault();event.stopImmediatePropagation();showToast('Add at least one roulette bet.');}});render();
  }

  function initRouletteDirectTable(root) {
    const form=root.querySelector('.roulette-bet-builder'),canvas=root.querySelector('[data-roulette-canvas]');if(!form||!canvas)return;
    const bets=[],hidden=form.querySelector('[data-roulette-bets-json]'),slip=form.querySelector('[data-roulette-slip]'),total=form.querySelector('[data-roulette-total]'),help=root.querySelector('[data-roulette-help]');let chip=50;
    const reds=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]),left=70,top=20,w=68,h=82;
    const betId=bet=>bet.type==='outside'?`outside:${bet.key}`:`${bet.type}:${bet.numbers.join(',')}`;
    const numberCenter=n=>n===0?{x:41,y:top+h*1.5}:{x:left+Math.floor((n-1)/3)*w+w/2,y:top+(2-((n-1)%3))*h+h/2};
    const chipAnchor=bet=>{
      if(bet.type==='straight')return numberCenter(bet.numbers[0]);
      if(bet.type==='split'){if(bet.numbers[0]===0){const b=numberCenter(bet.numbers[1]);return{x:left,y:b.y};}const a=numberCenter(bet.numbers[0]),b=numberCenter(bet.numbers[1]);return{x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
      if(bet.type==='corner'){const points=bet.numbers.map(numberCenter);return{x:points.reduce((sum,p)=>sum+p.x,0)/4,y:points.reduce((sum,p)=>sum+p.y,0)/4};}
      if(bet.type==='street'){if(bet.numbers[0]===0)return{x:left,y:bet.numbers.includes(1)?top+h*2:top+h};const col=Math.floor((bet.numbers[0]-1)/3);return{x:left+col*w+w/2,y:top+h*3+21};}
      if(bet.type==='first_four')return{x:left,y:top+h*1.5};
      if(bet.type==='six_line'){const col=Math.floor((bet.numbers[0]-1)/3);return{x:left+(col+1)*w,y:top+h*3+65};}
      return null;
    };
    const add=bet=>{bets.push({...bet,stake_rp:chip});render();};
    const draw=()=>{const c=canvas.getContext('2d');c.clearRect(0,0,960,420);c.fillStyle='#0b5937';c.fillRect(0,0,960,420);c.strokeStyle='rgba(255,255,255,.72)';c.lineWidth=2;c.fillStyle='#08703f';c.fillRect(12,top,left-12,h*3);c.strokeRect(12,top,left-12,h*3);c.fillStyle='#fff';c.font='bold 24px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('0',41,top+h*1.5);for(let col=0;col<12;col++)for(let row=0;row<3;row++){const n=col*3+(3-row),x=left+col*w,y=top+row*h;c.fillStyle=reds.has(n)?'#8b2025':'#15191b';c.fillRect(x,y,w,h);c.strokeRect(x,y,w,h);c.fillStyle='#fff';c.fillText(String(n),x+w/2,y+h/2);}c.font='bold 12px sans-serif';for(let col=0;col<12;col++){const x=left+col*w;c.fillStyle='rgba(255,255,255,.07)';c.fillRect(x,top+h*3,w,42);c.strokeRect(x,top+h*3,w,42);c.fillStyle='#fff';c.fillText(`Street ${col+1}`,x+w/2,top+h*3+21);}for(let col=0;col<11;col++){const x=left+(col+1)*w-34;c.fillStyle='rgba(241,207,84,.12)';c.fillRect(x,top+h*3+47,w,36);c.strokeRect(x,top+h*3+47,w,36);c.fillStyle='#f1cf54';c.fillText('Six-line',x+w/2,top+h*3+65);}const placed=new Map();bets.filter(b=>b.type!=='outside').forEach(b=>{const id=betId(b),entry=placed.get(id)||{bet:b,total:0,count:0};entry.total+=b.stake_rp;entry.count++;placed.set(id,entry);});placed.forEach(entry=>{const p=chipAnchor(entry.bet);if(!p)return;c.beginPath();c.fillStyle='#f1cf54';c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=3;c.setLineDash([4,3]);c.arc(p.x,p.y,16,0,Math.PI*2);c.fill();c.stroke();c.setLineDash([]);c.fillStyle='#19150a';c.font='bold 10px sans-serif';c.fillText(entry.count>1?`${entry.total}`:`${entry.bet.stake_rp}`,p.x,p.y);});};
    const render=()=>{hidden.value=JSON.stringify(bets);total.textContent=`${bets.reduce((sum,b)=>sum+b.stake_rp,0)} RP`;slip.innerHTML=bets.length?'':'<p>No bets placed.</p>';bets.forEach((bet,index)=>{const row=document.createElement('button');row.type='button';row.className='roulette-slip-row';row.textContent=`${bet.type==='outside'?bet.key.replaceAll('_',' '):`${bet.type.replaceAll('_',' ')}: ${bet.numbers.join('/')}`} - ${bet.stake_rp} RP (remove)`;row.addEventListener('click',()=>{bets.splice(index,1);render();});slip.appendChild(row);});root.querySelectorAll('[data-roulette-bet-button]').forEach(button=>{const matching=bets.filter(b=>betId(b)===button.dataset.rouletteBetButton),amount=matching.reduce((sum,b)=>sum+b.stake_rp,0);button.classList.toggle('has-bet',amount>0);button.querySelector('.roulette-button-chip')?.remove();if(amount){const badge=document.createElement('span');badge.className='roulette-button-chip';badge.textContent=String(amount);button.appendChild(badge);}});draw();};
    form.querySelectorAll('[data-roulette-chip]').forEach(button=>button.addEventListener('click',()=>{chip=Number(button.dataset.rouletteChip)||50;form.querySelectorAll('[data-roulette-chip]').forEach(item=>item.classList.toggle('is-selected',item===button));help.textContent=`${chip} RP chip selected. Tap a center, edge, intersection, or rail.`;}));
    root.querySelectorAll('[data-roulette-outside]').forEach(button=>{button.dataset.rouletteBetButton=`outside:${button.dataset.rouletteOutside}`;button.addEventListener('click',()=>add({type:'outside',key:button.dataset.rouletteOutside}));});
    const outsideWrap=root.querySelector('.roulette-outside-bets');[['0-1-2 Trio',[0,1,2]],['0-2-3 Trio',[0,2,3]]].forEach(([label,numbers])=>{const button=document.createElement('button');button.type='button';button.className='roulette-outside';button.textContent=label;button.dataset.rouletteBetButton=`street:${numbers.join(',')}`;button.addEventListener('click',()=>add({type:'street',numbers}));outsideWrap.appendChild(button);});
    const firstFour=document.createElement('button');firstFour.type='button';firstFour.className='roulette-outside';firstFour.textContent='0-1-2-3 First four';firstFour.dataset.rouletteBetButton='first_four:0,1,2,3';firstFour.addEventListener('click',()=>add({type:'first_four',numbers:[0,1,2,3]}));outsideWrap.appendChild(firstFour);
    form.querySelector('[data-roulette-clear]').addEventListener('click',()=>{bets.splice(0);render();});
    canvas.addEventListener('click',event=>{const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*960/rect.width,y=(event.clientY-rect.top)*420/rect.height;if(x>=12&&x<left&&y>=top&&y<top+h*3){if(x>left-11){const row=Math.floor((y-top)/h),n=3-row;return add({type:'split',numbers:[0,n].sort((a,b)=>a-b)});}return add({type:'straight',numbers:[0]});}if(x<left||x>=left+w*12)return;
      const col=Math.floor((x-left)/w),localX=(x-left)-col*w;
      if(y>=top+h*3&&y<top+h*3+42){const s=col*3+1;return add({type:'street',numbers:[s,s+1,s+2]});}
      if(y>=top+h*3+47&&y<top+h*3+83){const boundary=Math.max(0,Math.min(10,Math.floor((x-left)/w)));const s=boundary*3+1;return add({type:'six_line',numbers:[s,s+1,s+2,s+3,s+4,s+5]});}
      if(y<top||y>=top+h*3)return;const row=Math.floor((y-top)/h),localY=(y-top)-row*h,n=col*3+(3-row),nearV=localX<11||localX>w-11,nearH=localY<11||localY>h-11;
      if(col===0&&localX<11){if(nearH){if(row===0&&localY<11)return add({type:'first_four',numbers:[0,1,2,3]});return add({type:'street',numbers:localY<11?[0,n,n+1]:[0,n-1,n]});}return add({type:'split',numbers:[0,n]});}
      if(nearV&&nearH&&col<11){const nextCol=localX>w-11?col+1:col;if(nextCol<=0)return;const upperRow=localY>h-11?row+1:row;if(upperRow<=0||upperRow>2)return;const a=(nextCol-1)*3+(3-upperRow);return add({type:'corner',numbers:[a,a+1,a+3,a+4]});}
      if(nearH){const other=localY<11?n+1:n-1;if(other>=col*3+1&&other<=col*3+3)return add({type:'split',numbers:[n,other].sort((a,b)=>a-b)});}
      if(nearV){const other=localX<11?n-3:n+3;if(other>=1&&other<=36)return add({type:'split',numbers:[n,other].sort((a,b)=>a-b)});}
      add({type:'straight',numbers:[n]});
    });form.addEventListener('submit',event=>{if(!bets.length){event.preventDefault();event.stopImmediatePropagation();showToast('Add at least one roulette bet.');}});help.textContent='Tap number centers for straight bets, shared edges for splits, intersections for corners, or the rails for streets and six-lines.';render();
  }

  function initSlotMachine(root) {
    const panel=root.querySelector('[data-rp-game-panel="slots"]');if(!panel)return;
    const symbols=['scrap','sulfur','crate','hazmat','c4','blank'];
    const grid=Array.from({length:5},(_,reel)=>Array.from({length:3},(_,row)=>symbols[(reel*3+row)%symbols.length]));renderSlotGrid(panel,grid,[]);
  }

  function startSlotSpin(panel) {
    stopSlotSpin(panel);const symbols=['scrap','sulfur','crate','hazmat','c4','blank'];let tick=0;
    panel.dataset.slotSpinTimer=String(window.setInterval(()=>{tick++;const grid=Array.from({length:5},(_,reel)=>Array.from({length:3},(_,row)=>symbols[(tick+reel*2+row+Math.floor(Math.random()*symbols.length))%symbols.length]));renderSlotGrid(panel,grid,[]);},85));
  }

  function stopSlotSpin(panel) { const timer=Number(panel?.dataset.slotSpinTimer||0);if(timer){window.clearInterval(timer);delete panel.dataset.slotSpinTimer;} }

  function renderSlotGrid(panel, grid, winningLines) {
    const labels={scrap:'Scrap',sulfur:'Sulfur',crate:'Crate',hazmat:'Hazmat',c4:'C4',blank:'Ash'};
    const lines=[[0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0]];
    const winning=new Set();(winningLines||[]).forEach(win=>(lines[(Number(win.line)||1)-1]||[]).forEach((row,reel)=>winning.add(`${reel}-${row}`)));
    panel.querySelectorAll('[data-rp-slot-grid] span').forEach((cell,index)=>{const reel=Math.floor(index/3),row=index%3,symbol=grid?.[reel]?.[row]||'blank';cell.className=`slot-symbol${winning.has(`${reel}-${row}`)?' is-winning':''}`;cell.dataset.symbol=symbol;cell.innerHTML=`<i aria-hidden="true"></i><b>${labels[symbol]||symbol}</b>`;});
    panel.classList.toggle('has-slot-win',winning.size>0);
  }

  async function settleSlotReels(panel, grid, winningLines) {
    const labels={scrap:'Scrap',sulfur:'Sulfur',crate:'Crate',hazmat:'Hazmat',c4:'C4',blank:'Ash'},cells=Array.from(panel.querySelectorAll('[data-rp-slot-grid] span'));
    for(let reel=0;reel<5;reel++){await delay(135);for(let row=0;row<3;row++){const cell=cells[reel*3+row],symbol=grid?.[reel]?.[row]||'blank';cell.className='slot-symbol is-reel-stopped';cell.dataset.symbol=symbol;cell.innerHTML=`<i aria-hidden="true"></i><b>${labels[symbol]||symbol}</b>`;}window.setTimeout(()=>cells.slice(reel*3,reel*3+3).forEach(cell=>cell.classList.remove('is-reel-stopped')),180);}
    renderSlotGrid(panel,grid,winningLines);
  }

  function renderBlackjack(table) {
    if (!table) return; let hand=null; try { hand=JSON.parse(table.dataset.hand||"null"); } catch (_) {}
    const renderCards = (target, cards) => { target.innerHTML=""; (cards||[]).forEach(card=>{const el=document.createElement("span");el.className="blackjack-card";el.textContent=card||"?";target.appendChild(el);}); };
    renderCards(table.querySelector("[data-blackjack-dealer]"),hand?.dealer_cards); renderCards(table.querySelector("[data-blackjack-player]"),hand?.player_cards);
    const playerTotal=table.querySelector("[data-blackjack-player-total]"), dealerTotal=table.querySelector("[data-blackjack-dealer-total]");
    if(playerTotal)playerTotal.textContent=hand?.player_value?.total?`Total ${hand.player_value.total}`:""; if(dealerTotal)dealerTotal.textContent=hand?.dealer_value?.total?`Total ${hand.dealer_value.total}`:"";
    const message=table.querySelector('[data-blackjack-message]');if(message)message.textContent=hand?.message||'Start a hand after the Rust server confirms your wager.';
    const controls=table.closest('[data-rp-game-panel="blackjack"]')?.querySelector('[data-blackjack-controls]');if(!controls)return;
    const csrf=table.dataset.csrf||'',actionUrl=table.dataset.actionUrl||window.location.href,min=Number(table.dataset.minStake)||200,max=Number(table.dataset.maxStake)||2000,enabled=table.dataset.enabled==='1',evenMin=min+(min%2);
    if(hand&&hand.status==='playing')controls.innerHTML=`<form class="feedback-form rp-game-form" method="post" action="${escapeHtml(actionUrl)}" data-rp-game-form="blackjack"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><input type="hidden" name="hand_id" value="${Number(hand.id)||0}"><input type="hidden" name="action_version" value="${Number(hand.action_version)||0}"><div class="blackjack-actions"><button class="btn btn-secondary" name="action" value="blackjack_hit" type="submit" ${hand.can_hit?'':'disabled'}>Hit</button><button class="btn btn-primary" name="action" value="blackjack_stand" type="submit" ${hand.can_stand?'':'disabled'}>Stand</button><button class="btn btn-secondary" name="action" value="blackjack_double" type="submit" ${hand.can_double?'':'disabled'}>Double</button></div></form>`;
    else if(hand&&['wager_queued','double_queued','payout_queued'].includes(hand.status)){controls.innerHTML=`<div class="form-status warning blackjack-pending"><strong>Waiting on the Rust server</strong><p>${escapeHtml(hand.message||'This hand will unlock automatically after RP confirmation.')}</p><small>Checking again automatically...</small></div>`;scheduleBlackjackPoll(table);}
    else controls.innerHTML=`<form class="feedback-form rp-game-form" method="post" action="${escapeHtml(actionUrl)}" data-rp-game-form="blackjack"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><input type="hidden" name="action" value="start_blackjack"><label class="store-field"><span>Stake (even RP)</span><input type="number" name="stake_rp" min="${min}" max="${max}" step="2" value="${evenMin}" ${enabled?'':'disabled'}></label><button class="btn btn-primary" type="submit" ${enabled?'':'disabled'}>Deal Blackjack</button></form>`;
  }

  function scheduleBlackjackPoll(table) {
    if(!table||table.dataset.blackjackPollTimer)return;
    table.dataset.blackjackPollTimer=String(window.setTimeout(async()=>{
      delete table.dataset.blackjackPollTimer;
      const root=table.closest('[data-rp-games]');
      if(root)await checkRpSyncStatus(root,false);
      let hand=null;try{hand=JSON.parse(table.dataset.hand||'null');}catch(_){}
      if(hand&&['wager_queued','double_queued','payout_queued'].includes(hand.status))scheduleBlackjackPoll(table);
    },2500));
  }

  function stopRpGameMotion(panel) {
    if (!panel) return;

    stopHighLowTicker(panel);
    stopSlotSpin(panel);
    panel.classList.remove("is-spinning");
  }

  function normalizeRpPlayedGame(gameKey) {
    return String(gameKey || "").replace(/_/g, "-");
  }

  function startWheelSpin(panel, timing) {
    const wheel = panel?.querySelector("[data-rp-wheel]");

    if (!wheel) return;

    const current = Number(wheel.dataset.rpRotation || 0);
    const extra = window.matchMedia && window.matchMedia(REDUCED_MOTION_QUERY).matches ? 0 : 1080 + Math.round(Math.random() * 220);
    const target = current + extra + 360;
    wheel.style.transition = extra === 0 ? "none" : `transform ${Math.max(900, timing.minMs)}ms cubic-bezier(.16, .78, .22, 1)`;
    wheel.style.transform = `rotate(${target}deg)`;
    wheel.dataset.rpRotation = String(target);
  }

  function settleWheel(panel, result, timing) {
    const wheel = panel?.querySelector("[data-rp-wheel]");

    if (!wheel) return;

    const outcome = String(result.outcome || "").toLowerCase();
    const finalRotation = Object.prototype.hasOwnProperty.call(RP_WHEEL_RESULT_ROTATIONS, outcome)
      ? RP_WHEEL_RESULT_ROTATIONS[outcome]
      : 0;
    const current = Number(wheel.dataset.rpRotation || 0);
    const turns = Math.max(1, Math.ceil((current - finalRotation) / 360) + 1);
    const target = turns * 360 + finalRotation;

    wheel.style.transition = timing.settleMs <= 0 ? "none" : `transform ${timing.settleMs}ms cubic-bezier(.12, .72, .18, 1)`;
    wheel.style.transform = `rotate(${target}deg)`;
    wheel.dataset.rpRotation = String(target);

    panel.querySelectorAll(".rp-wheel-odd").forEach(segment => {
      segment.classList.toggle("is-result", segment.classList.contains(outcome));
    });
  }

  function settleCoinFlip(panel, result) {
    const coin = panel?.querySelector("[data-rp-coin-strip]");
    const roll = String(result.roll || "").toLowerCase();

    if (coin && (roll === "heads" || roll === "tails")) {
      coin.setAttribute("data-rp-coin-result", roll);
    }
  }

  function settleDice(panel, result) {
    const dice = panel?.querySelector("[data-rp-dice-strip]");
    const roll = Number(result.roll) || 1;
    const face = Math.max(1, Math.min(6, Number(result.face) || (((roll - 1) % 6) + 1)));

    if (dice) {
      dice.setAttribute("data-rp-dice-face", String(face));
    }
  }

  function startHighLowTicker(panel, rollElement) {
    let value = Math.floor(Math.random() * 100) + 1;
    const timer = window.setInterval(() => {
      value = ((value + 17) % 100) + 1;
      rollElement.textContent = String(value).padStart(2, "0");
    }, 72);

    panel.dataset.rpHighLowTimer = String(timer);
  }

  function stopHighLowTicker(panel) {
    const timer = Number(panel?.dataset.rpHighLowTimer || 0);

    if (timer) {
      window.clearInterval(timer);
      delete panel.dataset.rpHighLowTimer;
    }
  }

  function settleHighLow(panel, result) {
    const machine = panel?.querySelector(".high-low-machine");
    const roll = machine?.querySelector("[data-rp-high-low-roll]");
    const value = Number(result.roll) || 0;

    stopHighLowTicker(panel);

    if (roll) {
      roll.textContent = value > 0 ? String(value) : "46-55";
      roll.classList.add("is-settled");
    }

    if (machine) {
      const outcome = result.push ? "push" : (value <= 45 ? "low" : (value >= 56 ? "high" : ""));

      if (outcome) {
        machine.setAttribute("data-rp-outcome", outcome);
      }
    }
  }

  function showRpGameOutcome(panel, gameKey, result, fallbackMessage) {
    if (!panel) return;

    const overlay = ensureRpGameOutcome(panel);
    const outcome = describeRpGameOutcome(gameKey, result, fallbackMessage);

    panel.classList.add(`result-${outcome.type}`);
    overlay.hidden = false;
    overlay.className = `rp-game-result ${outcome.type} is-visible`;
    overlay.querySelector("[data-rp-result-eyebrow]").textContent = outcome.eyebrow;
    overlay.querySelector("[data-rp-result-title]").textContent = outcome.title;
    overlay.querySelector("[data-rp-result-amount]").textContent = outcome.amount;
    overlay.querySelector("[data-rp-result-detail]").textContent = outcome.detail;

    const existing = Number(panel.dataset.rpResultTimer || 0);
    if (existing) {
      window.clearTimeout(existing);
    }

    panel.dataset.rpResultTimer = String(window.setTimeout(() => {
      overlay.classList.add("is-hiding");
      window.setTimeout(() => {
        overlay.hidden = true;
        overlay.className = "rp-game-result";
        delete panel.dataset.rpResultTimer;
      }, 300);
    }, 3600));
  }

  function clearRpGameOutcome(panel) {
    const overlay = panel?.querySelector("[data-rp-game-result]");

    if (!panel || !overlay) return;

    const existing = Number(panel.dataset.rpResultTimer || 0);
    if (existing) {
      window.clearTimeout(existing);
      delete panel.dataset.rpResultTimer;
    }

    overlay.hidden = true;
    overlay.className = "rp-game-result";
  }

  function ensureRpGameOutcome(panel) {
    let overlay = panel.querySelector("[data-rp-game-result]");

    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "rp-game-result";
    overlay.dataset.rpGameResult = "";
    overlay.hidden = true;
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("aria-label", "Game result. Click to dismiss.");
    overlay.innerHTML = `
      <div class="rp-game-result-inner">
        <span data-rp-result-eyebrow></span>
        <strong data-rp-result-title></strong>
        <em data-rp-result-amount></em>
        <small data-rp-result-detail></small>
      </div>
    `;
    overlay.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      clearRpGameOutcome(panel);
    });
    panel.appendChild(overlay);

    return overlay;
  }

  function describeRpGameOutcome(gameKey, result, fallbackMessage) {
    const normalized = normalizeRpPlayedGame(gameKey);
    const won = Boolean(result && result.won);
    const push = Boolean(result && result.push);
    const stake = Number(result?.stake_rp || 0);
    const payout = Number(result?.payout_rp || 0);
    const cost = Number(result?.cost_rp || 0);
    const tickets = Number(result?.tickets || 0);
    const net = Math.round(payout - stake);

    if (normalized === "jackpot") {
      return {
        type: "neutral",
        eyebrow: "Game saved",
        title: "Entry Saved",
        amount: formatSignedRp(-cost),
        detail: `${tickets || 1} jackpot ticket${tickets === 1 ? "" : "s"} saved. The server is now updating your RP.`
      };
    }

    if (normalized === "blackjack") {
      const hand = result?.hand || {};
      const pending = ["wager_queued", "double_queued", "payout_queued"].includes(hand.status);
      const payout = Number(hand.payout_rp || 0);
      const stake = Number(hand.stake_rp || 0);
      const push = hand.status === "push" || (hand.status === "payout_queued" && payout === stake);
      const won = hand.status === "paid" || (hand.status === "payout_queued" && payout > stake);
      const lost = hand.status === "lost";
      return {
        type: won ? "win" : (lost ? "loss" : (push ? "push" : "neutral")),
        eyebrow: pending ? "Hand complete" : "Hand closed",
        title: won ? "Blackjack Win" : (lost ? "Dealer Wins" : (push ? "Push" : "Blackjack Complete")),
        amount: formatSignedRp(payout - stake),
        detail: hand.message || fallbackMessage
      };
    }

    if (normalized === "raid-duel" || normalized === "supply-run") {
      const label = normalized === "raid-duel" ? "Raid Duel" : "Supply Run";
      const choice = result.choice_label || result.choice || "pick";

      return {
        type: "neutral",
        eyebrow: "Game saved",
        title: "Entry Saved",
        amount: formatSignedRp(-stake),
        detail: `${label} entry on ${choice} is saved. The server is now updating your RP.`
      };
    }

    if (push) {
      return {
        type: "push",
        eyebrow: "Game saved",
        title: "Push",
        amount: formatSignedRp(0),
        detail: result.roll ? `Rolled ${result.roll}. Your stake return is saved and waiting for the server.` : fallbackMessage
      };
    }

    if (won) {
      return {
        type: "win",
        eyebrow: "Game saved",
        title: "You Won",
        amount: formatSignedRp(net > 0 ? net : payout),
        detail: outcomeDetail(normalized, result, fallbackMessage)
      };
    }

    return {
      type: "loss",
      eyebrow: "Game saved",
      title: "You Lost",
      amount: formatSignedRp(-stake),
      detail: outcomeDetail(normalized, result, fallbackMessage)
    };
  }

  function outcomeDetail(gameKey, result, fallbackMessage) {
    if (gameKey === "coinflip" && result.roll) {
      return `Coin landed ${String(result.roll).toLowerCase()}. ${fallbackMessage}`;
    }

    if (gameKey === "dice" && result.roll) {
      return `Die landed on ${Number(result.face) || Number(result.roll)}. ${fallbackMessage}`;
    }

    if (gameKey === "high-low" && result.roll) {
      const choice = result.choice ? ` after calling ${result.choice}` : "";
      return `Rolled ${result.roll}${choice}. ${fallbackMessage}`;
    }

    if (gameKey === "wheel" && result.outcome) {
      return `Wheel landed on ${String(result.outcome).replace(/_/g, " ")}. ${fallbackMessage}`;
    }

    return fallbackMessage;
  }

  function setRpGameFormLocked(form, locked) {
    Array.from(form.elements).forEach(control => {
      if (!(control instanceof HTMLElement) || !("disabled" in control) || (control instanceof HTMLInputElement && control.type === "hidden")) {
        return;
      }

      if (locked) {
        control.dataset.rpWasDisabled = control.disabled ? "1" : "0";
        control.disabled = true;
      } else if (control.dataset.rpWasDisabled !== undefined) {
        control.disabled = control.dataset.rpWasDisabled === "1";
        delete control.dataset.rpWasDisabled;
      }
    });
  }

  function formatSignedRp(value) {
    const number = Math.round(Number(value) || 0);
    const sign = number > 0 ? "+" : (number < 0 ? "-" : "");

    return `${sign}${Math.abs(number).toLocaleString("en-US")} RP`;
  }

  function delay(ms) {
    return new Promise(resolve => {
      window.setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });
  }

  function showRpGamesFlash(root, type, message) {
    const flash = root.querySelector("[data-rp-games-flash]");

    if (!flash) return;

    flash.hidden = false;
    flash.className = `form-status ${type === "error" ? "error" : "success"}`;
    flash.textContent = message;
  }

  function initRpSyncGuide(root) {
    const guide = root.querySelector("[data-rp-sync-guide]");

    if (!guide) return;

    root.querySelectorAll("[data-rp-sync-check]").forEach(button => {
      button.addEventListener("click", () => checkRpSyncStatus(root, true));
    });

    if (Number(guide.dataset.pendingCount || 0) > 0) {
      startRpSyncCountdown(root);
    }
  }

  function rpSyncDeadlineFromState(guide) {
    const nextCheckAt = Date.parse(String(guide.dataset.nextCheckAt || ""));

    return Number.isFinite(nextCheckAt)
      ? nextCheckAt
      : Date.now() + Math.max(10, Number(guide.dataset.pollSeconds || 30)) * 1000;
  }

  function startRpSyncCountdown(root, preserveEarlierDeadline = true) {
    const guide = root.querySelector("[data-rp-sync-guide]");

    if (!guide || Number(guide.dataset.pendingCount || 0) <= 0) return;

    const existingDeadline = Number(guide.dataset.rpSyncDeadline || 0);
    const stateDeadline = rpSyncDeadlineFromState(guide);
    const deadline = preserveEarlierDeadline && existingDeadline > Date.now()
      ? Math.min(existingDeadline, stateDeadline)
      : stateDeadline;

    const timer = Number(guide.dataset.rpSyncTimer || 0);
    if (timer) window.clearInterval(timer);
    guide.dataset.rpSyncDeadline = String(deadline);
    updateRpSyncCountdown(guide);
    guide.dataset.rpSyncTimer = String(window.setInterval(() => updateRpSyncCountdown(guide, root), 250));
  }

  function stopRpSyncCountdown(guide) {
    const timer = Number(guide?.dataset.rpSyncTimer || 0);

    if (timer) {
      window.clearInterval(timer);
    }

    if (guide) {
      delete guide.dataset.rpSyncTimer;
      delete guide.dataset.rpSyncDeadline;
    }
  }

  function updateRpSyncCountdown(guide, root) {
    const countdowns = guide.parentElement?.querySelectorAll("[data-rp-sync-countdown]") || [];
    const deadline = Number(guide.dataset.rpSyncDeadline || Date.now());
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

    countdowns.forEach(countdown => {
      countdown.textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
    });

    if (remaining <= 0 && root) {
      stopRpSyncCountdown(guide);
      checkRpSyncStatus(root, false);
    }
  }

  async function checkRpSyncStatus(root, requestedByPlayer) {
    const guide = root.querySelector("[data-rp-sync-guide]");
    const buttons = guide ? Array.from(guide.parentElement?.querySelectorAll("[data-rp-sync-check]") || []) : [];

    if (!guide || guide.dataset.rpSyncChecking === "1" || !window.fetch) return;

    guide.dataset.rpSyncChecking = "1";
    guide.classList.add("is-checking");
    buttons.forEach(button => {
      button.disabled = true;
      button.dataset.originalText = button.textContent || "Check now";
      button.textContent = "Checking...";
    });

    try {
      const response = await fetch(guide.dataset.stateUrl || window.location.href, {
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "fetch"
        }
      });
      const payload = await readJsonResponse(response);

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "The status check did not finish.");
      }

      applyRpGamesState(payload.state || {});
      if (requestedByPlayer && Number(guide.dataset.pendingCount || 0) <= 0) {
        showToast("Your RP status is up to date.");
      }
    } catch (error) {
      const message = guide.querySelector("[data-rp-sync-message]");
      guide.classList.add("is-waiting");
      guide.classList.remove("is-ready", "is-complete", "is-error");
      if (message) {
        message.textContent = "Your game is still saved. We could not check the server just now, so we will try again automatically.";
      }
      if (Number(guide.dataset.pendingCount || 0) > 0) {
        startRpSyncCountdown(root);
      }
    } finally {
      delete guide.dataset.rpSyncChecking;
      guide.classList.remove("is-checking");
      buttons.forEach(button => {
        button.disabled = false;
        button.textContent = button.dataset.originalText || "Check now";
        delete button.dataset.originalText;
      });
    }
  }

  function applyRpSyncState(sync) {
    const root = app.querySelector("[data-rp-games]");
    const guide = root?.querySelector("[data-rp-sync-guide]");

    if (!root || !guide || !sync || typeof sync !== "object") return;

    const previousPending = Number(guide.dataset.pendingCount || 0);
    const pending = Math.max(0, Number(sync.pending_count || 0));
    const latestStatus = String(sync.latest_status || "").toLowerCase();
    const title = guide.querySelector("[data-rp-sync-title]");
    const message = guide.querySelector("[data-rp-sync-message]");
    const countdownWrap = guide.querySelector("[data-rp-sync-countdown-wrap]");
    const playingStatus = root.querySelector("[data-rp-sync-playing]");
    const savedStep = guide.querySelector('[data-rp-sync-step="saved"]');
    const serverStep = guide.querySelector('[data-rp-sync-step="server"]');
    const balanceStep = guide.querySelector('[data-rp-sync-step="balance"]');
    const failed = ["rejected", "failed", "expired", "canceled"].includes(latestStatus);

    guide.dataset.pendingCount = String(pending);
    guide.dataset.pollSeconds = String(Math.max(10, Number(sync.poll_seconds || guide.dataset.pollSeconds || 30)));
    if (sync.next_check_at) guide.dataset.nextCheckAt = String(sync.next_check_at);
    guide.classList.remove("is-ready", "is-waiting", "is-complete", "is-error");
    [savedStep, serverStep, balanceStep].forEach(step => step?.classList.remove("is-active", "is-complete", "is-error"));

    if (pending > 0) {
      guide.classList.add("is-waiting");
      savedStep?.classList.add("is-complete");
      serverStep?.classList.add("is-active");
      if (title) title.textContent = latestStatus === "processing" ? "The server is updating your RP" : "Your game is saved";
      if (message) message.textContent = `Nothing failed. The game server is applying ${pending} RP change${pending === 1 ? "" : "s"}, and this page will update itself.`;
      if (countdownWrap) countdownWrap.hidden = false;
      if (playingStatus) playingStatus.hidden = false;
      startRpSyncCountdown(root);
      return;
    }

    stopRpSyncCountdown(guide);
    if (countdownWrap) countdownWrap.hidden = true;
    if (playingStatus) playingStatus.hidden = true;

    if (previousPending > 0 && failed) {
      guide.classList.add("is-error");
      savedStep?.classList.add("is-complete");
      serverStep?.classList.add("is-error");
      if (title) title.textContent = "Your RP was not changed";
      if (message) message.textContent = sync.latest_message || "The server could not complete this RP change. Your activity history shows the final status.";
      showRpGamesFlash(root, "error", "The server did not complete the RP change. Your activity history has the details.");
      return;
    }

    if (previousPending > 0) {
      guide.classList.add("is-complete");
      savedStep?.classList.add("is-complete");
      serverStep?.classList.add("is-complete");
      balanceStep?.classList.add("is-complete");
      if (title) title.textContent = "Your RP is updated";
      if (message) message.textContent = "The game server finished the RP change, and your balance and activity are now up to date.";
      showRpGamesFlash(root, "success", "RP update complete. Your synced balance is current.");
      return;
    }

    guide.classList.add("is-ready");
    if (title) title.textContent = "Ready for your next game";
    if (message) message.textContent = "No RP changes are waiting. After you play, your result is saved first, then the game server updates your RP during its next sync cycle.";
  }

  function applyRpGamesState(state) {
    if (!state || typeof state !== "object") return;

    const balance = state.balance && typeof state.balance === "object" ? state.balance : {};
    const daily = state.daily && typeof state.daily === "object" ? state.daily : {};
    setPanelText('[data-rp-stat="balance"]', formatRp(balance.reward_points));
    setPanelText('[data-rp-stat="wagered"]', formatRp(daily.wagered_rp));
    setPanelText('[data-rp-stat="loss"]', formatRp(daily.loss_rp));
    applyRpJackpotState(state.active_jackpot || null);
    renderRpPoolRounds(state.pool_rounds || {});
    renderRpGameRounds(Array.isArray(state.game_rounds) ? state.game_rounds : []);
    renderRpJackpotEntries(Array.isArray(state.jackpot_entries) ? state.jackpot_entries : []);
    updateRpHistoryEmpty(state);
    applyRpSyncState(state.sync || {});
    const blackjackTable = app.querySelector("[data-blackjack-table]");
    if (blackjackTable && Object.prototype.hasOwnProperty.call(state, "active_blackjack")) {
      blackjackTable.dataset.hand = JSON.stringify(state.active_blackjack || null);
      renderBlackjack(blackjackTable);
    }
  }

  function applyRpJackpotState(jackpot) {
    if (!jackpot || typeof jackpot !== "object") return;

    setPanelText('[data-rp-jackpot="ticket"]', formatRp(jackpot.ticket_cost_rp));
    setPanelText('[data-rp-jackpot="entries"]', String(Number(jackpot.total_entries) || 0));
    setPanelText('[data-rp-jackpot="pot"]', formatRp(jackpot.pot_rp));
    setPanelText('[data-rp-jackpot="closes"]', `Closes ${jackpot.closes_at || ""} UTC. Only confirmed entries count.`);
  }

  function renderRpPoolRounds(poolRounds) {
    if (!poolRounds || typeof poolRounds !== "object") return;

    Object.entries(poolRounds).forEach(([gameKey, poolState]) => {
      const round = poolState && typeof poolState === "object" ? poolState.round : null;

      if (!round || typeof round !== "object") return;

      setPanelText(`[data-rp-pool-total="${escapeSelector(gameKey)}"]`, formatRp(round.total_stake_rp));
      setPanelText(
        `[data-rp-pool-closes="${escapeSelector(gameKey)}"]`,
        round.closes_at ? `Closes ${round.closes_at} UTC` : "Waiting for the next open round"
      );
      renderRpPoolOptions(gameKey, Array.isArray(round.breakdown) ? round.breakdown : []);
      renderRpPoolEntries(gameKey, Array.isArray(round.entries) ? round.entries : []);
    });
  }

  function renderRpPoolOptions(gameKey, breakdown) {
    const container = app.querySelector(`[data-rp-pool-options="${escapeSelector(gameKey)}"]`);

    if (!container) return;

    container.innerHTML = breakdown.map(row => {
      const key = String(row.key || "");
      const percent = Math.max(0, Math.min(100, Number(row.percent) || 0));

      return `
        <div class="rp-pool-option" data-rp-pool-option="${escapeAttr(key)}">
          <span>
            <strong>${escapeHtml(row.label || "Option")}</strong>
            <small>${escapeHtml(String(Number(row.chance) || 0))}% roll chance</small>
          </span>
          <em>${escapeHtml(formatRp(row.stake_rp))}</em>
          <i style="--pool-share: ${percent}%"></i>
        </div>
      `;
    }).join("");
  }

  function renderRpPoolEntries(gameKey, entries) {
    const container = app.querySelector(`[data-rp-pool-feed-list="${escapeSelector(gameKey)}"]`);

    if (!container) return;

    if (!entries.length) {
      container.innerHTML = '<p class="store-muted">No visible entries in this round yet.</p>';
      return;
    }

    container.innerHTML = entries.map(entry => `
      <span class="rp-pool-feed-row">
        <strong>${escapeHtml(entry.player_label || "Raidlands Player")}</strong>
        <em>${escapeHtml(entry.option_label || "Pick")}</em>
        <small>${escapeHtml(formatRp(entry.stake_rp))}</small>
      </span>
    `).join("");
  }

  function renderRpGameRounds(rounds) {
    const body = app.querySelector("[data-rp-rounds-body]");
    const table = app.querySelector("[data-rp-rounds-table]");

    if (!body || !table) return;

    table.hidden = rounds.length === 0;
    body.innerHTML = rounds.map(round => {
      const status = String(round.status || "queued");
      const gameType = String(round.game_type || "game");

      return `
        <tr data-rp-activity-key="${escapeAttr(round.activity_key || `round-${round.id || 0}`)}">
          <td>${escapeHtml(rpGameLabel(gameType))}</td>
          <td>${escapeHtml(formatRp(round.stake_rp))}</td>
          <td>${escapeHtml(round.roll_result || "")}</td>
          <td>${escapeHtml(formatRp(round.payout_rp))}</td>
          <td><span class="status-pill ${escapeAttr(status)}">${escapeHtml(rpStatusLabel(status))}</span></td>
          <td>${escapeHtml(round.created_at || "")}</td>
        </tr>
      `;
    }).join("");
  }

  function renderRpJackpotEntries(entries) {
    const body = app.querySelector("[data-rp-jackpot-entries-body]");
    const table = app.querySelector("[data-rp-jackpot-entries-table]");

    if (!body || !table) return;

    table.hidden = entries.length === 0;
    body.innerHTML = entries.map(entry => {
      const status = String(entry.status || "queued");

      return `
        <tr>
          <td>${escapeHtml(entry.round_key || "Jackpot")}</td>
          <td>${escapeHtml(String(Number(entry.ticket_count) || 0))}</td>
          <td>${escapeHtml(formatRp(entry.cost_rp))}</td>
          <td><span class="status-pill ${escapeAttr(status)}">${escapeHtml(rpStatusLabel(status))}</span></td>
          <td>${escapeHtml(entry.created_at || "")}</td>
        </tr>
      `;
    }).join("");
  }

  function updateRpHistoryEmpty(state) {
    const empty = app.querySelector("[data-rp-history-empty]");

    if (!empty) return;

    const rounds = Array.isArray(state.game_rounds) ? state.game_rounds : [];
    const entries = Array.isArray(state.jackpot_entries) ? state.jackpot_entries : [];
    const jackpots = Array.isArray(state.jackpot_rounds) ? state.jackpot_rounds : [];
    const pools = state.pool_rounds && typeof state.pool_rounds === "object" ? Object.values(state.pool_rounds) : [];
    const poolEntries = pools.some(pool => {
      const round = pool && typeof pool === "object" ? pool.round : null;
      return round && Array.isArray(round.entries) && round.entries.length > 0;
    });
    empty.hidden = rounds.length > 0 || entries.length > 0 || jackpots.length > 0 || poolEntries;
  }

  function rpGameLabel(gameType) {
    const labels = {
      coinflip: "Coinflip",
      dice: "Dice",
      high_low: "High-Low",
      wheel: "Wheel",
      raid_duel: "Raid Duel",
      supply_run: "Supply Run",
      monument_extraction: "Monument Extraction"
    };

    if (labels[gameType]) {
      return labels[gameType];
    }

    return String(gameType || "Game").replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function rpStatusLabel(status) {
    const labels = {
      queued: "Waiting on server",
      processing: "Server updating RP",
      confirmed: "Complete",
      paid: "Complete",
      lost: "Complete",
      payout_queued: "Payout waiting",
      rejected: "Not completed",
      failed: "Needs attention",
      expired: "Timed out",
      canceled: "Canceled"
    };

    return labels[status] || String(status || "Status").replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function formatRp(value) {
    const number = Math.max(0, Number(value) || 0);

    return `${number.toLocaleString("en-US")} RP`;
  }

  function escapeSelector(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function initLeaderboards() {
    app.querySelectorAll("[data-leaderboard]").forEach(root => {
      const panels = Array.from(root.querySelectorAll("[data-leaderboard-panel]"));

      if (!panels.length || !window.fetch) return;

      activateLeaderboardBoard(root, root.dataset.activeBoard || "players", false);
      updateLeaderboardControls(root);

      root.addEventListener("click", event => {
        const tab = event.target.closest("[data-leaderboard-tab]");

        if (tab && root.contains(tab)) {
          event.preventDefault();
          const board = tab.getAttribute("data-leaderboard-tab") || "players";
          const panel = leaderboardPanel(root, board);

          if (!panel) return;

          readLeaderboardLink(panel, tab.href, true);
          activateLeaderboardBoard(root, board, false);
          loadLeaderboardPanel(root, panel, true);
          return;
        }

        const scope = event.target.closest("[data-leaderboard-scope]");

        if (scope && root.contains(scope)) {
          event.preventDefault();
          const panel = scope.closest("[data-leaderboard-panel]");

          if (!panel) return;

          readLeaderboardLink(panel, scope.href, true);
          syncLeaderboardSharedState(root, panel);
          loadLeaderboardPanel(root, panel, true);
          return;
        }

        const metric = event.target.closest("[data-leaderboard-metric]");

        if (metric && root.contains(metric)) {
          event.preventDefault();
          const panel = metric.closest("[data-leaderboard-panel]");

          if (!panel) return;

          panel.dataset.metric = normalizeLeaderboardMetric(panel.dataset.board, metric.getAttribute("data-leaderboard-metric"));
          panel.dataset.page = "1";
          loadLeaderboardPanel(root, panel, true);
          return;
        }

        const pageLink = event.target.closest("[data-leaderboard-page-link]");

        if (pageLink && root.contains(pageLink)) {
          event.preventDefault();

          if (pageLink.classList.contains("is-disabled")) return;

          const panel = pageLink.closest("[data-leaderboard-panel]");

          if (!panel) return;

          readLeaderboardLink(panel, pageLink.href, false);
          loadLeaderboardPanel(root, panel, true);
        }
      });

      root.addEventListener("submit", event => {
        const form = event.target;

        if (!(form instanceof HTMLFormElement) || !form.matches("[data-leaderboard-form]")) {
          return;
        }

        event.preventDefault();
        applyLeaderboardForm(root, form);
      });

      panels.forEach(panel => {
        const search = panel.querySelector("[data-leaderboard-search]");
        const pageSize = panel.querySelector("[data-leaderboard-page-size]");
        const wipeSelect = panel.querySelector("[data-leaderboard-wipe-select]");

        if (search) {
          search.addEventListener("input", () => {
            window.clearTimeout(panel.__leaderboardSearchTimer);
            panel.__leaderboardSearchTimer = window.setTimeout(() => {
              panel.dataset.search = search.value.trim();
              panel.dataset.page = "1";
              syncLeaderboardSharedState(root, panel);
              loadLeaderboardPanel(root, panel, true);
            }, 320);
          });
        }

        if (pageSize) {
          pageSize.addEventListener("change", () => {
            panel.dataset.perPage = normalizeLeaderboardPageSize(pageSize.value);
            panel.dataset.page = "1";
            syncLeaderboardSharedState(root, panel);
            loadLeaderboardPanel(root, panel, true);
          });
        }

        if (wipeSelect) {
          wipeSelect.addEventListener("change", () => {
            const wipeId = normalizeLeaderboardWipeId(wipeSelect.value);

            panel.dataset.wipeId = wipeId;
            panel.dataset.wipeKey = "";
            panel.dataset.scope = wipeId ? "wipe" : "current";
            panel.dataset.page = "1";
            syncLeaderboardSharedState(root, panel);
            loadLeaderboardPanel(root, panel, true);
          });
        }
      });

      window.addEventListener("popstate", () => {
        const params = new URLSearchParams(window.location.search);
        const board = params.get("board") === "bots" ? "bots" : "players";
        const panel = leaderboardPanel(root, board);

        if (!panel) return;

        readLeaderboardParams(panel, params, false);
        activateLeaderboardBoard(root, board, false);
        syncLeaderboardSharedState(root, panel);
        loadLeaderboardPanel(root, panel, false);
      });
    });
  }

  function applyLeaderboardForm(root, form) {
    const panel = form.closest("[data-leaderboard-panel]");

    if (!panel) return;

    const formData = new FormData(form);
    panel.dataset.wipeId = normalizeLeaderboardWipeId(formData.get("wipe_id"));
    panel.dataset.wipeKey = normalizeLeaderboardWipeKey(formData.get("wipe_key"));
    panel.dataset.scope = panel.dataset.wipeId || panel.dataset.wipeKey ? "wipe" : normalizeLeaderboardScope(formData.get("scope"));
    panel.dataset.metric = normalizeLeaderboardMetric(panel.dataset.board, formData.get("metric"));
    panel.dataset.search = String(formData.get("q") || "").trim();
    panel.dataset.perPage = normalizeLeaderboardPageSize(formData.get("per_page"));
    panel.dataset.page = "1";
    syncLeaderboardSharedState(root, panel);
    loadLeaderboardPanel(root, panel, true);
  }

  function leaderboardPanel(root, board) {
    const normalized = ["players", "raids", "bots", "rp-games"].includes(board) ? board : "players";
    return root.querySelector(`[data-leaderboard-panel][data-board="${normalized}"]`);
  }

  function activateLeaderboardBoard(root, board, updateUrl) {
    const activeBoard = ["players", "raids", "bots", "rp-games"].includes(board) ? board : "players";

    root.dataset.activeBoard = activeBoard;
    root.querySelectorAll("[data-leaderboard-tab]").forEach(tab => {
      const selected = tab.getAttribute("data-leaderboard-tab") === activeBoard;

      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });

    root.querySelectorAll("[data-leaderboard-panel]").forEach(panel => {
      const selected = panel.dataset.board === activeBoard;

      panel.hidden = !selected;
      panel.classList.toggle("is-active", selected);
    });

    updateLeaderboardControls(root);

    if (updateUrl) {
      const panel = leaderboardPanel(root, activeBoard);

      if (panel) {
        updateLeaderboardHistory(panel, true);
      }
    }
  }

  function readLeaderboardLink(panel, href, resetPage) {
    try {
      readLeaderboardParams(panel, new URL(href, window.location.href).searchParams, resetPage);
    } catch (error) {
      if (resetPage) {
        panel.dataset.page = "1";
      }
    }
  }

  function readLeaderboardParams(panel, params, resetPage) {
    const wipeId = normalizeLeaderboardWipeId(params.get("wipe_id"));
    const wipeKey = normalizeLeaderboardWipeKey(params.get("wipe_key"));
    const requestedScope = normalizeLeaderboardScope(params.get("scope"));

    panel.dataset.scope = (wipeId || wipeKey) ? "wipe" : requestedScope;
    panel.dataset.wipeId = wipeId;
    panel.dataset.wipeKey = wipeKey;
    panel.dataset.metric = normalizeLeaderboardMetric(panel.dataset.board, params.get("metric"));
    panel.dataset.search = String(params.get("q") || "");
    panel.dataset.perPage = normalizeLeaderboardPageSize(params.get("per_page"));
    panel.dataset.page = resetPage ? "1" : normalizeLeaderboardPage(params.get("page"));
  }

  async function loadLeaderboardPanel(root, panel, updateUrl) {
    syncLeaderboardSharedState(root, panel);
    updateLeaderboardControls(root);
    panel.classList.add("is-loading");

    const requestId = String(Date.now()) + String(Math.random());
    panel.dataset.requestId = requestId;

    try {
      const response = await fetch(leaderboardApiUrl(root, panel), {
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = await readJsonResponse(response);

      if (panel.dataset.requestId !== requestId) return;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Leaderboard request failed with HTTP ${response.status}.`);
      }

      applyLeaderboardPayload(root, panel, payload);

      if (updateUrl) {
        updateLeaderboardHistory(panel, true);
      }
    } catch (error) {
      showToast(error.message || "Leaderboard could not be loaded.");
    } finally {
      if (panel.dataset.requestId === requestId) {
        panel.classList.remove("is-loading");
      }
    }
  }

  function leaderboardApiUrl(root, panel) {
    const url = new URL(root.dataset.apiUrl || `${doc.dataset.base || "./"}api/leaderboard.php`, window.location.href);

    url.searchParams.set("board", panel.dataset.board || "players");
    url.searchParams.set("scope", normalizeLeaderboardScope(panel.dataset.scope));
    url.searchParams.set("metric", normalizeLeaderboardMetric(panel.dataset.board, panel.dataset.metric));
    url.searchParams.set("page", normalizeLeaderboardPage(panel.dataset.page));
    url.searchParams.set("per_page", normalizeLeaderboardPageSize(panel.dataset.perPage));

    if (normalizeLeaderboardScope(panel.dataset.scope) === "wipe") {
      if (normalizeLeaderboardWipeId(panel.dataset.wipeId)) {
        url.searchParams.set("wipe_id", normalizeLeaderboardWipeId(panel.dataset.wipeId));
      } else if (normalizeLeaderboardWipeKey(panel.dataset.wipeKey)) {
        url.searchParams.set("wipe_key", normalizeLeaderboardWipeKey(panel.dataset.wipeKey));
      }
    }

    if ((panel.dataset.search || "").trim()) {
      url.searchParams.set("q", panel.dataset.search.trim());
    }

    return url.toString();
  }

  function leaderboardPageUrl(panel) {
    const url = new URL(window.location.href);

    url.searchParams.set("board", panel.dataset.board || "players");
    url.searchParams.set("scope", normalizeLeaderboardScope(panel.dataset.scope));
    url.searchParams.set("metric", normalizeLeaderboardMetric(panel.dataset.board, panel.dataset.metric));
    url.searchParams.set("page", normalizeLeaderboardPage(panel.dataset.page));
    url.searchParams.set("per_page", normalizeLeaderboardPageSize(panel.dataset.perPage));
    url.searchParams.delete("wipe_id");
    url.searchParams.delete("wipe_key");

    if (normalizeLeaderboardScope(panel.dataset.scope) === "wipe") {
      if (normalizeLeaderboardWipeId(panel.dataset.wipeId)) {
        url.searchParams.set("wipe_id", normalizeLeaderboardWipeId(panel.dataset.wipeId));
      } else if (normalizeLeaderboardWipeKey(panel.dataset.wipeKey)) {
        url.searchParams.set("wipe_key", normalizeLeaderboardWipeKey(panel.dataset.wipeKey));
      }
    }

    if ((panel.dataset.search || "").trim()) {
      url.searchParams.set("q", panel.dataset.search.trim());
    } else {
      url.searchParams.delete("q");
    }

    return `${url.pathname}${url.search}${url.hash}`;
  }

  function updateLeaderboardHistory(panel, push) {
    if (!window.history || !window.history.pushState) return;

    const next = leaderboardPageUrl(panel);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (next === current) return;

    if (push) {
      window.history.pushState({ leaderboard: true }, "", next);
      return;
    }

    window.history.replaceState({ leaderboard: true }, "", next);
  }

  function applyLeaderboardPayload(root, panel, payload) {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];

    panel.dataset.scope = normalizeLeaderboardScope(payload.scope);
    panel.dataset.wipeId = normalizeLeaderboardWipeId(payload.wipe_id);
    panel.dataset.wipeKey = normalizeLeaderboardWipeKey(payload.wipe_key);
    panel.dataset.metric = normalizeLeaderboardMetric(panel.dataset.board, payload.metric);
    panel.dataset.search = String(payload.search || "");
    panel.dataset.page = normalizeLeaderboardPage(payload.page);
    panel.dataset.perPage = normalizeLeaderboardPageSize(payload.per_page);
    panel.dataset.total = String(Math.max(0, Number(payload.total) || 0));
    panel.dataset.pages = normalizeLeaderboardPage(payload.pages);
    renderLeaderboardRows(panel, rows);
    panel.dispatchEvent(new CustomEvent("raidlands:leaderboard-payload", {
      bubbles: true,
      detail: payload
    }));
    updateLeaderboardControls(root);
  }

  function renderLeaderboardRows(panel, rows) {
    const body = panel.querySelector("[data-leaderboard-rows]");
    const tableWrap = panel.querySelector("[data-leaderboard-table-wrap]");
    const empty = panel.querySelector("[data-leaderboard-empty]");

    if (body) {
      body.innerHTML = rows.map(row => {
        if (panel.dataset.board === "bots") return renderBotLeaderboardRow(row);
        if (panel.dataset.board === "rp-games") return renderRpGamesLeaderboardRow(row);
        if (panel.dataset.board === "raids") return renderRaidLeaderboardRow(row);
        return renderPlayerLeaderboardRow(row);
      }).join("");
    }

    if (tableWrap) {
      tableWrap.hidden = rows.length === 0;
    }

    if (empty) {
      empty.hidden = rows.length > 0;
    }
  }

  function renderPlayerLeaderboardRow(row) {
    const name = String(row.display_name || row.steam_display_name || "Raidlands Player");
    const steamId = String(row.steam_id64 || "");
    const profileUrl = String(row.steam_profile_url || "").trim();
    const steamMeta = profileUrl
      ? `<a class="leaderboard-steam" href="${escapeAttr(profileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(steamId)}</a>`
      : `<span class="leaderboard-steam">${escapeHtml(steamId)}</span>`;

    return `<tr>
      <td><span class="leaderboard-rank">#${escapeHtml(row.rank || "0")}</span></td>
      <td>
        <div class="leaderboard-player">
          ${renderLeaderboardAvatar(row, name)}
          <span class="leaderboard-player-copy">
            <strong>${escapeHtml(name)}</strong>
            ${steamMeta}
          </span>
        </div>
      </td>
      <td><strong>${formatLeaderboardNumber(row.kills)}</strong></td>
      <td>${formatLeaderboardNumber(row.deaths)}</td>
      <td>${formatLeaderboardNumber(row.npc_kills)}</td>
      <td>${formatLeaderboardNumber(row.deaths_by_npc)}</td>
      <td>${formatLeaderboardKdr(row.kdr)}</td>
      <td>${Number(row.headshot_rate || 0).toFixed(1)}%</td>
      <td>${formatLeaderboardNumber(row.best_kill_streak)}</td>
      <td>${formatLeaderboardDuration(row.playtime_seconds)}</td>
      <td>${formatLeaderboardNumber(row.reward_points)}</td>
    </tr>`;
  }

  function renderRaidLeaderboardRow(row) {
    const name = String(row.display_name || row.steam_display_name || "Raidlands Player");
    const steamId = String(row.steam_id64 || "");
    const profileUrl = String(row.steam_profile_url || "").trim();
    const steamMeta = profileUrl
      ? `<a class="leaderboard-steam" href="${escapeAttr(profileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(steamId)}</a>`
      : `<span class="leaderboard-steam">${escapeHtml(steamId)}</span>`;

    return `<tr>
      <td><span class="leaderboard-rank">#${escapeHtml(row.rank || "0")}</span></td>
      <td><div class="leaderboard-player">${renderLeaderboardAvatar(row, name)}<span class="leaderboard-player-copy"><strong>${escapeHtml(name)}</strong>${steamMeta}</span></div></td>
      <td><strong>${formatLeaderboardNumber(row.raid_damage)}</strong></td>
      <td>${formatLeaderboardNumber(row.rockets_used)}</td>
      <td>${formatLeaderboardNumber(row.c4_used)}</td>
      <td>${formatLeaderboardNumber(row.satchels_used)}</td>
      <td>${formatLeaderboardNumber(row.explosive_ammo_used)}</td>
      <td>${formatLeaderboardNumber(row.tcs_destroyed)}</td>
    </tr>`;
  }

  function renderLeaderboardAvatar(row, name) {
    const avatarUrl = String(row.steam_avatar_url || "").trim();
    const profileUrl = String(row.steam_profile_url || "").trim();

    if (!avatarUrl) return "";

    const image = `<img src="${escapeAttr(avatarUrl)}" alt="${escapeAttr(name)} Steam avatar" loading="lazy" referrerpolicy="no-referrer">`;

    if (profileUrl) {
      return `<a class="steam-avatar steam-avatar-sm" href="${escapeAttr(profileUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(name)} Steam profile">${image}</a>`;
    }

    return `<span class="steam-avatar steam-avatar-sm">${image}</span>`;
  }

  function renderRpGamesLeaderboardRow(row) {
    const name = String(row.display_name || row.steam_display_name || "Raidlands Player");
    const steamId = String(row.steam_id64 || "");
    const profileUrl = String(row.steam_profile_url || "").trim();
    const steamMeta = profileUrl
      ? `<a class="leaderboard-steam" href="${escapeAttr(profileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(steamId)}</a>`
      : `<span class="leaderboard-steam">${escapeHtml(steamId)}</span>`;

    return `<tr>
      <td><span class="leaderboard-rank">#${escapeHtml(row.rank || "0")}</span></td>
      <td><div class="leaderboard-player">${renderLeaderboardAvatar(row, name)}<span class="leaderboard-player-copy"><strong>${escapeHtml(name)}</strong>${steamMeta}</span></div></td>
      <td><strong>${formatRp(row.total_rp_won)}</strong></td>
      <td>${formatLeaderboardNumber(row.wins)}</td>
      <td>${formatLeaderboardNumber(row.games_played)}</td>
      <td>${formatRp(row.biggest_win)}</td>
    </tr>`;
  }

  function renderBotLeaderboardRow(row) {
    const name = String(row.display_name || row.bot_key || "Raidlands Bot");
    const botKey = String(row.bot_key || "");

    return `<tr>
      <td><span class="leaderboard-rank">#${escapeHtml(row.rank || "0")}</span></td>
      <td>
        <div class="leaderboard-player">
          <span class="leaderboard-bot-avatar" aria-hidden="true">AI</span>
          <span class="leaderboard-player-copy">
            <strong>${escapeHtml(name)}</strong>
            <span class="leaderboard-steam">${escapeHtml(botKey)}</span>
          </span>
        </div>
      </td>
      <td>${escapeHtml(row.kit_name || "Unknown")}</td>
      <td>${escapeHtml(row.skill_tier || "Unknown")}</td>
      <td><strong>${formatLeaderboardNumber(row.kills)}</strong></td>
      <td>${formatLeaderboardNumber(row.deaths)}</td>
      <td>${formatLeaderboardKdr(row.kdr)}</td>
    </tr>`;
  }

  function syncLeaderboardSharedState(root, sourcePanel) {
    root.querySelectorAll("[data-leaderboard-panel]").forEach(panel => {
      if (panel === sourcePanel) return;

      panel.dataset.scope = normalizeLeaderboardScope(sourcePanel.dataset.scope);
      panel.dataset.wipeId = normalizeLeaderboardWipeId(sourcePanel.dataset.wipeId);
      panel.dataset.wipeKey = normalizeLeaderboardWipeKey(sourcePanel.dataset.wipeKey);
      panel.dataset.search = String(sourcePanel.dataset.search || "");
      panel.dataset.perPage = normalizeLeaderboardPageSize(sourcePanel.dataset.perPage);
      panel.dataset.page = "1";
    });
  }

  function updateLeaderboardControls(root) {
    root.querySelectorAll("[data-leaderboard-panel]").forEach(panel => {
      const board = panel.dataset.board || "players";
      const scope = normalizeLeaderboardScope(panel.dataset.scope);
      const metric = normalizeLeaderboardMetric(board, panel.dataset.metric);
      const page = Number(normalizeLeaderboardPage(panel.dataset.page));
      const perPage = normalizeLeaderboardPageSize(panel.dataset.perPage);
      const wipeId = normalizeLeaderboardWipeId(panel.dataset.wipeId);
      const wipeKey = normalizeLeaderboardWipeKey(panel.dataset.wipeKey);
      const total = Math.max(0, Number(panel.dataset.total) || 0);
      const pages = Math.max(1, Number(normalizeLeaderboardPage(panel.dataset.pages)));

      panel.querySelectorAll("[data-leaderboard-scope]").forEach(link => {
        const selected = link.getAttribute("data-leaderboard-scope") === scope;

        link.classList.toggle("is-active", selected);
        link.href = leaderboardHref(panel, { scope: link.getAttribute("data-leaderboard-scope"), page: 1 });
      });

      panel.querySelectorAll("[data-leaderboard-metric]").forEach(link => {
        const selected = link.getAttribute("data-leaderboard-metric") === metric;

        link.classList.toggle("is-active", selected);
        link.href = leaderboardHref(panel, { metric: link.getAttribute("data-leaderboard-metric"), page: 1 });
      });

      panel.querySelectorAll("[data-leaderboard-field='scope']").forEach(input => {
        input.value = scope;
      });

      panel.querySelectorAll("[data-leaderboard-field='metric']").forEach(input => {
        input.value = metric;
      });

      panel.querySelectorAll("[data-leaderboard-field='wipe_key']").forEach(input => {
        input.value = scope === "wipe" ? wipeKey : "";
      });

      panel.querySelectorAll("[data-leaderboard-wipe-select]").forEach(select => {
        select.value = scope === "wipe" ? wipeId : "";
      });

      panel.querySelectorAll("[data-leaderboard-search]").forEach(input => {
        if (document.activeElement !== input) {
          input.value = panel.dataset.search || "";
        }
      });

      panel.querySelectorAll("[data-leaderboard-page-size]").forEach(select => {
        select.value = perPage;
      });

      panel.querySelectorAll("[data-leaderboard-count]").forEach(item => {
        item.textContent = leaderboardResultSummary(total, page, Number(perPage));
      });

      panel.querySelectorAll("[data-leaderboard-page-summary]").forEach(item => {
        item.textContent = `Page ${page} of ${pages}`;
      });

      panel.querySelectorAll("[data-leaderboard-page-link]").forEach(link => {
        const direction = link.getAttribute("data-leaderboard-page-link");
        const nextPage = direction === "next" ? Math.min(pages, page + 1) : Math.max(1, page - 1);
        const disabled = direction === "next" ? page >= pages : page <= 1;

        link.classList.toggle("is-disabled", disabled);
        link.setAttribute("aria-disabled", String(disabled));
        link.href = leaderboardHref(panel, { page: nextPage });
      });
    });

    root.querySelectorAll("[data-leaderboard-tab]").forEach(tab => {
      const requestedBoard = tab.getAttribute("data-leaderboard-tab") || "players";
      const board = ["players", "raids", "bots", "rp-games"].includes(requestedBoard) ? requestedBoard : "players";
      const panel = leaderboardPanel(root, board);
      const selected = root.dataset.activeBoard === board;

      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));

      if (panel) {
        tab.href = leaderboardHref(panel, { page: 1 });
      }
    });
  }

  function leaderboardHref(panel, overrides = {}) {
    const url = new URL(window.location.href);
    const board = panel.dataset.board || "players";
    const scope = normalizeLeaderboardScope(overrides.scope || panel.dataset.scope);
    const metric = normalizeLeaderboardMetric(board, overrides.metric || panel.dataset.metric);
    const page = normalizeLeaderboardPage(overrides.page || panel.dataset.page);
    const perPage = normalizeLeaderboardPageSize(overrides.perPage || panel.dataset.perPage);
    const search = overrides.search !== undefined ? String(overrides.search || "") : String(panel.dataset.search || "");
    const wipeId = scope === "wipe"
      ? normalizeLeaderboardWipeId(overrides.wipeId !== undefined ? overrides.wipeId : panel.dataset.wipeId)
      : "";
    const wipeKey = scope === "wipe" && !wipeId
      ? normalizeLeaderboardWipeKey(overrides.wipeKey !== undefined ? overrides.wipeKey : panel.dataset.wipeKey)
      : "";

    url.searchParams.set("board", board);
    url.searchParams.set("scope", scope);
    url.searchParams.set("metric", metric);
    url.searchParams.set("page", page);
    url.searchParams.set("per_page", perPage);
    url.searchParams.delete("wipe_id");
    url.searchParams.delete("wipe_key");

    if (wipeId) {
      url.searchParams.set("wipe_id", wipeId);
    } else if (wipeKey) {
      url.searchParams.set("wipe_key", wipeKey);
    }

    if (search.trim()) {
      url.searchParams.set("q", search.trim());
    } else {
      url.searchParams.delete("q");
    }

    return `${url.pathname}${url.search}${url.hash}`;
  }

  function leaderboardResultSummary(total, page, perPage) {
    if (total <= 0) {
      return "0 results";
    }

    const start = ((page - 1) * perPage) + 1;
    const end = Math.min(total, page * perPage);

    return `${formatLeaderboardNumber(start)}-${formatLeaderboardNumber(end)} of ${formatLeaderboardNumber(total)}`;
  }

  function normalizeLeaderboardScope(scope) {
    return ["current", "all-time", "wipe"].includes(String(scope || "")) ? String(scope) : "current";
  }

  function normalizeLeaderboardWipeId(value) {
    const wipeId = parseInt(value, 10);

    return String(Number.isFinite(wipeId) && wipeId > 0 ? wipeId : "");
  }

  function normalizeLeaderboardWipeKey(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9_.:-]+/g, "-").replace(/^[-_.:]+|[-_.:]+$/g, "").slice(0, 160);
  }

  function normalizeLeaderboardMetric(board, metric) {
    const value = String(metric || "");

    if (board === "bots") {
      return ["kdr", "kills", "deaths"].includes(value) ? value : "kdr";
    }

    if (board === "rp-games") {
      return "total-won";
    }

    if (board === "raids") {
      return ["raid_damage", "rockets_used", "c4_used", "satchels_used", "explosive_ammo_used", "tcs_destroyed"].includes(value)
        ? value
        : "raid_damage";
    }

    return ["kills", "kdr", "playtime", "rp", "npc_kills", "deaths_by_npc", "headshots", "streak", "damage", "distance"].includes(value) ? value : "kills";
  }

  function normalizeLeaderboardPage(value) {
    const page = parseInt(value, 10);

    return String(Number.isFinite(page) && page > 0 ? page : 1);
  }

  function normalizeLeaderboardPageSize(value) {
    const pageSize = parseInt(value, 10);
    const normalized = Number.isFinite(pageSize) ? Math.max(5, Math.min(100, pageSize)) : 25;

    return String(normalized);
  }

  function formatLeaderboardNumber(value) {
    const number = Number(value) || 0;

    return new Intl.NumberFormat().format(Math.trunc(number));
  }

  function formatLeaderboardKdr(value) {
    const number = Number(value) || 0;

    return number.toFixed(2);
  }

  function formatLeaderboardDuration(value) {
    const seconds = Math.max(0, Math.trunc(Number(value) || 0));
    const hours = Math.trunc(seconds / 3600);
    const minutes = Math.trunc((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    }

    return `${minutes}m`;
  }

  function initClanManagement() {
    if (pageId !== "clans" || !window.fetch) return;

    const monitor = app.querySelector("[data-clan-action-monitor]");

    if (!monitor) return;

    const state = {
      monitor,
      pollUrl: monitor.dataset.pollUrl || `${doc.dataset.base || "./"}api/clans/me.php`,
      actionUrl: monitor.dataset.actionUrl || `${doc.dataset.base || "./"}api/clans/action.php`,
      csrf: getClanCsrfToken(),
      actions: new Map(),
      watched: loadClanWatchedActions(),
      pollTimer: null,
      polling: false,
      refreshUntil: 0
    };
    const initial = readJsonNode("clan-action-state", { recent_actions: [] });

    (initial.recent_actions || []).forEach(action => {
      const normalized = normalizeClanAction(action);

      if (!normalized.id) return;

      state.actions.set(normalized.id, normalized);

      if (isActiveClanAction(normalized) && !state.watched[normalized.id]) {
        state.watched[normalized.id] = normalized;
      }
    });

    Object.values(state.watched).forEach(action => {
      const normalized = normalizeClanAction(action);

      if (normalized.id && !state.actions.has(normalized.id)) {
        state.actions.set(normalized.id, normalized);
      }
    });

    saveClanWatchedActions(state.watched);
    bindClanActionForms(state);
    renderClanQueue(state);

    if (hasPendingClanWork(state)) {
      scheduleClanPoll(state, 1600);
    }
  }

  function bindClanActionForms(state) {
    app.addEventListener("submit", event => {
      const form = event.target;

      if (!(form instanceof HTMLFormElement) || !form.matches("[data-clan-queue-form]")) {
        return;
      }

      const formAction = form.querySelector('[name="form_action"]');

      if (!formAction || formAction.value !== "queue_clan_action") {
        return;
      }

      event.preventDefault();
      queueClanAction(form, state);
    });
  }

  async function queueClanAction(form, state) {
    const button = form.querySelector('[type="submit"]');
    const payload = formDataToObject(new FormData(form));

    if (button) {
      button.disabled = true;
      button.classList.add("is-loading");
    }

    form.classList.add("is-submitting");

    try {
      const response = await fetch(state.actionUrl, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await readJsonResponse(response);

      if (!response.ok || !data.ok) {
        throw new Error(data.error || `Clan action failed with HTTP ${response.status}.`);
      }

      const action = normalizeClanAction({
        ...payload,
        ...(data.action || {}),
        action_type: (data.action && (data.action.action || data.action.action_type)) || payload.action,
        target_steam_id64: payload.target_steam_id64 || "",
        target_display_name: payload.target_display_name || "",
        status: (data.action && data.action.status) || "queued",
        created_at: new Date().toISOString()
      });

      if (action.id) {
        state.actions.set(action.id, action);
        state.watched[action.id] = action;
        saveClanWatchedActions(state.watched);
        renderClanQueue(state);
      }

      form.reset();
      showToast("Clan action queued.");
      scheduleClanPoll(state, 1000);
    } catch (error) {
      showToast(error.message || "Clan action could not be queued.");
      showClanResolution(state, {
        id: `local-${Date.now()}`,
        action_type: payload.action || "action",
        target_steam_id64: payload.target_steam_id64 || "",
        target_display_name: payload.target_display_name || "",
        clan_tag: payload.clan_tag || "",
        status: "failed",
        error_message: error.message || "Clan action could not be queued."
      });
    } finally {
      form.classList.remove("is-submitting");

      if (button) {
        button.disabled = false;
        button.classList.remove("is-loading");
      }
    }
  }

  async function pollClanState(state) {
    if (state.polling) return;

    state.polling = true;

    try {
      const response = await fetch(state.pollUrl, {
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });
      const data = await readJsonResponse(response);

      if (!response.ok || !data.ok || !data.context) {
        throw new Error(data.error || `Clan refresh failed with HTTP ${response.status}.`);
      }

      applyClanContext(state, data.context);
      handleClanActionTransitions(state, data.context.recent_actions || []);
      renderClanQueue(state);
    } catch (error) {
      console.info("Raidlands clan queue could not be refreshed.", error);
    } finally {
      state.polling = false;

      if (hasPendingClanWork(state)) {
        scheduleClanPoll(state, 2400);
      }
    }
  }

  function handleClanActionTransitions(state, recentActions) {
    recentActions.map(normalizeClanAction).forEach(action => {
      if (!action.id) return;

      state.actions.set(action.id, action);

      const watched = state.watched[action.id];

      if (!watched) return;

      state.watched[action.id] = {
        ...watched,
        ...action
      };

      if (isTerminalClanAction(action) && !watched.notified) {
        state.watched[action.id].notified = true;
        showClanResolution(state, action);

        if (action.status === "succeeded") {
          state.refreshUntil = Date.now() + 18000;
        }

        window.setTimeout(() => {
          delete state.watched[action.id];
          saveClanWatchedActions(state.watched);
          renderClanQueue(state);
        }, 5200);
      }
    });

    saveClanWatchedActions(state.watched);
  }

  function applyClanContext(state, context) {
    const clan = context.clan;
    const recentActions = (context.recent_actions || []).map(normalizeClanAction).filter(action => action.id);

    recentActions.forEach(action => state.actions.set(action.id, action));
    updateClanHistory(recentActions);

    if (!clan) return;

    const members = Array.isArray(clan.members) ? clan.members : [];
    const invites = Array.isArray(clan.member_invites) ? clan.member_invites : [];
    const allies = Array.isArray(clan.allies) ? clan.allies : [];
    const invitedAllies = Array.isArray(clan.invited_allies) ? clan.invited_allies : [];

    setClanStat("members", members.length);
    setClanStat("invites", invites.length);
    setClanStat("allies", allies.length);
    setClanStat("role", context.role || "member");

    const staleWarning = app.querySelector("[data-clan-stale-warning]");

    if (staleWarning) {
      staleWarning.hidden = !clan.is_stale;
    }

    renderClanMembers(members, context);
    renderClanInvites(invites, context);
    renderClanAllies(allies, invitedAllies);
  }

  function renderClanQueue(state) {
    const list = state.monitor.querySelector("[data-clan-queue-list]");
    const empty = state.monitor.querySelector("[data-clan-queue-empty]");
    const count = state.monitor.querySelector("[data-clan-queue-count]");
    const active = Array.from(state.actions.values())
      .filter(isActiveClanAction)
      .sort(sortClanActions);

    state.monitor.classList.toggle("is-idle", active.length === 0);

    if (count) {
      count.textContent = `${active.length} active`;
    }

    if (list) {
      list.hidden = active.length === 0;
      list.innerHTML = active.map(renderClanActionItem).join("");
    }

    if (empty) {
      empty.hidden = active.length > 0;
    }
  }

  function renderClanMembers(members, context) {
    const body = app.querySelector("[data-clan-members]");

    if (!body) return;

    body.innerHTML = members.map(member => renderClanMemberRow(member, context)).join("");
  }

  function renderClanMemberRow(member, context) {
    const steamId = digitsOnly(member.steam_id64 || "");
    const role = String(member.role || "member").toLowerCase();
    const name = String(member.display_name || "").trim() || steamId;
    const online = member.is_online ? "Online" : "Offline";

    return `<tr>
      <td>${escapeHtml(name)}</td>
      <td><code>${escapeHtml(steamId)}</code></td>
      <td><span class="status-pill ${escapeAttr(role)}">${escapeHtml(role)}</span></td>
      <td>${online}</td>
      <td><div class="clan-action-row">${renderClanMemberActions({ steamId, role, name }, context)}</div></td>
    </tr>`;
  }

  function renderClanMemberActions(member, context) {
    const clan = context.clan || {};
    const actions = Array.isArray(context.allowed_actions) ? context.allowed_actions : [];
    const playerSteamId = digitsOnly((context.player && context.player.steam_id64) || "");
    const isSelf = member.steamId === playerSteamId;
    const canManage = !clan.is_stale && actions.includes("kick");
    const isOwner = !clan.is_stale && actions.includes("promote");
    const forms = [];

    if (canManage && !isSelf && member.role !== "owner" && (member.role !== "moderator" || isOwner)) {
      forms.push(renderClanActionForm("kick", member.steamId, member.name, "Kick", "btn-secondary", clan.tag));
    }

    if (isOwner && !isSelf && member.role === "member") {
      forms.push(renderClanActionForm("promote", member.steamId, member.name, "Promote", "btn-secondary", clan.tag));
    }

    if (isOwner && !isSelf && member.role === "moderator") {
      forms.push(renderClanActionForm("demote", member.steamId, member.name, "Demote", "btn-ghost", clan.tag));
    }

    return forms.length ? forms.join("") : '<span class="store-muted">No action</span>';
  }

  function renderClanInvites(invites, context) {
    const list = app.querySelector("[data-clan-invites]");
    const empty = app.querySelector("[data-clan-invites-empty]");

    if (!list || !empty) return;

    const clan = context.clan || {};
    const actions = Array.isArray(context.allowed_actions) ? context.allowed_actions : [];
    const canManage = !clan.is_stale && actions.includes("withdraw_invite");

    empty.hidden = invites.length > 0;
    list.hidden = invites.length === 0;
    list.innerHTML = invites.map(invite => {
      const steamId = digitsOnly(invite.steam_id64 || "");
      const name = String(invite.display_name || "").trim() || steamId;
      const control = canManage
        ? renderClanActionForm("withdraw_invite", steamId, name, "Withdraw", "btn-secondary", clan.tag)
        : "";

      return `<div class="clan-list-item"><span><strong>${escapeHtml(name)}</strong><code>${escapeHtml(steamId)}</code></span>${control}</div>`;
    }).join("");
  }

  function renderClanAllies(allies, invitedAllies) {
    const list = app.querySelector("[data-clan-allies]");
    const pending = app.querySelector("[data-clan-pending-allies]");

    if (list) {
      list.innerHTML = allies.length
        ? allies.map(ally => `<span class="tag">${escapeHtml(String(ally))}</span>`).join("")
        : '<span class="tag">No allies synced</span>';
    }

    if (pending) {
      pending.hidden = invitedAllies.length === 0;
      pending.textContent = invitedAllies.length ? `Pending ally invites: ${invitedAllies.join(", ")}` : "";
    }
  }

  function updateClanHistory(actions) {
    const list = app.querySelector("[data-clan-action-history]");
    const empty = app.querySelector("[data-clan-action-history-empty]");

    if (!list || !empty) return;

    const sorted = actions.slice().sort(sortClanActions);

    empty.hidden = sorted.length > 0;
    list.hidden = sorted.length === 0;
    list.innerHTML = sorted.map(renderClanActionItem).join("");
  }

  function renderClanActionForm(action, targetSteamId, targetDisplayName, label, buttonClass, clanTag) {
    return `<form class="clan-inline-form" method="post" action="${escapeAttr(window.location.pathname)}" data-clan-queue-form>
      <input type="hidden" name="form_action" value="queue_clan_action">
      <input type="hidden" name="csrf" value="${escapeAttr(getClanCsrfToken())}">
      <input type="hidden" name="action" value="${escapeAttr(action)}">
      <input type="hidden" name="clan_tag" value="${escapeAttr(clanTag || "")}">
      <input type="hidden" name="target_steam_id64" value="${escapeAttr(targetSteamId)}">
      <input type="hidden" name="target_display_name" value="${escapeAttr(targetDisplayName)}">
      <button class="btn ${escapeAttr(buttonClass)}" type="submit">${escapeHtml(label)}</button>
    </form>`;
  }

  function renderClanActionItem(action) {
    const status = action.status || "queued";
    const error = action.error_message || "";
    const meta = clanActionMeta(action);

    return `<div class="clan-list-item clan-queue-item" data-clan-action-id="${escapeAttr(action.id)}">
      <span>
        <strong>${escapeHtml(formatClanActionLabel(action.action_type || action.action))}</strong>
        <code>${escapeHtml(meta)}</code>
        ${error ? `<small>${escapeHtml(error)}</small>` : ""}
      </span>
      <span class="status-pill ${escapeAttr(status)}">${escapeHtml(status)}</span>
    </div>`;
  }

  function showClanResolution(state, action) {
    const stack = state.monitor.querySelector("[data-clan-resolution-stack]");

    if (!stack) return;

    const success = action.status === "succeeded";
    const item = document.createElement("div");
    const label = formatClanActionLabel(action.action_type || action.action);
    const target = clanActionMeta(action);
    const detail = success
      ? `${label} resolved for ${target}.`
      : `${label} failed${action.error_message ? `: ${action.error_message}` : "."}`;

    item.className = `form-status ${success ? "success" : "error"} clan-resolution`;
    item.textContent = detail;
    stack.prepend(item);
    showToast(detail);

    window.setTimeout(() => {
      item.classList.add("is-clearing");
    }, 4200);

    window.setTimeout(() => {
      item.remove();
    }, 4800);
  }

  function scheduleClanPoll(state, delay) {
    if (state.pollTimer) return;

    state.pollTimer = window.setTimeout(() => {
      state.pollTimer = null;
      pollClanState(state);
    }, delay);
  }

  function hasPendingClanWork(state) {
    if (Date.now() < state.refreshUntil) {
      return true;
    }

    return Array.from(state.actions.values()).some(isActiveClanAction)
      || Object.values(state.watched).some(action => !action.notified);
  }

  function normalizeClanAction(action) {
    const actionType = String(action.action_type || action.action || "").trim();
    const status = String(action.status || "queued").trim().toLowerCase();

    return {
      ...action,
      id: String(action.id || ""),
      action_type: actionType,
      action: actionType,
      status,
      clan_tag: String(action.clan_tag || ""),
      target_steam_id64: digitsOnly(action.target_steam_id64 || ""),
      target_display_name: String(action.target_display_name || "").trim(),
      error_message: String(action.error_message || action.error || "").trim(),
      created_at: String(action.created_at || ""),
      updated_at: String(action.updated_at || ""),
      completed_at: String(action.completed_at || ""),
      notified: Boolean(action.notified)
    };
  }

  function isActiveClanAction(action) {
    return action.status === "queued" || action.status === "processing";
  }

  function isTerminalClanAction(action) {
    return action.status === "succeeded" || action.status === "failed";
  }

  function sortClanActions(a, b) {
    return Number(b.id || 0) - Number(a.id || 0);
  }

  function clanActionMeta(action) {
    return action.target_display_name || action.target_steam_id64 || action.clan_tag || "clan";
  }

  function formatClanActionLabel(action) {
    const labels = {
      withdraw_invite: "Withdraw Invite"
    };

    if (labels[action]) {
      return labels[action];
    }

    return String(action || "Action")
      .replace(/_/g, " ")
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function setClanStat(name, value) {
    app.querySelectorAll(`[data-clan-stat="${name}"]`).forEach(item => {
      item.textContent = String(value);
    });
  }

  function getClanCsrfToken() {
    const input = app.querySelector('[data-clan-queue-form] [name="csrf"], .clan-action-form [name="csrf"]');

    return input ? input.value : "";
  }

  function formDataToObject(formData) {
    const payload = {};

    formData.forEach((value, key) => {
      payload[key] = String(value);
    });

    return payload;
  }

  async function readJsonResponse(response) {
    try {
      return await response.json();
    } catch (error) {
      return {
        ok: false,
        error: "The server returned an unreadable response."
      };
    }
  }

  function readJsonNode(id, fallback) {
    const node = document.getElementById(id);

    if (!node) return fallback;

    try {
      return JSON.parse(node.textContent || "{}");
    } catch (error) {
      return fallback;
    }
  }

  function loadClanWatchedActions() {
    try {
      const parsed = JSON.parse(window.sessionStorage.getItem("raidlands_clan_actions") || "{}");
      const now = Date.now();
      const watched = {};

      Object.entries(parsed).forEach(([id, action]) => {
        const normalized = normalizeClanAction(action);
        const updatedAt = Date.parse(normalized.updated_at || normalized.created_at || "");

        if (!normalized.id || (Number.isFinite(updatedAt) && now - updatedAt > 86400000)) {
          return;
        }

        watched[id] = normalized;
      });

      return watched;
    } catch (error) {
      return {};
    }
  }

  function saveClanWatchedActions(actions) {
    try {
      window.sessionStorage.setItem("raidlands_clan_actions", JSON.stringify(actions));
    } catch (error) {
      // Session storage is optional for the queue UI.
    }
  }

  function digitsOnly(value) {
    return String(value).replace(/\D+/g, "");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // Fall through to the selection-based path.
    }

    try {
      const input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      return copied;
    } catch (error) {
      return false;
    }
  }

  function initAnimationDiagnostics() {
    if (!animationDiagnosticsEnabled()) return;

    recordAnimationDiagnostic("site_script_ready", {
      documentReadyState: document.readyState,
      rootClassName: doc.className,
      appClassName: app.className,
      connection: animationConnectionDetails()
    });

    window.addEventListener("load", () => {
      recordAnimationDiagnostic("window_loaded", {
        rootClassName: doc.className,
        appClassName: app.className,
        performance: animationPerformanceSummary()
      });
    }, { once: true });

    window.addEventListener("error", event => {
      recordAnimationDiagnostic("animation_diagnostic_error", {
        message: event.message || "",
        source: event.filename || "",
        line: event.lineno || 0,
        column: event.colno || 0
      });
    });

    window.addEventListener("unhandledrejection", event => {
      const reason = event.reason || {};
      recordAnimationDiagnostic("animation_diagnostic_error", {
        message: reason.message || String(reason || "Unhandled promise rejection"),
        source: "unhandledrejection"
      });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushAnimationDiagnostics(true);
      }
    });
    window.addEventListener("pagehide", () => flushAnimationDiagnostics(true));
    flushAnimationDiagnosticsSoon();
  }

  function animationDiagnosticsConfig() {
    const globalConfig = window.__raidlandsAnimationDiagnostics || {};
    const config = {
      ...(CONFIG.animationDiagnostics || {}),
      ...globalConfig
    };

    if (!Array.isArray(config.queue)) {
      config.queue = [];
    }

    window.__raidlandsAnimationDiagnostics = config;

    return config;
  }

  function animationDiagnosticsEnabled() {
    const config = animationDiagnosticsConfig();

    return Boolean(config.enabled && config.endpointUrl);
  }

  function recordAnimationDiagnostic(eventType, details = {}) {
    if (!animationDiagnosticsEnabled()) return;

    try {
      if (typeof window.__raidlandsRecordAnimationDiagnostic === "function") {
        window.__raidlandsRecordAnimationDiagnostic(eventType, details);
      } else {
        const config = animationDiagnosticsConfig();
        config.queue.push(buildAnimationDiagnosticEvent(eventType, details));
      }

      flushAnimationDiagnosticsSoon();
    } catch (error) {
      // Diagnostics are best-effort and should never affect the site.
    }
  }

  function buildAnimationDiagnosticEvent(eventType, details) {
    return {
      eventType: String(eventType || ""),
      at: new Date().toISOString(),
      page: {
        id: pageId,
        url: window.location.href,
        referrer: document.referrer || ""
      },
      viewport: {
        width: window.innerWidth || 0,
        height: window.innerHeight || 0,
        devicePixelRatio: window.devicePixelRatio || 1,
        screenWidth: window.screen ? window.screen.width : 0,
        screenHeight: window.screen ? window.screen.height : 0
      },
      capabilities: animationCapabilities(),
      loader: window.__raidlandsLoaderSession || {},
      details: details || {}
    };
  }

  function animationCapabilities() {
    const capabilities = {
      matchMedia: typeof window.matchMedia === "function",
      reducedMotion: false,
      mobilePerformance: false,
      intersectionObserver: "IntersectionObserver" in window,
      requestAnimationFrame: "requestAnimationFrame" in window,
      requestIdleCallback: "requestIdleCallback" in window,
      cssSupportsAnimation: Boolean(window.CSS && CSS.supports && CSS.supports("animation-name", "raidlands-test")),
      localStorage: false,
      sessionStorage: false,
      cookiesEnabled: Boolean(navigator.cookieEnabled),
      saveData: Boolean(navigator.connection && navigator.connection.saveData)
    };

    try {
      capabilities.reducedMotion = capabilities.matchMedia && window.matchMedia(REDUCED_MOTION_QUERY).matches;
      capabilities.mobilePerformance = isMobilePerformanceMode();
    } catch (error) {
      capabilities.matchMedia = false;
    }

    try {
      window.localStorage.setItem("raidlands-diagnostic-test", "1");
      window.localStorage.removeItem("raidlands-diagnostic-test");
      capabilities.localStorage = true;
    } catch (error) {
      capabilities.localStorage = false;
    }

    try {
      window.sessionStorage.setItem("raidlands-diagnostic-test", "1");
      window.sessionStorage.removeItem("raidlands-diagnostic-test");
      capabilities.sessionStorage = true;
    } catch (error) {
      capabilities.sessionStorage = false;
    }

    return capabilities;
  }

  function animationConnectionDetails() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (!connection) {
      return {};
    }

    return {
      effectiveType: connection.effectiveType || "",
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0,
      saveData: Boolean(connection.saveData)
    };
  }

  function animationPerformanceSummary() {
    const navigation = performance && performance.getEntriesByType
      ? performance.getEntriesByType("navigation")[0]
      : null;

    if (!navigation) {
      return {};
    }

    return {
      type: navigation.type || "",
      domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd || 0),
      loadMs: Math.round(navigation.loadEventEnd || 0),
      transferSize: Math.round(navigation.transferSize || 0)
    };
  }

  function flushAnimationDiagnosticsSoon() {
    window.clearTimeout(animationDiagnosticFlushTimer);
    animationDiagnosticFlushTimer = window.setTimeout(() => flushAnimationDiagnostics(false), 350);
  }

  function flushAnimationDiagnostics(useBeacon) {
    const config = animationDiagnosticsConfig();
    const queue = Array.isArray(config.queue) ? config.queue : [];
    const maxEvents = Math.max(1, Number(config.maxEvents) || 24);

    if (!config.enabled || !config.endpointUrl || !queue.length || animationDiagnosticInFlight) {
      return;
    }

    const events = queue.splice(0, maxEvents);
    const body = JSON.stringify({
      csrf: config.csrfToken || "",
      events
    });

    if (useBeacon && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });

      if (navigator.sendBeacon(config.endpointUrl, blob)) {
        return;
      }
    }

    if (!window.fetch) {
      queue.unshift(...events);
      return;
    }

    animationDiagnosticInFlight = true;
    fetch(config.endpointUrl, {
      method: "POST",
      credentials: "same-origin",
      keepalive: useBeacon,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "fetch",
        "X-Raidlands-CSRF": config.csrfToken || ""
      },
      body
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Animation diagnostics failed with HTTP ${response.status}.`);
        }
      })
      .catch(() => {
        queue.unshift(...events);

        if (queue.length > maxEvents) {
          queue.splice(maxEvents);
        }
      })
      .finally(() => {
        animationDiagnosticInFlight = false;
      });
  }

  function track(name) {
    try {
      const key = "raidlands_metrics";
      const events = JSON.parse(window.localStorage.getItem(key) || "[]");
      events.push({ name, at: new Date().toISOString(), page: pageId });
      window.localStorage.setItem(key, JSON.stringify(events.slice(-100)));
    } catch (error) {
      console.info("Raidlands metric:", name);
    }
  }

  function showToast(message) {
    const toast = app.querySelector("[data-toast]");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function hydrateDates() {
    const next = getNextWipeDate();
    const last = getPreviousWipeDate();
    const nextText = formatDate(next);
    const lastText = formatDate(last);

    app.querySelectorAll("[data-next-wipe]").forEach(item => {
      item.textContent = nextText;
    });

    app.querySelectorAll("[data-last-wipe]").forEach(item => {
      item.textContent = lastText;
    });
  }

  async function hydrateServerStatus() {
    if (!hydrateServerStatus.usedLoaderProbe && window.__raidlandsServerStatusPromise) {
      hydrateServerStatus.usedLoaderProbe = true;

      try {
        const initialStatus = await window.__raidlandsServerStatusPromise;

        if (initialStatus) {
          applyServerStatus(initialStatus);
          return;
        }
      } catch (error) {
        console.info("Raidlands loader status could not be reused.", error);
      }
    }

    if (!window.fetch || !CONFIG.serverStatusUrl) return;

    try {
      const response = await fetch(CONFIG.serverStatusUrl, {
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Status request failed with ${response.status}.`);
      }

      applyServerStatus(await response.json());
    } catch (error) {
      console.info("Raidlands live server status could not be loaded.", error);
    }
  }

  function applyServerStatus(status) {
    if (!status) return;

    applyWipeSignal(status);

    const panel = app.querySelector("[data-server-status-panel]");
    if (!panel) return;

    const online = status.online === true;
    panel.classList.toggle("is-online", online);
    panel.classList.toggle("is-offline", status.online === false);
    panel.classList.toggle("is-stale", status.stale === true);

    setPanelText("[data-server-status]", status.statusLabel || (online ? "Online" : "Offline"));
    setPanelText("[data-server-players]", statValue(status.players, "0"));
    setPanelText("[data-server-max-players]", statValue(status.maxPlayers, "0"));
    setPanelText("[data-server-queue]", statValue(status.queue, "0"));
    setPanelText("[data-server-health]", serverHealthLabel(status));
    setPanelText("[data-server-map]", statValue(status.mapName, "Unknown"));
    setPanelText("[data-server-updated]", formatServerUpdated(status));
  }

  function setPanelText(selector, value) {
    app.querySelectorAll(selector).forEach(item => {
      item.textContent = value;
    });
  }

  function statValue(value, fallback) {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }

    return String(value);
  }

  function formatServerUpdated(status) {
    const timestamp = status.updatedAt || status.fetchedAt;
    const source = serverStatusSourceLabel(status);

    if (!timestamp) {
      return source;
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return source;
    }

    return `${source} ${formatDateTime(date)}`;
  }

  function serverStatusSourceLabel(status) {
    if (status && status.sourceLabel) {
      return String(status.sourceLabel);
    }

    if (status && status.source === "raidlands") {
      return status.stale ? "Raidlands delayed" : "Raidlands live";
    }

    if (status && status.source === "fallback") {
      return "site fallback";
    }

    return "site fallback";
  }

  function serverHealthLabel(status) {
    if (!status) {
      return "Pending";
    }

    if (status.stale === true) {
      return "Delayed";
    }

    if (status.source === "fallback") {
      return "Fallback";
    }

    if (status.online === true) {
      return "Ready";
    }

    if (status.online === false) {
      return "Offline";
    }

    return status.statusLabel || "Pending";
  }

  function bindServerHistoryControls() {
    const panel = app.querySelector("[data-server-history]");

    if (!panel) return;

    const buttons = Array.from(panel.querySelectorAll("[data-server-history-range]"));
    const active = buttons.find(button => button.getAttribute("aria-pressed") === "true") || buttons[0];

    if (active) {
      serverHistoryRange = active.getAttribute("data-server-history-range") || serverHistoryRange;
    }

    panel.dataset.historyRange = serverHistoryRange;

    buttons.forEach(button => {
      button.addEventListener("click", () => {
        const nextRange = button.getAttribute("data-server-history-range") || "6h";

        if (nextRange === serverHistoryRange) return;

        serverHistoryRange = nextRange;
        panel.dataset.historyRange = nextRange;
        buttons.forEach(candidate => {
          candidate.setAttribute("aria-pressed", candidate === button ? "true" : "false");
        });
        hydrateServerHistory();
      });
    });
  }

  async function hydrateServerHistory() {
    const panel = app.querySelector("[data-server-history]");

    if (!panel || !window.fetch || !CONFIG.serverStatusHistoryUrl) return;

    try {
      const url = new URL(CONFIG.serverStatusHistoryUrl, window.location.href);
      url.searchParams.set("range", serverHistoryRange || "6h");

      const response = await fetch(url.toString(), {
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`History request failed with ${response.status}.`);
      }

      applyServerHistory(await response.json());
    } catch (error) {
      console.info("Raidlands server history could not be loaded.", error);
      applyServerHistory({
        ok: false,
        samples: [],
        range: serverHistoryRange,
        rangeLabel: historyFallbackRangeLabel(serverHistoryRange),
        windowMinutes: 360,
        error: "Server history is waiting for live heartbeat samples."
      });
    }
  }

  function applyServerHistory(payload) {
    const panel = app.querySelector("[data-server-history]");

    if (!panel) return;

    const samples = Array.isArray(payload && payload.samples) ? payload.samples : [];
    const empty = panel.querySelector("[data-server-history-empty]");
    serverHistoryPayload = {
      ...(payload || {}),
      samples
    };

    panel.classList.toggle("is-empty", samples.length === 0);

    if (empty) {
      empty.hidden = samples.length > 0;
      empty.textContent = payload && payload.error ? payload.error : "Waiting for live heartbeat samples.";
    }

    setPanelText("[data-history-window]", historyWindowLabel(payload));
    setPanelText("[data-history-uptime]", payload && payload.uptimePercent !== null && payload.uptimePercent !== undefined ? `${payload.uptimePercent}%` : "Waiting");
    setPanelText("[data-history-peak]", statValue(payload && payload.peakPlayers, "0"));
    setPanelText("[data-history-average]", payload && payload.averagePlayers !== null && payload.averagePlayers !== undefined ? String(payload.averagePlayers) : "0");
    setPanelText("[data-history-downtime]", statValue(payload && payload.downtimeCount, "0"));
    setPanelText("[data-history-samples]", String(payload && payload.pointCount !== undefined ? payload.pointCount : samples.length));
    setPanelText("[data-history-sample-label]", historyPointLabel(payload));
    drawServerHistoryChart(serverHistoryPayload);
  }

  function historyWindowLabel(payload) {
    if (payload && payload.rangeLabel) {
      return String(payload.rangeLabel);
    }

    return formatHistoryWindow(payload && payload.windowMinutes);
  }

  function formatHistoryWindow(minutes) {
    const value = Math.max(30, Number(minutes) || 360);

    if (value >= 1440) {
      return "24 hours";
    }

    if (value >= 60) {
      const hours = value / 60;
      return Number.isInteger(hours) ? `${hours} hours` : `${value} minutes`;
    }

    return `${value} minutes`;
  }

  function historyPointLabel(payload) {
    const granularity = payload && payload.granularity;

    if (granularity === "hour") {
      return "hourly points";
    }

    if (granularity === "day") {
      return "daily points";
    }

    return "samples";
  }

  function historyFallbackRangeLabel(range) {
    if (range === "24h") return "24 hours";
    if (range === "30d") return "30 days";
    if (range === "12mo") return "12 months";
    return "6 hours";
  }

  function historyChartMetricValue(value) {
    const number = Number(value);

    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function historyChartAxisMax(samples) {
    const maxValue = samples.reduce((max, sample) => Math.max(
      max,
      historyChartMetricValue(sample.players),
      historyChartMetricValue(sample.peakPlayers),
      historyChartMetricValue(sample.queue)
    ), 0);

    if (maxValue <= 0) {
      return 1;
    }

    if (maxValue < 8) {
      return Math.ceil(maxValue) + 1;
    }

    const roughTick = (maxValue * 1.15) / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughTick)));
    const normalized = roughTick / magnitude;
    const tickSteps = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
    const niceTick = tickSteps.find(step => normalized <= step) || 10;

    return Math.max(1, Math.ceil(niceTick * magnitude * 4));
  }

  function drawServerHistoryChart(payload) {
    const panel = app.querySelector("[data-server-history]");
    const canvas = panel ? panel.querySelector("[data-server-history-chart]") : null;

    if (!panel || !canvas || !payload || !Array.isArray(payload.samples)) return;

    const realSamples = payload.samples;
    const bounds = historyChartBounds(payload);
    const samples = buildServerHistoryChartSamples(realSamples, bounds);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width || 0));
    const height = Math.max(220, Math.floor(rect.height || 0));
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const pad = { top: 20, right: 18, bottom: 38, left: 42 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom - 18;
    const plotBottom = pad.top + plotHeight;
    const statusTop = plotBottom + 12;
    const statusHeight = 8;

    drawChartGrid(ctx, width, height, pad, plotBottom, plotHeight);

    if (samples.length === 0) {
      ctx.fillStyle = "rgba(243, 238, 227, .62)";
      ctx.font = "700 13px Inter, Arial, sans-serif";
      ctx.fillText("Waiting for live heartbeat samples", pad.left, pad.top + 24);
      return;
    }

    const maxPopulation = historyChartAxisMax(samples);
    const xFor = sample => {
      const span = Math.max(1, bounds.end - bounds.start);
      const offset = Math.max(0, Math.min(span, (Number(sample.__chartTime) || bounds.start) - bounds.start));

      return pad.left + (plotWidth * offset) / span;
    };
    const yFor = value => plotBottom - (Math.max(0, Number(value) || 0) / maxPopulation) * plotHeight;

    samples.forEach((sample, index) => {
      const nextX = index < samples.length - 1 ? xFor(samples[index + 1]) : pad.left + plotWidth;
      const x = xFor(sample);
      const segmentWidth = Math.max(2, nextX - x);
      ctx.fillStyle = sample.online === true
        ? "rgba(124, 255, 107, .72)"
        : sample.online === false
          ? "rgba(255, 107, 95, .72)"
          : "rgba(255, 209, 102, .65)";
      ctx.fillRect(x, statusTop, segmentWidth, statusHeight);
    });

    drawHistoryArea(ctx, samples, xFor, yFor, plotBottom, "players", "rgba(255, 138, 40, .18)", "rgba(255, 138, 40, .95)");
    drawHistoryLine(ctx, samples, xFor, yFor, "queue", "rgba(255, 209, 102, .92)", 2);

    const firstTime = sampleDate({ time: new Date(bounds.start).toISOString() }, payload.granularity);
    const lastTime = sampleDate({ time: new Date(bounds.end).toISOString() }, payload.granularity);
    ctx.fillStyle = "rgba(243, 238, 227, .62)";
    ctx.font = "700 11px Inter, Arial, sans-serif";
    ctx.fillText(firstTime, pad.left, height - 10);
    ctx.textAlign = "right";
    ctx.fillText(lastTime, width - pad.right, height - 10);
    ctx.textAlign = "left";

    ctx.fillStyle = "rgba(243, 238, 227, .5)";
    ctx.fillText(String(maxPopulation), 8, pad.top + 4);
    ctx.fillText("0", 18, plotBottom + 4);
  }

  function drawChartGrid(ctx, width, height, pad, plotBottom, plotHeight) {
    ctx.fillStyle = "rgba(0, 0, 0, .2)";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(243, 238, 227, .11)";
    ctx.lineWidth = 1;

    for (let index = 0; index <= 4; index += 1) {
      const y = plotBottom - (plotHeight * index) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
    }
  }

  function historyChartBounds(payload) {
    let end = parseHistoryTimestamp(payload && payload.windowEnd);

    if (!Number.isFinite(end)) {
      end = Date.now();
    }

    const minutes = Math.max(30, Number(payload && payload.windowMinutes) || 360);
    let start = parseHistoryTimestamp(payload && payload.windowStart);

    if (!Number.isFinite(start) || start >= end) {
      start = end - minutes * 60 * 1000;
    }

    return { start, end };
  }

  function buildServerHistoryChartSamples(samples, bounds) {
    const normalized = samples
      .map(sample => {
        const time = historySampleTime(sample);

        if (!Number.isFinite(time)) {
          return null;
        }

        return {
          ...sample,
          __chartTime: Math.max(bounds.start, Math.min(bounds.end, time))
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.__chartTime - right.__chartTime);

    if (normalized.length === 0) {
      return [];
    }

    const first = normalized[0];

    if (first.__chartTime > bounds.start + 1000) {
      const startZero = serverHistoryZeroSample(first, bounds.start);
      const beforeFirstZero = serverHistoryZeroSample(first, first.__chartTime);
      normalized.unshift(beforeFirstZero);
      normalized.unshift(startZero);
    }

    const last = normalized[normalized.length - 1];

    if (last.__chartTime < bounds.end - 1000) {
      normalized.push({
        ...last,
        time: new Date(bounds.end).toISOString(),
        generatedAt: new Date(bounds.end).toISOString(),
        __chartTime: bounds.end,
        __synthetic: true
      });
    }

    return normalized;
  }

  function serverHistoryZeroSample(sample, time) {
    return {
      ...sample,
      time: new Date(time).toISOString(),
      generatedAt: new Date(time).toISOString(),
      online: null,
      players: 0,
      peakPlayers: 0,
      queue: 0,
      joining: 0,
      sleepers: 0,
      __chartTime: time,
      __synthetic: true
    };
  }

  function historySampleTime(sample) {
    return parseHistoryTimestamp(sample && (sample.time || sample.generatedAt || sample.bucket));
  }

  function parseHistoryTimestamp(value) {
    if (!value) {
      return Number.NaN;
    }

    const timestamp = new Date(value).getTime();

    return Number.isFinite(timestamp) ? timestamp : Number.NaN;
  }

  function drawHistoryArea(ctx, samples, xFor, yFor, plotBottom, key, fill, stroke) {
    ctx.beginPath();
    samples.forEach((sample, index) => {
      const x = xFor(sample);
      const y = yFor(sample[key]);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.lineTo(xFor(samples[samples.length - 1]), plotBottom);
    ctx.lineTo(xFor(samples[0]), plotBottom);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    drawHistoryLine(ctx, samples, xFor, yFor, key, stroke, 2.5);
  }

  function drawHistoryLine(ctx, samples, xFor, yFor, key, stroke, width) {
    ctx.beginPath();
    samples.forEach((sample, index) => {
      const x = xFor(sample);
      const y = yFor(sample[key]);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function sampleDate(sample, granularity) {
    const value = sample && (sample.time || sample.generatedAt);
    const date = value ? new Date(value) : null;

    if (!date || Number.isNaN(date.getTime())) {
      return "";
    }

    if (granularity === "day") {
      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric"
      });
    }

    if (granularity === "hour") {
      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        hour: "numeric"
      });
    }

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function updateCountdowns() {
    const next = getNextWipeDate();
    const now = new Date();
    const distance = next.getTime() - now.getTime();
    const overdue = distance < 0;
    const magnitude = Math.abs(distance);
    const values = {
      days: Math.floor(magnitude / 86400000),
      hours: Math.floor((magnitude % 86400000) / 3600000),
      minutes: Math.floor((magnitude % 3600000) / 60000),
      seconds: Math.floor((magnitude % 60000) / 1000)
    };

    Object.entries(values).forEach(([key, value]) => {
      app.querySelectorAll(`[data-count-${key}]`).forEach(item => {
        const formatted = String(value).padStart(2, "0");
        item.textContent = key === "days" && overdue ? `-${formatted}` : formatted;
      });
    });

    app.querySelectorAll("[data-countdown]").forEach(item => {
      item.classList.toggle("is-overdue", overdue);
      item.dataset.countdownState = overdue ? "awaiting-server-wipe" : "scheduled";
    });
  }

  function getNextWipeDate(now = new Date()) {
    if (latestWipeSignal) {
      const signalDate = latestWipeSignal.startedAt;
      const firstScheduledAfterSignal = findScheduledWipeAfter(signalDate);

      // A wipe signal shortly before the configured time belongs to that
      // window. Skip that occurrence so the countdown starts a fresh cycle.
      if (firstScheduledAfterSignal.getTime() - signalDate.getTime() <= 86400000) {
        return findScheduledWipeAfter(new Date(firstScheduledAfterSignal.getTime() + 1000));
      }

      return firstScheduledAfterSignal;
    }

    return findScheduledWipeAfter(now);
  }

  function findScheduledWipeAfter(reference) {
    const schedule = getWipeSchedule();
    const zoneNow = getTimeZoneDateParts(reference, schedule.timeZone);

    for (let offset = 0; offset < 21; offset += 1) {
      const localDate = getPlainDateOffset(zoneNow, offset);

      if (!schedule.days.has(localDate.weekday)) {
        continue;
      }

      const candidate = zonedDateToDate(
        localDate.year,
        localDate.month,
        localDate.day,
        schedule.hour,
        schedule.minute,
        schedule.timeZone
      );

      if (candidate > reference) {
        return candidate;
      }
    }

    return new Date(reference.getTime() + 86400000);
  }

  function getPreviousWipeDate(now = new Date()) {
    if (latestWipeSignal) {
      return new Date(latestWipeSignal.startedAt.getTime());
    }

    const schedule = getWipeSchedule();
    const zoneNow = getTimeZoneDateParts(now, schedule.timeZone);

    for (let offset = 0; offset < 14; offset += 1) {
      const localDate = getPlainDateOffset(zoneNow, -offset);

      if (!schedule.days.has(localDate.weekday)) {
        continue;
      }

      const candidate = zonedDateToDate(
        localDate.year,
        localDate.month,
        localDate.day,
        schedule.hour,
        schedule.minute,
        schedule.timeZone
      );

      if (candidate < now) {
        return candidate;
      }
    }

    return now;
  }

  function normalizeWipeSignal(signal) {
    if (!signal || typeof signal !== "object") {
      return null;
    }

    const rawStartedAt = signal.startedAt || signal.wipeStartedAt || signal.lastWipe || "";
    const startedAt = rawStartedAt ? new Date(rawStartedAt) : null;

    if (!startedAt || Number.isNaN(startedAt.getTime())) {
      return null;
    }

    return {
      key: String(signal.key || signal.wipeKey || "").trim(),
      startedAt
    };
  }

  function applyWipeSignal(status) {
    const signal = normalizeWipeSignal({
      key: status.wipeKey || (status.mapImage && status.mapImage.wipeKey) || "",
      startedAt: status.wipeStartedAt || status.lastWipe || ""
    });

    if (!signal) {
      return;
    }

    if (latestWipeSignal && signal.startedAt.getTime() < latestWipeSignal.startedAt.getTime()) {
      return;
    }

    const changed = !latestWipeSignal
      || signal.key !== latestWipeSignal.key
      || signal.startedAt.getTime() !== latestWipeSignal.startedAt.getTime();

    latestWipeSignal = signal;

    if (changed) {
      hydrateDates();
      updateCountdowns();
    }
  }

  function getWipeSchedule() {
    const [rawHour, rawMinute] = String(CONFIG.wipe.time || "19:00").split(":").map(Number);
    const days = Array.isArray(CONFIG.wipe.days) ? CONFIG.wipe.days : [4];
    const daySet = new Set(days
      .map(day => Number(day))
      .filter(day => Number.isInteger(day) && day >= 0 && day <= 6));

    if (!daySet.size) {
      daySet.add(4);
    }

    return {
      days: daySet,
      hour: Number.isFinite(rawHour) ? Math.max(0, Math.min(23, rawHour)) : 19,
      minute: Number.isFinite(rawMinute) ? Math.max(0, Math.min(59, rawMinute)) : 0,
      timeZone: getWipeTimeZone()
    };
  }

  function getWipeTimeZone() {
    if (resolvedWipeTimeZone !== null) {
      return resolvedWipeTimeZone;
    }

    const configured = String(CONFIG.wipe.timezone || "Europe/London").trim() || "Europe/London";

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: configured }).format(new Date());
      resolvedWipeTimeZone = configured;
    } catch (error) {
      resolvedWipeTimeZone = "UTC";
    }

    return resolvedWipeTimeZone;
  }

  function getPlainDateOffset(parts, offset) {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + offset));

    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth(),
      day: date.getUTCDate(),
      weekday: date.getUTCDay()
    };
  }

  function zonedDateToDate(year, month, day, hour, minute, timeZone) {
    const targetUtc = Date.UTC(year, month, day, hour, minute, 0, 0);
    let date = new Date(targetUtc);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = getTimeZoneDateParts(date, timeZone);
      const zonedUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
      const offset = zonedUtc - targetUtc;

      date = new Date(date.getTime() - offset);
    }

    return date;
  }

  function getTimeZoneDateParts(date, timeZone) {
    const parts = {};

    getTimeZonePartsFormatter(timeZone).formatToParts(date).forEach(part => {
      if (part.type !== "literal") {
        parts[part.type] = Number(part.value);
      }
    });

    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second || 0
    };
  }

  function getTimeZonePartsFormatter(timeZone) {
    if (!timeZonePartFormatters.has(timeZone)) {
      timeZonePartFormatters.set(timeZone, new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }));
    }

    return timeZonePartFormatters.get(timeZone);
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: getWipeTimeZone(),
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    }).format(date);
  }

  function formatDateTime(date) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  init();
})();
