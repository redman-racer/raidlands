(() => {
  const doc = document.documentElement;
  const app = document.getElementById("raidlands-app");

  if (!app) return;

  const pageId = doc.dataset.page || "home";
  const CONFIG = getSiteConfig();

  function getSiteConfig() {
    const basePath = doc.dataset.base || "./";
    const defaults = {
      connectCommand: "connect raidlands.net:25607",
      steamConnectUrl: "steam://connect/raidlands.net:25607",
      discordInviteUrl: "https://discord.gg/raidlands",
      serverStatusUrl: `${basePath}api/server-status.php`,
      serverStats: {
        provider: "battlemetrics",
        battleMetricsServerId: "",
        cacheSeconds: 60
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
    initEffects();
    hydrateDates();
    hydrateServerStatus();
    updateCountdowns();
    window.setInterval(updateCountdowns, 1000);

    if (window.fetch && CONFIG.serverStatusUrl) {
      const refreshSeconds = Math.max(30, Number(CONFIG.serverStats.cacheSeconds) || 60);
      window.setInterval(hydrateServerStatus, refreshSeconds * 1000);
    }
  }

  function initEffects() {
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    initCardGlareTiming(reducedMotion);
    initScrollReveals(reducedMotion);

    if (!reducedMotion) {
      queueEmberField();
    }
  }

  function initCardGlareTiming(reducedMotion) {
    if (reducedMotion) return;

    app.querySelectorAll(".metal-card, .metal-panel, .route-card").forEach(panel => {
      const duration = randomBetween(10.5, 18.5);
      panel.style.setProperty("--surface-glare-duration", `${duration.toFixed(2)}s`);
      panel.style.setProperty("--surface-glare-delay", `${randomBetween(-duration, 0).toFixed(2)}s`);
      panel.style.setProperty("--surface-glare-opacity", randomBetween(.24, .44).toFixed(2));
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
    const particleCount = window.innerWidth < 640 ? 20 : 40;
    const particles = document.createDocumentFragment();

    field.className = "ambient-effects";
    field.setAttribute("aria-hidden", "true");

    for (let index = 0; index < particleCount; index += 1) {
      const particle = document.createElement("span");
      const isAsh = index % 7 === 0;
      const size = isAsh ? randomBetween(1.5, 3.5) : randomBetween(2, 6);
      const duration = isAsh ? randomBetween(22, 36) : randomBetween(16, 30);

      particle.className = `ember-particle ${isAsh ? "is-ash" : "is-spark"}`;
      particle.style.setProperty("--x", `${randomBetween(-4, 104).toFixed(2)}%`);
      particle.style.setProperty("--drift", `${randomBetween(-96, 96).toFixed(2)}px`);
      particle.style.setProperty("--size", `${size.toFixed(2)}px`);
      particle.style.setProperty("--duration", `${duration.toFixed(2)}s`);
      particle.style.setProperty("--delay", `${randomBetween(-duration, 0).toFixed(2)}s`);
      particle.style.setProperty("--opacity", randomBetween(.18, .56).toFixed(2));
      particle.style.setProperty("--blur", `${randomBetween(0, 1.4).toFixed(2)}px`);
      particle.style.setProperty("--pulse", `${randomBetween(2.2, 5.4).toFixed(2)}s`);
      particles.appendChild(particle);
    }

    field.appendChild(particles);
    shell.prepend(field);
  }

  function initScrollReveals(reducedMotion) {
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
        element.style.setProperty("--reveal-delay", `${Math.min(index * 55, 360)}ms`);
        elements.push(element);
      });
    });

    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach(element => element.classList.add("is-visible"));
      return;
    }

    doc.classList.add("motion-ready");

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, {
      rootMargin: "0px 0px -12% 0px",
      threshold: .12
    });

    window.requestAnimationFrame(() => {
      elements.forEach(element => observer.observe(element));
    });
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
    setPanelText("[data-server-fps]", statValue(status.serverFps, "Unknown"));
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

    if (!timestamp) {
      return status.source === "battlemetrics" ? "BattleMetrics live" : "Fallback values";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return status.source === "battlemetrics" ? "BattleMetrics live" : "Fallback values";
    }

    const source = status.source === "battlemetrics" ? "BattleMetrics" : "Fallback";
    const stale = status.stale ? "stale " : "";

    return `${source} ${stale}${formatDateTime(date)}`;
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
