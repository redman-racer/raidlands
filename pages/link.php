<?php

require_once $site_root . '/includes/store.php';

$linked_player = raidlands_store_current_player();
$link_flash = raidlands_store_flash();
$link_csrf = raidlands_store_csrf_token();
$database_ready = raidlands_db_is_configured() && raidlands_db() instanceof PDO;
?>
<?= render_page_hero('link',
    '<a class="btn btn-primary" href="' . e(route_url('store')) . '">Open Store</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('profile')) . '">View Profile</a>'
) ?>

<section class="section">
  <div class="section-inner split-panel">
    <div class="metal-panel">
      <p class="section-kicker">Steam identity</p>
      <h2>Link before checkout</h2>
      <p class="section-lede">VIP kits and one-time perks must attach to a SteamID64 so WebsiteVipBridge can sync the correct Oxide groups to the game server.</p>

      <?php if ($link_flash !== null) : ?>
        <div class="form-status <?= e((string) $link_flash['type']) ?>"><?= e((string) $link_flash['message']) ?></div>
      <?php endif; ?>

      <?php if ($linked_player !== null) : ?>
        <div class="auth-status is-linked">
          <strong>Linked.</strong>
          SteamID64 <code><?= e((string) $linked_player['steam_id64']) ?></code>
          <?php if (!empty($linked_player['display_name'])) : ?>
            as <?= e((string) $linked_player['display_name']) ?>
          <?php endif; ?>
        </div>
        <div class="button-row">
          <a class="btn btn-primary" href="<?= e(route_url('store')) ?>">Shop VIP Kits</a>
          <form method="post" action="<?= e(route_url('link')) ?>">
            <input type="hidden" name="csrf" value="<?= e($link_csrf) ?>">
            <input type="hidden" name="action" value="unlink_steam">
            <button class="btn btn-ghost" type="submit">Unlink This Browser</button>
          </form>
        </div>
      <?php else : ?>
        <form class="store-form" method="post" action="<?= e(route_url('link')) ?>">
          <input type="hidden" name="csrf" value="<?= e($link_csrf) ?>">
          <input type="hidden" name="action" value="link_steam">
          <label class="store-field">
            <span>SteamID64</span>
            <input type="text" name="steam_id64" inputmode="numeric" autocomplete="off" placeholder="7656119XXXXXXXXXX" required>
          </label>
          <label class="store-field">
            <span>Display name</span>
            <input type="text" name="display_name" autocomplete="nickname" placeholder="Optional">
          </label>
          <button class="btn btn-primary" type="submit">Link SteamID64</button>
        </form>
      <?php endif; ?>

      <?php if (!$database_ready) : ?>
        <div class="form-status warning">MySQL is not configured yet. Steam linking can stay in this browser session, but purchases need the database migration and secrets first.</div>
      <?php endif; ?>
    </div>

    <div class="metal-panel">
      <p class="section-kicker">Bridge model</p>
      <h2>Website owns access</h2>
      <p class="section-lede">Stripe updates MySQL entitlements. The Rust plugin reads those entitlements and adds or removes these managed groups.</p>
      <ul class="list-clean">
        <?php foreach (raidlands_store_managed_groups() as $group) : ?>
          <li><code><?= e($group) ?></code></li>
        <?php endforeach; ?>
      </ul>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Identity rules</p>
      <h2>One SteamID64 per profile</h2>
      <p class="section-lede">This first version uses a SteamID64 form so the store can launch before full Steam OpenID. Add OpenID later without changing the entitlement tables.</p>
    </div>
    <div class="grid three">
      <?= render_card('ID', 'SteamID64 backed', 'Purchases attach to the same ID Rust and Oxide use for permissions.') ?>
      <?= render_card('ROLE', 'Group sync', 'WebsiteVipBridge maps active entitlements to managed Oxide groups.') ?>
      <?= render_card('STAT', 'Profile ready', 'The profile page shows active VIP, perks, expirations, and sync state.') ?>
    </div>
  </div>
</section>
