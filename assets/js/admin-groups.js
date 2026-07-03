(() => {
  const workbenches = document.querySelectorAll("[data-permission-workbench]");

  if (!workbenches.length) {
    return;
  }

  const toArray = nodes => Array.prototype.slice.call(nodes || []);
  const itemInput = item => item.querySelector('input[type="checkbox"]');

  function activeTabPrefix(workbench) {
    const active = workbench.querySelector("[data-permission-tab].is-active");
    const first = workbench.querySelector("[data-permission-tab]");

    return (active || first || {}).dataset ? (active || first).dataset.tabPrefix || "" : "";
  }

  function activateTab(workbench, prefix) {
    const tabs = toArray(workbench.querySelectorAll("[data-permission-tab]"));

    if (!prefix && tabs.length) {
      prefix = tabs[0].dataset.tabPrefix || "";
    }

    tabs.forEach(tab => {
      const isActive = (tab.dataset.tabPrefix || "") === prefix;

      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
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
    const activePrefix = activeTabPrefix(workbench);
    const query = ((search && search.value) || "").trim().toLowerCase();
    const onlySelected = Boolean(selectedOnly && selectedOnly.checked);
    let visibleTotal = 0;
    let selectedTotal = 0;

    items.forEach(item => {
      const input = itemInput(item);

      if (!input) {
        return;
      }

      const haystack = [
        item.getAttribute("data-permission-name") || "",
        item.getAttribute("data-permission-prefix") || "",
        item.getAttribute("data-permission-plugin") || ""
      ].join(" ").toLowerCase();
      const selected = input.checked;
      const prefix = item.getAttribute("data-permission-prefix") || "";
      const visible = prefix === activePrefix && (!query || haystack.includes(query)) && (!onlySelected || selected);

      if (selected) {
        selectedTotal += 1;
      }

      if (visible) {
        visibleTotal += 1;
      }

      item.hidden = !visible;
      updateStateLabel(item, input);
    });

    prefixes.forEach(prefix => {
      const prefixItems = toArray(prefix.querySelectorAll("[data-permission-item]"));
      const count = prefix.querySelector("[data-prefix-count]");
      const prefixName = prefix.getAttribute("data-prefix") || "";
      const tab = toArray(workbench.querySelectorAll("[data-permission-tab]")).find(candidate => {
        return (candidate.dataset.tabPrefix || "") === prefixName;
      });
      let selected = 0;
      let visible = 0;

      prefixItems.forEach(item => {
        const input = itemInput(item);

        if (input && input.checked) {
          selected += 1;
        }

        if (!item.hidden) {
          visible += 1;
        }
      });

      prefix.hidden = prefixName !== activePrefix || visible === 0;

      if (count) {
        count.textContent = `${selected} / ${prefixItems.length} selected`;
      }

      if (tab) {
        const tabCount = tab.querySelector("[data-tab-count]");

        if (tabCount) {
          tabCount.textContent = `${selected} / ${prefixItems.length}`;
        }
      }
    });

    if (matchCount) {
      matchCount.textContent = `${visibleTotal} visible`;
    }

    if (selectedCount) {
      selectedCount.textContent = `${selectedTotal} selected`;
    }

    if (empty) {
      empty.hidden = visibleTotal !== 0;
    }

    renderSelectedList(workbench, items);
  }

  toArray(workbenches).forEach(workbench => {
    const search = workbench.querySelector("[data-permission-search]");
    const selectedOnly = workbench.querySelector("[data-permission-selected-only]");

    activateTab(workbench, activeTabPrefix(workbench));

    toArray(workbench.querySelectorAll("[data-permission-tab]")).forEach(tab => {
      tab.addEventListener("click", () => {
        activateTab(workbench, tab.dataset.tabPrefix || "");
        updateWorkbench(workbench);
      });
    });

    if (search) {
      search.addEventListener("input", () => updateWorkbench(workbench));
    }

    if (selectedOnly) {
      selectedOnly.addEventListener("change", () => updateWorkbench(workbench));
    }

    toArray(workbench.querySelectorAll('[data-permission-item] input[type="checkbox"]')).forEach(input => {
      input.addEventListener("change", () => updateWorkbench(workbench));
    });

    updateWorkbench(workbench);
  });
})();
