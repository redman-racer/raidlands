(() => {
  const doc = document.documentElement;
  const app = document.getElementById("raidlands-app");

  if (!app) return;

  const pageId = doc.dataset.page || "home";
  const CONFIG = getSiteConfig();
  const MOBILE_PERFORMANCE_QUERY = "(max-width: 700px), (pointer: coarse)";
  let serverHistoryPayload = null;
  let serverHistoryRange = "6h";
  let serverHistoryResizeTimer = null;

  function getSiteConfig() {
    const basePath = doc.dataset.base || "./";
    const defaults = {
      connectCommand: "connect raidlands.net:25607",
      steamConnectUrl: "steam://connect/raidlands.net:25607",
      discordInviteUrl: "https://discord.gg/raidlands",
      serverStatusUrl: `${basePath}api/server-status.php`,
      serverStatusHistoryUrl: `${basePath}api/server-status-history.php`,
      serverStats: {
        provider: "raidlands",
        cacheSeconds: 60,
        staleSeconds: 90
      },
      wipe: {
        days: [4],
        dayNames: ["Thursday"],
        time: "19:00",
        timezone: "America/Chicago"
      },
      auth: {
        steamUrl: "",
        discordUrl: ""
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
    bindNav();
    bindActions();
    initRpGames();
    initClanManagement();
    initLeaderboards();
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

  function initEffectsWhenLoaderReveals() {
    let started = false;
    const start = () => {
      if (started) return;

      started = true;
      initEffects();
    };

    if (!doc.classList.contains("raidlands-loading")) {
      start();
      return;
    }

    window.addEventListener("raidlands:site-reveal", start, { once: true });
    window.setTimeout(start, 9000);
  }

  function initEffects() {
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobilePerformance = isMobilePerformanceMode();

    doc.classList.toggle("mobile-performance-mode", mobilePerformance);
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

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(start, { timeout: 1200 });
      return;
    }

    window.setTimeout(start, 600);
  }

  function createEmberField() {
    const shell = app.querySelector(".app-shell") || (app.classList.contains("app-shell") ? app : null);
    if (!shell || shell.querySelector(".ambient-effects")) return;

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
      elements.forEach(element => markRevealVisible(element, true));
      return;
    }

    doc.classList.add("motion-ready");

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
    if (!toggle) return;

    toggle.addEventListener("click", () => {
      const open = !document.body.classList.contains("nav-open");
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
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
      submitRpGameForm(root, form);
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

  async function submitRpGameForm(root, form) {
    const panel = form.closest("[data-rp-game-panel]");
    const submitter = form.querySelector('[type="submit"]');

    panel?.classList.add("is-spinning");
    form.classList.add("is-submitting");

    if (submitter) {
      submitter.disabled = true;
      submitter.dataset.originalText = submitter.textContent || "";
      submitter.textContent = "Queuing...";
    }

    try {
      const actionUrl = form.getAttribute("action") || window.location.href;
      const response = await fetch(actionUrl, {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "fetch"
        }
      });
      const payload = await readJsonResponse(response);

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || payload.error || `RP game request failed with HTTP ${response.status}.`);
      }

      showRpGamesFlash(root, payload.type || "success", payload.message || "RP game queued.");
      applyRpGamesState(payload.state || {});
      showToast(payload.message || "RP game queued.");
      track(`rp_game_${form.dataset.rpGameForm || "play"}_queued`);
    } catch (error) {
      const message = error && error.message ? error.message : "RP game could not be queued.";
      showRpGamesFlash(root, "error", message);
      showToast(message);
    } finally {
      window.setTimeout(() => {
        panel?.classList.remove("is-spinning");
      }, 520);
      form.classList.remove("is-submitting");

      if (submitter) {
        submitter.disabled = false;
        submitter.textContent = submitter.dataset.originalText || "Submit";
      }
    }
  }

  function showRpGamesFlash(root, type, message) {
    const flash = root.querySelector("[data-rp-games-flash]");

    if (!flash) return;

    flash.hidden = false;
    flash.className = `form-status ${type === "error" ? "error" : "success"}`;
    flash.textContent = message;
  }

  function applyRpGamesState(state) {
    if (!state || typeof state !== "object") return;

    const balance = state.balance && typeof state.balance === "object" ? state.balance : {};
    const daily = state.daily && typeof state.daily === "object" ? state.daily : {};
    setPanelText('[data-rp-stat="balance"]', formatRp(balance.reward_points));
    setPanelText('[data-rp-stat="wagered"]', formatRp(daily.wagered_rp));
    setPanelText('[data-rp-stat="loss"]', formatRp(daily.loss_rp));
    applyRpJackpotState(state.active_jackpot || null);
    renderRpGameRounds(Array.isArray(state.game_rounds) ? state.game_rounds : []);
    renderRpJackpotEntries(Array.isArray(state.jackpot_entries) ? state.jackpot_entries : []);
    updateRpHistoryEmpty(state);
  }

  function applyRpJackpotState(jackpot) {
    if (!jackpot || typeof jackpot !== "object") return;

    setPanelText('[data-rp-jackpot="ticket"]', formatRp(jackpot.ticket_cost_rp));
    setPanelText('[data-rp-jackpot="entries"]', String(Number(jackpot.total_entries) || 0));
    setPanelText('[data-rp-jackpot="pot"]', formatRp(jackpot.pot_rp));
    setPanelText('[data-rp-jackpot="closes"]', `Closes ${jackpot.closes_at || ""} UTC. Only confirmed entries count.`);
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
        <tr>
          <td>${escapeHtml(rpGameLabel(gameType))}</td>
          <td>${escapeHtml(formatRp(round.stake_rp))}</td>
          <td>${escapeHtml(round.roll_result || "")}</td>
          <td>${escapeHtml(formatRp(round.payout_rp))}</td>
          <td><span class="status-pill ${escapeAttr(status)}">${escapeHtml(status)}</span></td>
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
          <td><span class="status-pill ${escapeAttr(status)}">${escapeHtml(status)}</span></td>
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
    empty.hidden = rounds.length > 0 || entries.length > 0 || jackpots.length > 0;
  }

  function rpGameLabel(gameType) {
    const labels = {
      coinflip: "Coinflip",
      dice: "Dice",
      high_low: "High-Low",
      wheel: "Wheel"
    };

    if (labels[gameType]) {
      return labels[gameType];
    }

    return String(gameType || "Game").replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
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

          panel.dataset.scope = scope.getAttribute("data-leaderboard-scope") || "current";
          panel.dataset.page = "1";
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
    panel.dataset.scope = normalizeLeaderboardScope(formData.get("scope"));
    panel.dataset.metric = normalizeLeaderboardMetric(panel.dataset.board, formData.get("metric"));
    panel.dataset.search = String(formData.get("q") || "").trim();
    panel.dataset.perPage = normalizeLeaderboardPageSize(formData.get("per_page"));
    panel.dataset.page = "1";
    syncLeaderboardSharedState(root, panel);
    loadLeaderboardPanel(root, panel, true);
  }

  function leaderboardPanel(root, board) {
    return root.querySelector(`[data-leaderboard-panel][data-board="${board === "bots" ? "bots" : "players"}"]`);
  }

  function activateLeaderboardBoard(root, board, updateUrl) {
    const activeBoard = board === "bots" ? "bots" : "players";

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
    panel.dataset.scope = normalizeLeaderboardScope(params.get("scope"));
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
    panel.dataset.metric = normalizeLeaderboardMetric(panel.dataset.board, payload.metric);
    panel.dataset.search = String(payload.search || "");
    panel.dataset.page = normalizeLeaderboardPage(payload.page);
    panel.dataset.perPage = normalizeLeaderboardPageSize(payload.per_page);
    panel.dataset.total = String(Math.max(0, Number(payload.total) || 0));
    panel.dataset.pages = normalizeLeaderboardPage(payload.pages);
    renderLeaderboardRows(panel, rows);
    updateLeaderboardControls(root);
  }

  function renderLeaderboardRows(panel, rows) {
    const body = panel.querySelector("[data-leaderboard-rows]");
    const tableWrap = panel.querySelector("[data-leaderboard-table-wrap]");
    const empty = panel.querySelector("[data-leaderboard-empty]");

    if (body) {
      body.innerHTML = rows.map(row => (
        panel.dataset.board === "bots" ? renderBotLeaderboardRow(row) : renderPlayerLeaderboardRow(row)
      )).join("");
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
      <td>${formatLeaderboardDuration(row.playtime_seconds)}</td>
      <td>${formatLeaderboardNumber(row.reward_points)}</td>
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
      const board = tab.getAttribute("data-leaderboard-tab") === "bots" ? "bots" : "players";
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

    url.searchParams.set("board", board);
    url.searchParams.set("scope", scope);
    url.searchParams.set("metric", metric);
    url.searchParams.set("page", page);
    url.searchParams.set("per_page", perPage);

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
    return scope === "all-time" ? "all-time" : "current";
  }

  function normalizeLeaderboardMetric(board, metric) {
    const value = String(metric || "");

    if (board === "bots") {
      return ["kdr", "kills", "deaths"].includes(value) ? value : "kdr";
    }

    return ["kills", "kdr", "playtime", "rp", "npc_kills", "deaths_by_npc"].includes(value) ? value : "kills";
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
    const panel = app.querySelector("[data-server-status-panel]");
    if (!panel || !status) return;

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
    const distance = Math.max(0, next.getTime() - now.getTime());
    const values = {
      days: Math.floor(distance / 86400000),
      hours: Math.floor((distance % 86400000) / 3600000),
      minutes: Math.floor((distance % 3600000) / 60000),
      seconds: Math.floor((distance % 60000) / 1000)
    };

    Object.entries(values).forEach(([key, value]) => {
      app.querySelectorAll(`[data-count-${key}]`).forEach(item => {
        item.textContent = String(value).padStart(2, "0");
      });
    });
  }

  function getNextWipeDate(now = new Date()) {
    const [hour, minute] = CONFIG.wipe.time.split(":").map(Number);

    for (let offset = 0; offset < 14; offset += 1) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + offset);
      candidate.setHours(hour, minute, 0, 0);

      if (CONFIG.wipe.days.includes(candidate.getDay()) && candidate > now) {
        return candidate;
      }
    }

    return new Date(now.getTime() + 86400000);
  }

  function getPreviousWipeDate(now = new Date()) {
    const [hour, minute] = CONFIG.wipe.time.split(":").map(Number);

    for (let offset = 0; offset < 14; offset += 1) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() - offset);
      candidate.setHours(hour, minute, 0, 0);

      if (CONFIG.wipe.days.includes(candidate.getDay()) && candidate < now) {
        return candidate;
      }
    }

    return now;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
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
