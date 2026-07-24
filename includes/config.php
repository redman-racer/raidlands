<?php

$raidlands_root = dirname(__DIR__);
$raidlands_env_file = $raidlands_root . '/.env';
$raidlands_env_local_file = $raidlands_root . '/.env.local';
$raidlands_has_env_file = is_file($raidlands_env_file);
$raidlands_has_env_local_file = is_file($raidlands_env_local_file);

raidlands_load_env($raidlands_env_file);
raidlands_load_env($raidlands_env_local_file, true);

$raidlands_status_provider = raidlands_env('RAIDLANDS_SERVER_STATS_PROVIDER', 'raidlands');

if (strcasecmp($raidlands_status_provider, 'battlemetrics') === 0) {
    $raidlands_status_provider = 'raidlands';
}

$site_config = [
    'serverName' => raidlands_env('RAIDLANDS_SERVER_NAME', 'Raidlands 10X'),
    'tagline' => raidlands_env('RAIDLANDS_TAGLINE', 'Progress fast. Raid smarter.'),
    'region' => raidlands_env('RAIDLANDS_REGION', 'US Central'),
    'mapName' => raidlands_env('RAIDLANDS_MAP_NAME', 'Procedural Map'),
    'serverFps' => raidlands_env('RAIDLANDS_SERVER_FPS', 'Stable'),
    'queue' => (string) raidlands_env_int('RAIDLANDS_SERVER_QUEUE', 0),
    'playersOnline' => raidlands_env_int('RAIDLANDS_PLAYERS_ONLINE', 127),
    'maxPlayers' => raidlands_env_int('RAIDLANDS_MAX_PLAYERS', 250),
    'serverOnline' => raidlands_env_bool('RAIDLANDS_SERVER_ONLINE', true),
    'serverStats' => [
        'provider' => $raidlands_status_provider,
        'exchangeSeconds' => raidlands_env_int('RAIDLANDS_SERVER_EXCHANGE_INTERVAL_SECONDS', 30),
        'cacheSeconds' => raidlands_env_int('RAIDLANDS_SERVER_STATUS_CACHE_SECONDS', 30),
        'staleSeconds' => raidlands_env_int('RAIDLANDS_SERVER_STATUS_STALE_SECONDS', 120),
        'sampleRetentionDays' => raidlands_env_int('RAIDLANDS_SERVER_STATUS_SAMPLE_RETENTION_DAYS', 30),
        'replayRetentionDays' => raidlands_env_int('RAIDLANDS_SERVER_MAP_REPLAY_RETENTION_DAYS', 31),
        'hourlyRetentionMonths' => raidlands_env_int('RAIDLANDS_SERVER_STATUS_HOURLY_RETENTION_MONTHS', 24),
    ],
    'connectCommand' => raidlands_env('RAIDLANDS_CONNECT_COMMAND', 'connect raidlands.net:25607'),
    'steamConnectUrl' => raidlands_env('RAIDLANDS_STEAM_CONNECT_URL', 'steam://run/252490//+connect%20raidlands.net:25607/'),
    'discordInviteUrl' => raidlands_env('RAIDLANDS_DISCORD_INVITE_URL', 'https://discord.gg/N6wnHzMhWS'),
    'wipe' => [
        'days' => raidlands_env_int_list('RAIDLANDS_WIPE_DAYS', [4]),
        'dayNames' => raidlands_env_csv('RAIDLANDS_WIPE_DAY_NAMES', ['Thursday']),
        'time' => raidlands_env('RAIDLANDS_WIPE_TIME', '19:00'),
        'timezone' => raidlands_env('RAIDLANDS_WIPE_TIMEZONE', 'Europe/London'),
    ],
];

$admin_panel = [
    'username' => raidlands_env('RAIDLANDS_ADMIN_USERNAME', 'admin'),
    'password' => raidlands_env('RAIDLANDS_ADMIN_PASSWORD', 'change-me'),
    'passwordHash' => raidlands_env('RAIDLANDS_ADMIN_PASSWORD_HASH', ''),
    'sessionKey' => raidlands_env('RAIDLANDS_ADMIN_SESSION_KEY', 'raidlands_admin_authenticated'),
];

$database_config = [
    'dsn' => raidlands_env('RAIDLANDS_DB_DSN', ''),
    'username' => raidlands_env('RAIDLANDS_DB_USER', ''),
    'password' => raidlands_env('RAIDLANDS_DB_PASSWORD', ''),
    'options' => [],
];

$stripe_config = [
    'publishableKey' => raidlands_env('RAIDLANDS_STRIPE_PUBLISHABLE_KEY', ''),
    'secretKey' => raidlands_env('RAIDLANDS_STRIPE_SECRET_KEY', ''),
    'webhookSecret' => raidlands_env('RAIDLANDS_STRIPE_WEBHOOK_SECRET', ''),
    'billingPortalConfigurationId' => raidlands_env('RAIDLANDS_STRIPE_BILLING_PORTAL_CONFIGURATION_ID', ''),
];

$steam_api_config = [
    'apiKey' => raidlands_env('RAIDLANDS_STEAM_API_KEY', ''),
    'baseUrl' => raidlands_env('RAIDLANDS_STEAM_API_BASE_URL', 'https://api.steampowered.com'),
    'cacheSeconds' => raidlands_env_int('RAIDLANDS_STEAM_API_CACHE_SECONDS', 86400),
];

$discord_config = [
    'clientId' => raidlands_env('RAIDLANDS_DISCORD_CLIENT_ID', ''),
    'clientSecret' => raidlands_env('RAIDLANDS_DISCORD_CLIENT_SECRET', ''),
    'botToken' => raidlands_env('RAIDLANDS_DISCORD_BOT_TOKEN', ''),
    'redirectUri' => raidlands_env('RAIDLANDS_DISCORD_REDIRECT_URI', ''),
    'apiBaseUrl' => raidlands_env('RAIDLANDS_DISCORD_API_BASE_URL', 'https://discord.com/api/v10'),
    'timeoutSeconds' => raidlands_env_int('RAIDLANDS_DISCORD_TIMEOUT_SECONDS', 8),
];

$openai_config = [
    'enabled' => raidlands_env_bool('OPENAI_RAIDLANDS_AI_ENABLED', true),
    'apiKey' => raidlands_env('OPENAI_RAIDLANDS_API_KEY', ''),
    'model' => raidlands_env('OPENAI_RAIDLANDS_MODEL', 'gpt-5.4-mini'),
    'timeoutSeconds' => raidlands_env_int('OPENAI_RAIDLANDS_TIMEOUT_SECONDS', 4),
];

$openai_airstrike_agent_config = [
    'enabled' => raidlands_env_bool('OPENAI_RAIDLANDS_AGENT_ENABLED', false),
    'apiKey' => raidlands_env('OPENAI_RAIDLANDS_API_KEY', ''),
    'model' => raidlands_env('OPENAI_RAIDLANDS_AGENT_MODEL', 'gpt-5.6'),
    'timeoutSeconds' => raidlands_env_int('OPENAI_RAIDLANDS_AGENT_TIMEOUT_SECONDS', 180),
    'maxToolRounds' => raidlands_env_int('OPENAI_RAIDLANDS_AGENT_MAX_TOOL_ROUNDS', 8),
];

$vip_bridge_config = [
    'serverId' => raidlands_env('RAIDLANDS_BRIDGE_SERVER_ID', 'raidlands-main'),
    'sharedSecret' => trim(raidlands_env('RAIDLANDS_BRIDGE_SHARED_SECRET', '')),
    'hmacSkewSeconds' => raidlands_env_int('RAIDLANDS_BRIDGE_HMAC_SKEW_SECONDS', 300),
    'statsMaxPlayers' => raidlands_env_int('RAIDLANDS_STATS_MAX_PLAYERS', 5000),
    'statsMaxBots' => raidlands_env_int('RAIDLANDS_STATS_MAX_BOTS', 0),
    'statsStaleSeconds' => raidlands_env_int('RAIDLANDS_STATS_STALE_SECONDS', 900),
    'managedGroups' => raidlands_env_csv('RAIDLANDS_BRIDGE_MANAGED_GROUPS', [
        'rank_vip',
        'rank_vip_plus',
        'rank_mvp',
        'rank_golden_vip',
        'rank_diamond_vip',
        'rank_ultimate_vip',
        'rank_titan_vip',
        'perk_queue_priority',
        'perk_teleport_instant',
        'perk_home_5s',
        'perk_sign_art',
        'perk_chat_title',
        'perk_backpack_36',
        'perk_backpack_42',
        'perk_backpack_48',
        'perk_backpack_keep_death',
        'perk_backpack_keep_wipe',
        'perk_spawn_full',
        'perk_vehicle_hp_125',
        'perk_vehicle_hp_150',
        'perk_tc_12',
        'perk_minicopter_instant_takeoff',
        'perk_shop_sale_25',
        'perk_shop_sale_50',
        'perk_shop_sale_75',
        'vip_bronze',
        'vip_gold',
        'vip_elite',
        'claim_steam_name',
        'claim_steam_group',
        'claim_discord_member',
        'claim_discord_booster',
    ]),
];

$clan_api_config = [
    'rateLimitPerMinute' => raidlands_env_int('RAIDLANDS_CLAN_API_RATE_LIMIT_PER_MINUTE', 60),
    'keyLimitPerPlayer' => raidlands_env_int('RAIDLANDS_CLAN_API_KEY_LIMIT_PER_PLAYER', 5),
];

$primary_nav = [
    ['home', '', 'Home'],
    ['play', 'play', 'Play'],
    ['features', 'features', 'Features'],
    ['rules', 'rules', 'Rules'],
    ['discord', 'discord', 'Discord'],
    ['clans', 'clans', 'Clans'],
    ['link', 'link', 'Sign in with Steam'],
    ['store', 'store', 'Store'],
    ['vote', 'vote', 'Vote'],
    ['rp-games', 'rp-games', 'RP Games'],
    ['leaderboard', 'leaderboard', 'Leaderboards'],
    ['profile', 'profile', 'Profile'],
];

$header_nav = [
    ['link', 'play', 'play', 'Play'],
    ['link', 'server', 'server', 'Server'],
    ['group', 'explore', 'Explore', [
        ['features', 'features', 'Features', 'See what is live on Raidlands'],
        ['events', 'events', 'Events', 'Server events and activities'],
        ['leaderboard', 'leaderboard', 'Leaderboards', 'Wipe rankings and player stats'],
        ['clans', 'clans', 'Clans', 'Clan standings and management'],
    ]],
    ['group', 'community', 'Community', [
        ['rules', 'rules', 'Rules', 'Know the server rules before you raid'],
        ['discord', 'discord', 'Discord', 'News, support, and the community'],
        ['vote', 'vote', 'Vote', 'Support the server and claim rewards'],
        ['rp-games', 'rp-games', 'RP Games', 'Play games with Reward Points'],
    ]],
    ['link', 'store', 'store', 'Store'],
];

$quick_features = [
    ['GATHER', '10X Gather'],
    ['LOOT', '5X Loot'],
    ['SCRAP', '3X Scrap'],
    ['BP', 'No BP Grind'],
    ['TEAM', 'Max Team 16'],
    ['PACK', '6-Slot Backpack'],
    ['RAID', 'Fast Raids'],
    ['STAFF', 'Active Staff'],
];

$feature_icon_aliases = [
    '10x' => 'GATHER',
    '10X' => 'GATHER',
    'GATHER' => 'GATHER',
    'LOOT' => 'LOOT',
    'SCRAP' => 'SCRAP',
    'BP' => 'BP',
    'TEAM' => 'TEAM',
    'PVP' => 'PVP',
    'KIT' => 'KIT',
    'TP' => 'TP',
    'CLAN' => 'CLAN',
    'SKIN' => 'SKIN',
    'PACK' => 'PACK',
    'RAID' => 'RAID',
    'STAFF' => 'STAFF',
    'MINI' => 'MINI',
    'SHOP' => 'SHOP',
    'EVENT' => 'EVENT',
    'FPS' => 'FPS',
    'PLAY' => 'PLAY',
    'CMD' => 'CMD',
    'CHAT' => 'CHAT',
    'SRCH' => 'SRCH',
    'FIX' => 'FIX',
    'ID' => 'ID',
    'ROLE' => 'ROLE',
    'STAT' => 'STAT',
    'STM' => 'ID',
    'DSC' => 'STAFF',
    'SAFE' => 'SAFE',
    'RISK' => 'RISK',
    'BAN' => 'BAN',
    'APPEAL' => 'APPEAL',
    'EVID' => 'EVID',
    'SOON' => 'EVENT',
    'BUG' => 'FIX',
    'EAC' => 'SAFE',
    'TIMEOUT' => 'CMD',
    'TICKET' => 'STAFF',
];

$feature_icon_assets = [
    'GATHER' => 'media/feature-icons/gather.webp',
    'PVP' => 'media/feature-icons/pvp.webp',
    'KIT' => 'media/feature-icons/kit.webp',
    'TP' => 'media/feature-icons/teleport.webp',
    'CLAN' => 'media/feature-icons/clan.webp',
    'SKIN' => 'media/feature-icons/skinbox.webp',
    'PACK' => 'media/feature-icons/backpacks.webp',
    'RAID' => 'media/feature-icons/fast-raids.webp',
    'STAFF' => 'media/feature-icons/active-staff.webp',
    'MINI' => 'media/feature-icons/mini.webp',
    'SHOP' => 'media/feature-icons/shop.webp',
    'EVENT' => 'media/feature-icons/events.webp',
    'FPS' => 'media/feature-icons/performance.webp',
    'PLAY' => 'media/feature-icons/play.webp',
    'CMD' => 'media/feature-icons/command.webp',
    'SRCH' => 'media/feature-icons/search.webp',
    'FIX' => 'media/feature-icons/fix.webp',
    'ID' => 'media/feature-icons/id.webp',
    'ROLE' => 'media/feature-icons/role.webp',
    'STAT' => 'media/feature-icons/stats.webp',
    'SAFE' => 'media/feature-icons/safe.webp',
    'RISK' => 'media/feature-icons/risk.webp',
    'BAN' => 'media/feature-icons/ban.webp',
    'APPEAL' => 'media/feature-icons/appeal.webp',
    'EVID' => 'media/feature-icons/evidence.webp',
];

$feature_icons = [
    'GATHER' => '<path d="M17 43l9-24 14 6 7 18-15 6z"></path><path d="M26 19l-8 24 14 6 8-24z"></path><path d="M14 48l-5 6 9-1 3 6 4-8"></path><path d="M45 45l4 8 7-4-7-5"></path>',
    'PVP' => '<circle cx="32" cy="32" r="18"></circle><circle cx="32" cy="32" r="6"></circle><path d="M32 7v12M32 45v12M7 32h12M45 32h12"></path>',
    'KIT' => '<path d="M13 22l19-9 19 9-19 9z"></path><path d="M13 22v22l19 9 19-9V22"></path><path d="M32 31v22M21 26v14M43 26v14"></path>',
    'TP' => '<path d="M32 9c-9 0-16 7-16 16 0 13 16 30 16 30s16-17 16-30c0-9-7-16-16-16z"></path><circle cx="32" cy="25" r="6"></circle><path d="M15 53c4 4 30 4 34 0"></path>',
    'CLAN' => '<circle cx="32" cy="20" r="7"></circle><circle cx="17" cy="27" r="6"></circle><circle cx="47" cy="27" r="6"></circle><path d="M20 51c1-10 7-16 12-16s11 6 12 16"></path><path d="M7 50c1-8 5-13 10-13M57 50c-1-8-5-13-10-13"></path>',
    'SKIN' => '<path d="M14 20h36v28H14z"></path><path d="M20 14h24l6 6H14z"></path><path d="M23 28h18M23 36h10M42 33l6 6"></path>',
    'PACK' => '<path d="M20 22h24c5 0 8 4 8 9v21H12V31c0-5 3-9 8-9z"></path><path d="M24 22v-5c0-4 3-7 8-7s8 3 8 7v5"></path><path d="M23 34h18v13H23zM12 34H6v12h6M52 34h6v12h-6"></path>',
    'RAID' => '<path d="M32 8l6 15 16-6-8 15 12 10-18 1-8 13-8-13-18-1 12-10-8-15 16 6z"></path><path d="M24 36l-10 12M40 36l10 12"></path>',
    'STAFF' => '<path d="M14 36v-6c0-10 8-18 18-18s18 8 18 18v6"></path><path d="M14 36h8v15h-8zM42 36h8v15h-8z"></path><path d="M42 52c-3 3-7 4-12 4h-4"></path>',
    'MINI' => '<path d="M20 34h22l8 8H15z"></path><path d="M32 16v18M12 16h40M23 49h18M25 42l-4 9M39 42l4 9"></path>',
    'SHOP' => '<path d="M11 17h8l5 24h24l5-16H22"></path><circle cx="28" cy="51" r="4"></circle><circle cx="45" cy="51" r="4"></circle><path d="M26 31h22"></path>',
    'EVENT' => '<path d="M32 8v12M32 44v12M8 32h12M44 32h12"></path><path d="M18 18l8 8M46 18l-8 8M18 46l8-8M46 46l-8-8"></path><circle cx="32" cy="32" r="7"></circle>',
    'FPS' => '<path d="M14 45a20 20 0 1 1 36 0"></path><path d="M32 38l12-15M20 45h24"></path><path d="M19 34h5M40 34h5M32 18v5"></path>',
    'PLAY' => '<path d="M22 14l28 18-28 18z"></path>',
    'CMD' => '<path d="M12 16h40v32H12z"></path><path d="M20 27l7 5-7 5M32 38h12"></path>',
    'CHAT' => '<path d="M13 18h38c3 0 5 2 5 5v21c0 3-2 5-5 5H31l-12 8v-8h-6c-3 0-5-2-5-5V23c0-3 2-5 5-5z"></path><path d="M21 30h22M21 39h14"></path><path d="M47 18l5-8M38 18l2-9M55 27l6-3"></path>',
    'SRCH' => '<circle cx="28" cy="28" r="14"></circle><path d="M39 39l12 12"></path>',
    'FIX' => '<path d="M42 12l10 10-26 26-13 4 4-13z"></path><path d="M35 19l10 10"></path>',
    'ID' => '<path d="M12 18h40v28H12z"></path><circle cx="25" cy="32" r="6"></circle><path d="M35 27h10M35 34h10M20 42c2-4 8-4 10 0"></path>',
    'ROLE' => '<path d="M32 10l18 8v13c0 12-8 19-18 23-10-4-18-11-18-23V18z"></path><path d="M23 32l6 6 13-14"></path>',
    'STAT' => '<path d="M14 50V34M26 50V24M38 50V30M50 50V16"></path><path d="M10 50h46"></path>',
    'SAFE' => '<path d="M32 10l18 8v13c0 12-8 19-18 23-10-4-18-11-18-23V18z"></path><path d="M24 32l6 6 11-13"></path>',
    'RISK' => '<path d="M32 10l22 40H10z"></path><path d="M32 24v13M32 45h.01"></path>',
    'BAN' => '<circle cx="32" cy="32" r="20"></circle><path d="M18 46l28-28"></path>',
    'APPEAL' => '<path d="M16 12h28l8 8v32H16z"></path><path d="M44 12v8h8M24 32h18M24 41h13"></path>',
    'EVID' => '<path d="M14 16h36v34H14z"></path><path d="M21 25h22M21 34h22M21 43h12"></path>',
];

$status_icons = [
    'players' => '<circle cx="23" cy="25" r="7"></circle><circle cx="42" cy="25" r="7"></circle><path d="M11 51c1-10 6-17 12-17s11 7 12 17"></path><path d="M29 51c1-10 6-17 13-17s11 7 12 17"></path>',
    'health' => '<path d="M32 10l18 8v13c0 12-8 19-18 23-10-4-18-11-18-23V18z"></path><path d="M23 33l6 6 13-15"></path>',
    'map' => '<path d="M12 15l14-5 12 5 14-5v39l-14 5-12-5-14 5z"></path><path d="M26 10v39M38 15v39"></path><path d="M17 28l7-3 8 5 8-4 7 3"></path>',
    'wipe' => '<path d="M15 16h34v36H15z"></path><path d="M15 26h34M23 11v10M41 11v10"></path><path d="M24 36h5M35 36h5M24 45h5M35 45h5"></path>',
    'cycle' => '<path d="M47 22a18 18 0 0 0-31-4"></path><path d="M47 12v10H37"></path><path d="M17 42a18 18 0 0 0 31 4"></path><path d="M17 52V42h10"></path>',
    'region' => '<circle cx="32" cy="32" r="20"></circle><path d="M12 32h40M32 12c7 7 10 14 10 20s-3 13-10 20M32 12c-7 7-10 14-10 20s3 13 10 20"></path>',
];

$action_icons = [
    'arrow' => '<path d="M18 32h28"></path><path d="M34 18l14 14-14 14"></path>',
    'copy' => '<path d="M22 18h24v30H22z"></path><path d="M16 26h-2v26h24v-2"></path>',
    'discord' => '<path d="M20 24c8-5 16-5 24 0l3 22c-5 4-10 6-15 6s-10-2-15-6z"></path><path d="M23 24l3-6M41 24l-3-6"></path><circle cx="26" cy="36" r="2"></circle><circle cx="38" cy="36" r="2"></circle><path d="M28 44c3 2 5 2 8 0"></path>',
];

$feature_cards = [
    ['10X', '10X Gather', 'Player gathering and production from excavators, quarries, pumpjacks, and surveys run at 10X.', 'Live'],
    ['LOOT', '5X Loot', 'Loot is tuned to 5X, with components at approximately 5X quantity and 10X stack size.', 'Live'],
    ['SCRAP', '3X Scrap', 'Scrap and raid-resource progression are tuned around approximately 3X pacing.', 'Live'],
    ['KIT', 'Synced Kits', 'Active kits publish their exact server-owned contents, uses, and cooldowns.', 'Live'],
    ['TP', 'Teleport / Homes', 'Move between bases, fights, teammates, and rebuilds without dead time.', 'Live'],
    ['TEAM', 'Max Team 16', 'Teams are capped at 16 players for coordinated progression and raid play.', 'Live'],
    ['PACK', 'Backpacks', 'Everyone receives six slots and keeps backpack contents on death; VIP tiers expand capacity.', 'Live'],
    ['BP', 'No BP Grind', 'Blueprint progression is unlocked so wipe time goes into building, fighting, and raiding.', 'Live'],
    ['STACK', 'Progression Stacks', 'Configured stacks reach approximately 500k; C4 and rockets are capped at 120 per inventory stack.', 'Live'],
    ['CRATE', 'Crate Explosives', 'Locked, helicopter, and Bradley crates can contain limited direct C4 and rockets.', 'Live'],
    ['STAFF', 'Active Staff', 'Clear support, bug response, and rule enforcement without over-policing PvP.', 'Live'],
    ['FPS', 'Performance Focused', 'Lean systems and practical moderation built around stable wipe nights.', 'Live'],
];

$progression_rates = [
    ['10X', 'Player gather', 'Resources gathered directly by players.'],
    ['10X', 'Production', 'Excavator, quarry, pumpjack, and survey production.'],
    ['5X', 'Loot', 'General loot pacing across the server.'],
    ['≈5X', 'Components', 'Approximate component quantity, with 10X component stacks.'],
    ['3X', 'Scrap', 'Scrap progression across loot sources.'],
    ['≈3X', 'Raid progression', 'Sulfur, gunpowder, explosives, C4, and rocket progression.'],
    ['500K', 'Configured stacks', 'Approximate maximum where the stack configuration applies.'],
    ['120', 'C4 / rocket stacks', 'Inventory stack cap for C4 and rockets.'],
];

$progression_rules = [
    'No blueprint grind.',
    'Maximum team size: 16.',
    'Accelerated crafting and smelting.',
    'Limited direct C4 and rockets can appear in locked, helicopter, and Bradley crates.',
    'Six backpack slots and keep-on-death are available to everyone.',
    'Spendable RP resets only on force wipe.',
];

$feature_groups = [
    [
        'title' => 'Progression and Raiding',
        'copy' => 'A clear 10X gather, 5X loot, and 3X scrap model keeps progression fast while direct raid materials remain deliberately limited.',
        'items' => ['10X gather and production', '5X loot', '10X component stacks', '3X scrap', 'Limited crate explosives', 'Thursday wipes'],
    ],
    [
        'title' => 'Movement and Convenience',
        'copy' => 'The convenience layer removes the slow parts without removing the need to fight, defend, and counter.',
        'items' => ['Teleport', 'Homes', 'Backpacks', 'Vehicle access', 'Accelerated crafting', 'Quick recycling'],
    ],
    [
        'title' => 'Community and Clans',
        'copy' => 'Raidlands is built around recurring rivalries, Discord, support channels, clans, events, and wipe alerts.',
        'items' => ['Clans', 'Team play', 'Discord account', 'Events', 'Staff support', 'Wipe alerts'],
    ],
    [
        'title' => 'Player Tools',
        'copy' => 'Steam-linked tools help players check their stats, rewards, access, and server status without guessing what is attached to their account.',
        'items' => ['Steam account linking', 'Player profiles', 'Leaderboards', 'Wipe stats', 'Server status', 'Store access'],
    ],
    [
        'title' => 'Store and Rewards',
        'copy' => 'Store and reward systems connect VIP access, perks, kits, and earned rewards to the same Steam identity.',
        'items' => ['VIP tiers', 'VIP kits', 'One-time perks', 'RP rewards', 'Vote rewards', 'In-game delivery'],
    ],
    [
        'title' => 'Trust and Performance',
        'copy' => 'A progression-focused PvP server still needs clear enforcement, quick fixes, and a stable base for busy wipe nights.',
        'items' => ['Active admins', 'Anti-cheat stance', 'Bug patches', 'Server performance', 'Clear rules', 'Appeal path'],
    ],
];

$roadmap_cards = [
    ['Leaderboards', 'Player rankings for combat, raid pressure, playtime, and RP pulled from the game server.', 'Live'],
    ['Player Profiles', 'Steam-linked profiles show active access, wipe stats, RP, and account history.', 'Live'],
    ['Account Linking', 'Steam sign-in keeps stats, purchases, rewards, and perks attached to the right Rust player.', 'Live'],
    ['Store Kits', 'Kit bundles, individual kits, and standalone perks are tied to Steam and delivered in game.', 'Live'],
    ['Clans', 'Clan play and rivalries are active in game, with roster tools for linked players.', 'Live in game'],
    ['Wipe Events', 'Wipe fights, clan clashes, staff battles, and community chaos are part of the live cadence.', 'Live in game'],
    ['Vote Rewards', 'Vote for Raidlands, then claim linked-account RP after server confirmation.', 'Live'],
    ['Appeals and Support', 'Discord remains the active path for tickets, reports, and ban appeals.', 'Live via Discord'],
];

$page_copy = [
    'home' => [
        'title' => 'Raidlands 10X Rust',
        'lede' => '10X gathering, 5X loot, 3X scrap, no blueprint grind, and progression-focused Thursday wipes.',
    ],
    'play' => [
        'title' => 'Play Raidlands 10X',
        'lede' => "Use Steam connect, copy the console command, or search Raidlands 10X in Rust's modded browser.",
    ],
    'features' => [
        'title' => 'Raidlands 10X Features',
        'lede' => 'Clear 10X/5X/3X progression, balanced kits, predictable wipes, account-linked perks, and synced stats.',
    ],
    'server' => [
        'title' => 'Raidlands 10X Server Status',
        'lede' => 'Live Raidlands 10X population, queue, map, wipe, and performance details from the game server.',
    ],
    'rules' => [
        'title' => 'Raidlands 10X Rules',
        'lede' => 'Raidlands 10X is a progression-focused PvP server. Raiding, counters, roofcamping, and revenge raids are part of Rust; cheating, exploits, and real-world threats are not.',
    ],
    'discord' => [
        'title' => 'Raidlands 10X Discord',
        'lede' => 'Get wipe alerts, find teammates, report bugs, open tickets, appeal bans, and vote on what the server becomes next.',
    ],
    'link' => [
        'title' => 'Raidlands 10X Account',
        'lede' => 'Sign in with Steam so wipe stats, rewards, roles, and store access follow the right Rust player.',
    ],
    'support' => [
        'title' => 'Raidlands 10X Support',
        'lede' => 'Connection help, bug reports, staff contact, and appeal direction for Raidlands 10X players.',
    ],
    'privacy' => [
        'title' => 'Raidlands 10X Privacy Policy',
        'lede' => 'How Raidlands 10X handles website, Steam, Discord, support, analytics, and account data.',
    ],
    'terms' => [
        'title' => 'Raidlands 10X Terms of Service',
        'lede' => 'Server access, account linking, bans, rules, appeals, and supporter systems.',
    ],
    'leaderboard' => [
        'title' => 'Raidlands 10X Leaderboards',
        'lede' => 'Current-wipe and all-time rankings for combat, raid pressure, playtime, and wipe-earned RP.',
    ],
    'store' => [
        'title' => 'Raidlands 10X Store',
        'lede' => 'Balanced VIP kits, larger backpacks, queue access, movement perks, and verified pack redemptions tied to Steam.',
    ],
    'events' => [
        'title' => 'Raidlands 10X Events',
        'lede' => 'Wipe fights, clan wars, staff events, and community chaos live through the server and Discord.',
    ],
    'clans' => [
        'title' => 'Raidlands 10X Clans',
        'lede' => 'View your synced clan roster, queue invites or roster changes, and manage API keys from your linked Steam account.',
    ],
    'api-docs' => [
        'title' => 'Raidlands 10X Clan API Docs',
        'lede' => 'Public clan API authentication, rate limits, and request shapes for websites, bots, and Discord tools.',
    ],
    'vote' => [
        'title' => 'Raidlands 10X Vote Rewards',
        'lede' => 'Vote for Raidlands 10X, claim linked-account RP rewards, and help more Rust players find the server.',
    ],
    'rp-games' => [
        'title' => 'Raidlands 10X RP Games',
        'lede' => 'Use in-game Raidlands 10X RP on server-confirmed coinflip, dice, jackpot, High-Low, and Wheel rounds with clear odds and limits.',
    ],
    'bans' => [
        'title' => 'Raidlands 10X Bans and Appeals',
        'lede' => 'Ban policy, appeal direction, and Discord-first moderation support.',
    ],
    'profile' => [
        'title' => 'Raidlands 10X Player Profile',
        'lede' => 'View your connected Steam account, active kits, perks, RP, subscriptions, stats, and access history.',
    ],
];

$seo_pages = [
    'home' => [
        'title' => 'Raidlands 10X Rust Server | 5X Loot, Kits, TP, Clans',
        'description' => 'Join Raidlands 10X for 10X gathering, 5X loot, 3X scrap, no blueprint grind, balanced kits, maximum teams of 16, and Thursday wipes.',
        'ogTitle' => 'Raidlands 10X Rust Server',
        'ogDescription' => '10X gathering, 5X loot, 3X scrap, and fast progression with room for meaningful raids.',
    ],
    'play' => [
        'title' => 'Play Raidlands 10X | Join the Rust Server',
        'description' => 'Join Raidlands 10X with one-click Steam connect, console command copy, or Rust modded server browser search.',
        'ogTitle' => 'Play Raidlands 10X',
        'ogDescription' => 'Launch Rust, copy the connect command, or find Raidlands 10X in the modded server browser.',
    ],
    'features' => [
        'title' => 'Raidlands 10X Features | 10X Gather and 5X Loot',
        'description' => 'See the Raidlands 10X progression model: 10X gathering and production, 5X loot, 3X scrap, balanced kits, backpacks, clans, and fast raids.',
        'ogTitle' => 'Raidlands 10X Features',
        'ogDescription' => 'A clear 10X/5X/3X Rust progression model with balanced convenience and raid pacing.',
    ],
    'server' => [
        'title' => 'Raidlands 10X Server Status | Live Population and Map',
        'description' => 'Check Raidlands 10X server status, population, queue, map, wipe timing, and performance details from the live game server.',
        'ogTitle' => 'Raidlands 10X Server Status',
        'ogDescription' => 'Live Raidlands 10X status, queue, map, and performance details.',
    ],
    'rules' => [
        'title' => 'Raidlands 10X Rules | Rust Server and Discord Rules',
        'description' => 'Read the Raidlands 10X server rules, Discord rules, enforcement policy, and appeal path.',
        'ogTitle' => 'Raidlands 10X Rules',
        'ogDescription' => 'Progression-focused PvP with clear limits: no cheats, exploits, threats, doxxing, or staff impersonation.',
    ],
    'discord' => [
        'title' => 'Raidlands 10X Discord | Wipe Alerts, Support, Teams',
        'description' => 'Join the Raidlands 10X Discord for wipe alerts, teammate finding, support, feature votes, event notices, and ban appeals.',
        'ogTitle' => 'Raidlands 10X Discord',
        'ogDescription' => 'Get wipe pings, find teammates, report bugs, and stay connected with the Raidlands 10X community.',
    ],
    'link' => [
        'title' => 'Link Raidlands 10X Account | Steam and Discord',
        'description' => 'Sign in with Steam for Raidlands 10X leaderboards, rewards, roles, store access, and player profiles.',
        'ogTitle' => 'Link Raidlands 10X Account',
        'ogDescription' => 'Sign in with Steam for Raidlands 10X profiles, rewards, store access, and wipe stats.',
    ],
    'support' => [
        'title' => 'Raidlands 10X Support | Tickets, Bugs, Connection Help',
        'description' => 'Get help with Raidlands 10X connection issues, support tickets, bug reports, and Discord staff contact.',
        'ogTitle' => 'Raidlands 10X Support',
        'ogDescription' => 'Connection troubleshooting, bug reports, appeals, and staff contact for Raidlands 10X.',
    ],
    'privacy' => [
        'title' => 'Raidlands 10X Privacy Policy',
        'description' => 'Raidlands 10X privacy policy for website analytics, Steam linking, Discord linking, support, and community systems.',
        'ogTitle' => 'Raidlands 10X Privacy Policy',
        'ogDescription' => 'How Raidlands 10X handles website, Steam, Discord, and support data.',
    ],
    'terms' => [
        'title' => 'Raidlands 10X Terms of Service',
        'description' => 'Raidlands 10X terms covering server access, account linking, bans, appeals, rules, and supporter systems.',
        'ogTitle' => 'Raidlands 10X Terms',
        'ogDescription' => 'Terms for using the Raidlands 10X website, Rust server, Discord, and account systems.',
    ],
    'leaderboard' => [
        'title' => 'Raidlands 10X Leaderboards | Kills, K/D, Playtime, RP',
        'description' => 'View Raidlands 10X player leaderboards for current-wipe and all-time kills, K/D, playtime, and wipe-earned RP.',
        'ogTitle' => 'Raidlands 10X Leaderboards',
        'ogDescription' => 'Current-wipe and all-time rankings for Raidlands 10X players.',
    ],
    'store' => [
        'title' => 'Raidlands 10X Store | VIP Kits and Verified Perks',
        'description' => 'Buy Raidlands 10X VIP access, server-synced kits, larger backpacks, queue access, and verified standalone perks tied to your Steam account.',
        'ogTitle' => 'Raidlands 10X Store',
        'ogDescription' => 'Server-synced VIP kits and verified perks for the Raidlands 10X Rust server.',
    ],
    'events' => [
        'title' => 'Raidlands 10X Events | Wipe Fights and Clan Wars',
        'description' => 'Raidlands 10X events cover wipe fights, clan wars, community votes, and server announcements.',
        'ogTitle' => 'Raidlands 10X Events',
        'ogDescription' => 'Wipe events and community battles for Raidlands 10X.',
    ],
    'clans' => [
        'title' => 'Raidlands 10X Clans | Team Play and Rivalries',
        'description' => 'Manage Raidlands 10X clan rosters, invites, and public clan API keys with a linked Steam account.',
        'ogTitle' => 'Raidlands 10X Clans',
        'ogDescription' => 'Steam-linked clan roster tools and public API access for Raidlands 10X.',
    ],
    'api-docs' => [
        'title' => 'Raidlands 10X Clan API Documentation',
        'description' => 'Use the Raidlands 10X public clan API with Steam-linked API keys, safe rate limits, and clan management endpoints.',
        'ogTitle' => 'Raidlands 10X Clan API',
        'ogDescription' => 'Public clan API docs for Raidlands 10X websites, bots, and Discord tools.',
    ],
    'vote' => [
        'title' => 'Raidlands 10X Vote Rewards',
        'description' => 'Claim Raidlands 10X vote rewards with a linked Steam account and server-confirmed in-game RP credits.',
        'ogTitle' => 'Raidlands 10X Vote Rewards',
        'ogDescription' => 'Vote for Raidlands 10X and claim linked-account RP rewards.',
    ],
    'rp-games' => [
        'title' => 'Raidlands 10X RP Games | Blackjack, Roulette and More',
        'description' => 'Play Raidlands 10X Blackjack, European Roulette, Slots, coinflip, dice, jackpot, and multiplayer games with in-game RP and server-confirmed point changes.',
        'ogTitle' => 'Raidlands 10X RP Games',
        'ogDescription' => 'In-game RP games for linked Raidlands 10X players, with clear odds and server-confirmed point changes.',
    ],
    'bans' => [
        'title' => 'Raidlands 10X Bans and Appeals',
        'description' => 'Raidlands 10X ban policy, appeal path, and Discord-first moderation support.',
        'ogTitle' => 'Raidlands 10X Bans',
        'ogDescription' => 'Ban policy and appeal information for Raidlands 10X.',
    ],
    'profile' => [
        'title' => 'Raidlands 10X Profile | Store Access and Steam Account',
        'description' => 'View your connected Raidlands 10X Steam account, active kits, perks, RP, stats, subscriptions, and expirations.',
        'ogTitle' => 'Raidlands 10X Profile',
        'ogDescription' => 'Check active Raidlands 10X kits, perks, RP, and stats for your Steam account.',
    ],
];

$future_pages = [
    'leaderboard' => [
        ['Kills', 'Top killers and wipe MVP contenders.'],
        ['Raids Won', 'Base breaks, counters, and explosive pressure.'],
        ['Clan Rankings', 'Team-wide performance and wipe history.'],
    ],
    'events' => [
        ['Wipe Fights', 'Thursday event hooks and staff-led battles are part of the live server cadence.'],
        ['Clan Wars', 'Scheduled rivalries and community brackets can be posted here as seasons unfold.'],
        ['Community Votes', 'Active players can steer event formats through Discord.'],
    ],
    'clans' => [
        ['Recruitment', 'In-game clans can organize rosters, invites, and member discovery through Raidlands.'],
        ['Rivalries', 'Wipe-long conflicts and archived wins grow from live clan play.'],
        ['Rankings', 'Team stats can support public clan standings as seasons develop.'],
    ],
    'vote' => [
        ['Vote Rewards', 'Voting for Raidlands can earn linked-account RP after server confirmation.'],
        ['Connected Accounts', 'Steam linking keeps rewards attached to the right Rust player.'],
        ['Growth', 'Voting helps more players find active wipe nights.'],
    ],
    'profile' => [
        ['Steam Account', 'Store and reward ownership.'],
        ['Discord Account', 'Community roles and support.'],
        ['Wipe History', 'Stats, rewards, and season records from live seasons.'],
    ],
];

$raidlands_secrets_file = $raidlands_root . '/data/raidlands-secrets.php';

if (!$raidlands_has_env_file && !$raidlands_has_env_local_file && is_file($raidlands_secrets_file)) {
    require $raidlands_secrets_file;
}

$raidlands_content_file = $raidlands_root . '/data/site-content.json';
$raidlands_10x_release_defaults = [
    'site_config' => $site_config,
    'quick_features' => $quick_features,
    'feature_cards' => $feature_cards,
    'roadmap_cards' => $roadmap_cards,
    'page_copy' => $page_copy,
    'seo_pages' => $seo_pages,
];
$raidlands_content_overrides = raidlands_load_site_content($raidlands_content_file);

if ($raidlands_content_overrides !== []) {
    raidlands_apply_content_overrides($raidlands_content_overrides);
}

raidlands_enforce_10x_release_content($raidlands_10x_release_defaults);

unset($raidlands_content_overrides, $raidlands_10x_release_defaults);

$site_config['steamConnectUrl'] = raidlands_normalize_steam_connect_url(
    (string) ($site_config['steamConnectUrl'] ?? ''),
    (string) ($site_config['connectCommand'] ?? '')
);

function raidlands_normalize_steam_connect_url(string $configured_url, string $connect_command): string
{
    $configured_url = trim($configured_url);

    if ($configured_url !== '' && stripos($configured_url, 'steam://connect/') !== 0) {
        return $configured_url;
    }

    $server_address = trim((string) preg_replace('/^(?:client\.)?connect\s+/i', '', trim($connect_command)));

    if ($server_address === '' && stripos($configured_url, 'steam://connect/') === 0) {
        $server_address = trim(substr($configured_url, strlen('steam://connect/')), '/');
    }

    if ($server_address === '' || preg_match('/[\s\x00-\x1F]/', $server_address)) {
        return $configured_url;
    }

    return 'steam://run/252490//+connect%20' . $server_address . '/';
}

function raidlands_load_site_content(string $path): array
{
    if (!is_file($path)) {
        return [];
    }

    $decoded = json_decode((string) @file_get_contents($path), true);

    return is_array($decoded) ? $decoded : [];
}

function raidlands_apply_content_overrides(array $content): void
{
    global $site_config, $quick_features, $feature_cards, $roadmap_cards, $page_copy, $seo_pages;

    if (isset($content['site_config']) && is_array($content['site_config'])) {
        $site_config = raidlands_merge_assoc($site_config, $content['site_config']);
    }

    if (isset($content['page_copy']) && is_array($content['page_copy'])) {
        $page_copy = raidlands_merge_assoc($page_copy, $content['page_copy']);
    }

    if (isset($content['seo_pages']) && is_array($content['seo_pages'])) {
        $seo_pages = raidlands_merge_assoc($seo_pages, $content['seo_pages']);
    }

    foreach ([
        'quick_features' => 'quick_features',
        'feature_cards' => 'feature_cards',
        'roadmap_cards' => 'roadmap_cards',
    ] as $content_key => $global_name) {
        if (isset($content[$content_key]) && is_array($content[$content_key])) {
            ${$global_name} = $content[$content_key];
        }
    }
}

function raidlands_enforce_10x_release_content(array $defaults): void
{
    global $site_config, $quick_features, $feature_cards, $roadmap_cards, $page_copy, $seo_pages;

    $contains_retired_copy = static function ($value) use (&$contains_retired_copy): bool {
        if (is_array($value)) {
            foreach ($value as $nested) {
                if ($contains_retired_copy($nested)) {
                    return true;
                }
            }

            return false;
        }

        if (!is_scalar($value)) {
            return false;
        }

        return preg_match(
            '/1000\s*x|battlefield|instant[\s-]+progression|unlimited[\s-]+resources|standalone[\s-]+roam[\s-]*bots?/i',
            (string) $value
        ) === 1;
    };

    $default_site = (array) ($defaults['site_config'] ?? []);

    foreach (['serverName', 'tagline'] as $key) {
        if (array_key_exists($key, $default_site)) {
            $site_config[$key] = $default_site[$key];
        }
    }

    if ($contains_retired_copy($site_config['mapName'] ?? null) && array_key_exists('mapName', $default_site)) {
        $site_config['mapName'] = $default_site['mapName'];
    }

    $quick_features = array_values((array) ($defaults['quick_features'] ?? []));
    $feature_cards = array_values((array) ($defaults['feature_cards'] ?? []));
    $roadmap_cards = array_values((array) ($defaults['roadmap_cards'] ?? []));
    $page_copy = (array) ($defaults['page_copy'] ?? []);
    $seo_pages = (array) ($defaults['seo_pages'] ?? []);
}

function raidlands_merge_assoc(array $base, array $overrides): array
{
    foreach ($overrides as $key => $value) {
        if (is_array($value) && isset($base[$key]) && is_array($base[$key]) && raidlands_is_assoc($value)) {
            $base[$key] = raidlands_merge_assoc($base[$key], $value);
            continue;
        }

        $base[$key] = $value;
    }

    return $base;
}

function raidlands_is_assoc(array $value): bool
{
    if ($value === []) {
        return false;
    }

    return array_keys($value) !== range(0, count($value) - 1);
}

function raidlands_load_env(string $path, bool $override = false): void
{
    if (!is_file($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES);

    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);

        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        if (str_starts_with($line, 'export ')) {
            $line = trim(substr($line, 7));
        }

        $separator = strpos($line, '=');

        if ($separator === false) {
            continue;
        }

        $key = trim(substr($line, 0, $separator));

        if ($key === '' || !preg_match('/^[A-Z0-9_]+$/i', $key)) {
            continue;
        }

        if (!$override && getenv($key) !== false) {
            continue;
        }

        $value = raidlands_parse_env_value(trim(substr($line, $separator + 1)));

        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
}

function raidlands_parse_env_value(string $value): string
{
    if ($value === '') {
        return '';
    }

    $quote = $value[0];

    if (($quote === '"' || $quote === "'") && substr($value, -1) === $quote) {
        $inner = substr($value, 1, -1);

        return $quote === '"' ? stripcslashes($inner) : str_replace("\\'", "'", $inner);
    }

    $comment = strpos($value, ' #');

    if ($comment !== false) {
        $value = substr($value, 0, $comment);
    }

    return trim($value);
}

function raidlands_env(string $key, string $default = ''): string
{
    $value = getenv($key);

    return $value === false ? $default : (string) $value;
}

function raidlands_env_int(string $key, int $default): int
{
    $value = trim(raidlands_env($key));

    return $value === '' || !is_numeric($value) ? $default : (int) $value;
}

function raidlands_env_bool(string $key, bool $default): bool
{
    $value = strtolower(trim(raidlands_env($key)));

    if (in_array($value, ['1', 'true', 'yes', 'on'], true)) {
        return true;
    }

    if (in_array($value, ['0', 'false', 'no', 'off'], true)) {
        return false;
    }

    return $default;
}

function raidlands_env_csv(string $key, array $default): array
{
    $value = trim(raidlands_env($key));

    if ($value === '') {
        return $default;
    }

    $items = array_filter(array_map('trim', explode(',', $value)), static fn ($item) => $item !== '');

    return array_values($items);
}

function raidlands_env_int_list(string $key, array $default): array
{
    $values = raidlands_env_csv($key, []);

    if ($values === []) {
        return $default;
    }

    return array_map(static fn ($value) => (int) $value, $values);
}
