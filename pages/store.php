<?php

require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/kits.php';
require_once $site_root . '/includes/permissions.php';

$store_flash = raidlands_store_flash();
$store_catalog = raidlands_store_catalog(true);
$store_products = raidlands_kits_attach_to_products($store_catalog['products']);
$bundle_products = raidlands_store_products_by_type($store_products, 'kit_bundle');
$kit_products = raidlands_store_products_by_type($store_products, 'kit_unlock');
$perk_products = raidlands_store_products_by_type($store_products, 'perk');
$store_player = raidlands_store_current_player();
$store_rp_balance = $store_player !== null && !empty($store_player['id'])
    ? raidlands_store_current_rp_balance((int) $store_player['id'])
    : null;
$store_csrf = raidlands_store_csrf_token();
$cash_checkout_ready = trim((string) ($stripe_config['secretKey'] ?? '')) !== '';

function render_store_offer_row(array $offer, string $csrf, string $kind, bool $cash_ready = true): string
{
    $is_rp = $kind === 'rp';
    $buyable = $is_rp
        ? raidlands_store_rp_offer_is_buyable($offer)
        : ($cash_ready && raidlands_store_price_is_buyable($offer));
    $label = raidlands_store_offer_label($offer, $is_rp ? 'RP' : 'Cash');
    $price = $is_rp
        ? raidlands_store_rp((int) ($offer['rp_cost'] ?? 0))
        : raidlands_store_money((int) ($offer['amount_cents'] ?? 0), (string) ($offer['currency'] ?? 'usd'));
    $action = $is_rp ? route_url('store') . 'rp-checkout.php' : route_url('store') . 'checkout.php';
    $button = $is_rp ? 'Use RP' : 'Checkout';

    $html = '<form class="store-rp-offer" method="post" action="' . e($action) . '">'
        . '<input type="hidden" name="csrf" value="' . e($csrf) . '">'
        . '<input type="hidden" name="price_id" value="' . e((string) ($offer['id'] ?? 0)) . '">'
        . '<div><strong>' . e($label) . '</strong><span>' . e($price) . '</span></div>';

    if ($is_rp && !empty($offer['allow_auto_renew']) && (string) ($offer['access_interval'] ?? 'one_time') !== 'one_time') {
        $html .= '<label class="store-renew-toggle">'
            . '<input type="checkbox" name="auto_renew" value="1">'
            . '<span>Auto-renew</span>'
            . '</label>';
    }

    $html .= '<button class="btn btn-primary" type="submit" ' . ($buyable ? '' : 'disabled') . '>'
        . e($buyable ? $button : ($is_rp ? 'RP Not Ready' : 'Cash Not Ready'))
        . '</button>'
        . '</form>';

    return $html;
}

function render_store_offer_group(string $title, array $offers, string $csrf, string $kind, bool $cash_ready = true): string
{
    $offers = array_values(array_filter($offers, static fn (array $offer): bool => !empty($offer['is_active'])));

    if ($offers === []) {
        return '';
    }

    $html = '<div class="store-offer-group"><strong>' . e($title) . '</strong><div class="store-rp-offers">';

    foreach ($offers as $offer) {
        $html .= render_store_offer_row($offer, $csrf, $kind, $cash_ready);
    }

    return $html . '</div></div>';
}

function store_product_image_key(string $value): string
{
    $value = strtolower(str_replace('+', 'plus', $value));

    return preg_replace('/[^a-z0-9]+/', '', $value) ?? '';
}

function store_product_primary_image_path(array $product): string
{
    $keys = array_values(array_filter([
        store_product_image_key((string) ($product['slug'] ?? '')),
        store_product_image_key((string) ($product['name'] ?? '')),
    ]));
    $images = [
        'rankvip' => '/assets/media/kits/vip-kit.webp',
        'vip' => '/assets/media/kits/vip-kit.webp',
        'redeemkitvip' => '/assets/media/kits/vip-kit.webp',
        'vipkitredeem' => '/assets/media/kits/vip-kit.webp',
        'rankvipplus' => '/assets/media/kits/vip-plus-kit.webp',
        'vipplus' => '/assets/media/kits/vip-plus-kit.webp',
        'redeemkitvipplus' => '/assets/media/kits/vip-plus-kit.webp',
        'vippluskitredeem' => '/assets/media/kits/vip-plus-kit.webp',
        'rankmvp' => '/assets/media/kits/mvp-kit.webp',
        'mvp' => '/assets/media/kits/mvp-kit.webp',
        'redeemkitmvp' => '/assets/media/kits/mvp-kit.webp',
        'mvpkitredeem' => '/assets/media/kits/mvp-kit.webp',
        'rankgoldenvip' => '/assets/media/kits/golden-vip-kit.webp',
        'goldenvip' => '/assets/media/kits/golden-vip-kit.webp',
        'redeemkitgoldenvip' => '/assets/media/kits/golden-vip-kit.webp',
        'goldenvipkitredeem' => '/assets/media/kits/golden-vip-kit.webp',
        'rankdiamondvip' => '/assets/media/kits/vip-diamond-kit.webp',
        'diamondvip' => '/assets/media/kits/vip-diamond-kit.webp',
        'rankultimatevip' => '/assets/media/kits/ultimate-vip-kit.webp',
        'ultimatevip' => '/assets/media/kits/ultimate-vip-kit.webp',
        'redeemkitultimatevip' => '/assets/media/kits/ultimate-vip-kit.webp',
        'ultimatevipkitredeem' => '/assets/media/kits/ultimate-vip-kit.webp',
        'ranktitanvip' => '/assets/media/kits/titan-vip-kit.webp',
        'titanvip' => '/assets/media/kits/titan-vip-kit.webp',
        'redeemkittitanvip' => '/assets/media/kits/titan-vip-kit.webp',
        'titanvipkitredeem' => '/assets/media/kits/titan-vip-kit.webp',
        'redeempacksentrysmall' => '/assets/media/kits/sentry-small-pack.webp',
        'sentrypacksmall' => '/assets/media/kits/sentry-small-pack.webp',
        'redeempacksentrylarge' => '/assets/media/kits/sentry-large-pack.webp',
        'sentrypacklarge' => '/assets/media/kits/sentry-large-pack.webp',
        'redeempackportafort' => '/assets/media/kits/portafort-token.webp',
        'portafortpack' => '/assets/media/kits/portafort-token.webp',
        'redeempackvehicle' => '/assets/media/kits/vehicle-pack.webp',
        'vehiclepack' => '/assets/media/kits/vehicle-pack.webp',
    ];

    foreach ($keys as $key) {
        if (isset($images[$key])) {
            return $images[$key];
        }
    }

    return '';
}

function store_linked_kit_image_url(array $kit): string
{
    $image = raidlands_kits_public_image_url((string) ($kit['image_path'] ?? ''));

    if ($image !== '') {
        return $image;
    }

    if (!function_exists('raidlands_kits_canonical_image_path')) {
        return '';
    }

    $canonical = raidlands_kits_canonical_image_path(
        (string) ($kit['kit_name'] ?? $kit['reward_display_name'] ?? ''),
        (string) ($kit['required_permission'] ?? $kit['reward_permission'] ?? '')
    );

    return raidlands_kits_public_image_url($canonical);
}

function render_store_product_symbol(array $product, string $type, array $linked_kits): string
{
    if ($type === 'perk') {
        return render_feature_symbol('SHOP');
    }

    $product_image = store_product_primary_image_path($product);

    if ($product_image !== '') {
        return '<span class="feature-symbol feature-symbol-image store-product-symbol" aria-hidden="true">'
            . '<img src="' . e(raidlands_kits_public_image_url($product_image)) . '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
            . '</span>';
    }

    if ($linked_kits === []) {
        return render_feature_symbol('KIT');
    }

    $product_keys = array_values(array_filter([
        store_product_image_key((string) ($product['name'] ?? '')),
        store_product_image_key((string) ($product['slug'] ?? '')),
    ]));
    $fallback_image = '';
    $best_image = '';
    $best_score = -1;

    foreach ($linked_kits as $kit) {
        $kit = (array) $kit;
        $image = store_linked_kit_image_url($kit);

        if ($image === '') {
            continue;
        }

        if ($fallback_image === '') {
            $fallback_image = $image;
        }

        $kit_keys = array_values(array_filter([
            store_product_image_key((string) ($kit['kit_name'] ?? '')),
            store_product_image_key((string) ($kit['reward_display_name'] ?? '')),
        ]));
        $score = 0;

        foreach ($product_keys as $product_key) {
            foreach ($kit_keys as $kit_key) {
                if ($product_key === '' || $kit_key === '') {
                    continue;
                }

                if ($product_key === $kit_key) {
                    $score = max($score, 4);
                } elseif (strlen($product_key) >= 4 && str_contains($kit_key, $product_key)) {
                    $score = max($score, 3);
                } elseif (strlen($kit_key) >= 4 && str_contains($product_key, $kit_key)) {
                    $score = max($score, 2);
                }
            }
        }

        if ($score > $best_score) {
            $best_score = $score;
            $best_image = $image;
        }
    }

    $image = $best_image !== '' ? $best_image : $fallback_image;

    if ($image === '') {
        return render_feature_symbol('KIT');
    }

    return '<span class="feature-symbol feature-symbol-image store-product-symbol" aria-hidden="true">'
        . '<img src="' . e($image) . '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
        . '</span>';
}

function render_store_product_card(array $product, ?array $player, string $csrf, bool $cash_ready): string
{
    $rp_offers = raidlands_store_rp_offers($product, true);
    $cash_passes = raidlands_store_cash_pass_offers($product, true);
    $cash_subscriptions = raidlands_store_cash_subscription_offers($product, true);
    $has_linked_identity = $player !== null && !empty($player['steam_id64']);
    $has_checkout_player = $has_linked_identity && !empty($player['id']);
    $linked_kits = (array) ($product['linked_kits'] ?? []);
    $linked_perks = (array) ($product['linked_perks'] ?? []);
    $kit_html = '';
    $perk_html = '';
    $actions = '';

    if ($linked_kits !== []) {
        $kit_html .= '<div class="store-kit-details">';

        foreach (array_slice($linked_kits, 0, 3) as $kit) {
            $kit = (array) $kit;
            $image = store_linked_kit_image_url($kit);
            $uses = (int) ($kit['maximum_uses'] ?? 0);
            $cooldown = (int) ($kit['cooldown_seconds'] ?? 0);
            $items = raidlands_kits_item_summary($kit, 5);
            $meta = [$uses > 0 ? number_format($uses) . ' uses' : 'Unlimited uses'];

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

    if ($linked_perks !== []) {
        $perk_html .= '<div class="store-perk-details"><strong>Group perks</strong><div>';

        foreach (array_slice($linked_perks, 0, 6) as $perk) {
            $perk_html .= '<span>' . e((string) ($perk['label'] ?? $perk['permission'] ?? 'Permission')) . '</span>';
        }

        if (count($linked_perks) > 6) {
            $perk_html .= '<span>+' . e((string) (count($linked_perks) - 6)) . ' more</span>';
        }

        $perk_html .= '</div></div>';
    }

    if (!$has_linked_identity) {
        $actions = '<a class="btn btn-secondary" href="' . e(route_url('link')) . '">Connect Steam First</a>';
    } elseif (!$has_checkout_player) {
        $actions = '<a class="btn btn-secondary" href="' . e(route_url('profile')) . '">View Account</a>';
    } else {
        $actions .= render_store_offer_group('RP', $rp_offers, $csrf, 'rp');
        $actions .= render_store_offer_group('Cash passes', $cash_passes, $csrf, 'cash', $cash_ready);
        $actions .= render_store_offer_group('Cash subscriptions', $cash_subscriptions, $csrf, 'cash', $cash_ready);

        if ($actions === '') {
            $actions = '<button class="btn btn-ghost" type="button" disabled>Offers Unavailable</button>';
        }
    }

    $active_offer_count = count($rp_offers) + count($cash_passes) + count($cash_subscriptions);
    $type = raidlands_store_normalize_product_type((string) $product['product_type']);

    return '<article class="metal-card store-product-card">'
        . '<div class="store-card-top">'
        . render_store_product_symbol($product, $type, $linked_kits)
        . '<span class="status-tag ' . e($type === 'kit_bundle' ? 'review' : 'planned') . '">' . e(raidlands_store_type_label($type)) . '</span>'
        . '</div>'
        . '<h3>' . e((string) $product['name']) . '</h3>'
        . '<p class="card-copy">' . e((string) $product['short_description']) . '</p>'
        . '<div class="store-price"><strong>' . e($active_offer_count > 0 ? 'Offers available' : 'Offers unavailable') . '</strong><span>' . e((string) $active_offer_count) . ' option' . ($active_offer_count === 1 ? '' : 's') . '</span></div>'
        . $kit_html
        . $perk_html
        . '<ul class="store-mini-list">'
        . '<li>Purchases are attached to your connected Steam account.</li>'
        . '<li>Timed access ends automatically; lifetime access has no scheduled expiration.</li>'
        . '</ul>'
        . '<div class="store-card-actions">' . $actions . '</div>'
        . '</article>';
}

function render_store_section(string $kicker, string $title, string $copy, array $products, ?array $player, string $csrf, bool $cash_ready): string
{
    if ($products === []) {
        return '';
    }

    $html = '<section class="section"><div class="section-inner">'
        . '<div class="section-header">'
        . '<p class="section-kicker">' . e($kicker) . '</p>'
        . '<h2>' . e($title) . '</h2>'
        . '<p class="section-lede">' . e($copy) . '</p>'
        . '</div>'
        . '<div class="grid three store-grid">';

    foreach ($products as $product) {
        $html .= render_store_product_card($product, $player, $csrf, $cash_ready);
    }

    return $html . '</div></div></section>';
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
  </div>
</section>

<?= render_store_section('Main bundles', 'Kit bundles', 'Grouped kits and perks are the main store packages. Choose lifetime access, a timed pass, or a recurring subscription when offers are active.', $bundle_products, $store_player, $store_csrf, $cash_checkout_ready) ?>
<?= render_store_section('Low tier shop kits', 'Individual kits', 'Single kit unlocks are available separately for players who want one specific kit without a full bundle.', $kit_products, $store_player, $store_csrf, $cash_checkout_ready) ?>
<?= render_store_section('Standalone perks', 'Perks by themselves', 'Pick individual gameplay perks without bundling them into a kit package.', $perk_products, $store_player, $store_csrf, $cash_checkout_ready) ?>

<section class="section alt">
  <div class="section-inner split-panel">
    <div class="metal-panel">
      <p class="section-kicker">Game access</p>
      <h2>How purchases reach the game</h2>
      <ul class="list-clean">
        <li>Your request is attached to your connected Steam account.</li>
        <li>RP purchases are confirmed by the game server before access changes.</li>
        <li>Cash purchases update after checkout confirmation.</li>
        <li>Matching kits and perks appear in game after the next update.</li>
      </ul>
    </div>
    <div class="metal-panel">
      <p class="section-kicker">Purchase notes</p>
      <h2>Modded server perks</h2>
      <p class="section-lede">These products affect gameplay access on Raidlands. Check kit contents, cooldowns, and wipe-balance notes before buying.</p>
      <div class="button-row">
        <a class="btn btn-primary" href="<?= e(route_url('profile')) ?>">Check My Profile</a>
        <a class="btn btn-secondary" href="<?= e(route_url('terms')) ?>">Terms</a>
      </div>
    </div>
  </div>
</section>
