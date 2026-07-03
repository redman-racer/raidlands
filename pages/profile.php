<?php

require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/stats.php';

$profile_player = raidlands_store_current_player();
$profile_entitlements = [];
$profile_active_groups = [];
$profile_stats = ['current' => null, 'all_time' => null, 'wipe' => null];
$profile_rp_balance = null;
$profile_rp_requests = [];
$profile_rp_subscriptions = [];
$profile_flash = raidlands_store_flash();

if ($profile_player !== null && !empty($profile_player['id'])) {
    $profile_entitlements = raidlands_store_entitlements_for_player((int) $profile_player['id']);
    $state = raidlands_store_active_groups_for_steam((string) $profile_player['steam_id64']);
    $profile_active_groups = $state['groups'];
    $profile_stats = raidlands_stats_player_summary((int) $profile_player['id']);
    $profile_rp_balance = raidlands_store_current_rp_balance((int) $profile_player['id']);
    $profile_rp_requests = raidlands_store_rp_requests_for_player((int) $profile_player['id']);
    $profile_rp_subscriptions = raidlands_store_rp_subscriptions_for_player((int) $profile_player['id']);
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
    '<a class="btn btn-primary" href="' . e(route_url('store')) . '">Shop VIP</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('clans')) . '">Manage Clan</a>'
    . '<a class="btn btn-secondary" href="' . e(raidlands_account_url()) . '">' . e(raidlands_account_label('Connect Steam', 'Account')) . '</a>'
) ?>

<section class="section">
  <div class="section-inner">
    <?php if ($profile_flash !== null) : ?>
      <div class="form-status <?= e((string) $profile_flash['type']) ?>"><?= e((string) $profile_flash['message']) ?></div>
    <?php endif; ?>

    <?php if ($profile_player === null) : ?>
      <div class="metal-panel">
        <p class="section-kicker">Profile locked</p>
        <h2>Connect Steam to view VIP access</h2>
        <p class="section-lede">Your profile uses your Steam account so purchases, refunds, subscriptions, and in-game access all point at the same Rust player.</p>
        <div class="button-row">
          <a class="btn btn-primary" href="<?= e(route_url('link')) ?>">Connect Steam</a>
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
            <?php if ($profile_active_groups === []) : ?>
              <span class="tag">No active VIP access yet</span>
            <?php else : ?>
              <?php foreach ($profile_active_groups as $group) : ?>
                <span class="tag"><?= e(raidlands_public_access_label($group)) ?></span>
              <?php endforeach; ?>
            <?php endif; ?>
          </div>
        </div>

        <div class="metal-panel">
          <p class="section-kicker">Game access</p>
          <h2>Active server perks</h2>
          <p class="section-lede">These are the VIP perks Raidlands should apply when you connect. Updates may take a short moment after checkout or renewal.</p>
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
                ['Wipe K/D', isset($profile_stats['current']) ? raidlands_stats_format_kdr($profile_stats['current']['kdr'] ?? 0) : '0.00'],
                ['Wipe Playtime', isset($profile_stats['current']) ? raidlands_stats_format_duration($profile_stats['current']['playtime_seconds'] ?? 0) : '0m'],
                ['All-Time Kills', $profile_stats['all_time']['kills'] ?? 0],
                ['All-Time Playtime', isset($profile_stats['all_time']) ? raidlands_stats_format_duration($profile_stats['all_time']['playtime_seconds'] ?? 0) : '0m'],
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

  <section class="section alt">
    <div class="section-inner">
      <div class="section-header">
        <p class="section-kicker">Access history</p>
        <h2>VIP, perks, and changes</h2>
        <p class="section-lede">Active items are what your account can use in game. Ended or refunded items stay visible so support can help faster.</p>
      </div>

      <?php if ($profile_entitlements === []) : ?>
        <div class="metal-panel">
          <p class="section-lede">No VIP access or perks are attached to this Steam account yet.</p>
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
                <tr>
                  <td><?= e((string) $entitlement['name']) ?></td>
                  <td><?= e(raidlands_store_type_label((string) $entitlement['product_type'])) ?></td>
                  <td><?= e(raidlands_public_access_label((string) $entitlement['oxide_group'])) ?></td>
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
