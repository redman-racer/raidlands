# Monument Extraction implementation note

Monument Extraction is a server-authoritative RP Casino game integrated with the existing Steam session, RP bridge queue, admin permission, database, page, CSS, and deployment conventions.

## Repository integration points

- `includes/monument-extraction-engine.php` is the pure domain engine used by production requests and simulations. It owns map generation, legal transitions, encounter odds and rolls, damage, resources, inventory, extraction eligibility, payout calculation, and the public-state projection.
- `includes/monument-extraction.php` is the application service. It owns player authorization, configuration freezing, transactions, row locks, idempotency, expiry, seed encryption, RP point requests, history, audit responses, and the JSON API dispatcher.
- `api/monument-extraction.php` is the authenticated JSON endpoint. Browser commands never include outcomes, odds, damage, loot values, state, or payouts.
- `pages/rp-games.php`, `assets/js/monument-extraction.js`, and the Monument Extraction CSS block in `assets/css/styles.css` provide the responsive RP Casino tab. Existing Casino games and their form/result flows remain unchanged.
- `includes/rewards.php` admits the two new bridge sources, `monument_wager` and `monument_payout`, and routes their server callbacks back to the run service.
- `/admin/?section=rp-games` exposes the disabled-by-default feature switch, limits, schema-validated versioned JSON, aggregate metrics, recent audits, and force-expiry.

## Deliberate repository-specific decisions

1. The website's RP wallet is a Rust-server-confirmed queue, not a locally writable balance. A new run therefore remains in `CREATING` until `monument_wager` is confirmed. This prevents gameplay or payout from advancing against an unconfirmed debit.
2. The server seed is a 32-byte cryptographically secure value represented as hex, committed with SHA-256, and encrypted at rest with AES-256-GCM using `MONUMENT_EXTRACTION_SEED_KEY`. It is revealed only for terminal runs.
3. Run maps, inventory, resources, flags, random draws, and the explicit state machine are persisted in `state_json`. This checkout has no ORM; normalized configuration/run/action tables plus a frozen JSON snapshot keep transactional code small while preserving exact replay and reconnect behavior.
4. Intel is a virtual counter rather than a slot item. Armor is auto-consumed on damage by default and can be disabled between encounters. Both follow the MVP recommendations.
5. Every browser mutation has a unique `clientActionId`. `(player_id, client_action_id)` and `(run_id, sequence_number)` database constraints are the final idempotency and ordering backstops.
6. Terminal status clears the unique `active_player_key`, so MySQL enforces one active run per player. Successful extraction creates at most one payout request; death, abandonment, expiry, and wager rejection create none.

## Configuration and activation

1. Apply `database/migrations/046_monument_extraction.sql` after the earlier RP Casino migrations.
2. Add a stable, random value of at least 32 characters to the live environment:

   ```text
   MONUMENT_EXTRACTION_SEED_KEY=replace-with-a-long-random-secret
   ```

   Do not rotate this key while retained runs still need audit access.
3. Open `/admin/?section=rp-games`, review or edit the versioned JSON, review simulation results, check **Monument Extraction enabled**, and save.

The migration, seeded configuration, and admin switch all default to disabled. VIP rank does not change gameplay odds.

## Validation commands

```powershell
php tests/monument-extraction-engine-test.php
php tests/monument-extraction-integration-test.php
php tools/simulate-monument-extraction.php --runs=100000
php -l includes/monument-extraction-engine.php
php -l includes/monument-extraction.php
node --check assets/js/monument-extraction.js
```

The integration test creates its player, wipe, wallet snapshot, runs, actions, and point requests inside one transaction and rolls the transaction back.

## Stuck wager troubleshooting

If a run remains in `CREATING` / **Confirming debit**, inspect the associated `rp_point_requests` row before changing the run:

- `queued` with `bridge_attempts = 0` means the Rust bridge has not claimed the request.
- Repeated `RP point request sync skipped because a previous poll is still in flight.` messages mean the bridge's in-memory poll guard is wedged.
- `processing` means the server claimed the request but has not posted its result yet.
- `rejected` or `failed` should terminate the run and release its active slot automatically.

WebsiteVipBridge v1.6.0 converts the configured millisecond timeout to the seconds expected by Oxide WebRequests and releases stale RP poll guards safely. After uploading it, run:

```text
oxide.reload WebsiteVipBridge
websitevip.rp.points.status
websitevip.rp.points.sync
```

The shared **Recent RP game activity** table includes Monument wager/run rows and displays queued, processing, active, payout, and terminal states.
