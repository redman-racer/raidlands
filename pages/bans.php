<?= render_page_hero('bans',
    '<a class="btn btn-discord" href="' . e($site_config['discordInviteUrl']) . '" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Appeal in Discord</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('rules')) . '">Read Rules</a>'
) ?>

<section class="section">
  <div class="section-inner">
    <div class="grid three">
      <?= render_card('BAN', 'Ban Policy', 'Cheating, ban evasion, exploits, threats, doxxing, and severe harassment can lead to permanent bans.') ?>
      <?= render_card('APPEAL', 'Appeal Path', 'At launch, appeals are handled in Discord. A structured appeal form is planned later.') ?>
      <?= render_card('EVID', 'Evidence', 'Include your Steam name, 17-digit Steam ID if known, the ban reason, and any relevant context.') ?>
    </div>
  </div>
</section>
