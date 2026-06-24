(() => {
  const doc = document.documentElement;
  const app = document.getElementById("raidlands-app");

  if (!app) return;

  const pageId = doc.dataset.page || "home";
  const CONFIG = getSiteConfig();

  function getSiteConfig() {
    const defaults = {
      connectCommand: "connect play.raidlands.gg:28015",
      steamConnectUrl: "steam://connect/play.raidlands.gg:28015",
      discordInviteUrl: "https://discord.gg/raidlands",
      wipe: {
        days: [1, 5],
        dayNames: ["Monday", "Friday"],
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
    updateCountdowns();
    window.setInterval(updateCountdowns, 1000);
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

        showToast(`${provider === "steam" ? "Steam" : "Discord"} OAuth credentials are not configured yet.`);
      });
    });

    app.querySelectorAll("[data-unlink-provider]").forEach(button => {
      button.addEventListener("click", () => {
        const provider = button.dataset.unlinkProvider;
        track(`${provider}_unlink_clicked`);
        showToast(`${provider === "steam" ? "Steam" : "Discord"} is not linked on this device.`);
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

  init();
})();
