<?php

$page_id = 'store';
$base_path = '../../';

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';

$session_id = trim((string) ($_GET['session_id'] ?? ''));
$checkout_result = null;
$checkout_error = '';

if ($session_id !== '') {
    try {
        $checkout_result = raidlands_store_reconcile_checkout_session($session_id);
    } catch (Throwable $error) {
        $checkout_error = $error->getMessage();
    }
}

require $site_root . '/includes/header.php';
?>
<?= render_page_hero('store',
    '<a class="btn btn-primary" href="' . e(route_url('profile')) . '">View Profile</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('store')) . '">Back to Store</a>'
) ?>

<section class="section">
  <div class="section-inner">
    <div class="metal-panel">
      <p class="section-kicker">Checkout complete</p>
      <h2>Payment received</h2>
      <p class="section-lede">Checkout is complete. Your VIP access will update in game after Raidlands confirms the purchase.</p>
      <?php if (is_array($checkout_result) && !empty($checkout_result['processed'])) : ?>
        <div class="form-status success"><?= e((string) ($checkout_result['message'] ?? 'Purchase confirmed.')) ?></div>
      <?php elseif (is_array($checkout_result) && !empty($checkout_result['message'])) : ?>
        <div class="form-status warning"><?= e((string) $checkout_result['message']) ?></div>
      <?php elseif ($checkout_error !== '') : ?>
        <div class="form-status warning">Checkout returned from Stripe, but Raidlands could not confirm it yet: <?= e($checkout_error) ?></div>
      <?php endif; ?>
      <?php if ($session_id !== '') : ?>
        <p class="store-muted">Checkout session: <code><?= e($session_id) ?></code></p>
      <?php endif; ?>
    </div>
  </div>
</section>
<?php require $site_root . '/includes/footer.php'; ?>
