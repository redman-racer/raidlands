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

- `includes/config.php` owns site config, navigation, page metadata, and reusable content data.
- `includes/header.php` renders the shared document head and site header.
- `includes/footer.php` renders the shared footer and toast region.
- `pages/` contains one content template per page.
- Each route has a small `index.php` that loads bootstrap, header, content, and footer.
- `assets/js/site.js` handles behavior only: mobile nav, copy buttons, auth placeholders, reveal effects, metrics, and wipe countdowns.
- `includes/database.php` and `includes/store.php` provide the MySQL, Stripe, SteamID64, entitlement, and WebsiteVipBridge API layer.
- `database/` contains the VIP store migration and seed data.
- `server-plugins/WebsiteVipBridge.cs` is the uMod/Oxide bridge plugin for syncing website entitlements to Rust permission groups.

## Important Config

Launch values live in `includes/config.php`:

- `admin_panel.username`
- `admin_panel.password`
- `admin_panel.passwordHash`
- `connectCommand`
- `steamConnectUrl`
- `discordInviteUrl`
- `playersOnline`
- `maxPlayers`
- `serverStats.battleMetricsServerId`
- `serverStats.cacheSeconds`
- `wipe.time`
- `wipe.timezone`
- `auth.steamUrl` (legacy placeholder; Steam linking uses native Steam OpenID)
- `auth.discordUrl`

Live server status is served by `api/server-status.php`. It reads the public BattleMetrics server record, caches it briefly, and falls back to the config values above if BattleMetrics is unreachable.

Steam account linking starts with native Steam OpenID and falls back to manual SteamID64 entry if Steam cannot return a verified response. Discord linking buttons remain ready for a future OAuth URL.

## VIP Store

The store uses MySQL as the source of truth and Stripe Checkout for payments.

1. Run `composer install`.
2. Create a MySQL database.
3. Run `database/migrations/001_vip_store.sql`.
4. Run `database/seeds/001_store_products.sql`.
5. Copy `data/raidlands-secrets.example.php` to `data/raidlands-secrets.php`.
6. Fill in MySQL, Stripe, and bridge secret values.
7. Configure product Stripe Price IDs in `/admin/?section=store`.

Public store flow:

- `/link/` links a SteamID64 into the browser session.
- `/store/` lists monthly VIP tiers and one-time perks.
- `/store/checkout.php` creates Stripe Checkout Sessions.
- `/api/stripe-webhook.php` records paid orders, subscriptions, refunds, and entitlement changes.
- `/profile/` shows active groups and entitlement history for the linked SteamID64.

Game-server flow:

- Install Rust Kits by k1lly0u.
- Put `server-plugins/WebsiteVipBridge.cs` into the uMod/Oxide plugins folder.
- Configure the plugin with the same `ApiBaseUrl`, `ServerId`, and `SharedSecret` as the website.
- The plugin calls `/api/server/vip-player.php` and `/api/server/vip-changes.php`, then adds/removes managed Oxide groups.

## Admin Panel

Open:

```text
http://localhost/raidlands/admin/
```

The admin login is configured in `includes/config.php` under `$admin_panel`. Admin-edited site content is saved to `data/site-content.json`; Apache is configured to deny direct web access to that folder.

Admin sections now include Store, Grants, and Sync for product setup, manual entitlements, and WebsiteVipBridge visibility.
