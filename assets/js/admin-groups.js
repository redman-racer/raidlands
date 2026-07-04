(() => {
  const groupEditors = document.querySelectorAll("[data-admin-group-editor]");
  const workbenches = document.querySelectorAll("[data-permission-workbench]");

  if (!groupEditors.length && !workbenches.length) {
    return;
  }

  const toArray = nodes => Array.prototype.slice.call(nodes || []);
  const itemInput = item => item.querySelector('input[type="checkbox"]');
  let guardModal = null;
  let guardModalAction = null;
  let guardModalReturnFocus = null;

  function ensureGuardModal() {
    if (guardModal) {
      return guardModal;
    }

    guardModal = document.createElement("div");
    guardModal.className = "admin-guard-modal";
    guardModal.hidden = true;
    guardModal.innerHTML = [
      '<div class="admin-guard-modal-backdrop" data-guard-close></div>',
      '<section class="admin-guard-modal-panel" role="dialog" aria-modal="true" aria-labelledby="admin-guard-modal-title">',
      '<header class="admin-guard-modal-head">',
      '<div><p class="section-kicker">Group state</p><h3 id="admin-guard-modal-title" data-guard-title>Group locked</h3></div>',
      '<button class="btn btn-ghost" type="button" data-guard-close>Close</button>',
      '</header>',
      '<div class="admin-guard-modal-body">',
      '<p data-guard-message></p>',
      '</div>',
      '<footer class="admin-guard-modal-actions">',
      '<button class="btn btn-secondary" type="button" data-guard-close>Cancel</button>',
      '<button class="btn btn-primary" type="button" data-guard-open hidden>Open group</button>',
      '</footer>',
      '</section>'
    ].join("");

    guardModal.addEventListener("click", event => {
      if (event.target.closest("[data-guard-close]")) {
        closeGuardModal();
        return;
      }

      if (event.target.closest("[data-guard-open]")) {
        const action = guardModalAction;
        closeGuardModal();

        if (action) {
          action();
        }
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && guardModal && !guardModal.hidden) {
        closeGuardModal();
      }
    });

    document.body.appendChild(guardModal);
    return guardModal;
  }

  function openGuardModal(source, action) {
    const modal = ensureGuardModal();
    const title = source.getAttribute("data-guard-title") || "Group locked";
    const message = source.getAttribute("data-guard-message") || "This selection is guarded and cannot be changed from this control.";
    const openLabel = source.getAttribute("data-guard-open-label") || "Open group";
    const openButton = modal.querySelector("[data-guard-open]");
    const closeButton = modal.querySelector("[data-guard-close]");
    const titleNode = modal.querySelector("[data-guard-title]");
    const messageNode = modal.querySelector("[data-guard-message]");

    guardModalAction = action || null;
    guardModalReturnFocus = source;

    if (titleNode) {
      titleNode.textContent = title;
    }

    if (messageNode) {
      messageNode.textContent = message;
    }

    if (openButton) {
      openButton.hidden = !guardModalAction;
      openButton.textContent = openLabel;
    }

    modal.hidden = false;
    document.body.classList.add("has-admin-guard-modal");

    if (closeButton) {
      closeButton.focus();
    }
  }

  function closeGuardModal() {
    if (!guardModal) {
      return;
    }

    guardModal.hidden = true;
    guardModalAction = null;
    document.body.classList.remove("has-admin-guard-modal");

    if (guardModalReturnFocus && typeof guardModalReturnFocus.focus === "function") {
      guardModalReturnFocus.focus();
    }

    guardModalReturnFocus = null;
  }

  function initGroupEditor(editor) {
    const panels = toArray(editor.querySelectorAll("[data-group-panel]"));
    const selectors = toArray(editor.querySelectorAll("[data-group-select]"));
    const addButton = editor.querySelector("[data-group-add]");
    const activePanel = panels.find(panel => panel.classList.contains("is-active")) || panels[0];
    let activeIndex = activePanel ? activePanel.getAttribute("data-group-index") || "0" : "0";

    function selectorByIndex(index) {
      return selectors.find(selector => selector.getAttribute("data-group-index") === String(index));
    }

    function activateGroup(index) {
      activeIndex = String(index);

      panels.forEach(panel => {
        const isActive = panel.getAttribute("data-group-index") === activeIndex;

        panel.hidden = !isActive;
        panel.classList.toggle("is-active", isActive);
      });

      selectors.forEach(selector => {
        const isActive = selector.getAttribute("data-group-index") === activeIndex;

        selector.classList.toggle("is-active", isActive);

        if (isActive) {
          selector.setAttribute("aria-current", "true");
        } else {
          selector.removeAttribute("aria-current");
        }
      });
    }

    function activateDraftGroup() {
      const draftPanel = panels.find(panel => {
        const idInput = panel.querySelector('input[name$="[id]"]');

        return idInput && !idInput.value;
      }) || panels[panels.length - 1];

      if (!draftPanel) {
        return;
      }

      activateGroup(draftPanel.getAttribute("data-group-index") || "0");

      const nameInput = draftPanel.querySelector("[data-group-name-input]");

      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    }

    function updateGroupTitle(input) {
      const panel = input.closest("[data-group-panel]");

      if (!panel) {
        return;
      }

      const title = input.value.trim() || "New Group";
      const heading = panel.querySelector("[data-group-card-title]");
      const selector = selectorByIndex(panel.getAttribute("data-group-index"));

      if (heading) {
        heading.textContent = title;
      }

      if (selector) {
        const label = selector.querySelector("[data-group-select-label]");

        if (label) {
          label.textContent = title;
        }
      }
    }

    selectors.forEach(selector => {
      selector.addEventListener("click", () => {
        const guarded = selector.hasAttribute("data-guard-title") || selector.hasAttribute("data-guard-message");
        const index = selector.getAttribute("data-group-index") || "0";

        if (guarded) {
          openGuardModal(selector, () => activateGroup(index));
          return;
        }

        activateGroup(index);
      });
    });

    panels.forEach(panel => {
      toArray(panel.querySelectorAll("[data-group-name-input]")).forEach(input => {
        input.addEventListener("input", () => updateGroupTitle(input));
      });
    });

    if (addButton) {
      addButton.addEventListener("click", activateDraftGroup);
    }

    activateGroup(activeIndex);
  }

  function activeTabPrefix(workbench) {
    const prefixSelect = workbench.querySelector("[data-permission-prefix-select]");

    if (prefixSelect && prefixSelect.value) {
      return prefixSelect.value;
    }

    const active = workbench.querySelector("[data-permission-tab].is-active");
    const first = workbench.querySelector("[data-permission-tab]");
    const tab = active || first;

    return tab ? tab.getAttribute("data-tab-prefix") || "" : "";
  }

  function selectOptionByPrefix(select, prefix) {
    if (!select) {
      return null;
    }

    return toArray(select.options).find(option => option.value === prefix) || null;
  }

  function choiceLabel(choice, prefix) {
    if (!choice) {
      return prefix || "Permission category";
    }

    return choice.getAttribute("data-choice-label") || choice.textContent.replace(/\s+-\s+.*$/, "").trim() || prefix;
  }

  function updatePrefixSummary(workbench, prefix) {
    const label = workbench.querySelector("[data-permission-active-label]");
    const meta = workbench.querySelector("[data-permission-active-meta]");
    const select = workbench.querySelector("[data-permission-prefix-select]");
    const option = selectOptionByPrefix(select, prefix);
    const prefixPanel = toArray(workbench.querySelectorAll("[data-permission-prefix]")).find(panel => {
      return (panel.getAttribute("data-prefix") || "") === prefix;
    });
    const prefixLabel = prefixPanel ? prefixPanel.getAttribute("data-prefix-label") || "" : choiceLabel(option, prefix);
    const count = prefixPanel ? prefixPanel.querySelector("[data-prefix-count]") : null;

    if (label) {
      label.textContent = prefixLabel || prefix || "Permission category";
    }

    if (meta) {
      meta.textContent = [prefix, count ? count.textContent : ""].filter(Boolean).join(" / ");
    }
  }

  function activateTab(workbench, prefix) {
    const tabs = toArray(workbench.querySelectorAll("[data-permission-tab]"));
    const prefixSelect = workbench.querySelector("[data-permission-prefix-select]");
    const selectOptions = prefixSelect ? toArray(prefixSelect.options) : [];
    const prefixes = toArray(workbench.querySelectorAll("[data-permission-prefix]"));
    const hasRequestedTab = tabs.some(tab => (tab.getAttribute("data-tab-prefix") || "") === prefix)
      || selectOptions.some(option => option.value === prefix);

    if ((!prefix || !hasRequestedTab) && tabs.length) {
      prefix = tabs[0].getAttribute("data-tab-prefix") || "";
    } else if ((!prefix || !hasRequestedTab) && selectOptions.length) {
      prefix = selectOptions[0].value || "";
    }

    if (prefixSelect && prefixSelect.value !== prefix && selectOptionByPrefix(prefixSelect, prefix)) {
      prefixSelect.value = prefix;
    }

    tabs.forEach(tab => {
      const isActive = (tab.getAttribute("data-tab-prefix") || "") === prefix;

      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    prefixes.forEach(section => {
      section.hidden = (section.getAttribute("data-prefix") || "") !== prefix;
    });

    updatePrefixSummary(workbench, prefix);

    return prefix;
  }

  function itemMatchesFilter(item, query, onlySelected) {
    const input = itemInput(item);

    if (!input) {
      return false;
    }

    const haystack = [
      item.getAttribute("data-permission-name") || "",
      item.getAttribute("data-permission-prefix") || "",
      item.getAttribute("data-permission-plugin") || ""
    ].join(" ").toLowerCase();

    return (!query || haystack.includes(query)) && (!onlySelected || input.checked);
  }

  function permissionStats(items, query, onlySelected) {
    const stats = new Map();
    let selectedTotal = 0;
    let matchingTotal = 0;

    items.forEach(item => {
      const input = itemInput(item);

      if (!input) {
        return;
      }

      const prefix = item.getAttribute("data-permission-prefix") || "";
      const current = stats.get(prefix) || { matches: 0, selected: 0, total: 0 };
      const matches = itemMatchesFilter(item, query, onlySelected);

      current.total += 1;

      if (input.checked) {
        current.selected += 1;
        selectedTotal += 1;
      }

      if (matches) {
        current.matches += 1;
        matchingTotal += 1;
      }

      stats.set(prefix, current);
    });

    return { matchingTotal, selectedTotal, stats };
  }

  function resetPermissionFilters(workbench) {
    const search = workbench.querySelector("[data-permission-search]");
    const selectedOnly = workbench.querySelector("[data-permission-selected-only]");

    if (search) {
      search.value = "";
    }

    if (selectedOnly) {
      selectedOnly.checked = false;
    }
  }

  function updateStateLabel(item, input) {
    const state = item.querySelector("[data-permission-state]");
    const isLive = item.getAttribute("data-permission-live") === "1";
    let text = "";

    if (input.checked && !isLive) {
      text = "Missing live";
    } else if (!input.checked && isLive) {
      text = "Live extra";
    } else if (input.checked) {
      text = "Synced";
    }

    item.classList.toggle("is-selected", input.checked);
    item.classList.toggle("is-missing-live", input.checked && !isLive);
    item.classList.toggle("is-extra-live", !input.checked && isLive);

    if (state) {
      state.textContent = text;
      state.hidden = text === "";
    }
  }

  function renderSelectedList(workbench, items) {
    const list = workbench.querySelector("[data-permission-selected-list]");
    const summary = workbench.querySelector("[data-permission-selected-summary]");
    const selected = items.filter(item => {
      const input = itemInput(item);

      return input && input.checked;
    });

    if (summary) {
      summary.textContent = `${selected.length} selected`;
    }

    if (!list) {
      return;
    }

    list.textContent = "";

    if (!selected.length) {
      const empty = document.createElement("span");
      empty.className = "admin-permission-chip is-empty";
      empty.textContent = "No direct grants selected";
      list.appendChild(empty);
      return;
    }

    selected.forEach(item => {
      const input = itemInput(item);
      const chip = input.disabled ? document.createElement("span") : document.createElement("button");

      chip.className = "admin-permission-chip";
      chip.textContent = input.value;

      if (input.disabled) {
        chip.setAttribute("aria-disabled", "true");
      } else {
        chip.type = "button";
        chip.setAttribute("aria-label", `Remove ${input.value}`);
        chip.addEventListener("click", () => {
          input.checked = false;
          updateWorkbench(workbench);
        });
      }

      list.appendChild(chip);
    });
  }

  function updateWorkbench(workbench) {
    const search = workbench.querySelector("[data-permission-search]");
    const selectedOnly = workbench.querySelector("[data-permission-selected-only]");
    const matchCount = workbench.querySelector("[data-permission-match-count]");
    const selectedCount = workbench.querySelector("[data-permission-selected-count]");
    const empty = workbench.querySelector("[data-permission-empty]");
    const items = toArray(workbench.querySelectorAll("[data-permission-item]"));
    const prefixes = toArray(workbench.querySelectorAll("[data-permission-prefix]"));
    const tabs = toArray(workbench.querySelectorAll("[data-permission-tab]"));
    const prefixSelect = workbench.querySelector("[data-permission-prefix-select]");
    const query = ((search && search.value) || "").trim().toLowerCase();
    const onlySelected = Boolean(selectedOnly && selectedOnly.checked);
    const filterActive = query !== "" || onlySelected;
    const { matchingTotal, selectedTotal, stats } = permissionStats(items, query, onlySelected);
    let requestedPrefix = activeTabPrefix(workbench);
    let firstMatchingPrefix = "";
    let visibleTotal = 0;

    prefixes.forEach(prefix => {
      const prefixName = prefix.getAttribute("data-prefix") || "";
      const prefixStats = stats.get(prefixName) || { matches: 0, selected: 0, total: 0 };

      if ((!filterActive || prefixStats.matches > 0) && firstMatchingPrefix === "") {
        firstMatchingPrefix = prefixName;
      }
    });

    if (filterActive) {
      const requestedStats = stats.get(requestedPrefix) || { matches: 0, selected: 0, total: 0 };

      if (requestedStats.matches === 0) {
        requestedPrefix = firstMatchingPrefix || requestedPrefix;
      }
    }

    const activePrefix = activateTab(workbench, requestedPrefix);

    items.forEach(item => {
      const input = itemInput(item);

      if (!input) {
        return;
      }

      const prefix = item.getAttribute("data-permission-prefix") || "";
      const visible = prefix === activePrefix && itemMatchesFilter(item, query, onlySelected);

      if (visible) {
        visibleTotal += 1;
      }

      item.hidden = false;
      item.removeAttribute("hidden");
      item.toggleAttribute("hidden", false);
      item.classList.toggle("is-filtered-out", (query !== "" || onlySelected) && !visible);
      updateStateLabel(item, input);
    });

    prefixes.forEach(prefix => {
      const prefixItems = toArray(prefix.querySelectorAll("[data-permission-item]"));
      const count = prefix.querySelector("[data-prefix-count]");
      const prefixName = prefix.getAttribute("data-prefix") || "";
      const prefixStats = stats.get(prefixName) || { matches: 0, selected: 0, total: prefixItems.length };
      const tab = tabs.find(candidate => {
        return (candidate.getAttribute("data-tab-prefix") || "") === prefixName;
      });

      if (prefixName === activePrefix) {
        prefix.removeAttribute("hidden");
      } else {
        prefix.setAttribute("hidden", "");
      }

      if (count) {
        count.textContent = `${prefixStats.selected} / ${prefixItems.length} selected`;
      }

      if (tab) {
        const tabCount = tab.querySelector("[data-tab-count]");
        const tabFilteredOut = filterActive && prefixStats.matches === 0;

        tab.hidden = tabFilteredOut;
        tab.classList.toggle("is-filtered-out", tabFilteredOut);

        if (tabCount) {
          tabCount.textContent = filterActive
            ? `${prefixStats.matches} match${prefixStats.matches === 1 ? "" : "es"}`
            : `${prefixStats.selected} / ${prefixItems.length}`;
        }
      }

      const option = selectOptionByPrefix(prefixSelect, prefixName);

      if (option) {
        const label = choiceLabel(option, prefixName);

        option.textContent = filterActive
          ? `${label} - ${prefixStats.matches} match${prefixStats.matches === 1 ? "" : "es"}`
          : `${label} - ${prefixStats.selected} / ${prefixItems.length}`;
      }
    });

    if (matchCount) {
      matchCount.textContent = filterActive ? `${matchingTotal} match${matchingTotal === 1 ? "" : "es"}` : `${visibleTotal} visible`;
    }

    if (selectedCount) {
      selectedCount.textContent = `${selectedTotal} selected`;
    }

    if (empty) {
      empty.hidden = filterActive ? matchingTotal !== 0 : visibleTotal !== 0;
    }

    renderSelectedList(workbench, items);
    updatePrefixSummary(workbench, activePrefix);
  }

  function initWorkbench(workbench) {
    const search = workbench.querySelector("[data-permission-search]");
    const selectedOnly = workbench.querySelector("[data-permission-selected-only]");
    const prefixSelect = workbench.querySelector("[data-permission-prefix-select]");

    resetPermissionFilters(workbench);
    activateTab(workbench, activeTabPrefix(workbench));

    toArray(workbench.querySelectorAll("[data-permission-tab]")).forEach(tab => {
      tab.addEventListener("click", () => {
        activateTab(workbench, tab.getAttribute("data-tab-prefix") || "");
        updateWorkbench(workbench);
      });
    });

    if (prefixSelect) {
      prefixSelect.addEventListener("change", () => {
        activateTab(workbench, prefixSelect.value || "");
        updateWorkbench(workbench);
      });
    }

    if (search) {
      search.addEventListener("input", () => updateWorkbench(workbench));
    }

    if (selectedOnly) {
      selectedOnly.addEventListener("change", () => updateWorkbench(workbench));
    }

    toArray(workbench.querySelectorAll("[data-permission-item]")).forEach(item => {
      item.addEventListener("click", event => {
        const input = itemInput(item);

        if (!input) {
          return;
        }

        if (input.disabled) {
          event.preventDefault();
          openGuardModal(item);
          return;
        }

        if (event.target === input) {
          return;
        }

        event.preventDefault();
        input.checked = !input.checked;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    toArray(workbench.querySelectorAll('[data-permission-item] input[type="checkbox"]')).forEach(input => {
      input.addEventListener("change", () => updateWorkbench(workbench));
    });

    updateWorkbench(workbench);
    window.requestAnimationFrame(() => updateWorkbench(workbench));
    window.setTimeout(() => updateWorkbench(workbench), 150);
  }

  toArray(groupEditors).forEach(initGroupEditor);
  toArray(workbenches).forEach(initWorkbench);
})();
