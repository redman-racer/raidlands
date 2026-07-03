(function () {
  var editors = Array.prototype.slice.call(document.querySelectorAll('[data-admin-store-editor]'));

  if (!editors.length) {
    return;
  }

  function toArray(nodes) {
    return Array.prototype.slice.call(nodes || []);
  }

  function activatePanel(editor, targetId) {
    var panels = toArray(editor.querySelectorAll('[data-admin-store-panel]'));
    var selectors = toArray(editor.querySelectorAll('[data-admin-store-select]'));

    panels.forEach(function (panel) {
      var isActive = panel.id === targetId;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
    });

    selectors.forEach(function (selector) {
      var isActive = selector.getAttribute('data-admin-store-target') === targetId;
      selector.classList.toggle('is-active', isActive);

      if (isActive) {
        selector.setAttribute('aria-current', 'true');
      } else {
        selector.removeAttribute('aria-current');
      }
    });
  }

  function selectorForPanel(editor, panel) {
    if (!panel || !panel.id) {
      return null;
    }

    return editor.querySelector('[data-admin-store-target="' + panel.id + '"]');
  }

  function updateProductTitle(editor, input) {
    var panel = input.closest('[data-admin-store-panel]');

    if (!panel) {
      return;
    }

    var title = input.value.trim() || 'New Store Product';
    var heading = panel.querySelector('[data-admin-store-card-title]');
    var selector = selectorForPanel(editor, panel);

    if (heading) {
      heading.textContent = title;
    }

    if (selector) {
      var label = selector.querySelector('[data-admin-store-select-label]');

      if (label) {
        label.textContent = title;
      }
    }
  }

  editors.forEach(function (editor) {
    var panels = toArray(editor.querySelectorAll('[data-admin-store-panel]'));
    var selectors = toArray(editor.querySelectorAll('[data-admin-store-select]'));
    var activePanel = panels.find(function (panel) {
      return panel.classList.contains('is-active');
    }) || panels[0];

    selectors.forEach(function (selector) {
      selector.addEventListener('click', function () {
        activatePanel(editor, selector.getAttribute('data-admin-store-target') || '');
      });
    });

    toArray(editor.querySelectorAll('[data-admin-store-name-input]')).forEach(function (input) {
      input.addEventListener('input', function () {
        updateProductTitle(editor, input);
      });
    });

    if (activePanel && activePanel.id) {
      activatePanel(editor, activePanel.id);
    }
  });
}());
