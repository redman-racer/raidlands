<section class="hero">
  <div class="hero-inner">
    <div class="hero-layout">
      <div class="hero-copy">
        <img class="hero-brand-mark" src="<?= e(asset_url('media/raidlands-logo.webp')) ?>" alt="">
        <h1>Raidlands 1000x</h1>
        <p class="hero-subtitle"><?= e($page_copy['home']['lede']) ?></p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="<?= e($site_config['steamConnectUrl']) ?>" data-track="join_server_clicked">
            Join Server
            <span class="btn-icon" aria-hidden="true"><?= action_icon('arrow') ?></span>
          </a>
          <button class="btn btn-secondary" type="button" data-copy-command>
            Copy Connect Command
            <span class="btn-icon" aria-hidden="true"><?= action_icon('copy') ?></span>
          </button>
          <a class="btn btn-discord" href="<?= e($site_config['discordInviteUrl']) ?>" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">
            Join Discord
            <span class="btn-icon" aria-hidden="true"><?= action_icon('discord') ?></span>
          </a>
        </div>
      </div>
      <?= render_status_panel() ?>
    </div>
    <?= render_quick_features() ?>
    <?= render_wipe_bar() ?>
  </div>
</section>

<section class="section">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Built for nonstop raids</p>
      <h2>Farm fast. Gear fast. Raid fast.</h2>
      <p class="section-lede">Raidlands removes the slow parts and keeps the war. Whether you play solo, with friends, or inside a full clan, every Thursday wipe is a fresh battlefield.</p>
    </div>
    <div class="grid four">
      <?php foreach (array_slice($feature_cards, 0, 8) as $card) : ?>
        <?= render_feature_card($card) ?>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="section-inner split-panel">
    <div class="metal-panel wipe-schedule-panel">
      <p class="section-kicker">Wipe schedule</p>
      <h2>Wipes every Thursday</h2>
      <p class="section-lede">The wasteland resets every Thursday. New bases. New rivalries. New raids.</p>
      <div class="tag-row wipe-schedule-meta" aria-label="Wipe timing">
        <span class="tag"><span class="tag-label">Last wipe</span><span class="tag-value" data-last-wipe>Loading</span></span>
        <span class="tag"><span class="tag-label">Upcoming</span><span class="tag-value" data-next-wipe>Loading</span></span>
        <span class="tag"><span class="tag-label">Local time</span><span class="tag-value"><?= e($site_config['wipe']['time']) ?> <?= e($site_config['wipe']['timezone']) ?></span></span>
      </div>
      <?= render_wipe_bar() ?>
      <div class="button-row wipe-schedule-actions">
        <a class="btn btn-discord" href="<?= e($site_config['discordInviteUrl']) ?>" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Get Wipe Alerts</a>
        <a class="btn btn-secondary" href="<?= e(route_url('play')) ?>">Join Methods</a>
      </div>
    </div>
    <div class="image-panel wipe" role="img" aria-label="Raidlands wipe day artwork"></div>
  </div>
</section>

<section class="section">
  <div class="section-inner">
    <div class="section-header center">
      <p class="section-kicker">How to play</p>
      <h2>Three ways into the fight</h2>
    </div>
    <div class="grid three">
      <?= render_join_method_cards() ?>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="section-inner split-panel">
    <div class="metal-panel">
      <p class="section-kicker">Account linking</p>
      <h2>Keep your profile across wipes</h2>
      <p class="section-lede"><?= e(raidlands_has_linked_account() ? 'Your Steam account is connected. Use your account page to check profile status, stats, and VIP access.' : 'Connect Steam so leaderboards, rewards, roles, VIP ownership, and profile stats follow the right player.') ?></p>
      <div class="grid two">
        <?= render_auth_summary_card('steam') ?>
        <?= render_auth_summary_card('discord') ?>
      </div>
    </div>
    <div class="metal-panel">
      <p class="section-kicker">Account-linked perks</p>
      <h2>VIP follows your account</h2>
      <p class="section-lede">VIP kits, monthly ranks, and one-time perks stay tied to your Steam account, then update in game automatically.</p>
      <div class="button-row">
        <a class="btn btn-primary" href="<?= e(route_url('play')) ?>">Play Raidlands</a>
        <a class="btn btn-secondary" href="<?= e(route_url('store')) ?>">Open Store</a>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="section-inner split-panel">
    <div class="metal-panel">
      <p class="section-kicker">Discord community</p>
      <h2>Wipe pings, teams, support</h2>
      <p class="section-lede">Join Discord for wipe alerts, teammate finding, bug reports, ban appeals, feature votes, and server announcements.</p>
      <div class="button-row">
        <a class="btn btn-discord" href="<?= e($site_config['discordInviteUrl']) ?>" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Join the Raidlands Discord</a>
        <a class="btn btn-secondary" href="<?= e(raidlands_account_url()) ?>"><?= e(raidlands_account_label('Connect Discord', 'Open Account')) ?></a>
      </div>
    </div>
    <div class="image-panel discord" role="img" aria-label="Raidlands Discord banner"></div>
  </div>
</section>

<section class="section alt">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Live server systems</p>
      <h2>The server stack is online</h2>
      <p class="section-lede">Core gameplay, account linking, VIP sync, profile stats, and player rankings are live, with the website growing around the systems players already use.</p>
    </div>
    <div class="grid four">
      <?php foreach ($roadmap_cards as $card) : ?>
        <?= render_roadmap_card($card) ?>
      <?php endforeach; ?>
    </div>
  </div>
</section>
