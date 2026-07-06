SET @kit_condition_revision := (
  SELECT COALESCE(MAX(revision), 0) + 1
  FROM game_kit_sync_log
  WHERE status <> 'snapshot'
);

-- Some kit rows were saved with 0/0 durability for Rust condition items.
-- The Kits plugin applies those values literally, which spawns ruined weapons
-- and can create broken non-stackable item stacks. Repair the saved rows and
-- publish a new kit sync revision.

UPDATE game_kit_items AS gki
INNER JOIN (
  SELECT 'autoturret' AS shortname, CAST(100.00 AS DECIMAL(10,2)) AS max_condition
  UNION ALL SELECT 'computerstation', 100.00
  UNION ALL SELECT 'diving.mask', 200.00
  UNION ALL SELECT 'diving.tank', 600.00
  UNION ALL SELECT 'electric.generator.small', 100.00
  UNION ALL SELECT 'flashlight.held', 50.00
  UNION ALL SELECT 'hatchet', 400.00
  UNION ALL SELECT 'jackhammer', 300.00
  UNION ALL SELECT 'keycard_blue', 4.00
  UNION ALL SELECT 'keycard_green', 4.00
  UNION ALL SELECT 'keycard_red', 2.00
  UNION ALL SELECT 'lmg.m249', 500.00
  UNION ALL SELECT 'm16a2', 200.00
  UNION ALL SELECT 'metal.facemask', 320.00
  UNION ALL SELECT 'metal.plate.torso', 360.00
  UNION ALL SELECT 'multiplegrenadelauncher', 200.00
  UNION ALL SELECT 'rifle.ak', 150.00
  UNION ALL SELECT 'rifle.l96', 60.00
  UNION ALL SELECT 'rifle.lr300', 150.00
  UNION ALL SELECT 'roadsign.kilt', 150.00
  UNION ALL SELECT 'rocket.launcher', 100.00
  UNION ALL SELECT 'samsite', 100.00
  UNION ALL SELECT 'smg.mp5', 150.00
  UNION ALL SELECT 'weapon.mod.muzzleboost', 100.00
  UNION ALL SELECT 'weapon.mod.muzzlebrake', 200.00
  UNION ALL SELECT 'weapon.mod.silencer', 100.00
) AS defaults ON defaults.shortname = gki.shortname
SET
  gki.condition_value = defaults.max_condition,
  gki.max_condition = defaults.max_condition,
  gki.amount = CASE WHEN gki.amount > 1 THEN 1 ELSE gki.amount END,
  gki.updated_at = NOW()
WHERE gki.condition_value <> defaults.max_condition
   OR gki.max_condition <> defaults.max_condition
   OR gki.amount > 1;

SET @kit_condition_changed_count := ROW_COUNT();

UPDATE game_kits
SET
  draft_revision = @kit_condition_revision,
  published_revision = @kit_condition_revision,
  published_at = NOW(),
  updated_at = NOW()
WHERE @kit_condition_changed_count > 0
  AND deleted_at IS NULL;

SET @kit_condition_published_count := ROW_COUNT();

INSERT INTO game_kit_sync_log (revision, status, payload_json, payload_hash, message)
SELECT @kit_condition_revision, 'pending', NULL, '', 'Repaired kit item condition defaults and non-stackable item amounts.'
WHERE @kit_condition_changed_count > 0
   OR @kit_condition_published_count > 0;
