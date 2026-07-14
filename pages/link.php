<?php

require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/discord.php';

$linked_player = raidlands_store_current_player();
$link_flash = raidlands_store_flash();
$link_csrf = raidlands_store_csrf_token();
$database_ready = raidlands_db_is_configured() && raidlands_db() instanceof PDO;
$link_return_path = strtolower(trim((string) ($_GET['return'] ?? ''), '/'));
$steam_openid_url = route_url('link') . '?action=steam' . ($link_return_path !== '' ? '&return=' . rawurlencode($link_return_path) : '');
$linked_discord = $linked_player !== null ? raidlands_discord_identity_for_player((int) ($linked_player['id'] ?? 0)) : null;
$linked_player_name = $linked_player !== null
    ? (string) ($linked_player['display_name'] ?: ($linked_player['steam_display_name'] ?? 'Raidlands Player'))
    : '';
$linked_player_avatar = $linked_player !== null
    ? render_steam_avatar(
        (string) ($linked_player['steam_avatar_url'] ?? ''),
        (string) ($linked_player['steam_profile_url'] ?? ''),
        $linked_player_name,
        'steam-avatar-sm'
    )
    : '';
$linked_player_profile_url = $linked_player !== null ? trim((string) ($linked_player['steam_profile_url'] ?? '')) : '';
?>
<?= render_page_hero('link',
    '<a class="btn btn-primary" href="' . e(route_url('store')) . '">Open Store</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('profile')) . '">View Profile</a>'
) ?>

<section class="section">
  <div class="section-inner split-panel">
    <div class="metal-panel">
      <p class="section-kicker">Steam account</p>
      <h2><?= e($linked_player !== null ? 'Steam account connected' : 'Connect before checkout') ?></h2>
      <p class="section-lede"><?= e($linked_player !== null ? 'Your Steam account is ready for profile stats, store checkout, and in-game access.' : 'Kits, bundles, and perks need your Steam account so Raidlands can apply them to the right Rust player.') ?></p>

      <?php if ($link_flash !== null) : ?>
        <div class="form-status <?= e((string) $link_flash['type']) ?>"><?= e((string) $link_flash['message']) ?></div>
      <?php endif; ?>

      <div class="steam-connect-stack">
        <?php if ($linked_player !== null) : ?>
          <div class="auth-status is-linked">
            <div class="linked-steam-account">
              <?= $linked_player_avatar ?>
              <span>
                <strong>Connected.</strong>
                Steam ID <code><?= e((string) $linked_player['steam_id64']) ?></code>
                <?php if ($linked_player_name !== '') : ?>
                  as <?= e($linked_player_name) ?>
                <?php endif; ?>
              </span>
            </div>
            <?php if ($linked_player_profile_url !== '') : ?>
              <a class="profile-steam-link" href="<?= e($linked_player_profile_url) ?>" target="_blank" rel="noopener noreferrer">Open Steam Profile</a>
            <?php endif; ?>
          </div>
          <div class="button-row">
            <a class="btn btn-primary" href="<?= e(route_url('profile')) ?>">View Account</a>
            <a class="btn btn-secondary" href="<?= e(route_url('store')) ?>">Open Store</a>
            <a class="btn btn-discord" href="<?= e(route_url('discord')) ?>"><?= $linked_discord !== null ? 'Manage Discord' : 'Connect Discord' ?></a>
            <form method="post" action="<?= e(route_url('link')) ?>">
              <input type="hidden" name="csrf" value="<?= e($link_csrf) ?>">
              <input type="hidden" name="action" value="unlink_steam">
              <button class="btn btn-ghost" type="submit">Remove From This Browser</button>
            </form>
          </div>
        <?php else : ?>
          <div class="button-row">
            <a class="btn btn-steam" href="<?= e($steam_openid_url) ?>">Sign in with Steam</a>
          </div>
          <div class="form-status warning">Steam sign-in is required so Raidlands can confirm account ownership.</div>
        <?php endif; ?>

        <?php if (!$database_ready) : ?>
          <div class="form-status warning">Store opens soon. Sign in with Steam now so your account is ready.</div>
        <?php endif; ?>
      </div>
    </div>

    <div class="metal-panel">
      <p class="section-kicker">Game access</p>
      <h2>Your perks follow your Steam account</h2>
      <p class="section-lede">When store access is active, Raidlands applies the matching kits and perks to your connected Steam account.</p>
      <ul class="list-clean">
        <?php foreach (raidlands_store_managed_groups() as $group) : ?>
          <li><?= e(raidlands_public_access_label($group)) ?></li>
        <?php endforeach; ?>
      </ul>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Account rules</p>
      <h2>One Steam account per profile</h2>
      <p class="section-lede">Steam sign-in confirms ownership before Raidlands uses the account for profiles, store access, and admin approval checks.</p>
    </div>
    <div class="grid three">
      <?= render_card('ID', 'Steam account', 'Purchases attach to the Rust player account confirmed by Steam.') ?>
      <?= render_card('ROLE', 'In-game access', 'Active kits and perks are applied to your player in game.') ?>
      <?= render_card('STAT', 'Profile ready', 'The profile page shows active kits, perks, subscriptions, and expirations.') ?>
    </div>
  </div>
</section>
