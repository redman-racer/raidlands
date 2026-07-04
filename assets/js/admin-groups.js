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
  let categoryModal = null;
  let categoryModalWorkbench = null;
  let categoryModalReturnFocus = null;

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

  function ensureCategoryModal() {
    if (categoryModal) {
      return categoryModal;
    }

    categoryModal = document.createElement("div");
    categoryModal.className = "admin-permission-category-modal";
    categoryModal.hidden = true;
    categoryModal.innerHTML = [
      '<div class="admin-permission-category-modal-backdrop" data-category-close></div>',
      '<section class="admin-permission-category-modal-panel" role="dialog" aria-modal="true" aria-labelledby="admin-permission-category-modal-title">',
      '<header class="admin-permission-category-modal-head">',
      '<div><p class="section-kicker">Permission categories</p><h3 id="admin-permission-category-modal-title">Choose Category</h3></div>',
      '<button class="btn btn-ghost" type="button" data-category-close>Close</button>',
      '</header>',
      '<div class="admin-permission-category-modal-body">',
      '<div class="admin-permission-category-table-wrap">',
      '<table class="admin-permission-category-table">',
      '<thead><tr><th>Category</th><th>Prefix</th><th>Selected</th><th>Live</th><th>Total</th><th>Action</th></tr></thead>',
      '<tbody data-category-rows></tbody>',
      '</table>',
      '</div>',
      '</div>',
      '</section>'
    ].join("");

    categoryModal.addEventListener("click", event => {
      const closeTarget = event.target.closest("[data-category-close]");
      const chooseTarget = event.target.closest("[data-category-choose]");

      if (closeTarget) {
        closeCategoryModal();
        return;
      }

      if (chooseTarget && categoryModalWorkbench) {
        const prefix = chooseTarget.getAttribute("data-category-prefix") || "";
        const select = categoryModalWorkbench.querySelector("[data-permission-prefix-select]");

        if (select && selectOptionByPrefix(select, prefix)) {
          select.value = prefix;
          activateTab(categoryModalWorkbench, prefix);
          updateWorkbench(categoryModalWorkbench);
        }

        closeCategoryModal();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && categoryModal && !categoryModal.hidden) {
        closeCategoryModal();
      }
    });

    document.body.appendChild(categoryModal);
    return categoryModal;
  }

  function categoryPrefixPanels(workbench) {
    return toArray(workbench.querySelectorAll("[data-permission-prefix]"));
  }

  function categoryPanelByPrefix(workbench, prefix) {
    return categoryPrefixPanels(workbench).find(panel => {
      return (panel.getAttribute("data-prefix") || "") === prefix;
    }) || null;
  }

  function categoryStats(workbench, prefix) {
    const panel = categoryPanelByPrefix(workbench, prefix);
    const items = panel ? toArray(panel.querySelectorAll("[data-permission-item]")) : [];
    let selected = 0;
    let live = 0;

    items.forEach(item => {
      const input = itemInput(item);

      if (input && input.checked) {
        selected += 1;
      }

      if (item.getAttribute("data-permission-live") === "1") {
        live += 1;
      }
    });

    return {
      selected,
      live,
      total: items.length
    };
  }

  function appendCategoryCell(row, text) {
    const cell = document.createElement("td");

    cell.textContent = text;
    row.appendChild(cell);
    return cell;
  }

  function renderCategoryModalRows(workbench) {
    const modal = ensureCategoryModal();
    const rows = modal.querySelector("[data-category-rows]");
    const select = workbench.querySelector("[data-permission-prefix-select]");
    const options = select ? toArray(select.options) : [];
    const activePrefix = activeTabPrefix(workbench);

    if (!rows) {
      return;
    }

    rows.textContent = "";

    if (!options.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 6;
      cell.textContent = "No permission categories are available.";
      row.appendChild(cell);
      rows.appendChild(row);
      return;
    }

    options.forEach(option => {
      const prefix = option.value || "";
      const stats = categoryStats(workbench, prefix);
      const row = document.createElement("tr");
      const actionCell = document.createElement("td");
      const button = document.createElement("button");

      row.className = prefix === activePrefix ? "is-active" : "";
      appendCategoryCell(row, choiceLabel(option, prefix));
      appendCategoryCell(row, prefix);
      appendCategoryCell(row, String(stats.selected));
      appendCategoryCell(row, String(stats.live));
      appendCategoryCell(row, String(stats.total));

      button.className = "btn btn-secondary admin-permission-category-choose";
      button.type = "button";
      button.textContent = prefix === activePrefix ? "Selected" : "Choose";
      button.setAttribute("data-category-choose", "");
      button.setAttribute("data-category-prefix", prefix);

      actionCell.appendChild(button);
      row.appendChild(actionCell);
      rows.appendChild(row);
    });
  }

  function openCategoryModal(source, workbench) {
    const modal = ensureCategoryModal();
    const closeButton = modal.querySelector("button[data-category-close]");

    categoryModalWorkbench = workbench;
    categoryModalReturnFocus = source;
    renderCategoryModalRows(workbench);
    modal.hidden = false;
    document.body.classList.add("has-admin-category-modal");

    if (closeButton) {
      closeButton.focus();
    }
  }

  function closeCategoryModal() {
    if (!categoryModal) {
      return;
    }

    categoryModal.hidden = true;
    categoryModalWorkbench = null;
    document.body.classList.remove("has-admin-category-modal");

    if (categoryModalReturnFocus && typeof categoryModalReturnFocus.focus === "function") {
      categoryModalReturnFocus.focus();
    }

    categoryModalReturnFocus = null;
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function plainText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function numberValue(element, attribute, fallback) {
    const value = Number(element.getAttribute(attribute) || fallback || 0);

    return Number.isFinite(value) ? value : 0;
  }

  function selectedOptionText(select) {
    const option = select && select.options ? select.options[select.selectedIndex] : null;

    return option ? option.text.trim() : "";
  }

  function initGroupEditor(editor) {
    const panels = toArray(editor.querySelectorAll("[data-group-panel]"));
    const selectors = toArray(editor.querySelectorAll("[data-group-select]"));
    const addButton = editor.querySelector("[data-group-add]");
    const list = editor.querySelector(".admin-group-picker-list");
    const search = editor.querySelector("[data-group-search]");
    const categoryFilter = editor.querySelector("[data-group-category-filter]");
    const statusFilter = editor.querySelector("[data-group-status-filter]");
    const sortSelect = editor.querySelector("[data-group-sort]");
    const resetButton = editor.querySelector("[data-group-reset]");
    const resultCount = editor.querySelector("[data-group-result-count]");
    const empty = editor.querySelector("[data-group-empty]");
    const activePanel = panels.find(panel => panel.classList.contains("is-active")) || panels[0];
    let activeIndex = activePanel ? activePanel.getAttribute("data-group-index") || "0" : "0";

    function selectorByIndex(index) {
      return selectors.find(selector => selector.getAttribute("data-group-index") === String(index));
    }

    function groupInput(panel, suffix) {
      return panel.querySelector(`input[name$="[${suffix}]"], select[name$="[${suffix}]"], textarea[name$="[${suffix}]"]`);
    }

    function statusLabel(status) {
      if (status === "read-only") {
        return "Read-only";
      }

      if (status === "draft") {
        return "Draft";
      }

      return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Active";
    }

    function groupStatus(panel) {
      const idInput = groupInput(panel, "id");

      if (!idInput || !plainText(idInput.value)) {
        return "draft";
      }

      if (panel.getAttribute("data-group-read-only") === "1") {
        return "read-only";
      }

      const protectedInput = groupInput(panel, "is_protected");

      if (protectedInput && protectedInput.checked) {
        return "protected";
      }

      const activeInput = groupInput(panel, "is_active");

      return activeInput && activeInput.checked ? "active" : "inactive";
    }

    function customPermissionLines(panel) {
      const custom = panel.querySelector(".admin-permission-custom textarea");

      return plainText(custom ? custom.value : "")
        .split(/\s+/)
        .map(plainText)
        .filter(Boolean);
    }

    function permissionSummary(panel) {
      const options = toArray(panel.querySelectorAll(".admin-permission-option"));
      const custom = customPermissionLines(panel);
      const liveFallback = Number(panel.getAttribute("data-group-live-count") || 0);
      let desired = custom.length;
      let live = Number.isFinite(liveFallback) ? liveFallback : 0;
      let optionLiveCount = 0;
      let drift = panel.getAttribute("data-group-initial-drift") === "1" || custom.length > 0;

      options.forEach(option => {
        const input = option.querySelector('input[type="checkbox"]');
        const isLive = option.getAttribute("data-permission-live") === "1";

        if (!input) {
          return;
        }

        if (isLive) {
          optionLiveCount += 1;
        }

        if (input.checked) {
          desired += 1;
        }

        if ((input.checked && !isLive) || (!input.checked && isLive)) {
          drift = true;
        }
      });

      if (live === 0 && optionLiveCount > 0) {
        live = optionLiveCount;
      }

      return { desired, live, drift };
    }

    function permissionSearchParts(panel) {
      const parts = [];

      toArray(panel.querySelectorAll(".admin-permission-option")).forEach(option => {
        const input = option.querySelector('input[type="checkbox"]');
        const isLive = option.getAttribute("data-permission-live") === "1";

        if (input && (input.checked || isLive)) {
          parts.push(input.value);
        }
      });

      customPermissionLines(panel).forEach(permission => parts.push(permission));

      return parts;
    }

    function selectorSearchText(panel, categoryLabel, status) {
      const parts = [categoryLabel, statusLabel(status)];

      ["group_name", "title", "parent_group", "category", "notes"].forEach(suffix => {
        const control = groupInput(panel, suffix);

        if (control) {
          parts.push(control.value);
        }
      });

      permissionSearchParts(panel).forEach(permission => parts.push(permission));

      return parts.map(plainText).filter(Boolean).join(" ");
    }

    function updateSelectorFromPanel(panel) {
      const index = panel.getAttribute("data-group-index") || "0";
      const selector = selectorByIndex(index);

      if (!selector) {
        return;
      }

      const nameInput = groupInput(panel, "group_name");
      const categorySelect = groupInput(panel, "category");
      const sortInput = groupInput(panel, "sort_order");
      const title = plainText(nameInput ? nameInput.value : "") || "New Group";
      const category = plainText(categorySelect ? categorySelect.value : "") || "custom";
      const categoryLabel = selectedOptionText(categorySelect) || category;
      const status = groupStatus(panel);
      const summary = permissionSummary(panel);
      const metaText = `${summary.desired} desired / ${summary.live} live / ${statusLabel(status)}${summary.drift ? " / Drift" : ""}`;
      const heading = panel.querySelector("[data-group-card-title]");
      const label = selector.querySelector("[data-group-select-label]");
      const meta = selector.querySelector("[data-group-select-meta]");
      const subtitle = panel.querySelector(".admin-feedback-subtitle");

      if (heading) {
        heading.textContent = title;
      }

      if (label) {
        label.textContent = title;
      }

      if (meta) {
        meta.textContent = metaText;
      }

      if (subtitle && status !== "read-only") {
        subtitle.textContent = summary.drift
          ? "Live drift: desired permissions differ from the latest snapshot."
          : "Desired permissions match the latest live snapshot.";
      }

      selector.classList.toggle("has-drift", summary.drift);
      selector.setAttribute("data-group-category", category);
      selector.setAttribute("data-group-status", status);
      selector.setAttribute("data-group-drift", summary.drift ? "1" : "0");
      selector.setAttribute("data-group-sort-order", sortInput ? String(sortInput.value || "100") : "100");
      selector.setAttribute("data-group-desired-count", String(summary.desired));
      selector.setAttribute("data-group-live-count", String(summary.live));
      selector.setAttribute("data-group-search", selectorSearchText(panel, categoryLabel, status));
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

    function groupFilters() {
      return {
        query: normalize(search ? search.value : ""),
        category: categoryFilter ? String(categoryFilter.value || "") : "",
        status: statusFilter ? String(statusFilter.value || "") : "",
        sort: sortSelect ? String(sortSelect.value || "order") : "order"
      };
    }

    function selectorLabel(selector) {
      const label = selector.querySelector("[data-group-select-label]");

      return label ? plainText(label.textContent) : "";
    }

    function sortSelectors(sortMode) {
      const statusRank = {
        active: 10,
        protected: 20,
        inactive: 30,
        "read-only": 40,
        draft: 50
      };

      function draftRank(selector) {
        return selector.getAttribute("data-group-status") === "draft" ? 1 : 0;
      }

      function byTitle(a, b) {
        return selectorLabel(a).localeCompare(selectorLabel(b));
      }

      function byAdminOrder(a, b) {
        return draftRank(a) - draftRank(b)
          || numberValue(a, "data-group-sort-order", 100) - numberValue(b, "data-group-sort-order", 100)
          || byTitle(a, b);
      }

      return selectors.slice().sort((a, b) => {
        if (sortMode === "name") {
          return byTitle(a, b) || byAdminOrder(a, b);
        }

        if (sortMode === "category") {
          return String(a.getAttribute("data-group-category") || "").localeCompare(String(b.getAttribute("data-group-category") || ""))
            || byAdminOrder(a, b);
        }

        if (sortMode === "status") {
          return (statusRank[a.getAttribute("data-group-status") || "draft"] || 99) - (statusRank[b.getAttribute("data-group-status") || "draft"] || 99)
            || byAdminOrder(a, b);
        }

        if (sortMode === "grants") {
          return numberValue(b, "data-group-desired-count", 0) - numberValue(a, "data-group-desired-count", 0)
            || byAdminOrder(a, b);
        }

        if (sortMode === "drift") {
          return numberValue(b, "data-group-drift", 0) - numberValue(a, "data-group-drift", 0)
            || byAdminOrder(a, b);
        }

        return byAdminOrder(a, b);
      });
    }

    function selectorMatches(selector, filters) {
      if (filters.category && selector.getAttribute("data-group-category") !== filters.category) {
        return false;
      }

      if (filters.status === "drift" && selector.getAttribute("data-group-drift") !== "1") {
        return false;
      }

      if (filters.status === "synced" && selector.getAttribute("data-group-drift") === "1") {
        return false;
      }

      if (filters.status && !["drift", "synced"].includes(filters.status) && selector.getAttribute("data-group-status") !== filters.status) {
        return false;
      }

      if (!filters.query) {
        return true;
      }

      const searchText = normalize(selector.getAttribute("data-group-search"));
      const terms = filters.query.split(/\s+/).filter(Boolean);

      return terms.every(term => searchText.includes(term));
    }

    function applyGroupFilters() {
      const filters = groupFilters();
      const visible = [];

      sortSelectors(filters.sort).forEach(selector => {
        if (list) {
          list.appendChild(selector);
        }

        const isVisible = selectorMatches(selector, filters);

        selector.hidden = !isVisible;

        if (isVisible) {
          visible.push(selector);
        }
      });

      if (resultCount) {
        resultCount.textContent = `${visible.length} group${visible.length === 1 ? "" : "s"} shown`;
      }

      if (empty) {
        empty.hidden = visible.length !== 0;
      }

      if (!visible.length) {
        activateGroup("");
        return;
      }

      const activeSelector = selectorByIndex(activeIndex);

      if (!activeSelector || activeSelector.hidden) {
        activateGroup(visible[0].getAttribute("data-group-index") || "0");
      } else {
        activateGroup(activeIndex);
      }
    }

    function resetGroupFilters() {
      if (search) {
        search.value = "";
      }

      [categoryFilter, statusFilter].forEach(control => {
        if (control) {
          control.value = "";
        }
      });

      if (sortSelect) {
        sortSelect.value = "order";
      }

      applyGroupFilters();
    }

    function activateDraftGroup() {
      const draftPanel = panels.find(panel => {
        const idInput = panel.querySelector('input[name$="[id]"]');

        return idInput && !idInput.value;
      }) || panels[panels.length - 1];

      if (!draftPanel) {
        return;
      }

      resetGroupFilters();
      activateGroup(draftPanel.getAttribute("data-group-index") || "0");

      const nameInput = draftPanel.querySelector("[data-group-name-input]");

      if (nameInput) {
        nameInput.focus();
        nameInput.select();
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
      const refreshPanel = () => {
        updateSelectorFromPanel(panel);
        applyGroupFilters();
      };

      toArray(panel.querySelectorAll("input, select, textarea")).forEach(control => {
        control.addEventListener("input", refreshPanel);
        control.addEventListener("change", refreshPanel);
      });

      updateSelectorFromPanel(panel);
    });

    [search, categoryFilter, statusFilter, sortSelect].forEach(control => {
      if (!control) {
        return;
      }

      control.addEventListener(control.tagName === "INPUT" ? "input" : "change", applyGroupFilters);
    });

    if (addButton) {
      addButton.addEventListener("click", activateDraftGroup);
    }

    if (resetButton) {
      resetButton.addEventListener("click", resetGroupFilters);
    }

    applyGroupFilters();
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
      empty.textContent = "No non-kit grants selected";
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
    const categoryOpen = workbench.querySelector("[data-permission-category-open]");

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

    if (categoryOpen) {
      categoryOpen.addEventListener("click", () => {
        openCategoryModal(categoryOpen, workbench);
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
