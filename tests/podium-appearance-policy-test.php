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

$fully_heavy = raidlands_podium_observed_outfit_payload(['items_json' => json_encode([
    ['slot' => 'wear-0', 'shortname' => 'metal.facemask', 'skin_id' => '1'],
    ['slot' => 'wear-1', 'shortname' => 'metal.plate.torso', 'skin_id' => '2'],
    ['slot' => 'wear-2', 'shortname' => 'roadsign.kilt', 'skin_id' => '3'],
    ['slot' => 'wear-3', 'shortname' => 'hoodie', 'skin_id' => '4'],
    ['slot' => 'wear-4', 'shortname' => 'pants', 'skin_id' => '5'],
    ['slot' => 'wear-5', 'shortname' => 'shoes.boots', 'skin_id' => '6'],
    ['slot' => 'wear-6', 'shortname' => 'tactical.gloves', 'skin_id' => '7'],
])]);
$fully_heavy_assets = array_column((array) ($fully_heavy['wearables'] ?? []), 'asset');
podium_assert($fully_heavy !== null && count($fully_heavy_assets) === 12, 'Fully Heavy captures must include five mannequin body layers and all seven garments.');
foreach (['metal-facemask', 'metal-chestplate', 'roadsign-kilt', 'hoodie', 'pants', 'boots', 'tactical-gloves'] as $asset) {
    podium_assert(in_array($asset, $fully_heavy_assets, true), 'Fully Heavy captures must map ' . $asset . '.');
}

$hazmat = raidlands_podium_observed_outfit_payload(['items_json' => '[{"slot":"wear-0","shortname":"hazmatsuit","skin_id":"999"}]']);
podium_assert($hazmat !== null && $hazmat['wearables'][0]['asset'] === 'hazmat' && $hazmat['wearables'][0]['skin_id'] === '999', 'Full suits must retain unknown Workshop skin IDs while using the vanilla asset.');
podium_assert(raidlands_podium_default_preset('76561198000000000') === 'fully-heavy', 'Player defaults must use Fully Heavy.');
podium_assert(raidlands_podium_default_preset('bot:scientist') === 'fully-heavy', 'Bot defaults must use Fully Heavy.');
podium_assert(raidlands_podium_preset_payload('missing')['preset'] === 'fully-heavy', 'Invalid preset keys must fall back to Fully Heavy.');
podium_assert(raidlands_podium_presets()['heavy']['label'] === 'Heavy Scientist', 'The legacy Heavy Scientist preset must remain available.');

$pose = raidlands_podium_normalize_pose_rotations([
    'L_UpperArm' => ['x' => '0.5', 'y' => 99, 'z' => -0.25],
    'not_a_real_bone' => ['x' => 1, 'y' => 1, 'z' => 1],
    'head' => ['x' => 0, 'y' => 0, 'z' => 0],
]);
podium_assert(isset($pose['l_upperarm']) && !isset($pose['not_a_real_bone']) && !isset($pose['head']), 'Pose normalization must keep only supported, non-zero bones.');
podium_assert($pose['l_upperarm']['x'] === 0.5 && $pose['l_upperarm']['y'] === 3.141593, 'Pose rotations must be numeric and clamped to a safe radian range.');

$default_pose = raidlands_podium_default_pose();
podium_assert($default_pose['key'] === 'default' && str_contains($default_pose['label'], 'Leaderboard Idle'), 'The hard-coded pose fallback must be Leaderboard Idle.');
podium_assert(isset($default_pose['bones']['l_upperarm'], $default_pose['bones']['r_upperarm']), 'Leaderboard Idle must include its relaxed arm rotations.');
podium_assert(raidlands_podium_effective_pose_key('default', 'first-place') === 'first-place', 'An unset pose must accept its leaderboard-place fallback.');
podium_assert(raidlands_podium_effective_pose_key('victory', 'first-place') === 'victory', 'An explicitly selected pose must override the leaderboard-place fallback.');
podium_assert(
    [
        raidlands_podium_rank_pose_key(1),
        raidlands_podium_rank_pose_key(2),
        raidlands_podium_rank_pose_key(3),
        raidlands_podium_rank_pose_key(4),
    ] === ['first-place', 'second-place', 'third-place', 'default'],
    'Leaderboard ranks must map to the matching place poses and then return to the idle default.'
);

echo "Podium appearance policy tests passed.\n";
