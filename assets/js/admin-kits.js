(function () {
  var editor = document.querySelector('[data-admin-kit-editor]');

  if (!editor) {
    return;
  }

  var form = editor.closest('form');
  var panels = Array.prototype.slice.call(editor.querySelectorAll('[data-kit-panel]'));
  var selectors = Array.prototype.slice.call(editor.querySelectorAll('[data-kit-select]'));
  var expectedInput = form ? form.querySelector('input[name="kit_expected_items"]') : null;
  var saveModeInput = form ? form.querySelector('[data-kit-save-mode]') : null;
  var catalog = [];
  var itemByShortname = new Map();
  var assetsBase = editor.getAttribute('data-assets-base') || '../assets/';
  var activeIndex = panels.length ? panels[0].getAttribute('data-kit-index') : '0';
  var activeSlot = null;
  var dirtyPanelIndexes = new Set();
  var helpId = 0;
  var lastMatches = [];

  function normalizeShortname(value) {
    return String(value || '').trim().toLowerCase();
  }

  function assetPath(path) {
    path = String(path || '').trim();

    if (!path) {
      return '';
    }

    if (/^https?:\/\//i.test(path) || path.charAt(0) === '/') {
      return path;
    }

    return assetsBase + path.replace(/^assets\//, '');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function helpMarkup(label, help) {
    return [
      '<span class="admin-label-row">',
      '<span>' + escapeHtml(label) + '</span>',
      '<span class="admin-tooltip" tabindex="0" aria-label="' + escapeHtml(help) + '">?</span>',
      '</span>',
      '<small class="admin-help-text">' + escapeHtml(help) + '</small>'
    ].join('');
  }

  function helpAttributes(help) {
    return ' title="' + escapeHtml(help) + '"';
  }

  function modalInput(spec) {
    var classes = 'admin-field' + (spec.span ? ' admin-span-all' : '');
    var attrs = [
      spec.type ? 'type="' + escapeHtml(spec.type) + '"' : '',
      spec.field ? 'data-modal-field="' + escapeHtml(spec.field) + '"' : '',
      spec.search ? 'data-modal-search' : '',
      spec.list ? 'list="' + escapeHtml(spec.list) + '"' : '',
      spec.placeholder ? 'placeholder="' + escapeHtml(spec.placeholder) + '"' : '',
      spec.maxlength ? 'maxlength="' + escapeHtml(spec.maxlength) + '"' : '',
      spec.min != null ? 'min="' + escapeHtml(spec.min) + '"' : '',
      spec.max != null ? 'max="' + escapeHtml(spec.max) + '"' : '',
      spec.step != null ? 'step="' + escapeHtml(spec.step) + '"' : '',
      helpAttributes(spec.help)
    ].filter(Boolean).join(' ');
    var control = spec.textarea
      ? '<textarea ' + attrs + ' rows="' + escapeHtml(spec.rows || 2) + '"></textarea>'
      : '<input ' + attrs + '>';

    return '<label class="' + classes + '">' + helpMarkup(spec.label, spec.help) + control + '</label>';
  }

  function ensureHelpId(help) {
    if (!help.id) {
      helpId += 1;
      help.id = 'admin-field-help-' + helpId;
    }

    return help.id;
  }

  function hydrateFieldTooltips(root) {
    Array.prototype.slice.call((root || document).querySelectorAll('.admin-field, .admin-check')).forEach(function (field) {
      var help = field.querySelector('.admin-help-text');

      if (!help) {
        return;
      }

      var text = help.textContent.trim();
      var id = ensureHelpId(help);

      Array.prototype.slice.call(field.querySelectorAll('input, textarea, select')).filter(function (control) {
        return !field.classList.contains('admin-field') || !control.closest('.admin-check');
      }).forEach(function (control) {
        var describedBy = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);

        if (!control.title) {
          control.title = text;
        }

        if (describedBy.indexOf(id) === -1) {
          describedBy.push(id);
          control.setAttribute('aria-describedby', describedBy.join(' '));
        }
      });
    });
  }

  function panelByIndex(index) {
    return panels.find(function (panel) {
      return panel.getAttribute('data-kit-index') === String(index);
    });
  }

  function selectorByIndex(index) {
    return selectors.find(function (selector) {
      return selector.getAttribute('data-kit-index') === String(index);
    });
  }

  function setPanelEnabled(panel, enabled) {
    Array.prototype.slice.call(panel.querySelectorAll('input, textarea, select, button')).forEach(function (control) {
      control.disabled = !enabled;
    });
  }

  function expectedForPanel(panel) {
    return { compact: true };
  }

  function panelIndex(panel) {
    return panel ? panel.getAttribute('data-kit-index') : null;
  }

  function shouldSubmitPanel(panel) {
    var index = panelIndex(panel);

    return index !== null && index !== '' && (index === activeIndex || dirtyPanelIndexes.has(index));
  }

  function markPanelDirty(panel) {
    var index = panelIndex(panel);

    if (index !== null && index !== '') {
      dirtyPanelIndexes.add(index);
    }
  }

  function updateExpectedInput() {
    if (!expectedInput) {
      return;
    }

    var expected = {};

    panels.forEach(function (panel) {
      var index = panelIndex(panel);

      if (shouldSubmitPanel(panel)) {
        expected[index] = expectedForPanel(panel);
      }
    });

    expectedInput.value = JSON.stringify(expected);
  }

  function setSubmitPanelsEnabled() {
    panels.forEach(function (panel) {
      setPanelEnabled(panel, shouldSubmitPanel(panel));
    });
  }

  function activateKit(index) {
    activeIndex = String(index);

    panels.forEach(function (panel) {
      var isActive = panel.getAttribute('data-kit-index') === activeIndex;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
      setPanelEnabled(panel, isActive);
    });

    selectors.forEach(function (selector) {
      var isActive = selector.getAttribute('data-kit-index') === activeIndex;
      selector.classList.toggle('is-active', isActive);

      if (isActive) {
        selector.setAttribute('aria-current', 'true');
      } else {
        selector.removeAttribute('aria-current');
      }
    });

    updateExpectedInput();
  }

  function updateKitTitle(input) {
    var panel = input.closest('[data-kit-panel]');

    if (!panel) {
      return;
    }

    var index = panel.getAttribute('data-kit-index');
    var title = input.value.trim() || 'New Kit';
    var heading = panel.querySelector('[data-kit-card-title]');
    var selector = selectorByIndex(index);

    if (heading) {
      heading.textContent = title;
    }

    if (selector) {
      var label = selector.querySelector('[data-kit-select-label]');

      if (label) {
        label.textContent = title;
      }
    }
  }

  function getSlotFields(slotWrap) {
    var fields = {};

    Array.prototype.slice.call(slotWrap.querySelectorAll('[data-kit-item-field]')).forEach(function (field) {
      fields[field.getAttribute('data-kit-item-field')] = field;
    });

    return fields;
  }

  function fieldValue(fields, name, fallback) {
    return fields[name] ? fields[name].value : fallback;
  }

  function setFieldValue(fields, name, value) {
    if (fields[name]) {
      fields[name].value = value == null ? '' : String(value);
    }
  }

  function compactItemsInput(panel) {
    var input = panel.querySelector('[data-kit-items-json]');
    var index = panelIndex(panel);

    if (!input && index !== null && index !== '') {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'kits[' + index + '][items_json]';
      input.setAttribute('data-kit-items-json', '');
      panel.appendChild(input);
    }

    return input;
  }

  function collectPanelItems(panel) {
    var items = {
      main: [],
      wear: [],
      belt: []
    };

    Array.prototype.slice.call(panel.querySelectorAll('[data-kit-slot-wrap]')).forEach(function (slotWrap) {
      var fields = getSlotFields(slotWrap);
      var shortname = normalizeShortname(fieldValue(fields, 'shortname', ''));
      var button = slotWrap.querySelector('[data-kit-slot]');
      var container = button ? button.getAttribute('data-container') : '';
      var row = {};

      if (!shortname || !items[container]) {
        return;
      }

      Object.keys(fields).forEach(function (name) {
        row[name] = name === 'shortname' ? shortname : fields[name].value;
      });

      if (!row.position && button) {
        row.position = button.getAttribute('data-position') || String(items[container].length);
      }

      items[container].push(row);
    });

    return items;
  }

  function prepareCompactItemsForSubmit() {
    panels.forEach(function (panel) {
      if (!shouldSubmitPanel(panel)) {
        return;
      }

      var input = compactItemsInput(panel);

      if (input) {
        input.value = JSON.stringify(collectPanelItems(panel));
        input.disabled = false;
      }

      Array.prototype.slice.call(panel.querySelectorAll('[data-kit-item-field]')).forEach(function (field) {
        field.disabled = true;
      });
    });
  }

  function itemMeta(shortname) {
    return itemByShortname.get(normalizeShortname(shortname)) || null;
  }

  function itemDisplayName(item) {
    var display = String(item && item.display_name ? item.display_name : '').trim();
    var shortname = String(item && item.shortname ? item.shortname : '').trim();

    return display && display.charAt(0) !== '#' ? display : shortname;
  }

  function updateSlotVisual(slotWrap) {
    var fields = getSlotFields(slotWrap);
    var shortname = normalizeShortname(fieldValue(fields, 'shortname', ''));
    var amount = Math.max(1, parseInt(fieldValue(fields, 'amount', '1'), 10) || 1);
    var displayName = fieldValue(fields, 'display_name', '').trim();
    var meta = itemMeta(shortname);
    var title = shortname ? (displayName || (meta && meta.display_name) || shortname) : '';
    var icon = meta && meta.icon ? assetPath(meta.icon) : '';
    var button = slotWrap.querySelector('[data-kit-slot]');
    var iconEl = slotWrap.querySelector('[data-slot-icon]');
    var emptyEl = slotWrap.querySelector('[data-slot-empty]');
    var titleEl = slotWrap.querySelector('[data-slot-title]');
    var amountEl = slotWrap.querySelector('[data-slot-amount]');

    if (button) {
      button.classList.toggle('is-filled', !!shortname);
      button.setAttribute('aria-label', shortname ? 'Edit ' + title : 'Set item for slot');
    }

    if (iconEl) {
      if (icon) {
        iconEl.src = icon;
        iconEl.hidden = false;
      } else {
        iconEl.removeAttribute('src');
        iconEl.hidden = true;
      }
    }

    if (emptyEl) {
      emptyEl.hidden = !!shortname;
    }

    if (titleEl) {
      titleEl.textContent = title;
    }

    if (amountEl) {
      amountEl.textContent = 'x' + amount;
      amountEl.hidden = !shortname || amount <= 1;
    }
  }

  function createModal() {
    var modalFieldSpecs = [
      { label: 'Shortname', help: 'Rust item shortname saved to the kit slot. Pick from the catalog when possible.', type: 'text', field: 'shortname', list: 'admin-kit-shortname-options', maxlength: '160' },
      { label: 'Amount', help: 'Stack amount granted for this item. Most equipment stays at 1.', type: 'number', field: 'amount', min: '1', max: '1000000' },
      { label: 'Skin', help: 'Optional Rust workshop skin ID. Use 0 for the default item skin.', type: 'number', field: 'skin', min: '0' },
      { label: 'Condition', help: 'Current condition value imported from Rust. Leave 0 to let Rust defaults apply.', type: 'number', field: 'condition', min: '0', step: '0.01' },
      { label: 'Max condition', help: 'Maximum saved condition for the item. Usually 0 unless imported kit data needs it.', type: 'number', field: 'max_condition', min: '0', step: '0.01' },
      { label: 'Ammo', help: 'Loaded ammo count for weapons. Leave 0 for items that do not carry ammo.', type: 'number', field: 'ammo', min: '0' },
      { label: 'Ammo type', help: 'Optional ammo shortname for loaded weapons, such as ammo.rifle or ammo.pistol.', type: 'text', field: 'ammo_type', list: 'admin-kit-shortname-options', maxlength: '160' },
      { label: 'Frequency', help: 'RF frequency for pagers and similar items. -1 means no frequency.', type: 'number', field: 'frequency', min: '-1' },
      { label: 'Display name', help: 'Optional custom item name shown by supported Rust UI/plugin surfaces.', type: 'text', field: 'display_name', maxlength: '160' },
      { label: 'Blueprint target', help: 'Optional blueprint target shortname when this slot should grant a blueprint.', type: 'text', field: 'blueprint_shortname', list: 'admin-kit-shortname-options', maxlength: '160' },
      { label: 'Text', help: 'Optional custom text saved on note-like items.', type: 'text', field: 'text', maxlength: '1000', span: true },
      { label: 'Contents JSON', help: 'Advanced imported nested contents JSON. Leave blank unless this item came from Rust with nested contents.', textarea: true, field: 'contents_json', rows: 2, span: true },
      { label: 'Container JSON', help: 'Advanced imported container JSON. Leave blank unless the Rust import needs this exact container data.', textarea: true, field: 'container_json', rows: 2, span: true }
    ];
    var modal = document.createElement('div');
    modal.className = 'admin-kit-item-modal';
    modal.setAttribute('data-kit-modal', '');
    modal.hidden = true;
    modal.innerHTML = [
      '<div class="admin-kit-modal-backdrop" data-modal-close></div>',
      '<section class="admin-kit-modal-panel" role="dialog" aria-modal="true" aria-labelledby="admin-kit-modal-title">',
      '<header class="admin-kit-modal-head">',
      '<div><p class="section-kicker">Slot editor</p><h3 id="admin-kit-modal-title">Set item</h3></div>',
      '<button class="btn btn-ghost" type="button" data-modal-close>Close</button>',
      '</header>',
      '<div class="admin-kit-modal-body">',
      '<div class="admin-kit-modal-top">',
      '<div class="admin-kit-modal-preview">',
      '<img data-modal-icon alt="" hidden>',
      '<span data-modal-empty>+</span>',
      '<strong data-modal-title>Empty slot</strong>',
      '<small data-modal-subtitle></small>',
      '</div>',
      '<div class="admin-kit-catalog-panel">',
      modalInput({ label: 'Search catalog', help: 'Filter the local safe Rust item catalog by display name or shortname, then click an item to use it.', type: 'search', search: true, placeholder: 'rifle.ak, wood, syringe', span: true }),
      '<div class="admin-kit-results-head">',
      '<span data-modal-count>Loading item catalog...</span>',
      '<small>Click an item to fill the slot shortname.</small>',
      '</div>',
      '<div class="admin-kit-item-results" data-modal-results role="listbox" aria-label="Available Rust items"></div>',
      '</div>',
      '</div>',
      '<div class="admin-kit-modal-fieldset">',
      '<div class="admin-subsection-head admin-kit-modal-subhead"><h3>Item values</h3><p>Only shortname and amount are usually needed. Advanced fields preserve imported Rust kit data when present.</p></div>',
      '<div class="admin-grid three admin-kit-modal-fields">',
      modalFieldSpecs.map(modalInput).join(''),
      '</div>',
      '</div>',
      '</div>',
      '<footer class="admin-kit-modal-actions">',
      '<button class="btn btn-secondary" type="button" data-modal-clear>Clear slot</button>',
      '<button class="btn btn-primary" type="button" data-modal-apply>Apply item</button>',
      '</footer>',
      '</section>'
    ].join('');
    document.body.appendChild(modal);
    return modal;
  }

  var modal = createModal();
  var modalFields = {};

  Array.prototype.slice.call(modal.querySelectorAll('[data-modal-field]')).forEach(function (field) {
    modalFields[field.getAttribute('data-modal-field')] = field;
  });

  var modalSearch = modal.querySelector('[data-modal-search]');
  var modalResults = modal.querySelector('[data-modal-results]');
  var modalResultCount = modal.querySelector('[data-modal-count]');
  var modalIcon = modal.querySelector('[data-modal-icon]');
  var modalEmpty = modal.querySelector('[data-modal-empty]');
  var modalTitle = modal.querySelector('[data-modal-title]');
  var modalSubtitle = modal.querySelector('[data-modal-subtitle]');

  hydrateFieldTooltips(editor);
  hydrateFieldTooltips(modal);

  function updateModalPreview() {
    var shortname = normalizeShortname(modalFields.shortname ? modalFields.shortname.value : '');
    var amount = Math.max(1, parseInt(modalFields.amount ? modalFields.amount.value : '1', 10) || 1);
    var displayName = modalFields.display_name ? modalFields.display_name.value.trim() : '';
    var meta = itemMeta(shortname);
    var title = shortname ? (displayName || (meta && meta.display_name) || shortname) : 'Empty slot';
    var icon = meta && meta.icon ? assetPath(meta.icon) : '';

    if (modalTitle) {
      modalTitle.textContent = title;
    }

    if (modalSubtitle) {
      modalSubtitle.textContent = shortname ? shortname + (amount > 1 ? ' / x' + amount : '') : '';
    }

    if (modalIcon) {
      if (icon) {
        modalIcon.src = icon;
        modalIcon.hidden = false;
      } else {
        modalIcon.removeAttribute('src');
        modalIcon.hidden = true;
      }
    }

    if (modalEmpty) {
      modalEmpty.hidden = !!icon;
    }
  }

  function itemMatchesTerm(item, term) {
    var words = String(term || '').split(/\s+/).filter(Boolean);
    var haystack = [
      item.shortname || '',
      itemDisplayName(item),
      item.description || '',
      item.item_id || ''
    ].join(' ').toLowerCase();

    return words.every(function (word) {
      return haystack.indexOf(word) !== -1;
    });
  }

  function scoreItem(item, query) {
    var shortname = String(item.shortname || '').toLowerCase();
    var display = itemDisplayName(item).toLowerCase();

    if (!query) {
      return 40;
    }

    if (shortname === query) {
      return 0;
    }

    if (shortname.indexOf(query) === 0) {
      return 1;
    }

    if (display.indexOf(query) === 0) {
      return 2;
    }

    if (shortname.indexOf(query) !== -1) {
      return 3;
    }

    if (display.indexOf(query) !== -1) {
      return 4;
    }

    return 10;
  }

  function updateResultSelection() {
    if (!modalResults || !modalFields.shortname) {
      return;
    }

    var selected = normalizeShortname(modalFields.shortname.value);

    Array.prototype.slice.call(modalResults.querySelectorAll('[data-result-shortname]')).forEach(function (button) {
      var isSelected = normalizeShortname(button.getAttribute('data-result-shortname')) === selected;

      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
  }

  function renderResults(query) {
    if (!modalResults) {
      return;
    }

    query = normalizeShortname(query);
    var terms = String(query || '').split(',').map(function (term) {
      return normalizeShortname(term);
    }).filter(Boolean);
    var matches = catalog.filter(function (item) {
      if (!terms.length) {
        return true;
      }

      return terms.some(function (term) {
        return itemMatchesTerm(item, term);
      });
    }).sort(function (a, b) {
      return scoreItem(a, query) - scoreItem(b, query)
        || itemDisplayName(a).localeCompare(itemDisplayName(b))
        || String(a.shortname || '').localeCompare(String(b.shortname || ''));
    });

    lastMatches = matches.slice(0, 96);

    if (modalResultCount) {
      if (!catalog.length) {
        modalResultCount.textContent = 'No catalog items loaded yet.';
      } else if (!matches.length) {
        modalResultCount.textContent = 'No matching safe Rust items.';
      } else if (query) {
        modalResultCount.textContent = 'Showing ' + lastMatches.length + ' of ' + matches.length + ' matching item' + (matches.length === 1 ? '' : 's') + '.';
      } else {
        modalResultCount.textContent = 'Showing first ' + lastMatches.length + ' of ' + catalog.length + ' safe Rust items.';
      }
    }

    if (!lastMatches.length) {
      modalResults.innerHTML = '<p class="store-muted admin-kit-results-empty">No matching local Rust items.</p>';
      return;
    }

    modalResults.innerHTML = lastMatches.map(function (item) {
      var icon = item.icon ? assetPath(item.icon) : '';
      var stack = item.stack_size ? 'Stack ' + item.stack_size : 'Rust item';
      var selected = modalFields.shortname && normalizeShortname(modalFields.shortname.value) === normalizeShortname(item.shortname);

      return [
        '<button class="admin-kit-item-result' + (selected ? ' is-selected' : '') + '" type="button" role="option" aria-selected="' + (selected ? 'true' : 'false') + '" data-result-shortname="' + escapeHtml(item.shortname) + '">',
        icon ? '<img src="' + icon.replace(/"/g, '&quot;') + '" alt="" loading="lazy" decoding="async">' : '<span></span>',
        '<strong>' + escapeHtml(itemDisplayName(item)) + '</strong>',
        '<small>' + escapeHtml(item.shortname) + ' / ' + escapeHtml(stack) + '</small>',
        '</button>'
      ].join('');
    }).join('');
  }

  function openModal(slotWrap) {
    var fields = getSlotFields(slotWrap);
    activeSlot = slotWrap;

    Object.keys(modalFields).forEach(function (name) {
      modalFields[name].value = fieldValue(fields, name, name === 'amount' ? '1' : (name === 'frequency' ? '-1' : ''));
    });

    if (modalFields.shortname) {
      modalFields.shortname.value = normalizeShortname(modalFields.shortname.value);
    }

    modal.hidden = false;
    document.body.classList.add('has-admin-kit-modal');
    if (modalSearch) {
      modalSearch.value = '';
    }
    updateModalPreview();
    renderResults('');

    window.setTimeout(function () {
      if (modalSearch) {
        modalSearch.focus();
      }
    }, 0);
  }

  function closeModal() {
    modal.hidden = true;
    activeSlot = null;
    document.body.classList.remove('has-admin-kit-modal');
  }

  function clearModalFields() {
    Object.keys(modalFields).forEach(function (name) {
      if (name === 'amount') {
        modalFields[name].value = '1';
      } else if (name === 'frequency') {
        modalFields[name].value = '-1';
      } else {
        modalFields[name].value = '';
      }
    });

    updateModalPreview();
    if (modalSearch) {
      modalSearch.value = '';
    }
    renderResults('');
  }

  function selectResult(shortname) {
    if (modalFields.shortname) {
      modalFields.shortname.value = normalizeShortname(shortname);
    }

    updateModalPreview();
    updateResultSelection();
  }

  function applyModal() {
    if (!activeSlot) {
      return;
    }

    var fields = getSlotFields(activeSlot);
    var shortname = normalizeShortname(modalFields.shortname ? modalFields.shortname.value : '');

    Object.keys(modalFields).forEach(function (name) {
      var value = modalFields[name].value;

      if (name === 'shortname') {
        value = shortname;
      }

      if (!shortname) {
        if (name === 'amount') {
          value = '1';
        } else if (name === 'frequency') {
          value = '-1';
        } else if (name !== 'position' && name !== 'sort_order') {
          value = '';
        }
      }

      setFieldValue(fields, name, value);
    });

    updateSlotVisual(activeSlot);
    markPanelDirty(activeSlot.closest('[data-kit-panel]'));
    closeModal();
  }

  selectors.forEach(function (selector) {
    selector.addEventListener('click', function () {
      activateKit(selector.getAttribute('data-kit-index'));
    });
  });

  panels.forEach(function (panel) {
    Array.prototype.slice.call(panel.querySelectorAll('[data-kit-name-input]')).forEach(function (input) {
      input.addEventListener('input', function () {
        updateKitTitle(input);
      });
    });

    Array.prototype.slice.call(panel.querySelectorAll('[data-kit-slot]')).forEach(function (slotButton) {
      slotButton.addEventListener('click', function () {
        openModal(slotButton.closest('[data-kit-slot-wrap]'));
      });
    });
  });

  Array.prototype.slice.call(document.querySelectorAll('[data-kit-save-submit]')).forEach(function (button) {
    button.addEventListener('click', function () {
      if (saveModeInput) {
        saveModeInput.value = button.getAttribute('data-kit-save-submit') || 'draft';
      }
    });
  });

  if (form) {
    form.addEventListener('input', function (event) {
      markPanelDirty(event.target.closest('[data-kit-panel]'));
    }, true);

    form.addEventListener('change', function (event) {
      markPanelDirty(event.target.closest('[data-kit-panel]'));
    }, true);

    form.addEventListener('submit', function () {
      updateExpectedInput();
      setSubmitPanelsEnabled();
      prepareCompactItemsForSubmit();
    });
  }

  modal.addEventListener('click', function (event) {
    var close = event.target.closest('[data-modal-close]');
    var result = event.target.closest('[data-result-shortname]');

    if (close) {
      closeModal();
      return;
    }

    if (result) {
      var shortname = result.getAttribute('data-result-shortname') || '';

      selectResult(shortname);
    }
  });

  if (modalSearch) {
    modalSearch.addEventListener('input', function () {
      renderResults(modalSearch.value);
    });

    modalSearch.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && lastMatches.length) {
        event.preventDefault();
        selectResult(lastMatches[0].shortname || '');
      }
    });
  }

  Object.keys(modalFields).forEach(function (name) {
    modalFields[name].addEventListener('input', function () {
      updateModalPreview();

      if (name === 'shortname') {
        updateResultSelection();
      }
    });
  });

  modal.querySelector('[data-modal-clear]').addEventListener('click', clearModalFields);
  modal.querySelector('[data-modal-apply]').addEventListener('click', applyModal);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !modal.hidden) {
      closeModal();
    }
  });

  fetch(editor.getAttribute('data-rust-items-url') || '')
    .then(function (response) {
      return response.ok ? response.json() : { items: [] };
    })
    .then(function (data) {
      catalog = Array.isArray(data.items)
        ? data.items.filter(function (item) {
            return item && item.shortname && item.safe_shortname;
          })
        : [];
      catalog.forEach(function (item) {
        if (item && item.shortname) {
          itemByShortname.set(normalizeShortname(item.shortname), item);
        }
      });
      panels.forEach(function (panel) {
        Array.prototype.slice.call(panel.querySelectorAll('[data-kit-slot-wrap]')).forEach(updateSlotVisual);
      });

      if (!modal.hidden) {
        renderResults(modalSearch ? modalSearch.value : '');
        updateModalPreview();
      }
    })
    .catch(function () {
      catalog = [];
    });

  activateKit(activeIndex);
})();
