<?php

$store_flash = raidlands_store_flash();
$store_player = raidlands_store_current_player();
$store_csrf = raidlands_store_csrf_token();
$cash_checkout_ready = trim((string) ($stripe_config['secretKey'] ?? '')) !== '';
$store_kit_context = $store_kit_context ?? null;

function store_kit_format_seconds(int $seconds): string
{
    if ($seconds <= 0) {
        return 'No cooldown';
    }

    if ($seconds % 86400 === 0) {
        return (string) ($seconds / 86400) . ' day cooldown';
    }

    if ($seconds % 3600 === 0) {
        return (string) ($seconds / 3600) . ' hour cooldown';
    }

    if ($seconds % 60 === 0) {
        return (string) ($seconds / 60) . ' minute cooldown';
    }

    return (string) $seconds . ' second cooldown';
}

function store_kit_image_url(array $kit): string
{
    $image = raidlands_kits_public_image_url((string) ($kit['image_path'] ?? ''));

    if ($image !== '') {
        return $image;
    }

    $canonical = raidlands_kits_canonical_image_path(
        (string) ($kit['kit_name'] ?? ''),
        (string) ($kit['required_permission'] ?? '')
    );

    return raidlands_kits_public_image_url($canonical);
}

function store_kit_item_image_url(array $item): string
{
    $shortname = strtolower(trim((string) ($item['shortname'] ?? '')));

    if ($shortname === '' || !preg_match('/^[a-z0-9._-]+$/', $shortname)) {
        return '';
    }

    $relative = 'media/rust-items/' . $shortname . '.webp';
    $absolute = dirname(__DIR__) . '/assets/' . $relative;

    return is_file($absolute) ? asset_url($relative) : '';
}

function store_kit_item_label(array $item): string
{
    $display = trim((string) ($item['display_name'] ?? ''));

    return $display !== '' ? $display : (string) ($item['shortname'] ?? 'Item');
}

function store_kit_render_offer_row(array $offer, string $csrf, string $kind, bool $cash_ready = true): string
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

    return $html
        . '<button class="btn btn-primary" type="submit" ' . ($buyable ? '' : 'disabled') . '>'
        . e($buyable ? $button : ($is_rp ? 'RP Not Ready' : 'Cash Not Ready'))
        . '</button></form>';
}

function store_kit_render_offer_group(string $title, array $offers, string $csrf, string $kind, bool $cash_ready = true): string
{
    $offers = array_values(array_filter($offers, static fn (array $offer): bool => !empty($offer['is_active'])));

    if ($offers === []) {
        return '';
    }

    $html = '<div class="store-offer-group"><strong>' . e($title) . '</strong><div class="store-rp-offers">';

    foreach ($offers as $offer) {
        $html .= store_kit_render_offer_row($offer, $csrf, $kind, $cash_ready);
    }

    return $html . '</div></div>';
}

function store_kit_render_product_offer(array $product, ?array $player, string $csrf, bool $cash_ready): string
{
    $rp_offers = raidlands_store_rp_offers($product, true);
    $cash_passes = raidlands_store_cash_pass_offers($product, true);
    $cash_subscriptions = raidlands_store_cash_subscription_offers($product, true);
    $offer_count = count($rp_offers) + count($cash_passes) + count($cash_subscriptions);

    return '<article class="metal-card store-kit-product-card">'
        . '<div><p class="section-kicker">' . e(raidlands_store_type_label((string) ($product['product_type'] ?? 'perk'))) . '</p>'
        . '<h3>' . e((string) ($product['name'] ?? 'Store product')) . '</h3>'
        . '<p class="card-copy">' . e((string) ($product['short_description'] ?? '')) . '</p></div>'
        . '<div class="store-price"><strong>' . e($offer_count > 0 ? 'Offers available' : 'Offers unavailable') . '</strong><span>' . e((string) $offer_count) . ' option' . ($offer_count === 1 ? '' : 's') . '</span></div>'
        . '<div class="store-card-actions"><a class="btn btn-primary" href="' . e(raidlands_store_product_public_url($product)) . '">View Product</a></div>'
        . '</article>';
}

function store_kit_render_item(array $item): string
{
    $image = store_kit_item_image_url($item);
    $amount = max(1, (int) ($item['amount'] ?? 1));
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

    return '<li class="store-kit-item">'
        . ($image !== '' ? '<img src="' . e($image) . '" alt="" loading="lazy" decoding="async">' : '<span class="store-kit-item-placeholder" aria-hidden="true"></span>')
        . '<div><strong>' . e($amount . 'x ' . store_kit_item_label($item)) . '</strong>'
        . '<span>' . e((string) ($item['shortname'] ?? '')) . '</span>'
        . ($meta !== [] ? '<small>' . e(implode(' / ', $meta)) . '</small>' : '')
        . '</div></li>';
}

function store_kit_render_container(string $label, array $items): string
{
    if ($items === []) {
        return '';
    }

    $html = '<section class="store-kit-container"><h3>' . e($label) . '</h3><ul class="store-kit-item-grid">';

    foreach ($items as $item) {
        $html .= store_kit_render_item((array) $item);
    }

    return $html . '</ul></section>';
}
?>

<?php if ($store_kit_context === null) : ?>
  <?= render_page_hero('store-kit', '<a class="btn btn-primary" href="' . e(route_url('store')) . '">Back to Store</a>') ?>
  <section class="section">
    <div class="section-inner">
      <div class="metal-panel">
        <p class="section-kicker">Store kit</p>
        <h2>Kit not found</h2>
        <p class="section-lede">This kit URL does not match an active kit in the current Raidlands store data.</p>
        <a class="btn btn-primary" href="<?= e(route_url('store')) ?>">Browse Store</a>
      </div>
    </div>
  </section>
<?php else : ?>
  <?php
    $kit = (array) $store_kit_context['kit'];
    $related_products = (array) ($store_kit_context['products'] ?? []);
    $image = store_kit_image_url($kit);
    $uses = (int) ($kit['maximum_uses'] ?? 0);
    $cooldown = (int) ($kit['cooldown_seconds'] ?? 0);
    $items_by_container = (array) ($kit['items'] ?? []);
    $item_count = count((array) ($kit['items_flat'] ?? []));
  ?>
  <?= render_page_hero('store-kit',
      '<a class="btn btn-primary" href="' . e(route_url('store')) . '">Back to Store</a>'
      . '<a class="btn btn-steam" href="' . e(raidlands_account_url()) . '">' . e(raidlands_account_label('Sign in with Steam', 'View Account')) . '</a>'
  ) ?>

  <section class="section store-kit-focus">
    <div class="section-inner store-kit-focus-grid">
      <article class="metal-card store-kit-hero-card">
        <?php if ($image !== '') : ?>
          <img class="store-kit-hero-image" src="<?= e($image) ?>" alt="<?= e((string) ($kit['kit_name'] ?? 'Kit')) ?>" loading="eager" decoding="async">
        <?php endif; ?>
        <div class="store-kit-hero-copy">
          <p class="section-kicker">Kit detail</p>
          <h2><?= e((string) ($kit['kit_name'] ?? 'Kit')) ?></h2>
          <p class="section-lede"><?= e((string) ($kit['description'] ?: 'Full kit contents and matching store products.')) ?></p>
        </div>
      </article>
      <aside class="metal-panel store-kit-facts">
        <p class="section-kicker">Kit stats</p>
        <dl>
          <div><dt>Uses</dt><dd><?= e($uses > 0 ? number_format($uses) : 'Unlimited') ?></dd></div>
          <div><dt>Cooldown</dt><dd><?= e(store_kit_format_seconds($cooldown)) ?></dd></div>
          <div><dt>Items</dt><dd><?= e((string) $item_count) ?></dd></div>
          <div><dt>Permission</dt><dd><code><?= e((string) ($kit['required_permission'] ?? '')) ?></code></dd></div>
        </dl>
      </aside>
    </div>
  </section>

  <?php $store_preview_payload = raidlands_store_preview_payload([$kit]); ?>
  <?php if (($store_preview_payload['items'] ?? []) !== []) : ?>
    <section class="section store-preview-section"><div class="section-inner">
      <?= raidlands_store_preview_markup($store_preview_payload, 'store-kit-inventory') ?>
    </div></section>
  <?php endif; ?>

  <section class="section" id="store-kit-inventory" data-store-html-inventory>
    <div class="section-inner">
      <div class="section-header">
        <p class="section-kicker">Contents</p>
        <h2>Everything in this kit</h2>
      </div>
      <div class="store-kit-container-stack">
        <?= store_kit_render_container('Main inventory', (array) ($items_by_container['main'] ?? [])) ?>
        <?= store_kit_render_container('Wear slots', (array) ($items_by_container['wear'] ?? [])) ?>
        <?= store_kit_render_container('Belt slots', (array) ($items_by_container['belt'] ?? [])) ?>
      </div>
    </div>
  </section>

  <section class="section alt">
    <div class="section-inner">
      <?php if ($store_flash !== null) : ?>
        <div class="form-status <?= e((string) $store_flash['type']) ?>"><?= e((string) $store_flash['message']) ?></div>
      <?php endif; ?>
      <div class="section-header">
        <p class="section-kicker">Store access</p>
        <h2>Products that include this kit</h2>
        <p class="section-lede">These offers are loaded from the same active store catalog as the main shop page.</p>
      </div>
      <?php if ($related_products === []) : ?>
        <div class="metal-panel">
          <p class="store-muted">This kit is active but is not currently attached to an active store product.</p>
        </div>
      <?php else : ?>
        <div class="grid three store-kit-products">
          <?php foreach ($related_products as $product) : ?>
            <?= store_kit_render_product_offer((array) $product, $store_player, $store_csrf, $cash_checkout_ready) ?>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>
  </section>
<?php endif; ?>
<?php if ($store_kit_context !== null) : ?>
<script type="module" src="<?= e(asset_url('build/airstrike-animation-editor/store-kit-preview.js')) ?>"></script>
<?php endif; ?>
