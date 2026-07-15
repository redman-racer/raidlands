# 3D leaderboard follow-ups

The first 3D podium release decorates the leaderboard metrics already supplied by the live stats feed. The items below are intentionally deferred because they require new game-server telemetry, wipe baselines, and website storage rather than presentation-only work.

## Deferred leaderboard metrics

### Raid damage

- [ ] Identify the authoritative Rust damage hook and exclude decay, self-damage, and non-player-owned damage.
- [ ] Add raw and wipe-baseline raid-damage counters to `WebsiteVipBridge` snapshots.
- [ ] Add database columns/migration, ingestion validation, and all-time/current-wipe ranking queries.
- [ ] Expose the metric through the leaderboard API, table, profile stats, and podium formatter.
- [ ] Build the scene from rockets, timed explosives, and building debris sourced from RustRelay Assets.
- [ ] Decide whether pre-launch server data can be backfilled or whether the first snapshot seeds the baseline.
- [ ] Verify plugin compile, targeted `oxide.reload WebsiteVipBridge`, signed snapshot ingestion, and live damage increments.

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
