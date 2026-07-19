<?php

require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/stats.php';
require_once $site_root . '/includes/podium.php';
require_once $site_root . '/includes/discord.php';
require_once $site_root . '/includes/admin.php';

$profile_player = raidlands_store_current_player();
$profile_entitlements = [];
$profile_active_groups = [];
$profile_stats = ['current' => null, 'all_time' => null, 'wipe' => null];
$profile_rp_balance = null;
$profile_rp_requests = [];
$profile_rp_subscriptions = [];
$profile_cash_subscriptions = [];
$profile_flash = raidlands_store_flash();
$profile_discord = null;
$profile_podium = null;
$profile_is_podium_admin = false;

if ($profile_player !== null && !empty($profile_player['id'])) {
    $profile_discord = raidlands_discord_identity_for_player((int) $profile_player['id']);
    $profile_entitlements = raidlands_store_entitlements_for_player((int) $profile_player['id']);
    $state = raidlands_store_active_groups_for_steam((string) $profile_player['steam_id64']);
    $profile_active_groups = $state['groups'];
    $profile_stats = raidlands_stats_player_summary((int) $profile_player['id']);
    $profile_rp_balance = raidlands_store_current_rp_balance((int) $profile_player['id']);
    $profile_rp_requests = raidlands_store_rp_requests_for_player((int) $profile_player['id']);
    $profile_rp_subscriptions = raidlands_store_rp_subscriptions_for_player((int) $profile_player['id']);
    $profile_cash_subscriptions = raidlands_store_cash_subscriptions_for_player((int) $profile_player['id']);
    $profile_podium = raidlands_podium_profile_bundle((int) $profile_player['id'], (string) $profile_player['steam_id64']);
    $profile_is_podium_admin = raidlands_admin_can('admin.access');
}

$profile_display_name = $profile_player !== null
    ? (string) ($profile_player['display_name'] ?: ($profile_player['steam_display_name'] ?? 'Raidlands Player'))
    : '';
$profile_avatar = $profile_player !== null
    ? render_steam_avatar(
        (string) ($profile_player['steam_avatar_url'] ?? ''),
        (string) ($profile_player['steam_profile_url'] ?? ''),
        $profile_display_name,
        'steam-avatar-lg'
    )
    : '';
$profile_url = $profile_player !== null ? trim((string) ($profile_player['steam_profile_url'] ?? '')) : '';
?>
<?= render_page_hero('profile',
    '<a class="btn btn-primary" href="' . e(route_url('store')) . '">Open Store</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('clans')) . '">Manage Clan</a>'
    . '<a class="btn btn-steam" href="' . e(raidlands_account_url()) . '">' . e(raidlands_account_label('Sign in with Steam', 'Account')) . '</a>'
) ?>

<section class="section">
  <div class="section-inner">
    <?php if ($profile_flash !== null) : ?>
      <div class="form-status <?= e((string) $profile_flash['type']) ?>"><?= e((string) $profile_flash['message']) ?></div>
    <?php endif; ?>

    <?php if ($profile_player === null) : ?>
      <div class="metal-panel">
        <p class="section-kicker">Profile locked</p>
        <h2>Sign in with Steam to view your account</h2>
        <p class="section-lede">Your profile uses your Steam account so purchases, refunds, subscriptions, and in-game access all point at the same Rust player.</p>
        <div class="button-row">
          <a class="btn btn-steam" href="<?= e(route_url('link')) ?>">Sign in with Steam</a>
          <a class="btn btn-secondary" href="<?= e(route_url('store')) ?>">Preview Store</a>
        </div>
      </div>
    <?php else : ?>
      <div class="split-panel">
        <div class="metal-panel">
          <div class="player-profile-heading">
            <?= $profile_avatar ?>
            <div>
              <p class="section-kicker">Linked player</p>
              <h2><?= e($profile_display_name) ?></h2>
            </div>
          </div>
          <div class="auth-status is-linked">
            <strong>Steam ID:</strong> <code><?= e((string) $profile_player['steam_id64']) ?></code>
            <?php if ($profile_url !== '') : ?>
              <a class="profile-steam-link" href="<?= e($profile_url) ?>" target="_blank" rel="noopener noreferrer">Open Steam Profile</a>
            <?php endif; ?>
          </div>
          <div class="tag-row">
            <span class="tag"><?= $profile_discord !== null ? 'Discord connected' : 'Discord not connected' ?></span>
            <?php if ($profile_active_groups === []) : ?>
              <span class="tag">No active store access yet</span>
            <?php else : ?>
              <?php foreach ($profile_active_groups as $group) : ?>
                <span class="tag"><?= e(raidlands_public_access_label($group)) ?></span>
              <?php endforeach; ?>
            <?php endif; ?>
          </div>
          <div class="button-row"><a class="btn btn-discord" href="<?= e(route_url('discord')) ?>"><?= $profile_discord !== null ? 'Manage Discord' : 'Connect Discord' ?></a></div>
        </div>

        <div class="metal-panel">
          <p class="section-kicker">Game access</p>
          <h2>Active server perks</h2>
          <p class="section-lede">These are the kits, bundles, and perks Raidlands should apply when you connect. Updates may take a short moment after checkout or renewal.</p>
          <div class="button-row">
            <a class="btn btn-primary" href="<?= e(route_url('store')) ?>">Add Perks</a>
            <a class="btn btn-secondary" href="<?= e(route_url('clans')) ?>">Clan Tools</a>
            <a class="btn btn-secondary" href="<?= e(route_url('discord')) ?>">Need Help?</a>
          </div>
        </div>
      </div>
    <?php endif; ?>
  </div>
</section>

<?php if ($profile_player !== null) : ?>
  <?php
    $podium_profile = (array) ($profile_podium['profile'] ?? []);
    $podium_resolved = (array) ($profile_podium['resolved'] ?? raidlands_podium_preset_payload('survivor', 'default'));
    $podium_preview_payload = json_encode([
        'board' => 'players',
        'metric' => 'kills',
        'leaders' => [[
            'display_name' => $profile_display_name,
            'steam_avatar_url' => (string) ($profile_player['steam_avatar_url'] ?? ''),
            'steam_profile_url' => $profile_url,
            'kills' => (int) ($profile_stats['current']['kills'] ?? 0),
            'appearance' => $podium_resolved,
        ]],
    ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    $podium_bundle_json = json_encode($profile_podium, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
  ?>
  <section class="section podium-profile-section">
    <div class="section-inner">
      <div class="section-header">
        <p class="section-kicker">Podium appearance</p>
        <h2>Choose how you enter the top three</h2>
        <p class="section-lede">Auto learns the complete outfit and supported weapon you use most this wipe. You can also lock in a captured look or a polished Raidlands preset.</p>
      </div>

      <?php if (!raidlands_podium_is_ready()) : ?>
        <div class="form-status warning">Run database migrations 064 and 069 to enable saved podium appearances and poses. The leaderboard will use stable vanilla player presets until then.</div>
      <?php else : ?>
        <div class="podium-profile-grid" data-podium-profile data-pose-api="<?= e(route_url('api/profile/podium-poses.php')) ?>" data-podium-admin="<?= $profile_is_podium_admin ? 'true' : 'false' ?>">
          <section class="leaderboard-podium podium-profile-preview" data-leaderboard-podium data-podium-layout="single" data-board="players" data-metric="kills"
            data-pose-editor="<?= $profile_is_podium_admin ? 'true' : 'false' ?>" data-pose-bones="<?= e(implode(',', (array) ($profile_podium['pose_bones'] ?? []))) ?>"
            data-model-base="<?= e(asset_url('media/models/leaderboard/')) ?>" data-decoder-path="<?= e(asset_url('media/models/draco/')) ?>"
            data-ground-albedo-src="<?= e(asset_url('media/textures/leaderboard-junkyard-dirt-albedo.webp')) ?>"
            data-ground-normal-src="<?= e(asset_url('media/textures/leaderboard-junkyard-dirt-normal.webp')) ?>"
            data-ground-arm-src="<?= e(asset_url('media/textures/leaderboard-junkyard-dirt-arm.webp')) ?>"
            data-ground-fallback-src="<?= e(asset_url('media/textures/road-dirt.webp')) ?>" aria-label="Your podium preview">
            <div class="leaderboard-podium-stage" data-podium-stage aria-hidden="true"></div>
            <div class="leaderboard-podium-cards" data-podium-cards></div>
            <p class="leaderboard-podium-status" data-podium-status aria-live="polite">Loading your podium preview.</p>
            <script type="application/json" data-podium-payload><?= $podium_preview_payload ?: '{}' ?></script>
          </section>

          <form class="metal-panel podium-profile-form" method="post" action="<?= e(route_url('profile') . 'podium-appearance.php') ?>" data-podium-profile-form>
            <input type="hidden" name="csrf" value="<?= e(raidlands_store_csrf_token()) ?>">
            <input type="hidden" name="outfit_mode" value="<?= e((string) ($podium_profile['outfit_mode'] ?? 'auto')) ?>" data-podium-outfit-mode>
            <input type="hidden" name="outfit_key" value="<?= e((string) ($podium_profile['outfit_key'] ?? '')) ?>" data-podium-outfit-key>
            <input type="hidden" name="weapon_mode" value="<?= e((string) ($podium_profile['weapon_mode'] ?? 'auto')) ?>" data-podium-weapon-mode>
            <input type="hidden" name="weapon_key" value="<?= e((string) ($podium_profile['weapon_key'] ?? '')) ?>" data-podium-weapon-key>
            <input type="hidden" name="pose_key" value="<?= e((string) ($podium_profile['pose_key'] ?? 'default')) ?>" data-podium-pose-key>
            <script type="application/json" data-podium-profile-bundle><?= $podium_bundle_json ?: '{}' ?></script>

            <label>
              <span>Outfit</span>
              <?php $current_outfit_value = (string) ($podium_profile['outfit_mode'] ?? 'auto') . '|' . (string) ($podium_profile['outfit_key'] ?? ''); ?>
              <select data-podium-outfit-select>
                <option value="auto|"<?= $current_outfit_value === 'auto|' ? ' selected' : '' ?>>Auto — current-wipe favorite</option>
                <optgroup label="Raidlands presets">
                  <?php foreach ((array) ($profile_podium['presets'] ?? []) as $key => $preset) : ?>
                    <option value="preset|<?= e((string) $key) ?>"<?= $current_outfit_value === 'preset|' . $key ? ' selected' : '' ?>><?= e((string) ($preset['label'] ?? $key)) ?></option>
                  <?php endforeach; ?>
                </optgroup>
                <?php if (!empty($profile_podium['captured_outfits'])) : ?>
                  <optgroup label="Captured this wipe">
                    <?php foreach ((array) $profile_podium['captured_outfits'] as $outfit) : ?>
                      <option value="captured|<?= e((string) $outfit['key']) ?>"<?= $current_outfit_value === 'captured|' . $outfit['key'] ? ' selected' : '' ?>><?= e((string) $outfit['label']) ?></option>
                    <?php endforeach; ?>
                  </optgroup>
                <?php endif; ?>
              </select>
            </label>

            <label>
              <span>Weapon</span>
              <?php $current_weapon_value = (string) ($podium_profile['weapon_mode'] ?? 'auto') . '|' . (string) ($podium_profile['weapon_key'] ?? ''); ?>
              <select data-podium-weapon-select>
                <option value="auto|"<?= $current_weapon_value === 'auto|' ? ' selected' : '' ?>>Auto — current-wipe favorite</option>
                <option value="none|"<?= $current_weapon_value === 'none|' ? ' selected' : '' ?>>No weapon</option>
                <optgroup label="Vanilla weapons">
                  <?php foreach ((array) ($profile_podium['weapons'] ?? []) as $shortname => $weapon) : ?>
                    <option value="preset|<?= e((string) $shortname) ?>"<?= $current_weapon_value === 'preset|' . $shortname ? ' selected' : '' ?>><?= e((string) ($weapon['label'] ?? $shortname)) ?></option>
                  <?php endforeach; ?>
                </optgroup>
                <?php if (!empty($profile_podium['captured_weapons'])) : ?>
                  <optgroup label="Captured this wipe">
                    <?php foreach ((array) $profile_podium['captured_weapons'] as $weapon) : ?>
                      <?php $weapon_value = (string) $weapon['weapon_shortname'] . ':' . (string) $weapon['skin_id']; ?>
                      <?php if (isset($profile_podium['weapons'][$weapon['weapon_shortname']])) : ?>
                        <option value="captured|<?= e($weapon_value) ?>"<?= $current_weapon_value === 'captured|' . $weapon_value ? ' selected' : '' ?>><?= e((string) $profile_podium['weapons'][$weapon['weapon_shortname']]['label']) ?> (<?= e((string) $weapon['sample_count']) ?> captures)</option>
                      <?php endif; ?>
                    <?php endforeach; ?>
                  </optgroup>
                <?php endif; ?>
              </select>
            </label>

            <label>
              <span>Pose</span>
              <select data-podium-pose-select>
                <?php foreach ((array) ($profile_podium['poses'] ?? []) as $key => $pose) : ?>
                  <option value="<?= e((string) $key) ?>"<?= (string) ($podium_profile['pose_key'] ?? 'default') === (string) $key ? ' selected' : '' ?>><?= e((string) ($pose['label'] ?? $key)) ?></option>
                <?php endforeach; ?>
              </select>
            </label>

            <?php if ($profile_is_podium_admin) : ?>
              <section class="podium-pose-editor" data-podium-pose-editor>
                <div class="podium-pose-editor-heading">
                  <div><span class="tag">Admin</span><strong>Pose editor</strong></div>
                  <button class="btn btn-secondary" type="button" data-pose-reset>Reset bone</button>
                </div>
                <label><span>Bone</span><select data-pose-bone>
                  <?php foreach ((array) ($profile_podium['pose_bones'] ?? []) as $bone) : ?>
                    <option value="<?= e((string) $bone) ?>"><?= e(ucwords(str_replace('_', ' ', (string) $bone))) ?></option>
                  <?php endforeach; ?>
                </select></label>
                <?php foreach (['x' => 'Pitch (X)', 'y' => 'Yaw (Y)', 'z' => 'Roll (Z)'] as $axis => $label) : ?>
                  <label class="podium-pose-axis"><span><?= e($label) ?> <output data-pose-output="<?= e($axis) ?>">0&deg;</output></span><input type="range" min="-180" max="180" step="1" value="0" data-pose-axis="<?= e($axis) ?>"></label>
                <?php endforeach; ?>
                <div class="podium-pose-save">
                  <label><span>New pose name</span><input type="text" maxlength="80" placeholder="Victory stance" data-pose-name></label>
                  <button class="btn btn-primary" type="button" data-pose-save>Save as Available Pose</button>
                </div>
                <p class="podium-pose-status" data-pose-status aria-live="polite">Grab a joint in the 3D view. Left-drag bends it; right-drag rolls it. The sliders remain available for precise edits.</p>
              </section>
            <?php endif; ?>

            <div class="podium-profile-guidance">
              <strong>How Auto works</strong>
              <p>After three captures, an outfit must account for at least half of this wipe's observations. Unknown Workshop skins keep their real skin ID and display the vanilla garment until an exact model is mapped.</p>
            </div>
            <button class="btn btn-primary" type="submit">Save Podium Appearance</button>
          </form>
        </div>
      <?php endif; ?>
    </div>
  </section>

  <section class="section">
    <div class="section-inner">
      <div class="section-header">
        <p class="section-kicker">Player stats</p>
        <h2>RP, combat, and playtime</h2>
        <p class="section-lede">These stats come from the game server. Wipe RP follows the active season; your synced spendable RP balance is shown in the RP shop section.</p>
      </div>

      <?php if (!raidlands_stats_is_ready()) : ?>
        <div class="form-status warning">Stats tables are not installed yet, so profile stats are waiting for setup.</div>
      <?php elseif ($profile_stats['current'] === null && $profile_stats['all_time'] === null) : ?>
        <div class="metal-panel">
          <p class="section-lede">No game stats have reached this profile yet. Join the server and they should appear here after the next update.</p>
        </div>
      <?php else : ?>
        <div class="profile-stat-grid">
          <?php
            $stat_cards = [
                ['Wipe RP', $profile_stats['current']['reward_points'] ?? 0],
                ['Wipe Kills', $profile_stats['current']['kills'] ?? 0],
                ['Wipe NPC Kills', $profile_stats['current']['npc_kills'] ?? 0],
                ['Killed by NPCs', $profile_stats['current']['deaths_by_npc'] ?? 0],
                ['Wipe K/D', isset($profile_stats['current']) ? raidlands_stats_format_kdr($profile_stats['current']['kdr'] ?? 0) : '0.00'],
                ['Wipe Playtime', isset($profile_stats['current']) ? raidlands_stats_format_duration($profile_stats['current']['playtime_seconds'] ?? 0) : '0m'],
                ['All-Time Kills', $profile_stats['all_time']['kills'] ?? 0],
                ['All-Time NPC Kills', $profile_stats['all_time']['npc_kills'] ?? 0],
                ['All-Time Playtime', isset($profile_stats['all_time']) ? raidlands_stats_format_duration($profile_stats['all_time']['playtime_seconds'] ?? 0) : '0m'],
                ['Wipe Raid Damage', $profile_stats['current']['raid_damage'] ?? 0],
                ['Wipe Rockets Used', $profile_stats['current']['rockets_used'] ?? 0],
                ['Wipe C4 Used', $profile_stats['current']['c4_used'] ?? 0],
                ['Wipe Satchels Used', $profile_stats['current']['satchels_used'] ?? 0],
                ['Wipe Explosive Ammo', $profile_stats['current']['explosive_ammo_used'] ?? 0],
                ['Wipe TCs Broken', $profile_stats['current']['tcs_destroyed'] ?? 0],
                ['All-Time Raid Damage', $profile_stats['all_time']['raid_damage'] ?? 0],
                ['All-Time Rockets Used', $profile_stats['all_time']['rockets_used'] ?? 0],
                ['All-Time C4 Used', $profile_stats['all_time']['c4_used'] ?? 0],
                ['All-Time Satchels Used', $profile_stats['all_time']['satchels_used'] ?? 0],
                ['All-Time Explosive Ammo', $profile_stats['all_time']['explosive_ammo_used'] ?? 0],
                ['All-Time TCs Broken', $profile_stats['all_time']['tcs_destroyed'] ?? 0],
            ];
          ?>
          <?php foreach ($stat_cards as [$label, $value]) : ?>
            <article class="stat-tile">
              <span><?= e($label) ?></span>
              <strong><?= e(is_int($value) ? raidlands_stats_format_number($value) : (string) $value) ?></strong>
            </article>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>
  </section>

  <section class="section alt">
    <div class="section-inner">
      <div class="section-header">
        <p class="section-kicker">RP shop</p>
        <h2>Requests and renewals</h2>
        <p class="section-lede">RP requests wait for the game server to confirm the live balance and debit before access changes.</p>
      </div>

      <div class="profile-stat-grid">
        <article class="stat-tile">
          <span>Synced RP</span>
          <strong><?= e(raidlands_store_rp((int) ($profile_rp_balance['reward_points'] ?? 0))) ?></strong>
        </article>
        <article class="stat-tile">
          <span>Pending Requests</span>
          <strong><?= e((string) count(array_filter($profile_rp_requests, static fn (array $row): bool => in_array((string) $row['status'], ['queued', 'processing'], true)))) ?></strong>
        </article>
        <article class="stat-tile">
          <span>Auto-Renew</span>
          <strong><?= e((string) count(array_filter($profile_rp_subscriptions, static fn (array $row): bool => in_array((string) $row['status'], ['active', 'past_due'], true) && empty($row['cancel_at_period_end'])))) ?></strong>
        </article>
        <article class="stat-tile">
          <span>Cash Subscriptions</span>
          <strong><?= e((string) count(array_filter($profile_cash_subscriptions, static fn (array $row): bool => in_array((string) $row['status'], ['active', 'trialing', 'past_due'], true)))) ?></strong>
        </article>
      </div>

      <?php if ($profile_rp_subscriptions !== []) : ?>
        <div class="store-table-wrap">
          <table class="store-table">
            <thead>
              <tr>
                <th>Renewal</th>
                <th>Cost</th>
                <th>Status</th>
                <th>Period Ends</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($profile_rp_subscriptions as $subscription) : ?>
                <tr>
                  <td><?= e((string) $subscription['product_name']) ?> / <?= e((string) $subscription['price_label']) ?></td>
                  <td><?= e(raidlands_store_rp((int) $subscription['rp_cost'])) ?></td>
                  <td><span class="status-pill <?= e((string) $subscription['status']) ?>"><?= e((string) $subscription['status']) ?></span></td>
                  <td><?= e((string) ($subscription['current_period_end'] ?: 'No scheduled expiration')) ?></td>
                  <td>
                    <?php if (in_array((string) $subscription['status'], ['active', 'past_due'], true) && empty($subscription['cancel_at_period_end'])) : ?>
                      <form method="post" action="<?= e(route_url('profile') . 'rp-subscription.php') ?>">
                        <input type="hidden" name="csrf" value="<?= e(raidlands_store_csrf_token()) ?>">
                        <input type="hidden" name="subscription_id" value="<?= e((string) $subscription['id']) ?>">
                        <button class="btn btn-secondary" type="submit">Cancel Renewal</button>
                      </form>
                    <?php else : ?>
                      <span class="store-muted">No action</span>
                    <?php endif; ?>
                  </td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      <?php endif; ?>

      <?php if ($profile_rp_requests !== []) : ?>
        <div class="store-table-wrap">
          <table class="store-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Cost</th>
                <th>Status</th>
                <th>Message</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($profile_rp_requests as $request) : ?>
                <tr>
                  <td><?= e((string) $request['product_name']) ?> / <?= e((string) $request['price_label']) ?></td>
                  <td><?= e(raidlands_store_rp((int) $request['rp_cost'])) ?></td>
                  <td><span class="status-pill <?= e((string) $request['status']) ?>"><?= e((string) $request['status']) ?></span></td>
                  <td><?= e((string) ($request['message'] ?: 'Waiting for server confirmation')) ?></td>
                  <td><?= e((string) $request['created_at']) ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      <?php endif; ?>
    </div>
  </section>

  <section class="section">
    <div class="section-inner">
      <div class="section-header">
        <p class="section-kicker">Cash billing</p>
        <h2>Subscriptions</h2>
        <p class="section-lede">Recurring cash plans are managed through Stripe billing. One-time cash passes and RP purchases stay in access history below.</p>
      </div>

      <?php if ($profile_cash_subscriptions === []) : ?>
        <div class="metal-panel">
          <p class="section-lede">No cash subscriptions are attached to this Steam account yet.</p>
          <a class="btn btn-primary" href="<?= e(route_url('store')) ?>">Open Store</a>
        </div>
      <?php else : ?>
        <div class="button-row">
          <form method="post" action="<?= e(route_url('profile') . 'billing-portal.php') ?>">
            <input type="hidden" name="csrf" value="<?= e(raidlands_store_csrf_token()) ?>">
            <button class="btn btn-primary" type="submit">Manage Billing</button>
          </form>
        </div>
        <div class="store-table-wrap">
          <table class="store-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Period Ends</th>
                <th>Billing</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($profile_cash_subscriptions as $subscription) : ?>
                <tr>
                  <td><?= e((string) $subscription['product_name']) ?></td>
                  <td><?= e((string) $subscription['price_label']) ?></td>
                  <td><span class="status-pill <?= e((string) $subscription['status']) ?>"><?= e((string) $subscription['status']) ?></span></td>
                  <td><?= e((string) ($subscription['current_period_end'] ?: 'No scheduled expiration')) ?></td>
                  <td><?= !empty($subscription['cancel_at_period_end']) ? 'Cancels at period end' : 'Renews in Stripe' ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      <?php endif; ?>
    </div>
  </section>

  <section class="section alt">
    <div class="section-inner">
      <div class="section-header">
        <p class="section-kicker">Access history</p>
        <h2>Kits, perks, and changes</h2>
        <p class="section-lede">Active items are what your account can use in game. Ended or refunded items stay visible so support can help faster.</p>
      </div>

      <?php if ($profile_entitlements === []) : ?>
        <div class="metal-panel">
          <p class="section-lede">No kits, bundles, or perks are attached to this Steam account yet.</p>
          <a class="btn btn-primary" href="<?= e(route_url('store')) ?>">Open Store</a>
        </div>
      <?php else : ?>
        <div class="store-table-wrap">
          <table class="store-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Type</th>
                <th>Access</th>
                <th>Status</th>
                <th>Ends</th>
                <th>Changed</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($profile_entitlements as $entitlement) : ?>
                <?php
                  $entitlement_groups = raidlands_store_clean_groups((array) ($entitlement['fulfillment_groups'] ?? []));

                  if ($entitlement_groups === []) {
                      $entitlement_groups = raidlands_store_clean_groups([(string) ($entitlement['oxide_group'] ?? '')]);
                  }

                  $access_label = $entitlement_groups === []
                      ? 'No server group'
                      : implode(', ', array_map(static fn (string $group): string => raidlands_public_access_label($group), $entitlement_groups));
                ?>
                <tr>
                  <td><?= e((string) $entitlement['name']) ?></td>
                  <td><?= e(raidlands_store_type_label((string) $entitlement['product_type'])) ?></td>
                  <td><?= e($access_label) ?></td>
                  <td><span class="status-pill <?= e((string) $entitlement['status']) ?>"><?= e((string) $entitlement['status']) ?></span></td>
                  <td><?= e((string) ($entitlement['ends_at'] ?: 'No scheduled expiration')) ?></td>
                  <td><?= e((string) $entitlement['changed_at']) ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      <?php endif; ?>
    </div>
  </section>
<?php endif; ?>

<?php if ($profile_player !== null && raidlands_podium_is_ready()) : ?>
  <script type="module" src="<?= e(asset_url('build/airstrike-animation-editor/leaderboard-podium.js')) ?>"></script>
  <script defer src="<?= e(asset_url('js/podium-profile.js')) ?>"></script>
<?php endif; ?>
