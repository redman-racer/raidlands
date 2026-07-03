(function () {
  var editors = Array.prototype.slice.call(document.querySelectorAll('[data-admin-feature-editor]'));

  if (!editors.length) {
    return;
  }

  function toArray(nodes) {
    return Array.prototype.slice.call(nodes || []);
  }

  function selectorByIndex(selectors, index) {
    return selectors.find(function (selector) {
      return selector.getAttribute('data-feature-index') === String(index);
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
    var statusSelect = panel.querySelector('[data-feature-status-select]');
    var publicInput = panel.querySelector('[data-feature-public-input]');
    var voteableInput = panel.querySelector('[data-feature-voteable-input]');
    var idInput = panel.querySelector('input[name$="[id]"]');
    var title = titleInput ? titleInput.value.trim() : '';
    var isDraft = idInput && (!idInput.value || idInput.value === '0');
    var selectedOption = statusSelect ? statusSelect.options[statusSelect.selectedIndex] : null;
    var status = selectedOption ? selectedOption.text : 'Under Review';
    var visibility = publicInput && publicInput.checked ? 'Public' : 'Hidden';
    var voting = voteableInput && voteableInput.checked && status.toLowerCase() !== 'archived' ? 'voteable' : 'not voteable';
    var copy = isDraft && !title ? 'Draft slot / blank rows are ignored' : status + ' / ' + visibility + ', ' + voting;

    if (meta) {
      meta.textContent = copy;
    }

    if (subtitle) {
      subtitle.textContent = isDraft && !title ? 'Blank rows are ignored until you add a title.' : copy;
    }

    if (selector) {
      selector.classList.toggle('is-archived', status.toLowerCase() === 'archived');
      selector.classList.toggle('is-draft', !!isDraft);
    }
  }

  function initFeatureEditor(editor) {
    var panels = toArray(editor.querySelectorAll('[data-feature-panel]'));
    var selectors = toArray(editor.querySelectorAll('[data-feature-select]'));
    var addButton = editor.querySelector('[data-feature-add]');
    var activePanel = panels.find(function (panel) {
      return panel.classList.contains('is-active');
    }) || panels[0];
    var activeIndex = activePanel ? activePanel.getAttribute('data-feature-index') || '0' : '0';

    function activateFeature(index) {
      activeIndex = String(index);

      panels.forEach(function (panel) {
        var isActive = panel.getAttribute('data-feature-index') === activeIndex;

        panel.hidden = !isActive;
        panel.classList.toggle('is-active', isActive);
      });

      selectors.forEach(function (selector) {
        var isActive = selector.getAttribute('data-feature-index') === activeIndex;

        selector.classList.toggle('is-active', isActive);

        if (isActive) {
          selector.setAttribute('aria-current', 'true');
        } else {
          selector.removeAttribute('aria-current');
        }
      });
    }

    function activateDraftFeature() {
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

      toArray(panel.querySelectorAll('[data-feature-status-select], [data-feature-public-input], [data-feature-voteable-input]')).forEach(function (control) {
        control.addEventListener('change', function () {
          updateFeatureMeta(selectors, panel);
        });
      });
    });

    if (addButton) {
      addButton.addEventListener('click', activateDraftFeature);
    }

    activateFeature(activeIndex);
  }

  editors.forEach(initFeatureEditor);
}());
