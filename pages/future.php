<?php

$future_cards = $future_pages[$page_id] ?? [];
?>
<?= render_page_hero($page_id,
    '<a class="btn btn-primary" href="' . e(route_url('play')) . '">Join Server</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('discord')) . '">Follow Updates</a>'
) ?>

<section class="section">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Planned system</p>
      <h2><?= e($page_copy[$page_id]['title']) ?> are coming later</h2>
      <p class="section-lede"><?= e($page_copy[$page_id]['lede']) ?></p>
    </div>
    <div class="grid three">
      <?php foreach ($future_cards as [$title, $copy]) : ?>
        <?= render_card('SOON', $title, $copy) ?>
      <?php endforeach; ?>
    </div>
  </div>
</section>
