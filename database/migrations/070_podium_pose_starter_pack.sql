-- Starter poses validated in the production Three.js profile viewer against the
-- hazmat, ninja, and heavy-scientist rigs. Rotations are additive radians over
-- the shared Raidlands mannequin pose.

-- Remove the unreviewed first draft if this migration was run before revision.
UPDATE player_podium_profiles
SET pose_key = 'default'
WHERE pose_key IN ('relaxed-ready', 'victory-salute', 'wasteland-lookout', 'raid-boss');

DELETE FROM podium_pose_presets
WHERE pose_key IN ('relaxed-ready', 'victory-salute', 'wasteland-lookout', 'raid-boss');

INSERT INTO podium_pose_presets (pose_key, label, rotations_json, is_active)
VALUES
  ('arms-folded', 'Arms Folded', '{"l_upperarm":{"x":0,"y":-0.65,"z":0},"l_forearm":{"x":-0.6,"y":0,"z":0},"r_upperarm":{"x":0,"y":-0.65,"z":0},"r_forearm":{"x":-0.6,"y":0,"z":0}}', 1),
  ('victory-fist', 'Victory Fist', '{"r_upperarm":{"x":0,"y":0,"z":-0.8},"r_forearm":{"x":0,"y":0.65,"z":0}}', 1),
  ('point-man', 'Point Man', '{"r_upperarm":{"x":0,"y":0.72,"z":0},"r_forearm":{"x":0.52,"y":0,"z":0}}', 1)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  rotations_json = VALUES(rotations_json),
  is_active = VALUES(is_active);
