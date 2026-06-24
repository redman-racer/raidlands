<?= render_page_hero('link',
    '<button class="btn btn-steam" type="button" data-auth-provider="steam">Link Steam</button>'
    . '<button class="btn btn-discord" type="button" data-auth-provider="discord">Link Discord</button>'
) ?>

<section class="section">
  <div class="section-inner">
    <div class="auth-grid">
      <?= render_auth_card('steam') ?>
      <?= render_auth_card('discord') ?>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Account model</p>
      <h2>Ready for future systems</h2>
      <p class="section-lede">A Raidlands profile can store SteamID64, Discord ID, guild membership, roles, linked timestamps, and last login once the backend is attached.</p>
    </div>
    <div class="grid three">
      <?= render_card('ID', 'Identity', 'Reduce impersonation and keep one profile across wipes.') ?>
      <?= render_card('ROLE', 'Discord Roles', 'Prepare for member checks, event notices, and future role sync.') ?>
      <?= render_card('STAT', 'Rewards and Stats', 'Make leaderboards, profiles, and vote rewards possible later.') ?>
    </div>
  </div>
</section>
