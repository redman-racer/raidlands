# Player-centered leaderboard podium handoff

The leaderboard now treats a Rust character as each winner. Metric items are restrained backdrop dressing and no longer stand in for the player.

## Deployment order

1. Deploy and run `database/migrations/064_player_podium_appearances.sql`.
2. Deploy the website PHP, JavaScript, CSS, build output, and `assets/media/models/leaderboard/*.glb` additions.
3. Upload `server-plugins/WebsiteVipBridge.cs` as `oxide/plugins/WebsiteVipBridge.cs` on the Rust server.
4. Run `oxide.reload WebsiteVipBridge` and watch for `Stats snapshot synced for ...`.
5. Join with a real Steam account, change wear or belt equipment, wait for the configured debounce, and confirm the profile shows captured choices.

## Capture behavior

- WebsiteVipBridge v1.7.0 adds an optional `appearance` object to connected-player stats rows.
- Wear and belt changes queue the existing debounced stats sync; the periodic sync remains the backstop.
- Auto outfit selection requires at least three samples and a 50% share within the active wipe.
- Only complete supported layered outfits or supported full suits are rendered. Other observations remain stored for future catalog additions.
- RustRelay wearables with omitted helper weights are normalized by `scripts/sanitize-rustrelay-wearables.mjs`; a failed full-suit export resolves to the fully dressed survivor mannequin instead of disappearing.
- Workshop skin IDs are retained. Unsupported skins render the vanilla garment model.
- Bots use stable humanoid outfit and weapon presets derived from bot identity. Their payload contract can accept kit-driven appearance later.

## Proof boundary

Local PHP, TypeScript, asset, bridge compile, and browser checks prove source compatibility. A live `oxide.reload WebsiteVipBridge` plus an in-game outfit change is still required to prove runtime capture.
