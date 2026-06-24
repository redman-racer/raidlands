        </main>
        <footer class="site-footer">
          <div class="footer-inner">
            <div>
              <img class="footer-logo" src="<?= e(asset_url('media/nav-logo.png')) ?>" alt="Raidlands">
              <p class="footer-copy">1000x Rust warfare, built for nonstop raids. Raidlands is not affiliated with Facepunch Studios.</p>
            </div>
            <nav class="footer-nav" aria-label="Footer navigation">
              <?php foreach (array_merge($primary_nav, [['support', 'support', 'Support'], ['privacy', 'privacy', 'Privacy'], ['terms', 'terms', 'Terms']]) as [, $path, $label]) : ?>
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
