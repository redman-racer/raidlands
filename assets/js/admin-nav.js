(function () {
  const nav = document.querySelector("[data-admin-nav]");

  if (!nav) {
    return;
  }

  const groups = Array.from(nav.querySelectorAll("[data-admin-nav-group]"));

  if (groups.length === 0) {
    return;
  }

  const closeGroups = (except = null) => {
    groups.forEach((group) => {
      if (group !== except) {
        group.removeAttribute("open");
      }
    });
  };

  groups.forEach((group) => {
    group.addEventListener("toggle", () => {
      if (group.open) {
        closeGroups(group);
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target)) {
      closeGroups();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    const openGroup = groups.find((group) => group.open);

    if (!openGroup) {
      return;
    }

    closeGroups();

    if (nav.contains(document.activeElement)) {
      const summary = openGroup.querySelector("summary");

      if (summary) {
        summary.focus();
      }
    }
  });
})();
