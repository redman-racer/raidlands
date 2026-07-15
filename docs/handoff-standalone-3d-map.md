# Handoff: Standalone 3D Map

## Outcome

Give the shared 3D terrain viewer a player-facing home at `/map/` without removing the compact preview from the home page or the operational viewer from Server Status.

## Scope

- Add the `/map/` route and a focused page shell for the existing shared viewer.
- Reuse `assets/ts/server-map-viewer/app.ts`; do not fork the renderer.
- Lead with the live terrain, current wipe identity, environment, and viewer controls.
- Decide which player, clan, heatmap, and playback controls are public, signed-in, VIP-delayed, or admin-only.
- Add discovery links from Server Status, the home viewer, and the Explore dropdown after the route is ready.
- Preserve useful unavailable states when terrain or heartbeat data has not arrived.

## Explicitly out of scope

- New Rust telemetry or invented cinematic data.
- A rewrite of the viewer bundle.
- Moving operational server diagnostics away from Server Status.

## Proof

Run typecheck/build checks for the shared viewer, PHP lint the new route/page, and browser-smoke desktop/mobile layouts with both live-data and unavailable states.
