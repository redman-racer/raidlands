<?= render_page_hero('features',
    '<a class="btn btn-primary" href="' . e(route_url('play')) . '">Join Raidlands</a>'
    . '<button class="btn btn-secondary" type="button" data-copy-command>Copy Connect</button>'
) ?>

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

<section class="section alt">
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
