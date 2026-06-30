<?php

$page_id = 'store';
$base_path = '../../';

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';

require $site_root . '/includes/header.php';
?>
<?= render_page_hero('store',
    '<a class="btn btn-primary" href="' . e(route_url('store')) . '">Return to Store</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('profile')) . '">View Profile</a>'
) ?>

<section class="section">
  <div class="section-inner">
    <div class="metal-panel">
      <p class="section-kicker">Checkout canceled</p>
      <h2>No purchase was completed</h2>
      <p class="section-lede">Your card was not charged. You can return to the store whenever you are ready.</p>
    </div>
  </div>
</section>
<?php require $site_root . '/includes/footer.php'; ?>
