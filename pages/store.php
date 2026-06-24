<?= render_page_hero('store',
    '<a class="btn btn-primary" href="' . e(route_url('play')) . '">Play Free</a>'
    . '<a class="btn btn-discord" href="' . e($site_config['discordInviteUrl']) . '" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Get Updates</a>'
) ?>

<section class="section">
  <div class="section-inner split-panel">
    <div class="metal-panel">
      <p class="section-kicker">Launch stance</p>
      <h2>No launch paywall</h2>
      <p class="section-lede">All launch kits are open while Raidlands grows the population. Supporter perks may come later, but the first job is building the battlefield.</p>
      <div class="grid two">
        <?= render_card('SAFE', 'Safer Perks', 'Queue priority, cosmetic titles, Discord roles, profile badges, and convenience perks.') ?>
        <?= render_card('RISK', 'Avoid Pay-to-Win', 'Strong combat kits and huge raid packages should be handled carefully or avoided.') ?>
      </div>
    </div>
    <div class="image-panel" style="background-image: linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.65)), url('<?= e(asset_url('media/header-bg-rust-v2.png')) ?>')" role="img" aria-label="Raidlands brand banner"></div>
  </div>
</section>
