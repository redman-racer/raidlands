<?php

require_once dirname(__DIR__) . '/includes/podium.php';

function podium_assert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$wear = raidlands_podium_normalize_wear([
    ['slot' => 'wear-2', 'shortname' => 'SHOES.BOOTS', 'skin_id' => '123'],
    ['slot' => 'wear-0', 'shortname' => 'hoodie', 'skin_id' => 'workshop:456'],
    ['slot' => 'wear-1', 'shortname' => 'pants', 'skin_id' => 0],
    ['slot' => 'wear-1', 'shortname' => '<script>', 'skin_id' => 9],
]);

podium_assert(count($wear) === 3, 'Wear slots must be deduplicated and invalid shortnames discarded.');
podium_assert($wear[0]['shortname'] === 'hoodie' && $wear[0]['skin_id'] === '456', 'Wear normalization must be canonical and preserve numeric skin IDs.');
podium_assert(strlen(hash('sha256', (string) json_encode($wear, JSON_UNESCAPED_SLASHES))) === 64, 'Canonical outfit signatures must be SHA-256 hashes.');

$complete = raidlands_podium_observed_outfit_payload(['items_json' => json_encode([
    ['slot' => 'wear-0', 'shortname' => 'hoodie', 'skin_id' => '7'],
    ['slot' => 'wear-1', 'shortname' => 'pants', 'skin_id' => '8'],
    ['slot' => 'wear-2', 'shortname' => 'shoes.boots', 'skin_id' => '9'],
])]);
podium_assert($complete !== null && count($complete['wearables']) === 8, 'Complete layered outfits must include the mannequin body and three garments.');
podium_assert(raidlands_podium_observed_outfit_payload(['items_json' => '[{"slot":"wear-0","shortname":"hoodie","skin_id":"0"}]']) === null, 'Incomplete captured looks must not replace a fully dressed fallback.');

$hazmat = raidlands_podium_observed_outfit_payload(['items_json' => '[{"slot":"wear-0","shortname":"hazmatsuit","skin_id":"999"}]']);
podium_assert($hazmat !== null && $hazmat['wearables'][0]['asset'] === 'hazmat' && $hazmat['wearables'][0]['skin_id'] === '999', 'Full suits must retain unknown Workshop skin IDs while using the vanilla asset.');
podium_assert(raidlands_podium_default_preset('76561198000000000') === raidlands_podium_default_preset('76561198000000000'), 'SteamID defaults must remain stable.');

echo "Podium appearance policy tests passed.\n";
