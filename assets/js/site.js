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
    initClanManagement();
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
