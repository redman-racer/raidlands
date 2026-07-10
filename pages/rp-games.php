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
$can_play = $games_ready && $games_player !== null && !empty($games_player['id']) && !empty($settings['games_enabled']);
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
$raid_duel_enabled = $raid_duel_backend && !empty($settings['raid_duel_enabled']);
$supply_run_enabled = $supply_run_backend && !empty($settings['supply_run_enabled']);
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
    'raid_duel' => 'Raid Duel',
    'supply_run' => 'Supply Run',
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
];
?>
<?= render_page_hero('rp-games',
    '<a class="btn btn-primary" href="' . e(raidlands_account_url()) . '">' . e(raidlands_account_label('Connect Steam', 'View Account')) . '</a>'
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
      <?php endif; ?>
    </div>

    <div class="profile-stat-grid rp-games-stat-grid">
      <article class="stat-tile">
        <span>Synced RP</span>
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

    <div class="rp-games-workspace">
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
      <p class="section-lede">Pending rows are waiting for the Rust server to confirm live RP balance changes.</p>
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
            <tr>
              <td><?= e($game_names[$game_type] ?? ucwords(str_replace('_', ' ', $game_type))) ?></td>
              <td><?= e(raidlands_store_rp((int) ($round['stake_rp'] ?? 0))) ?></td>
              <td><?= e((string) ($round['roll_result'] ?? '')) ?></td>
              <td><?= e(raidlands_store_rp((int) ($round['payout_rp'] ?? 0))) ?></td>
              <td><span class="status-pill <?= e((string) ($round['status'] ?? 'queued')) ?>"><?= e((string) ($round['status'] ?? 'queued')) ?></span></td>
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
              <td><span class="status-pill <?= e((string) ($entry['status'] ?? 'queued')) ?>"><?= e((string) ($entry['status'] ?? 'queued')) ?></span></td>
              <td><?= e((string) ($entry['created_at'] ?? '')) ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>

    <div class="form-status warning" data-rp-history-empty <?= $game_rounds === [] && $jackpot_entries === [] && $jackpot_rounds === [] ? '' : 'hidden' ?>>No RP game activity has been recorded yet.</div>
  </div>
</section>
