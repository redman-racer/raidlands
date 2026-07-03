<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$sourceUrl = 'https://www.corrosionhour.com/rust-item-list/';
$iconSourceUrl = 'https://rusthelp.com/tools/admin/item-list';
$fallbackIconPattern = 'https://rustlabs.com/img/items180/%s.png';
$catalogPath = $root . '/assets/data/rust-items.json';
$iconDirectory = $root . '/assets/media/rust-items';
$downloadIcons = !in_array('--no-icons', $argv, true);
$forceIcons = in_array('--force-icons', $argv, true);
$limit = null;

foreach ($argv as $argument) {
    if (preg_match('/^--limit=(\d+)$/', $argument, $match)) {
        $limit = max(1, (int) $match[1]);
    }
}

function import_rust_items_fetch(string $url): string
{
    $context = stream_context_create([
        'http' => [
            'header' => "User-Agent: RaidlandsRustItemImporter/1.0\r\n",
            'timeout' => 30,
        ],
    ]);
    $body = @file_get_contents($url, false, $context);

    if ($body === false || $body === '') {
        throw new RuntimeException('Could not fetch ' . $url);
    }

    return $body;
}

function import_rust_items_cell_text(DOMXPath $xpath, DOMNode $row, string $class): string
{
    $node = $xpath->query('.//td[contains(concat(" ", normalize-space(@class), " "), " ' . $class . ' ")]', $row)->item(0);

    if (!$node instanceof DOMNode) {
        return '';
    }

    return trim(preg_replace('/\s+/', ' ', html_entity_decode($node->textContent, ENT_QUOTES | ENT_HTML5, 'UTF-8')) ?? '');
}

function import_rust_items_icon_name(string $shortname, string $iconUrl): string
{
    $name = strtolower($shortname);
    $name = preg_replace('/[^a-z0-9._-]+/', '-', $name) ?? $name;
    $name = trim($name, '-');
    $extension = strtolower(pathinfo(parse_url($iconUrl, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION));

    if (!in_array($extension, ['png', 'jpg', 'jpeg', 'webp'], true)) {
        $extension = 'png';
    }

    return ($name !== '' ? $name : 'item') . '.' . $extension;
}

function import_rust_items_download_icon(string $url, string $path, bool $force): bool
{
    global $http_response_header;

    if (!$force && is_file($path) && filesize($path) > 0) {
        return true;
    }

    $context = stream_context_create([
        'http' => [
            'header' => "User-Agent: RaidlandsRustItemImporter/1.0\r\n",
            'ignore_errors' => true,
            'timeout' => 20,
        ],
    ]);
    $body = @file_get_contents($url, false, $context);

    if ($body === false || $body === '') {
        return false;
    }

    $headers = $http_response_header ?? [];
    $status = implode("\n", $headers);

    $extension = strtolower(pathinfo(parse_url($url, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION));
    $looksLikeImage = in_array($extension, ['png', 'jpg', 'jpeg', 'webp'], true);

    if (!preg_match('/\b200\b/', $status) || (!preg_match('/content-type:\s*image\//i', $status) && !$looksLikeImage)) {
        return false;
    }

    return file_put_contents($path, $body) !== false;
}

function import_rust_items_icon_map(string $html): array
{
    $map = [];

    if (!preg_match_all('/<tr data-idx="\d+"[^>]*>(.*?)<\/tr>/s', $html, $rows)) {
        return $map;
    }

    foreach ($rows[1] as $rowHtml) {
        if (!preg_match_all('/<td class="px-4 py-4 align-middle">(.*?)<\/td>/s', $rowHtml, $cells)) {
            continue;
        }

        $shortnameText = html_entity_decode(strip_tags($cells[1][1] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $shortname = strtolower(trim(preg_replace('/Copied$/', '', trim($shortnameText)) ?? ''));
        $url = '';

        if (preg_match('/url=([^&"\']+)/', $cells[1][0] ?? '', $match)) {
            $url = rawurldecode(html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        }

        if ($shortname !== '' && filter_var($url, FILTER_VALIDATE_URL)) {
            $map[$shortname] = $url;
        }
    }

    return $map;
}

if (!is_dir(dirname($catalogPath)) && !mkdir(dirname($catalogPath), 0775, true) && !is_dir(dirname($catalogPath))) {
    throw new RuntimeException('Could not create assets/data.');
}

if (!is_dir($iconDirectory) && !mkdir($iconDirectory, 0775, true) && !is_dir($iconDirectory)) {
    throw new RuntimeException('Could not create assets/media/rust-items.');
}

$html = import_rust_items_fetch($sourceUrl);
$iconHtml = import_rust_items_fetch($iconSourceUrl);
$iconMap = import_rust_items_icon_map($iconHtml);
$dom = new DOMDocument();
libxml_use_internal_errors(true);
$dom->loadHTML($html);
libxml_clear_errors();

$xpath = new DOMXPath($dom);
$rows = $xpath->query('//table[contains(concat(" ", normalize-space(@class), " "), " ch-item-list-table ")]//tbody//tr');
$items = [];
$seen = [];
$downloaded = 0;
$missingIcons = 0;

foreach ($rows as $row) {
    $displayName = import_rust_items_cell_text($xpath, $row, 'ch-tbl-name');
    $shortname = strtolower(import_rust_items_cell_text($xpath, $row, 'ch-tbl-short-name'));
    $itemId = import_rust_items_cell_text($xpath, $row, 'ch-tbl-id');
    $description = import_rust_items_cell_text($xpath, $row, 'ch-tbl-desc');
    $stackSize = import_rust_items_cell_text($xpath, $row, 'ch-tbl-stack-size');

    if ($shortname === '' || isset($seen[$shortname])) {
        continue;
    }

    $safeShortname = (bool) preg_match('/^[a-z0-9._-]+$/', $shortname);
    $iconSource = $iconMap[$shortname] ?? sprintf($fallbackIconPattern, rawurlencode($shortname));
    $iconPath = '';

    if ($safeShortname) {
        $iconName = import_rust_items_icon_name($shortname, $iconSource);
        $targetPath = $iconDirectory . '/' . $iconName;

        if ($downloadIcons && import_rust_items_download_icon($iconSource, $targetPath, $forceIcons)) {
            $downloaded += 1;
            $iconPath = 'media/rust-items/' . $iconName;
        } elseif (is_file($targetPath) && filesize($targetPath) > 0) {
            $iconPath = 'media/rust-items/' . $iconName;
        } else {
            $missingIcons += 1;
        }
    }

    $seen[$shortname] = true;
    $items[] = [
        'display_name' => $displayName !== '' ? $displayName : $shortname,
        'shortname' => $shortname,
        'item_id' => is_numeric($itemId) ? (int) $itemId : null,
        'description' => $description,
        'stack_size' => is_numeric($stackSize) ? (int) $stackSize : null,
        'safe_shortname' => $safeShortname,
        'icon' => $iconPath,
        'icon_source' => $iconSource,
    ];

    if ($limit !== null && count($items) >= $limit) {
        break;
    }
}

usort($items, static function (array $left, array $right): int {
    return strcasecmp((string) $left['display_name'], (string) $right['display_name'])
        ?: strcasecmp((string) $left['shortname'], (string) $right['shortname']);
});

$payload = [
    'source' => [
        'metadata' => $sourceUrl,
        'icons' => $iconSourceUrl,
        'fallback_icons' => $fallbackIconPattern,
        'imported_at' => gmdate('c'),
        'item_count' => count($items),
        'safe_item_count' => count(array_filter($items, static fn (array $item): bool => !empty($item['safe_shortname']))),
        'downloaded_icons' => $downloaded,
        'missing_icons' => $missingIcons,
    ],
    'items' => $items,
];

$json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

if ($json === false) {
    throw new RuntimeException('Could not encode Rust item catalog.');
}

file_put_contents($catalogPath, $json . PHP_EOL);

echo 'Imported ' . count($items) . ' Rust items to ' . str_replace($root . '/', '', $catalogPath) . PHP_EOL;
echo 'Downloaded or reused ' . $downloaded . ' icon files; missing ' . $missingIcons . '.' . PHP_EOL;
