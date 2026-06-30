# Raidlands VIP Store Setup

## Local database

1. Create a MySQL database and user.
2. Run `database/migrations/001_vip_store.sql`.
3. Run `database/seeds/001_store_products.sql`.
4. Copy `data/raidlands-secrets.example.php` to `data/raidlands-secrets.php`.
5. Fill in the MySQL, Stripe, and bridge secret values.

`data/raidlands-secrets.php` is ignored by Git and protected from direct web access by `data/.htaccess`.

## Stripe

- Create one recurring monthly Stripe Price for each VIP tier.
- Create one one-time Stripe Price for each individual perk or kit unlock.
- Paste those `price_...` IDs into Admin > Store.
- Set the webhook URL to `/api/stripe-webhook.php`.
- Configure the webhook signing secret in `data/raidlands-secrets.php`.

## Rust server

1. Install Rust Kits by k1lly0u.
2. Configure kit contents, cooldowns, max uses, hidden kit behavior, and kit permission strings in Rust Kits.
3. Put `server-plugins/WebsiteVipBridge.cs` in the uMod/Oxide plugins folder.
4. Set `ApiBaseUrl`, `ServerId`, and `SharedSecret` in the generated plugin config.
5. Match Website product groups to Rust Kits permissions through Oxide groups:
   - `vip_bronze`
   - `vip_gold`
   - `vip_elite`
   - `perk_personal_mini`
   - `perk_skinbox`
   - `perk_raid_kit`
   - `perk_queue_priority`
   - `perk_supporter_badge`

The website owns expiration and revocation. WebsiteVipBridge makes the game server match the current website state.
