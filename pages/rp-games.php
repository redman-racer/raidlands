<?php

$games_ready = !empty($rp_games_state['ready']);
$games_player = is_array($rp_games_state['player'] ?? null) ? $rp_games_state['player'] : null;
$settings = is_array($rp_games_state['settings'] ?? null) ? $rp_games_state['settings'] : [];
$game_backend = is_array($rp_games_state['game_backend'] ?? null) ? $rp_games_state['game_backend'] : [];
$games_balance = is_array($rp_games_state['balance'] ?? null) ? $rp_games_state['balance'] : null;
$daily = is_array($rp_games_state['daily'] ?? null) ? $rp_games_state['daily'] : [];
$active_jackpot = is_array($rp_games_state['active_jackpot'] ?? null) ? $rp_games_state['active_jackpot'] : null;
$game_rounds = (array) ($rp_games_state['game_rounds'] ?? []);
$jackpot_entries = (array) ($rp_games_state['jackpot_entries'] ?? []);
$jackpot_rounds = (array) ($rp_games_state['jackpot_rounds'] ?? []);
$can_play = $games_ready && $games_player !== null && !empty($games_player['id']) && !empty($settings['games_enabled']);
$min_stake = (int) ($settings['min_stake_rp'] ?? 200);
$max_stake = (int) ($settings['max_stake_rp'] ?? 2000);
$dice_chance = (int) ($settings['dice_win_chance_percent'] ?? 45);
$dice_threshold = 101 - max(1, min(95, $dice_chance));
$high_low_backend = !empty($game_backend['high_low']);
$wheel_backend = !empty($game_backend['wheel']);
$high_low_enabled = $high_low_backend && !empty($settings['high_low_enabled']);
$wheel_enabled = $wheel_backend && !empty($settings['wheel_enabled']);
$wheel_segments = function_exists('raidlands_rewards_wheel_segments') ? raidlands_rewards_wheel_segments() : [];
$game_names = [
    'coinflip' => 'Coinflip',
    'dice' => 'Dice',
    'high_low' => 'High-Low',
    'wheel' => 'Wheel',
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
        'meta' => (string) $dice_chance . '% chance',
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
                <span class="coin-face heads">H</span>
                <span class="coin-face tails">T</span>
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
              <p class="section-kicker"><?= e((string) $dice_chance) ?>% win chance</p>
              <h2>Dice</h2>
              <p class="section-lede">Roll <?= e((string) $dice_threshold) ?> or higher on a 1-100 die. Wins pay <?= e(number_format(((int) ($settings['dice_payout_multiplier_basis'] ?? 200)) / 100, 2)) ?>x gross.</p>
              <div class="rp-game-machine dice-machine" aria-hidden="true">
                <span></span><span></span><span></span><span></span><span></span>
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

        <article class="metal-panel rp-game-panel" id="rp-panel-high-low" role="tabpanel" aria-labelledby="rp-tab-high-low" data-rp-game-panel="high-low" hidden>
          <div class="rp-game-panel-grid">
            <div>
              <p class="section-kicker">Call the range</p>
              <h2>High-Low</h2>
              <p class="section-lede">Call low for 1-45 or high for 56-100. Rolls 46-55 push and queue your stake back for server confirmation.</p>
              <div class="rp-game-machine high-low-machine" aria-hidden="true">
                <span>LOW</span>
                <strong>46-55</strong>
                <span>HIGH</span>
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
                <span></span>
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
      <p class="section-kicker">How it feels live</p>
      <h2>No page bounce</h2>
      <p class="section-lede">Switch games, submit wagers, and watch the recent activity queue update in place. Full page posts still work when JavaScript is unavailable.</p>
      <div class="tag-row">
        <span class="tag">Server-confirmed</span>
        <span class="tag">Daily limits</span>
        <span class="tag">Linked Steam</span>
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
