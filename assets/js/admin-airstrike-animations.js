(function () {
  'use strict';

  const root = document.querySelector('[data-airstrike-animation-admin]');

  if (!root) {
    return;
  }

  const apiBase = String(root.dataset.apiBase || '').replace(/\/$/, '');
  const csrf = String(root.dataset.csrf || '');
  const feedback = root.querySelector('[data-airstrike-feedback]');

  function showFeedback(message, type) {
    if (!feedback) {
      return;
    }

    feedback.hidden = false;
    feedback.className = 'admin-alert ' + (type || '');
    feedback.textContent = message;
    feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function request(path, options) {
    const response = await fetch(apiBase + '/' + path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Raidlands-Admin-CSRF': csrf,
        ...(options && options.headers ? options.headers : {}),
      },
    });
    const payload = await response.json().catch(function () {
      return { ok: false, error: 'The server returned an unreadable response.' };
    });

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'The request failed.');
    }

    return payload;
  }

  function setBusy(button, busy) {
    if (!button) {
      return;
    }

    if (busy) {
      button.dataset.originalLabel = button.textContent || '';
      button.textContent = 'Working...';
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalLabel || button.textContent;
      button.disabled = false;
    }
  }

  const profileControls = root.querySelector('[data-airstrike-profile-controls]');
  const profileGrid = root.querySelector('[data-airstrike-profile-grid]');

  if (profileControls && profileGrid) {
    const search = profileControls.querySelector('[data-airstrike-profile-search]');
    const filter = profileControls.querySelector('[data-airstrike-profile-filter]');
    const sort = profileControls.querySelector('[data-airstrike-profile-sort]');
    const tabs = root.querySelector('[data-airstrike-profile-tabs]');
    const results = root.querySelector('[data-airstrike-profile-results]');
    const empty = root.querySelector('[data-airstrike-profile-empty]');
    const cards = Array.from(profileGrid.querySelectorAll('.airstrike-profile-file-card'));
    let vehicle = 'all';

    function renderProfiles() {
      const term = String(search.value || '').trim().toLowerCase();
      const status = String(filter.value || 'all');
      const order = String(sort.value || 'name-asc');
      const visible = cards.filter(function (card) {
        const matchesSearch = !term || [card.dataset.profileName, card.dataset.profileKey, card.dataset.profileVehicle]
          .some(function (value) { return String(value || '').includes(term); });
        const matchesVehicle = vehicle === 'all' || card.dataset.profileVehicle === vehicle;
        const matchesStatus = status === 'all'
          || (status === 'active' && card.dataset.profileArchived !== '1')
          || (status === 'archived' && card.dataset.profileArchived === '1')
          || (status === 'valid' && card.dataset.profileValid === '1')
          || (status === 'invalid' && card.dataset.profileValid !== '1')
          || (status === 'unpublished' && card.dataset.profilePublished !== '1');
        return matchesSearch && matchesVehicle && matchesStatus;
      });

      cards.sort(function (a, b) {
        if (order === 'name-desc') return String(b.dataset.profileName).localeCompare(String(a.dataset.profileName));
        if (order === 'updated-desc') return String(b.dataset.profileUpdated).localeCompare(String(a.dataset.profileUpdated));
        if (order === 'draft-desc') return Number(b.dataset.profileDraft) - Number(a.dataset.profileDraft)
          || String(a.dataset.profileName).localeCompare(String(b.dataset.profileName));
        return String(a.dataset.profileName).localeCompare(String(b.dataset.profileName));
      }).forEach(function (card) {
        card.hidden = !visible.includes(card);
        profileGrid.appendChild(card);
      });

      results.textContent = visible.length + ' of ' + cards.length + ' profiles';
      empty.hidden = visible.length !== 0;
    }

    search.addEventListener('input', renderProfiles);
    filter.addEventListener('change', renderProfiles);
    sort.addEventListener('change', renderProfiles);
    tabs.addEventListener('click', function (event) {
      const button = event.target.closest('[data-vehicle]');
      if (!button) return;
      vehicle = String(button.dataset.vehicle || 'all');
      tabs.querySelectorAll('[data-vehicle]').forEach(function (tab) {
        const active = tab === button;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      renderProfiles();
    });
    renderProfiles();
  }

  root.querySelectorAll('[data-airstrike-publish]').forEach(function (button) {
    button.addEventListener('click', async function () {
      const sync = button.dataset.airstrikePublish === 'sync';
      const message = sync
        ? 'Publish every active draft as a new immutable bundle and request server sync?'
        : 'Publish every active draft as a new immutable bundle?';

      if (!window.confirm(message)) {
        return;
      }

      setBusy(button, true);
      try {
        const payload = await request('publish.php', {
          method: 'POST',
          body: JSON.stringify({ sync: sync }),
        });
        const publication = payload.publication || {};
        const rcon = publication.rcon || {};
        const syncCommand = rcon.command || ('airanimsync.sync ' + publication.revision);
        const suffix = sync
          ? ' Run ' + syncCommand + ' from server console/RCON, then check /airanimsync.'
          : ' Run ' + syncCommand + ' when you are ready to install it on the server.';
        showFeedback(
          'Published revision ' + publication.revision + ' with ' + publication.profileCount + ' profile(s). ' + (rcon.message || suffix),
          rcon.ok ? 'success' : 'warning'
        );
        window.setTimeout(function () { window.location.reload(); }, 1200);
      } catch (error) {
        showFeedback(error.message, 'error');
      } finally {
        setBusy(button, false);
      }
    });
  });

  root.querySelectorAll('[data-airstrike-archive]').forEach(function (button) {
    button.addEventListener('click', async function () {
      const profileKey = String(button.dataset.airstrikeArchive || '');
      const archived = button.dataset.archived === '1';

      if (!window.confirm((archived ? 'Unarchive ' : 'Archive ') + profileKey + '?')) {
        return;
      }

      setBusy(button, true);
      try {
        await request('archive.php', {
          method: 'POST',
          body: JSON.stringify({ profileKey: profileKey, archived: !archived }),
        });
        window.location.reload();
      } catch (error) {
        showFeedback(error.message, 'error');
        setBusy(button, false);
      }
    });
  });

  root.querySelectorAll('[data-airstrike-revisions]').forEach(function (button) {
    button.addEventListener('click', async function () {
      const profileKey = String(button.dataset.airstrikeRevisions || '');
      setBusy(button, true);

      try {
        const payload = await request('revisions.php?profile=' + encodeURIComponent(profileKey), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const revisions = Array.isArray(payload.revisions) ? payload.revisions : [];
        const summary = revisions.length
          ? revisions.slice(0, 8).map(function (revision) {
              return 'Profile r' + revision.profile_revision + ' / bundle ' + revision.bundle_revision + ' / ' + revision.created_at;
            }).join(' | ')
          : 'No published revisions exist for ' + profileKey + '.';
        showFeedback(summary, revisions.length ? 'success' : 'warning');
      } catch (error) {
        showFeedback(error.message, 'error');
      } finally {
        setBusy(button, false);
      }
    });
  });

  root.querySelectorAll('[data-airstrike-import-snapshot]').forEach(function (button) {
    button.addEventListener('click', async function () {
      const snapshotId = Number(button.dataset.airstrikeImportSnapshot || 0);

      if (!window.confirm('Import every profile from this server snapshot into website drafts? Existing matching drafts will be replaced, but nothing will be published.')) {
        return;
      }

      setBusy(button, true);
      try {
        await request('import-server-snapshot.php', {
          method: 'POST',
          body: JSON.stringify({ snapshotId: snapshotId }),
        });
        window.location.reload();
      } catch (error) {
        showFeedback(error.message, 'error');
        setBusy(button, false);
      }
    });
  });

  root.querySelectorAll('[data-airstrike-discard-snapshot]').forEach(function (button) {
    button.addEventListener('click', async function () {
      const snapshotId = Number(button.dataset.airstrikeDiscardSnapshot || 0);

      if (!window.confirm('Discard this pending server snapshot? The Rust server file will not be changed.')) {
        return;
      }

      setBusy(button, true);
      try {
        await request('discard-server-snapshot.php', {
          method: 'POST',
          body: JSON.stringify({ snapshotId: snapshotId }),
        });
        window.location.reload();
      } catch (error) {
        showFeedback(error.message, 'error');
        setBusy(button, false);
      }
    });
  });
})();
