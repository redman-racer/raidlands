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
  $feature_filters = is_array($feature_state['filters'] ?? null) ? $feature_state['filters'] : raidlands_features_public_filter_state([]);
  $feature_filter_options = is_array($feature_state['filter_options'] ?? null) ? $feature_state['filter_options'] : raidlands_features_public_filter_options([]);
  $feature_status_options = is_array($feature_filter_options['statuses'] ?? null) ? $feature_filter_options['statuses'] : [];
  $feature_category_options = is_array($feature_filter_options['categories'] ?? null) ? $feature_filter_options['categories'] : [];
  $feature_sort_options = is_array($feature_filter_options['sorts'] ?? null) ? $feature_filter_options['sorts'] : raidlands_features_public_sort_options();
  $feature_total = (int) ($feature_state['total'] ?? 0);
  $feature_filtered_total = (int) ($feature_state['filtered_total'] ?? 0);
  $feature_has_active_filters = !empty($feature_state['has_active_filters']);
  $feature_query = raidlands_features_public_filter_query($feature_filters);
  $feature_post_action = route_url('features') . ($feature_query !== '' ? '?' . $feature_query : '');
  $feature_show_metrics = in_array((string) ($feature_filters['sort'] ?? 'staff'), ['support', 'votes'], true);
  $feature_group_cards = is_array($feature_groups ?? null) ? array_values($feature_groups) : [];
  $feature_group_titles = [];

  foreach ($feature_group_cards as $group) {
      $title = trim((string) ($group['title'] ?? ''));

      if ($title !== '') {
          $feature_group_titles[strtolower($title)] = true;
      }
  }

  foreach ($feature_category_options as $category) {
      $title = trim((string) $category);
      $key = strtolower($title);

      if ($title === '' || isset($feature_group_titles[$key])) {
          continue;
      }

      $feature_group_cards[] = [
          'title' => $title,
          'copy' => 'This category groups related Raidlands features so players can quickly see what belongs to that part of the server.',
          'items' => ['Browse active features', 'Track planned upgrades', 'Vote or suggest related ideas'],
      ];
      $feature_group_titles[$key] = true;
  }

  $feature_filter_hidden_inputs = static function (array $filters): string {
      $html = '';

      foreach (['q', 'status', 'category', 'sort'] as $key) {
          $value = trim((string) ($filters[$key] ?? ''));

          if ($value === '' || ($key === 'sort' && $value === 'staff')) {
              continue;
          }

          $html .= '<input type="hidden" name="' . e($key) . '" value="' . e($value) . '">';
      }

      return $html;
  };
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

<section class="section progression-baseline-section">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Live progression model</p>
      <h2>10X gather, 5X loot, 3X scrap</h2>
      <p class="section-lede">Raidlands accelerates crafting, smelting, and progression while keeping direct raid resources deliberately limited. Exact live kit contents remain server-synchronized.</p>
    </div>
    <div class="progression-rate-grid">
      <?php foreach ($progression_rates as [$rate, $label, $copy]) : ?>
        <article class="metal-card progression-rate-card">
          <strong><?= e($rate) ?></strong>
          <h3><?= e($label) ?></h3>
          <p class="card-copy"><?= e($copy) ?></p>
        </article>
      <?php endforeach; ?>
    </div>
    <div class="metal-panel progression-rule-panel">
      <ul class="list-clean progression-rule-list">
        <?php foreach ($progression_rules as $rule) : ?>
          <li><?= e($rule) ?></li>
        <?php endforeach; ?>
      </ul>
    </div>
  </div>
</section>

<?php if (!$feature_ready) : ?>
  <section class="section">
    <div class="section-inner">
      <div class="section-header">
        <p class="section-kicker">Feature breakdown</p>
        <h2>Fast, convenient, and still dangerous</h2>
        <p class="section-lede">Raidlands is built for Rust players who want faster progression, readable kit timing, coordinated team play, and wipe-long raids.</p>
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
    $planning_features = array_merge($development_features, $planned_features, $review_features);
  ?>

  <section class="section feature-browser-section">
    <div class="section-inner">
      <form class="feature-filter-toolbar metal-panel" method="get" action="<?= e(route_url('features')) ?>">
        <label class="feature-filter-field feature-filter-search">
          <span>Search</span>
          <input type="search" name="q" maxlength="120" placeholder="Feature name, category, or status" value="<?= e((string) ($feature_filters['q'] ?? '')) ?>">
        </label>
        <label class="feature-filter-field">
          <span>Status</span>
          <select name="status">
            <option value="">All statuses</option>
            <?php foreach ($feature_status_options as $status_key => $status_label) : ?>
              <option value="<?= e((string) $status_key) ?>" <?= (string) ($feature_filters['status'] ?? '') === (string) $status_key ? 'selected' : '' ?>><?= e((string) $status_label) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <label class="feature-filter-field">
          <span>Category</span>
          <select name="category">
            <option value="">All categories</option>
            <?php foreach ($feature_category_options as $category) : ?>
              <option value="<?= e((string) $category) ?>" <?= (string) ($feature_filters['category'] ?? '') === (string) $category ? 'selected' : '' ?>><?= e((string) $category) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <label class="feature-filter-field">
          <span>Sort</span>
          <select name="sort">
            <?php foreach ($feature_sort_options as $sort_key => $sort_label) : ?>
              <option value="<?= e((string) $sort_key) ?>" <?= (string) ($feature_filters['sort'] ?? 'staff') === (string) $sort_key ? 'selected' : '' ?>><?= e((string) $sort_label) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <div class="feature-filter-actions">
          <button class="btn btn-primary" type="submit">Apply</button>
          <a class="btn btn-secondary" href="<?= e(route_url('features')) ?>">Clear</a>
        </div>
        <p class="feature-filter-results">
          Showing <?= e((string) $feature_filtered_total) ?> of <?= e((string) $feature_total) ?> feature<?= $feature_total === 1 ? '' : 's' ?><?= $feature_has_active_filters ? ' for this view' : '' ?>.
        </p>
      </form>
    </div>
  </section>

  <?php if ($feature_filtered_total === 0) : ?>
    <section class="section">
      <div class="section-inner">
        <div class="form-status warning">No features match the current search or filters.</div>
      </div>
    </section>
  <?php endif; ?>

  <?php if ($feature_filtered_total > 0 && ($active_features !== [] || !$feature_has_active_filters)) : ?>
  <section class="section">
    <div class="section-inner">
      <div class="section-header">
        <p class="section-kicker">Active systems</p>
        <h2>Live on Raidlands</h2>
        <p class="section-lede">These are the systems players can already use on the server or through linked player tools.</p>
      </div>
      <?php if ($active_features === []) : ?>
        <div class="form-status warning">No active features match this view.</div>
      <?php else : ?>
        <div class="grid three">
          <?php foreach ($active_features as $feature) : ?>
            <?= $feature_card_markup($feature, $feature_show_metrics) ?>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>
  </section>
  <?php endif; ?>

  <?php if ($planning_features !== []) : ?>
    <section class="section alt">
      <div class="section-inner">
        <div class="section-header">
          <p class="section-kicker">Planning board</p>
          <h2>What is moving next</h2>
          <p class="section-lede">Planned and reviewed features stay visible here as staff moves them from idea to implementation.</p>
        </div>
        <div class="grid three">
          <?php foreach ($planning_features as $feature) : ?>
            <?= $feature_card_markup($feature, $feature_show_metrics) ?>
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
          <span class="tag"><span class="tag-label">Votes left</span><span class="tag-value"><?= $feature_identity !== null ? e((string) $feature_votes_remaining) : 'Sign in' ?></span></span>
        </div>
        <?php if ($feature_identity === null) : ?>
          <a class="btn btn-steam" href="<?= e(route_url('link')) ?>">Sign in with Steam to Vote</a>
        <?php endif; ?>
      </div>

      <?php if ($voteable_features === []) : ?>
        <div class="form-status warning"><?= $feature_has_active_filters ? 'No voting candidates match this search or filter.' : 'No public feature votes are open right now.' ?></div>
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
                <?= $feature_filter_hidden_inputs($feature_filters) ?>
                <button class="btn <?= $has_vote ? 'btn-secondary' : 'btn-primary' ?>" type="submit" name="action" value="<?= $has_vote ? 'unvote_feature' : 'vote_feature' ?>" <?= $can_vote ? '' : 'disabled' ?>>
                  <?= $has_vote ? 'Remove Vote' : ($feature_identity === null ? 'Sign In First' : ($feature_votes_remaining > 0 ? 'Vote' : 'Votes Used')) ?>
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
          <a class="btn btn-steam" href="<?= e(route_url('link')) ?>">Sign in with Steam</a>
        <?php else : ?>
          <form class="feedback-form" method="post" action="<?= e($feature_post_action) ?>#feature-voting">
            <input type="hidden" name="action" value="submit_feature_suggestion">
            <input type="hidden" name="csrf" value="<?= e($feature_csrf) ?>">
            <?= $feature_filter_hidden_inputs($feature_filters) ?>
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
      <?php foreach ($feature_group_cards as $group) : ?>
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
