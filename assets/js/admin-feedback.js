(function () {
  var workbenches = Array.prototype.slice.call(document.querySelectorAll('[data-admin-feedback-workbench]'));

  if (!workbenches.length) {
    return;
  }

  function toArray(nodes) {
    return Array.prototype.slice.call(nodes || []);
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function parseDateValue(value) {
    var normalized = String(value || '').trim();

    if (!normalized) {
      return 0;
    }

    var timestamp = Date.parse(normalized.replace(' ', 'T'));

    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  function selectorLabel(selector) {
    var label = selector.querySelector('[data-feedback-select-label]');

    return label ? label.textContent.trim() : '';
  }

  function selectorMatches(selector, filters) {
    var status = selector.getAttribute('data-feedback-status') || '';
    var type = selector.getAttribute('data-feedback-type') || '';
    var feature = selector.getAttribute('data-feedback-feature') || 'none';

    if (filters.status && status !== filters.status) {
      return false;
    }

    if (filters.type && type !== filters.type) {
      return false;
    }

    if (filters.workflow === 'linked' && feature !== 'linked') {
      return false;
    }

    if (filters.workflow === 'unlinked' && feature !== 'candidate') {
      return false;
    }

    if (filters.workflow === 'candidate' && feature === 'none') {
      return false;
    }

    if (filters.workflow === 'none' && feature !== 'none') {
      return false;
    }

    if (!filters.query) {
      return true;
    }

    var searchText = normalize(selector.getAttribute('data-feedback-search'));
    var terms = filters.query.split(/\s+/).filter(Boolean);

    return terms.every(function (term) {
      return searchText.indexOf(term) !== -1;
    });
  }

  function sortSelectors(selectors, sortMode) {
    var statusRank = {
      open: 10,
      reviewing: 20,
      planned: 30,
      resolved: 40,
      closed: 50
    };

    return selectors.slice().sort(function (a, b) {
      if (sortMode === 'oldest') {
        return parseDateValue(a.getAttribute('data-feedback-submitted')) - parseDateValue(b.getAttribute('data-feedback-submitted'))
          || selectorLabel(a).localeCompare(selectorLabel(b));
      }

      if (sortMode === 'updated') {
        return parseDateValue(b.getAttribute('data-feedback-updated')) - parseDateValue(a.getAttribute('data-feedback-updated'))
          || parseDateValue(b.getAttribute('data-feedback-submitted')) - parseDateValue(a.getAttribute('data-feedback-submitted'));
      }

      if (sortMode === 'status') {
        return (statusRank[a.getAttribute('data-feedback-status') || ''] || 999) - (statusRank[b.getAttribute('data-feedback-status') || ''] || 999)
          || parseDateValue(b.getAttribute('data-feedback-submitted')) - parseDateValue(a.getAttribute('data-feedback-submitted'));
      }

      if (sortMode === 'type') {
        return String(a.getAttribute('data-feedback-type-label') || '').localeCompare(String(b.getAttribute('data-feedback-type-label') || ''))
          || parseDateValue(b.getAttribute('data-feedback-submitted')) - parseDateValue(a.getAttribute('data-feedback-submitted'));
      }

      return parseDateValue(b.getAttribute('data-feedback-submitted')) - parseDateValue(a.getAttribute('data-feedback-submitted'))
        || selectorLabel(a).localeCompare(selectorLabel(b));
    });
  }

  function setStatusClasses(element, prefix, status) {
    ['open', 'reviewing', 'planned', 'resolved', 'closed'].forEach(function (knownStatus) {
      element.classList.remove(prefix + knownStatus);
    });

    if (status) {
      element.classList.add(prefix + status);
    }
  }

  function initWorkbench(workbench) {
    var panels = toArray(workbench.querySelectorAll('[data-feedback-panel]'));
    var selectors = toArray(workbench.querySelectorAll('[data-feedback-select]'));
    var list = workbench.querySelector('[data-feedback-list]');
    var search = workbench.querySelector('[data-feedback-search]');
    var statusFilter = workbench.querySelector('[data-feedback-status-filter]');
    var typeFilter = workbench.querySelector('[data-feedback-type-filter]');
    var workflowFilter = workbench.querySelector('[data-feedback-workflow-filter]');
    var sortSelect = workbench.querySelector('[data-feedback-sort]');
    var resetButton = workbench.querySelector('[data-feedback-reset]');
    var resultCount = workbench.querySelector('[data-feedback-result-count]');
    var empty = workbench.querySelector('[data-feedback-empty]');
    var activePanel = panels.find(function (panel) {
      return panel.classList.contains('is-active');
    }) || panels[0];
    var activeIndex = activePanel ? activePanel.getAttribute('data-feedback-index') || '0' : '';

    function selectorByIndex(index) {
      return selectors.find(function (selector) {
        return selector.getAttribute('data-feedback-index') === String(index);
      });
    }

    function activateFeedback(index) {
      activeIndex = String(index || '');

      panels.forEach(function (panel) {
        var isActive = activeIndex !== '' && panel.getAttribute('data-feedback-index') === activeIndex;

        panel.hidden = !isActive;
        panel.classList.toggle('is-active', isActive);
      });

      selectors.forEach(function (selector) {
        var isActive = activeIndex !== '' && selector.getAttribute('data-feedback-index') === activeIndex;

        selector.classList.toggle('is-active', isActive);

        if (isActive) {
          selector.setAttribute('aria-current', 'true');
        } else {
          selector.removeAttribute('aria-current');
        }
      });
    }

    function filters() {
      return {
        query: normalize(search ? search.value : ''),
        status: statusFilter ? String(statusFilter.value || '') : '',
        type: typeFilter ? String(typeFilter.value || '') : '',
        workflow: workflowFilter ? String(workflowFilter.value || 'all') : 'all',
        sort: sortSelect ? String(sortSelect.value || 'newest') : 'newest'
      };
    }

    function updateQueue() {
      var currentFilters = filters();
      var sorted = sortSelectors(selectors, currentFilters.sort);
      var visible = [];

      sorted.forEach(function (selector) {
        if (list) {
          list.appendChild(selector);
        }

        var isVisible = selectorMatches(selector, currentFilters);
        selector.hidden = !isVisible;

        if (isVisible) {
          visible.push(selector);
        }
      });

      if (resultCount) {
        resultCount.textContent = visible.length + ' item' + (visible.length === 1 ? '' : 's') + ' shown';
      }

      if (empty) {
        empty.hidden = visible.length !== 0;
      }

      if (!visible.length) {
        activateFeedback('');
        return;
      }

      var activeSelector = selectorByIndex(activeIndex);

      if (!activeSelector || activeSelector.hidden) {
        activateFeedback(visible[0].getAttribute('data-feedback-index') || '');
      } else {
        activateFeedback(activeIndex);
      }
    }

    function updateStatus(select) {
      var panel = select.closest('[data-feedback-panel]');

      if (!panel) {
        return;
      }

      var selectedOption = select.options[select.selectedIndex];
      var status = String(select.value || 'open');
      var statusLabel = selectedOption ? selectedOption.textContent.trim() : status;
      var index = panel.getAttribute('data-feedback-index') || '';
      var selector = selectorByIndex(index);
      var pill = panel.querySelector('[data-feedback-status-pill]');

      panel.setAttribute('data-feedback-status', status);

      if (pill) {
        pill.textContent = statusLabel;
        setStatusClasses(pill, '', status);
      }

      if (selector) {
        selector.setAttribute('data-feedback-status', status);
        selector.setAttribute('data-feedback-status-label', statusLabel);
        setStatusClasses(selector, 'is-', status);

        var meta = selector.querySelector('[data-feedback-select-meta]');
        var typeLabel = selector.getAttribute('data-feedback-type-label') || 'Feedback';
        var submitted = selector.getAttribute('data-feedback-submitted') || '';

        if (meta) {
          meta.textContent = typeLabel + ' / ' + submitted + ' / ' + statusLabel;
        }
      }

      updateQueue();
    }

    selectors.forEach(function (selector) {
      selector.addEventListener('click', function () {
        activateFeedback(selector.getAttribute('data-feedback-index') || '');
      });
    });

    panels.forEach(function (panel) {
      toArray(panel.querySelectorAll('[data-feedback-status-select]')).forEach(function (select) {
        select.addEventListener('change', function () {
          updateStatus(select);
        });
      });
    });

    [search, statusFilter, typeFilter, workflowFilter, sortSelect].forEach(function (control) {
      if (!control) {
        return;
      }

      control.addEventListener(control === search ? 'input' : 'change', updateQueue);
    });

    if (resetButton) {
      resetButton.addEventListener('click', function () {
        if (search) {
          search.value = '';
        }

        if (statusFilter) {
          statusFilter.value = '';
        }

        if (typeFilter) {
          typeFilter.value = '';
        }

        if (workflowFilter) {
          workflowFilter.value = 'all';
        }

        if (sortSelect) {
          sortSelect.value = 'newest';
        }

        updateQueue();
      });
    }

    updateQueue();
  }

  workbenches.forEach(initWorkbench);
}());
