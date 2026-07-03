<?= render_page_hero('features',
    '<a class="btn btn-primary" href="' . e(route_url('play')) . '">Join Raidlands</a>'
    . '<button class="btn btn-secondary" type="button" data-copy-command>Copy Connect</button>'
) ?>

<?php
  $feature_state = is_array($feature_state ?? null) ? $feature_state : ['ready' => false, 'sections' => [], 'voteable' => []];
  $feature_flash = is_array($feature_flash ?? null) ? $feature_flash : null;
  $feature_old = is_array($feature_old ?? null) ? $feature_old : [];
  $feature_csrf = (string) ($feature_csrf ?? '');
  $feature_ready = !empty($feature_state['ready']);
  $feature_identity = $feature_state['identity'] ?? null;
  $feature_user_votes = is_array($feature_state['user_votes'] ?? null) ? $feature_state['user_votes'] : [];
  $feature_votes_remaining = (int) ($feature_state['votes_remaining'] ?? 0);
  $feature_window = is_array($feature_state['window'] ?? null) ? $feature_state['window'] : [];
  $feature_card_markup = static function (array $feature, bool $show_metrics = false): string {
      $status = (string) ($feature['status_label'] ?? raidlands_features_status_label((string) ($feature['public_status'] ?? 'under_review')));
      $extra = '<div class="tag-row"><span class="status-tag ' . e(status_class($status)) . '">' . e($status) . '</span>';

      if ($show_metrics) {
          $extra .= '<span class="tag"><span class="tag-label">Score</span><span class="tag-value">' . e((string) ($feature['support_score'] ?? 0)) . '</span></span>'
              . '<span class="tag"><span class="tag-label">Votes</span><span class="tag-value">' . e((string) ($feature['vote_count'] ?? 0)) . '</span></span>'
              . '<span class="tag"><span class="tag-label">Suggested</span><span class="tag-value">' . e((string) ($feature['suggestion_count'] ?? 0)) . '</span></span>';
      }

      $extra .= '</div>';

      return render_card(
          (string) ($feature['icon_alias'] ?? 'EVENT'),
          (string) ($feature['title'] ?? 'Feature'),
          (string) ($feature['summary'] ?? ''),
          $extra
      );
  };
?>

<?php if (!$feature_ready) : ?>
  <section class="section">
    <div class="section-inner">
      <div class="section-header">
        <p class="section-kicker">Feature breakdown</p>
        <h2>Fast, convenient, and still dangerous</h2>
        <p class="section-lede">Raidlands is built for Rust players who already understand kits, teleporting, clans, wipe fights, and battlefield servers.</p>
      </div>
      <div class="grid three">
        <?php foreach ($feature_cards as $card) : ?>
          <?= render_feature_card($card) ?>
        <?php endforeach; ?>
      </div>
    </div>
  </section>
<?php else : ?>
  <?php
    $feature_sections = is_array($feature_state['sections'] ?? null) ? $feature_state['sections'] : [];
    $active_features = $feature_sections['active'] ?? [];
    $development_features = $feature_sections['in_development'] ?? [];
    $planned_features = $feature_sections['planned'] ?? [];
    $review_features = $feature_sections['under_review'] ?? [];
    $voteable_features = is_array($feature_state['voteable'] ?? null) ? $feature_state['voteable'] : [];
  ?>

  <section class="section">
    <div class="section-inner">
      <div class="section-header">
        <p class="section-kicker">Active systems</p>
        <h2>Live on Raidlands</h2>
        <p class="section-lede">These are the systems players can already use on the server or through the connected website.</p>
      </div>
      <div class="grid three">
        <?php foreach ($active_features as $feature) : ?>
          <?= $feature_card_markup($feature) ?>
        <?php endforeach; ?>
      </div>
    </div>
  </section>

  <?php if ($development_features !== [] || $planned_features !== [] || $review_features !== []) : ?>
    <section class="section alt">
      <div class="section-inner">
        <div class="section-header">
          <p class="section-kicker">Planning board</p>
          <h2>What is moving next</h2>
          <p class="section-lede">Planned and reviewed features stay visible here as staff moves them from idea to implementation.</p>
        </div>
        <div class="grid three">
          <?php foreach (array_merge($development_features, $planned_features, $review_features) as $feature) : ?>
            <?= $feature_card_markup($feature) ?>
          <?php endforeach; ?>
        </div>
      </div>
    </section>
  <?php endif; ?>

  <section class="section" id="feature-voting">
    <div class="section-inner">
      <div class="section-header">
        <p class="section-kicker">Feature voting</p>
        <h2>Vote for the next upgrade</h2>
        <p class="section-lede">Linked Steam accounts get three votes each wipe. Grouped suggestions count as support without locking up vote slots.</p>
      </div>

      <?php if ($feature_flash !== null) : ?>
        <div class="form-status <?= e((string) $feature_flash['type']) ?> feature-form-status"><?= e((string) $feature_flash['message']) ?></div>
      <?php endif; ?>

      <div class="feature-vote-meta">
        <div class="tag-row">
          <span class="tag"><span class="tag-label">Current window</span><span class="tag-value"><?= e((string) ($feature_window['label'] ?? 'Current wipe')) ?></span></span>
          <span class="tag"><span class="tag-label">Votes left</span><span class="tag-value"><?= $feature_identity !== null ? e((string) $feature_votes_remaining) : 'Link Steam' ?></span></span>
        </div>
        <?php if ($feature_identity === null) : ?>
          <a class="btn btn-primary" href="<?= e(route_url('link')) ?>">Link Steam to Vote</a>
        <?php endif; ?>
      </div>

      <?php if ($voteable_features === []) : ?>
        <div class="form-status warning">No public feature votes are open right now.</div>
      <?php else : ?>
        <div class="grid three feature-vote-grid">
          <?php foreach ($voteable_features as $feature) : ?>
            <?php
              $feature_id = (int) ($feature['id'] ?? 0);
              $has_vote = !empty($feature_user_votes[$feature_id]);
              $can_vote = $feature_identity !== null && ($has_vote || $feature_votes_remaining > 0);
            ?>
            <article class="metal-card feature-vote-card">
              <?= render_feature_symbol((string) ($feature['icon_alias'] ?? 'EVENT')) ?>
              <h3><?= e((string) ($feature['title'] ?? 'Feature')) ?></h3>
              <p class="card-copy"><?= e((string) ($feature['summary'] ?? '')) ?></p>
              <div class="tag-row">
                <span class="status-tag voting"><?= e((string) ($feature['status_label'] ?? 'Voting')) ?></span>
              </div>
              <div class="feature-score-grid">
                <span><strong><?= e((string) ($feature['support_score'] ?? 0)) ?></strong> Score</span>
                <span><strong><?= e((string) ($feature['vote_count'] ?? 0)) ?></strong> Votes</span>
                <span><strong><?= e((string) ($feature['suggestion_count'] ?? 0)) ?></strong> Suggested</span>
              </div>
              <form method="post" action="<?= e(route_url('features')) ?>#feature-voting">
                <input type="hidden" name="csrf" value="<?= e($feature_csrf) ?>">
                <input type="hidden" name="feature_id" value="<?= e((string) $feature_id) ?>">
                <button class="btn <?= $has_vote ? 'btn-secondary' : 'btn-primary' ?>" type="submit" name="action" value="<?= $has_vote ? 'unvote_feature' : 'vote_feature' ?>" <?= $can_vote ? '' : 'disabled' ?>>
                  <?= $has_vote ? 'Remove Vote' : ($feature_identity === null ? 'Link Steam First' : ($feature_votes_remaining > 0 ? 'Vote' : 'Votes Used')) ?>
                </button>
              </form>
            </article>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>
  </section>

  <section class="section alt">
    <div class="section-inner split-panel support-feedback-layout">
      <div class="metal-panel support-form-panel">
        <p class="section-kicker">Suggest a feature</p>
        <h2>Add an idea to the staff queue</h2>
        <p class="section-lede">Suggestions stay private until staff reviews and groups them with similar requests.</p>

        <?php if ($feature_identity === null) : ?>
          <div class="form-status warning">Link your Steam account before submitting a feature suggestion.</div>
          <a class="btn btn-primary" href="<?= e(route_url('link')) ?>">Link Steam</a>
        <?php else : ?>
          <form class="feedback-form" method="post" action="<?= e(route_url('features')) ?>#feature-voting">
            <input type="hidden" name="action" value="submit_feature_suggestion">
            <input type="hidden" name="csrf" value="<?= e($feature_csrf) ?>">
            <label class="feedback-honeypot">
              Website
              <input type="text" name="website" tabindex="-1" autocomplete="off">
            </label>
            <label class="store-field">
              <span>Feature title</span>
              <input type="text" name="title" maxlength="180" value="<?= e((string) ($feature_old['title'] ?? '')) ?>" placeholder="Example: Clan base markers" required>
            </label>
            <label class="store-field">
              <span>Details</span>
              <textarea name="details" rows="6" maxlength="3000" placeholder="What should it do, who would use it, and why should it come next?" required><?= e((string) ($feature_old['details'] ?? '')) ?></textarea>
            </label>
            <button class="btn btn-primary" type="submit">Send Suggestion</button>
          </form>
        <?php endif; ?>
      </div>

      <aside class="metal-panel support-routing-panel">
        <p class="section-kicker">How staff reviews it</p>
        <h2>Similar ideas get grouped</h2>
        <ul class="list-clean">
          <li>Repeated suggestions add support to the same feature.</li>
          <li>Votes refresh each wipe so old priorities do not stay stuck forever.</li>
          <li>Staff still chooses what is realistic for the server and website.</li>
        </ul>
      </aside>
    </div>
  </section>
<?php endif; ?>

<section class="section<?= $feature_ready ? '' : ' alt' ?>">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Categories</p>
      <h2>What each system is for</h2>
    </div>
    <div class="grid two">
      <?php foreach ($feature_groups as $group) : ?>
        <article class="metal-card">
          <h3><?= e($group['title']) ?></h3>
          <p class="card-copy"><?= e($group['copy']) ?></p>
          <ul class="list-clean">
            <?php foreach ($group['items'] as $item) : ?>
              <li><?= e($item) ?></li>
            <?php endforeach; ?>
          </ul>
        </article>
      <?php endforeach; ?>
    </div>
  </div>
</section>
