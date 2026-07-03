<?php

require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/kits.php';

$store_flash = raidlands_store_flash();
$store_catalog = raidlands_store_catalog(true);
$store_products = raidlands_kits_attach_to_products($store_catalog['products']);
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
    $has_linked_identity = $player !== null && !empty($player['steam_id64']);
    $has_checkout_player = $has_linked_identity && !empty($player['id']);
    $price_text = $price === null
        ? 'Price coming soon'
        : raidlands_store_money((int) $price['amount_cents'], (string) $price['currency']);
    $interval = $price !== null && (string) $price['billing_interval'] === 'month' ? ' / month' : '';
    $action = '';
    $linked_kits = (array) ($product['linked_kits'] ?? []);
    $kit_html = '';

    if (!$has_linked_identity) {
        $action = '<a class="btn btn-secondary" href="' . e(route_url('link')) . '">Connect Steam First</a>';
    } elseif (!$has_checkout_player) {
        $action = '<a class="btn btn-secondary" href="' . e(route_url('profile')) . '">View Account</a>';
    } elseif (!$buyable) {
        $action = '<button class="btn btn-ghost" type="button" disabled>Checkout Coming Soon</button>';
    } else {
        $action = '<form method="post" action="' . e(route_url('store') . 'checkout.php') . '">'
            . '<input type="hidden" name="csrf" value="' . e($csrf) . '">'
            . '<input type="hidden" name="price_id" value="' . e((string) $price['id']) . '">'
            . '<button class="btn btn-primary" type="submit">Checkout</button>'
            . '</form>';
    }

    if ($linked_kits !== []) {
        $kit_html .= '<div class="store-kit-details">';

        foreach (array_slice($linked_kits, 0, 3) as $kit) {
            $image = raidlands_kits_public_image_url((string) ($kit['image_path'] ?? ''));
            $uses = (int) ($kit['maximum_uses'] ?? 0);
            $cooldown = (int) ($kit['cooldown_seconds'] ?? 0);
            $items = raidlands_kits_item_summary($kit, 5);
            $meta = [];

            if ($uses > 0) {
                $meta[] = number_format($uses) . ' uses';
            } else {
                $meta[] = 'Unlimited uses';
            }

            if ($cooldown > 0) {
                $meta[] = raidlands_store_format_seconds($cooldown) . ' cooldown';
            }

            $kit_html .= '<div class="store-kit-detail">';

            if ($image !== '') {
                $kit_html .= '<img src="' . e($image) . '" alt="" loading="lazy" referrerpolicy="no-referrer">';
            }

            $kit_html .= '<div>'
                . '<strong>' . e((string) ($kit['kit_name'] ?? 'Kit')) . '</strong>'
                . '<span>' . e(implode(' · ', $meta)) . '</span>';

            if ($items !== []) {
                $kit_html .= '<small>' . e(implode(', ', $items)) . '</small>';
            }

            $kit_html .= '</div></div>';
        }

        if (count($linked_kits) > 3) {
            $kit_html .= '<p class="store-muted">+' . e((string) (count($linked_kits) - 3)) . ' more kit options attached.</p>';
        }

        $kit_html .= '</div>';
    }

    return '<article class="metal-card store-product-card">'
        . '<div class="store-card-top">'
        . render_feature_symbol((string) ((string) $product['product_type'] === 'vip_subscription' ? 'KIT' : 'SHOP'))
        . '<span class="status-tag ' . e((string) $product['product_type'] === 'vip_subscription' ? 'review' : 'planned') . '">' . e(raidlands_store_type_label((string) $product['product_type'])) . '</span>'
        . '</div>'
        . '<h3>' . e((string) $product['name']) . '</h3>'
        . '<p class="card-copy">' . e((string) $product['short_description']) . '</p>'
        . '<div class="store-price"><strong>' . e($price_text) . '</strong><span>' . e($interval) . '</span></div>'
        . $kit_html
        . '<ul class="store-mini-list">'
        . '<li>Unlocks the matching in-game VIP access.</li>'
        . '<li>Kit details update here as staff adjusts the live catalog.</li>'
        . '</ul>'
        . '<div class="store-card-actions">' . $action . '</div>'
        . '</article>';
}

function raidlands_store_format_seconds(int $seconds): string
{
    if ($seconds <= 0) {
        return 'No';
    }

    if ($seconds % 86400 === 0) {
        return (string) ($seconds / 86400) . 'd';
    }

    if ($seconds % 3600 === 0) {
        return (string) ($seconds / 3600) . 'h';
    }

    if ($seconds % 60 === 0) {
        return (string) ($seconds / 60) . 'm';
    }

    return (string) $seconds . 's';
}
?>
<?= render_page_hero('store',
    '<a class="btn btn-primary" href="' . e(raidlands_account_url()) . '">' . e(raidlands_account_label('Connect Steam', 'View Account')) . '</a>'
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
      <h2>Monthly ranks for Rust</h2>
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
        <li>Your purchase is attached to your connected Steam account.</li>
        <li>Raidlands keeps track of your active VIP access and perks.</li>
        <li>The game server checks your account and updates your VIP access.</li>
        <li>Matching kits and perks appear in game after the next update.</li>
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
