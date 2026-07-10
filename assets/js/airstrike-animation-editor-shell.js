(function () {
  'use strict';

  const root = document.querySelector('[data-airstrike-source-editor]');
  const configNode = document.getElementById('airstrike-animation-editor-config');

  if (!root || !configNode) {
    return;
  }

  let config;
  try {
    config = JSON.parse(configNode.textContent || '{}');
  } catch (error) {
    return;
  }

  const elements = {
    state: root.querySelector('[data-editor-state]'),
    dirty: root.querySelector('[data-editor-dirty]'),
    title: root.querySelector('[data-editor-title]'),
    source: root.querySelector('[data-editor-source]'),
    key: root.querySelector('[data-editor-key]'),
    name: root.querySelector('[data-editor-name]'),
    vehicle: root.querySelector('[data-editor-vehicle]'),
    feedback: root.querySelector('[data-editor-feedback]'),
    output: root.querySelector('[data-editor-output]'),
    compileSummary: root.querySelector('[data-editor-compile-summary]'),
    list: root.querySelector('[data-editor-profile-list]'),
    search: root.querySelector('[data-editor-search]'),
  };
  const state = {
    profiles: [],
    profileKey: '',
    baseVersion: 0,
    dirty: false,
    loading: false,
  };

  function starterSource() {
    return {
      EditorSourceSchemaVersion: 1,
      ProfileKey: 'new_airstrike_profile',
      DisplayName: 'New Airstrike Profile',
      Vehicle: 'f15',
      DurationSeconds: 8,
      FirstPayloadDelaySeconds: 3.5,
      RotationSmoothTimeSeconds: 0.12,
      StopAtWaypoints: false,
      MinimumTerrainClearance: 55,
      PositionInterpolation: 'time_hermite',
      RotationMode: 'follow_path_plus_offset',
      Waypoints: [
        { Id: 'wp_001', Time: 0, X: 0, Y: 90, Z: -300, RotationX: 0, RotationY: 0, RotationZ: 0 },
        { Id: 'wp_002', Time: 3.5, X: 0, Y: 60, Z: 0, RotationX: -15, RotationY: 0, RotationZ: 0 },
        { Id: 'wp_003', Time: 8, X: 0, Y: 90, Z: 300, RotationX: 0, RotationY: 0, RotationZ: 0 },
      ],
      ReleaseSource: {
        Mode: 'manual',
        LegacyDynamic: true,
        Events: [],
        FallbackIntervalSeconds: 0.5,
        Template: {
          Payload: 'hv_rocket',
          Count: 1,
          CarrierOffsetX: 0,
          CarrierOffsetY: 0,
          CarrierOffsetZ: 0,
          TargetOffsetX: 0,
          TargetOffsetY: 0,
          TargetOffsetZ: 0,
          SpreadRadius: -1,
          LaunchSpeed: -1,
          FuseSeconds: -1,
          DamageScale: 1,
          VehicleDamageScale: -1,
          SplashRadius: -1,
          ImpactRadius: -1,
          MaxTrackingSeconds: -1,
          MaxTrackingDistance: -1,
          DamageScales: {},
        },
      },
      EditorMetadata: {
        Notes: '',
        Tags: [],
        VehiclePreviewOverrides: {},
      },
    };
  }

  function setStatus(message) {
    if (elements.state) {
      elements.state.textContent = message;
    }
  }

  function setDirty(dirty) {
    state.dirty = Boolean(dirty);
    if (elements.dirty) {
      elements.dirty.textContent = state.dirty ? 'Unsaved' : 'Clean';
      elements.dirty.classList.toggle('active', state.dirty);
    }
  }

  function showFeedback(message, type) {
    if (!elements.feedback) {
      return;
    }
    elements.feedback.textContent = message;
    elements.feedback.classList.toggle('is-error', type === 'error');
    elements.feedback.classList.toggle('is-success', type === 'success');
  }

  function parseSource() {
    let source;
    try {
      source = JSON.parse(elements.source.value || '{}');
    } catch (error) {
      throw new Error('Source JSON is invalid: ' + error.message);
    }
    if (!source || Array.isArray(source) || typeof source !== 'object') {
      throw new Error('Source JSON must be an object.');
    }
    return source;
  }

  function syncIdentityIntoSource() {
    const source = parseSource();
    source.ProfileKey = String(elements.key.value || '').trim().toLowerCase();
    source.DisplayName = String(elements.name.value || '').trim();
    source.Vehicle = String(elements.vehicle.value || 'f15');
    elements.source.value = JSON.stringify(source, null, 2);
    markEdited();
  }

  function recoveryKey() {
    return 'raidlands.airstrike-animation-recovery.' + (state.profileKey || String(elements.key.value || 'new'));
  }

  function markEdited() {
    if (state.loading) {
      return;
    }
    setDirty(true);
    setStatus('Draft has local changes');
    try {
      window.localStorage.setItem(recoveryKey(), JSON.stringify({
        savedAt: new Date().toISOString(),
        source: elements.source.value,
      }));
    } catch (error) {
      // Local recovery is best-effort; server saves remain authoritative.
    }
  }

  function loadSource(source, profileKey, version) {
    state.loading = true;
    state.profileKey = profileKey || '';
    state.baseVersion = Number(version || 0);
    elements.source.value = JSON.stringify(source, null, 2);
    elements.key.value = String(source.ProfileKey || '');
    elements.name.value = String(source.DisplayName || '');
    elements.vehicle.value = String(source.Vehicle || 'f15');
    elements.key.disabled = state.baseVersion > 0;
    elements.title.textContent = String(source.DisplayName || source.ProfileKey || 'New profile');
    elements.output.textContent = '';
    elements.compileSummary.textContent = 'No compiled track yet';
    showFeedback('Validate this draft before publishing.', '');
    setDirty(false);
    setStatus(state.baseVersion > 0 ? 'Draft v' + state.baseVersion + ' loaded' : 'New unsaved profile');
    state.loading = false;
  }

  async function request(path, options) {
    const settings = options || {};
    const headers = {
      Accept: 'application/json',
      'X-Raidlands-Admin-CSRF': String(config.csrf || ''),
      ...(settings.headers || {}),
    };
    if (settings.body) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(String(config.apiBase).replace(/\/$/, '') + '/' + path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...settings,
      headers: headers,
    });
    const payload = await response.json().catch(function () {
      return { ok: false, error: 'The server returned an unreadable response.' };
    });
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'The request failed.');
    }
    return payload;
  }

  function renderProfiles() {
    const filter = String(elements.search.value || '').trim().toLowerCase();
    elements.list.textContent = '';
    state.profiles
      .filter(function (profile) {
        return !filter
          || String(profile.profileKey || '').toLowerCase().includes(filter)
          || String(profile.displayName || '').toLowerCase().includes(filter);
      })
      .forEach(function (profile) {
        const button = document.createElement('button');
        const label = document.createElement('strong');
        const detail = document.createElement('small');
        button.type = 'button';
        button.className = 'airstrike-editor-profile' + (profile.profileKey === state.profileKey ? ' is-active' : '');
        label.textContent = profile.displayName || profile.profileKey;
        detail.textContent = profile.profileKey + ' · ' + profile.vehicle + ' · draft v' + profile.draftVersion;
        button.append(label, detail);
        button.addEventListener('click', function () {
          if (state.dirty && !window.confirm('Discard local unsaved changes and load ' + profile.profileKey + '?')) {
            return;
          }
          loadProfile(profile.profileKey);
        });
        elements.list.appendChild(button);
      });
  }

  async function loadList() {
    const payload = await request('list.php?include_archived=0', { method: 'GET' });
    state.profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
    renderProfiles();
  }

  async function loadProfile(profileKey) {
    setStatus('Loading ' + profileKey + '…');
    try {
      const payload = await request('get.php?profile=' + encodeURIComponent(profileKey), { method: 'GET' });
      loadSource(payload.profile.source, payload.profile.profileKey, payload.profile.draftVersion);
      window.history.replaceState({}, '', './airstrike-animation-editor.php?profile=' + encodeURIComponent(profileKey));
      renderProfiles();
    } catch (error) {
      showFeedback(error.message, 'error');
      setStatus('Load failed');
    }
  }

  async function saveDraft() {
    let source;
    try {
      syncIdentityIntoSource();
      source = parseSource();
    } catch (error) {
      showFeedback(error.message, 'error');
      return;
    }

    setStatus('Saving draft…');
    try {
      const path = state.baseVersion > 0 ? 'save.php' : 'create.php';
      const body = state.baseVersion > 0
        ? { profileKey: state.profileKey, baseVersion: state.baseVersion, source: source }
        : { source: source };
      const payload = await request(path, { method: 'POST', body: JSON.stringify(body) });
      loadSource(payload.profile.source, payload.profile.profileKey, payload.profile.draftVersion);
      try { window.localStorage.removeItem(recoveryKey()); } catch (error) {}
      await loadList();
      window.history.replaceState({}, '', './airstrike-animation-editor.php?profile=' + encodeURIComponent(payload.profile.profileKey));
      showFeedback('Draft v' + payload.profile.draftVersion + ' saved.', 'success');
    } catch (error) {
      showFeedback(error.message, 'error');
      setStatus('Save failed');
    }
  }

  async function validateSource() {
    let source;
    try {
      syncIdentityIntoSource();
      source = parseSource();
    } catch (error) {
      showFeedback(error.message, 'error');
      return;
    }
    setStatus('Validating…');
    try {
      const payload = await request('validate.php', {
        method: 'POST',
        body: JSON.stringify({ source: source }),
      });
      const validation = payload.validation || {};
      const errors = Array.isArray(validation.errors) ? validation.errors : [];
      const warnings = Array.isArray(validation.warnings) ? validation.warnings : [];
      if (!validation.ok) {
        showFeedback(errors.map(function (entry) {
          return (entry.path ? entry.path + ': ' : '') + (entry.message || 'Validation failed');
        }).join('\n'), 'error');
        setStatus(errors.length + ' validation error(s)');
        return;
      }
      showFeedback('Profile is valid.' + (warnings.length ? '\n' + warnings.join('\n') : ''), 'success');
      setStatus('Validation passed');
    } catch (error) {
      showFeedback(error.message, 'error');
      setStatus('Validation failed');
    }
  }

  async function compilePreview() {
    let source;
    try {
      syncIdentityIntoSource();
      source = parseSource();
    } catch (error) {
      showFeedback(error.message, 'error');
      return;
    }
    setStatus('Compiling canonical track…');
    try {
      const payload = await request('compile-preview.php', {
        method: 'POST',
        body: JSON.stringify({ source: source }),
      });
      const compiled = payload.compiled || {};
      const runtime = compiled.runtime || {};
      const frames = runtime.CompiledTrack && Array.isArray(runtime.CompiledTrack.Frames)
        ? runtime.CompiledTrack.Frames
        : [];
      const releases = Array.isArray(runtime.CompiledReleaseEvents) ? runtime.CompiledReleaseEvents : [];
      elements.compileSummary.textContent = frames.length + ' frames · ' + releases.length + ' compiled payload units';
      elements.output.textContent = JSON.stringify(compiled, null, 2);
      showFeedback('Compiled preview matches server-side publication logic.', 'success');
      setStatus('Compile preview ready');
    } catch (error) {
      showFeedback(error.message, 'error');
      setStatus('Compile failed');
    }
  }

  async function publish(sync) {
    if (state.dirty) {
      showFeedback('Save the current draft before publishing the complete profile set.', 'error');
      return;
    }
    if (!window.confirm(sync ? 'Publish all active drafts and request server sync?' : 'Publish all active drafts?')) {
      return;
    }
    setStatus('Publishing immutable bundle…');
    try {
      const payload = await request('publish.php', {
        method: 'POST',
        body: JSON.stringify({ sync: sync }),
      });
      const publication = payload.publication || {};
      showFeedback(
        'Published revision ' + publication.revision + '.\n' + ((publication.rcon || {}).message || ''),
        (publication.rcon || {}).ok ? 'success' : 'error'
      );
      setStatus('Published revision ' + publication.revision);
    } catch (error) {
      showFeedback(error.message, 'error');
      setStatus('Publish failed');
    }
  }

  elements.source.addEventListener('input', markEdited);
  elements.key.addEventListener('change', syncIdentityIntoSource);
  elements.name.addEventListener('change', syncIdentityIntoSource);
  elements.vehicle.addEventListener('change', syncIdentityIntoSource);
  elements.search.addEventListener('input', renderProfiles);
  root.querySelector('[data-editor-new]').addEventListener('click', function () {
    if (state.dirty && !window.confirm('Discard local unsaved changes and start a new profile?')) {
      return;
    }
    loadSource(starterSource(), '', 0);
    window.history.replaceState({}, '', './airstrike-animation-editor.php');
    renderProfiles();
  });
  root.querySelector('[data-editor-save]').addEventListener('click', saveDraft);
  root.querySelector('[data-editor-validate]').addEventListener('click', validateSource);
  root.querySelector('[data-editor-compile]').addEventListener('click', compilePreview);
  root.querySelectorAll('[data-editor-publish]').forEach(function (button) {
    button.addEventListener('click', function () {
      publish(button.dataset.editorPublish === 'sync');
    });
  });
  document.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveDraft();
    }
  });

  (async function initialize() {
    try {
      await loadList();
      if (config.profileKey) {
        await loadProfile(config.profileKey);
      } else {
        loadSource(starterSource(), '', 0);
      }
    } catch (error) {
      loadSource(starterSource(), '', 0);
      showFeedback(error.message, 'error');
      setStatus('Editor started without server profile list');
    }
  })();
})();
