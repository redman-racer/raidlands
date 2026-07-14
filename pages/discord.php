<?php
require_once $site_root . '/includes/discord.php';
$discord_player = raidlands_store_current_player();
$discord_identity = $discord_player !== null ? raidlands_discord_identity_for_player((int) ($discord_player['id'] ?? 0)) : null;
$discord_ready = raidlands_discord_readiness();
$discord_flash = raidlands_store_flash();
$discord_csrf = raidlands_store_csrf_token();
$discord_settings = raidlands_discord_settings();
$discord_name = $discord_identity !== null ? (string) ($discord_identity['global_name'] ?: $discord_identity['username']) : '';
$discord_roles = $discord_identity !== null ? (array) (json_decode((string) ($discord_identity['observed_role_ids_json'] ?? '[]'), true) ?: []) : [];
$discord_avatar = $discord_identity !== null ? raidlands_discord_avatar_url($discord_identity) : '';
?>
<?= render_page_hero('discord',
    '<a class="btn btn-discord" href="' . e($site_config['discordInviteUrl']) . '" target="_blank" rel="noreferrer">Join Discord</a>'
    . ($discord_player === null ? '<a class="btn btn-steam" href="' . e(raidlands_account_url()) . '">Sign in with Steam</a>' : '')
) ?>
<section class="section">
  <div class="section-inner">
    <?php if ($discord_flash !== null) : ?><div class="form-status <?= e((string) $discord_flash['type']) ?>"><?= e((string) $discord_flash['message']) ?></div><?php endif; ?>
    <div class="section-header"><p class="section-kicker">Account verification</p><h2>Sign in with Steam, then connect Discord</h2><p class="section-lede">Steam establishes your Rust identity. Discord authorization attaches your community account and synchronizes only Raidlands-managed roles.</p></div>
    <div class="grid three discord-steps">
      <article class="metal-panel"><p class="section-kicker">Step 1</p><h3>Sign in with Steam</h3><p><?= $discord_player !== null ? 'Signed in as ' . e((string) ($discord_player['display_name'] ?: $discord_player['steam_id64'])) . '.' : 'Confirm the Rust player account you own.' ?></p><?php if ($discord_player === null) : ?><a class="btn btn-steam" href="<?= e(raidlands_account_url()) ?>">Sign in with Steam</a><?php else : ?><span class="status-pill active">Complete</span><?php endif; ?></article>
      <article class="metal-panel"><p class="section-kicker">Step 2</p><h3>Connect Discord</h3><p><?= e((string) $discord_settings['connection_guidance']) ?></p><?php if ($discord_player !== null && $discord_identity === null) : ?><a class="btn btn-discord<?= !$discord_ready['ready'] ? ' is-disabled' : '' ?>" href="<?= e(route_url('discord') . '?action=connect') ?>"<?= !$discord_ready['ready'] ? ' aria-disabled="true"' : '' ?>><?= e((string) $discord_settings['connection_label']) ?></a><?php elseif ($discord_identity !== null) : ?><span class="status-pill active">Connected</span><?php else : ?><span class="status-pill pending">Waiting for Steam</span><?php endif; ?></article>
      <article class="metal-panel"><p class="section-kicker">Step 3</p><h3>Verify roles</h3><p>Join the guild and receive the verified-player role plus roles mapped from active access.</p><span class="status-pill <?= $discord_identity !== null && $discord_identity['status'] === 'synced' ? 'active' : 'pending' ?>"><?= $discord_identity !== null && $discord_identity['status'] === 'synced' ? 'Synchronized' : 'Waiting' ?></span></article>
    </div>
    <?php if ($discord_player !== null && !$discord_ready['ready'] && $discord_identity === null) : ?><div class="form-status warning">Discord linking is being configured. You can still join with the invite button.</div><?php endif; ?>
    <?php if ($discord_identity !== null) : ?>
      <div class="metal-panel discord-account-card">
        <div>
          <?php if ($discord_avatar !== '') : ?><img class="discord-account-avatar" src="<?= e($discord_avatar) ?>" alt="" referrerpolicy="no-referrer"><?php endif; ?>
          <p class="section-kicker">Connected Discord</p>
          <h2><?= e($discord_name !== '' ? $discord_name : 'Discord user ' . $discord_identity['discord_user_id']) ?></h2>
          <p class="section-lede">Discord ID <code><?= e((string) $discord_identity['discord_user_id']) ?></code> | <?= !empty($discord_identity['guild_member']) ? 'Guild member' : 'Membership needs attention' ?> | <?= count($discord_roles) ?> observed roles</p>
          <p>Last sync: <?= e((string) ($discord_identity['last_synced_at'] ?: 'Not completed')) ?></p>
          <?php if ((string) $discord_identity['last_error'] !== '') : ?><div class="form-status error"><?= e((string) $discord_identity['last_error']) ?></div><?php endif; ?>
        </div>
        <div class="button-row"><form method="post"><input type="hidden" name="csrf" value="<?= e($discord_csrf) ?>"><input type="hidden" name="action" value="sync_discord"><button class="btn btn-secondary" type="submit">Sync Roles</button></form><form method="post" onsubmit="return confirm('Disconnect Discord and remove Raidlands-managed roles?')"><input type="hidden" name="csrf" value="<?= e($discord_csrf) ?>"><input type="hidden" name="action" value="unlink_discord"><button class="btn btn-ghost" type="submit">Disconnect Discord</button></form></div>
      </div>
    <?php endif; ?>
  </div>
</section>
<section class="section alt"><div class="section-inner split-panel"><div class="metal-panel"><p class="section-kicker">Community hub</p><h2>Stay close to wipe night</h2><ul class="list-clean"><li>Thursday wipe alerts and event announcements.</li><li>Teammate finding, support, bug reports, and appeals.</li><li>Verified roles tied to the correct Rust player.</li></ul><a class="btn btn-discord" href="<?= e($site_config['discordInviteUrl']) ?>" target="_blank" rel="noreferrer">Open Raidlands Discord</a></div><div class="image-panel discord" role="img" aria-label="Raidlands Discord server banner"></div></div></section>
