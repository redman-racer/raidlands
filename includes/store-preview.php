<?php

function raidlands_store_preview_asset_registry(): array
{
    return [
        'rifle.ak' => ['file' => 'ak47.glb', 'scale' => 1.05, 'category' => 'weapon'],
        'rifle.lr300' => ['file' => 'lr300.glb', 'scale' => 1.05, 'category' => 'weapon'],
        'smg.mp5' => ['file' => 'mp5.glb', 'scale' => 1.0, 'category' => 'weapon'],
        'rifle.l96' => ['file' => 'l96.glb', 'scale' => 1.0, 'category' => 'weapon'],
        'lmg.m249' => ['file' => 'm249.glb', 'scale' => 1.0, 'category' => 'weapon'],
        'explosive.timed' => ['file' => 'c4.glb', 'scale' => 0.85, 'category' => 'explosive'],
        'syringe.medical' => ['file' => 'medical-syringe.glb', 'scale' => 0.75, 'category' => 'medical'],
        'largemedkit' => ['file' => 'large-medkit.glb', 'scale' => 0.8, 'category' => 'medical'],
        'autoturret' => ['file' => 'auto-turret.glb', 'scale' => 1.0, 'category' => 'sentry'],
        'samsite' => ['file' => 'sam-site.glb', 'scale' => 0.85, 'category' => 'deployable'],
        'ammo.rocket.basic' => ['file' => 'rocket-basic.glb', 'scale' => 0.8, 'category' => 'ammo'],
        'ammo.rocket.hv' => ['file' => 'rocket-hv.glb', 'scale' => 0.8, 'category' => 'ammo'],
        'ammo.rocket.sam' => ['file' => 'rocket-sam.glb', 'scale' => 0.8, 'category' => 'ammo'],
        'ammo.rifle' => ['file' => 'rifle-ammo.glb', 'scale' => 0.85, 'category' => 'ammo'],
        'ammo.rifle.explosive' => ['file' => 'rifle-ammo-explosive.glb', 'scale' => 0.85, 'category' => 'ammo'],
        'ammo.pistol' => ['file' => 'pistol-ammo.glb', 'scale' => 0.85, 'category' => 'ammo'],
        'rocket.launcher' => ['file' => 'rocket-launcher.glb', 'scale' => 1.0, 'category' => 'weapon'],
        'multiplegrenadelauncher' => ['file' => 'grenade-launcher.glb', 'scale' => 1.0, 'category' => 'weapon'],
        'weapon.mod.holosight' => ['file' => 'holosight.glb', 'scale' => 0.75, 'category' => 'attachment'],
        'weapon.mod.lasersight' => ['file' => 'laser-sight.glb', 'scale' => 0.75, 'category' => 'attachment'],
        'weapon.mod.flashlight' => ['file' => 'weapon-flashlight.glb', 'scale' => 0.75, 'category' => 'attachment'],
        'weapon.mod.silencer' => ['file' => 'silencer.glb', 'scale' => 0.75, 'category' => 'attachment'],
        'weapon.mod.small.scope' => ['file' => 'small-scope.glb', 'scale' => 0.75, 'category' => 'attachment'],
        'weapon.mod.8x.scope' => ['file' => '8x-scope.glb', 'scale' => 0.75, 'category' => 'attachment'],
        'metal.facemask' => ['file' => 'metal-facemask.glb', 'scale' => 0.85, 'category' => 'armor'],
        'metal.plate.torso' => ['file' => 'metal-chestplate.glb', 'scale' => 0.85, 'category' => 'armor'],
        'roadsign.kilt' => ['file' => 'roadsign-kilt.glb', 'scale' => 0.85, 'category' => 'armor'],
        'hoodie' => ['file' => 'hoodie.glb', 'scale' => 0.85, 'category' => 'armor'],
        'pants' => ['file' => 'pants.glb', 'scale' => 0.85, 'category' => 'armor'],
        'shoes.boots' => ['file' => 'boots.glb', 'scale' => 0.85, 'category' => 'armor'],
        'tactical.gloves' => ['file' => 'tactical-gloves.glb', 'scale' => 0.85, 'category' => 'armor'],
        'electric.generator.small' => ['file' => 'small-generator.glb', 'scale' => 0.8, 'category' => 'deployable'],
        'supply.signal' => ['file' => 'supply-signal.glb', 'scale' => 0.8, 'category' => 'explosive'],
        'scrap' => ['file' => 'scrap.glb', 'scale' => 0.8, 'category' => 'resource'],
    ];
}

function raidlands_store_preview_item_icon(string $shortname): string
{
    if ($shortname === '' || preg_match('/^[a-z0-9._-]+$/', $shortname) !== 1) {
        return '';
    }

    $relative = 'media/rust-items/' . $shortname . '.webp';
    return is_file(dirname(__DIR__) . '/assets/' . $relative) ? asset_url($relative) : '';
}

function raidlands_store_preview_items(array $kits): array
{
    $registry = raidlands_store_preview_asset_registry();
    $items = [];

    foreach ($kits as $kit_index => $kit) {
        $kit_name = trim((string) ($kit['kit_name'] ?? 'Kit'));
        $containers = (array) ($kit['items'] ?? []);

        foreach (['main', 'wear', 'belt'] as $container) {
            foreach ((array) ($containers[$container] ?? []) as $position => $item) {
                $shortname = strtolower(trim((string) ($item['shortname'] ?? '')));
                if ($shortname === '') {
                    continue;
                }

                $display = trim((string) ($item['display_name'] ?? ''));
                $stable_id = 'kit-' . (int) ($kit['id'] ?? $kit_index) . '-' . $container . '-' . (int) ($item['position'] ?? $position) . '-' . substr(sha1($shortname), 0, 8);
                $model = (array) ($registry[$shortname] ?? []);
                $items[] = [
                    'id' => $stable_id,
                    'shortname' => $shortname,
                    'label' => $display !== '' ? $display : $shortname,
                    'quantity' => max(1, (int) ($item['amount'] ?? 1)),
                    'container' => $container,
                    'position' => (int) ($item['position'] ?? $position),
                    'skin' => max(0, (int) ($item['skin'] ?? 0)),
                    'condition' => (float) ($item['condition_value'] ?? 0),
                    'maxCondition' => (float) ($item['max_condition'] ?? 0),
                    'ammo' => max(0, (int) ($item['ammo'] ?? 0)),
                    'ammoType' => trim((string) ($item['ammo_type'] ?? '')),
                    'contents' => json_decode((string) ($item['contents_json'] ?? '[]'), true) ?: [],
                    'kitName' => $kit_name,
                    'iconUrl' => raidlands_store_preview_item_icon($shortname),
                    'modelUrl' => !empty($model['file']) ? asset_url('media/store-preview/models/' . $model['file']) : '',
                    'modelScale' => (float) ($model['scale'] ?? 1),
                    'category' => (string) ($model['category'] ?? ($container === 'wear' ? 'armor' : 'item')),
                ];
            }
        }
    }

    return $items;
}

function raidlands_store_preview_rank_ladder(): array
{
    $catalog = raidlands_store_catalog(true);
    $products = raidlands_kits_attach_to_products((array) ($catalog['products'] ?? []));
    $ranks = array_values(array_filter($products, static fn (array $product): bool => raidlands_store_normalize_product_type((string) ($product['product_type'] ?? '')) === 'kit_bundle'));
    usort($ranks, static fn (array $a, array $b): int => ((int) ($a['tier_priority'] ?? 0)) <=> ((int) ($b['tier_priority'] ?? 0)));

    return array_map(static function (array $product): array {
        return [
            'id' => (int) ($product['id'] ?? 0),
            'slug' => (string) ($product['slug'] ?? ''),
            'name' => (string) ($product['name'] ?? 'Rank'),
            'priority' => (int) ($product['tier_priority'] ?? 0),
            'items' => raidlands_store_preview_items((array) ($product['linked_kits'] ?? [])),
            'perks' => array_values(array_map(static fn (array $perk): string => (string) ($perk['label'] ?? $perk['permission'] ?? ''), (array) ($product['linked_perks'] ?? []))),
        ];
    }, $ranks);
}

function raidlands_store_preview_payload(array $kits, ?array $product = null): array
{
    return [
        'version' => 1,
        'title' => (string) ($product['name'] ?? ($kits[0]['kit_name'] ?? 'Kit preview')),
        'items' => raidlands_store_preview_items($kits),
        'decoderPath' => asset_url('media/store-preview/draco/'),
        'labels' => [
            'unavailable' => '3D preview unavailable — full kit contents are shown below.',
            'loading' => 'Loading interactive kit preview.',
            'ready' => 'Interactive kit preview ready.',
        ],
    ];
}

function raidlands_store_preview_json(array $payload): string
{
    return (string) json_encode($payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
}

function raidlands_store_preview_markup(array $payload, string $inventory_target_id): string
{
    if ((array) ($payload['items'] ?? []) === []) {
        return '';
    }

    return '<section class="store-preview-shell" data-store-preview data-preview-state="loading">'
        . '<div class="store-preview-head"><div><p class="section-kicker">Interactive preview</p><h2>' . e((string) ($payload['title'] ?? 'Kit')) . ' loadout</h2><p>Choose an item to inspect it on the center pedestal.</p></div></div>'
        . '<div class="store-preview-stage"><div class="store-preview-canvas" data-store-preview-canvas></div>'
        . '<div class="store-preview-hud" data-store-preview-hud><strong data-store-preview-hud-title>Explore the kit</strong><span data-store-preview-hud-meta>Hover an item for its quantity. Click to inspect.</span></div>'
        . '<aside class="store-preview-drawer" data-store-preview-drawer hidden role="dialog" aria-modal="false" aria-labelledby="store-preview-detail-title">'
        . '<button type="button" class="store-preview-drawer-close" data-store-preview-close aria-label="Return to full kit">×</button>'
        . '<img data-store-preview-detail-image alt="" hidden><p class="section-kicker">Item details</p><h3 id="store-preview-detail-title" data-store-preview-detail-title></h3>'
        . '<p data-store-preview-detail-meta></p><p data-store-preview-detail-extra></p></aside></div>'
        . '<p class="store-preview-status" data-store-preview-status role="status" aria-live="polite">Preparing interactive kit preview.</p>'
        . '<script type="application/json" data-store-preview-payload>' . raidlands_store_preview_json($payload) . '</script></section>';
}
