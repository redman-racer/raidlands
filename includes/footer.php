        </main>
        <footer class="site-footer">
          <div class="footer-inner">
            <div>
              <img
                class="footer-logo"
                src="<?= e(asset_url('media/horizontal-logo-10x-xsm.webp')) ?>"
                srcset="<?= e(asset_url('media/horizontal-logo-10x-xxsm.webp')) ?> 120w, <?= e(asset_url('media/horizontal-logo-10x-xsm.webp')) ?> 300w, <?= e(asset_url('media/horizontal-logo-10x-sm.webp')) ?> 550w, <?= e(asset_url('media/horizontal-logo-10x-med.webp')) ?> 1100w, <?= e(asset_url('media/horizontal-logo-10x-lrg.webp')) ?> 2172w"
                sizes="(max-width: 520px) 190px, 250px"
                width="300"
                height="100"
                alt="Raidlands 10X"
                loading="lazy"
                decoding="async">
              <p class="footer-copy">10X progression, 5X loot, and raids worth preparing for. Raidlands 10X is not affiliated with Facepunch Studios.</p>
            </div>
            <nav class="footer-nav" aria-label="Footer navigation">
              <?php $footer_linked_player = raidlands_linked_player(); ?>
              <?php
                $footer_nav = array_values($primary_nav);
                array_splice($footer_nav, 2, 0, [['server', 'server', 'Server Status']]);
              ?>
              <?php foreach (array_merge($footer_nav, [['api-docs', 'api-docs', 'API Docs'], ['support', 'support', 'Support'], ['feedback', 'support', 'Feedback'], ['privacy', 'privacy', 'Privacy'], ['terms', 'terms', 'Terms']]) as [$id, $path, $label]) : ?>
                <?php
                  if ($id === 'profile') {
                      continue;
                  }

                  if ($id === 'link') {
                      $path = $footer_linked_player !== null ? 'profile' : 'link';
                      $label = $footer_linked_player !== null ? 'Account' : 'Sign in with Steam';
                  }

                  $href = $id === 'feedback' ? route_url('support') . '#feedback-form' : route_url($path);
                ?>
                <a href="<?= e($href) ?>"<?= $id === 'feedback' ? ' data-track="feedback_footer_clicked"' : '' ?>><?= e($label) ?></a>
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
        <a
          class="feedback-chip"
          href="<?= e(route_url('support') . '#feedback-form') ?>"
          data-track="feedback_chip_clicked"
          aria-label="Report a bug, suggestion, or feature request">
          <?= render_feature_symbol('BUG') ?>
          <span class="feedback-chip-copy">
            <strong>Feedback</strong>
            <small>Bug / Idea</small>
          </span>
        </a>
        <?php require_once __DIR__ . '/chat.php'; ?>
        <?= render_raidlands_chat_widget(raidlands_linked_player()) ?>
        <div class="toast" role="status" aria-live="polite" data-toast></div>
        <script src="<?= e(asset_url('js/chat.js')) ?>" defer></script>
      </div>
    </div>
  </body>
</html>
