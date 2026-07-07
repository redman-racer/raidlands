(() => {
  const workbench = document.querySelector("[data-admin-chat-workbench]");

  if (!workbench) return;

  const search = workbench.querySelector("[data-admin-chat-search]");
  const status = workbench.querySelector("[data-admin-chat-status]");
  const reset = workbench.querySelector("[data-admin-chat-reset]");
  const empty = workbench.querySelector("[data-admin-chat-empty]");
  const cards = Array.from(workbench.querySelectorAll("[data-admin-chat-card]"));

  function normalize(value) {
    return String(value || "").toLowerCase().trim();
  }

  function applyFilters() {
    const query = normalize(search ? search.value : "");
    const selected = status ? status.value : "";
    let visible = 0;

    cards.forEach(card => {
      const haystack = normalize(card.getAttribute("data-chat-search"));
      const cardStatus = card.getAttribute("data-chat-status") || "";
      const muted = card.getAttribute("data-chat-muted") === "true";
      const matchesSearch = query === "" || haystack.includes(query);
      const matchesStatus = selected === ""
        || cardStatus === selected
        || (selected === "muted" && muted);
      const show = matchesSearch && matchesStatus;

      card.hidden = !show;

      if (show) {
        visible += 1;
      }
    });

    if (empty) {
      empty.hidden = visible !== 0;
    }
  }

  if (search) {
    search.addEventListener("input", applyFilters);
  }

  if (status) {
    status.addEventListener("change", applyFilters);
  }

  if (reset) {
    reset.addEventListener("click", () => {
      if (search) search.value = "";
      if (status) status.value = "";
      applyFilters();
    });
  }

  applyFilters();
})();
