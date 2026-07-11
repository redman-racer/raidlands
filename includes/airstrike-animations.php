<?php

require_once __DIR__ . '/admin.php';
require_once __DIR__ . '/airstrike-animation-compiler.php';

const RAIDLANDS_AIRSTRIKE_ANIMATION_COMPILER_VERSION = 'raidlands-airanim-1';
const RAIDLANDS_AIRSTRIKE_ANIMATION_MAX_SOURCE_BYTES = 2097152;
const RAIDLANDS_AIRSTRIKE_ANIMATION_MAX_BUNDLE_BYTES = 20971520;

function raidlands_airstrike_animations_schema_ready(bool $refresh = false): bool
{
    static $ready = null;

    if ($refresh) {
        $ready = null;
    }

    if (is_bool($ready)) {
        return $ready;
    }

    if (!raidlands_db_is_configured()) {
        return $ready = false;
    }

    try {
        raidlands_db_required()->query('SELECT 1 FROM airstrike_animation_profiles LIMIT 1');
        raidlands_db_required()->query('SELECT 1 FROM airstrike_animation_bundles LIMIT 1');
        raidlands_db_required()->query('SELECT 1 FROM airstrike_animation_server_syncs LIMIT 1');
        raidlands_db_required()->query('SELECT 1 FROM airstrike_animation_server_snapshots LIMIT 1');
        $ready = true;
    } catch (Throwable $error) {
        $ready = false;
    }

    return $ready;
}

function raidlands_airstrike_animations_require_schema(): void
{
    if (!raidlands_airstrike_animations_schema_ready()) {
        throw new RuntimeException(
            'Airstrike animation storage is not installed. Run database/migrations/047_airstrike_animation_editor.sql.'
        );
    }
}

function raidlands_airstrike_animations_server_id(): string
{
    global $vip_bridge_config;

    $server_id = trim((string) ($vip_bridge_config['serverId'] ?? 'raidlands-main'));
    return $server_id !== '' ? mb_substr($server_id, 0, 80) : 'raidlands-main';
}

function raidlands_airstrike_animations_actor_id(): ?int
{
    $user = raidlands_admin_current_user();
    $id = is_array($user) ? (int) ($user['id'] ?? 0) : 0;
    return $id > 0 ? $id : null;
}

function raidlands_airstrike_animations_clean_key(string $profile_key): string
{
    $profile_key = strtolower(trim($profile_key));

    if (!preg_match('/^[a-z0-9][a-z0-9._-]{0,99}$/', $profile_key)) {
        throw new InvalidArgumentException(
            'ProfileKey must start with a letter or number and contain only lowercase letters, numbers, dots, dashes, or underscores.'
        );
    }

    return $profile_key;
}

function raidlands_airstrike_animations_decode_json(string $json, string $label): array
{
    if ($json === '' || strlen($json) > RAIDLANDS_AIRSTRIKE_ANIMATION_MAX_BUNDLE_BYTES) {
        throw new InvalidArgumentException($label . ' is empty or exceeds the configured size limit.');
    }

    try {
        $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        throw new InvalidArgumentException($label . ' is not valid JSON.', 0, $error);
    }

    if (!is_array($decoded)) {
        throw new InvalidArgumentException($label . ' must be a JSON object.');
    }

    return $decoded;
}

function raidlands_airstrike_animations_source_json(array $source): string
{
    $json = raidlands_airstrike_animation_canonical_json($source);

    if (strlen($json) > RAIDLANDS_AIRSTRIKE_ANIMATION_MAX_SOURCE_BYTES) {
        throw new InvalidArgumentException('Profile source exceeds the 2 MiB limit.');
    }

    return $json;
}

function raidlands_airstrike_animations_vehicle_metadata(): array
{
    static $metadata = null;

    if (is_array($metadata)) {
        return $metadata;
    }

    $path = dirname(__DIR__) . '/assets/airstrike-animation-editor/vehicle-preview.json';
    if (!is_file($path)) {
        return $metadata = [];
    }

    $json = file_get_contents($path);
    if (!is_string($json) || trim($json) === '') {
        throw new RuntimeException('Airstrike animation vehicle metadata could not be read.');
    }

    $metadata = raidlands_airstrike_animations_decode_json($json, 'Vehicle preview metadata');
    return $metadata;
}

function raidlands_airstrike_animations_assert_source(array $source, ?string $expected_key = null): array
{
    $profile_key = raidlands_airstrike_animations_clean_key((string) ($source['ProfileKey'] ?? ''));

    if ($expected_key !== null && $profile_key !== raidlands_airstrike_animations_clean_key($expected_key)) {
        throw new InvalidArgumentException('ProfileKey cannot be changed by a draft save. Duplicate the profile instead.');
    }

    $source['ProfileKey'] = $profile_key;
    $validation = raidlands_airstrike_animation_validate_profile(
        $source,
        'Profiles.' . $profile_key,
        raidlands_airstrike_animations_vehicle_metadata()
    );

    if (empty($validation['ok'])) {
        $errors = [];
        foreach ((array) ($validation['errors'] ?? []) as $error) {
            if (is_array($error)) {
                $path = trim((string) ($error['path'] ?? ''));
                $message = trim((string) ($error['message'] ?? 'Validation failed.'));
                $errors[] = ($path !== '' ? $path . ': ' : '') . $message;
            } else {
                $message = trim((string) $error);
                if ($message !== '') {
                    $errors[] = $message;
                }
            }
        }
        throw new InvalidArgumentException($errors === [] ? 'Profile validation failed.' : implode(' ', $errors));
    }

    return $source;
}

function raidlands_airstrike_animations_profile_row(array $row, bool $include_source = false): array
{
    $source = raidlands_airstrike_animations_decode_json((string) ($row['draft_source_json'] ?? ''), 'Draft source');
    $validation = raidlands_airstrike_animation_validate_profile(
        $source,
        'Profiles.' . (string) ($row['profile_key'] ?? ''),
        raidlands_airstrike_animations_vehicle_metadata()
    );
    $result = [
        'id' => (int) ($row['id'] ?? 0),
        'profileKey' => (string) ($row['profile_key'] ?? ''),
        'displayName' => (string) ($row['display_name'] ?? ''),
        'vehicle' => (string) ($row['vehicle'] ?? ''),
        'draftVersion' => (int) ($row['draft_version'] ?? 0),
        'draftSha256' => (string) ($row['draft_source_sha256'] ?? ''),
        'lastPublishedProfileRevision' => isset($row['last_published_profile_revision'])
            ? (int) $row['last_published_profile_revision']
            : null,
        'archived' => !empty($row['archived_at']),
        'archivedAt' => $row['archived_at'] ?? null,
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
        'validation' => $validation,
    ];

    if ($include_source) {
        $result['source'] = $source;
    }

    return $result;
}

function raidlands_airstrike_animations_latest_bundle_row(?int $revision = null): ?array
{
    raidlands_airstrike_animations_require_schema();

    if ($revision !== null) {
        if ($revision <= 0) {
            throw new InvalidArgumentException('Bundle revision must be a positive integer.');
        }

        return raidlands_db_fetch_one(
            'SELECT * FROM airstrike_animation_bundles WHERE revision = :revision LIMIT 1',
            ['revision' => $revision]
        );
    }

    return raidlands_db_fetch_one(
        'SELECT * FROM airstrike_animation_bundles ORDER BY revision DESC LIMIT 1'
    );
}

function raidlands_airstrike_animations_server_status(?string $server_id = null): ?array
{
    raidlands_airstrike_animations_require_schema();
    $server_id = trim((string) ($server_id ?? raidlands_airstrike_animations_server_id()));

    return raidlands_db_fetch_one(
        'SELECT * FROM airstrike_animation_server_syncs WHERE server_id = :server_id LIMIT 1',
        ['server_id' => $server_id]
    );
}

function raidlands_airstrike_animations_list(bool $include_archived = false): array
{
    raidlands_airstrike_animations_require_schema();
    $where = $include_archived ? '' : ' WHERE archived_at IS NULL';
    $rows = raidlands_db_fetch_all(
        'SELECT * FROM airstrike_animation_profiles' . $where . ' ORDER BY archived_at IS NOT NULL, profile_key ASC'
    );
    $profiles = array_map(
        static fn (array $row): array => raidlands_airstrike_animations_profile_row($row),
        $rows
    );
    $bundle = raidlands_airstrike_animations_latest_bundle_row();
    $server = raidlands_airstrike_animations_server_status();

    return [
        'ready' => true,
        'profiles' => $profiles,
        'publishedBundle' => $bundle === null ? null : [
            'revision' => (int) $bundle['revision'],
            'schemaVersion' => (int) $bundle['schema_version'],
            'compilerVersion' => (string) $bundle['compiler_version'],
            'sha256' => (string) $bundle['sha256'],
            'profileCount' => (int) $bundle['profile_count'],
            'publishedAt' => $bundle['published_at'],
        ],
        'server' => $server,
    ];
}

function raidlands_airstrike_animations_get(string $profile_key): array
{
    raidlands_airstrike_animations_require_schema();
    $profile_key = raidlands_airstrike_animations_clean_key($profile_key);
    $row = raidlands_db_fetch_one(
        'SELECT * FROM airstrike_animation_profiles WHERE profile_key = :profile_key LIMIT 1',
        ['profile_key' => $profile_key]
    );

    if ($row === null) {
        throw new OutOfBoundsException('Airstrike animation profile was not found.');
    }

    return raidlands_airstrike_animations_profile_row($row, true);
}

function raidlands_airstrike_animations_create(array $source): array
{
    raidlands_airstrike_animations_require_schema();
    $source = raidlands_airstrike_animations_assert_source($source);
    $profile_key = (string) $source['ProfileKey'];
    $display_name = trim((string) ($source['DisplayName'] ?? $profile_key));
    $vehicle = trim((string) ($source['Vehicle'] ?? ''));
    $source_json = raidlands_airstrike_animations_source_json($source);
    $source_sha = hash('sha256', $source_json);
    $actor_id = raidlands_airstrike_animations_actor_id();

    try {
        raidlands_db_execute(
            'INSERT INTO airstrike_animation_profiles
                (profile_key, display_name, vehicle, draft_source_json, draft_source_sha256, draft_version, created_by, updated_by)
             VALUES
                (:profile_key, :display_name, :vehicle, :source_json, :source_sha, 1, :created_by, :updated_by)',
            [
                'profile_key' => $profile_key,
                'display_name' => mb_substr($display_name !== '' ? $display_name : $profile_key, 0, 160),
                'vehicle' => mb_substr($vehicle, 0, 40),
                'source_json' => $source_json,
                'source_sha' => $source_sha,
                'created_by' => $actor_id,
                'updated_by' => $actor_id,
            ]
        );
    } catch (PDOException $error) {
        if ((string) $error->getCode() === '23000') {
            throw new UnexpectedValueException('A profile with that key already exists.', 0, $error);
        }

        throw $error;
    }

    raidlands_admin_audit('airstrike_animation_create', 'airstrike_animation_profile', $profile_key, [
        'source_sha256' => $source_sha,
    ]);

    return raidlands_airstrike_animations_get($profile_key);
}

function raidlands_airstrike_animations_save(string $profile_key, array $source, int $base_version): array
{
    raidlands_airstrike_animations_require_schema();
    $profile_key = raidlands_airstrike_animations_clean_key($profile_key);
    $source = raidlands_airstrike_animations_assert_source($source, $profile_key);

    if ($base_version <= 0) {
        throw new InvalidArgumentException('baseVersion must be a positive integer.');
    }

    $source_json = raidlands_airstrike_animations_source_json($source);
    $source_sha = hash('sha256', $source_json);
    $display_name = trim((string) ($source['DisplayName'] ?? $profile_key));
    $vehicle = trim((string) ($source['Vehicle'] ?? ''));
    $updated = raidlands_db_execute(
        'UPDATE airstrike_animation_profiles
         SET display_name = :display_name,
             vehicle = :vehicle,
             draft_source_json = :source_json,
             draft_source_sha256 = :source_sha,
             draft_version = draft_version + 1,
             updated_by = :updated_by,
             updated_at = NOW()
         WHERE profile_key = :profile_key AND draft_version = :base_version',
        [
            'display_name' => mb_substr($display_name !== '' ? $display_name : $profile_key, 0, 160),
            'vehicle' => mb_substr($vehicle, 0, 40),
            'source_json' => $source_json,
            'source_sha' => $source_sha,
            'updated_by' => raidlands_airstrike_animations_actor_id(),
            'profile_key' => $profile_key,
            'base_version' => $base_version,
        ]
    );

    if ($updated !== 1) {
        $current = raidlands_db_fetch_one(
            'SELECT draft_version FROM airstrike_animation_profiles WHERE profile_key = :profile_key LIMIT 1',
            ['profile_key' => $profile_key]
        );

        if ($current === null) {
            throw new OutOfBoundsException('Airstrike animation profile was not found.');
        }

        throw new UnexpectedValueException(
            'Draft version conflict. The server is at version ' . (int) $current['draft_version'] . '; reload before saving.'
        );
    }

    raidlands_admin_audit('airstrike_animation_save', 'airstrike_animation_profile', $profile_key, [
        'base_version' => $base_version,
        'source_sha256' => $source_sha,
    ]);

    return raidlands_airstrike_animations_get($profile_key);
}

function raidlands_airstrike_animations_duplicate(string $profile_key, string $new_key, ?string $display_name = null): array
{
    $profile = raidlands_airstrike_animations_get($profile_key);
    $source = (array) ($profile['source'] ?? []);
    $new_key = raidlands_airstrike_animations_clean_key($new_key);
    $source['ProfileKey'] = $new_key;
    $source['DisplayName'] = trim((string) ($display_name ?? '')) !== ''
        ? trim((string) $display_name)
        : trim((string) (($source['DisplayName'] ?? $profile_key) . ' Copy'));

    $created = raidlands_airstrike_animations_create($source);
    raidlands_admin_audit('airstrike_animation_duplicate', 'airstrike_animation_profile', $new_key, [
        'source_profile_key' => $profile_key,
    ]);
    return $created;
}

function raidlands_airstrike_animations_archive(string $profile_key, bool $archived = true): array
{
    raidlands_airstrike_animations_require_schema();
    $profile_key = raidlands_airstrike_animations_clean_key($profile_key);
    $updated = raidlands_db_execute(
        'UPDATE airstrike_animation_profiles
         SET archived_at = ' . ($archived ? 'NOW()' : 'NULL') . ', updated_by = :updated_by, updated_at = NOW()
         WHERE profile_key = :profile_key',
        [
            'updated_by' => raidlands_airstrike_animations_actor_id(),
            'profile_key' => $profile_key,
        ]
    );

    if ($updated !== 1) {
        throw new OutOfBoundsException('Airstrike animation profile was not found.');
    }

    raidlands_admin_audit(
        $archived ? 'airstrike_animation_archive' : 'airstrike_animation_unarchive',
        'airstrike_animation_profile',
        $profile_key
    );
    return raidlands_airstrike_animations_get($profile_key);
}

function raidlands_airstrike_animations_compile_preview(array $source): array
{
    $source = raidlands_airstrike_animations_assert_source($source);
    $runtime = raidlands_airstrike_animation_compile_profile(
        $source,
        raidlands_airstrike_animations_vehicle_metadata()
    );

    return [
        'sourceSha256' => raidlands_airstrike_animation_canonical_sha256($source),
        'runtimeSha256' => raidlands_airstrike_animation_canonical_sha256($runtime),
        'runtime' => $runtime,
    ];
}

function raidlands_airstrike_animations_publish(string $notes = ''): array
{
    raidlands_airstrike_animations_require_schema();
    $pdo = raidlands_db_required();
    $notes = mb_substr(trim($notes), 0, 1000);
    $actor_id = raidlands_airstrike_animations_actor_id();
    $pdo->beginTransaction();

    try {
        $statement = $pdo->query(
            'SELECT * FROM airstrike_animation_profiles WHERE archived_at IS NULL ORDER BY profile_key ASC FOR UPDATE'
        );
        $rows = $statement->fetchAll();

        if (!is_array($rows) || $rows === []) {
            throw new InvalidArgumentException('Create at least one active animation profile before publishing.');
        }

        $sources = [];
        foreach ($rows as $row) {
            $source = raidlands_airstrike_animations_decode_json((string) $row['draft_source_json'], 'Draft source');
            $source = raidlands_airstrike_animations_assert_source($source, (string) $row['profile_key']);
            $sources[(string) $row['profile_key']] = $source;
        }

        $insert = $pdo->prepare(
            'INSERT INTO airstrike_animation_bundles
                (schema_version, compiler_version, bundle_json, sha256, profile_count, publish_notes, published_by)
             VALUES (2, :compiler_version, :bundle_json, :sha256, :profile_count, :notes, :published_by)'
        );
        $insert->execute([
            'compiler_version' => RAIDLANDS_AIRSTRIKE_ANIMATION_COMPILER_VERSION,
            'bundle_json' => '{}',
            'sha256' => str_repeat('0', 64),
            'profile_count' => count($sources),
            'notes' => $notes,
            'published_by' => $actor_id,
        ]);
        $bundle_revision = (int) $pdo->lastInsertId();
        $compiled = raidlands_airstrike_animation_compile_bundle(
            $sources,
            $bundle_revision,
            false,
            raidlands_airstrike_animations_vehicle_metadata()
        );
        $canonical_json = (string) ($compiled['canonical_json'] ?? '');
        $sha256 = strtolower((string) ($compiled['sha256'] ?? ''));
        $bundle = (array) ($compiled['bundle'] ?? []);

        if ($canonical_json === '' || strlen($canonical_json) > RAIDLANDS_AIRSTRIKE_ANIMATION_MAX_BUNDLE_BYTES) {
            throw new RuntimeException('Compiled animation bundle is empty or exceeds the 20 MiB limit.');
        }

        if (!preg_match('/^[a-f0-9]{64}$/', $sha256) || !hash_equals(hash('sha256', $canonical_json), $sha256)) {
            throw new RuntimeException('Compiled animation bundle hash verification failed.');
        }

        $update_bundle = $pdo->prepare(
            'UPDATE airstrike_animation_bundles
             SET compiler_version = :compiler_version,
                 bundle_json = :bundle_json,
                 sha256 = :sha256,
                 profile_count = :profile_count
             WHERE revision = :revision'
        );
        $update_bundle->execute([
            'compiler_version' => (string) ($bundle['CompilerVersion'] ?? RAIDLANDS_AIRSTRIKE_ANIMATION_COMPILER_VERSION),
            'bundle_json' => $canonical_json,
            'sha256' => $sha256,
            'profile_count' => count($sources),
            'revision' => $bundle_revision,
        ]);

        $runtime_profiles = (array) ($bundle['Profiles'] ?? []);
        $next_revision_statement = $pdo->prepare(
            'SELECT COALESCE(MAX(profile_revision), 0) + 1
             FROM airstrike_animation_profile_revisions
             WHERE profile_id = :profile_id'
        );
        $insert_revision = $pdo->prepare(
            'INSERT INTO airstrike_animation_profile_revisions
                (profile_id, profile_revision, bundle_revision, source_json, source_sha256,
                 runtime_json, runtime_sha256, publish_notes, created_by)
             VALUES
                (:profile_id, :profile_revision, :bundle_revision, :source_json, :source_sha256,
                 :runtime_json, :runtime_sha256, :publish_notes, :created_by)'
        );
        $update_profile = $pdo->prepare(
            'UPDATE airstrike_animation_profiles
             SET last_published_profile_revision = :profile_revision, updated_at = NOW()
             WHERE id = :profile_id'
        );
        $published_profiles = [];

        foreach ($rows as $row) {
            $profile_id = (int) $row['id'];
            $profile_key = (string) $row['profile_key'];
            $runtime = (array) ($runtime_profiles[$profile_key] ?? []);

            if ($runtime === []) {
                throw new RuntimeException('Compiler did not emit runtime profile ' . $profile_key . '.');
            }

            $next_revision_statement->execute(['profile_id' => $profile_id]);
            $profile_revision = (int) $next_revision_statement->fetchColumn();
            $source_json = raidlands_airstrike_animations_source_json($sources[$profile_key]);
            $runtime_json = raidlands_airstrike_animation_canonical_json($runtime);
            $insert_revision->execute([
                'profile_id' => $profile_id,
                'profile_revision' => $profile_revision,
                'bundle_revision' => $bundle_revision,
                'source_json' => $source_json,
                'source_sha256' => hash('sha256', $source_json),
                'runtime_json' => $runtime_json,
                'runtime_sha256' => hash('sha256', $runtime_json),
                'publish_notes' => $notes,
                'created_by' => $actor_id,
            ]);
            $update_profile->execute([
                'profile_revision' => $profile_revision,
                'profile_id' => $profile_id,
            ]);
            $published_profiles[$profile_key] = $profile_revision;
        }

        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $error;
    }

    raidlands_admin_audit('airstrike_animation_publish', 'airstrike_animation_bundle', (string) $bundle_revision, [
        'sha256' => $sha256,
        'profile_count' => count($published_profiles),
        'profiles' => $published_profiles,
    ]);

    return [
        'revision' => $bundle_revision,
        'sha256' => $sha256,
        'profileCount' => count($published_profiles),
        'profileRevisions' => $published_profiles,
        'published' => true,
        'rcon' => [
            'attempted' => false,
            'ok' => false,
            'message' => 'Automatic RCON notification is not enabled in this milestone. Use the manual sync command after the bridge is installed.',
        ],
    ];
}

function raidlands_airstrike_animations_revisions(string $profile_key): array
{
    raidlands_airstrike_animations_require_schema();
    $profile_key = raidlands_airstrike_animations_clean_key($profile_key);
    $profile = raidlands_db_fetch_one(
        'SELECT id FROM airstrike_animation_profiles WHERE profile_key = :profile_key LIMIT 1',
        ['profile_key' => $profile_key]
    );

    if ($profile === null) {
        throw new OutOfBoundsException('Airstrike animation profile was not found.');
    }

    return raidlands_db_fetch_all(
        'SELECT r.profile_revision, r.bundle_revision, r.source_sha256, r.runtime_sha256,
                r.publish_notes, r.created_at, b.sha256 AS bundle_sha256, b.published_at
         FROM airstrike_animation_profile_revisions r
         INNER JOIN airstrike_animation_bundles b ON b.revision = r.bundle_revision
         WHERE r.profile_id = :profile_id
         ORDER BY r.profile_revision DESC',
        ['profile_id' => (int) $profile['id']]
    );
}

function raidlands_airstrike_animations_restore_revision(
    string $profile_key,
    int $profile_revision,
    int $base_version
): array {
    raidlands_airstrike_animations_require_schema();
    $profile_key = raidlands_airstrike_animations_clean_key($profile_key);

    if ($profile_revision <= 0) {
        throw new InvalidArgumentException('profileRevision must be a positive integer.');
    }

    $row = raidlands_db_fetch_one(
        'SELECT r.source_json
         FROM airstrike_animation_profile_revisions r
         INNER JOIN airstrike_animation_profiles p ON p.id = r.profile_id
         WHERE p.profile_key = :profile_key AND r.profile_revision = :profile_revision
         LIMIT 1',
        [
            'profile_key' => $profile_key,
            'profile_revision' => $profile_revision,
        ]
    );

    if ($row === null) {
        throw new OutOfBoundsException('Published profile revision was not found.');
    }

    $source = raidlands_airstrike_animations_decode_json((string) $row['source_json'], 'Published source');
    $restored = raidlands_airstrike_animations_save($profile_key, $source, $base_version);
    raidlands_admin_audit('airstrike_animation_restore_revision', 'airstrike_animation_profile', $profile_key, [
        'restored_profile_revision' => $profile_revision,
        'new_draft_version' => $restored['draftVersion'] ?? null,
    ]);
    return $restored;
}

function raidlands_airstrike_animations_bundle_for_server(int $since = 0, ?int $revision = null): array
{
    raidlands_airstrike_animations_require_schema();

    if ($since < 0) {
        throw new InvalidArgumentException('since must be zero or a positive integer.');
    }

    $row = raidlands_airstrike_animations_latest_bundle_row($revision);

    if ($row === null) {
        return [
            'ok' => true,
            'has_update' => false,
            'current_revision' => 0,
            'bootstrap_required' => true,
        ];
    }

    $current_revision = (int) $row['revision'];
    $sha256 = strtolower((string) $row['sha256']);

    if ($revision === null && $since >= $current_revision) {
        return [
            'ok' => true,
            'has_update' => false,
            'current_revision' => $current_revision,
            'sha256' => $sha256,
        ];
    }

    $canonical_json = (string) $row['bundle_json'];

    if (!hash_equals($sha256, hash('sha256', $canonical_json))) {
        throw new RuntimeException('Stored animation bundle failed its canonical SHA-256 check.');
    }

    $bundle = raidlands_airstrike_animations_decode_json($canonical_json, 'Published bundle');
    return [
        'ok' => true,
        'has_update' => true,
        'current_revision' => $current_revision,
        'published_at' => $row['published_at'],
        'schema_version' => (int) $row['schema_version'],
        'compiler_version' => (string) $row['compiler_version'],
        'sha256' => $sha256,
        'bundle_json_base64' => base64_encode($canonical_json),
        'bundle' => $bundle,
    ];
}

function raidlands_airstrike_animations_record_sync_result(array $payload): array
{
    raidlands_airstrike_animations_require_schema();
    $allowed_statuses = [
        'checked_no_update',
        'installed',
        'install_failed',
        'reload_failed_rolled_back',
        'blocked_local_changes',
        'snapshot_uploaded',
        'rollback_installed',
    ];
    $server_id = trim((string) ($payload['server_id'] ?? raidlands_airstrike_animations_server_id()));

    if (!hash_equals(raidlands_airstrike_animations_server_id(), $server_id)) {
        throw new InvalidArgumentException('Sync result server_id does not match the authenticated bridge server.');
    }

    $status = strtolower(trim((string) ($payload['status'] ?? '')));

    if (!in_array($status, $allowed_statuses, true)) {
        throw new InvalidArgumentException('Sync result status is not supported.');
    }

    $revision = max(0, (int) ($payload['revision'] ?? 0));
    $installed_sha = strtolower(trim((string) ($payload['installed_sha256'] ?? '')));
    $local_sha = strtolower(trim((string) ($payload['local_sha256'] ?? '')));

    foreach (['installed_sha256' => $installed_sha, 'local_sha256' => $local_sha] as $label => $hash) {
        if ($hash !== '' && !preg_match('/^[a-f0-9]{64}$/', $hash)) {
            throw new InvalidArgumentException($label . ' must be an SHA-256 hex value.');
        }
    }

    raidlands_db_execute(
        'INSERT INTO airstrike_animation_server_syncs
            (server_id, installed_revision, installed_sha256, local_sha256, local_dirty, status, message,
             plugin_version, runtime_plugin_version, editor_plugin_version, last_seen_at, installed_at)
         VALUES
            (:server_id, :installed_revision, :installed_sha256, :local_sha256, :local_dirty, :status, :message,
             :plugin_version, :runtime_plugin_version, :editor_plugin_version, NOW(),
             CASE WHEN :installed_status = 1 THEN NOW() ELSE NULL END)
         ON DUPLICATE KEY UPDATE
            installed_revision = VALUES(installed_revision),
            installed_sha256 = VALUES(installed_sha256),
            local_sha256 = VALUES(local_sha256),
            local_dirty = VALUES(local_dirty),
            status = VALUES(status),
            message = VALUES(message),
            plugin_version = VALUES(plugin_version),
            runtime_plugin_version = VALUES(runtime_plugin_version),
            editor_plugin_version = VALUES(editor_plugin_version),
            last_seen_at = NOW(),
            installed_at = CASE WHEN :installed_status_update = 1 THEN NOW() ELSE installed_at END',
        [
            'server_id' => $server_id,
            'installed_revision' => $revision > 0 ? $revision : null,
            'installed_sha256' => $installed_sha,
            'local_sha256' => $local_sha,
            'local_dirty' => !empty($payload['local_dirty']) ? 1 : 0,
            'status' => $status,
            'message' => mb_substr(trim((string) ($payload['message'] ?? '')), 0, 1000),
            'plugin_version' => mb_substr(trim((string) ($payload['plugin_version'] ?? '')), 0, 40),
            'runtime_plugin_version' => mb_substr(trim((string) ($payload['runtime_plugin_version'] ?? '')), 0, 40),
            'editor_plugin_version' => mb_substr(trim((string) ($payload['editor_plugin_version'] ?? '')), 0, 40),
            'installed_status' => in_array($status, ['installed', 'rollback_installed'], true) ? 1 : 0,
            'installed_status_update' => in_array($status, ['installed', 'rollback_installed'], true) ? 1 : 0,
        ]
    );

    return ['ok' => true, 'server' => raidlands_airstrike_animations_server_status($server_id)];
}

function raidlands_airstrike_animations_runtime_profile_to_source(string $profile_key, array $runtime): array
{
    $profile_key = raidlands_airstrike_animations_clean_key($profile_key);
    $waypoints = [];

    foreach (array_values((array) ($runtime['Waypoints'] ?? [])) as $index => $waypoint) {
        if (!is_array($waypoint)) {
            continue;
        }

        $waypoints[] = array_merge($waypoint, [
            'Id' => 'wp_' . str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT),
        ]);
    }

    $payload_events = [];
    foreach (array_values((array) ($runtime['PayloadEvents'] ?? [])) as $index => $event) {
        if (!is_array($event)) {
            continue;
        }

        $payload_events[] = array_merge($event, [
            'Id' => 'release_' . str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT),
        ]);
    }

    $release_mode = strtolower(trim((string) ($runtime['PayloadReleaseMode'] ?? 'manual')));
    $release_template = is_array($runtime['ReleaseTemplate'] ?? null)
        ? (array) $runtime['ReleaseTemplate']
        : [];
    $first_payload = (float) ($runtime['FirstPayloadDelaySeconds'] ?? 0.0);

    if ($release_mode === 'generated') {
        // Rust treats template Time <= 0 as unset and falls back to FirstPayloadDelaySeconds.
        $release_template_time = isset($release_template['Time']) && is_numeric($release_template['Time'])
            ? (float) $release_template['Time']
            : 0.0;
        $release_start_time = $release_template_time > 0.0 ? $release_template_time : $first_payload;
        $release_template['Time'] = $release_start_time;

        $release_source = [
            'Mode' => 'repeated',
            'StartTime' => $release_start_time,
            'IntervalSeconds' => (float) ($runtime['PayloadReleaseIntervalSeconds'] ?? 0.5),
            'UnitsPerRelease' => max(1, (int) ($release_template['Count'] ?? 1)),
            'MaximumUnits' => max(1, (int) ($runtime['MaxPayloadCount'] ?? 1)),
            'Template' => $release_template,
            'HardpointSequence' => [],
        ];
    } else {
        $release_source = [
            'Mode' => 'manual',
            'Events' => $payload_events,
            'LegacyDynamic' => $payload_events === [],
        ];
    }

    return [
        'EditorSourceSchemaVersion' => 1,
        'ProfileKey' => $profile_key,
        'DisplayName' => ucwords(str_replace(['_', '-', '.'], ' ', $profile_key)),
        'Vehicle' => (string) ($runtime['Vehicle'] ?? 'f15'),
        'DurationSeconds' => (float) ($runtime['DurationSeconds'] ?? 8.0),
        'FirstPayloadDelaySeconds' => $first_payload,
        'RotationSmoothTimeSeconds' => (float) ($runtime['RotationSmoothTimeSeconds'] ?? 0.12),
        'StopAtWaypoints' => !empty($runtime['StopAtWaypoints']),
        'MinimumTerrainClearance' => (float) ($runtime['MinimumTerrainClearance'] ?? 55.0),
        'PositionInterpolation' => 'time_hermite',
        'RotationMode' => 'follow_path_plus_offset',
        'Waypoints' => $waypoints,
        'ReleaseSource' => $release_source,
        'EditorMetadata' => [
            'Notes' => 'Imported from the Rust server VisualProfiles file.',
            'Tags' => ['server-import'],
            'VehiclePreviewOverrides' => [],
        ],
    ];
}

function raidlands_airstrike_animations_snapshot_reasons(): array
{
    return ['bootstrap', 'local_save', 'manual_upload', 'sync_conflict', 'pre_overwrite_backup'];
}

function raidlands_airstrike_animations_ingest_snapshot(array $payload): array
{
    raidlands_airstrike_animations_require_schema();
    $server_id = trim((string) ($payload['server_id'] ?? raidlands_airstrike_animations_server_id()));

    if (!hash_equals(raidlands_airstrike_animations_server_id(), $server_id)) {
        throw new InvalidArgumentException('Snapshot server_id does not match the authenticated bridge server.');
    }

    $reason = strtolower(trim((string) ($payload['reason'] ?? '')));
    if (!in_array($reason, raidlands_airstrike_animations_snapshot_reasons(), true)) {
        throw new InvalidArgumentException('Snapshot reason is not supported.');
    }

    $visual_profiles = $payload['visual_profiles'] ?? null;
    if (!is_array($visual_profiles) || !is_array($visual_profiles['Profiles'] ?? null)) {
        throw new InvalidArgumentException('visual_profiles must contain a Profiles object.');
    }

    $snapshot_json = raidlands_airstrike_animation_canonical_json($visual_profiles);
    if (strlen($snapshot_json) > RAIDLANDS_AIRSTRIKE_ANIMATION_MAX_BUNDLE_BYTES) {
        throw new InvalidArgumentException('Snapshot exceeds the 20 MiB limit.');
    }

    $calculated_sha = hash('sha256', $snapshot_json);
    $declared_sha = strtolower(trim((string) ($payload['sha256'] ?? '')));
    if ($declared_sha !== '' && !hash_equals($calculated_sha, $declared_sha)) {
        throw new InvalidArgumentException('Snapshot SHA-256 does not match its canonical visual_profiles bytes.');
    }

    $based_on_revision = max(0, (int) ($payload['based_on_revision'] ?? 0));
    $changed_keys = [];
    foreach ((array) ($payload['changed_profile_keys'] ?? []) as $key) {
        $changed_keys[] = raidlands_airstrike_animations_clean_key((string) $key);
    }
    $changed_keys = array_values(array_unique($changed_keys));
    sort($changed_keys, SORT_STRING);
    $current_bundle = raidlands_airstrike_animations_latest_bundle_row();
    $current_revision = $current_bundle === null ? 0 : (int) $current_bundle['revision'];
    $existing_count = (int) (raidlands_db_fetch_one(
        'SELECT COUNT(*) AS row_count FROM airstrike_animation_profiles'
    )['row_count'] ?? 0);
    $bootstrap_import = $reason === 'bootstrap' && $existing_count === 0;
    $status = $bootstrap_import ? 'imported' : 'pending';
    $conflict_message = null;

    if (!$bootstrap_import && $based_on_revision !== $current_revision) {
        $status = 'conflict';
        $conflict_message = 'Server snapshot is based on revision ' . $based_on_revision
            . ', while the website currently publishes revision ' . $current_revision . '.';
    }

    $pdo = raidlands_db_required();
    $pdo->beginTransaction();

    try {
        $insert = $pdo->prepare(
            'INSERT INTO airstrike_animation_server_snapshots
                (server_id, based_on_revision, reason, snapshot_json, sha256, changed_profile_keys_json,
                 status, conflict_message, imported_at)
             VALUES
                (:server_id, :based_on_revision, :reason, :snapshot_json, :sha256, :changed_keys,
                 :status, :conflict_message, CASE WHEN :is_imported = 1 THEN NOW() ELSE NULL END)'
        );
        $insert->execute([
            'server_id' => $server_id,
            'based_on_revision' => $based_on_revision > 0 ? $based_on_revision : null,
            'reason' => $reason,
            'snapshot_json' => $snapshot_json,
            'sha256' => $calculated_sha,
            'changed_keys' => $changed_keys === [] ? null : json_encode($changed_keys, JSON_UNESCAPED_SLASHES),
            'status' => $status,
            'conflict_message' => $conflict_message,
            'is_imported' => $bootstrap_import ? 1 : 0,
        ]);
        $snapshot_id = (int) $pdo->lastInsertId();
        $imported_keys = [];

        if ($bootstrap_import) {
            foreach ((array) $visual_profiles['Profiles'] as $profile_key => $runtime) {
                if (!is_array($runtime)) {
                    continue;
                }

                $source = raidlands_airstrike_animations_runtime_profile_to_source((string) $profile_key, $runtime);
                $created = raidlands_airstrike_animations_create($source);
                $imported_keys[] = (string) $created['profileKey'];
            }

            if ($imported_keys === []) {
                throw new InvalidArgumentException('Bootstrap snapshot did not contain any importable profiles.');
            }
        }

        $pdo->commit();
    } catch (PDOException $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        if ((string) $error->getCode() === '23000') {
            $existing = raidlands_db_fetch_one(
                'SELECT id, status FROM airstrike_animation_server_snapshots
                 WHERE server_id = :server_id AND sha256 = :sha256 LIMIT 1',
                ['server_id' => $server_id, 'sha256' => $calculated_sha]
            );
            return [
                'ok' => true,
                'duplicate' => true,
                'snapshotId' => isset($existing['id']) ? (int) $existing['id'] : null,
                'status' => $existing['status'] ?? $status,
                'importedProfileKeys' => [],
            ];
        }

        throw $error;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $error;
    }

    raidlands_admin_audit('airstrike_animation_snapshot_received', 'airstrike_animation_snapshot', (string) $snapshot_id, [
        'server_id' => $server_id,
        'reason' => $reason,
        'sha256' => $calculated_sha,
        'status' => $status,
        'imported_profile_keys' => $imported_keys,
    ]);
    return [
        'ok' => true,
        'duplicate' => false,
        'snapshotId' => $snapshot_id,
        'status' => $status,
        'importedProfileKeys' => $imported_keys,
    ];
}

function raidlands_airstrike_animations_snapshots(string $status = ''): array
{
    raidlands_airstrike_animations_require_schema();
    $status = strtolower(trim($status));
    $params = ['server_id' => raidlands_airstrike_animations_server_id()];
    $where = 'server_id = :server_id';

    if ($status !== '') {
        $where .= ' AND status = :status';
        $params['status'] = $status;
    }

    return raidlands_db_fetch_all(
        'SELECT id, server_id, based_on_revision, reason, sha256, changed_profile_keys_json,
                status, conflict_message, received_at, imported_at, imported_by
         FROM airstrike_animation_server_snapshots
         WHERE ' . $where . '
         ORDER BY received_at DESC, id DESC
         LIMIT 100',
        $params
    );
}

function raidlands_airstrike_animations_import_snapshot(int $snapshot_id, array $selected_keys = []): array
{
    raidlands_airstrike_animations_require_schema();

    if ($snapshot_id <= 0) {
        throw new InvalidArgumentException('snapshotId must be a positive integer.');
    }

    $snapshot = raidlands_db_fetch_one(
        'SELECT * FROM airstrike_animation_server_snapshots WHERE id = :id LIMIT 1',
        ['id' => $snapshot_id]
    );
    if ($snapshot === null) {
        throw new OutOfBoundsException('Server snapshot was not found.');
    }

    $payload = raidlands_airstrike_animations_decode_json((string) $snapshot['snapshot_json'], 'Server snapshot');
    $profiles = (array) ($payload['Profiles'] ?? []);
    $selected = [];
    foreach ($selected_keys as $key) {
        $selected[raidlands_airstrike_animations_clean_key((string) $key)] = true;
    }

    $pdo = raidlands_db_required();
    $pdo->beginTransaction();
    $imported = [];

    try {
        foreach ($profiles as $profile_key => $runtime) {
            $profile_key = raidlands_airstrike_animations_clean_key((string) $profile_key);
            if ($selected !== [] && !isset($selected[$profile_key])) {
                continue;
            }
            if (!is_array($runtime)) {
                continue;
            }

            $source = raidlands_airstrike_animations_runtime_profile_to_source($profile_key, $runtime);
            $existing = raidlands_db_fetch_one(
                'SELECT draft_version FROM airstrike_animation_profiles WHERE profile_key = :profile_key LIMIT 1',
                ['profile_key' => $profile_key]
            );
            if ($existing === null) {
                raidlands_airstrike_animations_create($source);
            } else {
                raidlands_airstrike_animations_save($profile_key, $source, (int) $existing['draft_version']);
                raidlands_db_execute(
                    'UPDATE airstrike_animation_profiles SET archived_at = NULL WHERE profile_key = :profile_key',
                    ['profile_key' => $profile_key]
                );
            }
            $imported[] = $profile_key;
        }

        if ($imported === []) {
            throw new InvalidArgumentException('No matching profiles were available to import from this snapshot.');
        }

        $statement = $pdo->prepare(
            "UPDATE airstrike_animation_server_snapshots
             SET status = 'imported', conflict_message = NULL, imported_at = NOW(), imported_by = :imported_by
             WHERE id = :id"
        );
        $statement->execute([
            'imported_by' => raidlands_airstrike_animations_actor_id(),
            'id' => $snapshot_id,
        ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    raidlands_admin_audit('airstrike_animation_snapshot_import', 'airstrike_animation_snapshot', (string) $snapshot_id, [
        'profile_keys' => $imported,
    ]);
    return ['snapshotId' => $snapshot_id, 'importedProfileKeys' => $imported];
}

function raidlands_airstrike_animations_discard_snapshot(int $snapshot_id): void
{
    raidlands_airstrike_animations_require_schema();
    $updated = raidlands_db_execute(
        "UPDATE airstrike_animation_server_snapshots
         SET status = 'discarded', conflict_message = NULL
         WHERE id = :id AND status <> 'imported'",
        ['id' => $snapshot_id]
    );
    if ($updated !== 1) {
        throw new UnexpectedValueException('Snapshot was not found or has already been imported.');
    }
    raidlands_admin_audit('airstrike_animation_snapshot_discard', 'airstrike_animation_snapshot', (string) $snapshot_id);
}

function raidlands_airstrike_animations_admin_state(): array
{
    if (!raidlands_airstrike_animations_schema_ready()) {
        return [
            'ready' => false,
            'message' => 'Run database/migrations/047_airstrike_animation_editor.sql to enable the web animation editor.',
            'profiles' => [],
            'publishedBundle' => null,
            'server' => null,
            'snapshots' => [],
        ];
    }

    $state = raidlands_airstrike_animations_list(true);
    $state['snapshots'] = raidlands_airstrike_animations_snapshots();
    return $state;
}
