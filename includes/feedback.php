<?php

require_once __DIR__ . '/store.php';

function raidlands_feedback_type_options(): array
{
    return [
        'bug' => 'Bug report',
        'suggestion' => 'Suggestion',
        'feature_request' => 'Feature request',
    ];
}

function raidlands_feedback_status_options(): array
{
    return [
        'open' => 'Open',
        'reviewing' => 'Reviewing',
        'planned' => 'Planned',
        'resolved' => 'Resolved',
        'closed' => 'Closed',
    ];
}

function raidlands_feedback_flash(?string $type = null, ?string $message = null, array $old = []): ?array
{
    raidlands_store_boot();

    if ($type !== null && $message !== null) {
        $_SESSION['raidlands_feedback_flash'] = [
            'type' => $type,
            'message' => $message,
            'old' => $old,
        ];

        return null;
    }

    $flash = $_SESSION['raidlands_feedback_flash'] ?? null;
    unset($_SESSION['raidlands_feedback_flash']);

    return is_array($flash) ? $flash : null;
}

function raidlands_feedback_handle_public_request(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' || (string) ($_POST['action'] ?? '') !== 'submit_feedback') {
        return;
    }

    $old = [
        'type' => (string) ($_POST['type'] ?? 'bug'),
        'summary' => (string) ($_POST['summary'] ?? ''),
        'details' => (string) ($_POST['details'] ?? ''),
        'contact_name' => (string) ($_POST['contact_name'] ?? ''),
        'contact_email' => (string) ($_POST['contact_email'] ?? ''),
        'steam_id64' => (string) ($_POST['steam_id64'] ?? ''),
    ];

    try {
        if (!raidlands_store_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
            throw new RuntimeException('Your form session expired. Try sending it again.');
        }

        if (trim((string) ($_POST['website'] ?? '')) !== '') {
            throw new RuntimeException('The submission could not be accepted.');
        }

        raidlands_feedback_create_from_post($_POST);
        raidlands_feedback_flash('success', 'Thanks. Your report has been saved for staff review.');
    } catch (Throwable $error) {
        raidlands_feedback_flash('error', $error->getMessage(), $old);
    }

    $target = strtok((string) ($_SERVER['REQUEST_URI'] ?? './'), '?') ?: './';
    header('Location: ' . $target . '#feedback-form', true, 303);
    exit;
}

function raidlands_feedback_create_from_post(array $post): string
{
    if (!raidlands_feedback_is_ready()) {
        throw new RuntimeException('The feedback inbox is being set up. Please use Discord for now.');
    }

    $types = raidlands_feedback_type_options();
    $type = (string) ($post['type'] ?? 'bug');
    $summary = raidlands_feedback_clean_text($post['summary'] ?? '', 160);
    $details = raidlands_feedback_clean_multiline($post['details'] ?? '', 3000);
    $contact_name = raidlands_feedback_clean_text($post['contact_name'] ?? '', 90);
    $contact_email = strtolower(raidlands_feedback_clean_text($post['contact_email'] ?? '', 180));
    $page_url = raidlands_feedback_clean_text($post['page_url'] ?? '', 320);
    $linked_player = raidlands_linked_player();
    $linked_display_name = '';
    $player_id = null;
    $steam_id64 = '';

    if (!isset($types[$type])) {
        throw new RuntimeException('Choose whether this is a bug, suggestion, or feature request.');
    }

    if ($summary === '' || strlen($summary) < 4) {
        throw new RuntimeException('Add a short summary so staff can triage it.');
    }

    if ($details === '' || strlen($details) < 12) {
        throw new RuntimeException('Add a few details about what happened or what you want changed.');
    }

    if ($contact_email !== '' && filter_var($contact_email, FILTER_VALIDATE_EMAIL) === false) {
        throw new RuntimeException('Use a valid email address or leave that field blank.');
    }

    if ($linked_player !== null) {
        $steam_id64 = preg_replace('/\D+/', '', (string) ($linked_player['steam_id64'] ?? '')) ?? '';
        $linked_display_name = raidlands_feedback_clean_text(
            (string) (($linked_player['display_name'] ?? '') ?: ($linked_player['steam_display_name'] ?? '')),
            90
        );
        $player_id = raidlands_feedback_player_id_from_linked_player($linked_player, $steam_id64);
    } else {
        $steam_id64 = preg_replace('/\D+/', '', (string) ($post['steam_id64'] ?? '')) ?? '';
    }

    if ($steam_id64 !== '' && !raidlands_store_validate_steam_id64($steam_id64)) {
        throw new RuntimeException('Use a valid 17-digit SteamID64 or leave that field blank.');
    }

    if ($page_url === '' || !preg_match('#^https?://#i', $page_url)) {
        $page_url = raidlands_feedback_current_url();
    }

    $public_id = gmdate('YmdHis') . '-' . bin2hex(random_bytes(4));
    $pdo = raidlands_db_required();
    $statement = $pdo->prepare(
        "INSERT INTO support_feedback (
            public_id,
            player_id,
            steam_id64,
            type,
            status,
            summary,
            details,
            contact_name,
            contact_email,
            linked_display_name,
            page_url,
            browser,
            admin_note
        ) VALUES (
            :public_id,
            :player_id,
            :steam_id64,
            :type,
            'open',
            :summary,
            :details,
            :contact_name,
            :contact_email,
            :linked_display_name,
            :page_url,
            :browser,
            ''
        )"
    );
    $statement->execute([
        'public_id' => $public_id,
        'player_id' => $player_id,
        'steam_id64' => $steam_id64,
        'type' => $type,
        'summary' => $summary,
        'details' => $details,
        'contact_name' => $contact_name,
        'contact_email' => $contact_email,
        'linked_display_name' => $linked_display_name,
        'page_url' => $page_url,
        'browser' => raidlands_feedback_clean_text($_SERVER['HTTP_USER_AGENT'] ?? '', 240),
    ]);

    return $public_id;
}

function raidlands_feedback_is_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        raidlands_feedback_last_error('Feedback database credentials are not configured.');
        return false;
    }

    try {
        raidlands_db_required()->query('SELECT 1 FROM support_feedback LIMIT 1');
        raidlands_feedback_last_error('');
        return true;
    } catch (Throwable $error) {
        raidlands_feedback_last_error($error->getMessage());
        return false;
    }
}

function raidlands_feedback_readiness_message(bool $admin = false): string
{
    if (!raidlands_db_is_configured()) {
        return $admin
            ? 'Database credentials are not configured. Add them, then run database/migrations/001_vip_store.sql and database/migrations/003_support_feedback.sql.'
            : 'The feedback inbox is being set up. Please use Discord for now.';
    }

    if ($admin) {
        $last_error = raidlands_feedback_last_error();

        if ($last_error !== '' && !str_contains($last_error, 'support_feedback') && !str_contains($last_error, '42S02')) {
            return 'Feedback database check failed: ' . $last_error;
        }

        return 'Feedback database table is not ready. Run database/migrations/003_support_feedback.sql after the player/store migration.';
    }

    return 'The feedback inbox is being set up. Please use Discord for now.';
}

function raidlands_feedback_last_error(?string $message = null): string
{
    static $last_error = '';

    if ($message !== null) {
        $last_error = $message;
    }

    return $last_error;
}

function raidlands_feedback_submissions(int $limit = 100): array
{
    if (!raidlands_feedback_is_ready()) {
        return [];
    }

    return raidlands_db_fetch_all(
        "SELECT
            sf.id,
            sf.public_id,
            sf.player_id,
            sf.steam_id64,
            sf.type,
            sf.status,
            sf.summary,
            sf.details,
            sf.contact_name,
            sf.contact_email,
            sf.linked_display_name,
            sf.page_url,
            sf.browser,
            sf.admin_note,
            sf.submitted_at,
            sf.updated_at,
            p.display_name AS player_display_name
         FROM support_feedback sf
         LEFT JOIN players p ON p.id = sf.player_id
         ORDER BY sf.submitted_at DESC, sf.id DESC
         LIMIT " . max(1, min(250, $limit))
    );
}

function raidlands_feedback_status_counts(array $submissions): array
{
    $counts = array_fill_keys(array_keys(raidlands_feedback_status_options()), 0);

    foreach ($submissions as $submission) {
        $status = (string) ($submission['status'] ?? 'open');
        $counts[$status] = ($counts[$status] ?? 0) + 1;
    }

    return $counts;
}

function raidlands_feedback_current_url(): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    $scheme = $https ? 'https' : 'http';
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
    $uri = strtok((string) ($_SERVER['REQUEST_URI'] ?? '/support/'), '?') ?: '/support/';

    return $scheme . '://' . $host . $uri;
}

function raidlands_feedback_admin_save_rows($rows): int
{
    if (!raidlands_feedback_is_ready()) {
        throw new RuntimeException(raidlands_feedback_readiness_message(true));
    }

    $rows = is_array($rows) ? $rows : [];
    $statuses = raidlands_feedback_status_options();
    $updated = 0;
    $pdo = raidlands_db_required();
    $statement = $pdo->prepare(
        "UPDATE support_feedback
         SET status = :status,
             admin_note = :admin_note
         WHERE id = :id
           AND (status <> :status_check OR COALESCE(admin_note, '') <> :admin_note_check)"
    );

    foreach ($rows as $id => $row) {
        if (!is_array($row)) {
            continue;
        }

        $status = (string) ($row['status'] ?? 'open');

        if (!isset($statuses[$status])) {
            continue;
        }

        $note = raidlands_feedback_clean_multiline($row['admin_note'] ?? '', 1600);
        $statement->execute([
            'id' => (int) $id,
            'status' => $status,
            'status_check' => $status,
            'admin_note' => $note,
            'admin_note_check' => $note,
        ]);
        $updated += $statement->rowCount();
    }

    return $updated;
}

function raidlands_feedback_player_id_from_linked_player(array $linked_player, string $steam_id64): ?int
{
    $player_id = (int) ($linked_player['id'] ?? 0);

    if ($player_id > 0) {
        return $player_id;
    }

    if ($steam_id64 === '') {
        return null;
    }

    try {
        $row = raidlands_db_fetch_one(
            'SELECT id FROM players WHERE steam_id64 = :steam_id64',
            ['steam_id64' => $steam_id64]
        );

        return $row === null ? null : (int) $row['id'];
    } catch (Throwable $error) {
        return null;
    }
}

function raidlands_feedback_clean_text($value, int $max_length = 500): string
{
    $text = trim(str_replace("\0", '', (string) $value));
    $text = preg_replace('/[ \t\r\n]+/', ' ', $text) ?? $text;
    $text = strip_tags($text);

    return raidlands_feedback_limit($text, $max_length);
}

function raidlands_feedback_clean_multiline($value, int $max_length = 2000): string
{
    $text = str_replace("\0", '', (string) $value);
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    $text = strip_tags($text);
    $text = preg_replace('/[ \t]+/', ' ', $text) ?? $text;
    $text = preg_replace("/\n{3,}/", "\n\n", $text) ?? $text;

    return raidlands_feedback_limit(trim($text), $max_length);
}

function raidlands_feedback_limit(string $text, int $max_length): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $max_length);
    }

    return substr($text, 0, $max_length);
}

function raidlands_feedback_type_label(string $type): string
{
    $options = raidlands_feedback_type_options();

    return $options[$type] ?? 'Feedback';
}

function raidlands_feedback_status_label(string $status): string
{
    $options = raidlands_feedback_status_options();

    return $options[$status] ?? 'Open';
}
