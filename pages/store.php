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
$store_rp_balance = $store_player !== null && !empty($store_player['id'])
    ? raidlands_store_current_rp_balance((int) $store_player['id'])
    : null;
$store_csrf = raidlands_store_csrf_token();

function render_store_product_card(array $product, ?array $player, string $csrf): string
{
    $cash_price = raidlands_store_default_price($product);
    $cash_buyable = raidlands_store_price_is_buyable($cash_price);
    $rp_offers = raidlands_store_rp_offers($product, true);
    $has_linked_identity = $player !== null && !empty($player['steam_id64']);
    $has_checkout_player = $has_linked_identity && !empty($player['id']);
    $cash_price_text = $cash_price === null
        ? 'Price coming soon'
        : raidlands_store_money((int) $cash_price['amount_cents'], (string) $cash_price['currency']);
    $cash_interval = $cash_price !== null && (string) $cash_price['billing_interval'] === 'month' ? ' / month' : '';
    $cash_note = $cash_buyable ? 'Configured for later (' . $cash_price_text . $cash_interval . ')' : 'Not enabled yet';
    $actions = '';
    $linked_kits = (array) ($product['linked_kits'] ?? []);
    $kit_html = '';

    if (!$has_linked_identity) {
        $actions = '<a class="btn btn-secondary" href="' . e(route_url('link')) . '">Connect Steam First</a>';
    } elseif (!$has_checkout_player) {
        $actions = '<a class="btn btn-secondary" href="' . e(route_url('profile')) . '">View Account</a>';
    } elseif ($rp_offers === []) {
        $actions = '<button class="btn btn-ghost" type="button" disabled>RP Price Coming Soon</button>';
    } else {
        $actions .= '<div class="store-rp-offers">';

        foreach ($rp_offers as $offer) {
            $label = (string) ($offer['label'] ?: raidlands_store_access_interval_label((string) ($offer['access_interval'] ?? 'one_time')));
            $actions .= '<form class="store-rp-offer" method="post" action="' . e(route_url('store') . 'rp-checkout.php') . '">'
                . '<input type="hidden" name="csrf" value="' . e($csrf) . '">'
                . '<input type="hidden" name="price_id" value="' . e((string) $offer['id']) . '">'
                . '<div><strong>' . e($label) . '</strong><span>' . e(raidlands_store_rp((int) $offer['rp_cost'])) . '</span></div>';

            if (!empty($offer['allow_auto_renew'])) {
                $actions .= '<label class="store-renew-toggle">'
                    . '<input type="checkbox" name="auto_renew" value="1">'
                    . '<span>Auto-renew</span>'
                    . '</label>';
            }

            $actions .= '<button class="btn btn-primary" type="submit">Use RP</button>'
                . '</form>';
        }

        $actions .= '</div>';
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
                . '<span>' . e(implode(' / ', $meta)) . '</span>';

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
        . '<div class="store-price"><strong>' . e($rp_offers === [] ? 'RP price coming soon' : 'RP available') . '</strong><span>' . e((string) count($rp_offers)) . ' offer' . (count($rp_offers) === 1 ? '' : 's') . '</span></div>'
        . $kit_html
        . '<ul class="store-mini-list">'
        . '<li>RP purchases are verified by the game server before access is added.</li>'
        . '<li>Kit details update here as staff adjusts the live catalog.</li>'
        . '</ul>'
        . '<div class="store-card-actions">' . $actions . '</div>'
        . '<div class="store-cash-note"><strong>Cash checkout:</strong> ' . e($cash_note) . '</div>'
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

    <?php if ($store_player !== null) : ?>
      <div class="store-rp-status">
        <div>
          <p class="section-kicker">Your RP</p>
          <strong><?= e(raidlands_store_rp((int) ($store_rp_balance['reward_points'] ?? 0))) ?></strong>
        </div>
        <span><?= $store_rp_balance === null || empty($store_rp_balance['last_seen_at']) ? 'Waiting for the next server sync' : 'Last synced ' . e((string) $store_rp_balance['last_seen_at']) ?></span>
      </div>
    <?php endif; ?>

    <div class="section-header">
      <p class="section-kicker">VIP kits</p>
      <h2>RP passes for Rust</h2>
      <p class="section-lede">Bronze, Gold, and Elite can be purchased with earned RP as daily, weekly, monthly, or yearly passes. Auto-renew is optional when an offer allows it.</p>
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
      <p class="section-lede">Individual perks can stack with VIP tiers. Cash checkout will appear later after payment processing is configured.</p>
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
        <li>Your RP request is attached to your connected Steam account.</li>
        <li>The game server verifies your live RP and deducts it there.</li>
        <li>Raidlands adds your VIP access only after the server confirms the RP debit.</li>
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
