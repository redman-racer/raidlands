(function () {
  var editors = Array.prototype.slice.call(document.querySelectorAll('[data-admin-store-editor]'));

  if (!editors.length) {
    return;
  }

  function toArray(nodes) {
    return Array.prototype.slice.call(nodes || []);
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function numberValue(element, attribute, fallback) {
    var value = Number(element.getAttribute(attribute) || fallback || 0);

    return Number.isFinite(value) ? value : 0;
  }

  function selectorLabel(selector) {
    var label = selector.querySelector('[data-admin-store-select-label]');

    return label ? label.textContent.trim() : '';
  }

  function selectorForPanel(editor, panel) {
    if (!panel || !panel.id) {
      return null;
    }

    return editor.querySelector('[data-admin-store-target="' + panel.id + '"]');
  }

  function productIdInput(panel) {
    var inputs = toArray(panel.querySelectorAll('input[name^="store_products"][name$="[id]"]'));

    return inputs.find(function (input) {
      return !input.name.match(/\[(rp_prices|cash_pass_prices|cash_subscription_prices)\]/);
    }) || inputs[0] || null;
  }

  function selectedOptionText(select) {
    var option = select && select.options ? select.options[select.selectedIndex] : null;

    return option ? option.text.trim() : '';
  }

  function plainText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function pushPart(parts, value) {
    var text = plainText(value);

    if (text !== '') {
      parts.push(text);
    }
  }

  function isMeaningfulAmount(value) {
    var text = String(value || '').trim();
    var numeric = Number(text);

    return text !== '' && Number.isFinite(numeric) && numeric > 0;
  }

  function collectPriceSearchParts(panel) {
    var parts = [];

    toArray(panel.querySelectorAll('.admin-rp-offer-card')).forEach(function (card) {
      var controls = toArray(card.querySelectorAll('input'));
      var configured = controls.some(function (control) {
        if (control.type === 'checkbox') {
          return control.checked;
        }

        if (control.name.indexOf('[stripe_price_id]') !== -1) {
          return plainText(control.value) !== '';
        }

        if (control.name.indexOf('[rp_cost]') !== -1 || control.name.indexOf('[amount_dollars]') !== -1) {
          return isMeaningfulAmount(control.value);
        }

        return false;
      });

      if (!configured) {
        return;
      }

      controls.forEach(function (control) {
        if (control.type === 'checkbox') {
          if (control.checked) {
            pushPart(parts, 'active offer');
          }

          return;
        }

        if (control.name.match(/\[id\]$/)) {
          return;
        }

        pushPart(parts, control.value);
      });
    });

    return parts;
  }

  function checkedLabelParts(panel) {
    var parts = [];

    toArray(panel.querySelectorAll('.admin-store-kit-grid .admin-check input:checked')).forEach(function (input) {
      var row = input.closest('.admin-check');
      var label = row ? row.querySelector('span') : null;

      pushPart(parts, label ? label.textContent : input.value);
    });

    return parts;
  }

  function productStatus(panel) {
    var idInput = productIdInput(panel);

    if (!idInput || !String(idInput.value || '').trim()) {
      return 'draft';
    }

    var activeInput = panel.querySelector('[data-admin-store-active-input]');

    return activeInput && activeInput.checked ? 'active' : 'inactive';
  }

  function statusLabel(status) {
    if (status === 'active') {
      return 'Active';
    }

    if (status === 'inactive') {
      return 'Inactive';
    }

    return 'Draft slot';
  }

  function productTitle(panel) {
    var input = panel.querySelector('[data-admin-store-name-input]');

    return plainText(input ? input.value : '') || 'New Store Product';
  }

  function productCategory(panel) {
    var select = panel.querySelector('[data-admin-store-type-select]');
    var value = select ? String(select.value || '') : '';
    var label = selectedOptionText(select) || value;

    return {
      value: value,
      label: label
    };
  }

  function productGroup(panel) {
    var input = panel.querySelector('[data-admin-store-group-input]');

    return plainText(input ? input.value : '');
  }

  function countActiveOffers(panel, sectionName) {
    return toArray(panel.querySelectorAll('input[type="checkbox"][name*="[' + sectionName + ']"][name$="[is_active]"]:checked')).length;
  }

  function collectPanelSearch(panel) {
    var parts = [];
    var category = productCategory(panel);
    var slug = panel.querySelector('[data-admin-store-slug-input]');
    var featured = panel.querySelector('[data-admin-store-featured-input]');
    var stackable = panel.querySelector('[data-admin-store-stackable-input]');

    pushPart(parts, productTitle(panel));
    pushPart(parts, slug ? slug.value : '');
    pushPart(parts, category.label);
    pushPart(parts, category.value);
    pushPart(parts, statusLabel(productStatus(panel)));
    pushPart(parts, productGroup(panel));

    toArray(panel.querySelectorAll('[data-admin-store-copy-input]')).forEach(function (input) {
      pushPart(parts, input.value);
    });

    if (featured && featured.checked) {
      pushPart(parts, 'featured');
    }

    if (stackable) {
      pushPart(parts, stackable.checked ? 'stackable' : 'non-stackable');
    }

    checkedLabelParts(panel).forEach(function (part) {
      pushPart(parts, part);
    });

    collectPriceSearchParts(panel).forEach(function (part) {
      pushPart(parts, part);
    });

    return parts.join(' ');
  }

  function updateSelectorFromPanel(editor, panel) {
    var selector = selectorForPanel(editor, panel);

    if (!selector) {
      return;
    }

    var title = productTitle(panel);
    var category = productCategory(panel);
    var status = productStatus(panel);
    var group = productGroup(panel);
    var rpCount = countActiveOffers(panel, 'rp_prices');
    var cashCount = countActiveOffers(panel, 'cash_pass_prices') + countActiveOffers(panel, 'cash_subscription_prices');
    var sortInput = panel.querySelector('[data-admin-store-sort-input]');
    var label = selector.querySelector('[data-admin-store-select-label]');
    var meta = selector.querySelector('[data-admin-store-select-meta]');
    var heading = panel.querySelector('[data-admin-store-card-title]');
    var subtitle = panel.querySelector('.admin-feedback-subtitle');
    var metaText = statusLabel(status) + ' / ' + (group || 'No group') + ' / ' + rpCount + ' RP, ' + cashCount + ' cash';

    if (label) {
      label.textContent = title;
    }

    if (heading) {
      heading.textContent = title;
    }

    if (meta) {
      meta.textContent = metaText;
    }

    if (subtitle) {
      subtitle.textContent = statusLabel(status) + ' / ' + (group || 'No group selected');
    }

    selector.classList.toggle('is-draft', status === 'draft');
    selector.setAttribute('data-admin-store-category', category.value);
    selector.setAttribute('data-admin-store-category-label', category.label);
    selector.setAttribute('data-admin-store-status', status);
    selector.setAttribute('data-admin-store-sort-order', sortInput ? String(sortInput.value || '100') : '100');
    selector.setAttribute('data-admin-store-search', collectPanelSearch(panel));
  }

  function activatePanel(editor, targetId) {
    var panels = toArray(editor.querySelectorAll('[data-admin-store-panel]'));
    var selectors = toArray(editor.querySelectorAll('[data-admin-store-select]'));

    panels.forEach(function (panel) {
      var isActive = targetId !== '' && panel.id === targetId;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
    });

    selectors.forEach(function (selector) {
      var isActive = targetId !== '' && selector.getAttribute('data-admin-store-target') === targetId;
      selector.classList.toggle('is-active', isActive);

      if (isActive) {
        selector.setAttribute('aria-current', 'true');
      } else {
        selector.removeAttribute('aria-current');
      }
    });
  }

  function sortSelectors(selectors, sortMode) {
    var statusRank = {
      active: 10,
      inactive: 20,
      draft: 30
    };

    function draftRank(selector) {
      return selector.getAttribute('data-admin-store-status') === 'draft' ? 1 : 0;
    }

    function byTitle(a, b) {
      return selectorLabel(a).localeCompare(selectorLabel(b));
    }

    function byPublicOrder(a, b) {
      return draftRank(a) - draftRank(b)
        || numberValue(a, 'data-admin-store-sort-order', 100) - numberValue(b, 'data-admin-store-sort-order', 100)
        || byTitle(a, b);
    }

    return selectors.slice().sort(function (a, b) {
      if (sortMode === 'name') {
        return byTitle(a, b) || byPublicOrder(a, b);
      }

      if (sortMode === 'category') {
        return String(a.getAttribute('data-admin-store-category-label') || '').localeCompare(String(b.getAttribute('data-admin-store-category-label') || ''))
          || byPublicOrder(a, b);
      }

      if (sortMode === 'status') {
        return (statusRank[a.getAttribute('data-admin-store-status') || 'draft'] || 99) - (statusRank[b.getAttribute('data-admin-store-status') || 'draft'] || 99)
          || byPublicOrder(a, b);
      }

      return byPublicOrder(a, b);
    });
  }

  function selectorMatches(selector, filters) {
    if (filters.category && selector.getAttribute('data-admin-store-category') !== filters.category) {
      return false;
    }

    if (filters.status && selector.getAttribute('data-admin-store-status') !== filters.status) {
      return false;
    }

    if (!filters.query) {
      return true;
    }

    var searchText = normalize(selector.getAttribute('data-admin-store-search'));
    var terms = filters.query.split(/\s+/).filter(Boolean);

    return terms.every(function (term) {
      return searchText.indexOf(term) !== -1;
    });
  }

  function initStoreEditor(editor) {
    var panels = toArray(editor.querySelectorAll('[data-admin-store-panel]'));
    var selectors = toArray(editor.querySelectorAll('[data-admin-store-select]'));
    var list = editor.querySelector('.admin-store-picker-list');
    var search = editor.querySelector('[data-admin-store-search]');
    var categoryFilter = editor.querySelector('[data-admin-store-category-filter]');
    var statusFilter = editor.querySelector('[data-admin-store-status-filter]');
    var sortSelect = editor.querySelector('[data-admin-store-sort]');
    var resetButton = editor.querySelector('[data-admin-store-reset]');
    var resultCount = editor.querySelector('[data-admin-store-result-count]');
    var empty = editor.querySelector('[data-admin-store-empty]');
    var activePanel = panels.find(function (panel) {
      return panel.classList.contains('is-active');
    }) || panels[0];
    var activeTargetId = activePanel && activePanel.id ? activePanel.id : '';

    function filters() {
      return {
        query: normalize(search ? search.value : ''),
        category: categoryFilter ? String(categoryFilter.value || '') : '',
        status: statusFilter ? String(statusFilter.value || '') : '',
        sort: sortSelect ? String(sortSelect.value || 'order') : 'order'
      };
    }

    function setActive(targetId) {
      activeTargetId = targetId || '';
      activatePanel(editor, activeTargetId);
    }

    function applyFilters() {
      var currentFilters = filters();
      var visible = [];

      sortSelectors(selectors, currentFilters.sort).forEach(function (selector) {
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
        resultCount.textContent = visible.length + ' product' + (visible.length === 1 ? '' : 's') + ' shown';
      }

      if (empty) {
        empty.hidden = visible.length !== 0;
      }

      if (!visible.length) {
        setActive('');
        return;
      }

      var activeSelector = selectors.find(function (selector) {
        return selector.getAttribute('data-admin-store-target') === activeTargetId;
      });

      if (!activeSelector || activeSelector.hidden) {
        setActive(visible[0].getAttribute('data-admin-store-target') || '');
      } else {
        setActive(activeTargetId);
      }
    }

    function resetFilters() {
      if (search) {
        search.value = '';
      }

      [categoryFilter, statusFilter].forEach(function (select) {
        if (select) {
          select.value = '';
        }
      });

      if (sortSelect) {
        sortSelect.value = 'order';
      }

      applyFilters();
    }

    selectors.forEach(function (selector) {
      selector.addEventListener('click', function () {
        setActive(selector.getAttribute('data-admin-store-target') || '');
      });
    });

    panels.forEach(function (panel) {
      var refreshPanel = function () {
        updateSelectorFromPanel(editor, panel);
        applyFilters();
      };

      toArray(panel.querySelectorAll('input, select, textarea')).forEach(function (control) {
        control.addEventListener('input', refreshPanel);
        control.addEventListener('change', refreshPanel);
      });

      updateSelectorFromPanel(editor, panel);
    });

    [search, categoryFilter, statusFilter, sortSelect].forEach(function (control) {
      if (!control) {
        return;
      }

      control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', applyFilters);
    });

    if (resetButton) {
      resetButton.addEventListener('click', resetFilters);
    }

    applyFilters();
  }

  editors.forEach(initStoreEditor);
}());
