<?= render_page_hero('discord',
    '<a class="btn btn-discord" href="' . e($site_config['discordInviteUrl']) . '" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Join Discord</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('link')) . '">Link Discord</a>'
) ?>

<section class="section">
  <div class="section-inner split-panel">
    <div class="metal-panel">
      <p class="section-kicker">Community hub</p>
      <h2>Stay close to wipe night</h2>
      <p class="section-lede">Discord is the launch home for alerts, teammates, support, bug reports, feature votes, event announcements, and ban appeals.</p>
      <ul class="list-clean">
        <li>Get Thursday wipe pings.</li>
        <li>Find teammates before the server resets.</li>
        <li>Report bugs with screenshots and repro steps.</li>
        <li>Open support tickets when connection issues block you.</li>
        <li>Vote on events, systems, and future server direction.</li>
      </ul>
      <div class="button-row">
        <a class="btn btn-discord" href="<?= e($site_config['discordInviteUrl']) ?>" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Join the Raidlands Discord</a>
      </div>
    </div>
    <div class="image-panel discord" role="img" aria-label="Raidlands Discord server banner"></div>
  </div>
</section>
