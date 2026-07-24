<?php

$store_flash = raidlands_store_flash();
$store_player = raidlands_store_current_player();
$store_csrf = raidlands_store_csrf_token();
$cash_checkout_ready = trim((string) ($stripe_config['secretKey'] ?? '')) !== '';
$store_item_context = $store_item_context ?? null;

function store_item_image_key(string $value): string
{
    $value = strtolower(str_replace('+', 'plus', $value));

    return preg_replace('/[^a-z0-9]+/', '', $value) ?? '';
}

function store_item_primary_image_path(array $product): string
{
    $keys = array_values(array_filter([
        store_item_image_key((string) ($product['slug'] ?? '')),
        store_item_image_key((string) ($product['name'] ?? '')),
    ]));
    $images = [
        'rankvip' => '/assets/media/kits/vip-kit.png',
        'vip' => '/assets/media/kits/vip-kit.png',
        'rankvipplus' => '/assets/media/kits/vip-plus-kit.png',
        'vipplus' => '/assets/media/kits/vip-plus-kit.png',
        'rankmvp' => '/assets/media/kits/mvp-kit.png',
        'mvp' => '/assets/media/kits/mvp-kit.png',
        'rankgoldenvip' => '/assets/media/kits/golden-vip-kit.png',
        'goldenvip' => '/assets/media/kits/golden-vip-kit.png',
        'rankdiamondvip' => '/assets/media/kits/vip-diamond-kit.webp',
        'diamondvip' => '/assets/media/kits/vip-diamond-kit.webp',
        'rankultimatevip' => '/assets/media/kits/ultimate-vip-kit.png',
        'ultimatevip' => '/assets/media/kits/ultimate-vip-kit.png',
        'ranktitanvip' => '/assets/media/kits/titan-vip-kit.png',
        'titanvip' => '/assets/media/kits/titan-vip-kit.png',
        'redeemkitvip' => '/assets/media/kits/vip-kit.png',
        'redeemkitvipplus' => '/assets/media/kits/vip-plus-kit.png',
        'redeemkitmvp' => '/assets/media/kits/mvp-kit.png',
        'redeemkitgoldenvip' => '/assets/media/kits/golden-vip-kit.png',
        'redeemkitultimatevip' => '/assets/media/kits/ultimate-vip-kit.png',
        'redeemkittitanvip' => '/assets/media/kits/titan-vip-kit.png',
        'redeempacksentrysmall' => '/assets/media/kits/sentry-small-pack.webp',
        'redeempacksentrylarge' => '/assets/media/kits/sentry-large-pack.webp',
        'redeempackportafort' => '/assets/media/kits/portafort-token.webp',
        'redeempackvehicle' => '/assets/media/kits/vehicle-pack.webp',
    ];

    foreach ($keys as $key) {
        if (isset($images[$key])) {
            return $images[$key];
        }
    }

    return '';
}

function store_item_image_url(array $product): string
{
    $image = store_item_primary_image_path($product);

    if ($image !== '') {
        return raidlands_kits_public_image_url($image);
    }

    foreach ((array) ($product['linked_kits'] ?? []) as $kit) {
        $kit = (array) $kit;
        $image = raidlands_kits_public_image_url((string) ($kit['image_path'] ?? ''));

        if ($image !== '') {
            return $image;
        }
    }

    return '';
}

function store_item_format_seconds(int $seconds): string
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

function store_item_item_image_url(array $item): string
{
    $shortname = strtolower(trim((string) ($item['shortname'] ?? '')));

    if ($shortname === '' || !preg_match('/^[a-z0-9._-]+$/', $shortname)) {
        return '';
    }

    $relative = 'media/rust-items/' . $shortname . '.webp';
    $absolute = dirname(__DIR__) . '/assets/' . $relative;

    return is_file($absolute) ? asset_url($relative) : '';
}

function store_item_item_label(array $item): string
{
    $display = trim((string) ($item['display_name'] ?? ''));

    return $display !== '' ? $display : (string) ($item['shortname'] ?? 'Item');
}

function store_item_kit_items(array $kit): array
{
    if (isset($kit['items_flat'])) {
        return array_values((array) $kit['items_flat']);
    }

    $items = [];

    foreach (['main', 'wear', 'belt'] as $container) {
        foreach ((array) ($kit['items'][$container] ?? []) as $item) {
            $item = (array) $item;
            $item['container_name'] = (string) ($item['container_name'] ?? $container);
            $items[] = $item;
        }
    }

    return $items;
}

function store_item_render_kit_inventory_item(array $item): string
{
    $image = store_item_item_image_url($item);
    $amount = max(1, (int) ($item['amount'] ?? 1));
    $shortname = (string) ($item['shortname'] ?? '');
    $meta = [];
    $skin = (int) ($item['skin'] ?? 0);
    $ammo = (int) ($item['ammo'] ?? 0);
    $ammo_type = trim((string) ($item['ammo_type'] ?? ''));

    if ($skin > 0) {
        $meta[] = 'Skin ' . $skin;
    }

    if ($ammo > 0) {
        $meta[] = $ammo . ' ammo' . ($ammo_type !== '' ? ' / ' . $ammo_type : '');
    }

    return '<li class="store-item-kit-inventory-item">'
        . ($image !== '' ? '<img src="' . e($image) . '" alt="" loading="lazy" decoding="async">' : '<span class="store-kit-item-placeholder" aria-hidden="true"></span>')
        . '<div><strong>' . e($amount . 'x ' . store_item_item_label($item)) . '</strong>'
        . ($shortname !== '' ? '<span>' . e($shortname) . '</span>' : '')
        . ($meta !== [] ? '<small>' . e(implode(' / ', $meta)) . '</small>' : '')
        . '</div></li>';
}

function store_item_render_kit_inventory(array $kit, int $limit = 12): string
{
    $items = store_item_kit_items($kit);

    if ($items === []) {
        return '<p class="store-muted">This kit is linked, but item contents have not synced into the website yet.</p>';
    }

    $visible = array_slice($items, 0, max(1, $limit));
    $remaining = count($items) - count($visible);
    $html = '<ul class="store-item-kit-inventory-grid">';

    foreach ($visible as $item) {
        $html .= store_item_render_kit_inventory_item((array) $item);
    }

    $html .= '</ul>';

    if ($remaining > 0) {
        $html .= '<p class="store-item-kit-more">+' . e((string) $remaining) . ' more item' . ($remaining === 1 ? '' : 's') . ' on the full kit page.</p>';
    }

    return $html;
}

function store_item_offer_interval(array $offer, bool $use_billing_interval = false): string
{
    return (string) ($use_billing_interval ? ($offer['billing_interval'] ?? 'one_time') : ($offer['access_interval'] ?? 'one_time'));
}

function store_item_offer_cell(array $offer, string $csrf, string $kind, bool $cash_ready = true): string
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
    $html = '<form class="store-item-offer store-purchase-cell" method="post" action="' . e($action) . '">'
        . '<input type="hidden" name="csrf" value="' . e($csrf) . '">'
        . '<input type="hidden" name="price_id" value="' . e((string) ($offer['id'] ?? 0)) . '">'
        . '<div><strong>' . e($price) . '</strong><span>' . e($label) . '</span></div>';

    if ($is_rp && !empty($offer['allow_auto_renew']) && (string) ($offer['access_interval'] ?? 'one_time') !== 'one_time') {
        $html .= '<label class="store-renew-toggle">'
            . '<input type="checkbox" name="auto_renew" value="1">'
            . '<span>Auto-renew</span>'
            . '</label>';
    }

    return $html
        . '<button class="btn btn-primary" type="submit" ' . ($buyable ? '' : 'disabled') . '>'
        . e($buyable ? $button : ($is_rp ? 'RP Not Ready' : 'Cash Not Ready'))
        . '</button></form>';
}

function store_item_purchase_matrix(array $product, string $csrf, bool $cash_ready): string
{
    $rows = [
        'cash' => [
            'label' => 'Cash',
            'kind' => 'cash',
            'offers' => array_merge(
                raidlands_store_cash_pass_offers($product, true),
                raidlands_store_cash_subscription_offers($product, true)
            ),
        ],
        'rp' => [
            'label' => 'RP',
            'kind' => 'rp',
            'offers' => raidlands_store_rp_offers($product, true),
        ],
    ];
    $intervals = raidlands_store_offer_intervals(true);
    $offers_by_row = [];
    $has_offers = false;

    foreach ($rows as $row_key => $row) {
        foreach ((array) $row['offers'] as $offer) {
            $offer = (array) $offer;
            $interval = store_item_offer_interval($offer, $row_key === 'cash' && (string) ($offer['billing_interval'] ?? 'one_time') !== 'one_time');
            $offers_by_row[$row_key][$interval] = $offer;
            $has_offers = true;
        }
    }

    if (!$has_offers) {
        return '<button class="btn btn-ghost" type="button" disabled>Offers Unavailable</button>';
    }

    $html = '<div class="store-purchase-table-wrap"><table class="store-purchase-table">'
        . '<thead><tr><th scope="col">Purchase type</th>';

    foreach ($intervals as $interval) {
        $html .= '<th scope="col">' . e(raidlands_store_access_interval_label($interval)) . '</th>';
    }

    $html .= '</tr></thead><tbody>';

    foreach ($rows as $row_key => $row) {
        $html .= '<tr><th scope="row">' . e((string) $row['label']) . '</th>';

        foreach ($intervals as $interval) {
            $offer = $offers_by_row[$row_key][$interval] ?? null;
            $html .= '<td>';
            $html .= $offer !== null
                ? store_item_offer_cell((array) $offer, $csrf, (string) $row['kind'], $cash_ready)
                : '<span class="store-purchase-empty">Not offered</span>';
            $html .= '</td>';
        }

        $html .= '</tr>';
    }

    return $html . '</tbody></table></div>';
}

function store_item_purchase_matrix_preview(array $product): string
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
            $interval = store_item_offer_interval($offer, $row_key === 'cash' && (string) ($offer['billing_interval'] ?? 'one_time') !== 'one_time');
            $offers_by_row[$row_key][$interval] = $offer;
            $has_offers = true;
        }
    }

    if (!$has_offers) {
        return '<button class="btn btn-ghost" type="button" disabled>Offers Unavailable</button>';
    }

    $html = '<div class="store-purchase-table-wrap"><table class="store-purchase-table">'
        . '<thead><tr><th scope="col">Purchase type</th>';

    foreach ($intervals as $interval) {
        $html .= '<th scope="col">' . e(raidlands_store_access_interval_label($interval)) . '</th>';
    }

    $html .= '</tr></thead><tbody>';

    foreach ($rows as $row_key => $row) {
        $html .= '<tr><th scope="row">' . e((string) $row['label']) . '</th>';

        foreach ($intervals as $interval) {
            $offer = $offers_by_row[$row_key][$interval] ?? null;
            $value = 'Not offered';

            if ($offer !== null) {
                $value = $row_key === 'rp'
                    ? raidlands_store_rp((int) ($offer['rp_cost'] ?? 0))
                    : raidlands_store_money((int) ($offer['amount_cents'] ?? 0), (string) ($offer['currency'] ?? 'usd'));
            }

            $html .= '<td><span class="' . e($offer !== null ? 'store-purchase-preview-price' : 'store-purchase-empty') . '">' . e($value) . '</span></td>';
        }

        $html .= '</tr>';
    }

    return $html . '</tbody></table></div>';
}

function store_item_purchase_panel(array $product, ?array $player, string $csrf, bool $cash_ready): string
{
    if ($player === null || empty($player['steam_id64'])) {
        return '<div class="metal-panel store-item-purchase-panel" id="purchase-options">'
            . '<p class="section-kicker">Purchase options</p>'
            . '<h2>Sign in with Steam first</h2>'
            . '<p class="section-lede">Store access is attached to your SteamID64 so the game server can apply it correctly.</p>'
            . store_item_purchase_matrix_preview($product)
            . '<a class="btn btn-steam" href="' . e(raidlands_account_url()) . '">Sign in with Steam</a>'
            . '</div>';
    }

    if (empty($player['id'])) {
        return '<div class="metal-panel store-item-purchase-panel" id="purchase-options">'
            . '<p class="section-kicker">Purchase options</p>'
            . '<h2>Account needed</h2>'
            . '<p class="section-lede">Open your profile so the store can finish loading your linked account.</p>'
            . store_item_purchase_matrix_preview($product)
            . '<a class="btn btn-primary" href="' . e(route_url('profile')) . '">View Account</a>'
            . '</div>';
    }

    return '<div class="metal-panel store-item-purchase-panel" id="purchase-options">'
        . '<p class="section-kicker">Purchase options</p>'
        . '<h2>Choose access</h2>'
        . store_item_purchase_matrix($product, $csrf, $cash_ready)
        . '</div>';
}

function store_item_render_kit(array $kit): string
{
    $image = function_exists('store_linked_kit_image_url') ? store_linked_kit_image_url($kit) : raidlands_kits_public_image_url((string) ($kit['image_path'] ?? ''));
    $uses = (int) ($kit['maximum_uses'] ?? 0);
    $cooldown = (int) ($kit['cooldown_seconds'] ?? 0);
    $items = store_item_kit_items($kit);
    $description = trim((string) ($kit['description'] ?? ''));
    $meta = [
        $uses > 0 ? number_format($uses) . ' uses' : 'Unlimited uses',
        count($items) . ' item' . (count($items) === 1 ? '' : 's'),
    ];

    if ($cooldown > 0) {
        $meta[] = store_item_format_seconds($cooldown) . ' cooldown';
    }

    $item_count = count($items);
    $row_class = 'store-item-kit-row' . ($item_count > 4 ? ' is-wide' : ' is-compact');

    return '<article class="' . e($row_class) . '">'
        . '<div class="store-item-kit-row-head">'
        . ($image !== '' ? '<img src="' . e($image) . '" alt="" loading="lazy" decoding="async">' : '<span class="store-kit-item-placeholder" aria-hidden="true"></span>')
        . '<div><h3><a href="' . e(raidlands_store_kit_public_url($kit)) . '">' . e((string) ($kit['kit_name'] ?? 'Kit')) . '</a></h3>'
        . '<p>' . e(implode(' / ', $meta)) . '</p>'
        . ($description !== '' ? '<small>' . e($description) . '</small>' : '')
        . '</div></div>'
        . store_item_render_kit_inventory($kit, 12)
        . '<div class="store-item-kit-actions"><a class="btn btn-secondary" href="' . e(raidlands_store_kit_public_url($kit)) . '">Full Kit Details</a></div>'
        . '</article>';
}

function store_item_render_perks(array $perks): string
{
    if ($perks === []) {
        return '';
    }

    $groups = [];

    foreach ($perks as $perk) {
        $perk = (array) $perk;
        $plugin = trim((string) ($perk['plugin_name'] ?? ''));
        $permission = trim((string) ($perk['permission'] ?? ''));
        $prefix = $permission !== '' && str_contains($permission, '.') ? strtok($permission, '.') : '';
        $group = $plugin !== '' ? $plugin : ($prefix !== '' ? ucfirst($prefix) : 'Server access');

        $groups[$group][] = $perk;
    }

    ksort($groups, SORT_NATURAL | SORT_FLAG_CASE);
    $html = '<div class="store-item-perk-list">';

    foreach ($groups as $group => $group_perks) {
        $html .= '<article class="store-item-perk-group"><h3>' . e($group) . '</h3><ul>';

        foreach ($group_perks as $perk) {
            $permission = (string) ($perk['permission'] ?? '');
            $label = (string) ($perk['label'] ?? $permission ?: 'Permission');

            if ($permission !== '' && str_contains($label, ': ')) {
                $label = substr($label, (int) strpos($label, ': ') + 2);
            }

            $html .= '<li><strong>' . e($label) . '</strong>'
                . ($permission !== '' ? '<code>' . e($permission) . '</code>' : '')
                . '</li>';
        }

        $html .= '</ul></article>';
    }

    return $html . '</div>';
}
?>

<?php if ($store_item_context === null) : ?>
  <?= render_page_hero('store-item', '<a class="btn btn-primary" href="' . e(route_url('store')) . '">Back to Store</a>') ?>
  <section class="section">
    <div class="section-inner">
      <div class="metal-panel">
        <p class="section-kicker">Store item</p>
        <h2>Item not found</h2>
        <p class="section-lede">This store URL does not match an active Raidlands product.</p>
        <a class="btn btn-primary" href="<?= e(route_url('store')) ?>">Browse Store</a>
      </div>
    </div>
  </section>
<?php else : ?>
  <?php
    $product = (array) $store_item_context['product'];
    $linked_kits = (array) ($product['linked_kits'] ?? []);
    $linked_perks = (array) ($product['linked_perks'] ?? []);
    $image = store_item_image_url($product);
    $offer_count = count(raidlands_store_rp_offers($product, true))
        + count(raidlands_store_cash_pass_offers($product, true))
        + count(raidlands_store_cash_subscription_offers($product, true));
    $backpack_slots = raidlands_store_product_backpack_slots($product);
  ?>
  <?= render_page_hero('store-item',
      '<a class="btn btn-primary" href="' . e(route_url('store')) . '">Back to Store</a>'
      . '<a class="btn btn-steam" href="' . e(raidlands_account_url()) . '">' . e(raidlands_account_label('Sign in with Steam', 'View Account')) . '</a>'
  ) ?>

  <section class="section store-item-focus">
    <div class="section-inner store-item-layout">
      <article class="metal-card store-item-overview">
        <?php if ($image !== '') : ?>
          <img class="store-item-hero-image" src="<?= e($image) ?>" alt="<?= e((string) ($product['name'] ?? 'Store item')) ?>" loading="eager" decoding="async">
        <?php endif; ?>
        <div>
          <p class="section-kicker"><?= e(raidlands_store_type_label((string) ($product['product_type'] ?? 'perk'))) ?></p>
          <h2><?= e((string) ($product['name'] ?? 'Store item')) ?></h2>
          <p class="section-lede"><?= e((string) ($product['description'] ?: $product['short_description'] ?? '')) ?></p>
          <div class="store-card-facts">
            <?php if ($backpack_slots > 0) : ?>
              <span><strong><?= e((string) $backpack_slots) ?></strong> backpack slots</span>
            <?php endif; ?>
            <span><?= e((string) count($linked_kits)) ?> kit<?= count($linked_kits) === 1 ? '' : 's' ?></span>
            <span><?= e((string) count($linked_perks)) ?> perk<?= count($linked_perks) === 1 ? '' : 's' ?></span>
            <span><?= e((string) $offer_count) ?> offer<?= $offer_count === 1 ? '' : 's' ?></span>
          </div>
          <div class="store-item-overview-actions">
            <a class="btn btn-primary" href="#purchase-options">Buy Now</a>
          </div>
        </div>
      </article>
    </div>
  </section>

  <section class="section" id="store-product-inventory" data-store-html-inventory>
    <div class="section-inner">
      <div class="section-header">
        <p class="section-kicker">Included access</p>
        <h2>What this item grants</h2>
      </div>
      <?php if ($linked_kits === [] && $linked_perks === []) : ?>
        <div class="metal-panel"><p class="store-muted">This product does not currently expose kit or perk details.</p></div>
      <?php else : ?>
        <?php if ($linked_kits !== []) : ?>
          <div class="store-item-kit-list">
            <?php foreach ($linked_kits as $kit) : ?>
              <?= store_item_render_kit((array) $kit) ?>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
        <?= store_item_render_perks($linked_perks) ?>
      <?php endif; ?>
    </div>
  </section>

  <section class="section alt store-item-purchase-section">
    <div class="section-inner">
      <?php if ($store_flash !== null) : ?>
        <div class="form-status <?= e((string) $store_flash['type']) ?>"><?= e((string) $store_flash['message']) ?></div>
      <?php endif; ?>
      <?= store_item_purchase_panel($product, $store_player, $store_csrf, $cash_checkout_ready) ?>
    </div>
  </section>
<?php endif; ?>
