# Raidlands VIP Store Setup

## Local database

1. Create a MySQL database and user.
2. Run `database/migrations/001_vip_store.sql`.
3. Run `database/migrations/002_player_stats.sql`.
4. Run `database/migrations/004_clan_management.sql`.
5. Run `database/migrations/005_clan_api_keys.sql`.
6. Run `database/migrations/007_admin_auth.sql`.
7. Run `database/seeds/001_store_products.sql`.
8. Copy the root `.env.example` file to `.env`.
9. Fill in `RAIDLANDS_DB_DSN`, `RAIDLANDS_DB_USER`, and `RAIDLANDS_DB_PASSWORD`.

The root `.env` file is ignored by Git and protected from direct web access by the root `.htaccess`.

## Admin access

- After `007_admin_auth.sql` is installed, `/admin/` uses Steam sign-in instead of the setup username and password.
- Add approved Steam IDs to `admin_users`, then attach roles through `admin_user_roles`.
- Use the commented owner bootstrap query at the bottom of `database/migrations/007_admin_auth.sql` for the first admin account.

## Stripe

- Create one recurring monthly Stripe Price for each VIP tier.
- Create one one-time Stripe Price for each individual perk or kit unlock.
- Paste those `price_...` IDs into Admin > Store.
- Set the webhook URL to `/api/stripe-webhook.php`.
- Configure `RAIDLANDS_STRIPE_PUBLISHABLE_KEY`, `RAIDLANDS_STRIPE_SECRET_KEY`, and `RAIDLANDS_STRIPE_WEBHOOK_SECRET` in `.env`.

## Rust server

1. Install Rust Kits by k1lly0u.
2. Configure kit contents, cooldowns, max uses, hidden kit behavior, and kit permission strings in Rust Kits.
3. Put `server-plugins/WebsiteVipBridge.cs` in the uMod/Oxide plugins folder.
4. Put `server-plugins/WebsiteClanBridge.cs` in the uMod/Oxide plugins folder if website or public API clan management should be live.
5. Set `ApiBaseUrl`, `ServerId`, and `SharedSecret` in the generated plugin configs. `ServerId` must match `RAIDLANDS_BRIDGE_SERVER_ID`, and `SharedSecret` must match `RAIDLANDS_BRIDGE_SHARED_SECRET`.
6. Match Website product groups to Rust Kits permissions through Oxide groups:
   - `vip_bronze`
   - `vip_gold`
   - `vip_elite`
   - `perk_personal_mini`
   - `perk_skinbox`
   - `perk_raid_kit`
   - `perk_queue_priority`
   - `perk_supporter_badge`

The website owns expiration and revocation. WebsiteVipBridge makes the game server match the current website state.

## Clan API

- `/clans/` lets Steam-linked players create and revoke public clan API keys.
- `/api-docs/` documents `GET /api/clans/me.php` and `POST /api/clans/action.php`.
- API keys are stored as hashes and rate-limited by `RAIDLANDS_CLAN_API_RATE_LIMIT_PER_MINUTE`.
- WebsiteClanBridge requires k1lly0u Clans with the Raidlands `RaidlandsClanAction` and `RaidlandsClanSnapshot` hooks.
