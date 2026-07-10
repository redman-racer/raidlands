<?php

require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/clans.php';

$api_base = rtrim(raidlands_store_absolute_url(''), '/');
$me_endpoint = $api_base . '/api/clans/me.php';
$action_endpoint = $api_base . '/api/clans/action.php';
?>
<?= render_page_hero('api-docs',
    '<a class="btn btn-primary" href="' . e(route_url('clans')) . '">Manage Keys</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('support')) . '">Developer Help</a>'
) ?>

<section class="section">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Authentication</p>
      <h2>Steam-linked API keys</h2>
      <p class="section-lede">Create keys from the Clans page while signed in with Steam. The secret is shown once, stored only as a hash, and resolves back to that SteamID64 on every request.</p>
    </div>
    <div class="grid two">
      <article class="metal-panel api-doc-card">
        <h3>Headers</h3>
        <pre><code>Authorization: Bearer rcl_your_key_here
Accept: application/json
Content-Type: application/json</code></pre>
        <p class="store-muted">You can also send <code>X-Raidlands-Api-Key</code>. If a request includes <code>steam_id64</code>, it must match the Steam account that owns the key.</p>
      </article>
      <article class="metal-panel api-doc-card">
        <h3>Rate limit</h3>
        <pre><code><?= e((string) raidlands_clans_api_rate_limit_per_minute()) ?> requests / minute / key</code></pre>
        <p class="store-muted">Rate-limited responses return HTTP 429 and <code>Retry-After: 60</code>. Keep Discord bots behind a small queue when many commands fire at once.</p>
      </article>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Read state</p>
      <h2>Resolve the linked clan</h2>
      <p class="section-lede">Use this endpoint to show the caller's clan, role, roster, invites, allies, stale-state flag, and role-allowed actions.</p>
    </div>
    <div class="metal-panel api-doc-card">
      <pre><code>GET <?= e($me_endpoint) ?>
Authorization: Bearer rcl_your_key_here</code></pre>
      <pre><code>{
  "ok": true,
  "context": {
    "player": {"steam_id64": "7656119..."},
    "role": "owner",
    "allowed_actions": ["invite", "withdraw_invite", "kick", "promote", "demote", "disband"],
    "clan": {
      "tag": "RAID",
      "is_stale": false,
      "members": []
    }
  }
}</code></pre>
    </div>
  </div>
</section>

<section class="section">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Queue actions</p>
      <h2>Manage clan changes</h2>
      <p class="section-lede">Write calls use the same clan rules players see on Raidlands. The game server claims queued actions, applies them in Rust, and posts the result back.</p>
    </div>
    <div class="grid two">
      <article class="metal-panel api-doc-card">
        <h3>Invite player</h3>
        <pre><code>POST <?= e($action_endpoint) ?>
Authorization: Bearer rcl_your_key_here

{
  "steam_id64": "7656119...",
  "action": "invite",
  "target_steam_id64": "7656119...",
  "target_display_name": "Player"
}</code></pre>
      </article>
      <article class="metal-panel api-doc-card">
        <h3>Owner actions</h3>
        <pre><code>{
  "action": "promote",
  "target_steam_id64": "7656119..."
}</code></pre>
        <pre><code>{
  "action": "disband",
  "confirm_clan_tag": "RAID"
}</code></pre>
      </article>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="section-inner">
    <div class="metal-panel api-doc-card">
      <p class="section-kicker">Allowed actions</p>
      <h2>Safety model</h2>
      <ul class="list-clean">
        <li>Members can read their synced clan state but cannot queue management actions.</li>
        <li>Moderators can invite, withdraw invites, and kick regular members.</li>
        <li>Owners can also promote, demote, and disband.</li>
        <li>Actions are rejected when the latest game-server snapshot is older than ten minutes.</li>
        <li>Disband requires <code>confirm_clan_tag</code> to match the synced clan tag.</li>
      </ul>
    </div>
  </div>
</section>
