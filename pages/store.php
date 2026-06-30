<?php

require_once $site_root . '/includes/store.php';

$store_flash = raidlands_store_flash();
$store_catalog = raidlands_store_catalog(true);
$store_products = $store_catalog['products'];
$vip_products = raidlands_store_products_by_type($store_products, 'vip_subscription');
$perk_products = array_values(array_filter(
    $store_products,
    static fn (array $product): bool => (string) $product['product_type'] !== 'vip_subscription'
));
$store_player = raidlands_store_current_player();
$store_csrf = raidlands_store_csrf_token();

function render_store_product_card(array $product, ?array $player, string $csrf): string
{
    $price = raidlands_store_default_price($product);
    $buyable = raidlands_store_price_is_buyable($price);
    $has_player = $player !== null && !empty($player['id']);
    $price_text = $price === null
        ? 'Price coming soon'
        : raidlands_store_money((int) $price['amount_cents'], (string) $price['currency']);
    $interval = $price !== null && (string) $price['billing_interval'] === 'month' ? ' / month' : '';
    $action = '';

    if (!$has_player) {
        $action = '<a class="btn btn-secondary" href="' . e(route_url('link')) . '">Link Steam First</a>';
    } elseif (!$buyable) {
        $action = '<button class="btn btn-ghost" type="button" disabled>Checkout Coming Soon</button>';
    } else {
        $action = '<form method="post" action="' . e(route_url('store') . 'checkout.php') . '">'
            . '<input type="hidden" name="csrf" value="' . e($csrf) . '">'
            . '<input type="hidden" name="price_id" value="' . e((string) $price['id']) . '">'
            . '<button class="btn btn-primary" type="submit">Checkout</button>'
            . '</form>';
    }

    return '<article class="metal-card store-product-card">'
        . '<div class="store-card-top">'
        . render_feature_symbol((string) ((string) $product['product_type'] === 'vip_subscription' ? 'KIT' : 'SHOP'))
        . '<span class="status-tag ' . e((string) $product['product_type'] === 'vip_subscription' ? 'review' : 'planned') . '">' . e(raidlands_store_type_label((string) $product['product_type'])) . '</span>'
        . '</div>'
        . '<h3>' . e((string) $product['name']) . '</h3>'
        . '<p class="card-copy">' . e((string) $product['short_description']) . '</p>'
        . '<div class="store-price"><strong>' . e($price_text) . '</strong><span>' . e($interval) . '</span></div>'
        . '<ul class="store-mini-list">'
        . '<li>Unlocks the matching in-game VIP access.</li>'
        . '<li>Kit contents, cooldowns, and limits are shown in Discord.</li>'
        . '</ul>'
        . '<div class="store-card-actions">' . $action . '</div>'
        . '</article>';
}
?>
<?= render_page_hero('store',
    '<a class="btn btn-primary" href="' . e(route_url('link')) . '">Link Steam</a>'
    . '<a class="btn btn-discord" href="' . e($site_config['discordInviteUrl']) . '" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Ask Before Buying</a>'
) ?>

<section class="section">
  <div class="section-inner">
    <?php if ($store_flash !== null) : ?>
      <div class="form-status <?= e((string) $store_flash['type']) ?>"><?= e((string) $store_flash['message']) ?></div>
    <?php endif; ?>

    <?php if (!empty($store_catalog['setupRequired'])) : ?>
      <div class="form-status warning">Checkout is not live yet. Store setup is still being finished before purchases open.</div>
    <?php endif; ?>

    <div class="section-header">
      <p class="section-kicker">VIP kits</p>
      <h2>Monthly ranks synced to Rust</h2>
      <p class="section-lede">Bronze, Gold, and Elite give monthly VIP access in game. Kit details, cooldowns, and limits stay visible before you buy.</p>
    </div>

    <div class="grid three store-grid">
      <?php foreach ($vip_products as $product) : ?>
        <?= render_store_product_card($product, $store_player, $store_csrf) ?>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">One-time purchases</p>
      <h2>Stackable perks and kit unlocks</h2>
      <p class="section-lede">Individual perks can stack with VIP tiers. If a purchase is refunded or disputed, the matching access is removed automatically.</p>
    </div>

    <div class="grid three store-grid">
      <?php foreach ($perk_products as $product) : ?>
        <?= render_store_product_card($product, $store_player, $store_csrf) ?>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section">
  <div class="section-inner split-panel">
    <div class="metal-panel">
      <p class="section-kicker">Game access</p>
      <h2>How purchases reach the game</h2>
      <ul class="list-clean">
        <li>Your purchase is attached to the SteamID64 you linked.</li>
        <li>Raidlands keeps track of your active VIP access and perks.</li>
        <li>The game server checks that access and updates your permissions.</li>
        <li>Matching kits and perks appear in game after the next sync.</li>
      </ul>
    </div>
    <div class="metal-panel">
      <p class="section-kicker">Purchase notes</p>
      <h2>Modded server perks</h2>
      <p class="section-lede">These products affect gameplay access on Raidlands. Check the latest kit details, cooldowns, and wipe-balance notes before buying.</p>
      <div class="button-row">
        <a class="btn btn-primary" href="<?= e(route_url('profile')) ?>">Check My Profile</a>
        <a class="btn btn-secondary" href="<?= e(route_url('terms')) ?>">Terms</a>
      </div>
    </div>
  </div>
</section>
