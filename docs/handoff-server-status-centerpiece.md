# Handoff: Server Status Centerpiece

## Outcome

Turn `/server/` into the main operational destination promised by the primary navigation: useful at a glance, rich when explored, and clearly distinct from the future standalone map page.

## Scope

- Audit the status payload and promote the most useful live fields above the fold: availability, population/queue, wipe/map identity, uptime/freshness, FPS/performance, and next wipe.
- Improve hierarchy and plain-language labels for players; keep bridge/source diagnostics visually secondary.
- Retain the 3D viewer as the spatial status module and link through to `/map/` once that route exists.
- Review the existing history ranges and make charts understandable without operator knowledge.
- Add intentional loading, stale, offline, and no-history states.

## Explicitly out of scope

- Adding new heartbeat fields to the Rust bridge. Record missing fields as a follow-up contract instead.
- Rebuilding the standalone 3D map experience.
- Admin-only diagnostics or server control actions.

## Proof

PHP lint, endpoint payload inspection, and browser-smoke desktop/mobile against fresh, stale, offline, and fallback status fixtures.
