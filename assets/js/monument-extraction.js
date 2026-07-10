(() => {
  "use strict";

  const root = document.querySelector("[data-monument-extraction]");

  if (!root || !window.fetch) return;

  const panel = root.closest("[data-rp-game-panel]");
  const apiUrl = root.dataset.apiUrl || "";
  const csrf = root.dataset.csrf || "";
  const bootstrapNode = root.querySelector("[data-monument-bootstrap]");
  let state = parseJson(bootstrapNode?.textContent || "{}") || {};
  let run = state.activeRun || null;
  let requestPending = false;
  let pollTimer = 0;

  const refs = {
    status: root.querySelector("[data-monument-status]"),
    landing: root.querySelector("[data-monument-landing]"),
    startForm: root.querySelector("[data-monument-start-form]"),
    run: root.querySelector("[data-monument-run]"),
    resources: root.querySelector("[data-monument-resources]"),
    readiness: root.querySelector("[data-monument-readiness]"),
    slots: root.querySelector("[data-monument-slots]"),
    inventory: root.querySelector("[data-monument-inventory]"),
    map: root.querySelector("[data-monument-map]"),
    decision: root.querySelector("[data-monument-decision]"),
    turn: root.querySelector("[data-monument-turn]"),
    log: root.querySelector("[data-monument-log]"),
    history: root.querySelector("[data-monument-history]"),
    refresh: root.querySelector("[data-monument-refresh]")
  };

  refs.startForm?.addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(refs.startForm);

    submitAction({
      action: "start",
      wagerRp: Number(form.get("wager_rp") || 0),
      loadoutKey: String(form.get("loadout_key") || "")
    }, refs.startForm.querySelector('[type="submit"]'));
  });

  refs.refresh?.addEventListener("click", () => refreshBootstrap(true));

  root.addEventListener("click", event => {
    const button = event.target.closest("button[data-monument-action]");

    if (!(button instanceof HTMLButtonElement) || button.disabled || requestPending) return;

    const action = button.dataset.monumentAction || "";
    const payload = { action, runId: Number(run?.id || 0) };

    if (action === "enter_room") {
      payload.roomId = button.dataset.roomId || "";
    } else if (action === "resolve_encounter") {
      payload.approachKey = button.dataset.approachKey || "";
    } else if (action === "loot_decision") {
      payload.decision = button.dataset.decision || "";
      payload.discardItemIds = payload.decision === "take"
        ? Array.from(root.querySelectorAll('[data-monument-replace]:checked')).map(input => input.value)
        : [];
    } else if (action === "inventory_action") {
      payload.inventoryAction = button.dataset.inventoryAction || "";
      payload.itemId = button.dataset.itemId || "";
      payload.enabled = button.dataset.enabled === "1";
    } else if (action === "extract") {
      payload.methodKey = button.dataset.methodKey || "";

      if (!window.confirm(`Attempt ${button.dataset.methodLabel || "this extraction"}? Failure forfeits the entire unsecured haul.`)) return;
    } else if (action === "abandon") {
      if (!window.confirm("Abandon this run and forfeit all unsecured loot?")) return;
    } else if (action === "new_run") {
      run = null;
      render();
      refreshBootstrap(false);
      return;
    } else {
      return;
    }

    submitAction(payload, button);
  });

  root.addEventListener("change", event => {
    const input = event.target;

    if (!(input instanceof HTMLInputElement) || !input.matches("[data-monument-auto-armor]")) return;

    submitAction({
      action: "inventory_action",
      runId: Number(run?.id || 0),
      inventoryAction: "toggle_auto_armor",
      enabled: input.checked
    }, input);
  });

  root.addEventListener("click", event => {
    const button = event.target.closest("button[data-monument-audit]");

    if (!(button instanceof HTMLButtonElement)) return;

    showAudit(button.dataset.monumentAudit || "");
  });

  async function submitAction(payload, trigger) {
    if (requestPending) return;

    requestPending = true;
    setLocked(true);
    const original = trigger instanceof HTMLButtonElement ? trigger.textContent : "";

    if (trigger instanceof HTMLButtonElement) trigger.textContent = "Syncing...";

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf
        },
        body: JSON.stringify({ ...payload, clientActionId: actionId() })
      });
      const data = await readJson(response);

      if (!response.ok || !data.ok) {
        throw new Error(data.message || `Monument request failed with HTTP ${response.status}.`);
      }

      const previousStatus = run?.status || "";
      run = data.run || run;
      render();
      showActionResult(data.result || {}, previousStatus);

      if (run?.status === "CREATING") schedulePoll();

      if (run?.terminal) {
        window.setTimeout(() => refreshHistory(), 500);
      }
    } catch (error) {
      showStatus("error", error?.message || "Monument Extraction could not process that action.");
    } finally {
      requestPending = false;
      setLocked(false);

      if (trigger instanceof HTMLButtonElement) trigger.textContent = original;
    }
  }

  async function refreshBootstrap(announce) {
    try {
      const response = await fetch(`${apiUrl}?action=bootstrap`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      const data = await readJson(response);

      if (!response.ok || !data.ok) throw new Error(data.message || "Could not refresh Monument Extraction.");

      state = data.state || {};
      run = state.activeRun || null;
      render();

      if (announce) showStatus("success", "Monument Extraction state refreshed.");
    } catch (error) {
      showStatus("error", error?.message || "Could not refresh Monument Extraction.");
    }
  }

  async function refreshRun() {
    if (!run?.id) return;

    try {
      const response = await fetch(`${apiUrl}?action=run&runId=${encodeURIComponent(run.id)}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      const data = await readJson(response);

      if (!response.ok || !data.ok) throw new Error(data.message || "Could not recover the active run.");

      run = data.run || run;
      render();

      if (run?.status === "CREATING") schedulePoll();
    } catch (error) {
      showStatus("error", error?.message || "Could not recover the active run.");
    }
  }

  async function refreshHistory() {
    try {
      const response = await fetch(`${apiUrl}?action=history`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      const data = await readJson(response);

      if (response.ok && data.ok) {
        state.history = Array.isArray(data.history) ? data.history : [];
        renderHistory();
      }
    } catch (_) {
      // The active run remains usable if history refresh fails.
    }
  }

  function schedulePoll() {
    window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(refreshRun, 2200);
  }

  function render() {
    const active = Boolean(run);

    if (refs.landing) refs.landing.hidden = active;
    if (refs.run) refs.run.hidden = !active;

    if (active) renderRun();
    renderHistory();
  }

  function renderRun() {
    if (!run) return;

    if (run.status === "CREATING") {
      refs.resources.innerHTML = resourcePill("Wager", formatRp(run.wagerRp), "wager")
        + resourcePill("Loadout", title(run.loadoutKey), "loadout")
        + resourcePill("Status", "Confirming debit", "sync");
      refs.readiness.innerHTML = `<p class="section-kicker">Server sync</p><strong>Wager confirmation pending</strong><p>${esc(run.message || "Waiting for the Rust server.")}</p><code>${esc(shortHash(run.seedCommitment))}</code>`;
      refs.map.innerHTML = `<div class="monument-waiting"><span class="monument-pulse"></span><strong>Generating committed route</strong><p>The map opens after the exact one-time wager debit is confirmed.</p></div>`;
      refs.decision.innerHTML = `<div class="form-status warning">Keep this page open or return later. Refresh recovery will resume this same run.</div>`;
      refs.inventory.innerHTML = empty("No inventory until entry is confirmed.");
      refs.slots.textContent = "0 slots";
      refs.turn.textContent = "Turn 0";
      refs.log.innerHTML = "";
      return;
    }

    const r = run.resources || {};
    refs.resources.innerHTML = [
      resourcePill("Health", `${number(r.health)}/100`, healthClass(r.health)),
      resourcePill("Ammo", number(r.ammo), "ammo"),
      resourcePill("Meds", number(r.syringes), "meds"),
      resourcePill("Armor", number(r.armor), "armor"),
      resourcePill("Alert", `${number(r.alert)}/10`, alertClass(r.alert)),
      resourcePill("Intel", `${number(r.intel)}/3`, "intel"),
      resourcePill("Unsecured", multiplier(run.carriedMultiplierBps), "loot")
    ].join("");

    renderReadiness();
    renderInventory();
    renderMap();
    renderDecision();
    renderLog();
  }

  function renderReadiness() {
    const routes = Array.isArray(run.extractions) ? run.extractions : [];
    refs.readiness.innerHTML = `<div class="monument-card-head"><strong>Extraction readiness</strong><span>${multiplier(run.carriedMultiplierBps)} carried</span></div>`
      + routes.map(route => `
        <div class="monument-route-status ${route.available ? "is-ready" : ""}">
          <span><strong>${esc(route.label)}</strong><small>${route.available ? `${percent(route.chanceBps)} success` : esc(route.reason || "Locked")}</small></span>
          <em>${modifier(route.modifierBps)}</em>
        </div>
      `).join("")
      + `<label class="monument-auto-armor"><input type="checkbox" data-monument-auto-armor ${run.resources?.autoUseArmor ? "checked" : ""} ${run.terminal ? "disabled" : ""}> Auto-use armor on damage</label>`;
  }

  function renderInventory() {
    const items = Array.isArray(run.inventory) ? run.inventory : [];
    refs.slots.textContent = `${number(run.inventorySlotsUsed)}/${number(run.inventoryCapacity)} slots`;

    if (!items.length) {
      refs.inventory.innerHTML = empty("No carried items.");
      return;
    }

    refs.inventory.innerHTML = items.map(item => {
      const consumable = item.category === "CONSUMABLE";
      return `<article class="monument-item rarity-${esc(item.rarity)}">
        <span><strong>${esc(item.label)}</strong><small>${esc(item.category.replace(/_/g, " "))} / ${number(item.slots)} slot${number(item.slots) === 1 ? "" : "s"}</small></span>
        <em>${item.valueBps ? multiplier(item.valueBps) : esc(item.rarity)}</em>
        ${run.terminal ? "" : `<div class="monument-item-actions">
          ${consumable ? `<button type="button" data-monument-action="inventory_action" data-inventory-action="use_item" data-item-id="${esc(item.id)}">Use</button>` : ""}
          <button type="button" data-monument-action="inventory_action" data-inventory-action="discard" data-item-id="${esc(item.id)}">Discard</button>
        </div>`}
      </article>`;
    }).join("");
  }

  function renderMap() {
    const rooms = Array.isArray(run.map?.rooms) ? run.map.rooms : [];
    const grouped = new Map();

    rooms.forEach(room => {
      const depth = number(room.depth);
      if (!grouped.has(depth)) grouped.set(depth, []);
      grouped.get(depth).push(room);
    });

    refs.map.innerHTML = `<div class="monument-map-head"><span><strong>Monument route</strong><small>Only connected highlighted rooms can be entered.</small></span><code>${esc(shortHash(run.seedCommitment))}</code></div>`
      + Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]).map(([depth, layer]) => `
        <div class="monument-map-layer">
          <span class="monument-depth">D${depth}</span>
          <div>${layer.map(room => mapRoom(room)).join("")}</div>
        </div>
      `).join("");
  }

  function mapRoom(room) {
    const canEnter = room.adjacent && run.status === "AWAITING_ROOM_SELECTION" && !room.resolved && !room.blocked;
    const classes = ["monument-room", room.current ? "is-current" : "", room.adjacent ? "is-adjacent" : "", room.visited ? "is-visited" : "", room.blocked ? "is-blocked" : ""].filter(Boolean).join(" ");
    const content = `<span><strong>${esc(room.label)}</strong><small>${esc(room.danger)} / ${esc(room.rewardHint)}</small></span>`;

    return canEnter
      ? `<button class="${classes}" type="button" data-monument-action="enter_room" data-room-id="${esc(room.id)}">${content}<em>Enter</em></button>`
      : `<div class="${classes}">${content}${room.current ? "<em>Current</em>" : ""}</div>`;
  }

  function renderDecision() {
    const status = run.status || "";
    const current = run.currentRoom || {};

    if (run.terminal) {
      const won = status === "COMPLETED";
      refs.decision.innerHTML = `<div class="monument-terminal ${won ? "win" : "loss"}">
        <p class="section-kicker">Run ${won ? "secured" : "lost"}</p>
        <h3>${won ? "Extraction complete" : title(status)}</h3>
        <strong>${won ? formatRp(run.payoutRp) : `-${formatRp(run.wagerRp)}`}</strong>
        <p>${won ? `${multiplier(run.payoutMultiplierBps)} total return through ${title(run.eventLog?.at(-1)?.type || "extraction")}. ${payoutMessage(run.payoutStatus)}` : failureMessage(run.failureReason)}</p>
        <div class="monument-terminal-actions">
          <button class="btn btn-primary" type="button" data-monument-action="new_run">Plan another run</button>
          <button class="btn btn-secondary" type="button" data-monument-audit="${esc(run.id)}">Verify fairness</button>
        </div>
      </div>`;
      return;
    }

    if (status === "AWAITING_ENCOUNTER_ACTION") {
      const encounter = run.encounter || {};
      refs.decision.innerHTML = `<div class="monument-decision-head"><span><p class="section-kicker">${esc(current.label || "Current room")}</p><h3>${esc(encounter.name || "Encounter")}</h3><p>${esc(encounter.description || "")}</p></span><em>${esc(encounter.danger || current.danger || "Unknown")}</em></div>
        <div class="monument-approaches">${(encounter.approaches || []).map(approach => `
          <button type="button" data-monument-action="resolve_encounter" data-approach-key="${esc(approach.key)}" ${approach.available ? "" : "disabled"}>
            <span><strong>${esc(approach.label)}</strong><small>${number(approach.ammoCost)} ammo / +${number(approach.successAlert)} alert on success</small></span>
            <em>${percent(approach.chanceBps)}</em>
          </button>
        `).join("")}</div>`;
      return;
    }

    if (status === "AWAITING_LOOT_DECISION") {
      const loot = run.pendingLoot || {};
      const free = number(run.inventoryCapacity) - number(run.inventorySlotsUsed);
      const needs = Math.max(0, number(loot.slots) - free);
      refs.decision.innerHTML = `<div class="monument-decision-head"><span><p class="section-kicker">Loot decision</p><h3>${esc(loot.label || "Recovered item")}</h3><p>${esc(loot.category || "")} / ${number(loot.slots)} slot${number(loot.slots) === 1 ? "" : "s"}${loot.valueBps ? ` / ${multiplier(loot.valueBps)} return` : ""}</p></span><em>${esc(loot.rarity || "")}</em></div>
        ${needs > 0 ? `<div class="form-status warning">Free ${needs} more slot${needs === 1 ? "" : "s"} by selecting carried items to replace.</div><div class="monument-replace-list">${(run.inventory || []).map(item => `<label><input type="checkbox" value="${esc(item.id)}" data-monument-replace> <span>${esc(item.label)} <small>${number(item.slots)} slot${number(item.slots) === 1 ? "" : "s"}</small></span></label>`).join("")}</div>` : ""}
        <div class="monument-decision-actions">
          <button class="btn btn-primary" type="button" data-monument-action="loot_decision" data-decision="take">Take item</button>
          <button class="btn btn-secondary" type="button" data-monument-action="loot_decision" data-decision="leave">Leave it</button>
        </div>`;
      return;
    }

    const routes = (run.extractions || []).filter(route => route.available);
    const rooms = (run.map?.rooms || []).filter(room => room.adjacent && !room.resolved && !room.blocked);
    refs.decision.innerHTML = `<div class="monument-decision-head"><span><p class="section-kicker">Route decision</p><h3>${status === "AWAITING_EXTRACTION_DECISION" ? "Lockdown: extract now" : `Move from ${esc(current.label || "this room")}`}</h3><p>${status === "AWAITING_EXTRACTION_DECISION" ? "Alert reached maximum. No deeper room action is legal." : `${rooms.length} connected route${rooms.length === 1 ? "" : "s"} available.`}</p></span><em>Turn ${number(run.turn)}</em></div>
      <div class="monument-between-actions">
        <button type="button" data-monument-action="inventory_action" data-inventory-action="use_syringe" ${number(run.resources?.syringes) <= 0 || number(run.resources?.health) >= 100 ? "disabled" : ""}>Use syringe <span>+35 HP</span></button>
        <button type="button" class="is-danger" data-monument-action="abandon">Abandon <span>forfeit loot</span></button>
      </div>
      <div class="monument-extract-actions">${routes.map(route => `
        <button type="button" data-monument-action="extract" data-method-key="${esc(route.key)}" data-method-label="${esc(route.label)}">
          <span><strong>${esc(route.label)}</strong><small>${esc(route.description)}</small></span>
          <em>${percent(route.chanceBps)}</em>
        </button>
      `).join("") || `<p class="store-muted">No extraction route is ready yet. Choose a connected room on the map.</p>`}</div>`;
  }

  function renderLog() {
    refs.turn.textContent = `Turn ${number(run.turn)}`;
    const entries = Array.isArray(run.eventLog) ? run.eventLog.slice().reverse() : [];
    refs.log.innerHTML = entries.map(entry => `<li><span>${number(entry.turn)}</span><p>${esc(entry.message)}</p></li>`).join("");
  }

  function renderHistory() {
    if (!refs.history) return;

    const history = Array.isArray(state.history) ? state.history : [];

    if (!history.length) {
      refs.history.innerHTML = empty("No Monument Extraction runs recorded yet.");
      return;
    }

    refs.history.innerHTML = history.map(item => `<article class="monument-history-row">
      <span><strong>#${esc(item.id)} / ${esc(title(item.loadoutKey))}</strong><small>${esc(item.startedAt || "")} / ${esc(title(item.status))}</small></span>
      <em>${formatRp(item.wagerRp)} wager</em>
      <strong class="${item.status === "COMPLETED" ? "is-win" : "is-loss"}">${item.status === "COMPLETED" ? formatRp(item.payoutRp) : "0 RP"}</strong>
      ${item.auditAvailable ? `<button type="button" data-monument-audit="${esc(item.id)}">Audit</button>` : "<small>Active</small>"}
    </article>`).join("");
  }

  async function showAudit(runId) {
    if (!runId) return;

    try {
      const response = await fetch(`${apiUrl}?action=audit&runId=${encodeURIComponent(runId)}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      const data = await readJson(response);

      if (!response.ok || !data.ok) throw new Error(data.message || "Could not load the fairness audit.");

      const audit = data.audit || {};
      const dialog = ensureAuditDialog();
      const body = dialog.querySelector("[data-monument-audit-body]");

      if (!audit.revealed) {
        body.innerHTML = `<p>This run is active. The server seed stays hidden until the run is terminal.</p><code>${esc(audit.seedCommitment || "")}</code>`;
      } else {
        const fairness = audit.fairness || {};
        body.innerHTML = `<div class="monument-audit-summary">
            <span><strong>Commitment</strong><code>${esc(audit.seedCommitment || "")}</code></span>
            <span><strong>Revealed seed</strong><code>${esc(fairness.serverSeed || "")}</code></span>
            <span><strong>Verification</strong><em class="${fairness.commitmentMatches && fairness.drawsVerify ? "is-win" : "is-loss"}">${fairness.commitmentMatches && fairness.drawsVerify ? "Commitment and draws verified" : "Verification failed"}</em></span>
          </div>
          <div class="monument-audit-draws">${(fairness.draws || []).map(draw => `<span><code>#${number(draw.counter)}</code><strong>${esc(draw.purpose)}</strong><em>${number(draw.value)} in ${number(draw.min)}-${number(draw.max)}</em></span>`).join("")}</div>`;
      }

      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } catch (error) {
      showStatus("error", error?.message || "Could not load the fairness audit.");
    }
  }

  function ensureAuditDialog() {
    let dialog = document.querySelector("[data-monument-audit-dialog]");

    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.className = "monument-audit-dialog";
    dialog.dataset.monumentAuditDialog = "";
    dialog.innerHTML = `<div class="monument-card-head"><div><p class="section-kicker">Provably reproducible</p><h3>Run fairness audit</h3></div><button type="button" data-monument-audit-close aria-label="Close audit">×</button></div><div data-monument-audit-body></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector("[data-monument-audit-close]").addEventListener("click", () => dialog.close ? dialog.close() : dialog.removeAttribute("open"));
    dialog.addEventListener("click", event => {
      if (event.target === dialog && dialog.close) dialog.close();
    });

    return dialog;
  }

  function showActionResult(result, previousStatus) {
    if (!result || !Object.keys(result).length) return;

    if (result.type === "resolve_encounter") {
      showCasinoResult(Boolean(result.success), result.success ? "Encounter Cleared" : "Hit Taken", result.success ? "Route secured" : `-${number(result.damage)} HP`, `${percent(result.chanceBps)} chance / roll ${number(result.roll)}`);
    } else if (result.type === "extract") {
      showCasinoResult(Boolean(result.success), result.success ? "You Extracted" : "Extraction Failed", result.success ? formatRp(result.payoutRp) : `-${formatRp(result.stakeRp)}`, `${result.methodLabel || "Extraction"} / roll ${number(result.roll)}`);
    } else if (previousStatus === "CREATING" && run?.status !== "CREATING") {
      showCasinoResult(true, "Wager Confirmed", formatRp(run.wagerRp), "The committed monument route is open.");
    }
  }

  function showCasinoResult(win, titleText, amount, detail) {
    if (!panel) return;

    let overlay = panel.querySelector("[data-monument-result]");

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.dataset.monumentResult = "";
      overlay.setAttribute("role", "status");
      overlay.setAttribute("aria-live", "polite");
      panel.appendChild(overlay);
    }

    overlay.className = `rp-game-result ${win ? "win" : "loss"} is-visible`;
    overlay.hidden = false;
    overlay.innerHTML = `<div class="rp-game-result-inner"><span>${win ? "Server confirmed" : "Server resolved"}</span><strong>${esc(titleText)}</strong><em>${esc(amount)}</em><small>${esc(detail)}</small></div>`;
    panel.classList.toggle("result-win", win);
    panel.classList.toggle("result-loss", !win);
    window.clearTimeout(Number(panel.dataset.monumentResultTimer || 0));
    panel.dataset.monumentResultTimer = String(window.setTimeout(() => {
      overlay.classList.add("is-hiding");
      window.setTimeout(() => {
        overlay.hidden = true;
        overlay.className = "rp-game-result";
      }, 300);
    }, 3600));
  }

  function showStatus(type, message) {
    if (!refs.status) return;

    refs.status.hidden = false;
    refs.status.className = `form-status ${type === "error" ? "error" : type === "success" ? "success" : "warning"}`;
    refs.status.textContent = message;
  }

  function setLocked(locked) {
    root.classList.toggle("is-submitting", locked);
    root.querySelectorAll("button, input, select").forEach(control => {
      if (!(control instanceof HTMLElement) || !("disabled" in control)) return;

      if (locked) {
        control.dataset.monumentWasDisabled = control.disabled ? "1" : "0";
        control.disabled = true;
      } else if (control.dataset.monumentWasDisabled !== undefined) {
        control.disabled = control.dataset.monumentWasDisabled === "1";
        delete control.dataset.monumentWasDisabled;
      }
    });
  }

  function resourcePill(label, value, className) {
    return `<span class="${esc(className)}"><small>${esc(label)}</small><strong>${esc(String(value))}</strong></span>`;
  }

  function payoutMessage(status) {
    if (status === "confirmed") return "Payout confirmed by the Rust server.";
    if (status === "no_payout") return "No payout was generated from the carried haul.";
    if (status === "failed") return "The payout request needs admin review.";
    return "Payout is queued for Rust server confirmation.";
  }

  function failureMessage(reason) {
    const messages = {
      ENCOUNTER_DEATH: "An encounter reduced health to zero. Unsecured loot was forfeited.",
      EXTRACTION_DEATH: "The extraction failed. Unsecured loot was forfeited.",
      PLAYER_ABANDONED: "The run was abandoned and unsecured loot was forfeited.",
      RUN_EXPIRED: "The run expired after inactivity and unsecured loot was forfeited.",
      ADMIN_EXPIRED: "An authorized admin expired this run without a payout."
    };

    return messages[reason] || "The run ended without securing a payout.";
  }

  function modifier(bps) {
    const value = number(bps) / 10000;
    if (value === 1) return "No fee";
    return value > 1 ? `+${Math.round((value - 1) * 100)}%` : `-${Math.round((1 - value) * 100)}%`;
  }

  function percent(bps) {
    return `${(number(bps) / 100).toFixed(number(bps) % 100 ? 2 : 0)}%`;
  }

  function multiplier(bps) {
    return `${(number(bps) / 10000).toFixed(2)}×`;
  }

  function formatRp(value) {
    return `${number(value).toLocaleString("en-US")} RP`;
  }

  function number(value) {
    return Math.round(Number(value) || 0);
  }

  function title(value) {
    return String(value || "").replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
  }

  function shortHash(value) {
    const hash = String(value || "");
    return hash ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : "Commitment pending";
  }

  function healthClass(value) {
    return number(value) <= 30 ? "danger" : "health";
  }

  function alertClass(value) {
    return number(value) >= 7 ? "danger" : number(value) >= 4 ? "warning" : "alert";
  }

  function empty(message) {
    return `<p class="store-muted monument-empty">${esc(message)}</p>`;
  }

  function actionId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    window.crypto?.getRandomValues?.(bytes);
    return `act-${Date.now().toString(36)}-${Array.from(bytes).map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
  }

  function parseJson(value) {
    try {
      return JSON.parse(value);
    } catch (_) {
      return null;
    }
  }

  async function readJson(response) {
    const text = await response.text();
    const parsed = parseJson(text);

    if (!parsed) throw new Error("Monument Extraction returned an invalid response.");
    return parsed;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  render();

  if (run?.status === "CREATING") schedulePoll();
})();
