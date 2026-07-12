START TRANSACTION;

DELETE FROM airstrike_animation_profile_revisions
WHERE bundle_revision = 11;

DELETE FROM airstrike_animation_bundles
WHERE revision = 11;

UPDATE airstrike_animation_profiles
SET last_published_profile_revision = NULL
WHERE last_published_profile_revision IS NOT NULL
  AND id NOT IN (
    SELECT profile_id
    FROM airstrike_animation_profile_revisions
  );

UPDATE airstrike_animation_profiles p
JOIN (
  SELECT profile_id, MAX(profile_revision) AS latest_profile_revision
  FROM airstrike_animation_profile_revisions
  GROUP BY profile_id
) latest
  ON latest.profile_id = p.id
SET p.last_published_profile_revision = latest.latest_profile_revision;

COMMIT;

