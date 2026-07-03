(function () {
  var editors = Array.prototype.slice.call(document.querySelectorAll('[data-admin-feature-editor]'));

  function toArray(nodes) {
    return Array.prototype.slice.call(nodes || []);
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function numberValue(element, attribute) {
    var value = Number(element.getAttribute(attribute) || 0);

    return Number.isFinite(value) ? value : 0;
  }

  function parseDateValue(value) {
    var normalized = String(value || '').trim();

    if (!normalized) {
      return 0;
    }

    var timestamp = Date.parse(normalized.replace(' ', 'T'));

    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  function selectorByIndex(selectors, index) {
    return selectors.find(function (selector) {
      return selector.getAttribute('data-feature-index') === String(index);
    });
  }

  function selectorLabel(selector) {
    var label = selector.querySelector('[data-feature-select-label]');

    return label ? label.textContent.trim() : '';
  }

  function compareStaffOrder(a, b) {
    var statusRank = {
      active: 10,
      voting: 20,
      in_development: 30,
      planned: 40,
      under_review: 50,
      archived: 60
    };

    return (statusRank[a.getAttribute('data-feature-status') || 'under_review'] || 99) - (statusRank[b.getAttribute('data-feature-status') || 'under_review'] || 99)
      || numberValue(a, 'data-feature-order') - numberValue(b, 'data-feature-order')
      || selectorLabel(a).localeCompare(selectorLabel(b));
  }

  function sortFeatureSelectors(selectors, sortMode) {
    return selectors.slice().sort(function (a, b) {
      if (sortMode === 'title') {
        return selectorLabel(a).localeCompare(selectorLabel(b)) || compareStaffOrder(a, b);
      }

      if (sortMode === 'support') {
        return numberValue(b, 'data-feature-support') - numberValue(a, 'data-feature-support')
          || numberValue(b, 'data-feature-suggestions') - numberValue(a, 'data-feature-suggestions')
          || numberValue(b, 'data-feature-votes') - numberValue(a, 'data-feature-votes')
          || compareStaffOrder(a, b);
      }

      if (sortMode === 'votes') {
        return numberValue(b, 'data-feature-votes') - numberValue(a, 'data-feature-votes')
          || numberValue(b, 'data-feature-support') - numberValue(a, 'data-feature-support')
          || compareStaffOrder(a, b);
      }

      if (sortMode === 'updated') {
        return parseDateValue(b.getAttribute('data-feature-updated')) - parseDateValue(a.getAttribute('data-feature-updated'))
          || compareStaffOrder(a, b);
      }

      return compareStaffOrder(a, b);
    });
  }

  function featureMatches(selector, filters) {
    if (filters.status && selector.getAttribute('data-feature-status') !== filters.status) {
      return false;
    }

    if (filters.category && selector.getAttribute('data-feature-category') !== filters.category) {
      return false;
    }

    if (filters.visibility && selector.getAttribute('data-feature-visibility') !== filters.visibility) {
      return false;
    }

    if (filters.voting && selector.getAttribute('data-feature-voting') !== filters.voting) {
      return false;
    }

    if (!filters.query) {
      return true;
    }

    var searchText = normalize(selector.getAttribute('data-feature-search'));
    var terms = filters.query.split(/\s+/).filter(Boolean);

    return terms.every(function (term) {
      return searchText.indexOf(term) !== -1;
    });
  }

  function updateFeatureMeta(selectors, panel) {
    if (!panel) {
      return;
    }

    var index = panel.getAttribute('data-feature-index') || '0';
    var selector = selectorByIndex(selectors, index);
    var meta = selector ? selector.querySelector('[data-feature-select-meta]') : null;
    var subtitle = panel.querySelector('[data-feature-card-subtitle]');
    var titleInput = panel.querySelector('[data-feature-title-input]');
    var categoryInput = panel.querySelector('[data-feature-category-input]');
    var summaryInput = panel.querySelector('[data-feature-summary-input]');
    var statusSelect = panel.querySelector('[data-feature-status-select]');
    var publicInput = panel.querySelector('[data-feature-public-input]');
    var voteableInput = panel.querySelector('[data-feature-voteable-input]');
    var sortInput = panel.querySelector('[data-feature-sort-input]');
    var idInput = panel.querySelector('input[name$="[id]"]');
    var title = titleInput ? titleInput.value.trim() : '';
    var category = categoryInput ? categoryInput.value.trim() : '';
    var summary = summaryInput ? summaryInput.value.trim() : '';
    var isDraft = idInput && (!idInput.value || idInput.value === '0');
    var selectedOption = statusSelect ? statusSelect.options[statusSelect.selectedIndex] : null;
    var status = selectedOption ? selectedOption.text : 'Under Review';
    var statusValue = statusSelect ? String(statusSelect.value || '').toLowerCase() : '';
    var visibilityValue = publicInput && publicInput.checked ? 'public' : 'hidden';
    var visibility = visibilityValue === 'public' ? 'Public' : 'Hidden';
    var votingValue = statusValue === 'voting' && voteableInput && voteableInput.checked ? 'voting' : 'not-voting';
    var voting = votingValue === 'voting' ? 'voting open' : 'not in voting';
    var support = selector ? selector.getAttribute('data-feature-support') || '0' : '0';
    var copy = isDraft && !title ? 'Draft slot / blank rows are ignored' : status + ' / ' + visibility + ', ' + voting + ' / score ' + support;

    if (meta) {
      meta.textContent = copy;
    }

    if (subtitle) {
      subtitle.textContent = isDraft && !title ? 'Blank rows are ignored until you add a title.' : copy;
    }

    if (selector) {
      selector.classList.toggle('is-archived', statusValue === 'archived');
      selector.classList.toggle('is-draft', !!isDraft);
      selector.setAttribute('data-feature-status', statusValue || 'under_review');
      selector.setAttribute('data-feature-category', category);
      selector.setAttribute('data-feature-visibility', visibilityValue);
      selector.setAttribute('data-feature-voting', votingValue);
      selector.setAttribute('data-feature-order', sortInput ? String(sortInput.value || '100') : selector.getAttribute('data-feature-order') || '100');
      selector.setAttribute('data-feature-search', [title, category, summary, statusValue, status, visibility, voting].join(' '));
    }
  }

  function initFeatureEditor(editor) {
    var panels = toArray(editor.querySelectorAll('[data-feature-panel]'));
    var selectors = toArray(editor.querySelectorAll('[data-feature-select]'));
    var list = editor.querySelector('.admin-feature-picker-list');
    var addButton = editor.querySelector('[data-feature-add]');
    var search = editor.querySelector('.admin-feature-picker-controls input[data-feature-search]');
    var statusFilter = editor.querySelector('[data-feature-status-filter]');
    var categoryFilter = editor.querySelector('[data-feature-category-filter]');
    var visibilityFilter = editor.querySelector('[data-feature-visibility-filter]');
    var votingFilter = editor.querySelector('[data-feature-voting-filter]');
    var sortSelect = editor.querySelector('[data-feature-sort]');
    var resetButton = editor.querySelector('[data-feature-reset]');
    var resultCount = editor.querySelector('[data-feature-result-count]');
    var empty = editor.querySelector('[data-feature-empty]');
    var activePanel = panels.find(function (panel) {
      return panel.classList.contains('is-active');
    }) || panels[0];
    var activeIndex = activePanel ? activePanel.getAttribute('data-feature-index') || '0' : '0';

    function activateFeature(index) {
      activeIndex = String(index || '');

      panels.forEach(function (panel) {
        var isActive = activeIndex !== '' && panel.getAttribute('data-feature-index') === activeIndex;

        panel.hidden = !isActive;
        panel.classList.toggle('is-active', isActive);
      });

      selectors.forEach(function (selector) {
        var isActive = activeIndex !== '' && selector.getAttribute('data-feature-index') === activeIndex;

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
        category: categoryFilter ? String(categoryFilter.value || '') : '',
        visibility: visibilityFilter ? String(visibilityFilter.value || '') : '',
        voting: votingFilter ? String(votingFilter.value || '') : '',
        sort: sortSelect ? String(sortSelect.value || 'staff') : 'staff'
      };
    }

    function applyFilters() {
      var currentFilters = filters();
      var sorted = sortFeatureSelectors(selectors, currentFilters.sort);
      var visible = [];

      sorted.forEach(function (selector) {
        if (list) {
          list.appendChild(selector);
        }

        var isVisible = featureMatches(selector, currentFilters);
        selector.hidden = !isVisible;

        if (isVisible) {
          visible.push(selector);
        }
      });

      if (resultCount) {
        resultCount.textContent = visible.length + ' feature' + (visible.length === 1 ? '' : 's') + ' shown';
      }

      if (empty) {
        empty.hidden = visible.length !== 0;
      }

      if (!visible.length) {
        activateFeature('');
        return;
      }

      var activeSelector = selectorByIndex(selectors, activeIndex);

      if (!activeSelector || activeSelector.hidden) {
        activateFeature(visible[0].getAttribute('data-feature-index') || '');
      } else {
        activateFeature(activeIndex);
      }
    }

    function resetFilters() {
      if (search) {
        search.value = '';
      }

      [statusFilter, categoryFilter, visibilityFilter, votingFilter].forEach(function (select) {
        if (select) {
          select.value = '';
        }
      });

      if (sortSelect) {
        sortSelect.value = 'staff';
      }

      applyFilters();
    }

    function activateDraftFeature() {
      resetFilters();

      var draftPanel = panels.find(function (panel) {
        var idInput = panel.querySelector('input[name$="[id]"]');

        return idInput && (!idInput.value || idInput.value === '0');
      }) || panels[panels.length - 1];

      if (!draftPanel) {
        return;
      }

      activateFeature(draftPanel.getAttribute('data-feature-index') || '0');

      var titleInput = draftPanel.querySelector('[data-feature-title-input]');

      if (titleInput) {
        titleInput.focus();
        titleInput.select();
      }
    }

    function updateFeatureTitle(input) {
      var panel = input.closest('[data-feature-panel]');

      if (!panel) {
        return;
      }

      var title = input.value.trim() || 'New Feature';
      var heading = panel.querySelector('[data-feature-card-title]');
      var selector = selectorByIndex(selectors, panel.getAttribute('data-feature-index'));

      if (heading) {
        heading.textContent = title;
      }

      if (selector) {
        var label = selector.querySelector('[data-feature-select-label]');

        if (label) {
          label.textContent = title;
        }
      }

      updateFeatureMeta(selectors, panel);
      applyFilters();
    }

    selectors.forEach(function (selector) {
      selector.addEventListener('click', function () {
        activateFeature(selector.getAttribute('data-feature-index') || '0');
      });
    });

    panels.forEach(function (panel) {
      toArray(panel.querySelectorAll('[data-feature-title-input]')).forEach(function (input) {
        input.addEventListener('input', function () {
          updateFeatureTitle(input);
        });
      });

      toArray(panel.querySelectorAll('[data-feature-category-input], [data-feature-summary-input], [data-feature-sort-input]')).forEach(function (control) {
        control.addEventListener('input', function () {
          updateFeatureMeta(selectors, panel);
          applyFilters();
        });
      });

      toArray(panel.querySelectorAll('[data-feature-status-select], [data-feature-public-input], [data-feature-voteable-input]')).forEach(function (control) {
        control.addEventListener('change', function () {
          updateFeatureMeta(selectors, panel);
          applyFilters();
        });
      });
    });

    [search, statusFilter, categoryFilter, visibilityFilter, votingFilter, sortSelect].forEach(function (control) {
      if (!control) {
        return;
      }

      control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', applyFilters);
    });

    if (resetButton) {
      resetButton.addEventListener('click', resetFilters);
    }

    if (addButton) {
      addButton.addEventListener('click', activateDraftFeature);
    }

    panels.forEach(function (panel) {
      updateFeatureMeta(selectors, panel);
    });
    applyFilters();
  }

  function queueItemMatches(item, filters) {
    if (filters.status && item.getAttribute('data-feature-queue-status') !== filters.status) {
      return false;
    }

    if (filters.source && item.getAttribute('data-feature-queue-source') !== filters.source) {
      return false;
    }

    if (!filters.query) {
      return true;
    }

    var searchText = normalize(item.getAttribute('data-feature-queue-search'));
    var terms = filters.query.split(/\s+/).filter(Boolean);

    return terms.every(function (term) {
      return searchText.indexOf(term) !== -1;
    });
  }

  function sortQueueItems(items, sortMode) {
    return items.slice().sort(function (a, b) {
      if (sortMode === 'oldest') {
        return parseDateValue(a.getAttribute('data-feature-queue-created')) - parseDateValue(b.getAttribute('data-feature-queue-created'))
          || String(a.getAttribute('data-feature-queue-title') || '').localeCompare(String(b.getAttribute('data-feature-queue-title') || ''));
      }

      if (sortMode === 'title') {
        return String(a.getAttribute('data-feature-queue-title') || '').localeCompare(String(b.getAttribute('data-feature-queue-title') || ''))
          || parseDateValue(b.getAttribute('data-feature-queue-updated')) - parseDateValue(a.getAttribute('data-feature-queue-updated'));
      }

      if (sortMode === 'source') {
        return String(a.getAttribute('data-feature-queue-source') || '').localeCompare(String(b.getAttribute('data-feature-queue-source') || ''))
          || parseDateValue(b.getAttribute('data-feature-queue-created')) - parseDateValue(a.getAttribute('data-feature-queue-created'));
      }

      if (sortMode === 'status') {
        return String(a.getAttribute('data-feature-queue-status') || '').localeCompare(String(b.getAttribute('data-feature-queue-status') || ''))
          || parseDateValue(b.getAttribute('data-feature-queue-updated')) - parseDateValue(a.getAttribute('data-feature-queue-updated'));
      }

      return parseDateValue(b.getAttribute('data-feature-queue-updated')) - parseDateValue(a.getAttribute('data-feature-queue-updated'))
        || parseDateValue(b.getAttribute('data-feature-queue-created')) - parseDateValue(a.getAttribute('data-feature-queue-created'));
    });
  }

  function initFeatureQueue(queue) {
    var list = queue.querySelector('[data-feature-queue-list]');
    var items = toArray(queue.querySelectorAll('[data-feature-queue-item]'));
    var search = queue.querySelector('[data-feature-queue-search]');
    var statusFilter = queue.querySelector('[data-feature-queue-status]');
    var sourceFilter = queue.querySelector('[data-feature-queue-source]');
    var sortSelect = queue.querySelector('[data-feature-queue-sort]');
    var resetButton = queue.querySelector('[data-feature-queue-reset]');
    var count = queue.querySelector('[data-feature-queue-count]');
    var empty = queue.querySelector('[data-feature-queue-empty]');
    var noun = items.length && items[0].tagName === 'TR' ? 'decision' : 'suggestion';

    function filters() {
      return {
        query: normalize(search ? search.value : ''),
        status: statusFilter ? String(statusFilter.value || '') : '',
        source: sourceFilter ? String(sourceFilter.value || '') : '',
        sort: sortSelect ? String(sortSelect.value || 'newest') : 'newest'
      };
    }

    function updateQueue() {
      var currentFilters = filters();
      var visible = [];

      sortQueueItems(items, currentFilters.sort).forEach(function (item) {
        if (list) {
          list.appendChild(item);
        }

        var isVisible = queueItemMatches(item, currentFilters);
        item.hidden = !isVisible;

        if (isVisible) {
          visible.push(item);
        }
      });

      if (count) {
        count.textContent = visible.length + ' ' + noun + (visible.length === 1 ? '' : 's') + ' shown';
      }

      if (empty) {
        empty.hidden = visible.length !== 0;
      }
    }

    function resetQueue() {
      if (search) {
        search.value = '';
      }

      [statusFilter, sourceFilter].forEach(function (select) {
        if (select) {
          select.value = '';
        }
      });

      if (sortSelect) {
        sortSelect.value = 'newest';
      }

      updateQueue();
    }

    [search, statusFilter, sourceFilter, sortSelect].forEach(function (control) {
      if (!control) {
        return;
      }

      control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', updateQueue);
    });

    if (resetButton) {
      resetButton.addEventListener('click', resetQueue);
    }

    updateQueue();
  }

  editors.forEach(initFeatureEditor);
  toArray(document.querySelectorAll('[data-feature-queue]')).forEach(initFeatureQueue);
}());
