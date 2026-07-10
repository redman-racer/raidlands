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
        showFeedback(
          'Published revision ' + publication.revision + '. ' + (rcon.message || ''),
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
