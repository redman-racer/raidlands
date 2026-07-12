<?php

require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/kits.php';
require_once $site_root . '/includes/permissions.php';

$store_flash = raidlands_store_flash();
$store_catalog = raidlands_store_catalog(true);
$store_products = raidlands_kits_attach_to_products($store_catalog['products']);
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
        'rankvip' => '/assets/media/kits/vip-kit.png',
        'vip' => '/assets/media/kits/vip-kit.png',
        'redeemkitvip' => '/assets/media/kits/vip-kit.png',
        'vipkitredeem' => '/assets/media/kits/vip-kit.png',
        'rankvipplus' => '/assets/media/kits/vip-plus-kit.png',
        'vipplus' => '/assets/media/kits/vip-plus-kit.png',
        'redeemkitvipplus' => '/assets/media/kits/vip-plus-kit.png',
        'vippluskitredeem' => '/assets/media/kits/vip-plus-kit.png',
        'rankmvp' => '/assets/media/kits/mvp-kit.png',
        'mvp' => '/assets/media/kits/mvp-kit.png',
        'redeemkitmvp' => '/assets/media/kits/mvp-kit.png',
        'mvpkitredeem' => '/assets/media/kits/mvp-kit.png',
        'rankgoldenvip' => '/assets/media/kits/golden-vip-kit.png',
        'goldenvip' => '/assets/media/kits/golden-vip-kit.png',
        'redeemkitgoldenvip' => '/assets/media/kits/golden-vip-kit.png',
        'goldenvipkitredeem' => '/assets/media/kits/golden-vip-kit.png',
        'rankdiamondvip' => '/assets/media/kits/vip-diamond-kit.webp',
        'diamondvip' => '/assets/media/kits/vip-diamond-kit.webp',
        'rankultimatevip' => '/assets/media/kits/ultimate-vip-kit.png',
        'ultimatevip' => '/assets/media/kits/ultimate-vip-kit.png',
        'redeemkitultimatevip' => '/assets/media/kits/ultimate-vip-kit.png',
        'ultimatevipkitredeem' => '/assets/media/kits/ultimate-vip-kit.png',
        'ranktitanvip' => '/assets/media/kits/titan-vip-kit.png',
        'titanvip' => '/assets/media/kits/titan-vip-kit.png',
        'redeemkittitanvip' => '/assets/media/kits/titan-vip-kit.png',
        'titanvipkitredeem' => '/assets/media/kits/titan-vip-kit.png',
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

function store_product_search_blob(array $product): string
{
    $parts = [
        (string) ($product['name'] ?? ''),
        (string) ($product['slug'] ?? ''),
        (string) ($product['short_description'] ?? ''),
        (string) ($product['description'] ?? ''),
        raidlands_store_type_label((string) ($product['product_type'] ?? 'perk')),
    ];

    foreach ((array) ($product['linked_kits'] ?? []) as $kit) {
        $parts[] = (string) ($kit['kit_name'] ?? '');
        $parts[] = (string) ($kit['description'] ?? '');
        $parts[] = (string) ($kit['required_permission'] ?? '');

        foreach (raidlands_kits_item_summary((array) $kit, 8) as $item) {
            $parts[] = $item;
        }
    }

    foreach ((array) ($product['linked_perks'] ?? []) as $perk) {
        $parts[] = (string) ($perk['label'] ?? $perk['permission'] ?? '');
    }

    return strtolower(trim(implode(' ', array_filter($parts))));
}

function store_product_offer_interval(array $offer, bool $use_billing_interval = false): string
{
    return (string) ($use_billing_interval ? ($offer['billing_interval'] ?? 'one_time') : ($offer['access_interval'] ?? 'one_time'));
}

function render_store_offer_matrix_preview(array $product): string
{
    $rows = [
        'cash' => [
            'label' => 'Cash',
            'offers' => array_merge(
                raidlands_store_cash_pass_offers($product, true),
                raidlands_store_cash_subscription_offers($product, true)
            ),
        ],
        'rp' => [
            'label' => 'RP',
            'offers' => raidlands_store_rp_offers($product, true),
        ],
    ];
    $intervals = raidlands_store_offer_intervals(true);
    $offers_by_row = [];
    $has_offers = false;

    foreach ($rows as $row_key => $row) {
        foreach ((array) $row['offers'] as $offer) {
            $offer = (array) $offer;
            $interval = store_product_offer_interval($offer, $row_key === 'cash' && (string) ($offer['billing_interval'] ?? 'one_time') !== 'one_time');
            $offers_by_row[$row_key][$interval] = $offer;
            $has_offers = true;
        }
    }

    if (!$has_offers) {
        return '<div class="store-card-offer-matrix"><p class="store-muted">No purchase options are active yet.</p></div>';
    }

    $html = '<div class="store-card-offer-matrix" aria-label="Purchase option preview"><table><thead><tr><th>Type</th>';

    foreach ($intervals as $interval) {
        $html .= '<th>' . e(raidlands_store_access_interval_label($interval)) . '</th>';
    }

    $html .= '</tr></thead><tbody>';

    foreach ($rows as $row_key => $row) {
        $html .= '<tr><th>' . e((string) $row['label']) . '</th>';

        foreach ($intervals as $interval) {
            $offer = $offers_by_row[$row_key][$interval] ?? null;
            $value = 'Not offered';

            if ($offer !== null) {
                $value = $row_key === 'rp'
                    ? raidlands_store_rp((int) ($offer['rp_cost'] ?? 0))
                    : raidlands_store_money((int) ($offer['amount_cents'] ?? 0), (string) ($offer['currency'] ?? 'usd'));
            }

            $html .= '<td>' . e($value) . '</td>';
        }

        $html .= '</tr>';
    }

    return $html . '</tbody></table></div>';
}

function render_store_product_card(array $product, ?array $player, string $csrf, bool $cash_ready): string
{
    $rp_offers = raidlands_store_rp_offers($product, true);
    $cash_passes = raidlands_store_cash_pass_offers($product, true);
    $cash_subscriptions = raidlands_store_cash_subscription_offers($product, true);
    $linked_kits = (array) ($product['linked_kits'] ?? []);
    $linked_perks = (array) ($product['linked_perks'] ?? []);
    $kit_html = '';
    $perk_html = '';

    if ($linked_kits !== []) {
        $kit_html .= '<div class="store-card-kit-strip">';

        foreach (array_slice($linked_kits, 0, 3) as $kit) {
            $kit = (array) $kit;
            $image = store_linked_kit_image_url($kit);
            $uses = (int) ($kit['maximum_uses'] ?? 0);
            $cooldown = (int) ($kit['cooldown_seconds'] ?? 0);
            $meta = [$uses > 0 ? number_format($uses) . ' uses' : 'Unlimited uses'];

            if ($cooldown > 0) {
                $meta[] = raidlands_store_format_seconds($cooldown) . ' cooldown';
            }

            $items = raidlands_kits_item_summary($kit, 3);
            $kit_html .= '<a class="store-card-kit-pill" href="' . e(raidlands_store_kit_public_url($kit)) . '">';

            if ($image !== '') {
                $kit_html .= '<img src="' . e($image) . '" alt="" loading="lazy" referrerpolicy="no-referrer">';
            }

            $kit_html .= '<span><strong>' . e((string) ($kit['kit_name'] ?? 'Kit')) . '</strong><small>' . e(implode(' / ', $meta)) . '</small>'
                . ($items !== [] ? '<em>' . e('Includes ' . implode(', ', $items)) . '</em>' : '')
                . '</span></a>';
        }

        if (count($linked_kits) > 3) {
            $kit_html .= '<span class="store-card-more">+' . e((string) (count($linked_kits) - 3)) . ' more kits</span>';
        }

        $kit_html .= '</div>';
    }

    if ($linked_perks !== []) {
        $perk_html .= '<div class="store-card-perk-strip">';

        foreach (array_slice($linked_perks, 0, 4) as $perk) {
            $perk_html .= '<span>' . e((string) ($perk['label'] ?? $perk['permission'] ?? 'Permission')) . '</span>';
        }

        if (count($linked_perks) > 4) {
            $perk_html .= '<span>+' . e((string) (count($linked_perks) - 4)) . ' perks</span>';
        }

        $perk_html .= '</div>';
    }

    $active_offer_count = count($rp_offers) + count($cash_passes) + count($cash_subscriptions);
    $type = raidlands_store_normalize_product_type((string) $product['product_type']);
    $has_rp = count($rp_offers) > 0 ? '1' : '0';
    $has_cash = count($cash_passes) + count($cash_subscriptions) > 0 ? '1' : '0';
    $search = store_product_search_blob($product);
    $sort_name = strtolower((string) ($product['name'] ?? ''));

    return '<article class="metal-card store-product-card"'
        . ' data-store-product'
        . ' data-store-type="' . e($type) . '"'
        . ' data-store-name="' . e($sort_name) . '"'
        . ' data-store-sort="' . e((string) ((int) ($product['sort_order'] ?? 100))) . '"'
        . ' data-store-offers="' . e((string) $active_offer_count) . '"'
        . ' data-store-kits="' . e((string) count($linked_kits)) . '"'
        . ' data-store-rp="' . e($has_rp) . '"'
        . ' data-store-cash="' . e($has_cash) . '"'
        . ' data-store-search="' . e($search) . '">'
        . '<div class="store-card-top">'
        . render_store_product_symbol($product, $type, $linked_kits)
        . '<span class="status-tag ' . e($type === 'kit_bundle' ? 'review' : 'planned') . '">' . e(raidlands_store_type_label($type)) . '</span>'
        . '</div>'
        . '<h3>' . e((string) $product['name']) . '</h3>'
        . '<p class="card-copy">' . e((string) $product['short_description']) . '</p>'
        . '<div class="store-card-facts">'
        . '<span>' . e((string) count($linked_kits)) . ' kit' . (count($linked_kits) === 1 ? '' : 's') . '</span>'
        . '<span>' . e((string) count($linked_perks)) . ' perk' . (count($linked_perks) === 1 ? '' : 's') . '</span>'
        . '<span>' . e((string) $active_offer_count) . ' offer' . ($active_offer_count === 1 ? '' : 's') . '</span>'
        . '</div>'
        . $kit_html
        . $perk_html
        . render_store_offer_matrix_preview($product)
        . '<div class="store-card-actions"><a class="btn btn-primary" href="' . e(raidlands_store_product_public_url($product)) . '">View Details</a></div>'
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

function render_store_catalog(array $products, ?array $player, string $csrf, bool $cash_ready): string
{
    if ($products === []) {
        return '';
    }

    $sections = [
        'kit_bundle' => [
            'kicker' => 'Main bundles',
            'title' => 'Kit bundles',
            'copy' => 'Rank-style packages that combine kits, perks, and access into one product.',
            'products' => raidlands_store_products_by_type($products, 'kit_bundle'),
        ],
        'kit_unlock' => [
            'kicker' => 'Specific unlocks',
            'title' => 'Individual kits',
            'copy' => 'Single kit and pack unlocks for players who want one specific redeem path.',
            'products' => raidlands_store_products_by_type($products, 'kit_unlock'),
        ],
        'perk' => [
            'kicker' => 'Standalone access',
            'title' => 'Standalone perks',
            'copy' => 'Individual permissions and quality-of-life access without buying a whole bundle.',
            'products' => raidlands_store_products_by_type($products, 'perk'),
        ],
    ];
    $counts = [
        'all' => count($products),
        'kit_bundle' => count($sections['kit_bundle']['products']),
        'kit_unlock' => count($sections['kit_unlock']['products']),
        'perk' => count($sections['perk']['products']),
    ];
    $html = '<section class="section store-catalog-section" data-store-catalog>'
        . '<div class="section-inner">'
        . '<div class="section-header store-catalog-heading">'
        . '<p class="section-kicker">Store catalog</p>'
        . '<h2>Find the kit or perk you want</h2>'
        . '<p class="section-lede">Search by kit name, item shortname, bundle, perk, or permission, then sort the results without leaving the page.</p>'
        . '</div>'
        . '<div class="store-catalog-toolbar" aria-label="Store filters">'
        . '<label class="store-control-field"><span>Search</span><input type="search" placeholder="Search kits, perks, items..." data-store-search></label>'
        . '<label class="store-control-field"><span>Category</span><select data-store-type-filter>'
        . '<option value="all">All products (' . e((string) $counts['all']) . ')</option>'
        . '<option value="kit_bundle">Kit bundles (' . e((string) $counts['kit_bundle']) . ')</option>'
        . '<option value="kit_unlock">Individual kits (' . e((string) $counts['kit_unlock']) . ')</option>'
        . '<option value="perk">Standalone perks (' . e((string) $counts['perk']) . ')</option>'
        . '</select></label>'
        . '<label class="store-control-field"><span>Offers</span><select data-store-offer-filter>'
        . '<option value="all">All offers</option>'
        . '<option value="available">Offers available</option>'
        . '<option value="rp">RP offers</option>'
        . '<option value="cash">Cash offers</option>'
        . '</select></label>'
        . '<label class="store-control-field"><span>Sort</span><select data-store-sort>'
        . '<option value="featured">Featured order</option>'
        . '<option value="name">Name A-Z</option>'
        . '<option value="offers">Most offer options</option>'
        . '<option value="kits">Most linked kits</option>'
        . '</select></label>'
        . '<button class="btn btn-secondary store-catalog-reset" type="button" data-store-reset>Reset</button>'
        . '</div>'
        . '<div class="store-catalog-summary" aria-live="polite"><strong data-store-catalog-count>' . e((string) $counts['all']) . '</strong><span>products shown</span></div>'
        . '<div class="store-catalog-sections">';

    foreach ($sections as $type => $section) {
        if ($section['products'] === []) {
            continue;
        }

        $html .= '<section class="store-product-category" data-store-category="' . e($type) . '">'
            . '<div class="store-product-category-head">'
            . '<div><p class="section-kicker">' . e($section['kicker']) . '</p>'
            . '<h3>' . e($section['title']) . '</h3>'
            . '<p>' . e($section['copy']) . '</p></div>'
            . '<span>' . e((string) count($section['products'])) . ' product' . (count($section['products']) === 1 ? '' : 's') . '</span>'
            . '</div>'
            . '<div class="grid three store-grid" data-store-catalog-grid>';

        foreach ($section['products'] as $product) {
            $html .= render_store_product_card($product, $player, $csrf, $cash_ready);
        }

        $html .= '</div></section>';
    }

    return $html
        . '</div>'
        . '<p class="store-empty-state" data-store-catalog-empty hidden>No products match those filters.</p>'
        . '</div></section>';
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

<?= render_store_catalog($store_products, $store_player, $store_csrf, $cash_checkout_ready) ?>

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
