SELECT
  revision,
  schema_version,
  compiler_version,
  profile_count,
  CHAR_LENGTH(bundle_json) AS bundle_json_chars,
  JSON_VALID(bundle_json) AS bundle_json_is_valid,
  sha256 AS stored_sha256,
  SHA2(bundle_json, 256) AS calculated_sha256,
  (sha256 = SHA2(bundle_json, 256)) AS sha_matches,
  published_at
FROM airstrike_animation_bundles
WHERE JSON_VALID(bundle_json) = 0
   OR bundle_json IS NULL
   OR TRIM(bundle_json) = ''
   OR sha256 <> SHA2(bundle_json, 256)
ORDER BY revision DESC;
