<?php

require_once $site_root . '/includes/store.php';

$profile_player = raidlands_store_current_player();
$profile_entitlements = [];
$profile_active_groups = [];
$profile_flash = raidlands_store_flash();

if ($profile_player !== null && !empty($profile_player['id'])) {
    $profile_entitlements = raidlands_store_entitlements_for_player((int) $profile_player['id']);
    $state = raidlands_store_active_groups_for_steam((string) $profile_player['steam_id64']);
    $profile_active_groups = $state['groups'];
}
?>
<?= render_page_hero('profile',
    '<a class="btn btn-primary" href="' . e(route_url('store')) . '">Shop VIP</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('link')) . '">Link Steam</a>'
) ?>

<section class="section">
  <div class="section-inner">
    <?php if ($profile_flash !== null) : ?>
      <div class="form-status <?= e((string) $profile_flash['type']) ?>"><?= e((string) $profile_flash['message']) ?></div>
    <?php endif; ?>

    <?php if ($profile_player === null) : ?>
      <div class="metal-panel">
        <p class="section-kicker">Profile locked</p>
        <h2>Link Steam to view VIP access</h2>
        <p class="section-lede">Your profile uses SteamID64 so purchases, refunds, subscriptions, and in-game access all point at the same Rust identity.</p>
        <div class="button-row">
          <a class="btn btn-primary" href="<?= e(route_url('link')) ?>">Link SteamID64</a>
          <a class="btn btn-secondary" href="<?= e(route_url('store')) ?>">Preview Store</a>
        </div>
      </div>
    <?php else : ?>
      <div class="split-panel">
        <div class="metal-panel">
          <p class="section-kicker">Linked player</p>
          <h2><?= e((string) ($profile_player['display_name'] ?: 'Raidlands Player')) ?></h2>
          <div class="auth-status is-linked">
            <strong>SteamID64:</strong> <code><?= e((string) $profile_player['steam_id64']) ?></code>
          </div>
          <div class="tag-row">
            <?php if ($profile_active_groups === []) : ?>
              <span class="tag">No active VIP groups yet</span>
            <?php else : ?>
              <?php foreach ($profile_active_groups as $group) : ?>
                <span class="tag"><?= e($group) ?></span>
              <?php endforeach; ?>
            <?php endif; ?>
          </div>
        </div>

        <div class="metal-panel">
          <p class="section-kicker">Game access</p>
          <h2>Active server perks</h2>
          <p class="section-lede">These are the VIP permissions Raidlands should apply when you connect. Updates may take a short moment after checkout or renewal.</p>
          <div class="button-row">
            <a class="btn btn-primary" href="<?= e(route_url('store')) ?>">Add Perks</a>
            <a class="btn btn-secondary" href="<?= e(route_url('discord')) ?>">Need Help?</a>
          </div>
        </div>
      </div>
    <?php endif; ?>
  </div>
</section>

<?php if ($profile_player !== null) : ?>
  <section class="section alt">
    <div class="section-inner">
      <div class="section-header">
        <p class="section-kicker">Access history</p>
        <h2>VIP, perks, and changes</h2>
        <p class="section-lede">Active items are what your account can use in game. Ended or refunded items stay visible so support can help faster.</p>
      </div>

      <?php if ($profile_entitlements === []) : ?>
        <div class="metal-panel">
          <p class="section-lede">No VIP access or perks are attached to this SteamID64 yet.</p>
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
                  <td><code><?= e((string) $entitlement['oxide_group']) ?></code></td>
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
