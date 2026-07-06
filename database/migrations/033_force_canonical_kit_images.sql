SET @kit_image_revision := (
  SELECT COALESCE(MAX(revision), 0) + 1
  FROM game_kit_sync_log
  WHERE status <> 'snapshot'
);

-- Re-assert generated kit artwork after server snapshots or stale admin edits.

UPDATE game_kits AS gk
LEFT JOIN (
  SELECT 'kits.autokit' AS required_permission, '/assets/media/kits/autokit.webp' AS image_path
  UNION ALL SELECT 'kits.pvp.light', '/assets/media/kits/pvp-light-kit.webp'
  UNION ALL SELECT 'kits.pvp.rifle', '/assets/media/kits/pvp-rifle-kit.webp'
  UNION ALL SELECT 'kits.pvp.roamer', '/assets/media/kits/pvp-roamer-kit.webp'
  UNION ALL SELECT 'kits.pvp.heavy', '/assets/media/kits/pvp-heavy-kit.webp'
  UNION ALL SELECT 'kits.pvp.elite', '/assets/media/kits/pvp-elite-kit.webp'
  UNION ALL SELECT 'kits.pvp.breach', '/assets/media/kits/pvp-breach-kit.webp'
  UNION ALL SELECT 'kits.vip', '/assets/media/kits/vip-kit.webp'
  UNION ALL SELECT 'kits.vip.diamond', '/assets/media/kits/vip-diamond-kit.webp'
  UNION ALL SELECT 'kits.vipplus', '/assets/media/kits/vip-plus-kit.webp'
  UNION ALL SELECT 'kits.vipplus.diamond', '/assets/media/kits/vip-plus-diamond-kit.webp'
  UNION ALL SELECT 'kits.mvp', '/assets/media/kits/mvp-kit.webp'
  UNION ALL SELECT 'kits.goldenvip', '/assets/media/kits/golden-vip-kit.webp'
  UNION ALL SELECT 'kits.ultimatevip', '/assets/media/kits/ultimate-vip-kit.webp'
  UNION ALL SELECT 'kits.titanvip', '/assets/media/kits/titan-vip-kit.webp'
  UNION ALL SELECT 'kits.sentry.small', '/assets/media/kits/sentry-small-pack.webp'
  UNION ALL SELECT 'kits.sentry.large', '/assets/media/kits/sentry-large-pack.webp'
  UNION ALL SELECT 'kits.portafort', '/assets/media/kits/portafort-token.webp'
  UNION ALL SELECT 'kits.vehicle', '/assets/media/kits/vehicle-pack.webp'
  UNION ALL SELECT 'kits.claim.steam_name_rewards', '/assets/media/kits/steam-name-rewards-kit.webp'
  UNION ALL SELECT 'kits.claim.steam_rewards', '/assets/media/kits/steam-rewards-kit.webp'
  UNION ALL SELECT 'kits.claim.discord_booster', '/assets/media/kits/discord-booster-kit.webp'
  UNION ALL SELECT 'kits.claim.discord_raid', '/assets/media/kits/discord-raid-kit.webp'
  UNION ALL SELECT 'kits.claim.discord', '/assets/media/kits/discord-kit.webp'
  UNION ALL SELECT 'kits.claim.556', '/assets/media/kits/556-kit.webp'
  UNION ALL SELECT 'kits.claim.cards', '/assets/media/kits/cards-kit.webp'
  UNION ALL SELECT 'kits.claim.scrap', '/assets/media/kits/scrap-kit.webp'
  UNION ALL SELECT 'kits.claim.scuba', '/assets/media/kits/scuba-kit.webp'
  UNION ALL SELECT 'kits.claim.components', '/assets/media/kits/comps-kit.webp'
  UNION ALL SELECT 'kits.comp', '/assets/media/kits/comps-kit.webp'
  UNION ALL SELECT 'kits.claim.build', '/assets/media/kits/build-kit.webp'
  UNION ALL SELECT 'kits.build', '/assets/media/kits/build-kit.webp'
  UNION ALL SELECT 'kits.claim.raid', '/assets/media/kits/raid-kit.webp'
  UNION ALL SELECT 'kits.raid', '/assets/media/kits/raid-kit.webp'
  UNION ALL SELECT 'kits.claim.medical', '/assets/media/kits/medical-kit.webp'
  UNION ALL SELECT 'kits.medical', '/assets/media/kits/medical-kit.webp'
  UNION ALL SELECT 'kits.claim.mp5', '/assets/media/kits/mp5-kit.webp'
  UNION ALL SELECT 'kits.claim.lr300', '/assets/media/kits/lr300-kit.webp'
  UNION ALL SELECT 'kits.claim.m16a2', '/assets/media/kits/m16a2-kit.webp'
  UNION ALL SELECT 'kits.claim.ak', '/assets/media/kits/ak-kit.webp'
) AS permission_images ON permission_images.required_permission = gk.required_permission
LEFT JOIN (
  SELECT 'starter kit' AS kit_name, '/assets/media/kits/starter-kit.webp' AS image_path
  UNION ALL SELECT 'autokit', '/assets/media/kits/autokit.webp'
  UNION ALL SELECT 'raidlands_pvp_light', '/assets/media/kits/pvp-light-kit.webp'
  UNION ALL SELECT 'pvp_light', '/assets/media/kits/pvp-light-kit.webp'
  UNION ALL SELECT 'raidlands_pvp_rifle', '/assets/media/kits/pvp-rifle-kit.webp'
  UNION ALL SELECT 'pvp_rifle', '/assets/media/kits/pvp-rifle-kit.webp'
  UNION ALL SELECT 'raidlands_pvp_roamer', '/assets/media/kits/pvp-roamer-kit.webp'
  UNION ALL SELECT 'pvp_roamer', '/assets/media/kits/pvp-roamer-kit.webp'
  UNION ALL SELECT 'raidlands_pvp_heavy', '/assets/media/kits/pvp-heavy-kit.webp'
  UNION ALL SELECT 'pvp_heavy', '/assets/media/kits/pvp-heavy-kit.webp'
  UNION ALL SELECT 'raidlands_pvp_elite', '/assets/media/kits/pvp-elite-kit.webp'
  UNION ALL SELECT 'pvp_elite', '/assets/media/kits/pvp-elite-kit.webp'
  UNION ALL SELECT 'raidlands_pvp_breach', '/assets/media/kits/pvp-breach-kit.webp'
  UNION ALL SELECT 'pvp_breach', '/assets/media/kits/pvp-breach-kit.webp'
  UNION ALL SELECT 'vip', '/assets/media/kits/vip-kit.webp'
  UNION ALL SELECT 'kit_vip', '/assets/media/kits/vip-kit.webp'
  UNION ALL SELECT 'diamond', '/assets/media/kits/vip-diamond-kit.webp'
  UNION ALL SELECT 'kit_vip_diamond', '/assets/media/kits/vip-diamond-kit.webp'
  UNION ALL SELECT 'vip_plus', '/assets/media/kits/vip-plus-kit.webp'
  UNION ALL SELECT 'kit_vip_plus', '/assets/media/kits/vip-plus-kit.webp'
  UNION ALL SELECT 'kit_vip_plus_diamond', '/assets/media/kits/vip-plus-diamond-kit.webp'
  UNION ALL SELECT 'mvp', '/assets/media/kits/mvp-kit.webp'
  UNION ALL SELECT 'kit_mvp', '/assets/media/kits/mvp-kit.webp'
  UNION ALL SELECT 'golden', '/assets/media/kits/golden-vip-kit.webp'
  UNION ALL SELECT 'kit_golden_vip', '/assets/media/kits/golden-vip-kit.webp'
  UNION ALL SELECT 'ultimate', '/assets/media/kits/ultimate-vip-kit.webp'
  UNION ALL SELECT 'kit_ultimate_vip', '/assets/media/kits/ultimate-vip-kit.webp'
  UNION ALL SELECT 'titan', '/assets/media/kits/titan-vip-kit.webp'
  UNION ALL SELECT 'kit_titan_vip', '/assets/media/kits/titan-vip-kit.webp'
  UNION ALL SELECT 'sentry', '/assets/media/kits/sentry-small-pack.webp'
  UNION ALL SELECT 'pack_sentry_small', '/assets/media/kits/sentry-small-pack.webp'
  UNION ALL SELECT 'sentry_large', '/assets/media/kits/sentry-large-pack.webp'
  UNION ALL SELECT 'pack_sentry_large', '/assets/media/kits/sentry-large-pack.webp'
  UNION ALL SELECT 'portafort', '/assets/media/kits/portafort-token.webp'
  UNION ALL SELECT 'vehicles', '/assets/media/kits/vehicle-pack.webp'
  UNION ALL SELECT 'pack_vehicle', '/assets/media/kits/vehicle-pack.webp'
  UNION ALL SELECT 'steam_name_rewards', '/assets/media/kits/steam-name-rewards-kit.webp'
  UNION ALL SELECT 'kit_claim_steam_name_rewards', '/assets/media/kits/steam-name-rewards-kit.webp'
  UNION ALL SELECT 'steam', '/assets/media/kits/steam-rewards-kit.webp'
  UNION ALL SELECT 'kit_claim_steam_rewards', '/assets/media/kits/steam-rewards-kit.webp'
  UNION ALL SELECT 'discord_booster', '/assets/media/kits/discord-booster-kit.webp'
  UNION ALL SELECT 'kit_claim_discord_booster', '/assets/media/kits/discord-booster-kit.webp'
  UNION ALL SELECT 'discord_raid', '/assets/media/kits/discord-raid-kit.webp'
  UNION ALL SELECT 'kit_claim_discord_raid', '/assets/media/kits/discord-raid-kit.webp'
  UNION ALL SELECT 'discord', '/assets/media/kits/discord-kit.webp'
  UNION ALL SELECT 'kit_claim_discord', '/assets/media/kits/discord-kit.webp'
  UNION ALL SELECT '556', '/assets/media/kits/556-kit.webp'
  UNION ALL SELECT 'kit_claim_556', '/assets/media/kits/556-kit.webp'
  UNION ALL SELECT 'cards', '/assets/media/kits/cards-kit.webp'
  UNION ALL SELECT 'kit_claim_cards', '/assets/media/kits/cards-kit.webp'
  UNION ALL SELECT 'scrap', '/assets/media/kits/scrap-kit.webp'
  UNION ALL SELECT 'kit_claim_scrap', '/assets/media/kits/scrap-kit.webp'
  UNION ALL SELECT 'scuba', '/assets/media/kits/scuba-kit.webp'
  UNION ALL SELECT 'kit_claim_scuba', '/assets/media/kits/scuba-kit.webp'
  UNION ALL SELECT 'components', '/assets/media/kits/comps-kit.webp'
  UNION ALL SELECT 'comps', '/assets/media/kits/comps-kit.webp'
  UNION ALL SELECT 'kit_claim_components', '/assets/media/kits/comps-kit.webp'
  UNION ALL SELECT 'build', '/assets/media/kits/build-kit.webp'
  UNION ALL SELECT 'build kit', '/assets/media/kits/build-kit.webp'
  UNION ALL SELECT 'kit_claim_build', '/assets/media/kits/build-kit.webp'
  UNION ALL SELECT 'raid', '/assets/media/kits/raid-kit.webp'
  UNION ALL SELECT 'raid kit', '/assets/media/kits/raid-kit.webp'
  UNION ALL SELECT 'kit_claim_raid', '/assets/media/kits/raid-kit.webp'
  UNION ALL SELECT 'medical', '/assets/media/kits/medical-kit.webp'
  UNION ALL SELECT 'kit_claim_medical', '/assets/media/kits/medical-kit.webp'
  UNION ALL SELECT 'mp5', '/assets/media/kits/mp5-kit.webp'
  UNION ALL SELECT 'kit_claim_mp5', '/assets/media/kits/mp5-kit.webp'
  UNION ALL SELECT 'lr300', '/assets/media/kits/lr300-kit.webp'
  UNION ALL SELECT 'kit_claim_lr300', '/assets/media/kits/lr300-kit.webp'
  UNION ALL SELECT 'm16', '/assets/media/kits/m16a2-kit.webp'
  UNION ALL SELECT 'kit_claim_m16a2', '/assets/media/kits/m16a2-kit.webp'
  UNION ALL SELECT 'ak', '/assets/media/kits/ak-kit.webp'
  UNION ALL SELECT 'kit_claim_ak', '/assets/media/kits/ak-kit.webp'
) AS kit_images ON kit_images.kit_name = LOWER(gk.kit_name)
SET
  gk.image_path = COALESCE(permission_images.image_path, kit_images.image_path),
  gk.reward_icon_url = CASE
    WHEN gk.reward_enabled = 1 THEN COALESCE(permission_images.image_path, kit_images.image_path)
    ELSE gk.reward_icon_url
  END,
  gk.draft_revision = @kit_image_revision,
  gk.published_revision = @kit_image_revision,
  gk.published_at = NOW(),
  gk.updated_at = NOW()
WHERE gk.deleted_at IS NULL
  AND COALESCE(permission_images.image_path, kit_images.image_path, '') <> ''
  AND (
    COALESCE(gk.image_path, '') <> COALESCE(permission_images.image_path, kit_images.image_path)
    OR (gk.reward_enabled = 1 AND COALESCE(gk.reward_icon_url, '') <> COALESCE(permission_images.image_path, kit_images.image_path))
  );

SET @kit_image_changed_count := ROW_COUNT();

INSERT INTO game_kit_sync_log (revision, status, payload_json, payload_hash, message)
SELECT @kit_image_revision, 'pending', NULL, '', 'Republished canonical generated kit image links.'
WHERE @kit_image_changed_count > 0;
