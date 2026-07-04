# Raidlands Store Setup

## Local database

1. Create a MySQL database and user.
2. Run `database/migrations/001_vip_store.sql`.
3. Run `database/migrations/002_player_stats.sql`.
4. Run `database/migrations/004_clan_management.sql`.
5. Run `database/migrations/005_clan_api_keys.sql`.
6. Run `database/migrations/006_game_kits.sql`.
7. Run `database/migrations/007_admin_auth.sql`.
8. Run `database/migrations/008_oxide_permissions.sql`.
9. Run `database/migrations/009_server_status.sql`.
10. Run `database/migrations/010_server_status_samples.sql`.
11. Run `database/migrations/011_server_status_rollups.sql`.
12. Run `database/migrations/012_rp_shop.sql`.
13. Run `database/migrations/013_pvp_kit_permission_cleanup.sql`.
14. Run `database/migrations/014_kit_group_delete_tombstones.sql`.
15. Run `database/migrations/015_feature_planning.sql`.
16. Run `database/migrations/016_player_stats_wipe_rp_baseline.sql`.
17. Run `database/migrations/017_feature_voting_status.sql`.
18. Run `database/migrations/018_store_bundle_offer_matrix.sql`.
19. Run `database/migrations/019_raidlands_vip_kits_permissions_seed.sql`.
20. Run `database/migrations/020_store_product_fulfillment_groups.sql`.
21. Run `database/migrations/021_group_owned_kit_permissions.sql`.
22. Run `database/seeds/001_store_products.sql`.
23. Copy the root `.env.example` file to `.env`.
24. Fill in `RAIDLANDS_DB_DSN`, `RAIDLANDS_DB_USER`, and `RAIDLANDS_DB_PASSWORD`.

The root `.env` file is ignored by Git and protected from direct web access by the root `.htaccess`.

## Admin access

- After `007_admin_auth.sql` is installed, `/admin/` uses Steam sign-in instead of the setup username and password.
- Add approved Steam IDs to `admin_users`, then attach roles through `admin_user_roles`.
- Use the commented owner bootstrap query at the bottom of `database/migrations/007_admin_auth.sql` for the first admin account.

## Stripe

Cash checkout remains inactive until real Stripe prices are configured.

- Keep Stripe prices inactive or placeholder-only until a payment processor is ready.
- Create one-time Stripe Prices for cash passes and recurring Stripe Prices for cash subscriptions, paste those `price_...` IDs into Admin > Store, and enable only the offers that should be purchasable.
- Set the webhook URL to `/api/stripe-webhook.php`.
- Configure `RAIDLANDS_STRIPE_PUBLISHABLE_KEY`, `RAIDLANDS_STRIPE_SECRET_KEY`, and `RAIDLANDS_STRIPE_WEBHOOK_SECRET` in `.env`.
- Optionally set `RAIDLANDS_STRIPE_BILLING_PORTAL_CONFIGURATION_ID`; leave it blank to use Stripe's default Billing Portal configuration.

## RP shop

- Admin > Store controls RP offers per product: RP cost, active flag, lifetime/timed duration, and optional auto-renew for timed offers.
- Each active store product must have at least one applied group. Purchases and manual grants apply those groups; Kits and Groups control the permissions those groups receive.
- The website queues RP purchases first. `WebsiteVipBridge` polls `/api/server/rp-purchases.php`, verifies and deducts live ServerRewards RP, then posts the result to `/api/server/rp-purchase-result.php`.
- Entitlements activate only after the bridge confirms the debit.
- Fixed purchases with insufficient RP are rejected. Auto-renew renewals with insufficient RP become past due and the current entitlement expires normally.
- After running `013_pvp_kit_permission_cleanup.sql`, publish once from Admin > Kits or Admin > Groups so the server receives the unique PvP kit permissions.

## Rust server

1. Install Rust Kits by k1lly0u.
2. Configure kit contents, cooldowns, max uses, hidden kit behavior, and kit permission strings in Rust Kits.
3. Put `server-plugins/WebsiteVipBridge.cs` in the uMod/Oxide plugins folder.
4. Put `server-plugins/WebsiteClanBridge.cs` in the uMod/Oxide plugins folder if website or public API clan management should be live.
5. Set `ApiBaseUrl`, `ServerId`, and `SharedSecret` in the generated plugin configs. `ServerId` must match `RAIDLANDS_BRIDGE_SERVER_ID`, and `SharedSecret` must match `RAIDLANDS_BRIDGE_SHARED_SECRET`.
6. Select the groups each Store product applies in Admin > Store, link kits there only for product-card previews, then manage kit access and perk permissions from Admin > Kits and Admin > Groups. Existing starter groups include:
   - `vip_bronze`
   - `vip_gold`
   - `vip_elite`
   - `perk_personal_mini`
   - `perk_skinbox`
   - `perk_raid_kit`
   - `perk_queue_priority`
   - `perk_supporter_badge`
   - `perk_pvp_light`
   - `perk_pvp_rifle`
   - `perk_pvp_roamer`
   - `perk_pvp_heavy`
   - `perk_pvp_elite`
   - `perk_pvp_breach`

The website owns expiration and revocation. WebsiteVipBridge makes the game server match the current website state.

## Clan API

- `/clans/` lets Steam-linked players create and revoke public clan API keys.
- `/api-docs/` documents `GET /api/clans/me.php` and `POST /api/clans/action.php`.
- API keys are stored as hashes and rate-limited by `RAIDLANDS_CLAN_API_RATE_LIMIT_PER_MINUTE`.
- WebsiteClanBridge requires k1lly0u Clans with the Raidlands `RaidlandsClanAction` and `RaidlandsClanSnapshot` hooks.
