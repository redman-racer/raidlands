SET @kit_image_revision := (
  SELECT COALESCE(MAX(revision), 0) + 1
  FROM game_kit_sync_log
  WHERE status <> 'snapshot'
);

-- Link generated Raidlands kit artwork to active website kit records.

UPDATE game_kits AS gk
INNER JOIN (
  SELECT 'Starter Kit' AS kit_name, '/assets/media/kits/starter-kit.webp' AS image_path
  UNION ALL SELECT 'autokit', '/assets/media/kits/autokit.webp'
  UNION ALL SELECT 'raidlands_pvp_light', '/assets/media/kits/pvp-light-kit.webp'
  UNION ALL SELECT 'raidlands_pvp_rifle', '/assets/media/kits/pvp-rifle-kit.webp'
  UNION ALL SELECT 'raidlands_pvp_roamer', '/assets/media/kits/pvp-roamer-kit.webp'
  UNION ALL SELECT 'raidlands_pvp_heavy', '/assets/media/kits/pvp-heavy-kit.webp'
  UNION ALL SELECT 'raidlands_pvp_elite', '/assets/media/kits/pvp-elite-kit.webp'
  UNION ALL SELECT 'raidlands_pvp_breach', '/assets/media/kits/pvp-breach-kit.webp'
  UNION ALL SELECT 'kit_vip', '/assets/media/kits/vip-kit.webp'
  UNION ALL SELECT 'kit_vip_diamond', '/assets/media/kits/vip-diamond-kit.webp'
  UNION ALL SELECT 'kit_vip_plus', '/assets/media/kits/vip-plus-kit.webp'
  UNION ALL SELECT 'kit_vip_plus_diamond', '/assets/media/kits/vip-plus-diamond-kit.webp'
  UNION ALL SELECT 'kit_mvp', '/assets/media/kits/mvp-kit.webp'
  UNION ALL SELECT 'kit_golden_vip', '/assets/media/kits/golden-vip-kit.webp'
  UNION ALL SELECT 'kit_ultimate_vip', '/assets/media/kits/ultimate-vip-kit.webp'
  UNION ALL SELECT 'kit_titan_vip', '/assets/media/kits/titan-vip-kit.webp'
  UNION ALL SELECT 'pack_sentry_small', '/assets/media/kits/sentry-small-pack.webp'
  UNION ALL SELECT 'pack_sentry_large', '/assets/media/kits/sentry-large-pack.webp'
  UNION ALL SELECT 'pack_vehicle', '/assets/media/kits/vehicle-pack.webp'
  UNION ALL SELECT 'kit_claim_steam_name_rewards', '/assets/media/kits/steam-name-rewards-kit.webp'
  UNION ALL SELECT 'kit_claim_steam_rewards', '/assets/media/kits/steam-rewards-kit.webp'
  UNION ALL SELECT 'kit_claim_discord_booster', '/assets/media/kits/discord-booster-kit.webp'
  UNION ALL SELECT 'kit_claim_discord_raid', '/assets/media/kits/discord-raid-kit.webp'
  UNION ALL SELECT 'kit_claim_discord', '/assets/media/kits/discord-kit.webp'
  UNION ALL SELECT 'kit_claim_556', '/assets/media/kits/556-kit.webp'
  UNION ALL SELECT 'kit_claim_scrap', '/assets/media/kits/scrap-kit.webp'
  UNION ALL SELECT 'kit_claim_mp5', '/assets/media/kits/mp5-kit.webp'
  UNION ALL SELECT 'kit_claim_lr300', '/assets/media/kits/lr300-kit.webp'
  UNION ALL SELECT 'kit_claim_m16a2', '/assets/media/kits/m16a2-kit.webp'
  UNION ALL SELECT 'kit_claim_ak', '/assets/media/kits/ak-kit.webp'
) AS kit_images ON kit_images.kit_name = gk.kit_name
SET
  gk.image_path = kit_images.image_path,
  gk.reward_icon_url = CASE
    WHEN gk.reward_enabled = 1 THEN kit_images.image_path
    ELSE gk.reward_icon_url
  END,
  gk.draft_revision = @kit_image_revision,
  gk.published_revision = @kit_image_revision,
  gk.published_at = NOW(),
  gk.updated_at = NOW()
WHERE gk.deleted_at IS NULL
  AND (
    COALESCE(gk.image_path, '') <> kit_images.image_path
    OR (gk.reward_enabled = 1 AND COALESCE(gk.reward_icon_url, '') <> kit_images.image_path)
  );

SET @kit_image_changed_count := ROW_COUNT();

INSERT INTO game_kit_sync_log (revision, status, payload_json, payload_hash, message)
SELECT @kit_image_revision, 'pending', NULL, '', 'Published generated kit image links.'
WHERE @kit_image_changed_count > 0;
