(function () {
  var editor = document.querySelector('[data-admin-kit-editor]');

  if (!editor) {
    return;
  }

  var form = editor.closest('form');
  var panels = Array.prototype.slice.call(editor.querySelectorAll('[data-kit-panel]'));
  var selectors = Array.prototype.slice.call(editor.querySelectorAll('[data-kit-select]'));
  var addButton = editor.querySelector('[data-kit-add]');
  var pickerList = editor.querySelector('.admin-kit-picker-list');
  var searchInput = editor.querySelector('[data-kit-search]');
  var statusFilter = editor.querySelector('[data-kit-status-filter]');
  var accessFilter = editor.querySelector('[data-kit-access-filter]');
  var shopFilter = editor.querySelector('[data-kit-shop-filter]');
  var sortSelect = editor.querySelector('[data-kit-sort]');
  var resetButton = editor.querySelector('[data-kit-reset]');
  var resultCount = editor.querySelector('[data-kit-result-count]');
  var emptyState = editor.querySelector('[data-kit-empty]');
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
  var activeCatalogCategory = 'weapons';
  var catalogCategoryDefs = [
    { id: 'weapons', label: 'Weapons' },
    { id: 'ammo', label: 'Ammo' },
    { id: 'armor', label: 'Armor' },
    { id: 'medical', label: 'Medical' },
    { id: 'resources', label: 'Resources' },
    { id: 'building', label: 'Building' },
    { id: 'tools', label: 'Tools' },
    { id: 'electrical', label: 'Electrical' },
    { id: 'food', label: 'Food' },
    { id: 'vehicles', label: 'Vehicles' },
    { id: 'deployables', label: 'Deployables' },
    { id: 'misc', label: 'Misc' }
  ];

  function normalizeShortname(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function plainText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function numberValue(element, attribute, fallback) {
    var value = Number(element.getAttribute(attribute) || fallback || 0);

    return Number.isFinite(value) ? value : 0;
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

  function selectorByIndex(index) {
    return selectors.find(function (selector) {
      return selector.getAttribute('data-kit-index') === String(index);
    });
  }

  function kitInput(panel, suffix) {
    return panel.querySelector('input[name$="[' + suffix + ']"], select[name$="[' + suffix + ']"], textarea[name$="[' + suffix + ']"]');
  }

  function selectorLabel(selector) {
    var label = selector.querySelector('[data-kit-select-label]');

    return label ? plainText(label.textContent) : '';
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
    activeIndex = String(index || '');

    panels.forEach(function (panel) {
      var isActive = activeIndex !== '' && panel.getAttribute('data-kit-index') === activeIndex;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
      setPanelEnabled(panel, isActive);
    });

    selectors.forEach(function (selector) {
      var isActive = activeIndex !== '' && selector.getAttribute('data-kit-index') === activeIndex;
      selector.classList.toggle('is-active', isActive);

      if (isActive) {
        selector.setAttribute('aria-current', 'true');
      } else {
        selector.removeAttribute('aria-current');
      }
    });

    updateExpectedInput();
  }

  function activateDraftKit() {
    resetKitFilters();

    var draftPanel = panels.find(function (panel) {
      var idInput = panel.querySelector('input[name$="[id]"]');

      return idInput && !idInput.value;
    }) || panels[panels.length - 1];

    if (!draftPanel) {
      return;
    }

    activateKit(draftPanel.getAttribute('data-kit-index') || '0');
    markPanelDirty(draftPanel);

    var nameInput = draftPanel.querySelector('[data-kit-name-input]');

    if (nameInput) {
      nameInput.focus();
      nameInput.select();
    }
  }

  function countPanelItems(panel) {
    var count = 0;

    Array.prototype.slice.call(panel.querySelectorAll('[data-kit-slot-wrap]')).forEach(function (slotWrap) {
      var field = slotWrap.querySelector('[data-kit-item-field="shortname"]');

      if (field && normalizeShortname(field.value)) {
        count += 1;
      }
    });

    return count;
  }

  function kitStatus(panel) {
    var idInput = kitInput(panel, 'id');

    if (!idInput || !plainText(idInput.value)) {
      return 'draft';
    }

    var activeInput = kitInput(panel, 'is_active');

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

  function kitPermissionSuffix(panel) {
    var permissionInput = kitInput(panel, 'required_permission');
    var value = permissionInput ? plainText(permissionInput.value) : '';

    return value.replace(/^kits\./i, '');
  }

  function kitAccess(panel, permissionSuffix) {
    if (!permissionSuffix) {
      return 'no-permission';
    }

    if (
      panel.getAttribute('data-kit-original-permission')
      && permissionSuffix !== panel.getAttribute('data-kit-original-permission')
    ) {
      return 'needs-group';
    }

    return numberValue(panel, 'data-kit-group-count', 0) > 0 ? 'granted' : 'needs-group';
  }

  function accessLabel(access, groupCount) {
    if (access === 'granted') {
      return groupCount + ' group' + (groupCount === 1 ? '' : 's');
    }

    if (access === 'needs-group') {
      return 'Needs group grant';
    }

    return 'No permission';
  }

  function kitShopTokens(panel) {
    var tokens = [];
    var rewardInput = kitInput(panel, 'reward_enabled');

    if (rewardInput && rewardInput.checked) {
      tokens.push('rewards');
    }

    if (numberValue(panel, 'data-kit-product-count', 0) > 0) {
      tokens.push('store');
    }

    if (!tokens.length) {
      tokens.push('none');
    }

    return tokens;
  }

  function shopLabel(tokens) {
    var value = tokens.join(' ');

    if (value === 'rewards store') {
      return 'Rewards + Store';
    }

    if (value === 'rewards') {
      return 'Rewards shop';
    }

    if (value === 'store') {
      return 'Store derived';
    }

    return 'No shop display';
  }

  function kitSearchText(panel, title, permissionSuffix, status, access, shop) {
    var parts = [
      title,
      permissionSuffix ? 'kits.' + permissionSuffix : '',
      statusLabel(status),
      accessLabel(access, numberValue(panel, 'data-kit-group-count', 0)),
      shopLabel(shop)
    ];

    ['description', 'reward_display_name', 'reward_description', 'reward_permission'].forEach(function (suffix) {
      var control = kitInput(panel, suffix);

      if (control) {
        parts.push(control.value);
      }
    });

    Array.prototype.slice.call(panel.querySelectorAll('.admin-permission-chip, .admin-derived-product strong, .admin-derived-product small')).forEach(function (element) {
      parts.push(element.textContent);
    });

    Array.prototype.slice.call(panel.querySelectorAll('[data-kit-item-field="shortname"], [data-kit-item-field="display_name"]')).forEach(function (field) {
      parts.push(field.value);
    });

    return parts.map(plainText).filter(Boolean).join(' ');
  }

  function updateSelectorFromPanel(panel) {
    var index = panel.getAttribute('data-kit-index') || '0';
    var selector = selectorByIndex(index);

    if (!selector) {
      return;
    }

    var titleInput = kitInput(panel, 'kit_name');
    var sortInput = kitInput(panel, 'sort_order');
    var title = plainText(titleInput ? titleInput.value : '') || 'New Kit';
    var status = kitStatus(panel);
    var permissionSuffix = kitPermissionSuffix(panel);
    var access = kitAccess(panel, permissionSuffix);
    var shop = kitShopTokens(panel);
    var itemCount = countPanelItems(panel);
    var groupCount = numberValue(panel, 'data-kit-group-count', 0);
    var metaText = statusLabel(status)
      + ' / '
      + itemCount
      + ' item'
      + (itemCount === 1 ? '' : 's')
      + ' / '
      + accessLabel(access, groupCount)
      + ' / '
      + shopLabel(shop);
    var publishedLabel = panel.getAttribute('data-kit-published-label') || '';
    var heading = panel.querySelector('[data-kit-card-title]');
    var subtitle = panel.querySelector('[data-kit-card-subtitle]');
    var label = selector.querySelector('[data-kit-select-label]');
    var meta = selector.querySelector('[data-kit-select-meta]');

    if (heading) {
      heading.textContent = title;
    }

    if (subtitle) {
      subtitle.textContent = metaText + publishedLabel;
    }

    if (label) {
      label.textContent = title;
    }

    if (meta) {
      meta.textContent = metaText;
    }

    selector.classList.toggle('is-draft', status === 'draft');
    selector.classList.toggle('is-inactive', status === 'inactive');
    selector.classList.toggle('needs-access', access === 'needs-group');
    selector.setAttribute('data-kit-status', status);
    selector.setAttribute('data-kit-access', access);
    selector.setAttribute('data-kit-shop', shop.join(' '));
    selector.setAttribute('data-kit-sort-order', sortInput ? String(sortInput.value || '100') : '100');
    selector.setAttribute('data-kit-items', String(itemCount));
    selector.setAttribute('data-kit-search', kitSearchText(panel, title, permissionSuffix, status, access, shop));
  }

  function kitFilters() {
    return {
      query: normalizeText(searchInput ? searchInput.value : ''),
      status: statusFilter ? String(statusFilter.value || '') : '',
      access: accessFilter ? String(accessFilter.value || '') : '',
      shop: shopFilter ? String(shopFilter.value || '') : '',
      sort: sortSelect ? String(sortSelect.value || 'order') : 'order'
    };
  }

  function sortKitSelectors(sortMode) {
    var statusRank = {
      active: 10,
      inactive: 20,
      draft: 30
    };
    var accessRank = {
      granted: 10,
      needsGroup: 20,
      noPermission: 30
    };

    function draftRank(selector) {
      return selector.getAttribute('data-kit-status') === 'draft' ? 1 : 0;
    }

    function byTitle(a, b) {
      return selectorLabel(a).localeCompare(selectorLabel(b));
    }

    function byAdminOrder(a, b) {
      return draftRank(a) - draftRank(b)
        || numberValue(a, 'data-kit-sort-order', 100) - numberValue(b, 'data-kit-sort-order', 100)
        || byTitle(a, b);
    }

    function accessSortValue(selector) {
      var access = selector.getAttribute('data-kit-access') || 'needs-group';

      if (access === 'needs-group') {
        return accessRank.needsGroup;
      }

      if (access === 'no-permission') {
        return accessRank.noPermission;
      }

      return accessRank.granted;
    }

    return selectors.slice().sort(function (a, b) {
      if (sortMode === 'name') {
        return byTitle(a, b) || byAdminOrder(a, b);
      }

      if (sortMode === 'items') {
        return numberValue(b, 'data-kit-items', 0) - numberValue(a, 'data-kit-items', 0)
          || byAdminOrder(a, b);
      }

      if (sortMode === 'access') {
        return accessSortValue(a) - accessSortValue(b)
          || byAdminOrder(a, b);
      }

      if (sortMode === 'shop') {
        return String(a.getAttribute('data-kit-shop') || '').localeCompare(String(b.getAttribute('data-kit-shop') || ''))
          || byAdminOrder(a, b);
      }

      return (statusRank[a.getAttribute('data-kit-status') || 'draft'] || 99) - (statusRank[b.getAttribute('data-kit-status') || 'draft'] || 99)
        || byAdminOrder(a, b);
    });
  }

  function selectorMatches(selector, filters) {
    if (filters.status && selector.getAttribute('data-kit-status') !== filters.status) {
      return false;
    }

    if (filters.access && selector.getAttribute('data-kit-access') !== filters.access) {
      return false;
    }

    if (filters.shop && String(selector.getAttribute('data-kit-shop') || '').split(/\s+/).indexOf(filters.shop) === -1) {
      return false;
    }

    if (!filters.query) {
      return true;
    }

    var searchText = normalizeText(selector.getAttribute('data-kit-search'));
    var terms = filters.query.split(/\s+/).filter(Boolean);

    return terms.every(function (term) {
      return searchText.indexOf(term) !== -1;
    });
  }

  function applyKitFilters() {
    var filters = kitFilters();
    var visible = [];

    sortKitSelectors(filters.sort).forEach(function (selector) {
      if (pickerList) {
        pickerList.appendChild(selector);
      }

      var isVisible = selectorMatches(selector, filters);
      selector.hidden = !isVisible;

      if (isVisible) {
        visible.push(selector);
      }
    });

    if (resultCount) {
      resultCount.textContent = visible.length + ' kit' + (visible.length === 1 ? '' : 's') + ' shown';
    }

    if (emptyState) {
      emptyState.hidden = visible.length !== 0;
    }

    if (!visible.length) {
      activateKit('');
      return;
    }

    var activeSelector = selectorByIndex(activeIndex);

    if (!activeSelector || activeSelector.hidden) {
      activateKit(visible[0].getAttribute('data-kit-index') || '0');
    } else {
      activateKit(activeIndex);
    }
  }

  function resetKitFilters() {
    if (searchInput) {
      searchInput.value = '';
    }

    [statusFilter, accessFilter, shopFilter].forEach(function (control) {
      if (control) {
        control.value = '';
      }
    });

    if (sortSelect) {
      sortSelect.value = 'order';
    }

    applyKitFilters();
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

  function itemSearchText(item) {
    return [
      item.shortname || '',
      itemDisplayName(item),
      item.description || '',
      item.item_id || ''
    ].join(' ').toLowerCase();
  }

  function textMatchesAny(text, patterns) {
    return patterns.some(function (pattern) {
      return pattern.test(text);
    });
  }

  function categoryForItem(item) {
    var shortname = normalizeShortname(item.shortname);
    var text = itemSearchText(item);

    if (/^ammo\.|^arrow\.|^dart\.|^catapult\.ammo|^submarine\.torpedo/.test(shortname)
      || textMatchesAny(text, [/ ammunition\b/, /\bammo\b/, /\bshell\b/, /\bslug\b/, /\bcartridge\b/, /\bround\b/, /\bgrenade launcher\b/])) {
      return 'ammo';
    }

    if (textMatchesAny(text, [
      /^rifle\./, /^pistol\./, /^shotgun\./, /^smg\./, /^lmg\./, /^bow\./, /^crossbow\b/,
      /^weapon\./, /^rocket\.launcher/, /\bweapon\b/, /\brifle\b/, /\bpistol\b/, /\bshotgun\b/,
      /\bsmg\b/, /\bbow\b/, /\bcrossbow\b/, /\blauncher\b/, /\bgrenade\b/, /\bexplosive\b/,
      /\bsatchel\b/, /\bflamethrower\b/, /\bminigun\b/, /\bnailgun\b/, /\bsword\b/, /\bspear\b/,
      /\bknife\b/, /\bcleaver\b/, /\bmachete\b/, /\bmace\b/
    ])) {
      return 'weapons';
    }

    if (textMatchesAny(text, [
      /^attire\./, /^burlap\./, /^hide\./, /^roadsign\./, /^metal\.facemask/, /^metal\.plate/,
      /\barmor\b/, /\barmour\b/, /\bhelmet\b/, /\bfacemask\b/, /\bhoodie\b/, /\bpants\b/,
      /\bjacket\b/, /\bgloves\b/, /\bboots\b/, /\bshirt\b/, /\bhazmat\b/, /\bkilt\b/,
      /\bclothing\b/, /\bmask\b/, /\bsuit\b/
    ])) {
      return 'armor';
    }

    if (textMatchesAny(text, [
      /\bsyringe\b/, /\bmedkit\b/, /\bbandage\b/, /\bmedical\b/, /\bhealth\b/,
      /\bantirad\b/, /\bradiation\b/, /\bhealing\b/
    ])) {
      return 'medical';
    }

    if (textMatchesAny(text, [
      /^vehicle\./, /^car\./, /\bvehicle\b/, /\bcar\b/, /\bboat\b/, /\bhorse\b/,
      /\bsubmarine\b/, /\bminicopter\b/, /\bscraptransport\b/, /\bsnowmobile\b/,
      /\bskidoo\b/, /\bworkcart\b/, /\btrain\b/, /\bmodule\b/, /\bengine\b/, /\btire\b/
    ])) {
      return 'vehicles';
    }

    if (textMatchesAny(text, [
      /^electric\./, /^wiretool\b/, /\belectric\b/, /\bpower\b/, /\bbattery\b/,
      /\bgenerator\b/, /\bswitch\b/, /\bsensor\b/, /\bsplitter\b/, /\bsolar\b/,
      /\bceiling light\b/, /\bcctv\b/, /\bcomputer station\b/, /\bturret\b/, /\bsam site\b/
    ])) {
      return 'electrical';
    }

    if (textMatchesAny(text, [
      /\bbuilding\b/, /\bplanner\b/, /\bdoor\b/, /\bwall\b/, /\bfloor\b/, /\bwindow\b/,
      /\bbarricade\b/, /\bladder\b/, /\block\b/, /\bcupboard\b/, /\bgate\b/, /\bshutter\b/,
      /\bworkbench\b/, /\brepair bench\b/, /\bfurnace\b/, /\bbox\b/, /\bstorage\b/
    ])) {
      return 'building';
    }

    if (textMatchesAny(text, [
      /\btool\b/, /\bhammer\b/, /\bhatchet\b/, /\bpickaxe\b/, /\bjackhammer\b/,
      /\bchainsaw\b/, /\bsurvey charge\b/, /\bspraycan\b/, /\bcamera\b/, /\bbinoculars\b/,
      /\btorch\b/, /\bflashlight\b/, /\bmining\b/
    ])) {
      return 'tools';
    }

    if (textMatchesAny(text, [
      /^wood$|^stones$|^metal\./, /\bwood\b/, /\bstone\b/, /\bmetal\b/, /\bsulfur\b/,
      /\bore\b/, /\bscrap\b/, /\bcloth\b/, /\bleather\b/, /\bbone\b/, /\bcharcoal\b/,
      /\blow grade\b/, /\bcrude\b/, /\bfuel\b/, /\bfat\b/, /\brope\b/, /\btarp\b/,
      /\bgears\b/, /\bspring\b/, /\bbody\b/, /\btech trash\b/, /\bsheet metal\b/,
      /\bsewing kit\b/, /\bfragment\b/, /\bcomponent\b/
    ])) {
      return 'resources';
    }

    if (textMatchesAny(text, [
      /\bapple\b/, /\bberry\b/, /\bmeat\b/, /\bfish\b/, /\bcorn\b/, /\bpumpkin\b/,
      /\bmushroom\b/, /\bwater\b/, /\btea\b/, /\bseed\b/, /\bclone\b/, /\bpotato\b/,
      /\bhemp\b/, /\bfood\b/, /\bcan of\b/, /\bchocolate\b/, /\bgranola\b/
    ])) {
      return 'food';
    }

    if (textMatchesAny(text, [
      /\bchair\b/, /\btable\b/, /\brug\b/, /\bsofa\b/, /\bsign\b/, /\bplanter\b/,
      /\bbarrel\b/, /\bvending\b/, /\bbbq\b/, /\bcampfire\b/, /\blantern\b/, /\blight\b/,
      /\bshelf\b/, /\bbanner\b/, /\bposter\b/, /\bframe\b/, /\bfurniture\b/
    ])) {
      return 'deployables';
    }

    return 'misc';
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
    var modalCoreFieldSpecs = [
      { label: 'Shortname', help: 'Rust item shortname saved to the kit slot. Pick from the catalog when possible.', type: 'text', field: 'shortname', list: 'admin-kit-shortname-options', maxlength: '160' },
      { label: 'Amount', help: 'Stack amount granted for this item. Most equipment stays at 1.', type: 'number', field: 'amount', min: '1', max: '1000000' },
      { label: 'Skin', help: 'Optional Rust workshop skin ID. Use 0 for the default item skin.', type: 'number', field: 'skin', min: '0' }
    ];
    var modalAdvancedFieldSpecs = [
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
      '<div class="admin-kit-category-tabs" data-modal-categories role="tablist" aria-label="Item categories"></div>',
      '<div class="admin-kit-results-head">',
      '<span data-modal-count>Loading item catalog...</span>',
      '<small>Click an item to fill the slot shortname.</small>',
      '</div>',
      '<div class="admin-kit-item-results" data-modal-results role="listbox" aria-label="Available Rust items"></div>',
      '</div>',
      '</div>',
      '<div class="admin-kit-modal-fieldset">',
      '<div class="admin-subsection-head admin-kit-modal-subhead"><h3>Item values</h3></div>',
      '<div class="admin-grid three admin-kit-modal-fields admin-kit-modal-core-fields">',
      modalCoreFieldSpecs.map(modalInput).join(''),
      '</div>',
      '<details class="admin-details admin-kit-modal-advanced" data-modal-advanced>',
      '<summary>Advanced item data <small>Condition, ammo, blueprint, custom text, JSON</small></summary>',
      '<div class="admin-grid three admin-kit-modal-fields">',
      modalAdvancedFieldSpecs.map(modalInput).join(''),
      '</div>',
      '</details>',
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
  var modalCategories = modal.querySelector('[data-modal-categories]');
  var modalResults = modal.querySelector('[data-modal-results]');
  var modalResultCount = modal.querySelector('[data-modal-count]');
  var modalIcon = modal.querySelector('[data-modal-icon]');
  var modalEmpty = modal.querySelector('[data-modal-empty]');
  var modalTitle = modal.querySelector('[data-modal-title]');
  var modalSubtitle = modal.querySelector('[data-modal-subtitle]');
  var modalAdvanced = modal.querySelector('[data-modal-advanced]');

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

  function modalFieldValue(name) {
    if (!modalFields[name]) {
      return '';
    }

    return String(modalFields[name].value || '').trim();
  }

  function textFieldHasValue(name) {
    return modalFieldValue(name) !== '';
  }

  function numberFieldDiffers(name, emptyValue) {
    var value = Number(modalFieldValue(name));
    var empty = Number(emptyValue);

    if (!Number.isFinite(value)) {
      return false;
    }

    return value !== empty;
  }

  function syncAdvancedOpenState() {
    if (!modalAdvanced) {
      return;
    }

    modalAdvanced.open = [
      numberFieldDiffers('condition', 0),
      numberFieldDiffers('max_condition', 0),
      numberFieldDiffers('ammo', 0),
      textFieldHasValue('ammo_type'),
      numberFieldDiffers('frequency', -1),
      textFieldHasValue('display_name'),
      textFieldHasValue('blueprint_shortname'),
      textFieldHasValue('text'),
      textFieldHasValue('contents_json'),
      textFieldHasValue('container_json')
    ].some(Boolean);
  }

  function itemMatchesTerm(item, term) {
    var words = String(term || '').split(/\s+/).filter(Boolean);
    var haystack = itemSearchText(item);

    return words.every(function (word) {
      return haystack.indexOf(word) !== -1;
    });
  }

  function categoryLabel(categoryId) {
    var category = catalogCategoryDefs.find(function (entry) {
      return entry.id === categoryId;
    });

    return category ? category.label : 'Items';
  }

  function filteredCatalogItems(query) {
    query = normalizeShortname(query);
    var terms = String(query || '').split(',').map(function (term) {
      return normalizeShortname(term);
    }).filter(Boolean);

    return catalog.filter(function (item) {
      if (!terms.length) {
        return true;
      }

      return terms.some(function (term) {
        return itemMatchesTerm(item, term);
      });
    }).sort(function (a, b) {
      return scoreItem(a, query) - scoreItem(b, query)
        || categoryLabel(a.category_id).localeCompare(categoryLabel(b.category_id))
        || itemDisplayName(a).localeCompare(itemDisplayName(b))
        || String(a.shortname || '').localeCompare(String(b.shortname || ''));
    });
  }

  function categoryCounts(items) {
    var counts = { total: items.length };

    catalogCategoryDefs.forEach(function (category) {
      counts[category.id] = 0;
    });

    items.forEach(function (item) {
      var categoryId = item.category_id || 'misc';

      if (counts[categoryId] == null) {
        counts[categoryId] = 0;
      }

      counts[categoryId] += 1;
    });

    return counts;
  }

  function visibleCategories(counts) {
    var categories = [];

    catalogCategoryDefs.forEach(function (category) {
      var count = counts[category.id] || 0;

      if (count > 0) {
        categories.push({
          id: category.id,
          label: category.label,
          count: count
        });
      }
    });

    return categories;
  }

  function ensureActiveCategory(counts) {
    if ((counts[activeCatalogCategory] || 0) > 0) {
      return;
    }

    var categories = visibleCategories(counts);
    activeCatalogCategory = categories.length ? categories[0].id : 'weapons';
  }

  function renderCategoryTabs(counts) {
    if (!modalCategories) {
      return;
    }

    var categories = visibleCategories(counts);

    if (!categories.length) {
      modalCategories.innerHTML = '';
      return;
    }

    modalCategories.innerHTML = categories.map(function (category) {
      var isSelected = category.id === activeCatalogCategory;

      return [
        '<button class="admin-kit-category-tab' + (isSelected ? ' is-active' : '') + '" type="button" role="tab" aria-selected="' + (isSelected ? 'true' : 'false') + '" data-category-id="' + escapeHtml(category.id) + '">',
        '<span>' + escapeHtml(category.label) + '</span>',
        '<small>' + escapeHtml(category.count) + '</small>',
        '</button>'
      ].join('');
    }).join('');
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
    var matches = filteredCatalogItems(query);
    var counts = categoryCounts(matches);

    ensureActiveCategory(counts);
    renderCategoryTabs(counts);

    lastMatches = matches.filter(function (item) {
      return (item.category_id || 'misc') === activeCatalogCategory;
    });

    if (modalResultCount) {
      if (!catalog.length) {
        modalResultCount.textContent = 'No catalog items loaded yet.';
      } else if (!matches.length) {
        modalResultCount.textContent = 'No matching safe Rust items.';
      } else if (query) {
        modalResultCount.textContent = categoryLabel(activeCatalogCategory) + ': ' + lastMatches.length + ' item' + (lastMatches.length === 1 ? '' : 's') + ' shown from ' + matches.length + ' search match' + (matches.length === 1 ? '' : 'es') + '.';
      } else {
        modalResultCount.textContent = categoryLabel(activeCatalogCategory) + ': showing ' + lastMatches.length + ' item' + (lastMatches.length === 1 ? '' : 's') + '. ' + catalog.length + ' safe Rust items available across categories.';
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
    activeCatalogCategory = 'weapons';
    if (modalSearch) {
      modalSearch.value = '';
    }
    updateModalPreview();
    syncAdvancedOpenState();
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
    syncAdvancedOpenState();
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

    var panel = activeSlot.closest('[data-kit-panel]');

    updateSlotVisual(activeSlot);
    markPanelDirty(panel);

    if (panel) {
      updateSelectorFromPanel(panel);
      applyKitFilters();
    }

    closeModal();
  }

  selectors.forEach(function (selector) {
    selector.addEventListener('click', function () {
      activateKit(selector.getAttribute('data-kit-index'));
    });
  });

  if (addButton) {
    addButton.addEventListener('click', activateDraftKit);
  }

  panels.forEach(function (panel) {
    var refreshPanel = function () {
      updateSelectorFromPanel(panel);
      applyKitFilters();
    };

    Array.prototype.slice.call(panel.querySelectorAll('input, select, textarea')).forEach(function (control) {
      if (control.hasAttribute('data-kit-item-field')) {
        return;
      }

      control.addEventListener('input', refreshPanel);
      control.addEventListener('change', refreshPanel);
    });

    Array.prototype.slice.call(panel.querySelectorAll('[data-kit-slot]')).forEach(function (slotButton) {
      slotButton.addEventListener('click', function () {
        openModal(slotButton.closest('[data-kit-slot-wrap]'));
      });
    });

    updateSelectorFromPanel(panel);
  });

  [searchInput, statusFilter, accessFilter, shopFilter, sortSelect].forEach(function (control) {
    if (!control) {
      return;
    }

    control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', applyKitFilters);
  });

  if (resetButton) {
    resetButton.addEventListener('click', resetKitFilters);
  }

  applyKitFilters();

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
    var category = event.target.closest('[data-category-id]');
    var result = event.target.closest('[data-result-shortname]');

    if (close) {
      closeModal();
      return;
    }

    if (category) {
      activeCatalogCategory = category.getAttribute('data-category-id') || 'weapons';
      renderResults(modalSearch ? modalSearch.value : '');
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

  function fetchCatalogUrl(url) {
    url = String(url || '').trim();

    if (!url) {
      return Promise.resolve({ items: [] });
    }

    return fetch(url)
      .then(function (response) {
        return response.ok ? response.json() : { items: [] };
      })
      .catch(function () {
        return { items: [] };
      });
  }

  Promise.all([
    fetchCatalogUrl(editor.getAttribute('data-rust-items-url') || ''),
    fetchCatalogUrl(editor.getAttribute('data-custom-items-url') || '')
  ])
    .then(function (responses) {
      var catalogByShortname = new Map();

      responses.forEach(function (data) {
        if (!data || !Array.isArray(data.items)) {
          return;
        }

        data.items.forEach(function (item) {
          if (!item || !item.shortname || !item.safe_shortname) {
            return;
          }

          catalogByShortname.set(normalizeShortname(item.shortname), item);
        });
      });

      catalog = Array.from(catalogByShortname.values()).map(function (item) {
        item.category_id = categoryForItem(item);
        return item;
      });

      itemByShortname.clear();
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
      itemByShortname.clear();
    });

  activateKit(activeIndex);
})();
