<?= render_page_hero('support',
    '<a class="btn btn-discord" href="' . e($site_config['discordInviteUrl']) . '" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Open Discord</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('play')) . '">Connection Help</a>'
) ?>

<section class="section">
  <div class="section-inner">
    <div class="grid three">
      <?= render_card('TICKET', 'Support Tickets', 'Use Discord support channels for connection issues, reports, and staff help.') ?>
      <?= render_card('BUG', 'Bug Reports', 'Include screenshots, error text, Steam name, steps to reproduce, and when it happened.') ?>
      <?= render_card('APPEAL', 'Ban Appeals', 'Appeals start in Discord so staff can keep moderation context organized.') ?>
      <?= render_card('EAC', 'EAC Issues', 'Restart Steam and Rust, verify files, then share the exact error in a ticket.') ?>
      <?= render_card('TIMEOUT', 'Timeouts', 'Try the console command first, then ask support if the server is online and reachable.') ?>
      <?= render_card('STAFF', 'Staff Contact', 'Keep moderation conversations in official channels so evidence stays organized.') ?>
    </div>
  </div>
</section>
