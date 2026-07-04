-- Raidlands VIP kits, groups, permissions, and product seed.
-- Generated from raidlands_vip_kits_permissions_mapping_with_claimables_plugin_aligned.xlsx.

SET @rollout_revision := UNIX_TIMESTAMP();

INSERT INTO oxide_groups
  (group_name, title, group_rank, parent_group, category, is_managed, is_protected, is_read_only, is_active, sort_order, notes, draft_revision, published_revision, published_at, deleted_at, deleted_revision)
VALUES
  ('default', 'default', 0, '', 'public', 1, 1, 0, 1, 10, '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('discord', 'discord', 0, '', 'public', 1, 1, 0, 1, 20, '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('rank_vip', 'rank_vip', 10, '', 'rank', 1, 0, 0, 1, 110, 'Add to WebsiteVipBridge ManagedGroups + KitPermissionManagedGroups.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('rank_vip_plus', 'rank_vip_plus', 20, '', 'rank', 1, 0, 0, 1, 120, 'Add to WebsiteVipBridge ManagedGroups + KitPermissionManagedGroups.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('rank_mvp', 'rank_mvp', 30, '', 'rank', 1, 0, 0, 1, 130, 'Add to WebsiteVipBridge ManagedGroups + KitPermissionManagedGroups.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('rank_golden_vip', 'rank_golden_vip', 40, '', 'rank', 1, 0, 0, 1, 140, 'Add to WebsiteVipBridge ManagedGroups + KitPermissionManagedGroups.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('rank_diamond_vip', 'rank_diamond_vip', 50, '', 'rank', 1, 0, 0, 1, 150, 'Add to WebsiteVipBridge ManagedGroups + KitPermissionManagedGroups.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('rank_ultimate_vip', 'rank_ultimate_vip', 60, '', 'rank', 1, 0, 0, 1, 160, 'Add to WebsiteVipBridge ManagedGroups + KitPermissionManagedGroups.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('rank_titan_vip', 'rank_titan_vip', 70, '', 'rank', 1, 0, 0, 1, 170, 'Add to WebsiteVipBridge ManagedGroups + KitPermissionManagedGroups.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_queue_priority', 'perk_queue_priority', 0, '', 'perk', 1, 0, 0, 1, 180, 'BypassQueue is staged; verify live queue bypass before final approval.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_teleport_instant', 'perk_teleport_instant', 0, '', 'perk', 1, 0, 0, 1, 190, 'Map to NTeleportation VIP countdown/cooldown keys.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_home_5s', 'perk_home_5s', 0, '', 'perk', 1, 0, 0, 1, 200, 'NTeleportation supports VIP home cooldown/countdown permissions.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_sign_art', 'perk_sign_art', 0, '', 'perk', 1, 0, 0, 1, 210, 'SignArtist is staged; verify /sil before final approval.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_chat_title', 'perk_chat_title', 0, '', 'perk', 1, 0, 0, 1, 220, 'Use BetterChat group/title data.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_backpack_36', 'perk_backpack_36', 0, '', 'perk', 1, 0, 0, 1, 230, 'Uses current Backpacks permission size support.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_backpack_42', 'perk_backpack_42', 0, '', 'perk', 1, 0, 0, 1, 240, 'Uses current Backpacks permission size support.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_backpack_48', 'perk_backpack_48', 0, '', 'perk', 1, 0, 0, 1, 250, 'Uses current Backpacks permission size support.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_backpack_keep_death', 'perk_backpack_keep_death', 0, '', 'perk', 1, 0, 0, 1, 260, 'Ensure death retention is permission-gated, not global.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_backpack_keep_wipe', 'perk_backpack_keep_wipe', 0, '', 'perk', 1, 0, 0, 1, 270, 'Force wipe excluded; configure wipe ruleset permission.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_spawn_full', 'perk_spawn_full', 0, '', 'perk', 1, 0, 0, 1, 280, 'Needs custom spawn hook if no existing plugin handles this.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_vehicle_hp_125', 'perk_vehicle_hp_125', 0, '', 'perk', 1, 0, 0, 1, 290, 'Can be custom vehicle spawn wrapper or per-vehicle config.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_vehicle_hp_150', 'perk_vehicle_hp_150', 0, '', 'perk', 1, 0, 0, 1, 300, 'Can be custom vehicle spawn wrapper or per-vehicle config.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_tc_12', 'perk_tc_12', 0, '', 'perk', 1, 0, 0, 1, 310, 'CupboardLimiter custom limit permission after config change.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_minicopter_instant_takeoff', 'perk_minicopter_instant_takeoff', 0, '', 'perk', 1, 0, 0, 1, 320, 'SpawnHeli supports permission-gated instant takeoff.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_shop_sale_25', 'perk_shop_sale_25', 0, '', 'perk', 1, 0, 0, 1, 330, 'Exclude ranks, perks, RP, and subscriptions from discount loops.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_shop_sale_50', 'perk_shop_sale_50', 0, '', 'perk', 1, 0, 0, 1, 340, 'Exclude ranks, perks, RP, and subscriptions from discount loops.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('perk_shop_sale_75', 'perk_shop_sale_75', 0, '', 'perk', 1, 0, 0, 1, 350, 'Exclude ranks, perks, RP, and subscriptions from discount loops.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('vip_bronze', 'vip_bronze', 0, '', 'legacy', 1, 0, 0, 1, 360, 'Replace or alias to new rank_vip/rank_vip_plus model.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('vip_gold', 'vip_gold', 0, '', 'legacy', 1, 0, 0, 1, 370, 'Replace or alias to new rank_golden_vip model.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('vip_elite', 'vip_elite', 0, '', 'legacy', 1, 0, 0, 1, 380, 'Replace or alias to rank_ultimate_vip/rank_titan_vip model.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('claim_steam_name', 'claim_steam_name', 0, '', 'claim', 1, 0, 0, 1, 390, 'Grant when linked Steam name contains Scrapland.GG.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('claim_steam_group', 'claim_steam_group', 0, '', 'claim', 1, 0, 0, 1, 400, 'Grant when linked account is in Steam group.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('claim_discord_member', 'claim_discord_member', 0, '', 'claim', 1, 0, 0, 1, 410, 'Grant after Discord link/member role check.', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('claim_discord_booster', 'claim_discord_booster', 0, '', 'claim', 1, 0, 0, 1, 420, 'Grant through Discord role/boost sync; should coexist with member entitlement.', @rollout_revision, @rollout_revision, NOW(), NULL, 0)
ON DUPLICATE KEY UPDATE
  title = VALUES(title), group_rank = VALUES(group_rank), parent_group = VALUES(parent_group),
  category = VALUES(category), is_managed = VALUES(is_managed), is_protected = VALUES(is_protected),
  is_read_only = VALUES(is_read_only), is_active = VALUES(is_active), sort_order = VALUES(sort_order),
  notes = VALUES(notes), draft_revision = VALUES(draft_revision), published_revision = VALUES(published_revision),
  published_at = NOW(), deleted_at = NULL, deleted_revision = 0, updated_at = NOW();

INSERT INTO oxide_permissions
  (permission_name, plugin_name, permission_prefix, source, is_active, last_seen_at)
VALUES
  ('backpacks.keepondeath', 'Backpacks', 'backpacks', 'workbook', 1, NOW()),
  ('backpacks.keeponwipe.all', 'Backpacks', 'backpacks', 'workbook', 1, NOW()),
  ('backpacks.size.36', 'Backpacks', 'backpacks', 'workbook', 1, NOW()),
  ('backpacks.size.42', 'Backpacks', 'backpacks', 'workbook', 1, NOW()),
  ('backpacks.size.48', 'Backpacks', 'backpacks', 'workbook', 1, NOW()),
  ('betterchat.group.diamond_vip', 'BetterChat', 'betterchat', 'workbook', 1, NOW()),
  ('betterchat.group.golden_vip', 'BetterChat', 'betterchat', 'workbook', 1, NOW()),
  ('betterchat.group.mvp', 'BetterChat', 'betterchat', 'workbook', 1, NOW()),
  ('betterchat.group.perk_chat_title', 'BetterChat', 'betterchat', 'workbook', 1, NOW()),
  ('betterchat.group.titan_vip', 'BetterChat', 'betterchat', 'workbook', 1, NOW()),
  ('betterchat.group.ultimate_vip', 'BetterChat', 'betterchat', 'workbook', 1, NOW()),
  ('betterchat.group.vip', 'BetterChat', 'betterchat', 'workbook', 1, NOW()),
  ('betterchat.group.vip_plus', 'BetterChat', 'betterchat', 'workbook', 1, NOW()),
  ('bypassqueue.allow', 'BypassQueue', 'bypassqueue', 'workbook', 1, NOW()),
  ('cupboardlimiter.limit_1', 'CupboardLimiter', 'cupboardlimiter', 'workbook', 1, NOW()),
  ('kits.claim.556', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.ak', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.build', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.cards', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.components', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.discord', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.discord_booster', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.discord_raid', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.lr300', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.m16a2', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.medical', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.mp5', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.raid', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.scrap', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.scuba', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.steam_name_rewards', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.claim.steam_rewards', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.goldenvip', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.mvp', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.portafort', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.sentry.large', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.sentry.small', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.titanvip', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.ultimatevip', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.vehicle', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.vip', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.vip.diamond', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.vipplus', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('kits.vipplus.diamond', 'Kits', 'kits', 'workbook', 1, NOW()),
  ('nteleportation.home.5s', 'NTeleportation', 'nteleportation', 'workbook', 1, NOW()),
  ('nteleportation.instant', 'NTeleportation', 'nteleportation', 'workbook', 1, NOW()),
  ('playtimetracker.diamond_vip', 'PlaytimeTracker', 'playtimetracker', 'workbook', 1, NOW()),
  ('playtimetracker.golden_vip', 'PlaytimeTracker', 'playtimetracker', 'workbook', 1, NOW()),
  ('playtimetracker.mvp', 'PlaytimeTracker', 'playtimetracker', 'workbook', 1, NOW()),
  ('playtimetracker.titan_vip', 'PlaytimeTracker', 'playtimetracker', 'workbook', 1, NOW()),
  ('playtimetracker.ultimate_vip', 'PlaytimeTracker', 'playtimetracker', 'workbook', 1, NOW()),
  ('playtimetracker.vip', 'PlaytimeTracker', 'playtimetracker', 'workbook', 1, NOW()),
  ('playtimetracker.vip_plus', 'PlaytimeTracker', 'playtimetracker', 'workbook', 1, NOW()),
  ('raidlands.vehicle.hp.125', 'Custom', 'raidlands', 'workbook', 1, NOW()),
  ('raidlands.vehicle.hp.150', 'Custom', 'raidlands', 'workbook', 1, NOW()),
  ('signartist.url', 'SignArtist', 'signartist', 'workbook', 1, NOW()),
  ('spawnheli.minicopter.instanttakeoff', 'SpawnHeli', 'spawnheli', 'workbook', 1, NOW())
ON DUPLICATE KEY UPDATE
  plugin_name = VALUES(plugin_name), permission_prefix = VALUES(permission_prefix),
  source = IF(source = '', VALUES(source), source), is_active = 1, last_seen_at = NOW(), updated_at = NOW();

DELETE ogpg FROM oxide_group_permission_grants ogpg
INNER JOIN oxide_groups og ON og.id = ogpg.group_id
WHERE og.group_name IN ('claim_discord_booster', 'claim_discord_member', 'claim_steam_group', 'claim_steam_name', 'default', 'discord', 'perk_backpack_36', 'perk_backpack_42', 'perk_backpack_48', 'perk_backpack_keep_death', 'perk_backpack_keep_wipe', 'perk_chat_title', 'perk_home_5s', 'perk_minicopter_instant_takeoff', 'perk_queue_priority', 'perk_sign_art', 'perk_tc_12', 'perk_teleport_instant', 'perk_vehicle_hp_125', 'perk_vehicle_hp_150', 'rank_diamond_vip', 'rank_golden_vip', 'rank_mvp', 'rank_titan_vip', 'rank_ultimate_vip', 'rank_vip', 'rank_vip_plus', 'vip_bronze', 'vip_elite', 'vip_gold');

INSERT INTO oxide_group_permission_grants (group_id, permission_id, source)
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.discord_booster' WHERE og.group_name = 'claim_discord_booster'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.discord' WHERE og.group_name = 'claim_discord_member'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.discord_raid' WHERE og.group_name = 'claim_discord_member'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.steam_rewards' WHERE og.group_name = 'claim_steam_group'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.steam_name_rewards' WHERE og.group_name = 'claim_steam_name'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.556' WHERE og.group_name = 'default'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.ak' WHERE og.group_name = 'default'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.build' WHERE og.group_name = 'default'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.cards' WHERE og.group_name = 'default'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.components' WHERE og.group_name = 'default'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.lr300' WHERE og.group_name = 'default'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.m16a2' WHERE og.group_name = 'default'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.medical' WHERE og.group_name = 'default'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.mp5' WHERE og.group_name = 'default'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.raid' WHERE og.group_name = 'default'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.scrap' WHERE og.group_name = 'default'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.claim.scuba' WHERE og.group_name = 'default'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.size.36' WHERE og.group_name = 'perk_backpack_36'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.size.42' WHERE og.group_name = 'perk_backpack_42'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.size.48' WHERE og.group_name = 'perk_backpack_48'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keepondeath' WHERE og.group_name = 'perk_backpack_keep_death'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keeponwipe.all' WHERE og.group_name = 'perk_backpack_keep_wipe'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'betterchat.group.perk_chat_title' WHERE og.group_name = 'perk_chat_title'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.home.5s' WHERE og.group_name = 'perk_home_5s'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'spawnheli.minicopter.instanttakeoff' WHERE og.group_name = 'perk_minicopter_instant_takeoff'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'bypassqueue.allow' WHERE og.group_name = 'perk_queue_priority'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'signartist.url' WHERE og.group_name = 'perk_sign_art'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'cupboardlimiter.limit_1' WHERE og.group_name = 'perk_tc_12'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.instant' WHERE og.group_name = 'perk_teleport_instant'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'raidlands.vehicle.hp.125' WHERE og.group_name = 'perk_vehicle_hp_125'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'raidlands.vehicle.hp.150' WHERE og.group_name = 'perk_vehicle_hp_150'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keepondeath' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keeponwipe.all' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.size.48' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'betterchat.group.diamond_vip' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'bypassqueue.allow' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'cupboardlimiter.limit_1' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.goldenvip' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.portafort' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.sentry.small' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.vip.diamond' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.vipplus.diamond' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.home.5s' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.instant' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'playtimetracker.diamond_vip' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'raidlands.vehicle.hp.125' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'signartist.url' WHERE og.group_name = 'rank_diamond_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keepondeath' WHERE og.group_name = 'rank_golden_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keeponwipe.all' WHERE og.group_name = 'rank_golden_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.size.42' WHERE og.group_name = 'rank_golden_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'betterchat.group.golden_vip' WHERE og.group_name = 'rank_golden_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'bypassqueue.allow' WHERE og.group_name = 'rank_golden_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'cupboardlimiter.limit_1' WHERE og.group_name = 'rank_golden_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.goldenvip' WHERE og.group_name = 'rank_golden_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.portafort' WHERE og.group_name = 'rank_golden_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.sentry.small' WHERE og.group_name = 'rank_golden_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.home.5s' WHERE og.group_name = 'rank_golden_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.instant' WHERE og.group_name = 'rank_golden_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'playtimetracker.golden_vip' WHERE og.group_name = 'rank_golden_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'raidlands.vehicle.hp.125' WHERE og.group_name = 'rank_golden_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'signartist.url' WHERE og.group_name = 'rank_golden_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keepondeath' WHERE og.group_name = 'rank_mvp'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.size.36' WHERE og.group_name = 'rank_mvp'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'betterchat.group.mvp' WHERE og.group_name = 'rank_mvp'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'bypassqueue.allow' WHERE og.group_name = 'rank_mvp'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.mvp' WHERE og.group_name = 'rank_mvp'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.portafort' WHERE og.group_name = 'rank_mvp'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.sentry.small' WHERE og.group_name = 'rank_mvp'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.home.5s' WHERE og.group_name = 'rank_mvp'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.instant' WHERE og.group_name = 'rank_mvp'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'playtimetracker.mvp' WHERE og.group_name = 'rank_mvp'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'raidlands.vehicle.hp.125' WHERE og.group_name = 'rank_mvp'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'signartist.url' WHERE og.group_name = 'rank_mvp'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keepondeath' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keeponwipe.all' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.size.48' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'betterchat.group.titan_vip' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'bypassqueue.allow' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'cupboardlimiter.limit_1' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.portafort' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.sentry.large' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.sentry.small' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.titanvip' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.vehicle' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.home.5s' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.instant' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'playtimetracker.titan_vip' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'raidlands.vehicle.hp.150' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'signartist.url' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'spawnheli.minicopter.instanttakeoff' WHERE og.group_name = 'rank_titan_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keepondeath' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keeponwipe.all' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.size.48' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'betterchat.group.ultimate_vip' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'bypassqueue.allow' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'cupboardlimiter.limit_1' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.portafort' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.sentry.large' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.sentry.small' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.ultimatevip' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.vehicle' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.home.5s' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.instant' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'playtimetracker.ultimate_vip' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'raidlands.vehicle.hp.150' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'signartist.url' WHERE og.group_name = 'rank_ultimate_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.size.36' WHERE og.group_name = 'rank_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'betterchat.group.vip' WHERE og.group_name = 'rank_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'bypassqueue.allow' WHERE og.group_name = 'rank_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.portafort' WHERE og.group_name = 'rank_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.sentry.small' WHERE og.group_name = 'rank_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.vip' WHERE og.group_name = 'rank_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.home.5s' WHERE og.group_name = 'rank_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.instant' WHERE og.group_name = 'rank_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'playtimetracker.vip' WHERE og.group_name = 'rank_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'raidlands.vehicle.hp.125' WHERE og.group_name = 'rank_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'signartist.url' WHERE og.group_name = 'rank_vip'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.size.36' WHERE og.group_name = 'rank_vip_plus'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'betterchat.group.vip_plus' WHERE og.group_name = 'rank_vip_plus'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'bypassqueue.allow' WHERE og.group_name = 'rank_vip_plus'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.portafort' WHERE og.group_name = 'rank_vip_plus'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.sentry.small' WHERE og.group_name = 'rank_vip_plus'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.vipplus' WHERE og.group_name = 'rank_vip_plus'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.home.5s' WHERE og.group_name = 'rank_vip_plus'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.instant' WHERE og.group_name = 'rank_vip_plus'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'playtimetracker.vip_plus' WHERE og.group_name = 'rank_vip_plus'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'raidlands.vehicle.hp.125' WHERE og.group_name = 'rank_vip_plus'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'signartist.url' WHERE og.group_name = 'rank_vip_plus'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.size.36' WHERE og.group_name = 'vip_bronze'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'betterchat.group.vip' WHERE og.group_name = 'vip_bronze'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'bypassqueue.allow' WHERE og.group_name = 'vip_bronze'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.portafort' WHERE og.group_name = 'vip_bronze'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.sentry.small' WHERE og.group_name = 'vip_bronze'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.vip' WHERE og.group_name = 'vip_bronze'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.home.5s' WHERE og.group_name = 'vip_bronze'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.instant' WHERE og.group_name = 'vip_bronze'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'playtimetracker.vip' WHERE og.group_name = 'vip_bronze'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'raidlands.vehicle.hp.125' WHERE og.group_name = 'vip_bronze'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'signartist.url' WHERE og.group_name = 'vip_bronze'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keepondeath' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keeponwipe.all' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.size.48' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'betterchat.group.ultimate_vip' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'bypassqueue.allow' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'cupboardlimiter.limit_1' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.portafort' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.sentry.large' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.sentry.small' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.ultimatevip' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.vehicle' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.home.5s' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.instant' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'playtimetracker.ultimate_vip' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'raidlands.vehicle.hp.150' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'signartist.url' WHERE og.group_name = 'vip_elite'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keepondeath' WHERE og.group_name = 'vip_gold'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keeponwipe.all' WHERE og.group_name = 'vip_gold'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.size.42' WHERE og.group_name = 'vip_gold'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'betterchat.group.golden_vip' WHERE og.group_name = 'vip_gold'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'bypassqueue.allow' WHERE og.group_name = 'vip_gold'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'cupboardlimiter.limit_1' WHERE og.group_name = 'vip_gold'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.goldenvip' WHERE og.group_name = 'vip_gold'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.portafort' WHERE og.group_name = 'vip_gold'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'kits.sentry.small' WHERE og.group_name = 'vip_gold'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.home.5s' WHERE og.group_name = 'vip_gold'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'nteleportation.instant' WHERE og.group_name = 'vip_gold'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'playtimetracker.golden_vip' WHERE og.group_name = 'vip_gold'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'raidlands.vehicle.hp.125' WHERE og.group_name = 'vip_gold'
UNION ALL
SELECT og.id, op.id, 'workbook' FROM oxide_groups og INNER JOIN oxide_permissions op ON op.permission_name = 'signartist.url' WHERE og.group_name = 'vip_gold';

INSERT INTO game_kits
  (kit_name, previous_kit_name, description, required_permission, maximum_uses, required_auth, cooldown_seconds, cost, is_hidden, copy_paste_file, image_path, is_active, sort_order, reward_enabled, reward_product_id, reward_display_name, reward_description, reward_cost, reward_cooldown, reward_icon_url, reward_permission, draft_revision, published_revision, published_at, deleted_at, deleted_revision)
VALUES
  ('kit_vip', '', 'Main VIP kit screenshot.', 'kits.vip', 10, 0, 3600, 0, 0, '', '', 1, 210, 1, 1395, 'VIP Kit', 'Main VIP kit screenshot.', 8000, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_vip_diamond', '', 'Main VIP kit screenshot. Diamond cooldown alias.', 'kits.vip.diamond', 10, 0, 18000, 0, 0, '', '', 1, 211, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_vip_plus', '', 'Diamond uses this with 5h cooldown override if separate diamond permission kit clone is needed.', 'kits.vipplus', 10, 0, 3600, 0, 0, '', '', 1, 220, 1, 1396, 'VIP+ Kit', 'Diamond uses this with 5h cooldown override if separate diamond permission kit clone is needed.', 12000, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_vip_plus_diamond', '', 'Diamond uses this with 5h cooldown override if separate diamond permission kit clone is needed. Diamond cooldown alias.', 'kits.vipplus.diamond', 10, 0, 18000, 0, 0, '', '', 1, 221, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_mvp', '', 'Recommended 10/wipe for weekly balance.', 'kits.mvp', 10, 0, 3600, 0, 0, '', '', 1, 230, 1, 1397, 'MVP Kit', 'Recommended 10/wipe for weekly balance.', 16000, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_golden_vip', '', 'Once per wipe.', 'kits.goldenvip', 1, 0, 0, 0, 0, '', '', 1, 240, 1, 1398, 'Golden VIP Kit', 'Once per wipe.', 35000, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_ultimate_vip', '', 'Once per wipe.', 'kits.ultimatevip', 1, 0, 0, 0, 0, '', '', 1, 250, 1, 1399, 'Ultimate VIP Kit', 'Once per wipe.', 70000, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_titan_vip', '', 'Once per wipe.', 'kits.titanvip', 1, 0, 0, 0, 0, '', '', 1, 260, 1, 1400, 'Titan VIP Kit', 'Once per wipe.', 150000, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('pack_sentry_small', '', '1 sentry.', 'kits.sentry.small', 1, 0, 0, 0, 0, '', '', 1, 270, 1, 1401, 'Sentry Pack Small', '1 sentry.', 10000, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('pack_sentry_large', '', '5 sentries.', 'kits.sentry.large', 1, 0, 0, 0, 0, '', '', 1, 280, 1, 1402, 'Sentry Pack Large', '5 sentries.', 30000, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('pack_portafort', '', '5 portaforts per redeem.', 'kits.portafort', 10, 0, 60, 0, 0, '', 'https://raidlands.net/assets/media/kits/portafort-token.webp', 1, 290, 1, 1403, 'Portafort Pack', '5 portaforts per redeem.', 8000, 0, 'https://raidlands.net/assets/media/kits/portafort-token.webp', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('pack_vehicle', '', '5 of each allowed vehicle except car chassis, rowboat, horse.', 'kits.vehicle', 1, 0, 0, 0, 0, '', '', 1, 300, 1, 1404, 'Vehicle Pack', '5 of each allowed vehicle except car chassis, rowboat, horse.', 40000, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_steam_name_rewards', '', 'Outside shop purchase flow.', 'kits.claim.steam_name_rewards', 0, 0, 600, 0, 0, '', '', 1, 310, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_steam_rewards', '', 'Outside shop purchase flow.', 'kits.claim.steam_rewards', 0, 0, 600, 0, 0, '', '', 1, 320, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_discord_booster', '', 'Outside shop purchase flow; booster role sync required.', 'kits.claim.discord_booster', 0, 0, 1800, 0, 0, '', '', 1, 330, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_discord_raid', '', 'Max uses shown as 15.', 'kits.claim.discord_raid', 15, 0, 3600, 0, 0, '', '', 1, 340, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_discord', '', 'Outside shop purchase flow.', 'kits.claim.discord', 0, 0, 390, 0, 0, '', '', 1, 350, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_556', '', 'Default in-game claimable.', 'kits.claim.556', 0, 0, 1800, 0, 0, '', '', 1, 360, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_cards', '', 'Default in-game claimable.', 'kits.claim.cards', 0, 0, 3600, 0, 0, '', 'https://raidlands.net/assets/media/kits/cards-kit.png', 1, 370, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_scrap', '', 'Default in-game claimable.', 'kits.claim.scrap', 0, 0, 3600, 0, 0, '', '', 1, 380, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_scuba', '', 'Default in-game claimable.', 'kits.claim.scuba', 0, 0, 1800, 0, 0, '', 'https://raidlands.net/assets/media/kits/scuba-kit.png', 1, 390, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_components', '', 'Max uses shown as 5.', 'kits.claim.components', 5, 0, 3600, 0, 0, '', 'https://raidlands.net/assets/media/kits/comps-kit.png', 1, 400, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_build', '', 'Default resource/build kit.', 'kits.claim.build', 0, 0, 1200, 0, 0, '', 'https://raidlands.net/assets/media/kits/build-kit.png', 1, 410, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_raid', '', 'Default raid kit.', 'kits.claim.raid', 0, 0, 1800, 0, 0, '', 'https://raidlands.net/assets/media/kits/raid-kit.png', 1, 420, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_medical', '', 'Default medical kit.', 'kits.claim.medical', 0, 0, 1800, 0, 0, '', 'https://raidlands.net/assets/media/kits/medical-kit.png', 1, 430, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_mp5', '', 'Default combat kit.', 'kits.claim.mp5', 0, 0, 390, 0, 0, '', '', 1, 440, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_lr300', '', 'Default combat kit.', 'kits.claim.lr300', 0, 0, 390, 0, 0, '', '', 1, 450, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_m16a2', '', 'Custom weapon/skin key needs final confirmation.', 'kits.claim.m16a2', 0, 0, 390, 0, 0, '', '', 1, 460, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0),
  ('kit_claim_ak', '', 'Default combat kit.', 'kits.claim.ak', 0, 0, 390, 0, 0, '', '', 1, 470, 0, -1, '', '', 0, 0, '', '', @rollout_revision, @rollout_revision, NOW(), NULL, 0)
ON DUPLICATE KEY UPDATE
  previous_kit_name = VALUES(previous_kit_name), description = VALUES(description), required_permission = VALUES(required_permission),
  maximum_uses = VALUES(maximum_uses), required_auth = VALUES(required_auth), cooldown_seconds = VALUES(cooldown_seconds),
  cost = VALUES(cost), is_hidden = VALUES(is_hidden), copy_paste_file = VALUES(copy_paste_file), image_path = VALUES(image_path),
  is_active = VALUES(is_active), sort_order = VALUES(sort_order), reward_enabled = VALUES(reward_enabled),
  reward_product_id = VALUES(reward_product_id), reward_display_name = VALUES(reward_display_name),
  reward_description = VALUES(reward_description), reward_cost = VALUES(reward_cost), reward_cooldown = VALUES(reward_cooldown),
  reward_icon_url = VALUES(reward_icon_url), reward_permission = VALUES(reward_permission),
  draft_revision = VALUES(draft_revision), published_revision = VALUES(published_revision), published_at = NOW(),
  deleted_at = NULL, deleted_revision = 0, updated_at = NOW();

UPDATE game_kits SET is_active = 0, deleted_at = NOW(), deleted_revision = @rollout_revision, updated_at = NOW()
WHERE kit_name IN ('Build Kit', 'Cards', 'Medical', 'Raid Kit', 'comps', 'discord', 'scuba kit');

DELETE gki FROM game_kit_items gki
INNER JOIN game_kits gk ON gk.id = gki.kit_id
WHERE gk.kit_name IN ('kit_claim_556', 'kit_claim_ak', 'kit_claim_build', 'kit_claim_cards', 'kit_claim_components', 'kit_claim_discord', 'kit_claim_discord_booster', 'kit_claim_discord_raid', 'kit_claim_lr300', 'kit_claim_m16a2', 'kit_claim_medical', 'kit_claim_mp5', 'kit_claim_raid', 'kit_claim_scrap', 'kit_claim_scuba', 'kit_claim_steam_name_rewards', 'kit_claim_steam_rewards', 'kit_golden_vip', 'kit_mvp', 'kit_titan_vip', 'kit_ultimate_vip', 'kit_vip', 'kit_vip_diamond', 'kit_vip_plus', 'kit_vip_plus_diamond', 'pack_portafort', 'pack_sentry_large', 'pack_sentry_small', 'pack_vehicle');

INSERT INTO game_kit_items
  (kit_id, container_name, position, shortname, display_name, skin, amount, condition_value, max_condition, ammo, ammo_type, frequency, blueprint_shortname, text_value, contents_json, container_json, sort_order)
SELECT gk.id, 'main', 0, 'ammo.rocket.basic', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'main', 1, 'ammo.rocket.hv', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'main', 2, 'electric.generator.small', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'main', 3, 'weapon.mod.lasersight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'main', 4, 'weapon.mod.holosight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'main', 5, 'weapon.mod.flashlight', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'main', 6, 'ammo.rifle.explosive', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'main', 7, 'ammo.rifle', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 8 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'main', 8, 'weapon.mod.small.scope', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 9 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'main', 9, 'weapon.mod.silencer', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 10 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'main', 10, 'weapon.mod.muzzlebrake', NULL, 0, 1, 200.0, 200.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 11 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'main', 11, 'explosive.timed', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 12 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'main', 12, 'syringe.medical', NULL, 0, 50, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 13 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'main', 13, 'gunpowder', NULL, 0, 15, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 14 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'wear', 2, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'wear', 3, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'belt', 0, 'rifle.lr300', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'belt', 1, 'smg.mp5', NULL, 0, 1, 125.0, 125.0, 30, 'ammo.pistol', -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'belt', 2, 'rifle.l96', NULL, 0, 1, 500.0, 500.0, 5, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'belt', 3, 'lmg.m249', NULL, 0, 1, 500.0, 500.0, 100, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'belt', 4, 'rifle.ak', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'belt', 5, 'rocket.launcher', NULL, 0, 1, 100.0, 100.0, 0, 'ammo.rocket.basic', -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rocket.basic', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'main', 1, 'ammo.rocket.hv', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'main', 2, 'electric.generator.small', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'main', 3, 'weapon.mod.lasersight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'main', 4, 'weapon.mod.holosight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'main', 5, 'weapon.mod.flashlight', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'main', 6, 'ammo.rifle.explosive', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'main', 7, 'ammo.rifle', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 8 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'main', 8, 'weapon.mod.small.scope', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 9 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'main', 9, 'weapon.mod.silencer', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 10 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'main', 10, 'weapon.mod.muzzlebrake', NULL, 0, 1, 200.0, 200.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 11 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'main', 11, 'explosive.timed', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 12 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'main', 12, 'syringe.medical', NULL, 0, 50, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 13 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'main', 13, 'gunpowder', NULL, 0, 15, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 14 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'wear', 2, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'wear', 3, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'belt', 0, 'rifle.lr300', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'belt', 1, 'smg.mp5', NULL, 0, 1, 125.0, 125.0, 30, 'ammo.pistol', -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'belt', 2, 'rifle.l96', NULL, 0, 1, 500.0, 500.0, 5, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'belt', 3, 'lmg.m249', NULL, 0, 1, 500.0, 500.0, 100, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'belt', 4, 'rifle.ak', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'belt', 5, 'rocket.launcher', NULL, 0, 1, 100.0, 100.0, 0, 'ammo.rocket.basic', -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rocket.basic', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 1, 'ammo.rocket.hv', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 2, 'electric.generator.small', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 3, 'ammo.rifle.explosive', NULL, 0, 200, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 4, 'ammo.rifle', NULL, 0, 200, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 5, 'ammo.pistol', NULL, 0, 200, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 6, 'syringe.medical', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 7, 'largemedkit', NULL, 0, 10, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 8 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 8, 'gunpowder', NULL, 0, 50, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 9 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 9, 'explosive.timed', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 10 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 10, 'weapon.mod.lasersight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 11 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 11, 'weapon.mod.holosight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 12 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 12, 'weapon.mod.flashlight', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 13 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 13, 'weapon.mod.small.scope', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 14 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 14, 'weapon.mod.silencer', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 15 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 15, 'weapon.mod.muzzlebrake', NULL, 0, 1, 200.0, 200.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 16 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'wear', 2, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'wear', 3, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'belt', 0, 'rifle.lr300', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'belt', 1, 'smg.mp5', NULL, 0, 1, 125.0, 125.0, 30, 'ammo.pistol', -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'belt', 2, 'rifle.l96', NULL, 0, 1, 500.0, 500.0, 5, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'belt', 3, 'lmg.m249', NULL, 0, 1, 500.0, 500.0, 100, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'belt', 4, 'rifle.ak', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'belt', 5, 'rocket.launcher', NULL, 0, 1, 100.0, 100.0, 0, 'ammo.rocket.basic', -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rocket.basic', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 1, 'ammo.rocket.hv', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 2, 'electric.generator.small', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 3, 'ammo.rifle.explosive', NULL, 0, 200, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 4, 'ammo.rifle', NULL, 0, 200, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 5, 'ammo.pistol', NULL, 0, 200, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 6, 'syringe.medical', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 7, 'largemedkit', NULL, 0, 10, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 8 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 8, 'gunpowder', NULL, 0, 50, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 9 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 9, 'explosive.timed', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 10 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 10, 'weapon.mod.lasersight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 11 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 11, 'weapon.mod.holosight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 12 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 12, 'weapon.mod.flashlight', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 13 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 13, 'weapon.mod.small.scope', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 14 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 14, 'weapon.mod.silencer', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 15 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 15, 'weapon.mod.muzzlebrake', NULL, 0, 1, 200.0, 200.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 16 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'wear', 2, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'wear', 3, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'belt', 0, 'rifle.lr300', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'belt', 1, 'smg.mp5', NULL, 0, 1, 125.0, 125.0, 30, 'ammo.pistol', -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'belt', 2, 'rifle.l96', NULL, 0, 1, 500.0, 500.0, 5, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'belt', 3, 'lmg.m249', NULL, 0, 1, 500.0, 500.0, 100, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'belt', 4, 'rifle.ak', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'belt', 5, 'rocket.launcher', NULL, 0, 1, 100.0, 100.0, 0, 'ammo.rocket.basic', -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rocket.basic', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'main', 1, 'ammo.rocket.hv', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'main', 2, 'ammo.grenadelauncher.buckshot', NULL, 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'main', 3, 'explosive.timed', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'main', 4, 'samsite', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'main', 5, 'ammo.rifle.explosive', NULL, 0, 250, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'main', 6, 'ammo.rifle', NULL, 0, 250, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'main', 7, 'ammo.pistol', NULL, 0, 250, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 8 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'main', 8, 'autoturret', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 9 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'main', 9, 'largemedkit', NULL, 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 10 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'main', 10, 'syringe.medical', NULL, 0, 15, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 11 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'main', 11, 'gunpowder', NULL, 0, 15, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 12 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'wear', 2, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'wear', 3, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'belt', 0, 'rifle.lr300', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'belt', 1, 'smg.mp5', NULL, 0, 1, 125.0, 125.0, 30, 'ammo.pistol', -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'belt', 2, 'rifle.l96', NULL, 0, 1, 500.0, 500.0, 5, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'belt', 3, 'lmg.m249', NULL, 0, 1, 500.0, 500.0, 100, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'belt', 4, 'rifle.ak', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'belt', 5, 'rocket.launcher', NULL, 0, 1, 100.0, 100.0, 0, 'ammo.rocket.basic', -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rocket.basic', NULL, 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'main', 1, 'ammo.rocket.hv', NULL, 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'main', 2, 'ammo.grenadelauncher.buckshot', NULL, 0, 500, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'main', 3, 'explosive.timed', NULL, 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'main', 4, 'samsite', NULL, 0, 3, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'main', 5, 'ammo.rifle.explosive', NULL, 0, 1000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'main', 6, 'ammo.rifle', NULL, 0, 1000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'main', 7, 'ammo.pistol', NULL, 0, 1000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 8 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'main', 8, 'electric.generator.small', NULL, 0, 5, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 9 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'main', 9, 'autoturret', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 10 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'main', 10, 'largemedkit', NULL, 0, 50, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 11 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'main', 11, 'syringe.medical', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 12 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'main', 12, 'gunpowder', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 13 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'wear', 2, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'wear', 3, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'belt', 0, 'rifle.lr300', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'belt', 1, 'smg.mp5', NULL, 0, 1, 125.0, 125.0, 30, 'ammo.pistol', -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'belt', 2, 'rifle.l96', NULL, 0, 1, 500.0, 500.0, 5, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'belt', 3, 'lmg.m249', NULL, 0, 1, 500.0, 500.0, 100, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'belt', 4, 'rifle.ak', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'belt', 5, 'rocket.launcher', NULL, 0, 1, 100.0, 100.0, 0, 'ammo.rocket.basic', -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rocket.hv', NULL, 0, 20, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 1, 'ammo.rocket.basic', NULL, 0, 20, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 2, 'ammo.rifle.explosive', NULL, 0, 2000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 3, 'ammo.rifle', NULL, 0, 2000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 4, 'ammo.grenadelauncher.buckshot', NULL, 0, 1000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 5, 'ammo.grenadelauncher.he', NULL, 0, 200, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 6, 'samsite', NULL, 0, 3, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 7, 'electric.generator.small', NULL, 0, 15, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 8 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 8, 'supply.signal', NULL, 0, 10, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 9 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 9, 'autoturret', NULL, 0, 2, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 10 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 10, 'explosive.timed', NULL, 0, 15, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 11 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 11, 'maxhealthtea.pure', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 12 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 12, 'syringe.medical', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 13 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 13, 'largemedkit', NULL, 0, 50, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 14 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 14, 'bandage', NULL, 0, 50, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 15 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 15, 'gunpowder', NULL, 0, 300, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 16 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 16, 'gears', NULL, 0, 1000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 17 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 17, 'weapon.mod.silencer', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 18 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 18, 'weapon.mod.lasersight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 19 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 19, 'weapon.mod.flashlight', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 20 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 20, 'weapon.mod.muzzlebrake', NULL, 0, 1, 200.0, 200.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 21 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 21, 'weapon.mod.holosight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 22 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 22, 'multiplegrenadelauncher', NULL, 0, 1, 200.0, 200.0, 6, 'ammo.grenadelauncher.he', -1, NULL, NULL, NULL, NULL, 23 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'wear', 2, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'wear', 3, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'belt', 0, 'rifle.lr300', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'belt', 1, 'smg.mp5', NULL, 0, 1, 125.0, 125.0, 30, 'ammo.pistol', -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'belt', 2, 'rifle.l96', NULL, 0, 1, 500.0, 500.0, 5, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'belt', 3, 'lmg.m249', NULL, 0, 1, 500.0, 500.0, 100, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'belt', 4, 'rifle.ak', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'belt', 5, 'rocket.launcher', NULL, 0, 1, 100.0, 100.0, 0, 'ammo.rocket.basic', -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rocket.basic', NULL, 0, 150, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 1, 'ammo.rocket.hv', NULL, 0, 150, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 2, 'ammo.pistol', NULL, 0, 5000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 3, 'ammo.rifle', NULL, 0, 5000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 4, 'ammo.rifle.explosive', NULL, 0, 5000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 5, 'samsite', NULL, 0, 5, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 6, 'electric.generator.small', NULL, 0, 100, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 7, 'supply.signal', NULL, 0, 35, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 8 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 8, 'computerstation', NULL, 0, 5, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 9 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 9, 'autoturret', NULL, 0, 10, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 10 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 10, 'explosive.timed', NULL, 0, 50, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 11 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 11, 'maxhealthtea.pure', 'Super Serum', 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 12 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 12, 'ammo.grenadelauncher.he', NULL, 0, 1000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 13 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 13, 'metal.fragments', NULL, 0, 50000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 14 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 14, 'tarp', NULL, 0, 1000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 15 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 15, 'gears', NULL, 0, 1000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 16 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 16, 'syringe.medical', NULL, 0, 2500, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 17 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 17, 'largemedkit', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 18 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 18, 'gunpowder', NULL, 0, 5000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 19 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 19, 'ammo.grenadelauncher.smoke', NULL, 0, 25, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 20 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 20, 'weapon.mod.holosight', NULL, 0, 50, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 21 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 21, 'weapon.mod.muzzlebrake', NULL, 0, 50, 200.0, 200.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 22 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 22, 'multiplegrenadelauncher', NULL, 0, 1, 200.0, 200.0, 6, 'ammo.grenadelauncher.he', -1, NULL, NULL, NULL, NULL, 23 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'wear', 2, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'wear', 3, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'belt', 0, 'lmg.m249', NULL, 0, 1, 500.0, 500.0, 100, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'belt', 1, 'rifle.ak', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'belt', 2, 'rocket.launcher', NULL, 0, 1, 100.0, 100.0, 0, 'ammo.rocket.basic', -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'belt', 3, 'rifle.lr300', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'belt', 4, 'smg.mp5', NULL, 0, 1, 125.0, 125.0, 30, 'ammo.pistol', -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'belt', 5, 'rifle.l96', NULL, 0, 1, 500.0, 500.0, 5, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'main', 0, 'autoturret', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'pack_sentry_small'
UNION ALL
SELECT gk.id, 'main', 0, 'autoturret', NULL, 0, 5, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'pack_sentry_large'
UNION ALL
SELECT gk.id, 'main', 0, 'grenade.smoke', 'Portafort Token', 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'pack_portafort'
UNION ALL
SELECT gk.id, 'main', 0, 'wrappedgift', 'Minicopter Token', 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'pack_vehicle'
UNION ALL
SELECT gk.id, 'main', 1, 'wrappedgift', 'Scrap Transport Helicopter Token', 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'pack_vehicle'
UNION ALL
SELECT gk.id, 'main', 2, 'wrappedgift', 'Attack Helicopter Token', 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'pack_vehicle'
UNION ALL
SELECT gk.id, 'main', 3, 'wrappedgift', 'RHIB Token', 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'pack_vehicle'
UNION ALL
SELECT gk.id, 'main', 4, 'wrappedgift', 'Tugboat Token', 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'pack_vehicle'
UNION ALL
SELECT gk.id, 'main', 5, 'wrappedgift', 'Solo Submarine Token', 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'pack_vehicle'
UNION ALL
SELECT gk.id, 'main', 6, 'wrappedgift', 'Duo Submarine Token', 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'pack_vehicle'
UNION ALL
SELECT gk.id, 'main', 7, 'wrappedgift', 'Snowmobile Token', 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 8 FROM game_kits gk WHERE gk.kit_name = 'pack_vehicle'
UNION ALL
SELECT gk.id, 'main', 8, 'wrappedgift', 'Hot Air Balloon Token', 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 9 FROM game_kits gk WHERE gk.kit_name = 'pack_vehicle'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rifle', NULL, 0, 25, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'main', 1, 'weapon.mod.holosight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'main', 2, 'weapon.mod.flashlight', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'main', 3, 'weapon.mod.extendedmags', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'wear', 2, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'wear', 3, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'belt', 0, 'rifle.lr300', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'belt', 1, 'syringe.medical', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'belt', 2, 'largemedkit', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'belt', 3, 'wall.external.high.stone', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'belt', 4, 'wall.external.high', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rifle', NULL, 0, 25, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'main', 1, 'weapon.mod.holosight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'main', 2, 'weapon.mod.flashlight', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'main', 3, 'weapon.mod.extendedmags', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'wear', 2, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'wear', 3, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'belt', 0, 'rifle.lr300', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'belt', 1, 'syringe.medical', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'belt', 2, 'largemedkit', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'belt', 3, 'wall.external.high.stone', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'belt', 4, 'wall.external.high', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rifle', NULL, 0, 25, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'main', 1, 'weapon.mod.holosight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'main', 2, 'weapon.mod.flashlight', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'main', 3, 'weapon.mod.extendedmags', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'main', 4, 'rifle.l96', NULL, 0, 1, 500.0, 500.0, 5, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'main', 5, 'rifle.lr300', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'main', 6, 'rifle.ak', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'main', 7, 'ammo.rocket.basic', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 8 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'main', 8, 'ammo.rocket.hv', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 9 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'wear', 2, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'wear', 3, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'belt', 0, 'rifle.lr300', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'belt', 1, 'syringe.medical', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'belt', 2, 'largemedkit', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'belt', 3, 'wall.external.high.stone', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'belt', 4, 'wall.external.high', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'belt', 5, 'rocket.launcher', NULL, 0, 1, 100.0, 100.0, 0, 'ammo.rocket.basic', -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rifle', NULL, 0, 40, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'main', 1, 'ammo.rifle.explosive', NULL, 0, 10, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'main', 2, 'ammo.rocket.hv', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'main', 3, 'ammo.rocket.basic', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'wear', 2, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'wear', 3, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'belt', 0, 'rifle.ak', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'belt', 1, 'syringe.medical', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'belt', 2, 'largemedkit', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'belt', 3, 'wall.external.high.stone', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'belt', 4, 'explosive.timed', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'belt', 5, 'rocket.launcher', NULL, 0, 1, 100.0, 100.0, 0, 'ammo.rocket.basic', -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rifle', NULL, 0, 25, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'main', 1, 'weapon.mod.holosight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'main', 2, 'weapon.mod.flashlight', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'main', 3, 'weapon.mod.extendedmags', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'wear', 2, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'wear', 3, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'belt', 0, 'rifle.lr300', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'belt', 1, 'syringe.medical', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'belt', 2, 'largemedkit', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'belt', 3, 'wall.external.high.stone', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'belt', 4, 'wall.external.high', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rifle', NULL, 0, 350, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_556'
UNION ALL
SELECT gk.id, 'belt', 0, 'keycard_red', NULL, 0, 5, 2.0, 2.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_cards'
UNION ALL
SELECT gk.id, 'belt', 1, 'keycard_green', NULL, 0, 5, 4.0, 4.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_cards'
UNION ALL
SELECT gk.id, 'belt', 2, 'keycard_blue', NULL, 0, 5, 4.0, 4.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_cards'
UNION ALL
SELECT gk.id, 'main', 0, 'scrap', NULL, 0, 10000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_scrap'
UNION ALL
SELECT gk.id, 'wear', 0, 'diving.mask', NULL, 0, 1, 200.0, 200.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_scuba'
UNION ALL
SELECT gk.id, 'wear', 1, 'diving.fins', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_scuba'
UNION ALL
SELECT gk.id, 'wear', 2, 'diving.tank', NULL, 0, 1, 600.0, 600.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_scuba'
UNION ALL
SELECT gk.id, 'wear', 3, 'diving.wetsuit', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_scuba'
UNION ALL
SELECT gk.id, 'belt', 0, 'flashlight.held', NULL, 0, 1, 50.0, 50.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_scuba'
UNION ALL
SELECT gk.id, 'main', 0, 'cctv.camera', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_components'
UNION ALL
SELECT gk.id, 'main', 1, 'gears', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_components'
UNION ALL
SELECT gk.id, 'main', 2, 'metalspring', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_components'
UNION ALL
SELECT gk.id, 'main', 3, 'propanetank', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_components'
UNION ALL
SELECT gk.id, 'main', 4, 'roadsigns', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_components'
UNION ALL
SELECT gk.id, 'main', 5, 'techparts', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_components'
UNION ALL
SELECT gk.id, 'main', 6, 'sewingkit', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_components'
UNION ALL
SELECT gk.id, 'main', 7, 'sheetmetal', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 8 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_components'
UNION ALL
SELECT gk.id, 'main', 8, 'metalblade', NULL, 0, 10, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 9 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_components'
UNION ALL
SELECT gk.id, 'main', 9, 'metalpipe', NULL, 0, 10, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 10 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_components'
UNION ALL
SELECT gk.id, 'main', 10, 'semibody', NULL, 0, 10, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 11 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_components'
UNION ALL
SELECT gk.id, 'main', 11, 'rope', NULL, 0, 100, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 12 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_components'
UNION ALL
SELECT gk.id, 'main', 0, 'wood', NULL, 0, 10000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_build'
UNION ALL
SELECT gk.id, 'main', 1, 'stones', NULL, 0, 10000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_build'
UNION ALL
SELECT gk.id, 'main', 2, 'metal.fragments', NULL, 0, 10000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_build'
UNION ALL
SELECT gk.id, 'main', 3, 'metal.refined', NULL, 0, 10000, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_build'
UNION ALL
SELECT gk.id, 'main', 4, 'gears', NULL, 0, 3, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_build'
UNION ALL
SELECT gk.id, 'belt', 0, 'building.planner', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_build'
UNION ALL
SELECT gk.id, 'belt', 1, 'hammer', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_build'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rifle', NULL, 0, 150, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'main', 1, 'ammo.rifle.explosive', NULL, 0, 75, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'main', 2, 'ammo.rocket.basic', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'main', 3, 'ammo.rocket.hv', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'wear', 2, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'wear', 3, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'belt', 0, 'rifle.ak', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'belt', 1, 'syringe.medical', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'belt', 2, 'largemedkit', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'belt', 3, 'wall.external.high.stone', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'belt', 4, 'explosive.timed', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'belt', 5, 'rocket.launcher', NULL, 0, 1, 100.0, 100.0, 0, 'ammo.rocket.basic', -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'belt', 0, 'largemedkit', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_medical'
UNION ALL
SELECT gk.id, 'belt', 1, 'syringe.medical', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_medical'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.pistol', NULL, 0, 5, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'main', 1, 'weapon.mod.holosight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'main', 2, 'weapon.mod.flashlight', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'main', 3, 'weapon.mod.extendedmags', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'wear', 2, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'wear', 3, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'belt', 0, 'smg.mp5', NULL, 0, 1, 125.0, 125.0, 30, 'ammo.pistol', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'belt', 1, 'syringe.medical', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'belt', 2, 'largemedkit', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'belt', 3, 'wall.external.high.stone', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'belt', 4, 'wall.external.high', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rifle', NULL, 0, 25, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'main', 1, 'weapon.mod.holosight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'main', 2, 'weapon.mod.flashlight', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'main', 3, 'weapon.mod.extendedmags', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'wear', 2, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'wear', 3, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'belt', 0, 'rifle.lr300', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'belt', 1, 'syringe.medical', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'belt', 2, 'largemedkit', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'belt', 3, 'wall.external.high.stone', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'belt', 4, 'wall.external.high', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rifle', NULL, 0, 25, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'main', 1, 'weapon.mod.holosight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'main', 2, 'weapon.mod.flashlight', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'main', 3, 'weapon.mod.extendedmags', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'wear', 2, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'wear', 3, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'belt', 0, 'm16a2', NULL, 0, 1, 200.0, 200.0, 4, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'belt', 1, 'syringe.medical', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'belt', 2, 'largemedkit', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'belt', 3, 'wall.external.high.stone', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'belt', 4, 'wall.external.high', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'main', 0, 'ammo.rifle', NULL, 0, 25, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'main', 1, 'weapon.mod.holosight', NULL, 0, 1, 300.0, 300.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'main', 2, 'weapon.mod.flashlight', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'main', 3, 'weapon.mod.extendedmags', NULL, 0, 1, 100.0, 100.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320.0, 320.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360.0, 360.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'wear', 2, 'roadsign.kilt', NULL, 0, 1, 150.0, 150.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'wear', 3, 'hoodie', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'wear', 4, 'pants', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 6 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 7 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'belt', 0, 'rifle.ak', NULL, 0, 1, 150.0, 150.0, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'belt', 1, 'syringe.medical', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 2 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'belt', 2, 'largemedkit', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 3 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'belt', 3, 'wall.external.high.stone', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 4 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'belt', 4, 'wall.external.high', NULL, 0, 1, 0.0, 0.0, 0, NULL, -1, NULL, NULL, NULL, NULL, 5 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak';

DELETE gkga FROM game_kit_group_access gkga
INNER JOIN game_kits gk ON gk.id = gkga.kit_id
WHERE gk.kit_name IN ('kit_claim_556', 'kit_claim_ak', 'kit_claim_build', 'kit_claim_cards', 'kit_claim_components', 'kit_claim_discord', 'kit_claim_discord_booster', 'kit_claim_discord_raid', 'kit_claim_lr300', 'kit_claim_m16a2', 'kit_claim_medical', 'kit_claim_mp5', 'kit_claim_raid', 'kit_claim_scrap', 'kit_claim_scuba', 'kit_claim_steam_name_rewards', 'kit_claim_steam_rewards', 'kit_golden_vip', 'kit_mvp', 'kit_titan_vip', 'kit_ultimate_vip', 'kit_vip', 'kit_vip_diamond', 'kit_vip_plus', 'kit_vip_plus_diamond', 'pack_portafort', 'pack_sentry_large', 'pack_sentry_small', 'pack_vehicle');

INSERT INTO game_kit_group_access (kit_id, oxide_group, is_granted)
SELECT gk.id, 'claim_discord_booster', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_booster'
UNION ALL
SELECT gk.id, 'claim_discord_member', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord'
UNION ALL
SELECT gk.id, 'claim_discord_member', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_discord_raid'
UNION ALL
SELECT gk.id, 'claim_steam_group', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_rewards'
UNION ALL
SELECT gk.id, 'claim_steam_name', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_steam_name_rewards'
UNION ALL
SELECT gk.id, 'default', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_556'
UNION ALL
SELECT gk.id, 'default', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_ak'
UNION ALL
SELECT gk.id, 'default', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_build'
UNION ALL
SELECT gk.id, 'default', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_cards'
UNION ALL
SELECT gk.id, 'default', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_components'
UNION ALL
SELECT gk.id, 'default', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_lr300'
UNION ALL
SELECT gk.id, 'default', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_m16a2'
UNION ALL
SELECT gk.id, 'default', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_medical'
UNION ALL
SELECT gk.id, 'default', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_mp5'
UNION ALL
SELECT gk.id, 'default', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_raid'
UNION ALL
SELECT gk.id, 'default', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_scrap'
UNION ALL
SELECT gk.id, 'default', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_claim_scuba'
UNION ALL
SELECT gk.id, 'rank_diamond_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'rank_diamond_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_portafort'
UNION ALL
SELECT gk.id, 'rank_diamond_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_sentry_small'
UNION ALL
SELECT gk.id, 'rank_diamond_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_diamond'
UNION ALL
SELECT gk.id, 'rank_diamond_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus_diamond'
UNION ALL
SELECT gk.id, 'rank_golden_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'rank_golden_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_portafort'
UNION ALL
SELECT gk.id, 'rank_golden_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_sentry_small'
UNION ALL
SELECT gk.id, 'rank_mvp', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_mvp'
UNION ALL
SELECT gk.id, 'rank_mvp', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_portafort'
UNION ALL
SELECT gk.id, 'rank_mvp', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_sentry_small'
UNION ALL
SELECT gk.id, 'rank_titan_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_portafort'
UNION ALL
SELECT gk.id, 'rank_titan_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_sentry_large'
UNION ALL
SELECT gk.id, 'rank_titan_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_sentry_small'
UNION ALL
SELECT gk.id, 'rank_titan_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_titan_vip'
UNION ALL
SELECT gk.id, 'rank_titan_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_vehicle'
UNION ALL
SELECT gk.id, 'rank_ultimate_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_portafort'
UNION ALL
SELECT gk.id, 'rank_ultimate_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_sentry_large'
UNION ALL
SELECT gk.id, 'rank_ultimate_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_sentry_small'
UNION ALL
SELECT gk.id, 'rank_ultimate_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'rank_ultimate_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_vehicle'
UNION ALL
SELECT gk.id, 'rank_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_portafort'
UNION ALL
SELECT gk.id, 'rank_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_sentry_small'
UNION ALL
SELECT gk.id, 'rank_vip', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'rank_vip_plus', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_portafort'
UNION ALL
SELECT gk.id, 'rank_vip_plus', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_sentry_small'
UNION ALL
SELECT gk.id, 'rank_vip_plus', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip_plus'
UNION ALL
SELECT gk.id, 'vip_bronze', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_portafort'
UNION ALL
SELECT gk.id, 'vip_bronze', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_sentry_small'
UNION ALL
SELECT gk.id, 'vip_bronze', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_vip'
UNION ALL
SELECT gk.id, 'vip_elite', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_portafort'
UNION ALL
SELECT gk.id, 'vip_elite', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_sentry_large'
UNION ALL
SELECT gk.id, 'vip_elite', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_sentry_small'
UNION ALL
SELECT gk.id, 'vip_elite', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_ultimate_vip'
UNION ALL
SELECT gk.id, 'vip_elite', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_vehicle'
UNION ALL
SELECT gk.id, 'vip_gold', 1 FROM game_kits gk WHERE gk.kit_name = 'kit_golden_vip'
UNION ALL
SELECT gk.id, 'vip_gold', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_portafort'
UNION ALL
SELECT gk.id, 'vip_gold', 1 FROM game_kits gk WHERE gk.kit_name = 'pack_sentry_small';

UPDATE store_products SET is_active = 0, updated_at = NOW()
WHERE slug IN ('vip-bronze', 'vip-gold', 'vip-elite', 'personal-mini', 'skinbox-access', 'raid-kit-unlock');

INSERT INTO store_products
  (slug, name, product_type, short_description, description, oxide_group, tier_priority, is_stackable, is_active, is_featured, sort_order)
VALUES
  ('rank-vip', 'VIP', 'kit_bundle', 'Base paid package.', 'Base paid package.', 'rank_vip', 10, 0, 1, 1, 10),
  ('rank-vip-plus', 'VIP+', 'kit_bundle', 'Base package plus stronger playtime rate.', 'Base package plus stronger playtime rate.', 'rank_vip_plus', 20, 0, 1, 1, 20),
  ('rank-mvp', 'MVP', 'kit_bundle', 'Adds backpack keep-on-death.', 'Adds backpack keep-on-death.', 'rank_mvp', 30, 0, 1, 1, 30),
  ('rank-golden-vip', 'Golden VIP', 'kit_bundle', 'Adds wipe backpack retention and 12 TC limit.', 'Adds wipe backpack retention and 12 TC limit.', 'rank_golden_vip', 40, 0, 1, 1, 40),
  ('rank-diamond-vip', 'Diamond VIP', 'kit_bundle', 'No Diamond kit of its own; bundle tier only.', 'No Diamond kit of its own; bundle tier only.', 'rank_diamond_vip', 50, 0, 1, 1, 50),
  ('rank-ultimate-vip', 'Ultimate VIP', 'kit_bundle', 'Adds vehicle pack and 50% shop sale.', 'Adds vehicle pack and 50% shop sale.', 'rank_ultimate_vip', 60, 0, 1, 1, 60),
  ('rank-titan-vip', 'Titan VIP', 'kit_bundle', 'Top package; instant minicopter takeoff and 75% shop sale.', 'Top package; instant minicopter takeoff and 75% shop sale.', 'rank_titan_vip', 70, 0, 1, 1, 70),
  ('perk-queue-priority', 'Queue Priority / Bypass', 'perk', 'BypassQueue plugin and no-config permission backend are staged; verify live queue bypass before final approval.', 'BypassQueue plugin and no-config permission backend are staged; verify live queue bypass before final approval.', 'perk_queue_priority', 0, 0, 1, 0, 80),
  ('perk-teleport-instant', 'Instant Teleport', 'perk', 'Map to NTeleportation VIP countdown/cooldown keys.', 'Map to NTeleportation VIP countdown/cooldown keys.', 'perk_teleport_instant', 0, 0, 1, 0, 90),
  ('perk-home-5s', '5 Second Home Teleport', 'perk', 'NTeleportation supports VIP home cooldown/countdown permissions.', 'NTeleportation supports VIP home cooldown/countdown permissions.', 'perk_home_5s', 0, 0, 1, 0, 100),
  ('perk-sign-art', 'Custom Sign Art /sil', 'perk', 'SignArtist plugin/config are staged; verify /sil on a player-owned sign before final approval.', 'SignArtist plugin/config are staged; verify /sil on a player-owned sign before final approval.', 'perk_sign_art', 0, 0, 1, 0, 110),
  ('perk-chat-title', 'Custom Chat Title', 'perk', 'Use BetterChat group/title data.', 'Use BetterChat group/title data.', 'perk_chat_title', 0, 0, 1, 0, 120),
  ('perk-backpack-36', 'Backpack Tier 1 - 36 Slots', 'perk', 'Uses current Backpacks permission size support.', 'Uses current Backpacks permission size support.', 'perk_backpack_36', 0, 0, 1, 0, 130),
  ('perk-backpack-42', 'Backpack Tier 2 - 42 Slots', 'perk', 'Uses current Backpacks permission size support.', 'Uses current Backpacks permission size support.', 'perk_backpack_42', 0, 0, 1, 0, 140),
  ('perk-backpack-48', 'Backpack Tier 3 - 48 Slots', 'perk', 'Uses current Backpacks permission size support.', 'Uses current Backpacks permission size support.', 'perk_backpack_48', 0, 0, 1, 0, 150),
  ('perk-backpack-keep-death', 'Keep Backpack on Death', 'perk', 'Ensure death retention is permission-gated, not global.', 'Ensure death retention is permission-gated, not global.', 'perk_backpack_keep_death', 0, 0, 1, 0, 160),
  ('perk-backpack-keep-wipe', 'Keep Backpack on Wipe', 'perk', 'Force wipe excluded; configure wipe ruleset permission.', 'Force wipe excluded; configure wipe ruleset permission.', 'perk_backpack_keep_wipe', 0, 0, 1, 0, 170),
  ('perk-spawn-full', 'Spawn Full Health + Food + Water', 'perk', 'Needs custom spawn hook if no existing plugin handles this.', 'Needs custom spawn hook if no existing plugin handles this.', 'perk_spawn_full', 0, 0, 0, 0, 180),
  ('perk-vehicle-hp-125', 'Shop Vehicle HP 1.25x', 'perk', 'Can be custom vehicle spawn wrapper or per-vehicle config.', 'Can be custom vehicle spawn wrapper or per-vehicle config.', 'perk_vehicle_hp_125', 0, 0, 1, 0, 190),
  ('perk-vehicle-hp-150', 'Shop Vehicle HP 1.5x', 'perk', 'Can be custom vehicle spawn wrapper or per-vehicle config.', 'Can be custom vehicle spawn wrapper or per-vehicle config.', 'perk_vehicle_hp_150', 0, 0, 1, 0, 200),
  ('perk-tc-12', 'TC Limit 12', 'perk', 'CupboardLimiter custom limit permission after config change.', 'CupboardLimiter custom limit permission after config change.', 'perk_tc_12', 0, 0, 1, 0, 210),
  ('perk-minicopter-instant-takeoff', 'Instant Minicopter Takeoff', 'perk', 'SpawnHeli supports permission-gated instant takeoff.', 'SpawnHeli supports permission-gated instant takeoff.', 'perk_minicopter_instant_takeoff', 0, 0, 1, 0, 220),
  ('perk-shop-sale-25', '25% Shop Sale', 'perk', 'Exclude ranks, perks, RP, and subscriptions from discount loops.', 'Exclude ranks, perks, RP, and subscriptions from discount loops.', 'perk_shop_sale_25', 0, 0, 0, 0, 230),
  ('perk-shop-sale-50', '50% Shop Sale', 'perk', 'Exclude ranks, perks, RP, and subscriptions from discount loops.', 'Exclude ranks, perks, RP, and subscriptions from discount loops.', 'perk_shop_sale_50', 0, 0, 0, 0, 240),
  ('perk-shop-sale-75', '75% Shop Sale', 'perk', 'Exclude ranks, perks, RP, and subscriptions from discount loops.', 'Exclude ranks, perks, RP, and subscriptions from discount loops.', 'perk_shop_sale_75', 0, 0, 0, 0, 250),
  ('redeem-kit-vip', 'VIP Kit Redeem', 'kit_unlock', 'Respect kit cooldown/max uses.', 'Respect kit cooldown/max uses.', '', 0, 1, 1, 0, 260),
  ('redeem-kit-vip-plus', 'VIP+ Kit Redeem', 'kit_unlock', 'Respect kit cooldown/max uses.', 'Respect kit cooldown/max uses.', '', 0, 1, 1, 0, 270),
  ('redeem-kit-mvp', 'MVP Kit Redeem', 'kit_unlock', 'Respect kit cooldown/max uses.', 'Respect kit cooldown/max uses.', '', 0, 1, 1, 0, 280),
  ('redeem-kit-golden-vip', 'Golden VIP Kit Redeem', 'kit_unlock', 'Once per wipe.', 'Once per wipe.', '', 0, 1, 1, 0, 290),
  ('redeem-kit-ultimate-vip', 'Ultimate VIP Kit Redeem', 'kit_unlock', 'Once per wipe.', 'Once per wipe.', '', 0, 1, 1, 0, 300),
  ('redeem-kit-titan-vip', 'Titan VIP Kit Redeem', 'kit_unlock', 'Once per wipe.', 'Once per wipe.', '', 0, 1, 1, 0, 310),
  ('redeem-pack-sentry-small', 'Sentry Pack Small', 'kit_unlock', '1 sentry, once/wipe.', '1 sentry, once/wipe.', '', 0, 1, 1, 0, 320),
  ('redeem-pack-sentry-large', 'Sentry Pack Large', 'kit_unlock', '5 sentries, once/wipe.', '5 sentries, once/wipe.', '', 0, 1, 1, 0, 330),
  ('redeem-pack-portafort', 'Portafort Pack', 'kit_unlock', '5 portaforts; requires CopyPaste/token implementation.', '5 portaforts; requires CopyPaste/token implementation.', '', 0, 1, 1, 0, 340),
  ('redeem-pack-vehicle', 'Vehicle Pack', 'kit_unlock', '5 of each allowed vehicle; non-heli vehicles need plugin support.', '5 of each allowed vehicle; non-heli vehicles need plugin support.', '', 0, 1, 1, 0, 350)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), product_type = VALUES(product_type), short_description = VALUES(short_description),
  description = VALUES(description), oxide_group = VALUES(oxide_group), tier_priority = VALUES(tier_priority),
  is_stackable = VALUES(is_stackable), is_active = VALUES(is_active), is_featured = VALUES(is_featured),
  sort_order = VALUES(sort_order), updated_at = NOW();

INSERT INTO store_prices
  (product_id, payment_method, stripe_price_id, label, amount_cents, currency, rp_cost, billing_interval, access_interval, access_duration_seconds, allow_auto_renew, is_active, is_default)
SELECT p.id, 'rp', 'rp_rank-vip_week', 'RP Week', 0, 'usd', 45000, 'one_time', 'week', 604800, 1, 1, 1 FROM store_products p WHERE p.slug = 'rank-vip'
UNION ALL
SELECT p.id, 'rp', 'rp_rank-vip-plus_week', 'RP Week', 0, 'usd', 70000, 'one_time', 'week', 604800, 1, 1, 1 FROM store_products p WHERE p.slug = 'rank-vip-plus'
UNION ALL
SELECT p.id, 'rp', 'rp_rank-mvp_week', 'RP Week', 0, 'usd', 90000, 'one_time', 'week', 604800, 1, 1, 1 FROM store_products p WHERE p.slug = 'rank-mvp'
UNION ALL
SELECT p.id, 'rp', 'rp_rank-golden-vip_week', 'RP Week', 0, 'usd', 130000, 'one_time', 'week', 604800, 1, 1, 1 FROM store_products p WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, 'rp', 'rp_rank-diamond-vip_week', 'RP Week', 0, 'usd', 250000, 'one_time', 'week', 604800, 1, 1, 1 FROM store_products p WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, 'rp', 'rp_rank-ultimate-vip_week', 'RP Week', 0, 'usd', 400000, 'one_time', 'week', 604800, 1, 1, 1 FROM store_products p WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, 'rp', 'rp_rank-titan-vip_week', 'RP Week', 0, 'usd', 750000, 'one_time', 'week', 604800, 1, 1, 1 FROM store_products p WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-queue-priority_week', 'RP Week', 0, 'usd', 8000, 'one_time', 'week', 604800, 0, 1, 1 FROM store_products p WHERE p.slug = 'perk-queue-priority'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-teleport-instant_week', 'RP Week', 0, 'usd', 12000, 'one_time', 'week', 604800, 0, 1, 1 FROM store_products p WHERE p.slug = 'perk-teleport-instant'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-home-5s_week', 'RP Week', 0, 'usd', 10000, 'one_time', 'week', 604800, 0, 1, 1 FROM store_products p WHERE p.slug = 'perk-home-5s'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-sign-art_week', 'RP Week', 0, 'usd', 6000, 'one_time', 'week', 604800, 0, 1, 1 FROM store_products p WHERE p.slug = 'perk-sign-art'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-chat-title_week', 'RP Week', 0, 'usd', 8000, 'one_time', 'week', 604800, 0, 1, 1 FROM store_products p WHERE p.slug = 'perk-chat-title'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-backpack-36_week', 'RP Week', 0, 'usd', 12000, 'one_time', 'week', 604800, 0, 1, 1 FROM store_products p WHERE p.slug = 'perk-backpack-36'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-backpack-42_week', 'RP Week', 0, 'usd', 18000, 'one_time', 'week', 604800, 0, 1, 1 FROM store_products p WHERE p.slug = 'perk-backpack-42'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-backpack-48_week', 'RP Week', 0, 'usd', 24000, 'one_time', 'week', 604800, 0, 1, 1 FROM store_products p WHERE p.slug = 'perk-backpack-48'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-backpack-keep-death_week', 'RP Week', 0, 'usd', 25000, 'one_time', 'week', 604800, 0, 1, 1 FROM store_products p WHERE p.slug = 'perk-backpack-keep-death'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-backpack-keep-wipe_week', 'RP Week', 0, 'usd', 40000, 'one_time', 'week', 604800, 0, 1, 1 FROM store_products p WHERE p.slug = 'perk-backpack-keep-wipe'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-spawn-full_week', 'RP Week', 0, 'usd', 10000, 'one_time', 'week', 604800, 0, 0, 1 FROM store_products p WHERE p.slug = 'perk-spawn-full'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-vehicle-hp-125_week', 'RP Week', 0, 'usd', 18000, 'one_time', 'week', 604800, 0, 1, 1 FROM store_products p WHERE p.slug = 'perk-vehicle-hp-125'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-vehicle-hp-150_week', 'RP Week', 0, 'usd', 35000, 'one_time', 'week', 604800, 0, 1, 1 FROM store_products p WHERE p.slug = 'perk-vehicle-hp-150'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-tc-12_week', 'RP Week', 0, 'usd', 35000, 'one_time', 'week', 604800, 0, 1, 1 FROM store_products p WHERE p.slug = 'perk-tc-12'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-minicopter-instant-takeoff_week', 'RP Week', 0, 'usd', 25000, 'one_time', 'week', 604800, 0, 1, 1 FROM store_products p WHERE p.slug = 'perk-minicopter-instant-takeoff'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-shop-sale-25_week', 'RP Week', 0, 'usd', 60000, 'one_time', 'week', 604800, 0, 0, 1 FROM store_products p WHERE p.slug = 'perk-shop-sale-25'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-shop-sale-50_week', 'RP Week', 0, 'usd', 140000, 'one_time', 'week', 604800, 0, 0, 1 FROM store_products p WHERE p.slug = 'perk-shop-sale-50'
UNION ALL
SELECT p.id, 'rp', 'rp_perk-shop-sale-75_week', 'RP Week', 0, 'usd', 300000, 'one_time', 'week', 604800, 0, 0, 1 FROM store_products p WHERE p.slug = 'perk-shop-sale-75'
UNION ALL
SELECT p.id, 'rp', 'rp_redeem-kit-vip_one_time', 'RP One Time', 0, 'usd', 8000, 'one_time', 'one_time', 0, 0, 1, 1 FROM store_products p WHERE p.slug = 'redeem-kit-vip'
UNION ALL
SELECT p.id, 'rp', 'rp_redeem-kit-vip-plus_one_time', 'RP One Time', 0, 'usd', 12000, 'one_time', 'one_time', 0, 0, 1, 1 FROM store_products p WHERE p.slug = 'redeem-kit-vip-plus'
UNION ALL
SELECT p.id, 'rp', 'rp_redeem-kit-mvp_one_time', 'RP One Time', 0, 'usd', 16000, 'one_time', 'one_time', 0, 0, 1, 1 FROM store_products p WHERE p.slug = 'redeem-kit-mvp'
UNION ALL
SELECT p.id, 'rp', 'rp_redeem-kit-golden-vip_one_time', 'RP One Time', 0, 'usd', 35000, 'one_time', 'one_time', 0, 0, 1, 1 FROM store_products p WHERE p.slug = 'redeem-kit-golden-vip'
UNION ALL
SELECT p.id, 'rp', 'rp_redeem-kit-ultimate-vip_one_time', 'RP One Time', 0, 'usd', 70000, 'one_time', 'one_time', 0, 0, 1, 1 FROM store_products p WHERE p.slug = 'redeem-kit-ultimate-vip'
UNION ALL
SELECT p.id, 'rp', 'rp_redeem-kit-titan-vip_one_time', 'RP One Time', 0, 'usd', 150000, 'one_time', 'one_time', 0, 0, 1, 1 FROM store_products p WHERE p.slug = 'redeem-kit-titan-vip'
UNION ALL
SELECT p.id, 'rp', 'rp_redeem-pack-sentry-small_one_time', 'RP One Time', 0, 'usd', 10000, 'one_time', 'one_time', 0, 0, 1, 1 FROM store_products p WHERE p.slug = 'redeem-pack-sentry-small'
UNION ALL
SELECT p.id, 'rp', 'rp_redeem-pack-sentry-large_one_time', 'RP One Time', 0, 'usd', 30000, 'one_time', 'one_time', 0, 0, 1, 1 FROM store_products p WHERE p.slug = 'redeem-pack-sentry-large'
UNION ALL
SELECT p.id, 'rp', 'rp_redeem-pack-portafort_one_time', 'RP One Time', 0, 'usd', 8000, 'one_time', 'one_time', 0, 0, 1, 1 FROM store_products p WHERE p.slug = 'redeem-pack-portafort'
UNION ALL
SELECT p.id, 'rp', 'rp_redeem-pack-vehicle_one_time', 'RP One Time', 0, 'usd', 40000, 'one_time', 'one_time', 0, 0, 1, 1 FROM store_products p WHERE p.slug = 'redeem-pack-vehicle'
ON DUPLICATE KEY UPDATE
  product_id = VALUES(product_id), payment_method = VALUES(payment_method), label = VALUES(label),
  amount_cents = VALUES(amount_cents), currency = VALUES(currency), rp_cost = VALUES(rp_cost),
  billing_interval = VALUES(billing_interval), access_interval = VALUES(access_interval),
  access_duration_seconds = VALUES(access_duration_seconds), allow_auto_renew = VALUES(allow_auto_renew),
  is_active = VALUES(is_active), is_default = VALUES(is_default), updated_at = NOW();

DELETE pfa FROM product_fulfillment_actions pfa
INNER JOIN store_products p ON p.id = pfa.product_id
WHERE p.slug IN ('rank-vip', 'rank-vip-plus', 'rank-mvp', 'rank-golden-vip', 'rank-diamond-vip', 'rank-ultimate-vip', 'rank-titan-vip', 'perk-queue-priority', 'perk-teleport-instant', 'perk-home-5s', 'perk-sign-art', 'perk-chat-title', 'perk-backpack-36', 'perk-backpack-42', 'perk-backpack-48', 'perk-backpack-keep-death', 'perk-backpack-keep-wipe', 'perk-spawn-full', 'perk-vehicle-hp-125', 'perk-vehicle-hp-150', 'perk-tc-12', 'perk-minicopter-instant-takeoff', 'perk-shop-sale-25', 'perk-shop-sale-50', 'perk-shop-sale-75', 'redeem-kit-vip', 'redeem-kit-vip-plus', 'redeem-kit-mvp', 'redeem-kit-golden-vip', 'redeem-kit-ultimate-vip', 'redeem-kit-titan-vip', 'redeem-pack-sentry-small', 'redeem-pack-sentry-large', 'redeem-pack-portafort', 'redeem-pack-vehicle') AND pfa.action_type = 'grant_group';

INSERT INTO product_fulfillment_actions (product_id, action_type, oxide_group, sort_order)
SELECT p.id, 'grant_group', 'rank_vip', 10 FROM store_products p WHERE p.slug = 'rank-vip'
UNION ALL
SELECT p.id, 'grant_group', 'rank_vip_plus', 10 FROM store_products p WHERE p.slug = 'rank-vip-plus'
UNION ALL
SELECT p.id, 'grant_group', 'rank_mvp', 10 FROM store_products p WHERE p.slug = 'rank-mvp'
UNION ALL
SELECT p.id, 'grant_group', 'rank_golden_vip', 10 FROM store_products p WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, 'grant_group', 'rank_diamond_vip', 10 FROM store_products p WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, 'grant_group', 'rank_ultimate_vip', 10 FROM store_products p WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, 'grant_group', 'rank_titan_vip', 10 FROM store_products p WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, 'grant_group', 'perk_queue_priority', 10 FROM store_products p WHERE p.slug = 'perk-queue-priority'
UNION ALL
SELECT p.id, 'grant_group', 'perk_teleport_instant', 10 FROM store_products p WHERE p.slug = 'perk-teleport-instant'
UNION ALL
SELECT p.id, 'grant_group', 'perk_home_5s', 10 FROM store_products p WHERE p.slug = 'perk-home-5s'
UNION ALL
SELECT p.id, 'grant_group', 'perk_sign_art', 10 FROM store_products p WHERE p.slug = 'perk-sign-art'
UNION ALL
SELECT p.id, 'grant_group', 'perk_chat_title', 10 FROM store_products p WHERE p.slug = 'perk-chat-title'
UNION ALL
SELECT p.id, 'grant_group', 'perk_backpack_36', 10 FROM store_products p WHERE p.slug = 'perk-backpack-36'
UNION ALL
SELECT p.id, 'grant_group', 'perk_backpack_42', 10 FROM store_products p WHERE p.slug = 'perk-backpack-42'
UNION ALL
SELECT p.id, 'grant_group', 'perk_backpack_48', 10 FROM store_products p WHERE p.slug = 'perk-backpack-48'
UNION ALL
SELECT p.id, 'grant_group', 'perk_backpack_keep_death', 10 FROM store_products p WHERE p.slug = 'perk-backpack-keep-death'
UNION ALL
SELECT p.id, 'grant_group', 'perk_backpack_keep_wipe', 10 FROM store_products p WHERE p.slug = 'perk-backpack-keep-wipe'
UNION ALL
SELECT p.id, 'grant_group', 'perk_spawn_full', 10 FROM store_products p WHERE p.slug = 'perk-spawn-full'
UNION ALL
SELECT p.id, 'grant_group', 'perk_vehicle_hp_125', 10 FROM store_products p WHERE p.slug = 'perk-vehicle-hp-125'
UNION ALL
SELECT p.id, 'grant_group', 'perk_vehicle_hp_150', 10 FROM store_products p WHERE p.slug = 'perk-vehicle-hp-150'
UNION ALL
SELECT p.id, 'grant_group', 'perk_tc_12', 10 FROM store_products p WHERE p.slug = 'perk-tc-12'
UNION ALL
SELECT p.id, 'grant_group', 'perk_minicopter_instant_takeoff', 10 FROM store_products p WHERE p.slug = 'perk-minicopter-instant-takeoff'
UNION ALL
SELECT p.id, 'grant_group', 'perk_shop_sale_25', 10 FROM store_products p WHERE p.slug = 'perk-shop-sale-25'
UNION ALL
SELECT p.id, 'grant_group', 'perk_shop_sale_50', 10 FROM store_products p WHERE p.slug = 'perk-shop-sale-50'
UNION ALL
SELECT p.id, 'grant_group', 'perk_shop_sale_75', 10 FROM store_products p WHERE p.slug = 'perk-shop-sale-75';

DELETE spk FROM store_product_kits spk
INNER JOIN store_products p ON p.id = spk.product_id
WHERE p.slug IN ('rank-vip', 'rank-vip-plus', 'rank-mvp', 'rank-golden-vip', 'rank-diamond-vip', 'rank-ultimate-vip', 'rank-titan-vip', 'perk-queue-priority', 'perk-teleport-instant', 'perk-home-5s', 'perk-sign-art', 'perk-chat-title', 'perk-backpack-36', 'perk-backpack-42', 'perk-backpack-48', 'perk-backpack-keep-death', 'perk-backpack-keep-wipe', 'perk-spawn-full', 'perk-vehicle-hp-125', 'perk-vehicle-hp-150', 'perk-tc-12', 'perk-minicopter-instant-takeoff', 'perk-shop-sale-25', 'perk-shop-sale-50', 'perk-shop-sale-75', 'redeem-kit-vip', 'redeem-kit-vip-plus', 'redeem-kit-mvp', 'redeem-kit-golden-vip', 'redeem-kit-ultimate-vip', 'redeem-kit-titan-vip', 'redeem-pack-sentry-small', 'redeem-pack-sentry-large', 'redeem-pack-portafort', 'redeem-pack-vehicle');

INSERT INTO store_product_kits (product_id, kit_id, sort_order)
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'kit_vip' WHERE p.slug = 'rank-vip'
UNION ALL
SELECT p.id, gk.id, 20 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_sentry_small' WHERE p.slug = 'rank-vip'
UNION ALL
SELECT p.id, gk.id, 30 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_portafort' WHERE p.slug = 'rank-vip'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'kit_vip_plus' WHERE p.slug = 'rank-vip-plus'
UNION ALL
SELECT p.id, gk.id, 20 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_sentry_small' WHERE p.slug = 'rank-vip-plus'
UNION ALL
SELECT p.id, gk.id, 30 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_portafort' WHERE p.slug = 'rank-vip-plus'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'kit_mvp' WHERE p.slug = 'rank-mvp'
UNION ALL
SELECT p.id, gk.id, 20 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_sentry_small' WHERE p.slug = 'rank-mvp'
UNION ALL
SELECT p.id, gk.id, 30 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_portafort' WHERE p.slug = 'rank-mvp'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'kit_golden_vip' WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, gk.id, 20 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_sentry_small' WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, gk.id, 30 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_portafort' WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'kit_golden_vip' WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, gk.id, 20 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'kit_vip_plus_diamond' WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, gk.id, 30 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'kit_vip_diamond' WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, gk.id, 40 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_sentry_small' WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, gk.id, 50 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_portafort' WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'kit_ultimate_vip' WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, gk.id, 20 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_sentry_small' WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, gk.id, 30 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_sentry_large' WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, gk.id, 40 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_portafort' WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, gk.id, 50 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_vehicle' WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'kit_titan_vip' WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, gk.id, 20 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_sentry_small' WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, gk.id, 30 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_sentry_large' WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, gk.id, 40 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_portafort' WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, gk.id, 50 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_vehicle' WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'kit_vip' WHERE p.slug = 'redeem-kit-vip'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'kit_vip_plus' WHERE p.slug = 'redeem-kit-vip-plus'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'kit_mvp' WHERE p.slug = 'redeem-kit-mvp'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'kit_golden_vip' WHERE p.slug = 'redeem-kit-golden-vip'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'kit_ultimate_vip' WHERE p.slug = 'redeem-kit-ultimate-vip'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'kit_titan_vip' WHERE p.slug = 'redeem-kit-titan-vip'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_sentry_small' WHERE p.slug = 'redeem-pack-sentry-small'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_sentry_large' WHERE p.slug = 'redeem-pack-sentry-large'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_portafort' WHERE p.slug = 'redeem-pack-portafort'
UNION ALL
SELECT p.id, gk.id, 10 FROM store_products p INNER JOIN game_kits gk ON gk.kit_name = 'pack_vehicle' WHERE p.slug = 'redeem-pack-vehicle';

DELETE spg FROM store_product_permission_grants spg
INNER JOIN store_products p ON p.id = spg.product_id
WHERE p.slug IN ('rank-vip', 'rank-vip-plus', 'rank-mvp', 'rank-golden-vip', 'rank-diamond-vip', 'rank-ultimate-vip', 'rank-titan-vip', 'perk-queue-priority', 'perk-teleport-instant', 'perk-home-5s', 'perk-sign-art', 'perk-chat-title', 'perk-backpack-36', 'perk-backpack-42', 'perk-backpack-48', 'perk-backpack-keep-death', 'perk-backpack-keep-wipe', 'perk-spawn-full', 'perk-vehicle-hp-125', 'perk-vehicle-hp-150', 'perk-tc-12', 'perk-minicopter-instant-takeoff', 'perk-shop-sale-25', 'perk-shop-sale-50', 'perk-shop-sale-75', 'redeem-kit-vip', 'redeem-kit-vip-plus', 'redeem-kit-mvp', 'redeem-kit-golden-vip', 'redeem-kit-ultimate-vip', 'redeem-kit-titan-vip', 'redeem-pack-sentry-small', 'redeem-pack-sentry-large', 'redeem-pack-portafort', 'redeem-pack-vehicle');

INSERT INTO store_product_permission_grants (product_id, permission_name, display_label, sort_order)
SELECT p.id, 'backpacks.size.36', 'backpacks.size.36', 10 FROM store_products p WHERE p.slug = 'rank-vip'
UNION ALL
SELECT p.id, 'betterchat.group.vip', 'betterchat.group.vip', 20 FROM store_products p WHERE p.slug = 'rank-vip'
UNION ALL
SELECT p.id, 'bypassqueue.allow', 'bypassqueue.allow', 30 FROM store_products p WHERE p.slug = 'rank-vip'
UNION ALL
SELECT p.id, 'nteleportation.home.5s', 'nteleportation.home.5s', 40 FROM store_products p WHERE p.slug = 'rank-vip'
UNION ALL
SELECT p.id, 'nteleportation.instant', 'nteleportation.instant', 50 FROM store_products p WHERE p.slug = 'rank-vip'
UNION ALL
SELECT p.id, 'playtimetracker.vip', 'playtimetracker.vip', 60 FROM store_products p WHERE p.slug = 'rank-vip'
UNION ALL
SELECT p.id, 'raidlands.vehicle.hp.125', 'raidlands.vehicle.hp.125', 70 FROM store_products p WHERE p.slug = 'rank-vip'
UNION ALL
SELECT p.id, 'signartist.url', 'signartist.url', 80 FROM store_products p WHERE p.slug = 'rank-vip'
UNION ALL
SELECT p.id, 'backpacks.size.36', 'backpacks.size.36', 10 FROM store_products p WHERE p.slug = 'rank-vip-plus'
UNION ALL
SELECT p.id, 'betterchat.group.vip_plus', 'betterchat.group.vip_plus', 20 FROM store_products p WHERE p.slug = 'rank-vip-plus'
UNION ALL
SELECT p.id, 'bypassqueue.allow', 'bypassqueue.allow', 30 FROM store_products p WHERE p.slug = 'rank-vip-plus'
UNION ALL
SELECT p.id, 'nteleportation.home.5s', 'nteleportation.home.5s', 40 FROM store_products p WHERE p.slug = 'rank-vip-plus'
UNION ALL
SELECT p.id, 'nteleportation.instant', 'nteleportation.instant', 50 FROM store_products p WHERE p.slug = 'rank-vip-plus'
UNION ALL
SELECT p.id, 'playtimetracker.vip_plus', 'playtimetracker.vip_plus', 60 FROM store_products p WHERE p.slug = 'rank-vip-plus'
UNION ALL
SELECT p.id, 'raidlands.vehicle.hp.125', 'raidlands.vehicle.hp.125', 70 FROM store_products p WHERE p.slug = 'rank-vip-plus'
UNION ALL
SELECT p.id, 'signartist.url', 'signartist.url', 80 FROM store_products p WHERE p.slug = 'rank-vip-plus'
UNION ALL
SELECT p.id, 'backpacks.keepondeath', 'backpacks.keepondeath', 10 FROM store_products p WHERE p.slug = 'rank-mvp'
UNION ALL
SELECT p.id, 'backpacks.size.36', 'backpacks.size.36', 20 FROM store_products p WHERE p.slug = 'rank-mvp'
UNION ALL
SELECT p.id, 'betterchat.group.mvp', 'betterchat.group.mvp', 30 FROM store_products p WHERE p.slug = 'rank-mvp'
UNION ALL
SELECT p.id, 'bypassqueue.allow', 'bypassqueue.allow', 40 FROM store_products p WHERE p.slug = 'rank-mvp'
UNION ALL
SELECT p.id, 'nteleportation.home.5s', 'nteleportation.home.5s', 50 FROM store_products p WHERE p.slug = 'rank-mvp'
UNION ALL
SELECT p.id, 'nteleportation.instant', 'nteleportation.instant', 60 FROM store_products p WHERE p.slug = 'rank-mvp'
UNION ALL
SELECT p.id, 'playtimetracker.mvp', 'playtimetracker.mvp', 70 FROM store_products p WHERE p.slug = 'rank-mvp'
UNION ALL
SELECT p.id, 'raidlands.vehicle.hp.125', 'raidlands.vehicle.hp.125', 80 FROM store_products p WHERE p.slug = 'rank-mvp'
UNION ALL
SELECT p.id, 'signartist.url', 'signartist.url', 90 FROM store_products p WHERE p.slug = 'rank-mvp'
UNION ALL
SELECT p.id, 'backpacks.keepondeath', 'backpacks.keepondeath', 10 FROM store_products p WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, 'backpacks.keeponwipe.all', 'backpacks.keeponwipe.all', 20 FROM store_products p WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, 'backpacks.size.42', 'backpacks.size.42', 30 FROM store_products p WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, 'betterchat.group.golden_vip', 'betterchat.group.golden_vip', 40 FROM store_products p WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, 'bypassqueue.allow', 'bypassqueue.allow', 50 FROM store_products p WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, 'cupboardlimiter.limit_1', 'cupboardlimiter.limit_1', 60 FROM store_products p WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, 'nteleportation.home.5s', 'nteleportation.home.5s', 70 FROM store_products p WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, 'nteleportation.instant', 'nteleportation.instant', 80 FROM store_products p WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, 'playtimetracker.golden_vip', 'playtimetracker.golden_vip', 90 FROM store_products p WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, 'raidlands.vehicle.hp.125', 'raidlands.vehicle.hp.125', 100 FROM store_products p WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, 'signartist.url', 'signartist.url', 110 FROM store_products p WHERE p.slug = 'rank-golden-vip'
UNION ALL
SELECT p.id, 'backpacks.keepondeath', 'backpacks.keepondeath', 10 FROM store_products p WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, 'backpacks.keeponwipe.all', 'backpacks.keeponwipe.all', 20 FROM store_products p WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, 'backpacks.size.48', 'backpacks.size.48', 30 FROM store_products p WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, 'betterchat.group.diamond_vip', 'betterchat.group.diamond_vip', 40 FROM store_products p WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, 'bypassqueue.allow', 'bypassqueue.allow', 50 FROM store_products p WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, 'cupboardlimiter.limit_1', 'cupboardlimiter.limit_1', 60 FROM store_products p WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, 'nteleportation.home.5s', 'nteleportation.home.5s', 70 FROM store_products p WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, 'nteleportation.instant', 'nteleportation.instant', 80 FROM store_products p WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, 'playtimetracker.diamond_vip', 'playtimetracker.diamond_vip', 90 FROM store_products p WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, 'raidlands.vehicle.hp.125', 'raidlands.vehicle.hp.125', 100 FROM store_products p WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, 'signartist.url', 'signartist.url', 110 FROM store_products p WHERE p.slug = 'rank-diamond-vip'
UNION ALL
SELECT p.id, 'backpacks.keepondeath', 'backpacks.keepondeath', 10 FROM store_products p WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, 'backpacks.keeponwipe.all', 'backpacks.keeponwipe.all', 20 FROM store_products p WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, 'backpacks.size.48', 'backpacks.size.48', 30 FROM store_products p WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, 'betterchat.group.ultimate_vip', 'betterchat.group.ultimate_vip', 40 FROM store_products p WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, 'bypassqueue.allow', 'bypassqueue.allow', 50 FROM store_products p WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, 'cupboardlimiter.limit_1', 'cupboardlimiter.limit_1', 60 FROM store_products p WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, 'nteleportation.home.5s', 'nteleportation.home.5s', 70 FROM store_products p WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, 'nteleportation.instant', 'nteleportation.instant', 80 FROM store_products p WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, 'playtimetracker.ultimate_vip', 'playtimetracker.ultimate_vip', 90 FROM store_products p WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, 'raidlands.vehicle.hp.150', 'raidlands.vehicle.hp.150', 100 FROM store_products p WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, 'signartist.url', 'signartist.url', 110 FROM store_products p WHERE p.slug = 'rank-ultimate-vip'
UNION ALL
SELECT p.id, 'backpacks.keepondeath', 'backpacks.keepondeath', 10 FROM store_products p WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, 'backpacks.keeponwipe.all', 'backpacks.keeponwipe.all', 20 FROM store_products p WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, 'backpacks.size.48', 'backpacks.size.48', 30 FROM store_products p WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, 'betterchat.group.titan_vip', 'betterchat.group.titan_vip', 40 FROM store_products p WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, 'bypassqueue.allow', 'bypassqueue.allow', 50 FROM store_products p WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, 'cupboardlimiter.limit_1', 'cupboardlimiter.limit_1', 60 FROM store_products p WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, 'nteleportation.home.5s', 'nteleportation.home.5s', 70 FROM store_products p WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, 'nteleportation.instant', 'nteleportation.instant', 80 FROM store_products p WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, 'playtimetracker.titan_vip', 'playtimetracker.titan_vip', 90 FROM store_products p WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, 'raidlands.vehicle.hp.150', 'raidlands.vehicle.hp.150', 100 FROM store_products p WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, 'signartist.url', 'signartist.url', 110 FROM store_products p WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, 'spawnheli.minicopter.instanttakeoff', 'spawnheli.minicopter.instanttakeoff', 120 FROM store_products p WHERE p.slug = 'rank-titan-vip'
UNION ALL
SELECT p.id, 'bypassqueue.allow', 'bypassqueue.allow', 10 FROM store_products p WHERE p.slug = 'perk-queue-priority'
UNION ALL
SELECT p.id, 'nteleportation.instant', 'nteleportation.instant', 10 FROM store_products p WHERE p.slug = 'perk-teleport-instant'
UNION ALL
SELECT p.id, 'nteleportation.home.5s', 'nteleportation.home.5s', 10 FROM store_products p WHERE p.slug = 'perk-home-5s'
UNION ALL
SELECT p.id, 'signartist.url', 'signartist.url', 10 FROM store_products p WHERE p.slug = 'perk-sign-art'
UNION ALL
SELECT p.id, 'betterchat.group.perk_chat_title', 'betterchat.group.perk_chat_title', 10 FROM store_products p WHERE p.slug = 'perk-chat-title'
UNION ALL
SELECT p.id, 'backpacks.size.36', 'backpacks.size.36', 10 FROM store_products p WHERE p.slug = 'perk-backpack-36'
UNION ALL
SELECT p.id, 'backpacks.size.42', 'backpacks.size.42', 10 FROM store_products p WHERE p.slug = 'perk-backpack-42'
UNION ALL
SELECT p.id, 'backpacks.size.48', 'backpacks.size.48', 10 FROM store_products p WHERE p.slug = 'perk-backpack-48'
UNION ALL
SELECT p.id, 'backpacks.keepondeath', 'backpacks.keepondeath', 10 FROM store_products p WHERE p.slug = 'perk-backpack-keep-death'
UNION ALL
SELECT p.id, 'backpacks.keeponwipe.all', 'backpacks.keeponwipe.all', 10 FROM store_products p WHERE p.slug = 'perk-backpack-keep-wipe'
UNION ALL
SELECT p.id, 'raidlands.vehicle.hp.125', 'raidlands.vehicle.hp.125', 10 FROM store_products p WHERE p.slug = 'perk-vehicle-hp-125'
UNION ALL
SELECT p.id, 'raidlands.vehicle.hp.150', 'raidlands.vehicle.hp.150', 10 FROM store_products p WHERE p.slug = 'perk-vehicle-hp-150'
UNION ALL
SELECT p.id, 'cupboardlimiter.limit_1', 'cupboardlimiter.limit_1', 10 FROM store_products p WHERE p.slug = 'perk-tc-12'
UNION ALL
SELECT p.id, 'spawnheli.minicopter.instanttakeoff', 'spawnheli.minicopter.instanttakeoff', 10 FROM store_products p WHERE p.slug = 'perk-minicopter-instant-takeoff';

INSERT INTO game_kit_sync_log (revision, status, payload_json, payload_hash, message)
VALUES (@rollout_revision, 'pending', NULL, '', 'Published Raidlands VIP kit workbook rollout.');

INSERT INTO oxide_permission_sync_log (revision, status, payload_json, payload_hash, message)
VALUES (@rollout_revision, 'pending', NULL, '', 'Published Raidlands VIP permission workbook rollout.');
