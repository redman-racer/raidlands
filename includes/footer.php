        </main>
        <footer class="site-footer">
          <div class="footer-inner">
            <div>
              <img
                class="footer-logo"
                src="<?= e(asset_url('media/horizontal-logo-xsm.webp')) ?>"
                srcset="<?= e(asset_url('media/horizontal-logo-xxsm.webp')) ?> 120w, <?= e(asset_url('media/horizontal-logo-xsm.webp')) ?> 300w, <?= e(asset_url('media/horizontal-logo-sm.webp')) ?> 550w, <?= e(asset_url('media/horizontal-logo-med.webp')) ?> 1100w, <?= e(asset_url('media/horizontal-logo-lrg.webp')) ?> 2172w"
                sizes="(max-width: 520px) 190px, 250px"
                width="300"
                height="100"
                alt="Raidlands"
                loading="lazy"
                decoding="async">
              <p class="footer-copy">1000x Rust warfare, built for nonstop raids. Raidlands is not affiliated with Facepunch Studios.</p>
            </div>
            <nav class="footer-nav" aria-label="Footer navigation">
              <?php $footer_linked_player = raidlands_linked_player(); ?>
              <?php foreach (array_merge($primary_nav, [['support', 'support', 'Support'], ['privacy', 'privacy', 'Privacy'], ['terms', 'terms', 'Terms']]) as [$id, $path, $label]) : ?>
                <?php
                  if ($id === 'profile') {
                      continue;
                  }

                  if ($id === 'link') {
                      $path = $footer_linked_player !== null ? 'profile' : 'link';
                      $label = $footer_linked_player !== null ? 'Account' : 'Link Account';
                  }
                ?>
                <a href="<?= e(route_url($path)) ?>"><?= e($label) ?></a>
              <?php endforeach; ?>
            </nav>
            <div class="button-row">
              <button class="btn btn-secondary" type="button" data-copy-command>
                Copy Connect
                <span class="btn-icon" aria-hidden="true"><?= action_icon('copy') ?></span>
              </button>
              <a class="btn btn-discord" href="<?= e($site_config['discordInviteUrl']) ?>" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">
                Join Discord
                <span class="btn-icon" aria-hidden="true"><?= action_icon('discord') ?></span>
              </a>
            </div>
          </div>
        </footer>
        <div class="toast" role="status" aria-live="polite" data-toast></div>
      </div>
    </div>
  </body>
</html>
