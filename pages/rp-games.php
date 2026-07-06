<?php

$games_ready = !empty($rp_games_state['ready']);
$games_player = is_array($rp_games_state['player'] ?? null) ? $rp_games_state['player'] : null;
$settings = is_array($rp_games_state['settings'] ?? null) ? $rp_games_state['settings'] : [];
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
?>
<?= render_page_hero('rp-games',
    '<a class="btn btn-primary" href="' . e(raidlands_account_url()) . '">' . e(raidlands_account_label('Connect Steam', 'View Account')) . '</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('vote')) . '">Vote Rewards</a>'
) ?>

<section class="section">
  <div class="section-inner">
    <?php if ($rp_games_flash !== null) : ?>
      <div class="form-status <?= e((string) $rp_games_flash['type']) ?>"><?= e((string) $rp_games_flash['message']) ?></div>
    <?php endif; ?>

    <?php if (!$games_ready) : ?>
      <div class="form-status warning"><?= e((string) ($rp_games_state['message'] ?? 'RP games are not installed yet.')) ?></div>
    <?php elseif (empty($settings['games_enabled'])) : ?>
      <div class="form-status warning">RP games are paused by admins.</div>
    <?php elseif ($games_player === null || empty($games_player['id'])) : ?>
      <div class="form-status warning">Link your Steam account before playing RP games.</div>
    <?php endif; ?>

    <div class="profile-stat-grid">
      <article class="stat-tile">
        <span>Synced RP</span>
        <strong><?= e(raidlands_store_rp((int) ($games_balance['reward_points'] ?? 0))) ?></strong>
      </article>
      <article class="stat-tile">
        <span>Daily Wagered</span>
        <strong><?= e(raidlands_store_rp((int) ($daily['wagered_rp'] ?? 0))) ?></strong>
      </article>
      <article class="stat-tile">
        <span>Daily Loss</span>
        <strong><?= e(raidlands_store_rp((int) ($daily['loss_rp'] ?? 0))) ?></strong>
      </article>
      <article class="stat-tile">
        <span>Stake Range</span>
        <strong><?= e(raidlands_store_rp($min_stake)) ?>-<?= e(raidlands_store_rp($max_stake)) ?></strong>
      </article>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">House games</p>
      <h2>Coinflip and dice</h2>
      <p class="section-lede">Outcomes are rolled on the website, then the Rust server confirms the debit and any payout against live ServerRewards RP.</p>
    </div>

    <div class="split-panel rp-game-layout">
      <article class="metal-panel">
        <p class="section-kicker">50% odds</p>
        <h2>Coinflip</h2>
        <p class="section-lede">Pick heads or tails. Wins pay <?= e(number_format(((int) ($settings['coinflip_payout_multiplier_basis'] ?? 200)) / 100, 2)) ?>x gross before server confirmation.</p>
        <form class="feedback-form" method="post" action="<?= e(route_url('rp-games')) ?>">
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
      </article>

      <article class="metal-panel">
        <p class="section-kicker"><?= e((string) $dice_chance) ?>% win chance</p>
        <h2>Dice</h2>
        <p class="section-lede">Roll <?= e((string) $dice_threshold) ?> or higher on a 1-100 die. Wins pay <?= e(number_format(((int) ($settings['dice_payout_multiplier_basis'] ?? 200)) / 100, 2)) ?>x gross.</p>
        <form class="feedback-form" method="post" action="<?= e(route_url('rp-games')) ?>">
          <input type="hidden" name="csrf" value="<?= e($rp_games_csrf) ?>">
          <input type="hidden" name="action" value="play_dice">
          <label class="store-field">
            <span>Stake</span>
            <input type="number" name="stake_rp" min="<?= e((string) $min_stake) ?>" max="<?= e((string) $max_stake) ?>" step="1" value="<?= e((string) $min_stake) ?>" <?= $can_play && !empty($settings['dice_enabled']) ? '' : 'disabled' ?>>
          </label>
          <button class="btn btn-primary" type="submit" <?= $can_play && !empty($settings['dice_enabled']) ? '' : 'disabled' ?>>Roll Dice</button>
        </form>
      </article>
    </div>
  </div>
</section>

<section class="section">
  <div class="section-inner split-panel">
    <article class="metal-panel">
      <p class="section-kicker">Jackpot</p>
      <h2>Shared RP pot</h2>
      <?php if ($active_jackpot === null) : ?>
        <p class="section-lede">No jackpot round is open right now.</p>
      <?php else : ?>
        <div class="feature-score-grid">
          <span><strong><?= e(raidlands_store_rp((int) ($active_jackpot['ticket_cost_rp'] ?? 0))) ?></strong> Ticket</span>
          <span><strong><?= e((string) ($active_jackpot['total_entries'] ?? 0)) ?></strong> Tickets</span>
          <span><strong><?= e(raidlands_store_rp((int) ($active_jackpot['pot_rp'] ?? 0))) ?></strong> Pot</span>
        </div>
        <p class="store-muted">Closes <?= e((string) ($active_jackpot['closes_at'] ?? '')) ?> UTC. Only confirmed entries count.</p>
        <form class="feedback-form" method="post" action="<?= e(route_url('rp-games')) ?>">
          <input type="hidden" name="csrf" value="<?= e($rp_games_csrf) ?>">
          <input type="hidden" name="action" value="enter_jackpot">
          <label class="store-field">
            <span>Tickets</span>
            <input type="number" name="tickets" min="1" max="<?= e((string) ($active_jackpot['max_entries_per_player'] ?? 10)) ?>" step="1" value="1" <?= $can_play && !empty($settings['jackpot_enabled']) ? '' : 'disabled' ?>>
          </label>
          <button class="btn btn-primary" type="submit" <?= $can_play && !empty($settings['jackpot_enabled']) ? '' : 'disabled' ?>>Enter Jackpot</button>
        </form>
      <?php endif; ?>
    </article>

    <article class="metal-panel">
      <p class="section-kicker">Guardrails</p>
      <h2>In-game RP only</h2>
      <p class="section-lede"><?= e((string) ($settings['terms_copy'] ?? 'RP games use in-game RP only.')) ?></p>
      <ul class="list-clean">
        <li>No cash value and no cash-out route.</li>
        <li>Point changes are pending until WebsiteVipBridge confirms them.</li>
        <li>Admins can pause individual games or all RP games.</li>
      </ul>
    </article>
  </div>
</section>

<section class="section alt">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">History</p>
      <h2>Recent RP game activity</h2>
      <p class="section-lede">Pending rows are waiting for the Rust server to confirm live RP balance changes.</p>
    </div>

    <?php if ($game_rounds !== []) : ?>
      <div class="store-table-wrap">
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
          <tbody>
            <?php foreach ($game_rounds as $round) : ?>
              <tr>
                <td><?= e(ucfirst((string) ($round['game_type'] ?? 'game'))) ?></td>
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
    <?php endif; ?>

    <?php if ($jackpot_entries !== []) : ?>
      <div class="store-table-wrap">
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
          <tbody>
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
    <?php endif; ?>

    <?php if ($game_rounds === [] && $jackpot_entries === [] && $jackpot_rounds === []) : ?>
      <div class="form-status warning">No RP game activity has been recorded yet.</div>
    <?php endif; ?>
  </div>
</section>
