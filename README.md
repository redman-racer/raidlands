# Raidlands Website

PHP-rendered website for Raidlands 1000x, built from the website plan and media kit.

## Local Preview

With WAMP running, open:

```text
http://localhost/raidlands/
```

Or use PHP's built-in server:

```powershell
Set-Location C:\wamp64\www\raidlands
php -S 127.0.0.1:4177
```

Open:

```text
http://127.0.0.1:4177/
```

## Structure

- `includes/config.php` loads the root `.env` plus optional `.env.local` overrides, owns navigation, page metadata, and reusable content data.
- `includes/header.php` renders the shared document head and site header.
- `includes/footer.php` renders the shared footer and toast region.
- `pages/` contains one content template per page.
- Each route has a small `index.php` that loads bootstrap, header, content, and footer.
- `assets/js/site.js` handles behavior only: mobile nav, copy buttons, auth placeholders, reveal effects, metrics, and wipe countdowns.
- `includes/database.php` and `includes/store.php` provide the MySQL, Stripe, SteamID64, entitlement, and WebsiteVipBridge API layer.
- `database/` contains the VIP store, stats, clan management/API-key, admin auth migrations, and seed data.
- `server-plugins/WebsiteVipBridge.cs` is the uMod/Oxide bridge plugin for syncing website entitlements to Rust permission groups and player stats to leaderboards.
- `server-plugins/WebsiteClanBridge.cs` is the uMod/Oxide bridge plugin for syncing clan snapshots and processing public clan API actions.

## Important Config

Launch and credential values live in the root `.env` file. Copy `.env.example`
to `.env` for a new environment, then fill in the local or hosted values.
For local-only WAMP overrides, create `.env.local`; values in that file win
over `.env` and stay ignored by Git.

- `RAIDLANDS_ADMIN_USERNAME`
- `RAIDLANDS_ADMIN_PASSWORD` or `RAIDLANDS_ADMIN_PASSWORD_HASH` for the setup fallback before admin auth tables are installed
- `RAIDLANDS_DB_DSN`, `RAIDLANDS_DB_USER`, `RAIDLANDS_DB_PASSWORD`
- `RAIDLANDS_STRIPE_PUBLISHABLE_KEY`, `RAIDLANDS_STRIPE_SECRET_KEY`, `RAIDLANDS_STRIPE_WEBHOOK_SECRET`
- `RAIDLANDS_BRIDGE_SERVER_ID`, `RAIDLANDS_BRIDGE_SHARED_SECRET`
- `RAIDLANDS_STEAM_API_KEY`
- `RAIDLANDS_CONNECT_COMMAND`, `RAIDLANDS_STEAM_CONNECT_URL`, `RAIDLANDS_DISCORD_INVITE_URL`
- `RAIDLANDS_SERVER_STATS_PROVIDER`, `RAIDLANDS_SERVER_STATUS_CACHE_SECONDS`, `RAIDLANDS_SERVER_STATUS_STALE_SECONDS`
- `RAIDLANDS_SERVER_STATUS_SAMPLE_RETENTION_DAYS`, `RAIDLANDS_SERVER_STATUS_HOURLY_RETENTION_MONTHS`
- `RAIDLANDS_WIPE_TIME`, `RAIDLANDS_WIPE_TIMEZONE`
- `RAIDLANDS_AUTH_STEAM_URL`, `RAIDLANDS_AUTH_DISCORD_URL`

Live server status is served by `api/server-status.php`. WebsiteVipBridge posts signed heartbeats to `/api/server/status-heartbeat.php`; the public endpoint uses the latest heartbeat, marks delayed data stale, and falls back to config values before the first heartbeat arrives. Recent player-safe samples and long-term hourly/daily rollups are exposed through `/api/server-status-history.php` for the `/server/` activity graph.

Steam account linking uses native Steam OpenID only. Manual SteamID64 entry is intentionally disabled so users can only link accounts Steam has verified they own. Discord linking buttons remain ready for a future OAuth URL.

Steam avatars and profile links are only fetched when `RAIDLANDS_STEAM_API_KEY` is set in `.env`. Without that key, account and leaderboard pages render without Steam profile metadata.

The admin panel uses Steam sign-in once `database/migrations/007_admin_auth.sql` is installed. Add approved Steam IDs to `admin_users` and attach roles through `admin_user_roles`; the migration includes a commented owner bootstrap query.

## VIP Store

The store uses MySQL as the source of truth and Stripe Checkout for payments.

1. Run `composer install`.
2. Create a MySQL database.
3. Run `database/migrations/001_vip_store.sql`.
4. Run `database/migrations/002_player_stats.sql`.
5. Run `database/migrations/004_clan_management.sql`.
6. Run `database/migrations/005_clan_api_keys.sql`.
7. Run `database/migrations/007_admin_auth.sql`.
8. Run `database/migrations/009_server_status.sql`.
9. Run `database/migrations/010_server_status_samples.sql`.
10. Run `database/migrations/011_server_status_rollups.sql`.
11. Run `database/seeds/001_store_products.sql`.
12. Copy `.env.example` to `.env`.
13. Fill in MySQL, Stripe, Steam API, bridge secret, and clan API limit values.
14. Add at least one owner SteamID64 to `admin_users` and `admin_user_roles`.
15. Configure product Stripe Price IDs in `/admin/?section=store`.

Public store flow:

- `/link/` links a SteamID64 into the browser session.
- `/store/` lists monthly VIP tiers and one-time perks.
- `/store/checkout.php` creates Stripe Checkout Sessions.
- `/api/stripe-webhook.php` records paid orders, subscriptions, refunds, and entitlement changes.
- `/profile/` shows active groups and entitlement history for the linked SteamID64.
- `/clans/` resolves the linked SteamID64 to synced clan data, queues allowed clan actions, and creates/revokes public clan API keys.
- `/api-docs/` documents the public clan API for external websites and Discord bots.

Game-server flow:

- Install Rust Kits by k1lly0u.
- Put `server-plugins/WebsiteVipBridge.cs` into the uMod/Oxide plugins folder.
- Put `server-plugins/WebsiteClanBridge.cs` into the uMod/Oxide plugins folder when clan website/API management is enabled.
- Configure the plugin with the same `ApiBaseUrl`, `ServerId`, and `SharedSecret` as the website. Use `server-plugins/WebsiteVipBridge.config.example.json` as the shape of the generated plugin config.
- Configure `WipeKey` after each wipe if you want a clean current-wipe leaderboard boundary; leave it blank only if one continuous current season is acceptable.
- The plugin calls `/api/server/vip-player.php` and `/api/server/vip-changes.php`, then adds/removes managed Oxide groups.
- The plugin posts `/api/server/status-heartbeat.php` for the public status panel and `/server/` page.
- The plugin posts `/api/server/stats-snapshot.php` with KDRScoreboard kills/deaths, PlaytimeTracker playtime, and ServerRewards RP for `/leaderboard/` and `/profile/`.
- WebsiteClanBridge posts `/api/server/clan-snapshot.php`, polls `/api/server/clan-actions.php`, and reports `/api/server/clan-action-result.php`.

## Admin Panel

Open:

```text
http://localhost/raidlands/admin/
```

The admin login is configured in the root `.env`. Admin-edited site content is saved to `data/site-content.json`; Apache is configured to deny direct web access to that folder.

Admin sections now include Store, Grants, and Sync for product setup, manual entitlements, WebsiteVipBridge visibility, and stats ingest health.
