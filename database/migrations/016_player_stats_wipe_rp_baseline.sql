-- Splits live ServerRewards balance from wipe-scoped RP leaderboard values.
-- Safe to rerun on MySQL/MariaDB: the column is checked before creation.

SET @schema_name := DATABASE();

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'player_wipe_stats'
    AND COLUMN_NAME = 'baseline_reward_points'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE player_wipe_stats ADD COLUMN baseline_reward_points INT UNSIGNED NOT NULL DEFAULT 0 AFTER baseline_afk_seconds',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TEMPORARY TABLE IF EXISTS tmp_player_wipe_rp_baselines;

CREATE TEMPORARY TABLE tmp_player_wipe_rp_baselines AS
SELECT
  current_stats.id,
  COALESCE(MAX(previous_stats.raw_reward_points), 0) AS previous_reward_points,
  COUNT(DISTINCT previous_wipe.id) AS previous_wipe_count
FROM player_wipe_stats current_stats
INNER JOIN wipe_seasons current_wipe ON current_wipe.id = current_stats.wipe_id
LEFT JOIN wipe_seasons previous_wipe ON previous_wipe.server_id = current_wipe.server_id
  AND (
    COALESCE(previous_wipe.started_at, previous_wipe.created_at) < COALESCE(current_wipe.started_at, current_wipe.created_at)
    OR (
      COALESCE(previous_wipe.started_at, previous_wipe.created_at) = COALESCE(current_wipe.started_at, current_wipe.created_at)
      AND previous_wipe.id < current_wipe.id
    )
  )
LEFT JOIN player_wipe_stats previous_stats ON previous_stats.wipe_id = previous_wipe.id
  AND previous_stats.player_id = current_stats.player_id
GROUP BY current_stats.id;

UPDATE player_wipe_stats current_stats
INNER JOIN tmp_player_wipe_rp_baselines baselines ON baselines.id = current_stats.id
SET
  current_stats.baseline_reward_points = CASE
    WHEN baselines.previous_reward_points > 0 THEN LEAST(current_stats.raw_reward_points, baselines.previous_reward_points)
    WHEN current_stats.playtime_seconds = 0 AND baselines.previous_wipe_count > 0 THEN current_stats.raw_reward_points
    ELSE 0
  END,
  current_stats.reward_points = GREATEST(0, current_stats.raw_reward_points - CASE
    WHEN baselines.previous_reward_points > 0 THEN LEAST(current_stats.raw_reward_points, baselines.previous_reward_points)
    WHEN current_stats.playtime_seconds = 0 AND baselines.previous_wipe_count > 0 THEN current_stats.raw_reward_points
    ELSE 0
  END),
  current_stats.updated_at = NOW()
WHERE current_stats.baseline_reward_points = 0
  AND (
    baselines.previous_reward_points > 0
    OR (current_stats.playtime_seconds = 0 AND baselines.previous_wipe_count > 0 AND current_stats.raw_reward_points > 0)
  );

DROP TEMPORARY TABLE IF EXISTS tmp_player_wipe_rp_baselines;
