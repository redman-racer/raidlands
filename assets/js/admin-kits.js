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

  function updateExpectedInput() {
    if (!expectedInput) {
      return;
    }

    var panel = panelByIndex(activeIndex);
    var expected = {};

    if (panel) {
      try {
        expected[activeIndex] = JSON.parse(panel.getAttribute('data-kit-expected') || '{}');
      } catch (error) {
        expected[activeIndex] = { main: 24, wear: 8, belt: 6 };
      }
    }

    expectedInput.value = JSON.stringify(expected);
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

  function itemMeta(shortname) {
    return itemByShortname.get(normalizeShortname(shortname)) || null;
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
      '<div class="admin-kit-modal-preview">',
      '<img data-modal-icon alt="" hidden>',
      '<span data-modal-empty>+</span>',
      '<strong data-modal-title>Empty slot</strong>',
      '<small data-modal-subtitle></small>',
      '</div>',
      '<label class="admin-field admin-span-all"><span>Search catalog</span><input type="search" data-modal-search placeholder="rifle.ak, wood, syringe"></label>',
      '<div class="admin-kit-item-results" data-modal-results></div>',
      '<div class="admin-grid three admin-kit-modal-fields">',
      '<label class="admin-field"><span>Shortname</span><input type="text" list="admin-kit-shortname-options" data-modal-field="shortname" maxlength="160"></label>',
      '<label class="admin-field"><span>Amount</span><input type="number" min="1" max="1000000" data-modal-field="amount"></label>',
      '<label class="admin-field"><span>Skin</span><input type="number" min="0" data-modal-field="skin"></label>',
      '<label class="admin-field"><span>Condition</span><input type="number" min="0" step="0.01" data-modal-field="condition"></label>',
      '<label class="admin-field"><span>Max condition</span><input type="number" min="0" step="0.01" data-modal-field="max_condition"></label>',
      '<label class="admin-field"><span>Ammo</span><input type="number" min="0" data-modal-field="ammo"></label>',
      '<label class="admin-field"><span>Ammo type</span><input type="text" list="admin-kit-shortname-options" data-modal-field="ammo_type" maxlength="160"></label>',
      '<label class="admin-field"><span>Frequency</span><input type="number" min="-1" data-modal-field="frequency"></label>',
      '<label class="admin-field"><span>Display name</span><input type="text" data-modal-field="display_name" maxlength="160"></label>',
      '<label class="admin-field"><span>Blueprint target</span><input type="text" list="admin-kit-shortname-options" data-modal-field="blueprint_shortname" maxlength="160"></label>',
      '<label class="admin-field admin-span-all"><span>Text</span><input type="text" data-modal-field="text" maxlength="1000"></label>',
      '<label class="admin-field admin-span-all"><span>Contents JSON</span><textarea data-modal-field="contents_json" rows="2"></textarea></label>',
      '<label class="admin-field admin-span-all"><span>Container JSON</span><textarea data-modal-field="container_json" rows="2"></textarea></label>',
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
  var modalIcon = modal.querySelector('[data-modal-icon]');
  var modalEmpty = modal.querySelector('[data-modal-empty]');
  var modalTitle = modal.querySelector('[data-modal-title]');
  var modalSubtitle = modal.querySelector('[data-modal-subtitle]');

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

  function renderResults(query) {
    if (!modalResults) {
      return;
    }

    query = normalizeShortname(query);
    var matches = catalog.filter(function (item) {
      if (!item.safe_shortname) {
        return false;
      }

      if (!query) {
        return true;
      }

      return String(item.shortname || '').toLowerCase().indexOf(query) !== -1
        || String(item.display_name || '').toLowerCase().indexOf(query) !== -1;
    }).slice(0, 48);

    if (!matches.length) {
      modalResults.innerHTML = '<p class="store-muted">No matching local Rust items.</p>';
      return;
    }

    modalResults.innerHTML = matches.map(function (item) {
      var icon = item.icon ? assetPath(item.icon) : '';
      var stack = item.stack_size ? 'Stack ' + item.stack_size : 'Rust item';

      return [
        '<button class="admin-kit-item-result" type="button" data-result-shortname="' + String(item.shortname).replace(/"/g, '&quot;') + '">',
        icon ? '<img src="' + icon.replace(/"/g, '&quot;') + '" alt="" loading="lazy" decoding="async">' : '<span></span>',
        '<strong>' + escapeHtml(item.display_name || item.shortname) + '</strong>',
        '<small>' + escapeHtml(item.shortname) + ' / ' + escapeHtml(stack) + '</small>',
        '</button>'
      ].join('');
    }).join('');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
    updateModalPreview();
    renderResults(modalFields.shortname ? modalFields.shortname.value : '');

    window.setTimeout(function () {
      if (modalSearch) {
        modalSearch.focus();
        modalSearch.select();
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
    renderResults('');
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
    form.addEventListener('submit', function () {
      activateKit(activeIndex);
      updateExpectedInput();
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

      if (modalFields.shortname) {
        modalFields.shortname.value = shortname;
      }

      if (modalSearch) {
        modalSearch.value = shortname;
      }

      updateModalPreview();
      renderResults(shortname);
    }
  });

  if (modalSearch) {
    modalSearch.addEventListener('input', function () {
      renderResults(modalSearch.value);
    });
  }

  Object.keys(modalFields).forEach(function (name) {
    modalFields[name].addEventListener('input', updateModalPreview);
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
      catalog = Array.isArray(data.items) ? data.items : [];
      catalog.forEach(function (item) {
        if (item && item.shortname) {
          itemByShortname.set(normalizeShortname(item.shortname), item);
        }
      });
      panels.forEach(function (panel) {
        Array.prototype.slice.call(panel.querySelectorAll('[data-kit-slot-wrap]')).forEach(updateSlotVisual);
      });
    })
    .catch(function () {
      catalog = [];
    });

  activateKit(activeIndex);
})();
