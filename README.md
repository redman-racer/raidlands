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
- `database/` contains the store, stats, clan management/API-key, admin auth migrations, and seed data.
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
- `RAIDLANDS_STRIPE_PUBLISHABLE_KEY`, `RAIDLANDS_STRIPE_SECRET_KEY`, `RAIDLANDS_STRIPE_WEBHOOK_SECRET`, `RAIDLANDS_STRIPE_BILLING_PORTAL_CONFIGURATION_ID`
- `RAIDLANDS_BRIDGE_SERVER_ID`, `RAIDLANDS_BRIDGE_SHARED_SECRET`
- `RAIDLANDS_STEAM_API_KEY`
- `OPENAI_RAIDLANDS_API_KEY`, `OPENAI_RAIDLANDS_MODEL`, `OPENAI_RAIDLANDS_AI_ENABLED`, `OPENAI_RAIDLANDS_TIMEOUT_SECONDS`
- `RAIDLANDS_CONNECT_COMMAND`, `RAIDLANDS_STEAM_CONNECT_URL`, `RAIDLANDS_DISCORD_INVITE_URL`
- `RAIDLANDS_SERVER_STATS_PROVIDER`, `RAIDLANDS_SERVER_STATUS_CACHE_SECONDS`, `RAIDLANDS_SERVER_STATUS_STALE_SECONDS`
- `RAIDLANDS_SERVER_STATUS_SAMPLE_RETENTION_DAYS`, `RAIDLANDS_SERVER_STATUS_HOURLY_RETENTION_MONTHS`
- `RAIDLANDS_WIPE_TIME`, `RAIDLANDS_WIPE_TIMEZONE`
- `RAIDLANDS_AUTH_STEAM_URL`, `RAIDLANDS_AUTH_DISCORD_URL`

Live server status is served by `api/server-status.php`. WebsiteVipBridge posts signed heartbeats to `/api/server/status-heartbeat.php`; the public endpoint uses the latest heartbeat, marks delayed data stale, and falls back to config values before the first heartbeat arrives. Recent player-safe samples and long-term hourly/daily rollups are exposed through `/api/server-status-history.php` for the `/server/` activity graph.

Steam account linking uses native Steam OpenID only. Manual SteamID64 entry is intentionally disabled so users can only link accounts Steam has verified they own. Discord linking buttons remain ready for a future OAuth URL.

Steam avatars and profile links are only fetched when `RAIDLANDS_STEAM_API_KEY` is set in `.env`. Without that key, account and leaderboard pages render without Steam profile metadata.

AI feedback triage is optional. When `OPENAI_RAIDLANDS_AI_ENABLED=true` and `OPENAI_RAIDLANDS_API_KEY` is set to a real key, new support feedback and feature suggestions are sent through OpenAI with content-only payloads. Multi-idea submissions can be split into standalone child suggestions, then each child is checked again for grouping or public-card creation. Missing keys, placeholder keys, or API failures leave items unchecked so Admin > Feedback or Admin > Features can retry them. Admin > TODO always shows a live ranked work queue, and can save an AI-generated daily brief when the OpenAI key and TODO snapshot table are ready.

The admin panel uses Steam sign-in once `database/migrations/007_admin_auth.sql` is installed. Add approved Steam IDs to `admin_users` and attach roles through `admin_user_roles`; the migration includes a commented owner bootstrap query.

## Store

The store uses MySQL as the source of truth, Stripe Checkout for cash purchases, and Stripe Billing Portal for recurring cash subscription changes.

1. Run `composer install`.
2. Create a MySQL database.
3. Run `database/migrations/001_vip_store.sql`.
4. Run `database/migrations/002_player_stats.sql`.
5. Run `database/migrations/003_support_feedback.sql`.
6. Run `database/migrations/004_clan_management.sql`.
7. Run `database/migrations/005_clan_api_keys.sql`.
8. Run `database/migrations/006_game_kits.sql`.
9. Run `database/migrations/007_admin_auth.sql`.
10. Run `database/migrations/008_oxide_permissions.sql`.
11. Run `database/migrations/009_server_status.sql`.
12. Run `database/migrations/010_server_status_samples.sql`.
13. Run `database/migrations/011_server_status_rollups.sql`.
14. Run `database/migrations/012_rp_shop.sql`.
15. Run `database/migrations/013_pvp_kit_permission_cleanup.sql`.
16. Run `database/migrations/014_kit_group_delete_tombstones.sql`.
17. Run `database/migrations/015_feature_planning.sql`.
18. Run `database/migrations/016_player_stats_wipe_rp_baseline.sql`.
19. Run `database/migrations/017_feature_voting_status.sql`.
20. Run `database/migrations/018_store_bundle_offer_matrix.sql`.
21. Run `database/migrations/019_raidlands_vip_kits_permissions_seed.sql`.
22. Run `database/migrations/020_store_product_fulfillment_groups.sql`.
23. Run `database/migrations/021_group_owned_kit_permissions.sql`.
24. Run `database/migrations/022_bot_stats.sql`.
25. Run `database/migrations/023_player_group_assignments.sql`.
26. Run `database/migrations/024_server_map_images.sql`.
27. Run `database/migrations/025_store_lifetime_kit_unlock_groups.sql`.
28. Run `database/migrations/026_store_stripe_catalog_sync.sql`.
29. Run `database/migrations/027_ai_feedback_triage.sql`.
30. Run `database/migrations/028_ai_feedback_split_suggestions.sql`.
31. Run `database/migrations/029_admin_todo_snapshots.sql`.
32. Run any later numbered migrations in order through `database/migrations/042_public_lobby_chat.sql`.
33. Run `database/seeds/001_store_products.sql`.
34. Copy `.env.example` to `.env`.
35. Fill in MySQL, Stripe, Steam API, OpenAI AI triage key if enabled, bridge secret, clan API limit values, and chat settings.
36. Add at least one owner SteamID64 to `admin_users` and `admin_user_roles`.
37. Configure product RP costs and cash offer amounts in `/admin/?section=store`; active cash offers automatically sync Stripe Products and Prices on Store save when the Stripe secret key is set.

Public store flow:

- `/link/` links a SteamID64 into the browser session.
- `/store/` lists main kit bundles, individual shop kits, and standalone perks.
- `/store/checkout.php` creates Stripe Checkout Sessions.
- Admin > Store automatically creates, reuses, replaces, or archives Raidlands-managed Stripe Products and Prices from configured cash offer rows once `RAIDLANDS_STRIPE_SECRET_KEY` is set.
- `/profile/billing-portal.php` opens Stripe Billing Portal for recurring cash subscriptions.
- `/api/stripe-webhook.php` records paid orders, subscriptions, refunds, and entitlement changes.
- Store products apply one or more managed groups for purchases and manual grants; Kits and Groups control the permissions those groups receive.
- `/profile/` shows active groups and entitlement history for the linked SteamID64.
- `/clans/` resolves the linked SteamID64 to synced clan data, queues allowed clan actions, and creates/revokes public clan API keys.
- `/api-docs/` documents the public clan API for external websites and Discord bots.

Game-server flow:

- Install Rust Kits by k1lly0u.
- Put `server-plugins/WebsiteVipBridge.cs` into the uMod/Oxide plugins folder.
- Put `server-plugins/WebsiteClanBridge.cs` into the uMod/Oxide plugins folder when clan website/API management is enabled.
- Configure the plugin with the same `ApiBaseUrl`, `ServerId`, and `SharedSecret` as the website. Use `server-plugins/WebsiteVipBridge.config.example.json` as the shape of the generated plugin config.
- Leave `WipeKey` blank for automatic leaderboard seasons. WebsiteVipBridge will derive a stable key from `ServerId` and the Rust save creation time after each wipe. Set `WipeKey` only for a deliberate manual override; a static value like `raidlands-main` will keep every wipe in one leaderboard season.
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
