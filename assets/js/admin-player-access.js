(function () {
  var root = document.querySelector('[data-admin-access-workbench]');

  if (!root) {
    return;
  }

  var steamInput = root.querySelector('[data-admin-access-steam-input]');
  var loadButton = root.querySelector('button[name="grant_action"][value="load_player"]');
  var tabButtons = Array.prototype.slice.call(root.querySelectorAll('[data-admin-access-tab]'));
  var panels = Array.prototype.slice.call(root.querySelectorAll('[data-admin-access-panel]'));
  var searchInput = root.querySelector('[data-admin-access-search]');
  var accessFilter = root.querySelector('[data-admin-access-filter]');
  var sortSelect = root.querySelector('[data-admin-access-sort]');
  var resetButton = root.querySelector('[data-admin-access-reset]');
  var countLabel = root.querySelector('[data-admin-access-count]');
  var emptyState = root.querySelector('[data-admin-access-empty]');
  var playerList = root.querySelector('[data-admin-access-list]');
  var playerButtons = Array.prototype.slice.call(root.querySelectorAll('[data-admin-access-player]'));

  function setActiveTab(tab) {
    tabButtons.forEach(function (button) {
      var active = button.getAttribute('data-admin-access-tab') === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    panels.forEach(function (panel) {
      var active = panel.getAttribute('data-admin-access-panel') === tab;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function accessMatches(button, filter) {
    if (!filter) {
      return true;
    }

    if (filter === 'product') {
      return button.getAttribute('data-product') === '1';
    }

    if (filter === 'direct') {
      return button.getAttribute('data-direct') === '1';
    }

    return button.getAttribute('data-access') === filter;
  }

  function sortPlayers(buttons, mode) {
    buttons.sort(function (left, right) {
      if (mode === 'name') {
        return normalizeText(left.getAttribute('data-name')).localeCompare(normalizeText(right.getAttribute('data-name')));
      }

      if (mode === 'steam') {
        return String(left.getAttribute('data-steam-id') || '').localeCompare(String(right.getAttribute('data-steam-id') || ''));
      }

      if (mode === 'access') {
        var leftScore = (left.getAttribute('data-product') === '1' ? 2 : 0) + (left.getAttribute('data-direct') === '1' ? 1 : 0);
        var rightScore = (right.getAttribute('data-product') === '1' ? 2 : 0) + (right.getAttribute('data-direct') === '1' ? 1 : 0);

        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }
      }

      return String(right.getAttribute('data-last-seen') || '').localeCompare(String(left.getAttribute('data-last-seen') || ''));
    });
  }

  function applyPlayerFilters() {
    var query = normalizeText(searchInput && searchInput.value);
    var filter = accessFilter ? accessFilter.value : '';
    var visibleButtons = [];

    playerButtons.forEach(function (button) {
      var matchesSearch = !query || normalizeText(button.getAttribute('data-search')).indexOf(query) !== -1;
      var visible = matchesSearch && accessMatches(button, filter);
      button.hidden = !visible;

      if (visible) {
        visibleButtons.push(button);
      }
    });

    sortPlayers(visibleButtons, sortSelect ? sortSelect.value : 'recent');

    if (playerList) {
      visibleButtons.forEach(function (button) {
        playerList.appendChild(button);
      });
    }

    if (countLabel) {
      countLabel.textContent = visibleButtons.length + (visibleButtons.length === 1 ? ' player shown' : ' players shown');
    }

    if (emptyState) {
      emptyState.hidden = visibleButtons.length > 0;
    }
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function minimumAccessDate() {
    var minimum = new Date(Date.now() + 60 * 60 * 1000);
    minimum.setSeconds(0, 0);
    return minimum;
  }

  function formatPickerDate(date) {
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join('-') + 'T' + [
      pad(date.getHours()),
      pad(date.getMinutes())
    ].join(':');
  }

  function parseDateInput(value) {
    var clean = String(value || '').trim();

    if (!clean) {
      return null;
    }

    var normalized = clean.replace('T', ' ');
    var match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/);

    if (match) {
      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4] || 23),
        Number(match[5] || 59),
        Number(match[6] || 59)
      );
    }

    var fallback = new Date(clean);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  function normalizeDateField(input) {
    var minimum = minimumAccessDate();
    var rawValue = String(input.value || '').trim();

    input.min = formatPickerDate(minimum);

    // An empty expiry means permanent access. Do not silently turn a blank
    // optional field into a short-lived one-hour grant.
    if (!rawValue) {
      input.value = '';
      input.setCustomValidity('');
      return;
    }

    var parsed = parseDateInput(rawValue);

    if (!parsed || parsed < minimum) {
      parsed = minimum;
    }

    input.value = formatPickerDate(parsed);
    input.setCustomValidity('');
  }

  tabButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      setActiveTab(button.getAttribute('data-admin-access-tab') || 'review');
    });
  });

  playerButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      if (steamInput) {
        steamInput.value = button.getAttribute('data-steam-id') || '';
      }

      if (loadButton) {
        loadButton.click();
      }
    });
  });

  [searchInput, accessFilter, sortSelect].forEach(function (control) {
    if (control) {
      control.addEventListener('input', applyPlayerFilters);
      control.addEventListener('change', applyPlayerFilters);
    }
  });

  if (resetButton) {
    resetButton.addEventListener('click', function () {
      if (searchInput) {
        searchInput.value = '';
      }

      if (accessFilter) {
        accessFilter.value = '';
      }

      if (sortSelect) {
        sortSelect.value = 'recent';
      }

      applyPlayerFilters();
    });
  }

  root.querySelectorAll('[data-admin-access-datetime]').forEach(function (input) {
    normalizeDateField(input);
    input.addEventListener('blur', function () {
      normalizeDateField(input);
    });
    input.addEventListener('change', function () {
      normalizeDateField(input);
    });
  });

  applyPlayerFilters();
})();
