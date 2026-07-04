# Raidlands GoDaddy Deployment Guide

This site is a PHP-rendered multi-page website with shared includes, static CSS/JS,
media assets, a MySQL-backed store, Stripe Checkout, and a uMod/Oxide bridge
API for Rust access groups.

## Hosting Requirement

Deploy to hosting that runs PHP for `index.php` files, supports Composer
dependencies or uploaded `vendor/`, and provides MySQL. Static-only hosting will
not render the pages or run the store.

## What Gets Deployed

Deploy the site files from the repository root:

- `.htaccess`
- `.env.example`
- `index.php`
- `robots.txt`
- `site.webmanifest`
- `composer.json`
- `composer.lock`
- `includes/`
- `pages/`
- `assets/`
- `admin/`
- `api/`
- `data/.htaccess`
- `database/`
- `docs/`
- `server-plugins/`
- `vendor/` if Composer will not be run on the host
- `bans/`
- `clans/`
- `discord/`
- `events/`
- `features/`
- `leaderboard/`
- `link/`
- `play/`
- `privacy/`
- `profile/`
- `rules/`
- `store/`
- `support/`
- `terms/`
- `vote/`

Do not deploy local development folders such as `.git/`, `.agents/`, or `.codex/`.
Do not deploy real secrets through Git. Create the root `.env` file directly on
the host or upload it through a private channel.

## Pre-Deployment Checklist

1. Preview the site locally.

   With WAMP running, open:

   ```text
   http://localhost/raidlands/
   ```

   Or use PHP's built-in server:

   ```powershell
   Set-Location C:\wamp64\www\raidlands
   php -S 127.0.0.1:4177
   ```

   Open `http://127.0.0.1:4177/`.

2. Confirm the live values in `.env`.

   Check:

   - `RAIDLANDS_CONNECT_COMMAND`
   - `RAIDLANDS_STEAM_CONNECT_URL`
   - `RAIDLANDS_DISCORD_INVITE_URL`
   - `RAIDLANDS_MAX_PLAYERS`
   - `RAIDLANDS_WIPE_TIME`
   - `RAIDLANDS_WIPE_TIMEZONE`
   - `RAIDLANDS_AUTH_STEAM_URL` (legacy placeholder; Steam linking uses native Steam OpenID)
   - `RAIDLANDS_AUTH_DISCORD_URL`
   - `RAIDLANDS_DB_DSN`
   - `RAIDLANDS_STRIPE_SECRET_KEY`
   - `RAIDLANDS_STRIPE_BILLING_PORTAL_CONFIGURATION_ID` (optional)
   - `RAIDLANDS_BRIDGE_SHARED_SECRET`
   - `RAIDLANDS_CLAN_API_RATE_LIMIT_PER_MINUTE`
   - `RAIDLANDS_SERVER_STATUS_SAMPLE_RETENTION_DAYS`
   - `RAIDLANDS_SERVER_STATUS_HOURLY_RETENTION_MONTHS`

3. Install PHP dependencies.

   If Composer is available on the host:

   ```bash
   composer install --no-dev --optimize-autoloader
   ```

   If Composer is not available, run `composer install` locally and include
   `vendor/` in the deployment upload.

4. Run database setup.

   Import:

   - `database/migrations/001_vip_store.sql`
   - `database/migrations/002_player_stats.sql`
   - `database/migrations/004_clan_management.sql`
   - `database/migrations/005_clan_api_keys.sql`
   - `database/migrations/006_game_kits.sql`
   - `database/migrations/007_admin_auth.sql`
   - `database/migrations/008_oxide_permissions.sql`
   - `database/migrations/009_server_status.sql`
   - `database/migrations/010_server_status_samples.sql`
   - `database/migrations/011_server_status_rollups.sql`
   - `database/migrations/012_rp_shop.sql`
   - `database/migrations/013_pvp_kit_permission_cleanup.sql`
   - `database/migrations/014_kit_group_delete_tombstones.sql`
   - `database/migrations/015_feature_planning.sql`
   - `database/migrations/016_player_stats_wipe_rp_baseline.sql`
   - `database/migrations/017_feature_voting_status.sql`
   - `database/migrations/018_store_bundle_offer_matrix.sql`
   - `database/migrations/019_raidlands_vip_kits_permissions_seed.sql`
   - `database/migrations/020_store_product_fulfillment_groups.sql`
   - `database/seeds/001_store_products.sql`

   Then configure RP costs, cash amounts, and Stripe Price IDs in `/admin/?section=store`.

5. Click through the local site.

   Verify the homepage, navigation links, mobile menu, images, favicon, manifest,
   Steam link, Discord link, store, profile, copy-to-clipboard behavior, and
   direct page loads.

6. Confirm `.htaccess` is included.

   The current `.htaccess` disables directory browsing, prefers `index.php` as the
   directory index, and registers the web manifest MIME type.

## Create a Deployment Zip

From PowerShell:

```powershell
Set-Location C:\wamp64\www\raidlands
New-Item -ItemType Directory -Force dist | Out-Null

Compress-Archive -Force -DestinationPath .\dist\raidlands-godaddy.zip -Path `
  .\.htaccess, `
  .\.env.example, `
  .\browserconfig.xml, `
  .\favicon.ico, `
  .\index.php, `
  .\robots.txt, `
  .\site.webmanifest, `
  .\composer.json, `
  .\composer.lock, `
  .\admin, `
  .\api-docs, `
  .\api, `
  .\includes, `
  .\pages, `
  .\assets, `
  .\data\.htaccess, `
  .\database, `
  .\docs, `
  .\server-plugins, `
  .\vendor, `
  .\bans, `
  .\clans, `
  .\discord, `
  .\events, `
  .\features, `
  .\leaderboard, `
  .\link, `
  .\play, `
  .\privacy, `
  .\profile, `
  .\rules, `
  .\store, `
  .\support, `
  .\terms, `
  .\vote
```

After the zip is created, open it and confirm `.htaccess`, `index.php`,
`includes/`, `api/`, `admin/`, `pages/`, and `composer.lock` are present at the
top level of the zip. If `.htaccess` is missing, upload it separately in
GoDaddy File Manager after extracting the zip.

## Back Up the Existing GoDaddy Site

Before replacing files, take a backup of the current hosted site.

Recommended options:

- Use GoDaddy's cPanel backup tools or Daily Backups if available.
- Or use cPanel File Manager to compress and download the current document root.
- Or use FTP/SFTP to download the current live files.

Keep the backup somewhere outside the website root, with a timestamped name such
as `raidlands-live-backup-2026-06-24.zip`.

## Upload With GoDaddy cPanel File Manager

Use this path for a typical GoDaddy Web Hosting cPanel account:

1. Sign in to GoDaddy.
2. Open the product page.
3. Under Web Hosting, select **Manage** for the correct hosting account.
4. Open **File Manager** for the domain.
5. Go to the document root:
   - Primary domain: usually `/public_html`
   - Addon domain or subdomain: use the domain-specific root shown in cPanel
6. Upload `dist/raidlands-godaddy.zip`.
7. Extract the zip in the document root.
8. Confirm the extracted files are directly inside the document root.

The live root should look like this:

```text
public_html/
  .htaccess
  .env
  .env.example
  browserconfig.xml
  favicon.ico
  index.php
  robots.txt
  site.webmanifest
  composer.json
  composer.lock
  admin/
  api/
  includes/
  pages/
  assets/
  data/
    .htaccess
  database/
  docs/
  server-plugins/
  vendor/
  bans/
  clans/
  discord/
  events/
  features/
  leaderboard/
  link/
  play/
  privacy/
  profile/
  rules/
  store/
  support/
  terms/
  vote/
```

Avoid this nested layout:

```text
public_html/
  raidlands/
    index.php
    includes/
    assets/
```

If the files are nested under an extra folder, move that folder's contents up into
the document root.

## Upload With FTP or SFTP

FTP/SFTP is better if the File Manager upload times out or you prefer a local
sync workflow.

1. Create or confirm the FTP account in GoDaddy/cPanel.
2. Connect with an FTP client such as FileZilla.
3. Open the domain document root on the remote server.
4. Upload the same deployment files listed in this guide.
5. Make sure `.htaccess` is visible and uploaded.

For updates, overwrite changed files and remove remote files that no longer exist
in the repo.

## SSL and HTTPS

After upload, confirm the site works over HTTPS:

```text
https://your-domain.example/
```

If HTTPS is not active:

1. Confirm the domain DNS points to the GoDaddy hosting account.
2. Enable or install SSL in GoDaddy/cPanel.
3. Enable HTTPS redirect in cPanel once SSL is valid.

This repo does not currently force HTTPS in `.htaccess`, because GoDaddy/cPanel
can manage the redirect at the hosting layer. If you prefer to force it in the
repo later, test that change carefully on the live host.

## Post-Deployment Verification

Check these URLs on the live domain:

- `/`
- `/play/`
- `/server/`
- `/discord/`
- `/vote/`
- `/rules/`
- `/leaderboard/`
- `/store/`
- `/profile/`
- `/link/`
- `/api/server-status.php`
- `/api/server-status-history.php`
- `/api/server/status-heartbeat.php` rejects unsigned requests
- `/support/`
- `/privacy/`
- `/terms/`
- `/site.webmanifest`
- `/browserconfig.xml`
- `/favicon.ico`
- `/assets/css/styles.css`
- `/assets/css/loader.css`
- `/assets/js/site.js`
- `/assets/js/raidlands-loader.js`

After uploading CSS or JS changes, confirm the live cache-busted asset URLs match
the local files before judging browser behavior:

```powershell
Set-Location C:\wamp64\www\raidlands
$domain = [Uri]'https://raidlands.net/'
$page = (Invoke-WebRequest -UseBasicParsing -Uri $domain.AbsoluteUri).Content
$assets = @(
  'assets/css/styles.css',
  'assets/css/loader.css',
  'assets/js/site.js',
  'assets/js/raidlands-loader.js'
)

foreach ($asset in $assets) {
  $pattern = '(?:href|src)="([^"]*' + [regex]::Escape($asset) + '[^"]*)"'
  $match = [regex]::Match($page, $pattern)
  if (-not $match.Success) {
    throw "Missing live asset reference: $asset"
  }

  $liveUrl = [Uri]::new($domain, $match.Groups[1].Value).AbsoluteUri
  $tempFile = New-TemporaryFile
  Invoke-WebRequest -UseBasicParsing -Uri $liveUrl -OutFile $tempFile
  $localHash = (Get-FileHash $asset -Algorithm SHA256).Hash
  $liveHash = (Get-FileHash $tempFile -Algorithm SHA256).Hash
  Remove-Item $tempFile

  if ($localHash -ne $liveHash) {
    throw "Live asset does not match local file: $asset ($liveUrl)"
  }

  Write-Host "OK $asset -> $liveUrl"
}
```

Also verify:

- Images load without broken placeholders.
- The navigation menu works on desktop and mobile.
- The console connect command is correct.
- Discord, Steam, and store links go to the expected places.
- Store cards show active products after MySQL seed data is imported.
- `/profile/` shows the linked SteamID64 after using `/link/`.
- `/api/server/vip-player.php` rejects unsigned requests and accepts WebsiteVipBridge HMAC requests after the bridge secret is configured.
- The favicon appears in the browser tab.
- Direct page loads work, such as `https://your-domain.example/rules/`.
- Directory listing is blocked, such as `https://your-domain.example/assets/`.
- Static-only URLs such as `/index.html` are no longer expected to exist.

## Rollback

If something goes wrong:

1. Keep the broken deployment in place long enough to capture the exact issue.
2. Delete the newly uploaded files from the document root.
3. Restore the timestamped backup into the document root.
4. Clear browser cache or test in a private window.
5. Re-check the homepage and the most important subpages.

If GoDaddy Daily Backups are enabled, you can also restore from the hosting backup
interface, but be careful: account-level restores can overwrite files, databases,
mailboxes, or related hosting data depending on the restore option selected.

## GoDaddy Reference Links

- [Upload files using cPanel File Manager](https://www.godaddy.com/help/upload-files-using-my-web-hosting-cpanel-file-manager-3239)
- [Manage files in cPanel File Manager](https://www.godaddy.com/help/manage-files-in-my-web-hosting-cpanel-account-12426)
- [Move a cPanel website with FTP and FileZilla](https://www.godaddy.com/help/move-my-cpanel-website-with-ftp-and-filezilla-31870)
- [Redirect HTTP to HTTPS automatically](https://www.godaddy.com/help/redirect-http-to-https-automatically-8828)
- [Download a site backup using Daily Backups](https://www.godaddy.com/help/download-a-site-backup-using-daily-backups-41163)
