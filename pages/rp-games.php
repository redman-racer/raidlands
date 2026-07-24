<?php

$games_ready = !empty($rp_games_state['ready']);
$games_player = is_array($rp_games_state['player'] ?? null) ? $rp_games_state['player'] : null;
$settings = is_array($rp_games_state['settings'] ?? null) ? $rp_games_state['settings'] : [];
$game_backend = is_array($rp_games_state['game_backend'] ?? null) ? $rp_games_state['game_backend'] : [];
$games_balance = is_array($rp_games_state['balance'] ?? null) ? $rp_games_state['balance'] : null;
$daily = is_array($rp_games_state['daily'] ?? null) ? $rp_games_state['daily'] : [];
$active_jackpot = is_array($rp_games_state['active_jackpot'] ?? null) ? $rp_games_state['active_jackpot'] : null;
$pool_rounds = is_array($rp_games_state['pool_rounds'] ?? null) ? $rp_games_state['pool_rounds'] : [];
$raid_duel_state = is_array($pool_rounds['raid_duel'] ?? null) ? $pool_rounds['raid_duel'] : [];
$supply_run_state = is_array($pool_rounds['supply_run'] ?? null) ? $pool_rounds['supply_run'] : [];
$raid_duel_round = is_array($raid_duel_state['round'] ?? null) ? $raid_duel_state['round'] : null;
$supply_run_round = is_array($supply_run_state['round'] ?? null) ? $supply_run_state['round'] : null;
$game_rounds = (array) ($rp_games_state['game_rounds'] ?? []);
$jackpot_entries = (array) ($rp_games_state['jackpot_entries'] ?? []);
$jackpot_rounds = (array) ($rp_games_state['jackpot_rounds'] ?? []);
$sync_state = is_array($rp_games_state['sync'] ?? null) ? $rp_games_state['sync'] : [];
$rp_leaderboard_scope = ((string) ($_GET['leaderboard_scope'] ?? 'current')) === 'all-time' ? 'all-time' : 'current';
$rp_leaders = $rp_leaderboard_scope === 'all-time'
    ? (array) ($rp_games_state['leaderboard_all_time'] ?? [])
    : (array) ($rp_games_state['leaderboard_current'] ?? []);
$sync_pending_count = max(0, (int) ($sync_state['pending_count'] ?? 0));
$sync_poll_seconds = max(10, (int) ($sync_state['poll_seconds'] ?? 30));
$sync_countdown_label = (string) floor($sync_poll_seconds / 60) . ':' . str_pad((string) ($sync_poll_seconds % 60), 2, '0', STR_PAD_LEFT);
$sync_next_check_at = (string) ($sync_state['next_check_at'] ?? '');
$self_exclusion = is_array($rp_games_state['self_exclusion'] ?? null) ? $rp_games_state['self_exclusion'] : null;
$self_exclusion_active = $self_exclusion !== null && !empty($self_exclusion['active']);
$self_exclusion_enabled = $games_ready && !empty($settings['self_exclusion_enabled']);
$self_exclusion_periods = function_exists('raidlands_rewards_self_exclusion_periods')
    ? raidlands_rewards_self_exclusion_periods()
    : [];
$self_exclusion_end_label = (string) ($self_exclusion['end_label'] ?? '');
$can_play = $games_ready
    && $games_player !== null
    && !empty($games_player['id'])
    && !empty($settings['games_enabled'])
    && !$self_exclusion_active;
$min_stake = (int) ($settings['min_stake_rp'] ?? 200);
$max_stake = (int) ($settings['max_stake_rp'] ?? 2000);
$dice_target = function_exists('raidlands_rewards_dice_target') ? raidlands_rewards_dice_target($settings) : 4;
$dice_win_faces = max(1, 7 - $dice_target);
$dice_chance = (int) round(($dice_win_faces / 6) * 100);
$dice_roll_label = $dice_target >= 6 ? '6' : $dice_target . '-6';
$high_low_backend = !empty($game_backend['high_low']);
$wheel_backend = !empty($game_backend['wheel']);
$raid_duel_backend = !empty($game_backend['raid_duel']);
$supply_run_backend = !empty($game_backend['supply_run']);
$high_low_enabled = $high_low_backend && !empty($settings['high_low_enabled']);
$wheel_enabled = $wheel_backend && !empty($settings['wheel_enabled']);
$roulette_backend = !empty($game_backend['roulette']);
$slots_backend = !empty($game_backend['slots']);
$blackjack_backend = !empty($game_backend['blackjack']);
$roulette_enabled = $roulette_backend && !empty($settings['roulette_enabled']);
$slots_enabled = $slots_backend && !empty($settings['slots_enabled']);
$blackjack_enabled = $blackjack_backend && !empty($settings['blackjack_enabled']);
$active_blackjack = is_array($rp_games_state['active_blackjack'] ?? null) ? $rp_games_state['active_blackjack'] : null;
$raid_duel_enabled = $raid_duel_backend && !empty($settings['raid_duel_enabled']);
$supply_run_enabled = $supply_run_backend && !empty($settings['supply_run_enabled']);
$monument_ready = !empty($monument_state['ready']);
$monument_enabled = $monument_ready && !empty($monument_state['enabled']);
$monument_config = is_array($monument_state['config'] ?? null) ? $monument_state['config'] : raidlands_monument_public_config(raidlands_monument_default_config());
$monument_loadouts = is_array($monument_config['loadouts'] ?? null) ? $monument_config['loadouts'] : [];
$monument_has_active_run = is_array($monument_state['activeRun'] ?? null);
$wheel_segments = function_exists('raidlands_rewards_wheel_segments') ? raidlands_rewards_wheel_segments() : [];
$pool_options = static function (array $pool_state): array {
    $round = is_array($pool_state['round'] ?? null) ? $pool_state['round'] : [];
    $game = is_array($pool_state['game'] ?? null) ? $pool_state['game'] : [];

    return is_array($round['options'] ?? null) && $round['options'] !== []
        ? (array) $round['options']
        : (array) ($game['options'] ?? []);
};
$raid_duel_options = $pool_options($raid_duel_state);
$supply_run_options = $pool_options($supply_run_state);
$game_names = [
    'coinflip' => 'Coinflip',
    'dice' => 'Dice',
    'high_low' => 'High-Low',
    'wheel' => 'Wheel',
    'roulette' => 'Roulette',
    'slots' => 'Slots',
    'blackjack' => 'Blackjack',
    'raid_duel' => 'Raid Duel',
    'supply_run' => 'Supply Run',
    'monument_extraction' => 'Monument Extraction',
];
$rp_status_labels = [
    'queued' => 'Waiting on server',
    'processing' => 'Server updating RP',
    'confirmed' => 'Complete',
    'paid' => 'Complete',
    'lost' => 'Complete',
    'payout_queued' => 'Payout waiting',
    'rejected' => 'Not completed',
    'failed' => 'Needs attention',
    'expired' => 'Timed out',
    'canceled' => 'Canceled',
];
$rp_game_tabs = [
    [
        'key' => 'coinflip',
        'label' => 'Coinflip',
        'meta' => '50% odds',
        'icon' => 'RISK',
        'enabled' => $can_play && !empty($settings['coinflip_enabled']),
        'ready' => true,
    ],
    [
        'key' => 'dice',
        'label' => 'Dice',
        'meta' => 'Roll ' . $dice_roll_label,
        'icon' => 'STAT',
        'enabled' => $can_play && !empty($settings['dice_enabled']),
        'ready' => true,
    ],
    [
        'key' => 'jackpot',
        'label' => 'Jackpot',
        'meta' => $active_jackpot === null ? 'Waiting' : raidlands_store_rp((int) ($active_jackpot['pot_rp'] ?? 0)) . ' pot',
        'icon' => 'SHOP',
        'enabled' => $can_play && !empty($settings['jackpot_enabled']) && $active_jackpot !== null,
        'ready' => true,
    ],
    [
        'key' => 'raid-duel',
        'label' => 'Raid Duel',
        'meta' => $raid_duel_round === null ? 'PvP pool' : raidlands_store_rp((int) ($raid_duel_round['total_stake_rp'] ?? 0)) . ' pool',
        'icon' => 'RISK',
        'enabled' => $can_play && $raid_duel_enabled && $raid_duel_round !== null,
        'ready' => $raid_duel_backend,
    ],
    [
        'key' => 'supply-run',
        'label' => 'Supply Run',
        'meta' => $supply_run_round === null ? 'PvE pool' : raidlands_store_rp((int) ($supply_run_round['total_stake_rp'] ?? 0)) . ' pool',
        'icon' => 'EVENT',
        'enabled' => $can_play && $supply_run_enabled && $supply_run_round !== null,
        'ready' => $supply_run_backend,
    ],
    [
        'key' => 'monument-extraction',
        'label' => 'Monument Extraction',
        'meta' => $monument_has_active_run ? 'Run in progress' : 'Tactical extraction',
        'icon' => 'CMD',
        'enabled' => $can_play && $monument_enabled,
        'ready' => $monument_ready,
    ],
    [
        'key' => 'high-low',
        'label' => 'High-Low',
        'meta' => '45/45 with push',
        'icon' => 'CMD',
        'enabled' => $can_play && $high_low_enabled,
        'ready' => $high_low_backend,
    ],
    [
        'key' => 'wheel',
        'label' => 'Wheel',
        'meta' => 'Segment odds',
        'icon' => 'EVENT',
        'enabled' => $can_play && $wheel_enabled,
        'ready' => $wheel_backend,
    ],
    [
        'key' => 'blackjack', 'label' => 'Blackjack',
        'meta' => $active_blackjack ? 'Hand in progress' : 'Dealer stands soft 17', 'icon' => 'RISK',
        'enabled' => $can_play && $blackjack_enabled, 'ready' => $blackjack_backend,
    ],
    [
        'key' => 'roulette', 'label' => 'Roulette', 'meta' => 'European 0-36', 'icon' => 'EVENT',
        'enabled' => $can_play && $roulette_enabled, 'ready' => $roulette_backend,
    ],
    [
        'key' => 'slots', 'label' => 'Slots', 'meta' => '5 reels / 10 lines', 'icon' => 'SHOP',
        'enabled' => $can_play && $slots_enabled, 'ready' => $slots_backend,
    ],
];
?>
<?= render_page_hero('rp-games',
    '<a class="btn btn-steam" href="' . e(raidlands_account_url()) . '">' . e(raidlands_account_label('Sign in with Steam', 'View Account')) . '</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('vote')) . '">Vote Rewards</a>'
) ?>

<section class="section rp-games-section">
  <div class="section-inner" data-rp-games>
    <div class="rp-games-status-stack" data-rp-games-status>
      <?php if ($rp_games_flash !== null) : ?>
        <div class="form-status <?= e((string) $rp_games_flash['type']) ?>" data-rp-games-flash><?= e((string) $rp_games_flash['message']) ?></div>
      <?php else : ?>
        <div class="form-status" data-rp-games-flash hidden></div>
      <?php endif; ?>

      <?php if (!$games_ready) : ?>
        <div class="form-status warning"><?= e((string) ($rp_games_state['message'] ?? 'RP games are not installed yet.')) ?></div>
      <?php elseif (empty($settings['games_enabled'])) : ?>
        <div class="form-status warning">RP games are paused by admins.</div>
      <?php elseif ($games_player === null || empty($games_player['id'])) : ?>
        <div class="form-status warning">Link your Steam account before playing RP games.</div>
      <?php elseif ($self_exclusion_active) : ?>
        <div class="form-status warning">RP game self-exclusion is active<?= $self_exclusion_end_label !== '' ? ' until ' . e($self_exclusion_end_label) : '' ?>.</div>
      <?php endif; ?>
    </div>

    <?php if ($games_ready) : ?>
      <aside class="rp-self-exclusion-panel <?= $self_exclusion_active ? 'is-active' : '' ?>" aria-labelledby="rp-self-exclusion-title">
        <div class="rp-self-exclusion-copy">
          <p class="section-kicker"><?= $self_exclusion_active ? 'Self-exclusion active' : 'Player control' ?></p>
          <h2 id="rp-self-exclusion-title"><?= $self_exclusion_active ? 'RP games are locked' : 'Take a break from RP games' ?></h2>
          <?php if ($self_exclusion_active) : ?>
            <p>Your account cannot start or join RP games. Existing entries, active rounds, and queued RP changes may still finish.</p>
          <?php else : ?>
            <p>Block this Steam account from starting or joining RP games for a fixed period or permanently.</p>
          <?php endif; ?>
        </div>

        <?php if ($self_exclusion_active) : ?>
          <div class="rp-self-exclusion-status" role="status">
            <span>Locked until</span>
            <strong><?= e($self_exclusion_end_label !== '' ? $self_exclusion_end_label : 'Permanent') ?></strong>
            <small>The lock ends automatically at the time shown. Permanent exclusions have no end date.</small>
          </div>
        <?php elseif (!$self_exclusion_enabled) : ?>
          <div class="form-status warning rp-self-exclusion-message">Self-exclusion is currently unavailable because enforcement is disabled.</div>
        <?php elseif ($games_player === null || empty($games_player['id'])) : ?>
          <div class="rp-self-exclusion-action">
            <p>Sign in with Steam before setting a self-exclusion.</p>
            <a class="btn btn-steam" href="<?= e(raidlands_account_url()) ?>">Sign in with Steam</a>
          </div>
        <?php else : ?>
          <form class="rp-self-exclusion-form" method="post" action="<?= e(route_url('rp-games')) ?>">
            <input type="hidden" name="csrf" value="<?= e($rp_games_csrf) ?>">
            <input type="hidden" name="action" value="self_exclude">
            <label class="store-field">
              <span>Exclusion period</span>
              <select name="exclusion_period" required autocomplete="off">
                <?php foreach ($self_exclusion_periods as $period_key => $period) : ?>
                  <option value="<?= e((string) $period_key) ?>" <?= $period_key === '7_days' ? 'selected' : '' ?>><?= e((string) ($period['label'] ?? $period_key)) ?></option>
                <?php endforeach; ?>
              </select>
            </label>
            <label class="rp-self-exclusion-confirm">
              <input type="checkbox" name="confirm_self_exclusion" value="1" required>
              <span>I understand this starts immediately and I cannot cancel or shorten it from my account.</span>
            </label>
            <button class="btn btn-primary" type="submit">Start self-exclusion</button>
          </form>
        <?php endif; ?>
      </aside>
    <?php endif; ?>

    <div class="profile-stat-grid rp-games-stat-grid">
      <article class="stat-tile">
        <span>Spendable RP</span>
        <strong data-rp-stat="balance"><?= e(raidlands_store_rp((int) ($games_balance['reward_points'] ?? 0))) ?></strong>
      </article>
      <article class="stat-tile">
        <span>Daily Wagered</span>
        <strong data-rp-stat="wagered"><?= e(raidlands_store_rp((int) ($daily['wagered_rp'] ?? 0))) ?></strong>
      </article>
      <article class="stat-tile">
        <span>Daily Loss</span>
        <strong data-rp-stat="loss"><?= e(raidlands_store_rp((int) ($daily['loss_rp'] ?? 0))) ?></strong>
      </article>
      <article class="stat-tile">
        <span>Stake Range</span>
        <strong><?= e(raidlands_store_rp($min_stake)) ?>-<?= e(raidlands_store_rp($max_stake)) ?></strong>
      </article>
    </div>

    <aside
      class="rp-sync-guide <?= $sync_pending_count > 0 ? 'is-waiting' : 'is-ready' ?>"
      data-rp-sync-guide
      data-state-url="<?= e(route_url('rp-games') . '?action=state') ?>"
      data-poll-seconds="<?= e((string) $sync_poll_seconds) ?>"
      data-next-check-at="<?= e($sync_next_check_at) ?>"
      data-pending-count="<?= e((string) $sync_pending_count) ?>"
      aria-live="polite">
      <div class="rp-sync-guide-main">
        <span class="rp-sync-signal" aria-hidden="true"><i></i></span>
        <div>
          <p class="section-kicker">RP transaction status</p>
          <h2 data-rp-sync-title><?= $sync_pending_count > 0 ? 'Your game is saved' : 'Ready for your next game' ?></h2>
          <p data-rp-sync-message>
            <?php if ($sync_pending_count > 0) : ?>
              Nothing failed. The game server is applying <?= e((string) $sync_pending_count) ?> RP change<?= $sync_pending_count === 1 ? '' : 's' ?>, and this page will update itself.
            <?php else : ?>
              No RP changes are waiting. After you play, your result is saved first, then the game server updates your RP during its next sync cycle.
            <?php endif; ?>
          </p>
        </div>
      </div>

      <div class="rp-sync-countdown" data-rp-sync-countdown-wrap <?= $sync_pending_count > 0 ? '' : 'hidden' ?>>
        <span>Next automatic check</span>
        <strong data-rp-sync-countdown><?= e($sync_countdown_label) ?></strong>
        <small>Keep this page open. You do not need to play again or refresh.</small>
      </div>

      <ol class="rp-sync-steps" aria-label="RP update steps">
        <li data-rp-sync-step="saved" class="<?= $sync_pending_count > 0 ? 'is-complete' : '' ?>">
          <span>1</span><div><strong>Game saved</strong><small>Your result is safely recorded on the website.</small></div>
        </li>
        <li data-rp-sync-step="server" class="<?= $sync_pending_count > 0 ? 'is-active' : '' ?>">
          <span>2</span><div><strong>Server updates RP</strong><small>This normally finishes within about a minute.</small></div>
        </li>
        <li data-rp-sync-step="balance">
          <span>3</span><div><strong>Balance refreshes</strong><small>The spendable RP number and activity status update automatically.</small></div>
        </li>
      </ol>

      <button class="btn btn-secondary btn-small rp-sync-check" type="button" data-rp-sync-check>Check now</button>
    </aside>

    <div class="rp-games-workspace">
      <div class="rp-game-picker">
        <div class="rp-game-picker-heading">
          <div>
            <p class="section-kicker">Game library</p>
            <h2>Choose a game</h2>
          </div>
          <span class="rp-game-count"><?= e((string) count($rp_game_tabs)) ?> games</span>
        </div>
        <nav class="rp-game-nav" aria-label="RP game navigation" role="tablist">
        <?php foreach ($rp_game_tabs as $index => $tab) : ?>
          <?php
            $tab_key = (string) $tab['key'];
            $selected = $index === 0;
            $status_label = !$tab['ready'] ? 'Staged' : ($tab['enabled'] ? 'Live' : 'Paused');
            $status_class = !$tab['ready'] ? 'planned' : ($tab['enabled'] ? 'active' : 'pending');
          ?>
          <a
            class="rp-game-tab<?= $selected ? ' is-active' : '' ?><?= !$tab['ready'] ? ' needs-update' : '' ?>"
            href="#<?= e($tab_key) ?>"
            id="rp-tab-<?= e($tab_key) ?>"
            role="tab"
            aria-selected="<?= $selected ? 'true' : 'false' ?>"
            aria-controls="rp-panel-<?= e($tab_key) ?>"
            data-rp-game-tab="<?= e($tab_key) ?>">
            <?= render_feature_symbol((string) $tab['icon']) ?>
            <span>
              <strong><?= e((string) $tab['label']) ?></strong>
              <small><?= e((string) $tab['meta']) ?></small>
            </span>
            <em class="status-pill <?= e($status_class) ?>"><?= e($status_label) ?></em>
          </a>
        <?php endforeach; ?>
        </nav>
      </div>

      <div class="rp-sync-playing" data-rp-sync-playing <?= $sync_pending_count > 0 ? '' : 'hidden' ?> aria-live="polite">
        <span class="rp-sync-playing-dot" aria-hidden="true"></span>
        <span><strong>RP update pending</strong><small>Next real status check in</small></span>
        <b data-rp-sync-countdown><?= e($sync_countdown_label) ?></b>
        <button type="button" data-rp-sync-check>Check now</button>
      </div>

      <div class="rp-game-stage">
        <article class="metal-panel rp-game-panel is-active" id="rp-panel-coinflip" role="tabpanel" aria-labelledby="rp-tab-coinflip" data-rp-game-panel="coinflip">
          <div class="rp-game-panel-grid">
            <div>
              <p class="section-kicker">50% odds</p>
              <h2>Coinflip</h2>
              <p class="section-lede">Pick heads or tails. Wins pay <?= e(number_format(((int) ($settings['coinflip_payout_multiplier_basis'] ?? 200)) / 100, 2)) ?>x gross before server confirmation.</p>
              <div class="rp-game-machine coin-machine" aria-hidden="true">
                <span class="coin-strip" data-rp-coin-strip></span>
              </div>
            </div>
            <form class="feedback-form rp-game-form" method="post" action="<?= e(route_url('rp-games')) ?>" data-rp-game-form="coinflip">
              <input type="hidden" name="csrf" value="<?= e($rp_games_csrf) ?>">
              <input type="hidden" name="action" value="play_coinflip">
              <label class="store-field">
                <span>Stake</span>
                <input type="number" name="stake_rp" min="<?= e((string) $min_stake) ?>" max="<?= e((string) $max_stake) ?>" step="1" value="<?= e((string) $min_stake) ?>" <?= $can_play && !empty($settings['coinflip_enabled']) ? '' : 'disabled' ?>>
              </label>
              <label class="store-field">
                <span>Side</span>
                <select name="choice" <?= $can_play && !empty($settings['coinflip_enabled']) ? '' : 'disabled' ?>>
                  <option value="heads">Heads</option>
                  <option value="tails">Tails</option>
                </select>
              </label>
              <button class="btn btn-primary" type="submit" <?= $can_play && !empty($settings['coinflip_enabled']) ? '' : 'disabled' ?>>Flip</button>
            </form>
          </div>
        </article>

        <article class="metal-panel rp-game-panel" id="rp-panel-dice" role="tabpanel" aria-labelledby="rp-tab-dice" data-rp-game-panel="dice" hidden>
          <div class="rp-game-panel-grid">
            <div>
              <p class="section-kicker">D6 / <?= e((string) $dice_chance) ?>% win chance</p>
              <h2>Dice</h2>
              <p class="section-lede">Roll <?= e($dice_roll_label) ?> on a six-sided die. Wins pay <?= e(number_format(((int) ($settings['dice_payout_multiplier_basis'] ?? 200)) / 100, 2)) ?>x gross before server confirmation.</p>
              <div class="rp-game-machine dice-machine" aria-hidden="true">
                <span class="dice-strip" data-rp-dice-strip></span>
              </div>
            </div>
            <form class="feedback-form rp-game-form" method="post" action="<?= e(route_url('rp-games')) ?>" data-rp-game-form="dice">
              <input type="hidden" name="csrf" value="<?= e($rp_games_csrf) ?>">
              <input type="hidden" name="action" value="play_dice">
              <label class="store-field">
                <span>Stake</span>
                <input type="number" name="stake_rp" min="<?= e((string) $min_stake) ?>" max="<?= e((string) $max_stake) ?>" step="1" value="<?= e((string) $min_stake) ?>" <?= $can_play && !empty($settings['dice_enabled']) ? '' : 'disabled' ?>>
              </label>
              <button class="btn btn-primary" type="submit" <?= $can_play && !empty($settings['dice_enabled']) ? '' : 'disabled' ?>>Roll Dice</button>
            </form>
          </div>
        </article>

        <article class="metal-panel rp-game-panel" id="rp-panel-jackpot" role="tabpanel" aria-labelledby="rp-tab-jackpot" data-rp-game-panel="jackpot" hidden>
          <div class="rp-game-panel-grid">
            <div>
              <p class="section-kicker">Shared RP pot</p>
              <h2>Jackpot</h2>
              <?php if ($active_jackpot === null) : ?>
                <p class="section-lede">No jackpot round is open right now.</p>
              <?php else : ?>
                <p class="section-lede">Buy tickets into the current shared pot. Confirmed entries decide the winner when the round closes.</p>
                <div class="feature-score-grid rp-jackpot-score">
                  <span><strong data-rp-jackpot="ticket"><?= e(raidlands_store_rp((int) ($active_jackpot['ticket_cost_rp'] ?? 0))) ?></strong> Ticket</span>
                  <span><strong data-rp-jackpot="entries"><?= e((string) ($active_jackpot['total_entries'] ?? 0)) ?></strong> Tickets</span>
                  <span><strong data-rp-jackpot="pot"><?= e(raidlands_store_rp((int) ($active_jackpot['pot_rp'] ?? 0))) ?></strong> Pot</span>
                </div>
                <p class="store-muted" data-rp-jackpot="closes">Closes <?= e((string) ($active_jackpot['closes_at'] ?? '')) ?> UTC. Only confirmed entries count.</p>
              <?php endif; ?>
              <div class="rp-game-machine jackpot-machine" aria-hidden="true">
                <span></span><span></span><span></span>
              </div>
            </div>
            <?php if ($active_jackpot !== null) : ?>
              <form class="feedback-form rp-game-form" method="post" action="<?= e(route_url('rp-games')) ?>" data-rp-game-form="jackpot">
                <input type="hidden" name="csrf" value="<?= e($rp_games_csrf) ?>">
                <input type="hidden" name="action" value="enter_jackpot">
                <label class="store-field">
                  <span>Tickets</span>
                  <input type="number" name="tickets" min="1" max="<?= e((string) ($active_jackpot['max_entries_per_player'] ?? 10)) ?>" step="1" value="1" <?= $can_play && !empty($settings['jackpot_enabled']) ? '' : 'disabled' ?>>
                </label>
                <button class="btn btn-primary" type="submit" <?= $can_play && !empty($settings['jackpot_enabled']) ? '' : 'disabled' ?>>Enter Jackpot</button>
              </form>
            <?php else : ?>
              <div class="form-status warning">Jackpot entries are waiting for the next open round.</div>
            <?php endif; ?>
          </div>
        </article>

        <article class="metal-panel rp-game-panel" id="rp-panel-raid-duel" role="tabpanel" aria-labelledby="rp-tab-raid-duel" data-rp-game-panel="raid-duel" data-rp-pool-game="raid_duel" hidden>
          <?php
            $raid_duel_breakdown = (array) ($raid_duel_round['breakdown'] ?? []);
            $raid_duel_entries = (array) ($raid_duel_round['entries'] ?? []);
          ?>
          <div class="rp-game-panel-grid">
            <div>
              <p class="section-kicker">PvP side pool</p>
              <h2>Raid Duel</h2>
              <p class="section-lede">Back raiders or defenders before the round closes. Visible entries show on the board, and the winning side splits confirmed stake after house edge.</p>
              <div class="rp-game-machine rp-pool-machine raid-duel-machine" aria-hidden="true">
                <?php foreach ($raid_duel_options as $option_key => $option) : ?>
                  <span><?= e((string) ($option['label'] ?? ucwords(str_replace('_', ' ', (string) $option_key)))) ?></span>
                <?php endforeach; ?>
              </div>
              <?php if (!$raid_duel_backend) : ?>
                <div class="form-status warning">Raid Duel is staged. Run <code>database/migrations/040_multiplayer_rp_games.sql</code> before enabling it.</div>
              <?php endif; ?>
            </div>
            <form class="feedback-form rp-game-form" method="post" action="<?= e(route_url('rp-games')) ?>" data-rp-game-form="raid-duel">
              <input type="hidden" name="csrf" value="<?= e($rp_games_csrf) ?>">
              <input type="hidden" name="action" value="enter_raid_duel">
              <label class="store-field">
                <span>Stake</span>
                <input type="number" name="stake_rp" min="<?= e((string) $min_stake) ?>" max="<?= e((string) $max_stake) ?>" step="1" value="<?= e((string) $min_stake) ?>" <?= $can_play && $raid_duel_enabled && $raid_duel_round !== null ? '' : 'disabled' ?>>
              </label>
              <label class="store-field">
                <span>Side</span>
                <select name="choice" <?= $can_play && $raid_duel_enabled && $raid_duel_round !== null ? '' : 'disabled' ?>>
                  <?php foreach ($raid_duel_options as $option_key => $option) : ?>
                    <option value="<?= e((string) $option_key) ?>"><?= e((string) ($option['label'] ?? ucwords(str_replace('_', ' ', (string) $option_key)))) ?></option>
                  <?php endforeach; ?>
                </select>
              </label>
              <button class="btn btn-primary" type="submit" <?= $can_play && $raid_duel_enabled && $raid_duel_round !== null ? '' : 'disabled' ?>>Join Duel</button>
            </form>
          </div>

          <div class="rp-pool-board" data-rp-pool-board="raid_duel">
            <div class="rp-pool-board-head">
              <strong data-rp-pool-total="raid_duel"><?= e(raidlands_store_rp((int) ($raid_duel_round['total_stake_rp'] ?? 0))) ?></strong>
              <span data-rp-pool-closes="raid_duel"><?= $raid_duel_round !== null ? 'Closes ' . e((string) ($raid_duel_round['closes_at'] ?? '')) . ' UTC' : 'Waiting for the next open round' ?></span>
            </div>
            <div class="rp-pool-options" data-rp-pool-options="raid_duel">
              <?php foreach ($raid_duel_breakdown as $row) : ?>
                <div class="rp-pool-option" data-rp-pool-option="<?= e((string) ($row['key'] ?? '')) ?>">
                  <span>
                    <strong><?= e((string) ($row['label'] ?? 'Option')) ?></strong>
                    <small><?= e((string) ($row['chance'] ?? 0)) ?>% roll chance</small>
                  </span>
                  <em><?= e(raidlands_store_rp((int) ($row['stake_rp'] ?? 0))) ?></em>
                  <i style="--pool-share: <?= e((string) min(100, max(0, (float) ($row['percent'] ?? 0)))) ?>%"></i>
                </div>
              <?php endforeach; ?>
            </div>
            <div class="rp-pool-feed">
              <strong>Recent entries</strong>
              <div class="rp-pool-feed-list" data-rp-pool-feed-list="raid_duel">
                <?php if ($raid_duel_entries !== []) : ?>
                  <?php foreach ($raid_duel_entries as $entry) : ?>
                    <span class="rp-pool-feed-row">
                      <strong><?= e((string) ($entry['player_label'] ?? 'Raidlands Player')) ?></strong>
                      <em><?= e((string) ($entry['option_label'] ?? 'Side')) ?></em>
                      <small><?= e(raidlands_store_rp((int) ($entry['stake_rp'] ?? 0))) ?></small>
                    </span>
                  <?php endforeach; ?>
                <?php else : ?>
                  <p class="store-muted">No visible entries in this round yet.</p>
                <?php endif; ?>
              </div>
            </div>
          </div>
        </article>

        <article class="metal-panel rp-game-panel" id="rp-panel-supply-run" role="tabpanel" aria-labelledby="rp-tab-supply-run" data-rp-game-panel="supply-run" data-rp-pool-game="supply_run" hidden>
          <?php
            $supply_run_breakdown = (array) ($supply_run_round['breakdown'] ?? []);
            $supply_run_entries = (array) ($supply_run_round['entries'] ?? []);
          ?>
          <div class="rp-game-panel-grid">
            <div>
              <p class="section-kicker">PvE route pool</p>
              <h2>Supply Run</h2>
              <p class="section-lede">Pick the route the convoy survives. Safer routes roll more often, riskier routes can pay harder when fewer players crowd them.</p>
              <div class="rp-game-machine rp-pool-machine supply-run-machine" aria-hidden="true">
                <?php foreach ($supply_run_options as $option_key => $option) : ?>
                  <span><?= e((string) ($option['label'] ?? ucwords(str_replace('_', ' ', (string) $option_key)))) ?></span>
                <?php endforeach; ?>
              </div>
              <?php if (!$supply_run_backend) : ?>
                <div class="form-status warning">Supply Run is staged. Run <code>database/migrations/040_multiplayer_rp_games.sql</code> before enabling it.</div>
              <?php endif; ?>
            </div>
            <form class="feedback-form rp-game-form" method="post" action="<?= e(route_url('rp-games')) ?>" data-rp-game-form="supply-run">
              <input type="hidden" name="csrf" value="<?= e($rp_games_csrf) ?>">
              <input type="hidden" name="action" value="enter_supply_run">
              <label class="store-field">
                <span>Stake</span>
                <input type="number" name="stake_rp" min="<?= e((string) $min_stake) ?>" max="<?= e((string) $max_stake) ?>" step="1" value="<?= e((string) $min_stake) ?>" <?= $can_play && $supply_run_enabled && $supply_run_round !== null ? '' : 'disabled' ?>>
              </label>
              <label class="store-field">
                <span>Route</span>
                <select name="choice" <?= $can_play && $supply_run_enabled && $supply_run_round !== null ? '' : 'disabled' ?>>
                  <?php foreach ($supply_run_options as $option_key => $option) : ?>
                    <option value="<?= e((string) $option_key) ?>"><?= e((string) ($option['label'] ?? ucwords(str_replace('_', ' ', (string) $option_key)))) ?> - <?= e((string) ($option['chance'] ?? 0)) ?>%</option>
                  <?php endforeach; ?>
                </select>
              </label>
              <button class="btn btn-primary" type="submit" <?= $can_play && $supply_run_enabled && $supply_run_round !== null ? '' : 'disabled' ?>>Back Route</button>
            </form>
          </div>

          <div class="rp-pool-board" data-rp-pool-board="supply_run">
            <div class="rp-pool-board-head">
              <strong data-rp-pool-total="supply_run"><?= e(raidlands_store_rp((int) ($supply_run_round['total_stake_rp'] ?? 0))) ?></strong>
              <span data-rp-pool-closes="supply_run"><?= $supply_run_round !== null ? 'Closes ' . e((string) ($supply_run_round['closes_at'] ?? '')) . ' UTC' : 'Waiting for the next open round' ?></span>
            </div>
            <div class="rp-pool-options" data-rp-pool-options="supply_run">
              <?php foreach ($supply_run_breakdown as $row) : ?>
                <div class="rp-pool-option" data-rp-pool-option="<?= e((string) ($row['key'] ?? '')) ?>">
                  <span>
                    <strong><?= e((string) ($row['label'] ?? 'Option')) ?></strong>
                    <small><?= e((string) ($row['chance'] ?? 0)) ?>% roll chance</small>
                  </span>
                  <em><?= e(raidlands_store_rp((int) ($row['stake_rp'] ?? 0))) ?></em>
                  <i style="--pool-share: <?= e((string) min(100, max(0, (float) ($row['percent'] ?? 0)))) ?>%"></i>
                </div>
              <?php endforeach; ?>
            </div>
            <div class="rp-pool-feed">
              <strong>Recent entries</strong>
              <div class="rp-pool-feed-list" data-rp-pool-feed-list="supply_run">
                <?php if ($supply_run_entries !== []) : ?>
                  <?php foreach ($supply_run_entries as $entry) : ?>
                    <span class="rp-pool-feed-row">
                      <strong><?= e((string) ($entry['player_label'] ?? 'Raidlands Player')) ?></strong>
                      <em><?= e((string) ($entry['option_label'] ?? 'Route')) ?></em>
                      <small><?= e(raidlands_store_rp((int) ($entry['stake_rp'] ?? 0))) ?></small>
                    </span>
                  <?php endforeach; ?>
                <?php else : ?>
                  <p class="store-muted">No visible entries in this round yet.</p>
                <?php endif; ?>
              </div>
            </div>
          </div>
        </article>

        <article class="metal-panel rp-game-panel monument-extraction-panel" id="rp-panel-monument-extraction" role="tabpanel" aria-labelledby="rp-tab-monument-extraction" data-rp-game-panel="monument-extraction" hidden>
          <div
            class="monument-extraction-app"
            data-monument-extraction
            data-api-url="<?= e($monument_api_url) ?>"
            data-csrf="<?= e($rp_games_csrf) ?>"
            data-enabled="<?= $can_play && $monument_enabled ? '1' : '0' ?>">
            <script type="application/json" data-monument-bootstrap><?= json_encode($monument_state, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?></script>

            <div class="monument-extraction-hero">
              <picture aria-hidden="true">
                <source srcset="<?= e(asset_url('media/rp-games/monument-extraction-hero.webp')) ?>" type="image/webp">
                <img src="<?= e(asset_url('media/rp-games/monument-extraction-hero.png')) ?>" alt="" loading="lazy" decoding="async">
              </picture>
              <div class="monument-extraction-hero-copy">
                <p class="section-kicker">Tactical RP run</p>
                <h2>Monument Extraction</h2>
                <p>Choose a loadout, push through a branching monument, secure wager-relative loot, and survive the route out to bank it.</p>
                <div class="tag-row">
                  <span class="tag">Server-authoritative</span>
                  <span class="tag">3-7 minutes</span>
                  <span class="tag">Provably reproducible</span>
                </div>
              </div>
            </div>

            <div class="form-status warning" data-monument-status <?= $monument_ready && $monument_enabled ? 'hidden' : '' ?>>
              <?php if (!$monument_ready) : ?>
                <?= e((string) ($monument_state['message'] ?? raidlands_monument_readiness_message())) ?>
              <?php elseif (!$monument_enabled) : ?>
                Monument Extraction is installed but disabled until admins review simulation results and enable it.
              <?php endif; ?>
            </div>

            <section class="monument-landing" data-monument-landing>
              <div class="monument-landing-copy">
                <p class="section-kicker">Plan the raid</p>
                <h3>Wager once. Extract to get paid.</h3>
                <p class="store-muted">Your wager debit must be confirmed by the Rust server before the run opens. Loot is unsecured until an extraction succeeds; death, abandonment, and expiry return nothing.</p>
              </div>

              <form class="monument-start-form" data-monument-start-form>
                <fieldset class="monument-loadouts">
                  <legend>Choose a loadout</legend>
                  <?php foreach ($monument_loadouts as $loadout_key => $loadout) : ?>
                    <label class="monument-loadout-card">
                      <input type="radio" name="loadout_key" value="<?= e((string) $loadout_key) ?>" <?= $loadout_key === 'scout' ? 'checked' : '' ?> <?= $can_play && $monument_enabled ? '' : 'disabled' ?>>
                      <span>
                        <strong><?= e((string) ($loadout['label'] ?? ucwords((string) $loadout_key))) ?></strong>
                        <small><?= e((string) ($loadout['description'] ?? '')) ?></small>
                        <?php $loadout_meds = (int) ($loadout['syringes'] ?? 0); ?>
                        <em><?= e((string) ($loadout['ammo'] ?? 0)) ?> ammo / <?= e((string) $loadout_meds) ?> med<?= $loadout_meds === 1 ? '' : 's' ?> / <?= e((string) ($loadout['slots'] ?? 0)) ?> slots</em>
                      </span>
                    </label>
                  <?php endforeach; ?>
                </fieldset>

                <div class="monument-start-controls">
                  <label class="store-field">
                    <span>Wager RP</span>
                    <input type="number" name="wager_rp" min="<?= e((string) ($monument_config['minWagerRp'] ?? 100)) ?>" max="<?= e((string) ($monument_config['maxWagerRp'] ?? 10000)) ?>" step="1" value="<?= e((string) ($monument_config['minWagerRp'] ?? 100)) ?>" <?= $can_play && $monument_enabled ? '' : 'disabled' ?>>
                  </label>
                  <button class="btn btn-primary" type="submit" <?= $can_play && $monument_enabled ? '' : 'disabled' ?>>Enter Monument</button>
                </div>
              </form>
            </section>

            <section class="monument-run" data-monument-run hidden aria-live="polite">
              <div class="monument-resource-strip" data-monument-resources></div>
              <div class="monument-run-grid">
                <aside class="monument-run-sidebar">
                  <div class="monument-sidebar-card" data-monument-readiness></div>
                  <div class="monument-sidebar-card">
                    <div class="monument-card-head"><strong>Carried inventory</strong><span data-monument-slots></span></div>
                    <div class="monument-inventory" data-monument-inventory></div>
                  </div>
                </aside>

                <div class="monument-run-main">
                  <div class="monument-map" data-monument-map aria-label="Branching monument map"></div>
                  <div class="monument-decision" data-monument-decision></div>
                </div>

                <aside class="monument-run-log">
                  <div class="monument-sidebar-card">
                    <div class="monument-card-head"><strong>Run log</strong><span data-monument-turn></span></div>
                    <ol data-monument-log></ol>
                  </div>
                </aside>
              </div>
            </section>

            <section class="monument-history-block">
              <div class="monument-card-head">
                <div>
                  <p class="section-kicker">Recovery and audit</p>
                  <h3>Recent extraction runs</h3>
                </div>
                <button class="btn btn-secondary btn-small" type="button" data-monument-refresh>Refresh</button>
              </div>
              <div class="monument-history" data-monument-history></div>
            </section>

            <details class="monument-rules">
              <summary>How Monument Extraction works</summary>
              <div class="monument-rules-grid">
                <p><strong>Route.</strong> Enter only connected rooms. You see danger and possible reward, never the hidden encounter roll.</p>
                <p><strong>Fight.</strong> Sneak, assault, rush, or retreat. Every success chance and resource cost comes from the server.</p>
                <p><strong>Pack.</strong> Utility and payout loot share slots. Replace carried items when a better find will not fit.</p>
                <p><strong>Extract.</strong> Main Gate, Sewer, and Rooftop have different prerequisites, odds, fees, and bonuses.</p>
              </div>
            </details>
          </div>
        </article>

        <article class="metal-panel rp-game-panel" id="rp-panel-blackjack" role="tabpanel" aria-labelledby="rp-tab-blackjack" data-rp-game-panel="blackjack" hidden>
          <div class="rp-game-panel-grid"><div><p class="section-kicker">Six decks / 3:2 natural</p><h2>Blackjack</h2><p class="section-lede">Beat the dealer without passing 21. The dealer stands on soft 17; unfinished hands auto-stand after ten minutes.</p>
            <div class="blackjack-table" data-blackjack-table data-hand='<?= e(json_encode($active_blackjack, JSON_UNESCAPED_SLASHES) ?: 'null') ?>' data-action-url="<?= e(route_url('rp-games')) ?>" data-csrf="<?= e($rp_games_csrf) ?>" data-min-stake="<?= $min_stake ?>" data-max-stake="<?= $max_stake ?>" data-enabled="<?= $can_play&&$blackjack_enabled?'1':'0' ?>"><small>Dealer</small><div class="blackjack-cards" data-blackjack-dealer></div><strong data-blackjack-dealer-total></strong><small>Your hand</small><div class="blackjack-cards" data-blackjack-player></div><strong data-blackjack-player-total></strong><p data-blackjack-message><?= e((string)($active_blackjack['message']??'Start a hand after the Rust server confirms your wager.')) ?></p></div>
            <?php if(!$blackjack_backend): ?><div class="form-status warning">Run migration 063 to unlock Blackjack.</div><?php endif; ?></div><div data-blackjack-controls>
            <?php if($active_blackjack===null): ?><form class="feedback-form rp-game-form" method="post" action="<?= e(route_url('rp-games')) ?>" data-rp-game-form="blackjack"><input type="hidden" name="csrf" value="<?= e($rp_games_csrf) ?>"><input type="hidden" name="action" value="start_blackjack"><label class="store-field"><span>Stake (even RP)</span><input type="number" name="stake_rp" min="<?= $min_stake ?>" max="<?= $max_stake ?>" step="2" value="<?= $min_stake+($min_stake%2) ?>" <?= $can_play&&$blackjack_enabled?'':'disabled' ?>></label><button class="btn btn-primary" type="submit" <?= $can_play&&$blackjack_enabled?'':'disabled' ?>>Deal Blackjack</button></form>
            <?php else: ?><form class="feedback-form rp-game-form" method="post" action="<?= e(route_url('rp-games')) ?>" data-rp-game-form="blackjack"><input type="hidden" name="csrf" value="<?= e($rp_games_csrf) ?>"><input type="hidden" name="hand_id" value="<?= e((string)$active_blackjack['id']) ?>"><input type="hidden" name="action_version" value="<?= e((string)$active_blackjack['action_version']) ?>"><div class="blackjack-actions"><button class="btn btn-secondary" name="action" value="blackjack_hit" type="submit" <?= !empty($active_blackjack['can_hit'])?'':'disabled' ?>>Hit</button><button class="btn btn-primary" name="action" value="blackjack_stand" type="submit" <?= !empty($active_blackjack['can_stand'])?'':'disabled' ?>>Stand</button><button class="btn btn-secondary" name="action" value="blackjack_double" type="submit" <?= !empty($active_blackjack['can_double'])?'':'disabled' ?>>Double</button></div></form><?php endif; ?></div></div>
        </article>

        <article class="metal-panel rp-game-panel" id="rp-panel-roulette" role="tabpanel" aria-labelledby="rp-tab-roulette" data-rp-game-panel="roulette" hidden>
          <div class="roulette-game-layout"><div><p class="section-kicker">European single-zero</p><h2>Roulette</h2><p class="section-lede">Choose a chip and inside bet mode, then tap the table. Outside bets include red/black, odd/even, high/low, dozens, and columns.</p><div class="roulette-wheel"><strong data-rp-roulette-result>0</strong></div><canvas class="roulette-table-canvas" data-roulette-canvas width="960" height="420" aria-label="Interactive European roulette betting table"></canvas><p class="roulette-board-help" data-roulette-help>Tap any number to place a straight-up bet.</p><div class="roulette-outside-bets" aria-label="Outside roulette bets"><?php foreach(['low'=>'1–18','even'=>'Even','red'=>'Red','black'=>'Black','odd'=>'Odd','high'=>'19–36','dozen_1'=>'1st 12','dozen_2'=>'2nd 12','dozen_3'=>'3rd 12','column_1'=>'Column 1','column_2'=>'Column 2','column_3'=>'Column 3'] as $key=>$label): ?><button type="button" data-roulette-outside="<?= e($key) ?>" class="roulette-outside <?= e($key) ?>"><?= e($label) ?></button><?php endforeach; ?></div><?php if(!$roulette_backend): ?><div class="form-status warning">Run migration 063 to unlock Roulette.</div><?php endif; ?></div>
            <form class="feedback-form rp-game-form roulette-bet-builder" method="post" action="<?= e(route_url('rp-games')) ?>" data-rp-game-form="roulette"><input type="hidden" name="csrf" value="<?= e($rp_games_csrf) ?>"><input type="hidden" name="action" value="play_roulette"><input type="hidden" name="bets_json" value="[]" data-roulette-bets-json><label class="store-field"><span>Inside bet mode</span><select data-roulette-type><option value="straight">Straight (35:1)</option><option value="split">Split (17:1)</option><option value="street">Street / zero trio (11:1)</option><option value="corner">Corner (8:1)</option><option value="six_line">Six-line (5:1)</option></select></label><fieldset class="roulette-chip-picker"><legend>Chip value</legend><?php foreach([10,25,50,100,250,500] as $chip): ?><button type="button" data-roulette-chip="<?= $chip ?>" class="roulette-chip<?= $chip===50?' is-selected':'' ?>"><?= $chip ?></button><?php endforeach; ?></fieldset><div class="roulette-bet-slip" data-roulette-slip><p>No bets placed.</p></div><strong>Total: <span data-roulette-total>0 RP</span></strong><button class="btn btn-secondary" type="button" data-roulette-clear>Clear Table</button><button class="btn btn-primary" type="submit" <?= $can_play&&$roulette_enabled?'':'disabled' ?>>Spin Roulette</button></form>
          </div>
        </article>

        <article class="metal-panel rp-game-panel" id="rp-panel-slots" role="tabpanel" aria-labelledby="rp-tab-slots" data-rp-game-panel="slots" hidden>
          <div class="rp-game-panel-grid"><div><p class="section-kicker">Five reels / ten fixed lines</p><h2>Raidlands Slots</h2><p class="section-lede">Every spin plays ten equal paylines. Match three or more symbols from the leftmost reel. Awards are capped at <?= raidlands_casino_slot_max_total_multiplier() ?>x your total stake.</p><div class="casino-slot-grid" data-rp-slot-grid><?php for($i=0;$i<15;$i++): ?><span>?</span><?php endfor; ?></div><details><summary>Paytable</summary><p class="form-help">Listed multipliers apply to one payline's one-tenth share of the total stake.</p><div class="rp-wheel-odds"><?php foreach(raidlands_casino_slot_config((string)($settings['casino_rtp_preset']??'balanced'))['symbols'] as $symbol): if($symbol['pays']): ?><span><strong><?= e($symbol['label']) ?></strong><?php foreach($symbol['pays'] as $count=>$pay): ?> <?= $count ?>×: <?= $pay ?>x<?php endforeach; ?></span><?php endif; endforeach; ?></div></details><?php if(!$slots_backend): ?><div class="form-status warning">Run migration 063 to unlock Slots.</div><?php endif; ?></div><form class="feedback-form rp-game-form" method="post" action="<?= e(route_url('rp-games')) ?>" data-rp-game-form="slots"><input type="hidden" name="csrf" value="<?= e($rp_games_csrf) ?>"><input type="hidden" name="action" value="play_slots"><label class="store-field"><span>Total stake (multiple of 10)</span><input type="number" name="stake_rp" min="<?= $min_stake ?>" max="<?= $max_stake ?>" step="10" value="<?= intdiv($min_stake+9,10)*10 ?>" <?= $can_play&&$slots_enabled?'':'disabled' ?>></label><button class="btn btn-primary" type="submit" <?= $can_play&&$slots_enabled?'':'disabled' ?>>Spin Reels</button></form></div>
        </article>

        <article class="metal-panel rp-game-panel" id="rp-panel-high-low" role="tabpanel" aria-labelledby="rp-tab-high-low" data-rp-game-panel="high-low" hidden>
          <div class="rp-game-panel-grid">
            <div>
              <p class="section-kicker">Call the range</p>
              <h2>High-Low</h2>
              <p class="section-lede">Call low for 1-45 or high for 56-100. Rolls 46-55 push and queue your stake back for server confirmation.</p>
              <div class="rp-game-machine high-low-machine" aria-hidden="true">
                <span data-rp-high-low-marker="low">LOW</span>
                <strong data-rp-high-low-roll>46-55</strong>
                <span data-rp-high-low-marker="high">HIGH</span>
              </div>
              <?php if (!$high_low_backend) : ?>
                <div class="form-status warning">High-Low is staged and will unlock after the next RP games update.</div>
              <?php endif; ?>
            </div>
            <form class="feedback-form rp-game-form" method="post" action="<?= e(route_url('rp-games')) ?>" data-rp-game-form="high-low">
              <input type="hidden" name="csrf" value="<?= e($rp_games_csrf) ?>">
              <input type="hidden" name="action" value="play_high_low">
              <label class="store-field">
                <span>Stake</span>
                <input type="number" name="stake_rp" min="<?= e((string) $min_stake) ?>" max="<?= e((string) $max_stake) ?>" step="1" value="<?= e((string) $min_stake) ?>" <?= $can_play && $high_low_enabled ? '' : 'disabled' ?>>
              </label>
              <label class="store-field">
                <span>Call</span>
                <select name="choice" <?= $can_play && $high_low_enabled ? '' : 'disabled' ?>>
                  <option value="low">Low: 1-45</option>
                  <option value="high">High: 56-100</option>
                </select>
              </label>
              <button class="btn btn-primary" type="submit" <?= $can_play && $high_low_enabled ? '' : 'disabled' ?>>Call It</button>
            </form>
          </div>
        </article>

        <article class="metal-panel rp-game-panel" id="rp-panel-wheel" role="tabpanel" aria-labelledby="rp-tab-wheel" data-rp-game-panel="wheel" hidden>
          <div class="rp-game-panel-grid">
            <div>
              <p class="section-kicker">Segment odds</p>
              <h2>Wheel</h2>
              <p class="section-lede">Pick a segment before the wheel spins. Smaller slices pay harder, and every result waits for live RP confirmation.</p>
              <div class="rp-game-machine wheel-machine" aria-hidden="true">
                <span data-rp-wheel></span>
              </div>
              <?php if ($wheel_segments !== []) : ?>
                <div class="rp-wheel-odds">
                  <?php foreach ($wheel_segments as $segment_key => $segment) : ?>
                    <span class="rp-wheel-odd <?= e((string) $segment_key) ?>">
                      <strong><?= e((string) $segment['label']) ?></strong>
                      <?= e((string) $segment['chance']) ?>% / <?= e(number_format(((int) $segment['multiplier_basis']) / 100, 2)) ?>x
                    </span>
                  <?php endforeach; ?>
                </div>
              <?php endif; ?>
              <?php if (!$wheel_backend) : ?>
                <div class="form-status warning">Wheel is staged and will unlock after the next RP games update.</div>
              <?php endif; ?>
            </div>
            <form class="feedback-form rp-game-form" method="post" action="<?= e(route_url('rp-games')) ?>" data-rp-game-form="wheel">
              <input type="hidden" name="csrf" value="<?= e($rp_games_csrf) ?>">
              <input type="hidden" name="action" value="play_wheel">
              <label class="store-field">
                <span>Stake</span>
                <input type="number" name="stake_rp" min="<?= e((string) $min_stake) ?>" max="<?= e((string) $max_stake) ?>" step="1" value="<?= e((string) $min_stake) ?>" <?= $can_play && $wheel_enabled ? '' : 'disabled' ?>>
              </label>
              <label class="store-field">
                <span>Segment</span>
                <select name="choice" <?= $can_play && $wheel_enabled ? '' : 'disabled' ?>>
                  <?php foreach ($wheel_segments as $segment_key => $segment) : ?>
                    <option value="<?= e((string) $segment_key) ?>"><?= e((string) $segment['label']) ?> - <?= e((string) $segment['chance']) ?>%</option>
                  <?php endforeach; ?>
                </select>
              </label>
              <button class="btn btn-primary" type="submit" <?= $can_play && $wheel_enabled ? '' : 'disabled' ?>>Spin Wheel</button>
            </form>
          </div>
        </article>
      </div>
    </div>
  </div>
</section>

<script src="<?= e(asset_url('js/monument-extraction.js')) ?>" defer></script>

<section class="section rp-champions-section">
  <div class="section-inner">
    <div class="section-header section-header-actions">
      <div>
        <p class="section-kicker">Casino champions</p>
        <h2>RP Games leaderboard</h2>
        <p class="section-lede">Gross RP payouts count only after the game server confirms them.</p>
      </div>
      <a class="btn btn-secondary" href="<?= e(route_url('leaderboard') . '?board=rp-games&scope=' . rawurlencode($rp_leaderboard_scope) . '&metric=total-won') ?>">Full Leaderboard</a>
    </div>
    <div class="leaderboard-tabs" aria-label="RP Games leaderboard scope">
      <a class="<?= $rp_leaderboard_scope === 'current' ? 'is-active' : '' ?>" href="<?= e(route_url('rp-games') . '?leaderboard_scope=current#rp-champions') ?>">Current Wipe</a>
      <a class="<?= $rp_leaderboard_scope === 'all-time' ? 'is-active' : '' ?>" href="<?= e(route_url('rp-games') . '?leaderboard_scope=all-time#rp-champions') ?>">All Time</a>
    </div>
    <div id="rp-champions" class="store-table-wrap leaderboard-table-wrap"<?= $rp_leaders === [] ? ' hidden' : '' ?>>
      <table class="store-table leaderboard-table">
        <thead><tr><th>Rank</th><th>Player</th><th>Total RP Won</th><th>Wins</th><th>Games</th><th>Biggest Win</th></tr></thead>
        <tbody>
          <?php foreach ($rp_leaders as $row) : ?>
            <?php $rp_leader_name = (string) ($row['display_name'] ?: ($row['steam_display_name'] ?? 'Raidlands Player')); $rp_leader_profile = trim((string) ($row['steam_profile_url'] ?? '')); ?>
            <tr>
              <td><span class="leaderboard-rank">#<?= e((string) $row['rank']) ?></span></td>
              <td><div class="leaderboard-player"><?= render_steam_avatar((string) ($row['steam_avatar_url'] ?? ''), $rp_leader_profile, $rp_leader_name, 'steam-avatar-sm') ?><span class="leaderboard-player-copy"><strong><?= e($rp_leader_name) ?></strong><span class="leaderboard-steam"><?= e((string) $row['steam_id64']) ?></span></span></div></td>
              <td><strong><?= e(raidlands_store_rp((int) $row['total_rp_won'])) ?></strong></td>
              <td><?= e(number_format((int) $row['wins'])) ?></td>
              <td><?= e(number_format((int) $row['games_played'])) ?></td>
              <td><?= e(raidlands_store_rp((int) $row['biggest_win'])) ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
    <?php if ($rp_leaders === []) : ?><div class="form-status warning">No confirmed RP game payouts have been recorded for this view yet.</div><?php endif; ?>
  </div>
</section>

<section class="section alt">
  <div class="section-inner split-panel rp-games-info-grid">
    <article class="metal-panel">
      <p class="section-kicker">Guardrails</p>
      <h2>In-game RP only</h2>
      <p class="section-lede"><?= e((string) ($settings['terms_copy'] ?? 'RP games use in-game RP only.')) ?></p>
      <ul class="list-clean">
        <li>No cash value and no cash-out route.</li>
        <li>Point changes are pending until the game server confirms them.</li>
        <li>Admins can pause individual backed games or all RP games.</li>
      </ul>
    </article>

    <article class="metal-panel">
      <p class="section-kicker">Round flow</p>
      <h2>Fast picks, clear results</h2>
      <p class="section-lede">Switch games, submit wagers, and watch recent activity update while server-confirmed RP changes finish in the background.</p>
      <div class="tag-row">
        <span class="tag">Server-confirmed</span>
        <span class="tag">Daily limits</span>
        <span class="tag">Linked Steam</span>
        <span class="tag">Multiplayer pools</span>
      </div>
    </article>
  </div>
</section>

<section class="section">
  <div class="section-inner" data-rp-games-history>
    <div class="section-header">
      <p class="section-kicker">History</p>
      <h2>Recent RP game activity</h2>
      <p class="section-lede">“Waiting on server” means your game is saved and the RP change is still being applied. This page checks again automatically.</p>
    </div>

    <div class="store-table-wrap" data-rp-rounds-table <?= $game_rounds !== [] ? '' : 'hidden' ?>>
      <table class="store-table">
        <thead>
          <tr>
            <th>Game</th>
            <th>Stake</th>
            <th>Roll</th>
            <th>Payout</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody data-rp-rounds-body>
          <?php foreach ($game_rounds as $round) : ?>
            <?php $game_type = (string) ($round['game_type'] ?? 'game'); ?>
            <tr data-rp-activity-key="<?= e((string) ($round['activity_key'] ?? ('round-' . (int) ($round['id'] ?? 0)))) ?>">
              <td><?= e($game_names[$game_type] ?? ucwords(str_replace('_', ' ', $game_type))) ?></td>
              <td><?= e(raidlands_store_rp((int) ($round['stake_rp'] ?? 0))) ?></td>
              <td><?= e((string) ($round['roll_result'] ?? '')) ?></td>
              <td><?= e(raidlands_store_rp((int) ($round['payout_rp'] ?? 0))) ?></td>
              <?php $round_status = (string) ($round['status'] ?? 'queued'); ?>
              <td><span class="status-pill <?= e($round_status) ?>"><?= e($rp_status_labels[$round_status] ?? ucwords(str_replace('_', ' ', $round_status))) ?></span></td>
              <td><?= e((string) ($round['created_at'] ?? '')) ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>

    <div class="store-table-wrap" data-rp-jackpot-entries-table <?= $jackpot_entries !== [] ? '' : 'hidden' ?>>
      <table class="store-table">
        <thead>
          <tr>
            <th>Jackpot</th>
            <th>Tickets</th>
            <th>Cost</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody data-rp-jackpot-entries-body>
          <?php foreach ($jackpot_entries as $entry) : ?>
            <tr>
              <td><?= e((string) ($entry['round_key'] ?? 'Jackpot')) ?></td>
              <td><?= e((string) ($entry['ticket_count'] ?? 0)) ?></td>
              <td><?= e(raidlands_store_rp((int) ($entry['cost_rp'] ?? 0))) ?></td>
              <?php $entry_status = (string) ($entry['status'] ?? 'queued'); ?>
              <td><span class="status-pill <?= e($entry_status) ?>"><?= e($rp_status_labels[$entry_status] ?? ucwords(str_replace('_', ' ', $entry_status))) ?></span></td>
              <td><?= e((string) ($entry['created_at'] ?? '')) ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>

    <div class="form-status warning" data-rp-history-empty <?= $game_rounds === [] && $jackpot_entries === [] && $jackpot_rounds === [] ? '' : 'hidden' ?>>No RP game activity has been recorded yet.</div>
  </div>
</section>
