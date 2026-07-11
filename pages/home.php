<?php
$home_feature_state = is_array($home_feature_state ?? null) ? $home_feature_state : [
    'built_cards' => array_slice((array) $feature_cards, 0, 8),
    'has_voteable' => false,
];
$home_built_cards = is_array($home_feature_state['built_cards'] ?? null) ? $home_feature_state['built_cards'] : [];
$home_has_voteable_features = !empty($home_feature_state['has_voteable']);

$home_server_status = is_array($home_server_status ?? null) ? $home_server_status : [];
$home_server_online = $home_server_status['online'] ?? null;
$home_server_status_class = $home_server_online === true ? 'active' : ($home_server_online === false ? 'failed' : 'pending');
$home_server_status_label = (string) ($home_server_status['statusLabel'] ?? 'Status Pending');
$home_server_players = (int) ($home_server_status['players'] ?? $site_config['playersOnline'] ?? 0);
$home_server_max_players = (int) ($home_server_status['maxPlayers'] ?? $site_config['maxPlayers'] ?? 0);
$home_server_queue = (int) ($home_server_status['queue'] ?? 0);
$home_server_map_name = (string) ($home_server_status['mapName'] ?? $site_config['mapName'] ?? 'Unknown');
$home_server_map_image = is_array($home_server_status['mapImage'] ?? null) ? $home_server_status['mapImage'] : [];
$home_server_map_url = trim((string) ($home_server_status['mapImageUrl'] ?? ($home_server_map_image['url'] ?? '')));
$home_server_terrain_url = trim((string) ($home_server_map_image['terrainUrl'] ?? ''));
$home_server_texture_url = trim((string) ($home_server_map_image['textureUrl'] ?? $home_server_map_url));
$home_server_updated_at = (string) ($home_server_status['updatedAt'] ?? $home_server_status['receivedAt'] ?? '');
$home_server_updated_timestamp = $home_server_updated_at !== '' ? strtotime($home_server_updated_at) : false;
$home_server_updated_label = $home_server_updated_timestamp !== false
    ? date('M j, g:i A', $home_server_updated_timestamp)
    : 'Awaiting heartbeat';

$home_leaderboard_state = is_array($home_leaderboard_state ?? null) ? $home_leaderboard_state : [];
$home_leaderboard_ready = !empty($home_leaderboard_state['ready']);
$home_leaders = is_array($home_leaderboard_state['leaders'] ?? null) ? $home_leaderboard_state['leaders'] : [];
$home_bot_threat = is_array($home_leaderboard_state['bot_threat'] ?? null) ? $home_leaderboard_state['bot_threat'] : null;
$home_leader_definitions = [
    'kills' => ['label' => 'Most kills', 'icon' => 'RISK', 'detail' => 'player kills this wipe'],
    'kdr' => ['label' => 'Best K/D', 'icon' => 'STAT', 'detail' => 'kill/death ratio'],
    'rp' => ['label' => 'Most RP', 'icon' => 'SHOP', 'detail' => 'reward points banked'],
    'npc_kills' => ['label' => 'NPC hunter', 'icon' => 'EVENT', 'detail' => 'NPC eliminations'],
];
$home_leader_value = static function (string $metric, array $row): string {
    return match ($metric) {
        'kdr' => raidlands_stats_format_kdr($row['kdr'] ?? 0),
        'rp' => raidlands_store_rp((int) ($row['reward_points'] ?? 0)),
        'npc_kills' => raidlands_stats_format_number($row['npc_kills'] ?? 0),
        default => raidlands_stats_format_number($row['kills'] ?? 0),
    };
};
$home_player_name = static function (array $row): string {
    $name = trim((string) ($row['display_name'] ?? $row['steam_display_name'] ?? ''));

    return $name !== '' ? $name : 'Raidlands Player';
};
$home_player_initials = static function (string $name): string {
    $parts = preg_split('/\s+/', trim($name)) ?: [];
    $initials = '';

    foreach (array_slice($parts, 0, 2) as $part) {
        $initials .= strtoupper(substr($part, 0, 1));
    }

    return $initials !== '' ? $initials : 'RL';
};
$home_has_leader_data = $home_leaders !== [] || $home_bot_threat !== null;

$home_rp_games_state = is_array($home_rp_games_state ?? null) ? $home_rp_games_state : [];
$home_rp_ready = !empty($home_rp_games_state['ready']);
$home_rp_settings = is_array($home_rp_games_state['settings'] ?? null) ? $home_rp_games_state['settings'] : [];
$home_rp_games = is_array($home_rp_games_state['games'] ?? null) ? $home_rp_games_state['games'] : [];
$home_rp_active_jackpot = is_array($home_rp_games_state['active_jackpot'] ?? null) ? $home_rp_games_state['active_jackpot'] : null;
$home_rp_pool_rounds = is_array($home_rp_games_state['pool_rounds'] ?? null) ? $home_rp_games_state['pool_rounds'] : [];
$home_rp_recent_rounds = is_array($home_rp_games_state['recent_rounds'] ?? null) ? $home_rp_games_state['recent_rounds'] : [];
$home_rp_enabled_games = array_filter($home_rp_games, static fn (array $game): bool => !empty($game['enabled']));
$home_rp_active_pool = null;

foreach ($home_rp_pool_rounds as $pool_round) {
    if (is_array($pool_round)) {
        $home_rp_active_pool = $pool_round;
        break;
    }
}

$home_rp_min_stake = max(1, (int) ($home_rp_settings['min_stake_rp'] ?? 200));
$home_rp_max_stake = max($home_rp_min_stake, (int) ($home_rp_settings['max_stake_rp'] ?? 2000));
$home_rp_jackpot_label = $home_rp_active_jackpot !== null
    ? raidlands_store_rp((int) ($home_rp_active_jackpot['pot_rp'] ?? 0))
    : 'Next round';
$home_rp_pool_label = $home_rp_active_pool !== null
    ? raidlands_store_rp((int) ($home_rp_active_pool['total_stake_rp'] ?? 0))
    : 'Waiting';
$home_rp_game_names = [
    'coinflip' => 'Coinflip',
    'dice' => 'Dice',
    'high_low' => 'High-Low',
    'wheel' => 'Wheel',
    'raid_duel' => 'Raid Duel',
    'supply_run' => 'Supply Run',
];
$home_is_linked = raidlands_has_linked_account();
?>
<section class="hero">
  <div class="hero-inner">
    <div class="hero-layout">
      <div class="hero-copy">
        <img class="hero-brand-mark" src="<?= e(asset_url('media/raidlands-logo.webp')) ?>" alt="">
        <h1>Raidlands 1000x</h1>
        <p class="hero-subtitle"><?= e($page_copy['home']['lede']) ?></p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="<?= e($site_config['steamConnectUrl']) ?>" data-track="join_server_clicked">
            Join Server
            <span class="btn-icon" aria-hidden="true"><?= action_icon('arrow') ?></span>
          </a>
          <button class="btn btn-secondary" type="button" data-copy-command>
            Copy Connect Command
            <span class="btn-icon" aria-hidden="true"><?= action_icon('copy') ?></span>
          </button>
          <a class="btn btn-discord" href="<?= e($site_config['discordInviteUrl']) ?>" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">
            Join Discord
            <span class="btn-icon" aria-hidden="true"><?= action_icon('discord') ?></span>
          </a>
        </div>
      </div>
      <?= render_status_panel() ?>
    </div>
    <?= render_quick_features() ?>
    <?= render_wipe_bar() ?>
  </div>
</section>

<section class="section home-live-section">
  <div class="section-inner">
    <div class="section-header home-section-heading">
      <div>
        <p class="section-kicker">Live battlefield</p>
        <h2>See the fight before you join</h2>
        <p class="section-lede">Current population, wipe map, and recent activity come straight from the Raidlands server feed.</p>
      </div>
      <a class="btn btn-secondary" href="<?= e(route_url('server')) ?>">Full Server Status</a>
    </div>

    <div class="home-live-stat-grid" aria-label="Live server summary">
      <article class="stat-tile">
        <span>Status</span>
        <strong data-server-status><?= e($home_server_status_label) ?></strong>
        <small data-server-updated><?= e($home_server_updated_label) ?></small>
      </article>
      <article class="stat-tile">
        <span>Population</span>
        <strong><span data-server-players><?= e((string) $home_server_players) ?></span> / <span data-server-max-players><?= e((string) $home_server_max_players) ?></span></strong>
        <small>Players online</small>
      </article>
      <article class="stat-tile">
        <span>Queue</span>
        <strong data-server-queue><?= e((string) $home_server_queue) ?></strong>
        <small>Waiting to deploy</small>
      </article>
      <article class="stat-tile">
        <span>Current map</span>
        <strong data-server-map><?= e($home_server_map_name) ?></strong>
        <small>Live wipe world</small>
      </article>
    </div>

    <div class="home-server-preview-grid">
      <article class="metal-panel home-map-preview">
        <div class="home-panel-heading">
          <div>
            <p class="section-kicker">Wipe map</p>
            <h3>Plan the next move</h3>
          </div>
          <span class="status-pill <?= e($home_server_status_class) ?>"><?= e($home_server_status_label) ?></span>
        </div>
        <?php if ($home_server_terrain_url !== '') : ?>
          <div
            class="server-terrain-viewer home-map-frame home-map-terrain"
            data-server-map-viewer
            data-terrain-url="<?= e($home_server_terrain_url) ?>"
            data-texture-url="<?= e($home_server_texture_url) ?>"
            data-airstrike-profiles-url="<?= e($base_path . 'api/airstrike-animation-profiles.php') ?>"
            data-camera-tour="true"
            data-camera-locked="true"
            data-grid-overlay="true"
            data-world-size="<?= e((string) ($home_server_map_image['worldSize'] ?? $home_server_status['worldSize'] ?? 0)) ?>"
            data-min-height="<?= e((string) ($home_server_map_image['terrainMinHeight'] ?? 0)) ?>"
            data-max-height="<?= e((string) ($home_server_map_image['terrainMaxHeight'] ?? 0)) ?>"
            aria-label="Current Raidlands wipe map animation preview">
            <?php if ($home_server_map_url !== '') : ?>
              <img class="server-terrain-fallback-image" src="<?= e($home_server_map_url) ?>" alt="Current Raidlands wipe map" loading="lazy">
            <?php endif; ?>
            <p class="server-terrain-status" data-map-viewer-status>Loading terrain.</p>
          </div>
        <?php elseif ($home_server_map_url !== '') : ?>
          <a class="server-map-frame home-map-frame" href="<?= e($home_server_map_url) ?>" target="_blank" rel="noopener">
            <img src="<?= e($home_server_map_url) ?>" alt="Current Raidlands wipe map" loading="lazy">
          </a>
        <?php else : ?>
          <div class="server-map-frame home-map-frame home-map-empty" role="img" aria-label="Current Raidlands map render pending">
            <span aria-hidden="true"><?= status_icon('map') ?></span>
            <strong>Map render pending</strong>
            <small>The live map will appear after the next server publish.</small>
          </div>
        <?php endif; ?>
        <dl class="home-map-meta">
          <div><dt>Seed</dt><dd><?= e(number_format((int) ($home_server_map_image['seed'] ?? $home_server_status['seed'] ?? 0))) ?></dd></div>
          <div><dt>World</dt><dd><?= e(number_format((int) ($home_server_status['worldSize'] ?? 0))) ?></dd></div>
        </dl>
      </article>

      <article class="metal-panel server-history-panel home-history-panel" data-server-history data-history-range="6h">
        <div class="server-history-head home-history-head">
          <div>
            <p class="section-kicker">Last 6 hours</p>
            <h3>Population activity</h3>
            <p class="section-lede">Players, queue, and uptime from recent server heartbeats.</p>
          </div>
          <span class="status-pill active">Live feed</span>
          <div class="server-history-metrics home-history-metrics" aria-label="Recent server history summary">
            <span><small>Window</small><strong data-history-window>6 hours</strong></span>
            <span><small>Availability</small><strong data-history-uptime>Waiting</strong></span>
            <span><small>Peak</small><strong data-history-peak>0</strong></span>
            <span><small>Average</small><strong data-history-average>0</strong></span>
          </div>
        </div>
        <div class="server-history-chart-wrap home-history-chart-wrap">
          <canvas data-server-history-chart width="960" height="280" aria-label="Raidlands population and queue over the last six hours"></canvas>
          <p class="server-history-empty" data-server-history-empty>Waiting for live heartbeat samples.</p>
        </div>
        <div class="server-history-legend" aria-label="Chart legend">
          <span><i class="legend-population" aria-hidden="true"></i> Players</span>
          <span><i class="legend-queue" aria-hidden="true"></i> Queue</span>
          <span><i class="legend-online" aria-hidden="true"></i> Online</span>
          <span><small><span data-history-samples>0</span> <span data-history-sample-label>samples</span></small></span>
        </div>
      </article>
    </div>
  </div>
</section>
<?php if ($home_server_terrain_url !== '') : ?>
<script type="module" src="<?= e(asset_url('build/airstrike-animation-editor/server-map-viewer.js')) ?>"></script>
<?php endif; ?>

<section class="section alt home-leaderboard-section">
  <div class="section-inner">
    <div class="section-header home-section-heading">
      <div>
        <p class="section-kicker">Current wipe leaders</p>
        <h2>Who is running this wipe?</h2>
        <p class="section-lede">A mixed look at the players setting the pace, plus the NPC bot doing the most damage.</p>
      </div>
      <a class="btn btn-secondary" href="<?= e(route_url('leaderboard')) ?>">All Leaderboards</a>
    </div>

    <?php if ($home_has_leader_data) : ?>
      <div class="home-leader-grid">
        <?php foreach ($home_leader_definitions as $metric => $definition) : ?>
          <?php if (!isset($home_leaders[$metric]) || !is_array($home_leaders[$metric])) { continue; } ?>
          <?php
            $leader = $home_leaders[$metric];
            $leader_name = $home_player_name($leader);
            $leader_avatar = render_steam_avatar(
                (string) ($leader['steam_avatar_url'] ?? ''),
                (string) ($leader['steam_profile_url'] ?? ''),
                $leader_name,
                'steam-avatar-sm'
            );
            $leaderboard_metric_url = route_url('leaderboard') . '?board=players&scope=current&metric=' . rawurlencode($metric);
          ?>
          <article class="metal-panel home-leader-card">
            <div class="home-leader-card-head">
              <span><?= render_feature_symbol((string) $definition['icon']) ?></span>
              <p class="section-kicker"><?= e((string) $definition['label']) ?></p>
            </div>
            <div class="home-leader-player">
              <?= $leader_avatar !== '' ? $leader_avatar : '<span class="home-leader-avatar" aria-hidden="true">' . e($home_player_initials($leader_name)) . '</span>' ?>
              <strong><?= e($leader_name) ?></strong>
            </div>
            <strong class="home-leader-value"><?= e($home_leader_value($metric, $leader)) ?></strong>
            <p class="store-muted"><?= e((string) $definition['detail']) ?></p>
            <a class="home-text-link" href="<?= e($leaderboard_metric_url) ?>">View this board <span aria-hidden="true"><?= action_icon('arrow') ?></span></a>
          </article>
        <?php endforeach; ?>
      </div>

      <?php if ($home_bot_threat !== null) : ?>
        <?php
          $home_bot_name = trim((string) ($home_bot_threat['display_name'] ?? ''));
          $home_bot_name = $home_bot_name !== '' ? $home_bot_name : (string) ($home_bot_threat['bot_key'] ?? 'Raidlands Bot');
        ?>
        <article class="metal-panel home-bot-threat">
          <div class="leaderboard-bot-avatar" aria-hidden="true">BOT</div>
          <div class="home-bot-copy">
            <p class="section-kicker">NPC threat report</p>
            <h3><?= e($home_bot_name) ?></h3>
            <p class="store-muted"><?= e(trim((string) ($home_bot_threat['skill_tier'] ?? '')) !== '' ? (string) $home_bot_threat['skill_tier'] . ' tier' : 'Active combat bot') ?><?= trim((string) ($home_bot_threat['kit_name'] ?? '')) !== '' ? ' / ' . e((string) $home_bot_threat['kit_name']) : '' ?></p>
          </div>
          <dl class="home-bot-stats">
            <div><dt>Player kills</dt><dd><?= e(number_format((int) ($home_bot_threat['kills'] ?? 0))) ?></dd></div>
            <div><dt>Deaths</dt><dd><?= e(number_format((int) ($home_bot_threat['deaths'] ?? 0))) ?></dd></div>
            <div><dt>K/D</dt><dd><?= e(raidlands_stats_format_kdr($home_bot_threat['kdr'] ?? 0)) ?></dd></div>
          </dl>
          <a class="btn btn-secondary" href="<?= e(route_url('leaderboard') . '?board=bots&scope=current&metric=kills') ?>">Bot Rankings</a>
        </article>
      <?php endif; ?>
    <?php else : ?>
      <div class="metal-panel home-empty-state">
        <p class="section-kicker"><?= $home_leaderboard_ready ? 'Awaiting contenders' : 'Stats feed pending' ?></p>
        <h3>The next wipe leaders will appear here.</h3>
        <p class="section-lede">Once the game server sends current-wipe combat stats, this board fills automatically.</p>
      </div>
    <?php endif; ?>
  </div>
</section>

<section class="section home-rp-preview-section">
  <div class="section-inner">
    <div class="section-header home-section-heading">
      <div>
        <p class="section-kicker">RP arcade</p>
        <h2>Put in-game RP on the line</h2>
        <p class="section-lede">Coinflip, dice, jackpots, and multiplayer pools run on server-confirmed Raidlands RP with no cash value.</p>
      </div>
      <a class="btn btn-primary" href="<?= e(route_url('rp-games')) ?>">Open RP Games</a>
    </div>

    <div class="home-rp-grid">
      <article class="home-rp-showcase">
        <picture>
          <source srcset="<?= e(asset_url('media/rp-games/rp-dice.webp')) ?>" type="image/webp">
          <img src="<?= e(asset_url('media/rp-games/rp-dice.png')) ?>" alt="Raidlands RP dice game" loading="lazy">
        </picture>
        <div class="home-rp-showcase-copy">
          <span class="status-pill <?= $home_rp_ready && !empty($home_rp_settings['games_enabled']) ? 'active' : 'pending' ?>"><?= $home_rp_ready && !empty($home_rp_settings['games_enabled']) ? 'Games live' : 'Games paused' ?></span>
          <h3>Quick picks and shared pools</h3>
          <p>Play a fast solo round or back a side in Raid Duel and Supply Run.</p>
        </div>
      </article>

      <article class="metal-panel home-rp-floor">
        <div class="home-panel-heading">
          <div>
            <p class="section-kicker">Live floor</p>
            <h3>What is open now</h3>
          </div>
          <strong class="home-rp-live-count"><?= e((string) count($home_rp_enabled_games)) ?> / <?= e((string) count($home_rp_games)) ?></strong>
        </div>

        <dl class="home-rp-facts">
          <div><dt>Stake range</dt><dd><?= e(raidlands_store_rp($home_rp_min_stake)) ?> - <?= e(raidlands_store_rp($home_rp_max_stake)) ?></dd></div>
          <div><dt>Jackpot</dt><dd><?= e($home_rp_jackpot_label) ?></dd></div>
          <div><dt>Open pool</dt><dd><?= e($home_rp_pool_label) ?></dd></div>
        </dl>

        <div class="home-rp-game-list" aria-label="RP game availability">
          <?php foreach ($home_rp_games as $game) : ?>
            <?php
              $game_ready = !empty($game['ready']);
              $game_enabled = !empty($game['enabled']);
              $game_status = $game_enabled ? 'Live' : ($game_ready ? 'Paused' : 'Unavailable');
              $game_status_class = $game_enabled ? 'active' : ($game_ready ? 'pending' : 'planned');
            ?>
            <span class="home-rp-game-row">
              <?= render_feature_symbol((string) ($game['icon'] ?? 'RISK')) ?>
              <strong><?= e((string) ($game['label'] ?? 'RP Game')) ?></strong>
              <em class="status-pill <?= e($game_status_class) ?>"><?= e($game_status) ?></em>
            </span>
          <?php endforeach; ?>
        </div>
      </article>

      <article class="metal-panel home-rp-activity">
        <div>
          <p class="section-kicker">Recent activity</p>
          <h3>Latest public rounds</h3>
          <p class="store-muted">Results stay pending until the game server confirms the RP change.</p>
        </div>
        <div class="home-rp-activity-list">
          <?php if ($home_rp_recent_rounds !== []) : ?>
            <?php foreach ($home_rp_recent_rounds as $round) : ?>
              <?php
                $round_game = (string) ($round['game_type'] ?? 'game');
                $round_status = (string) (($round['request_status'] ?? '') ?: ($round['status'] ?? 'queued'));
              ?>
              <span class="home-rp-activity-row">
                <strong><?= e($home_rp_game_names[$round_game] ?? ucwords(str_replace('_', ' ', $round_game))) ?></strong>
                <small><?= e(raidlands_store_rp((int) ($round['stake_rp'] ?? 0))) ?> stake</small>
                <em class="status-pill <?= e($round_status) ?>"><?= e(str_replace('_', ' ', $round_status)) ?></em>
              </span>
            <?php endforeach; ?>
          <?php else : ?>
            <p class="store-muted">No public RP rounds have landed yet. The first confirmed plays will show here.</p>
          <?php endif; ?>
        </div>
      </article>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Built for nonstop raids</p>
      <h2>Farm fast. Gear fast. Raid fast.</h2>
      <p class="section-lede">Raidlands removes the slow parts and keeps the war. Whether you play solo, with friends, or inside a full clan, every Thursday wipe is a fresh battlefield.</p>
    </div>
    <div class="grid four">
      <?php foreach ($home_built_cards as $card) : ?>
        <?= render_home_feature_card($card) ?>
      <?php endforeach; ?>
    </div>
    <div class="button-row">
      <a class="btn btn-secondary" href="<?= e(route_url('features')) ?>">View All Features</a>
      <?php if ($home_has_voteable_features) : ?>
        <a class="btn btn-primary" href="<?= e(route_url('features') . '#feature-voting') ?>">Vote on Features</a>
      <?php endif; ?>
    </div>
  </div>
</section>

<section class="section">
  <div class="section-inner split-panel">
    <div class="metal-panel wipe-schedule-panel">
      <p class="section-kicker">Wipe schedule</p>
      <h2>Wipes every Thursday</h2>
      <p class="section-lede">The wasteland resets every Thursday. New bases. New rivalries. New raids.</p>
      <div class="tag-row wipe-schedule-meta" aria-label="Wipe timing">
        <span class="tag"><span class="tag-label">Last wipe</span><span class="tag-value" data-last-wipe>Loading</span></span>
        <span class="tag"><span class="tag-label">Upcoming</span><span class="tag-value" data-next-wipe>Loading</span></span>
        <span class="tag"><span class="tag-label">Wipe time</span><span class="tag-value"><?= e($site_config['wipe']['time']) ?> <?= e($site_config['wipe']['timezone']) ?></span></span>
      </div>
      <?= render_wipe_bar() ?>
      <div class="button-row wipe-schedule-actions">
        <a class="btn btn-discord" href="<?= e($site_config['discordInviteUrl']) ?>" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Get Wipe Alerts</a>
        <a class="btn btn-secondary" href="<?= e(route_url('play')) ?>">Join Methods</a>
      </div>
    </div>
    <div class="image-panel wipe" role="img" aria-label="Raidlands wipe day artwork"></div>
  </div>
</section>

<section class="section alt">
  <div class="section-inner">
    <div class="section-header center">
      <p class="section-kicker">How to play</p>
      <h2>Three ways into the fight</h2>
    </div>
    <div class="grid three">
      <?= render_join_method_cards() ?>
    </div>
  </div>
</section>

<section class="section home-connected-section">
  <div class="section-inner">
    <div class="section-header center">
      <p class="section-kicker">Stay connected</p>
      <h2>Your account, access, and squad</h2>
      <p class="section-lede">Link Steam once, keep perks tied to the right player, and use Discord for wipe alerts and support.</p>
    </div>
    <div class="home-connected-grid">
      <article class="metal-panel">
        <p class="section-kicker"><?= $home_is_linked ? 'Account linked' : 'Link Steam' ?></p>
        <h3><?= $home_is_linked ? 'Your profile is ready' : 'Keep progress with you' ?></h3>
        <p class="store-muted"><?= $home_is_linked ? 'Open your profile for stats, RP, rewards, and active access.' : 'Connect Steam so rankings, rewards, roles, and purchases reach the right player.' ?></p>
        <a class="btn btn-primary" href="<?= e(raidlands_account_url()) ?>"><?= e(raidlands_account_label('Link Account', 'Open Profile')) ?></a>
      </article>
      <article class="metal-panel">
        <p class="section-kicker">Store access</p>
        <h3>Perks follow your account</h3>
        <p class="store-muted">Kit bundles and standalone perks stay tied to Steam and update in game automatically.</p>
        <a class="btn btn-secondary" href="<?= e(route_url('store')) ?>">Open Store</a>
      </article>
      <article class="metal-panel home-discord-card">
        <p class="section-kicker">Discord community</p>
        <h3>Wipe pings, teams, support</h3>
        <p class="store-muted">Find teammates, follow announcements, report bugs, appeal bans, and vote on features.</p>
        <a class="btn btn-discord" href="<?= e($site_config['discordInviteUrl']) ?>" target="_blank" rel="noreferrer" data-track="discord_invite_clicked">Join Discord</a>
      </article>
    </div>
  </div>
</section>
