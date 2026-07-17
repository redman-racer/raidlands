# 3D leaderboard follow-ups

The first 3D podium release decorates the leaderboard metrics already supplied by the live stats feed. The items below are intentionally deferred because they require new game-server telemetry, wipe baselines, and website storage rather than presentation-only work.

## Deferred leaderboard metrics

### Raid stats (implemented)

- [x] Count non-melee player-attributed damage to enemy player-owned building and decay entities; exclude decay, owners, and native Rust teammates.
- [x] Persist raw cumulative and wipe-baseline counters for raid damage, rockets, C4, satchels, explosive ammo, and TC final blows in `WebsiteVipBridge` snapshots.
- [x] Add database migration, ingestion validation, current/previous/all-time queries, and generic-to-canonical wipe-key promotion.
- [x] Expose every raid metric through the dedicated Raid Stats tab, leaderboard API, profile stats, podium formatter, and admin sync diagnostics.
- [x] Reuse the installed rocket, ammunition, loot-crate, and reactive-target podium props.
- [x] Start telemetry at deployment without historical backfill.
- [x] Compile the plugin against the deployed Rust server assemblies and add database integration coverage.
- [ ] Reload `WebsiteVipBridge`, force a signed snapshot, and verify representative live increments after deployment.

### Airstrike kills

- [ ] Define kill attribution between PortableAirstrikes payload ownership and the final Rust death event.
- [ ] Add raw and wipe-baseline airstrike-kill counters to `WebsiteVipBridge` snapshots.
- [ ] Add database columns/migration, ingestion validation, and all-time/current-wipe ranking queries.
- [ ] Expose the metric through the leaderboard API, table, profile stats, and podium formatter.
- [ ] Build the scene from aircraft/carrier, payload, rocket, and explosion props sourced from RustRelay Assets.
- [ ] Decide whether existing PortableAirstrikes data supports a trustworthy backfill.
- [ ] Verify both involved plugins compile/reload, the signed stats snapshot, and an attributed live test kill.

### Vehicle kills

- [ ] Define which vehicle deaths count and how driver, passenger, weapon, and deployable ownership are attributed.
- [ ] Add raw and wipe-baseline vehicle-kill counters to `WebsiteVipBridge` snapshots.
- [ ] Add database columns/migration, ingestion validation, and all-time/current-wipe ranking queries.
- [ ] Expose the metric through the leaderboard API, table, profile stats, and podium formatter.
- [ ] Build the scene from vehicle wreckage, rockets, and anti-vehicle weapon props sourced from RustRelay Assets.
- [ ] Decide whether historical plugin data is complete enough to backfill.
- [ ] Verify plugin compile, targeted reloads, signed snapshot ingestion, and representative live vehicle kills.

## Vendored model provenance

The files in `assets/media/models/leaderboard/` are renamed copies from the sibling `RustRelay.Assets` reference repository. They are low-quality, web-optimized Rust reference models and remain subject to the Facepunch Terms of Service. They must not be presented as original Raidlands assets or redistributed independently.

| Raidlands file | RustRelay.Assets source |
| --- | --- |
| `ak47.glb` | `assets/prefabs/Weapons/ak47u/ak47u.worldmodel.glb` |
| `reactive-target.glb` | `assets/prefabs/Deployable/Reactive Target/reactivetarget_deployed.glb` |
| `ammo.glb` | `assets/bundled/prefabs/radtown/DMLoot/dm ammo.glb` |
| `trophy.glb` | `assets/prefabs/Misc/Trophy/trophy.deployed.glb` |
| `sleeping-bag.glb` | `assets/prefabs/Deployable/Sleeping Bag/sleepingbag_leather_deployed.glb` |
| `campfire.glb` | `assets/bundled/prefabs/static/campfire_on.static.glb` |
| `digital-clock.glb` | `assets/prefabs/Deployable/PlayerIOEnts/DigitalClock/electric.digitalclock.deployed.glb` |
| `scrap.glb` | `assets/prefabs/Resource/Scrap/scrap.worldmodel.glb` |
| `loot-crate.glb` | `assets/prefabs/Deployable/Wooden loot crates/wooden_crate_2.glb` |
| `scientist.glb` | `assets/prefabs/Deployable/Youtooz_Figurines/heavyscientist_youtooz.deployed.glb` |
| `skull.glb` | `assets/prefabs/Weapons/Halloween/Skull_Halloween/skull.worldmodel.glb` |
| `rocket-launcher.glb` | `assets/prefabs/Weapons/RocketLauncher/rocketlauncher.worldmodel.glb` |
| `combat-knife.glb` | `assets/prefabs/Weapons/Knife/knife.combat.worldmodel.glb` |
