<?php

require_once dirname(__DIR__) . '/includes/casino-games.php';

function casino_assert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$soft = raidlands_blackjack_hand_value(['AS', '6H']);
casino_assert($soft['total'] === 17 && $soft['soft'], 'Ace-six must be soft 17.');
casino_assert(raidlands_blackjack_hand_value(['AS', 'AH', '9D'])['total'] === 21, 'Multiple aces must downgrade correctly.');
casino_assert(raidlands_blackjack_hand_value(['AS', 'KH'])['blackjack'], 'Ace-ten must be a natural.');
casino_assert(raidlands_blackjack_hand_value(['10S', '8H', '5D'])['bust'], '23 must bust.');
$deck = raidlands_blackjack_new_deck();
casino_assert(count($deck) === 312 && count(array_filter($deck, static fn(string $card): bool => $card === 'AS')) === 6, 'Blackjack must use six complete decks.');

$straight = raidlands_casino_roulette_normalize_bet(['type'=>'straight','numbers'=>[17],'stake_rp'=>10]);
casino_assert(raidlands_casino_roulette_bet_wins($straight, 17) && $straight['gross_multiplier'] === 36, 'Straight payout is wrong.');
$split = raidlands_casino_roulette_normalize_bet(['type'=>'split','numbers'=>[17,20],'stake_rp'=>10]);
casino_assert(raidlands_casino_roulette_bet_wins($split, 20) && $split['gross_multiplier'] === 18, 'Vertical split is wrong.');
$corner = raidlands_casino_roulette_normalize_bet(['type'=>'corner','numbers'=>[1,2,4,5],'stake_rp'=>10]);
casino_assert(raidlands_casino_roulette_bet_wins($corner, 4), 'Corner geometry is wrong.');
$red = raidlands_casino_roulette_normalize_bet(['type'=>'outside','key'=>'red','stake_rp'=>10]);
casino_assert(!raidlands_casino_roulette_bet_wins($red, 0) && raidlands_casino_roulette_bet_wins($red, 1), 'Zero/red behavior is wrong.');
try { raidlands_casino_roulette_normalize_bet(['type'=>'split','numbers'=>[3,4],'stake_rp'=>10]); casino_assert(false, 'Invalid row-crossing split was accepted.'); } catch (InvalidArgumentException $expected) {}

$grid = array_fill(0, 5, ['scrap','blank','blank']);
$slot = raidlands_casino_evaluate_slots($grid, 100, 'balanced');
$scrapFive = raidlands_casino_slot_config('balanced')['symbols']['scrap']['pays'][5];
casino_assert($slot['payout_rp'] === 10 * $scrapFive && count($slot['winning_lines']) === 1, 'Five-scrap top line payout is wrong.');
$blank = array_fill(0, 5, ['blank','blank','blank']);
casino_assert(raidlands_casino_evaluate_slots($blank, 100)['payout_rp'] === 0, 'Blank symbols must never pay.');

$rtps = [];
foreach (['safe','balanced','generous'] as $preset) {
    $symbols = raidlands_casino_slot_config($preset)['symbols'];
    $weight = array_sum(array_column($symbols, 'weight'));
    $expected = 0.0;
    foreach ($symbols as $symbol) {
        $p = $symbol['weight'] / $weight;
        $expected += ($p ** 3 * (1-$p)) * ($symbol['pays'][3] ?? 0)
            + ($p ** 4 * (1-$p)) * ($symbol['pays'][4] ?? 0)
            + ($p ** 5) * ($symbol['pays'][5] ?? 0);
    }
    $rtps[$preset] = $expected;
}
casino_assert($rtps['safe'] < $rtps['balanced'] && $rtps['balanced'] < $rtps['generous'], 'Slots presets must increase monotonically.');
casino_assert($rtps['safe'] > .84 && $rtps['generous'] < 1.0, 'Slots RTP presets must remain in the audited 84%-100% band.');

echo "Casino engine tests passed.\n";
