# Codex Implementation Brief: Portable Airstrikes Web Animation Editor + Rust Sync Bridge

## Operating instruction for Codex

Implement this system completely. Do not stop after producing a plan, mockup, architecture note, or partial scaffold.

Work in the existing Raidlands website and Rust server/plugin repositories. Inspect the current code before modifying anything, preserve existing conventions, run the available tests/builds, and report exactly what changed.

The primary repositories are expected to be:

- Website: `redman-racer/raidlands`
- Rust server/plugins: `redman-racer/rust_server`

The most recent user-provided versions of `PortableAirstrikes.cs` and `PortableAirstrikesAnimationEditor.cs` may be newer than the versions currently committed. Compare repository files against the latest supplied files before coding. Do not silently replace a newer implementation with an older one.

Do not ask the user to manually copy, export, import, or upload `VisualProfiles.json` as part of normal operation. The completed system must synchronize it automatically through the bridge described below.

---

# 1. Mission

Build a browser-based, admin-only 3D animation editor for Portable Airstrikes and a corresponding Oxide/uMod plugin that synchronizes published animation profiles with the live Rust server.

The system must solve the current editing limitations:

- Precisely scrub through animation time.
- Move and rotate waypoints using 3D gizmos.
- Edit exact numeric values.
- Adjust aircraft speed and timing.
- Author full rotations such as helicopter barrel rolls without losing the intended turn.
- Position payload release events at exact times.
- Support manual release events and repeated release patterns.
- Preview vehicle orientation, hardpoints, payload origins, approximate trajectories, and target alignment.
- Publish the complete profile set to the website.
- Install the published profile set into the correct Rust data file automatically.
- Reload the runtime and in-game editor without restarting the server.
- Preserve backups and allow rollback.
- Avoid constant polling from the game server.

The authoritative game data path is:

```text
oxide/data/PortableAirstrikes/VisualProfiles.json
```

The Oxide data-file name is:

```text
PortableAirstrikes/VisualProfiles
```

---

# 2. Non-negotiable architectural decisions

## 2.1 The website is the primary authoring environment

The website editor is where full route authoring, timeline editing, release scheduling, and precise 3D manipulation occur.

The existing in-game `PortableAirstrikesAnimationEditor` remains useful for:

- Testing against real Rust terrain.
- Testing actual Rust prefabs.
- Verifying network movement.
- Verifying real payload spawning and collision.
- Applying small runtime calibration adjustments.
- Previewing a published route in the live environment.

Do not attempt to make Rust CUI the primary full-featured 3D editor.

## 2.2 No constant game-to-website polling

The default synchronization model must be event-driven.

Use all three of these mechanisms:

1. **Publish-triggered RCON notification**
   - When an admin clicks `Publish & Sync`, the website publishes an immutable bundle revision.
   - The website opens a short-lived Rust WebRCON connection.
   - It sends one fixed console command:
     ```text
     airanimsync.sync <publishedRevision>
     ```
   - The game plugin then performs one signed HTTP pull and installs the bundle.
   - The website does not keep a persistent RCON connection.

2. **One startup recovery check**
   - `WebsiteAirstrikeAnimationBridge` performs one delayed update check after server initialization.
   - This catches a revision missed while the server was offline.
   - It must not start a recurring timer by default.

3. **Manual in-game fallback**
   - Provide an admin-only `/airanimsync` CUI panel and console commands.
   - The panel must include `CHECK`, `SYNC NOW`, `UPLOAD LOCAL`, `FORCE PULL`, and `ROLLBACK`.
   - If WebRCON is not configured, blocked by hosting, or temporarily fails, the admin can press `SYNC NOW`.

An optional recurring check may exist in config, but it must default to disabled.

## 2.3 Game-side edits are uploaded only when saved

Do not monitor the file continuously.

When the in-game animation editor successfully saves profiles, it must emit a hook. The bridge handles that hook and performs one snapshot upload to the website.

This keeps the website aware of final in-game calibration without polling.

The save hook should be:

```csharp
Interface.CallHook(
    "OnPortableAirstrikesVisualProfilesSaved",
    "PortableAirstrikes/VisualProfiles",
    serializedJson,
    changedProfileIds
);
```

Adapt the signature if the current code already exposes an equivalent hook, but preserve the same behavior.

Game-side uploads create a website draft or pending server snapshot. They must not automatically publish to production.

## 2.4 Use the existing shared bridge-secret system

The new plugin must resolve `${KEY}` placeholders from:

```text
oxide/config/Secrets.local.json
```

Use the same implementation pattern as the existing bridge plugins, especially:

- `WebsiteClanBridge.cs`
- `WebsiteVipBridge.cs`

The plugin config must use:

```json
"SharedSecret": "${RAIDLANDS_BRIDGE_SHARED_SECRET}"
```

Expected secrets file entry:

```json
{
  "RAIDLANDS_BRIDGE_SHARED_SECRET": "the-existing-shared-secret"
}
```

Do not create or commit a real secret.

Use the existing Raidlands HMAC request contract:

```text
METHOD + "\n" +
REQUEST_URI + "\n" +
TIMESTAMP + "\n" +
SHA256(REQUEST_BODY)
```

Send these headers:

```text
X-Raidlands-Server
X-Raidlands-Timestamp
X-Raidlands-Signature
```

The website endpoints must authorize requests through the existing bridge authorization helper rather than implementing a second incompatible authentication system.

## 2.5 Website and Rust must play the same compiled track

Do not rely on independently reimplementing a spline in JavaScript and C# and hoping both versions look identical.

The website must compile each published route into a dense, target-relative runtime track. Both the browser preview and Rust runtime must use that compiled track.

The published file remains backward compatible with schema version 1, but adds optional schema version 2 compiled fields.

This is required for:

- Exact timing.
- Exact release locations.
- Full barrel rolls.
- Stable orientation.
- Avoiding JavaScript/C# spline discrepancies.

---

# 3. Existing code and compatibility requirements

Before coding, inspect at least:

## Website

```text
includes/config.php
includes/store.php
includes/admin.php
.env.example
composer.json
server-plugins/WebsiteClanBridge.cs
server-plugins/WebsiteVipBridge.cs
```

Also inspect:

- Current migration numbering and migration conventions.
- Current admin section routing.
- Current role/permission helpers.
- Current CSRF helpers.
- Current audit-log helpers.
- Existing API response helpers.
- Any existing Rust RCON or WebSocket helper.

## Rust plugins

Inspect the current versions of:

```text
PortableAirstrikes.cs
PortableAirstrikesAnimationEditor.cs
WebsiteClanBridge.cs
WebsiteVipBridge.cs
```

The current animation profile file has concepts equivalent to:

```text
VisualProfileFile
  SchemaVersion
  AllowDangerousPayloadPreview
  Profiles

VisualProfileConfig
  Vehicle
  DurationSeconds
  FirstPayloadDelaySeconds
  PayloadReleaseMode
  MaxPayloadCount
  PayloadReleaseIntervalSeconds
  ReleaseTemplate
  RotationSmoothTimeSeconds
  StopAtWaypoints
  MinimumTerrainClearance
  Waypoints
  PayloadEvents

VisualProfileWaypoint
  Time
  X
  Y
  Z
  RotationX
  RotationY
  RotationZ

VisualPayloadEvent
  Time
  Payload
  Index
  Count
  CarrierOffsetX
  CarrierOffsetY
  CarrierOffsetZ
  TargetOffsetX
  TargetOffsetY
  TargetOffsetZ
  SpreadRadius
  LaunchSpeed
  FuseSeconds
  DamageScale
  VehicleDamageScale
  SplashRadius
  ImpactRadius
  MaxTrackingSeconds
  MaxTrackingDistance
  DamageScales
```

Preserve all current fields. Do not rename existing JSON properties.

Known vehicle values include:

```text
drone
cargo_plane
f15
a10
attack_heli
```

Known payload values include at least:

```text
bee_grenade
beancan
f1_grenade
smoke
flashbang
he_40mm
molotov
bee_catapult_bomb
firebomb
propane_bomb
hv_rocket
rocket
incendiary_rocket
mortar_he_payload
mortar_frag_payload
bradley_longbarrel_burst
homing_missile
mlrs_rocket
```

Use the current plugin source as the final authority for valid values.

The coordinate system is target-relative:

```text
0,0,0 = strike target
X       = right/left relative to the approach
Y       = height
Z       = approach axis
negative Z = inbound
positive Z = outbound
```

---

# 4. Deliverables

Implement all of the following.

## Website deliverables

1. Admin profile-management page.
2. Full-screen 3D animation editor.
3. TypeScript editor source.
4. Vite build configuration.
5. Static production build integration.
6. PHP backend/service layer.
7. Database migration(s).
8. Admin JSON endpoints.
9. Signed server bridge endpoints.
10. Immutable publishing and revision history.
11. Server sync-status display.
12. Rust WebRCON one-shot publish notification.
13. Server snapshot ingestion.
14. Conflict detection and resolution UI.
15. Unit tests and shared golden fixtures.
16. Deployment/config documentation.

## Rust deliverables

1. New standalone plugin:
   ```text
   WebsiteAirstrikeAnimationBridge.cs
   ```
2. Minimal backward-compatible updates to `PortableAirstrikes.cs`.
3. Minimal backward-compatible updates to `PortableAirstrikesAnimationEditor.cs`.
4. Compiled-track runtime support.
5. Runtime profile reload APIs.
6. In-game sync CUI and commands.
7. Atomic file replacement.
8. Automatic backups.
9. Rollback.
10. Signed bundle pull.
11. Signed receipt post.
12. Automatic local-save snapshot upload.
13. Bootstrap upload on first setup.
14. Local-change conflict protection.
15. Useful status and diagnostic logging.

Do not leave placeholder TODO implementations.

---

# 5. High-level system architecture

```text
┌─────────────────────────────────────────────────────────┐
│ Raidlands Admin Website                                 │
│                                                         │
│  Profile drafts                                         │
│       │                                                 │
│       ▼                                                 │
│  TypeScript + Three.js editor                           │
│       │                                                 │
│       ▼                                                 │
│  Publish compiler                                       │
│       │                                                 │
│       ├── source revision                               │
│       ├── runtime VisualProfiles.json                   │
│       ├── compiled frames                               │
│       └── SHA-256 hash                                  │
│                                                         │
│  Publish & Sync                                         │
│       │                                                 │
│       ├── commit immutable DB bundle                    │
│       └── one WebRCON command                           │
└───────┼─────────────────────────────────────────────────┘
        │ airanimsync.sync <revision>
        ▼
┌─────────────────────────────────────────────────────────┐
│ Rust Server                                             │
│                                                         │
│ WebsiteAirstrikeAnimationBridge                         │
│       │                                                 │
│       ├── signed GET bundle                             │
│       ├── validate                                      │
│       ├── backup current file                           │
│       ├── atomic install                                │
│       ├── reload runtime/editor                         │
│       └── signed POST receipt                           │
│                                                         │
│ oxide/data/PortableAirstrikes/VisualProfiles.json       │
│       │                                                 │
│       ├── PortableAirstrikes                            │
│       └── PortableAirstrikesAnimationEditor             │
└─────────────────────────────────────────────────────────┘
```

Reverse direction for game-side calibration:

```text
In-game editor Save
      │
      ▼
OnPortableAirstrikesVisualProfilesSaved hook
      │
      ▼
Bridge sends one signed snapshot POST
      │
      ▼
Website creates/updates server draft or pending conflict
```

---

# 6. Website technology choice

The existing site is PHP-based. Do not replace it with a new application framework.

Use:

- PHP 8.1+ for authentication, persistence, APIs, publishing, and RCON orchestration.
- Vite for frontend builds.
- TypeScript.
- Three.js.
- Plain modular TypeScript and DOM components.
- Existing Raidlands admin layout and authentication.
- Existing CSS variables/design language where practical.

Do not require React unless the repository already uses it for admin tooling. Prefer a focused, dependency-light TypeScript implementation.

Add a `package.json` only if the website does not already have one.

Expected frontend dependencies:

```text
three
typescript
vite
vitest
jsdom, only if needed by tests
```

Use Three.js examples modules bundled by Vite:

```text
OrbitControls
TransformControls
GLTFLoader
```

Do not load Three.js or editor code from a CDN.

---

# 7. Website routes and pages

Adapt names to the existing admin router if needed, but provide these capabilities.

## Admin list/management page

Suggested path:

```text
/admin/?section=airstrike-animations
```

It must show:

- Profile key.
- Display name.
- Vehicle.
- Draft status.
- Draft version.
- Last published profile revision.
- Current global bundle revision.
- Last editor.
- Last modified time.
- Validation status.
- Archived status.
- Server-installed revision.
- Server-local-dirty status.
- Last server sync time.
- Last server error.

Actions:

```text
EDIT
DUPLICATE
ARCHIVE
VIEW REVISIONS
PUBLISH
PUBLISH & SYNC
IMPORT SERVER SNAPSHOT
```

## Full-screen editor

Suggested path:

```text
/admin/airstrike-animation-editor.php?profile=<profileKey>
```

It must require the existing admin session and an appropriate role/capability.

The PHP page should render only the secure shell/config required by the TypeScript app. It must not embed secrets.

Provide the browser with:

- Current authenticated admin identity.
- CSRF token.
- API base paths.
- Requested profile key.
- Feature flags.
- Maximum supported payload size.

---

# 8. Browser editor user experience

## 8.1 Overall layout

Use a four-region editor.

### Top toolbar

Include:

```text
Profile selector
Save Draft
Undo
Redo
Validate
Compile Preview
Publish
Publish & Sync
Revision status
Server sync status
Dirty indicator
```

### Left panel

Include:

```text
Profile search
Profile list
Create
Duplicate
Archive
Vehicle profile selector
Model visibility
Scene object visibility
```

### Center viewport

Include:

```text
3D grid
Target marker at origin
Axis indicator
Route curve
Waypoint handles
Selected waypoint transform gizmo
Vehicle model/proxy
Vehicle bounding box
Release hardpoints
Release markers
Approximate trajectory lines
Predicted impact markers
Target miss-distance indicator
Current-time vehicle ghost
Camera controls
```

### Right inspector

The inspector changes by selection.

For a waypoint:

```text
Stable waypoint ID
Time
Position X/Y/Z
Rotation X/Y/Z
Interpolation
Rotation mode
Ease settings
Duplicate
Delete
```

For a release event:

```text
Stable event ID
Time
Payload
Count
Carrier offset X/Y/Z
Target offset X/Y/Z
Spread
Launch speed
Fuse
Damage scale
Vehicle damage scale
Splash radius
Impact radius
Tracking time
Tracking distance
Damage scales
```

For a profile:

```text
Vehicle
Duration
First release time
Rotation smoothing
Stop at waypoints
Terrain clearance
Release mode
Repeated-pattern controls
Model correction
Pivot offset
Hardpoints
```

### Bottom timeline

Include tracks for:

```text
Vehicle position
Vehicle rotation
Waypoints
Payload releases
Optional effects/sounds
```

Timeline features:

- Draggable playhead.
- Play/pause.
- Loop.
- Frame step.
- Jump to previous/next event.
- Timeline zoom.
- Horizontal pan.
- Snap toggle.
- Snap interval.
- Drag waypoint time.
- Drag release time.
- Multi-select release events.
- Current time display.
- Duration display.
- Release group labels.

## 8.2 Camera modes

Provide:

```text
Perspective orbit
Top
Side
Front
Vehicle follow
Vehicle nose
Selected hardpoint
Target looking toward vehicle
```

Keyboard shortcuts:

```text
Space          Play/pause
Left/Right     Step
Shift+Left/Right Jump event
W              Translate gizmo
E              Rotate gizmo
R              Scale only where relevant; do not scale route waypoints
F              Frame selected
Delete         Delete selected item after confirmation rules
Ctrl/Cmd+Z     Undo
Ctrl/Cmd+Y     Redo
Ctrl/Cmd+S     Save draft
1-7            Camera views
Escape         Cancel active drag/deselect
```

Do not allow browser shortcuts to cause data loss.

## 8.3 Waypoint manipulation

A waypoint can be edited by:

- Dragging the translation gizmo.
- Dragging the rotation gizmo.
- Typing exact values.
- Dragging its timeline marker.
- Nudging with configurable increments.
- Duplicating.
- Inserting between adjacent waypoints.

When changing time:

- Keep waypoints sorted.
- Do not silently create duplicate times.
- Clamp between adjacent waypoints with a minimum gap.
- Show a validation error when a requested time cannot be applied.

## 8.4 Release modes

Support two user-facing modes.

### Manual events

Every release has an explicit time and complete event fields.

The earliest event must remain synchronized with `FirstPayloadDelaySeconds`.

### Repeated pattern

User controls:

```text
Start time
Interval
Units per release
Maximum total units
Payload template
Hardpoint strategy
```

Example:

```text
Start time:          4.20 seconds
Interval:            0.30 seconds
Units per release:   3
Maximum total units: 12
```

The effective schedule is:

```text
4.20 -> 3
4.50 -> 3
4.80 -> 3
5.10 -> 3
```

For a non-even total, reduce the final group rather than exceeding the maximum.

The current runtime string value `generated` may be retained for compatibility, while the website labels it `Repeated Pattern`.

Show the generated events on the timeline even when the source is stored as a pattern.

## 8.5 Undo/redo

Implement a command-based undo stack.

Undoable actions include:

- Waypoint move.
- Waypoint rotation.
- Waypoint time.
- Insert/delete/duplicate.
- Release event edits.
- Repeated-pattern edits.
- Profile settings.
- Model correction.
- Hardpoint changes.

Coalesce continuous drag updates into one undo entry.

Limit history to a reasonable count such as 200 commands.

## 8.6 Draft autosave and recovery

Implement:

- Explicit Save Draft.
- Debounced autosave after a stable edit interval.
- Browser-local recovery snapshot.
- Server draft version number.
- Optimistic concurrency.

Every save sends the draft version it was based on.

If the server version changed:

- Do not overwrite.
- Return HTTP 409.
- Show a conflict dialog.
- Allow reload, compare, or save a copy.

---

# 9. 3D scene and asset system

## 9.1 Scene requirements

The initial scene does not need to reproduce the Rust world.

Use:

- Meter grid.
- Target at origin.
- Configurable ground plane.
- Height reference lines.
- Approach-direction arrow.
- Local axis helper.
- Simple lighting.
- Neutral sky/background.
- Optional terrain-height preview later.

## 9.2 Vehicle models

Expected asset paths:

```text
/assets/airstrike-animation-editor/models/drone.glb
/assets/airstrike-animation-editor/models/cargo_plane.glb
/assets/airstrike-animation-editor/models/f15.glb
/assets/airstrike-animation-editor/models/a10.glb
/assets/airstrike-animation-editor/models/attack_heli.glb
```

Do not fail when a model is absent.

Create dimensionally useful fallback proxies:

- Box/fuselage.
- Wing span.
- Nose direction marker.
- Tail marker.
- Bounding box.
- Hardpoint markers.

Store vehicle preview metadata separately from animation data:

```json
{
  "vehicle": "attack_heli",
  "modelUrl": "/assets/airstrike-animation-editor/models/attack_heli.glb",
  "scale": 1.0,
  "positionCorrection": { "x": 0, "y": 0, "z": 0 },
  "rotationCorrection": { "x": 0, "y": 0, "z": 0 },
  "bounds": { "x": 14, "y": 5, "z": 17 },
  "hardpoints": [
    { "id": "left_rocket", "x": -2.2, "y": -0.6, "z": 1.1 },
    { "id": "right_rocket", "x": 2.2, "y": -0.6, "z": 1.1 }
  ]
}
```

Do not put licensed Rust assets into the repository unless they are already authorized project assets.

## 9.3 Coordinate conversion

The authoritative stored coordinate system is Unity/Rust local space:

```text
left-handed
+X right
+Y up
+Z forward
```

Three.js rendering uses a right-handed space.

Use an explicit conversion layer. Do not scatter sign changes throughout the editor.

Recommended vector conversion:

```text
Unity local (x, y, z) -> Three render (x, y, -z)
```

Recommended quaternion conversion for the same Z-axis reflection:

```text
Unity local (qx, qy, qz, qw) -> Three render (-qx, -qy, qz, qw)
```

Implement the conversion through tested helper functions. Verify it with matrix-based tests rather than trusting the formula alone.

All API and stored values remain Unity/Rust values.

---

# 10. Deterministic authoring evaluator and compiler

## 10.1 Source interpolation

Use deterministic, time-based interpolation.

### Position, `StopAtWaypoints = false`

Use cubic Hermite interpolation with time-aware Catmull-Rom-style tangents.

For interior point `i`:

```text
m_i = (p_(i+1) - p_(i-1)) / (t_(i+1) - t_(i-1))
```

Use sensible one-sided endpoint tangents.

For segment `i -> i+1`, scale derivatives by segment duration when evaluating Hermite basis functions.

### Position, `StopAtWaypoints = true`

Use zero endpoint tangents for each segment so the vehicle eases to a stop at every waypoint.

### Rotation offsets

Treat waypoint Euler rotation values as continuous, unwrapped degree values.

Do not normalize values to `0..360` or `-180..180` while authoring.

This must preserve sequences such as:

```text
roll 0
roll 180
roll 360
roll 540
```

Interpolate each continuous Euler component over time, convert the sampled value to a quaternion, and then enforce quaternion sign continuity.

### Final orientation

Default mode:

```text
finalLocalRotation =
  localLookRotation(pathTangent, localUp)
  * authoredRotationOffset
```

The editor supports `RotationMode: "authored_orientation"` for fully manual rotation. In that mode:

```text
finalLocalRotation = authoredRotation
```

Path tangents do not affect vehicle orientation. The existing `follow_path_plus_offset` behavior remains the default.

## 10.2 Runtime compilation

At publish time, compile the route to fixed-rate frames.

Default:

```text
SampleRateHz = 30
SampleIntervalSeconds = 1 / 30
```

Include a frame at time `0` and a final frame at exactly `DurationSeconds`.

Each compiled frame stores:

```json
{
  "Time": 0.000000,
  "X": 0.000000,
  "Y": 100.000000,
  "Z": -400.000000,
  "Qx": 0.000000,
  "Qy": 0.000000,
  "Qz": 0.000000,
  "Qw": 1.000000
}
```

Rules:

- Positions are target-relative Unity local coordinates.
- Quaternion is final local vehicle orientation relative to the route basis.
- Normalize every quaternion.
- If `dot(previousQuaternion, currentQuaternion) < 0`, negate the current quaternion to preserve interpolation continuity.
- Round output floats consistently, preferably to six decimal places.
- Do not emit NaN, Infinity, or negative zero.
- Enforce frame-count and bundle-size limits.
- Browser preview's `compiled` mode must use these exact frames.

## 10.3 Runtime application in Unity

At strike runtime, create the target/approach basis:

```csharp
var forward = horizontalApproach.normalized;
var right = Vector3.Cross(Vector3.up, forward).normalized;
var basisRotation = Quaternion.LookRotation(forward, Vector3.up);
```

For a compiled local frame:

```csharp
worldPosition =
    target
    + right * frame.X
    + Vector3.up * frame.Y
    + forward * frame.Z;

worldRotation =
    basisRotation
    * new Quaternion(frame.Qx, frame.Qy, frame.Qz, frame.Qw);
```

Interpolate between adjacent frames:

```text
position: Vector3.Lerp
rotation: Quaternion.Slerp
```

Runtime terrain clearance may raise the resulting world position. That is an intentional game-only correction and should be displayed as such in diagnostics.

## 10.4 Compiled release events

Compile the complete effective release schedule too.

Add optional schema version 2 field:

```json
"CompiledReleaseEvents": [
  {
    "Time": 4.2,
    "Payload": "hv_rocket",
    "Index": 1,
    "Count": 2,
    "CarrierOffsetX": -2.2,
    "CarrierOffsetY": -0.6,
    "CarrierOffsetZ": 1.1,
    "TargetOffsetX": 0,
    "TargetOffsetY": 0,
    "TargetOffsetZ": 0,
    "SpreadRadius": 0,
    "LaunchSpeed": 85,
    "FuseSeconds": 0,
    "DamageScale": 1,
    "VehicleDamageScale": 1,
    "SplashRadius": 0,
    "ImpactRadius": 0,
    "MaxTrackingSeconds": 0,
    "MaxTrackingDistance": 0,
    "DamageScales": {}
  }
]
```

The game uses `CompiledReleaseEvents` when present.

This prevents differences in repeated-pattern expansion and permits alternating hardpoints.

Legacy fields remain populated for compatibility.

---

# 11. Source schema and runtime schema

## 11.1 Website source object

Store richer editor data in the database.

Example:

```json
{
  "EditorSourceSchemaVersion": 1,
  "ProfileKey": "attack_heli_rocket_run",
  "DisplayName": "Attack Heli Barrel Roll Rocket Run",
  "Vehicle": "attack_heli",
  "DurationSeconds": 8.0,
  "RotationSmoothTimeSeconds": 0.12,
  "StopAtWaypoints": false,
  "MinimumTerrainClearance": 55.0,
  "PositionInterpolation": "time_hermite",
  "RotationMode": "follow_path_plus_offset",
  "Waypoints": [
    {
      "Id": "wp_01",
      "Time": 0.0,
      "X": 0.0,
      "Y": 80.0,
      "Z": -250.0,
      "RotationX": 0.0,
      "RotationY": 0.0,
      "RotationZ": 0.0
    },
    {
      "Id": "wp_02",
      "Time": 4.2,
      "X": 0.0,
      "Y": 55.0,
      "Z": 0.0,
      "RotationX": -70.0,
      "RotationY": 0.0,
      "RotationZ": 180.0
    },
    {
      "Id": "wp_03",
      "Time": 6.0,
      "X": 0.0,
      "Y": 75.0,
      "Z": 160.0,
      "RotationX": 0.0,
      "RotationY": 0.0,
      "RotationZ": 360.0
    }
  ],
  "ReleaseSource": {
    "Mode": "repeated",
    "StartTime": 4.2,
    "IntervalSeconds": 0.3,
    "UnitsPerRelease": 2,
    "MaximumUnits": 12,
    "Template": {
      "Payload": "hv_rocket",
      "Count": 2
    },
    "HardpointSequence": [
      "left_rocket",
      "right_rocket"
    ]
  },
  "EditorMetadata": {
    "Notes": "",
    "Tags": [],
    "VehiclePreviewOverrides": {}
  }
}
```

## 11.2 Published runtime file

The installed file remains recognizable to existing plugins:

```json
{
  "SchemaVersion": 2,
  "CompilerVersion": "raidlands-airanim-1",
  "PublishedRevision": 17,
  "PublishedSha256": "...",
  "AllowDangerousPayloadPreview": false,
  "Profiles": {
    "attack_heli_rocket_run": {
      "Vehicle": "attack_heli",
      "DurationSeconds": 8.0,
      "FirstPayloadDelaySeconds": 4.2,
      "PayloadReleaseMode": "generated",
      "MaxPayloadCount": 12,
      "PayloadReleaseIntervalSeconds": 0.3,
      "ReleaseTemplate": {},
      "RotationSmoothTimeSeconds": 0.12,
      "StopAtWaypoints": false,
      "MinimumTerrainClearance": 55.0,
      "Waypoints": [],
      "PayloadEvents": [],
      "CompiledTrack": {
        "CompilerVersion": "raidlands-airanim-1",
        "SourceHash": "...",
        "CoordinateSystem": "unity-target-relative-local-v1",
        "SampleRateHz": 30,
        "SampleIntervalSeconds": 0.033333,
        "DurationSeconds": 8.0,
        "Frames": []
      },
      "CompiledReleaseEvents": []
    }
  }
}
```

Populate all legacy fields with meaningful values. Do not publish empty legacy waypoints merely because compiled frames exist.

## 11.3 Backward compatibility

- Schema 1 continues to load and use the existing evaluator.
- Schema 2 uses `CompiledTrack` when valid.
- If a schema 2 compiled track is invalid, log a clear warning and fall back to legacy waypoints.
- Unknown extra JSON fields must not break older code.
- Do not remove schema 1 support.

---

# 12. Projectile and release visualization

The browser projectile preview is approximate and does not claim to duplicate Rust physics exactly.

Show:

- Release origin.
- Vehicle forward direction.
- Initial projectile direction.
- Target direction.
- Approximate gravity path when appropriate.
- Straight or guided line for rockets/missiles.
- Predicted ground/target intersection.
- Miss distance.
- Vehicle-bounds intersection warning.
- Payload release time.
- Count per release.

Use the current payload fields and sensible visualization profiles.

The live Rust preview remains authoritative.

Do not enable dangerous payload firing from the website.

Keep:

```json
"AllowDangerousPayloadPreview": false
```

unless the current explicit server policy says otherwise.

---

# 13. Database design

Use the next migration number after inspecting the repository.

Suggested tables are below. Adapt SQL types and naming to current conventions.

## `airstrike_animation_profiles`

```text
id
profile_key unique
display_name
vehicle
draft_source_json LONGTEXT
draft_source_sha256 CHAR(64)
draft_version unsigned integer
last_published_profile_revision nullable
archived_at nullable
created_by
updated_by
created_at
updated_at
```

## `airstrike_animation_profile_revisions`

```text
id
profile_id
profile_revision
bundle_revision
source_json LONGTEXT
source_sha256 CHAR(64)
runtime_json LONGTEXT
runtime_sha256 CHAR(64)
publish_notes
created_by
created_at
```

Unique:

```text
(profile_id, profile_revision)
```

## `airstrike_animation_bundles`

```text
revision primary key or unique auto-increment
schema_version
compiler_version
bundle_json LONGTEXT
sha256 CHAR(64)
profile_count
publish_notes
published_by
published_at
```

Bundles are immutable.

## `airstrike_animation_server_syncs`

```text
server_id primary key
installed_revision
installed_sha256
local_sha256
local_dirty
status
message
plugin_version
runtime_plugin_version
editor_plugin_version
last_seen_at
installed_at
updated_at
```

## `airstrike_animation_server_snapshots`

```text
id
server_id
based_on_revision
reason
snapshot_json LONGTEXT
sha256 CHAR(64)
changed_profile_keys_json
status
conflict_message nullable
received_at
imported_at nullable
imported_by nullable
```

Reasons include:

```text
bootstrap
local_save
manual_upload
sync_conflict
pre_overwrite_backup
```

Add appropriate indexes.

---

# 14. Website PHP service layer

Create an include/service module following existing repository conventions, for example:

```text
includes/airstrike-animations.php
```

It should own:

- Draft loading/saving.
- Validation.
- Normalization.
- Canonical JSON.
- SHA-256 hashing.
- Source compilation.
- Release-schedule compilation.
- Publishing.
- Revision queries.
- Server snapshot import.
- Sync receipt storage.
- Conflict detection.
- Audit logging.
- RCON notification orchestration.

Do not duplicate business logic across individual endpoint files.

Add it to the admin bootstrap only where needed.

---

# 15. Admin API endpoints

Follow current API and routing conventions. The exact file layout may be adapted.

Required capabilities:

```text
GET  /api/admin/airstrike-animations/list.php
GET  /api/admin/airstrike-animations/get.php
POST /api/admin/airstrike-animations/create.php
POST /api/admin/airstrike-animations/save.php
POST /api/admin/airstrike-animations/duplicate.php
POST /api/admin/airstrike-animations/archive.php
POST /api/admin/airstrike-animations/validate.php
POST /api/admin/airstrike-animations/compile-preview.php
POST /api/admin/airstrike-animations/publish.php
GET  /api/admin/airstrike-animations/revisions.php
POST /api/admin/airstrike-animations/restore-revision.php
GET  /api/admin/airstrike-animations/server-status.php
GET  /api/admin/airstrike-animations/server-snapshots.php
POST /api/admin/airstrike-animations/import-server-snapshot.php
POST /api/admin/airstrike-animations/discard-server-snapshot.php
```

Requirements:

- Existing admin authentication.
- Existing role/capability checks.
- CSRF protection on writes.
- JSON-only responses.
- Clear validation errors with field paths.
- Request-size limits.
- Optimistic concurrency.
- Audit all create/save/archive/publish/restore/import actions.
- No secrets in responses.

The `compile-preview` endpoint lets the browser compare its local compiler output against the PHP canonical compiler during development and testing. In production, publishing always uses the server-side compiler output as authoritative.

If the compiler is implemented in TypeScript only, run the same compiler in a controlled Node build/CLI from PHP or generate an equivalent deterministic PHP compiler with shared golden fixtures. Prefer a single compiler implementation callable by both browser tests and server publishing.

A practical approach is:

- TypeScript compiler package.
- Browser imports the package.
- `npm run build:compiler-cli` creates a Node CLI.
- PHP invokes the CLI with strict timeout and bounded input during publish.
- Production deployment includes Node only if the hosting environment supports it.

If production cannot invoke Node, implement a deterministic PHP compiler and require golden parity tests. Inspect deployment constraints before choosing.

---

# 16. Signed server API endpoints

Use existing bridge authorization.

## 16.1 Bundle endpoint

Suggested path:

```text
GET /api/server/airstrike-animation-bundle.php
```

Query:

```text
since=<installedRevision>
local_hash=<currentLocalFileSha256>
```

Response when update exists:

```json
{
  "ok": true,
  "has_update": true,
  "current_revision": 17,
  "published_at": "2026-07-10T18:00:00Z",
  "schema_version": 2,
  "compiler_version": "raidlands-airanim-1",
  "sha256": "...",
  "bundle": {
    "SchemaVersion": 2,
    "Profiles": {}
  }
}
```

No update:

```json
{
  "ok": true,
  "has_update": false,
  "current_revision": 17,
  "sha256": "..."
}
```

No published bundle yet:

```json
{
  "ok": true,
  "has_update": false,
  "current_revision": 0,
  "bootstrap_required": true
}
```

Headers:

```text
Cache-Control: no-store
ETag: "<bundle sha256>"
```

The plugin may use `If-None-Match`, but this is not recurring polling.

## 16.2 Sync receipt endpoint

Suggested path:

```text
POST /api/server/airstrike-animation-sync-result.php
```

Body:

```json
{
  "server_id": "raidlands-main",
  "revision": 17,
  "status": "installed",
  "installed_sha256": "...",
  "local_sha256": "...",
  "local_dirty": false,
  "plugin_version": "1.0.0",
  "runtime_plugin_version": "0.1.40",
  "editor_plugin_version": "0.2.0",
  "message": "Installed and reloaded 14 profiles."
}
```

Statuses include:

```text
checked_no_update
installed
install_failed
reload_failed_rolled_back
blocked_local_changes
snapshot_uploaded
rollback_installed
```

## 16.3 Snapshot endpoint

Suggested path:

```text
POST /api/server/airstrike-animation-snapshot.php
```

Body:

```json
{
  "server_id": "raidlands-main",
  "based_on_revision": 17,
  "reason": "local_save",
  "sha256": "...",
  "changed_profile_keys": [
    "attack_heli_rocket_run"
  ],
  "visual_profiles": {
    "SchemaVersion": 2,
    "Profiles": {}
  }
}
```

Behavior:

- Validate HMAC.
- Validate body hash.
- Validate schema.
- Store immutable snapshot.
- If website has no profiles and reason is `bootstrap`, automatically initialize drafts from it.
- If based-on revision matches current published revision and no conflicting website draft edits exist, safely update drafts.
- Otherwise mark as pending conflict.
- Never auto-publish a server snapshot.

## 16.4 Optional rollback bundle request

The normal bundle endpoint may support:

```text
revision=<specificRevision>
```

Only allow this for signed server requests and only when the game command explicitly requests rollback.

---

# 17. Website publishing transaction

Publishing must be atomic.

Within a database transaction:

1. Lock or otherwise protect current draft versions.
2. Load all non-archived profiles.
3. Validate every source profile.
4. Compile every profile.
5. Build complete runtime `VisualProfiles.json`.
6. Canonicalize it.
7. Calculate SHA-256.
8. Insert immutable per-profile revisions.
9. Insert immutable global bundle revision.
10. Update profile last-published references.
11. Commit.
12. Write audit record.

Only after commit:

13. If `Publish & Sync`, attempt one RCON notification.
14. Return publish result and RCON result separately.

RCON failure must not roll back a valid publication.

UI example:

```text
Published revision 17 successfully.
Automatic server notification failed: connection timeout.
The server has not been modified. Use /airanimsync -> SYNC NOW.
```

---

# 18. Rust WebRCON notification

## 18.1 Configuration

Add to `.env.example`:

```dotenv
RAIDLANDS_ANIMATION_RCON_ENABLED=false
RAIDLANDS_ANIMATION_RCON_HOST=
RAIDLANDS_ANIMATION_RCON_PORT=28016
RAIDLANDS_ANIMATION_RCON_PASSWORD=
RAIDLANDS_ANIMATION_RCON_SECURE=false
RAIDLANDS_ANIMATION_RCON_TIMEOUT_SECONDS=4
RAIDLANDS_ANIMATION_RCON_COMMAND=airanimsync.sync
```

Load these through `includes/config.php` using current environment conventions.

Do not send any RCON value to the browser.

## 18.2 Implementation rules

- Reuse an existing RCON helper if one exists.
- Otherwise create an isolated Rust WebRCON client.
- Use a maintained Composer-compatible WebSocket client if possible.
- Open one connection per publish notification.
- Authenticate.
- Send only the fixed command plus a validated integer revision.
- Wait for a bounded acknowledgement.
- Close.
- Use strict short timeouts.
- Do not retry indefinitely.
- Never log the password.
- Do not permit arbitrary browser-provided commands.
- Validate host and port from server-side config only.

The website command must be constructed only as:

```php
$command = $configuredFixedCommand . ' ' . (int) $publishedRevision;
```

---

# 19. New Oxide plugin: `WebsiteAirstrikeAnimationBridge`

## 19.1 Metadata

Suggested:

```csharp
[Info("WebsiteAirstrikeAnimationBridge", "Raidlands", "1.0.0")]
[Description("Event-driven signed synchronization between the Raidlands web animation editor and PortableAirstrikes visual profiles.")]
```

## 19.2 Plugin references

```csharp
[PluginReference] private Plugin PortableAirstrikes;
[PluginReference] private Plugin PortableAirstrikesAnimationEditor;
```

No hard dependency should prevent the bridge from loading.

## 19.3 Config

Default config:

```json
{
  "ApiBaseUrl": "https://raidlands.net",
  "ServerId": "raidlands-main",
  "SharedSecret": "${RAIDLANDS_BRIDGE_SHARED_SECRET}",
  "VisualProfilesDataFile": "PortableAirstrikes/VisualProfiles",
  "SyncOnServerInitialized": true,
  "StartupSyncDelaySeconds": 8,
  "EnableRecurringSync": false,
  "RecurringSyncIntervalSeconds": 21600,
  "AutoUploadLocalSaves": true,
  "BootstrapUploadIfWebsiteEmpty": true,
  "ProtectUnsyncedLocalChanges": true,
  "BackupCount": 20,
  "RequestTimeoutMilliseconds": 20000,
  "MaxBundleBytes": 20971520,
  "OpenPanelCommand": "airanimsync",
  "LogSuccessfulNoUpdateChecks": false
}
```

Rules:

- Clamp values.
- Require HTTPS unless an explicit development override exists.
- Normalize `ApiBaseUrl`.
- Resolve `${...}` from `Secrets.local`.
- Never write the resolved secret back into the public config.
- Never print the secret.
- Disable network actions with a clear error if required config is invalid.

## 19.4 State file

Store bridge state separately, for example:

```text
oxide/data/WebsiteAirstrikeAnimationBridge/State.json
```

Example:

```json
{
  "InstalledRevision": 17,
  "InstalledSha256": "...",
  "LastKnownPublishedRevision": 17,
  "LastCheckAtUtc": "...",
  "LastSyncAtUtc": "...",
  "LastStatus": "installed",
  "LastMessage": "...",
  "LastUploadedLocalSha256": "...",
  "LastInstalledProfileHashes": {
    "attack_heli_rocket_run": "..."
  }
}
```

Do not store secrets.

## 19.5 Backup directory

Use:

```text
oxide/data/WebsiteAirstrikeAnimationBridge/backups/
```

Backup names:

```text
VisualProfiles.rev-17.20260710T180000Z.<sha-prefix>.json
```

Also preserve the bridge state associated with a backup.

Prune only after a successful install and keep the configured number.

## 19.6 Permission

Register:

```text
websiteairstrikeanimationbridge.admin
```

Server console/RCON may invoke console commands.

Players require permission or server-admin status to use the CUI/chat command.

---

# 20. Bridge commands and CUI

## Chat command

```text
/airanimsync
```

Open an admin panel showing:

```text
Website current revision
Installed revision
Installed SHA
Current local SHA
Local dirty status
Last check
Last successful sync
Last status
Last message
PortableAirstrikes version/load state
Animation editor version/load state
```

Buttons:

```text
CHECK
SYNC NOW
UPLOAD LOCAL
FORCE PULL
ROLLBACK LAST
CLOSE
```

Require confirmation for:

```text
FORCE PULL
ROLLBACK
```

## Console/RCON commands

```text
airanimsync.status
airanimsync.check
airanimsync.sync [expectedRevision]
airanimsync.force [expectedRevision]
airanimsync.upload
airanimsync.rollback [last|revision]
```

`airanimsync.sync 17` must:

- Pull the website's current revision.
- Confirm it is at least 17.
- Refuse a lower revision.
- Install it if safe.
- Return a concise RCON-readable result.

Prevent concurrent sync operations with a lock/in-progress flag.

---

# 21. Signed HTTP implementation in the bridge

Reuse patterns from existing bridge plugins.

For every request:

1. Build the exact request URI including path and query.
2. Serialize body once.
3. Hash the exact serialized body bytes.
4. Build signature payload.
5. HMAC SHA-256 with shared secret.
6. Send timestamp and signature headers.
7. Enforce timeout.
8. Bound response size.
9. Parse JSON safely.
10. Validate `ok`.

Use invariant culture for timestamps and numeric values.

Do not accidentally sign a different URI than the one sent.

Use UTF-8 without a BOM for request bodies.

---

# 22. Atomic install workflow

Implement this exact safety sequence.

1. Reject if another sync is active.
2. Read the current target file bytes.
3. Calculate current local SHA-256.
4. Compare current SHA with `InstalledSha256`.
5. If different and protection is enabled:
   - Mark local dirty.
   - Upload a conflict snapshot once.
   - Block normal sync.
   - Return `blocked_local_changes`.
6. Download bundle.
7. Enforce response-size limit.
8. Verify declared bundle SHA against canonical received bundle.
9. Parse into the same data classes used by the runtime.
10. Validate schema and all profile values.
11. Write incoming JSON to a temporary file in the same directory.
12. Flush and close it.
13. Read and parse the temporary file again.
14. Create a backup of the current target file.
15. Move/replace the target atomically where supported.
16. Reload both consuming plugins.
17. If either required reload fails:
   - Move failed new file aside.
   - Restore backup.
   - Reload old file.
   - Post `reload_failed_rolled_back`.
18. If successful:
   - Update bridge state.
   - Prune backups.
   - Post `installed`.
19. Release the sync lock.

Do not call `oxide.reload` on the full plugins as the normal reload method.

Active strikes must continue using the profile snapshot they started with. New strikes use the newly loaded profiles.

---

# 23. Runtime and editor reload APIs

Add or reuse explicit APIs.

## `PortableAirstrikes`

Required equivalent API:

```csharp
[HookMethod(nameof(API_ReloadVisualProfiles))]
public object API_ReloadVisualProfiles()
```

Behavior:

- Load the data file into a temporary object.
- Validate it.
- Only replace in-memory profile state after successful validation.
- Return structured information or a dictionary:
  ```text
  success
  profileCount
  schemaVersion
  message
  ```
- Do not interrupt active calls.
- Log useful errors.

Also provide an optional status API:

```csharp
API_GetVisualProfileStatus()
```

## `PortableAirstrikesAnimationEditor`

Required equivalent APIs:

```csharp
API_ReloadProfiles()
API_SaveProfiles()
API_GetProfilesJson()
API_GetProfileStatus()
```

If equivalent APIs already exist, reuse them.

Reload must:

- Warn/handle open unsaved sessions.
- The bridge-triggered reload should not silently overwrite unsaved in-memory editor changes.
- If unsaved sessions exist, return a conflict result unless force was explicitly chosen.
- A forced website pull must close or invalidate those sessions with clear admin notification.

---

# 24. Compiled-track support in Rust

Add optional classes matching the new JSON:

```csharp
private class CompiledVisualTrack
{
    public string CompilerVersion;
    public string SourceHash;
    public string CoordinateSystem;
    public float SampleRateHz;
    public float SampleIntervalSeconds;
    public float DurationSeconds;
    public List<CompiledVisualFrame> Frames;
}

private class CompiledVisualFrame
{
    public float Time;
    public float X;
    public float Y;
    public float Z;
    public float Qx;
    public float Qy;
    public float Qz;
    public float Qw;
}
```

Add to profile:

```csharp
public CompiledVisualTrack CompiledTrack;
public List<VisualPayloadEvent> CompiledReleaseEvents;
```

Validation:

- At least two frames.
- Sorted times.
- First time approximately zero.
- Last frame approximately duration.
- Finite values.
- Normalizable quaternions.
- Supported coordinate-system string.
- Frame count within limit.
- No duplicate or decreasing times.

Evaluation:

- Prefer compiled frames.
- Use fast fixed-rate indexing where possible.
- Fall back to binary search for nonuniform data.
- Lerp position.
- Slerp rotation.
- Apply target/approach basis.
- Apply terrain clearance after transforming.
- Use compiled release events when valid.

Add diagnostics showing whether a profile is using:

```text
compiled-v2
legacy-v1
fallback-because-invalid
```

---

# 25. In-game edits and compiled-track invalidation

The in-game editor may still modify legacy waypoint/source fields.

When it changes a profile that contains a compiled track:

1. Mark that profile locally dirty.
2. Clear its `CompiledTrack` and `CompiledReleaseEvents`, or mark them invalid with a source-hash mismatch.
3. Continue preview/runtime through legacy fallback.
4. Save.
5. Emit the save hook.
6. Bridge uploads the snapshot once.
7. Website imports it into a draft.
8. The next website publication recompiles it.

Never keep using compiled data after its source fields were modified.

Show an in-game warning:

```text
This profile was changed in Rust. Its web-compiled track is now stale.
The server is using legacy evaluation until the updated draft is published.
```

---

# 26. Bootstrap with no manual import

On the bridge's first startup check:

## Website has a published bundle

- Pull and install it normally.

## Website has no published bundle and local file exists

- Keep the local file active.
- Post it to the snapshot endpoint with:
  ```text
  reason = bootstrap
  ```
- The website automatically initializes profile drafts from the snapshot if its animation tables are empty.
- Mark the website as `Drafts imported from raidlands-main; not yet published`.

## Neither has profiles

- Create a valid empty/default file only if the current plugins require one.
- Website displays an empty profile list.
- Admin creates profiles in the browser.

This process must not require downloading and re-uploading JSON by hand.

---

# 27. Local-change detection and conflict handling

The bridge must protect local work.

A local file is dirty when:

```text
currentLocalSha256 != state.InstalledSha256
```

and the current hash is not the last known uploaded snapshot hash.

Normal sync behavior when dirty:

- Do not overwrite.
- Upload a `sync_conflict` snapshot once.
- Post a blocked receipt.
- Show conflict in website admin.
- Show conflict in `/airanimsync`.

Website conflict UI must allow:

```text
Open server snapshot
Compare profile list/hashes
Import selected server profiles into drafts
Discard snapshot
Publish merged result
```

`FORCE PULL` may overwrite after confirmation and after ensuring the current local file is backed up and uploaded.

---

# 28. Profile validation

Validate on browser save, server save, publish, game download, and runtime load.

At minimum:

- Profile key uses a safe pattern such as:
  ```text
  ^[a-z0-9][a-z0-9._-]{0,99}$
  ```
- Vehicle is supported.
- Duration is finite and within allowed limits.
- At least two waypoints for vehicle routes.
- Waypoint times are finite, sorted, and unique.
- Waypoint coordinates are finite and bounded.
- Rotation values are finite.
- Do not normalize continuous rotation.
- First waypoint time is zero or is normalized explicitly with warning.
- Last waypoint time does not exceed duration.
- Release event times are within duration.
- Counts are positive and bounded.
- Repeated interval is positive.
- Maximum units are positive and bounded.
- Payload type is supported.
- All optional numeric payload fields are finite and bounded.
- Dictionary keys are safe.
- Compiled frames pass validation.
- Total serialized bundle is within configured size.

Suggested defaults:

```text
Maximum profiles:              500
Maximum waypoints/profile:     256
Maximum release events/profile: 2000
Maximum duration:              120 seconds
Maximum compiled frames/profile: 6000
Maximum bundle bytes:          20 MiB
```

Use current practical game limits where stricter.

Return validation paths such as:

```text
Profiles.attack_heli_rocket_run.Waypoints[4].Time
```

---

# 29. Canonical JSON and hashing

Create one canonicalization definition.

Requirements:

- UTF-8.
- Stable object-key ordering where practical.
- Stable profile-key ordering.
- Stable waypoint/release ordering.
- Invariant numeric formatting.
- No insignificant random whitespace in hashed content.
- No negative zero.
- No non-finite values.
- Hash exact canonical runtime bundle bytes with SHA-256.

The website stores:

```text
bundle revision
canonical bundle
bundle SHA-256
```

The plugin verifies the same bytes or a precisely defined canonicalized representation.

Do not hash pretty-printed JSON on one side and minified JSON on the other without a shared rule.

The installed game file may be pretty-printed for administration, but its state must record the SHA of the canonical semantic bundle and, optionally, the physical-file SHA separately.

---

# 30. Server status in the website

The editor and management page must show:

```text
Published revision: 17
Published hash: abc123...
raidlands-main installed revision: 17
Server status: Installed
Last seen: ...
Last installed: ...
Local file: Clean
Plugin: WebsiteAirstrikeAnimationBridge 1.0.0
Runtime: PortableAirstrikes ...
Editor: PortableAirstrikesAnimationEditor ...
```

Possible states:

```text
Not configured
Never contacted
Up to date
Published, waiting for sync
Sync failed
Local changes pending
Conflict
Rollback active
```

After `Publish & Sync`, the browser may briefly poll the website's server-status endpoint to see the receipt. This is browser-to-website polling and is acceptable. The game must still make only the single requested sync call.

---

# 31. Security requirements

- Reuse current admin authentication.
- Use CSRF on admin writes.
- Use existing HMAC bridge authorization.
- Enforce timestamp skew.
- Use constant-time signature comparison.
- Never expose shared secret to JavaScript.
- Never expose RCON password to JavaScript.
- Never log either secret.
- Restrict RCON command to the fixed sync command.
- Validate revision as integer.
- Enforce request and response size limits.
- Enforce API timeouts.
- Escape all admin-rendered values.
- Reject malformed JSON.
- Reject non-finite numbers.
- Sanitize profile keys.
- Do not permit arbitrary filesystem paths from API data.
- Hardcode/validate the target data-file name.
- Keep backups outside webroot.
- Do not allow public access to draft/revision JSON.
- Audit publish, force sync, snapshot import, and rollback.
- Rate-limit signed snapshot uploads and admin publish actions reasonably.
- Do not make the game server listen on a new public HTTP port.

---

# 32. Failure handling

Every network and file failure must leave the current working game file intact.

Handle:

- Website unavailable.
- DNS failure.
- HTTP timeout.
- Invalid HMAC response context.
- HTTP non-200.
- Truncated body.
- Oversized body.
- Invalid JSON.
- Wrong schema.
- Hash mismatch.
- Missing profiles.
- Invalid compiled track.
- Disk write failure.
- Backup failure.
- Rename/replace failure.
- Runtime reload failure.
- Editor reload conflict.
- RCON unavailable.
- Website database transaction failure.
- Duplicate publish request.
- Concurrent sync request.

No error should delete the only valid `VisualProfiles.json`.

---

# 33. Tests

## 33.1 Shared golden fixtures

Create fixture profiles for:

```text
straight constant-speed pass
curved pass
StopAtWaypoints true
StopAtWaypoints false
360-degree barrel roll
540-degree barrel roll
pitch-down target attack
manual release schedule
repeated release schedule
non-even repeated total
alternating hardpoints
90-degree approach basis rotation
negative/positive Z crossing target
```

For each fixture, store expected sampled values at selected times.

## 33.2 TypeScript tests

Test:

- Coordinate conversion.
- Hermite interpolation.
- Stop-at-waypoint interpolation.
- Continuous Euler interpolation.
- Quaternion sign continuity.
- Compiled frame generation.
- Release schedule expansion.
- Hardpoint materialization.
- Timeline sorting.
- Validation.
- Undo coalescing.
- Source-to-runtime compilation.
- Canonical output stability.

## 33.3 PHP tests

Test:

- Admin authorization.
- CSRF.
- Draft optimistic concurrency.
- Validation errors.
- Publish transaction.
- Revision immutability.
- Canonical hash.
- Bridge HMAC authorization.
- Snapshot ingestion.
- Conflict detection.
- Receipt storage.
- RCON command construction.
- RCON failure not rolling back publish.

Use the project's existing test style. If no formal PHP test framework exists, add focused executable test scripts that can run in CI without production credentials.

## 33.4 C# verification

Move deterministic compiled-track evaluation into small pure helper methods.

Test or verify through a compile harness where possible:

- Frame validation.
- Frame interpolation.
- Basis transformation.
- Quaternion continuity.
- Release event selection.
- Dirty-file detection.
- HMAC construction.
- Atomic replacement logic with temporary directories.
- Rollback after simulated reload failure.

At minimum, add reproducible fixtures and an admin diagnostic command that evaluates known frames.

## 33.5 End-to-end acceptance test

1. Start with existing local `VisualProfiles.json`.
2. Install bridge with secret placeholder.
3. Website has no animation records.
4. Server startup automatically uploads bootstrap snapshot.
5. Website drafts appear without manual import.
6. Open profile in browser.
7. Move a waypoint.
8. Set a 360-degree barrel roll.
9. Drag release time.
10. Save draft.
11. Publish & Sync.
12. Website sends one RCON command.
13. Bridge downloads once.
14. File is backed up and replaced.
15. Runtime/editor reload.
16. Website receives installed receipt.
17. Server status shows up to date.
18. Preview in Rust matches compiled browser timing.
19. Make a game-side calibration change and save.
20. Bridge uploads one snapshot.
21. Website shows server draft/pending change.
22. Import it, republish, and resync.
23. Roll back to previous revision successfully.

---

# 34. Build and deployment

## Website

Expected commands, adapted to repository tooling:

```bash
composer install
npm ci
npm run test
npm run build
php migration-runner.php
```

Commit source files and whatever production assets the repository's deployment model requires.

Document:

- Required PHP extensions.
- Node version for builds.
- Whether Node is needed only at build time or also at publish time.
- Migration command.
- Writable/cache directories.
- RCON environment variables.
- How to disable RCON and use manual sync.

## Rust

Install:

```text
oxide/plugins/WebsiteAirstrikeAnimationBridge.cs
```

Update the current:

```text
oxide/plugins/PortableAirstrikes.cs
oxide/plugins/PortableAirstrikesAnimationEditor.cs
```

Expected config:

```text
oxide/config/WebsiteAirstrikeAnimationBridge.json
```

Expected secret:

```text
oxide/config/Secrets.local.json
```

Grant permission as needed:

```text
oxide.grant group admin websiteairstrikeanimationbridge.admin
```

Document commands:

```text
/airanimsync
airanimsync.status
airanimsync.sync
airanimsync.upload
airanimsync.rollback last
```

---

# 35. Implementation order

Follow this sequence to reduce integration risk.

## Phase 1: repository reconnaissance

- Confirm current files and versions.
- Confirm admin architecture.
- Confirm database/migrations.
- Confirm bridge HMAC helper.
- Confirm plugin secret resolver.
- Confirm current runtime profile loader.
- Confirm current in-game editor save/reload APIs.
- Confirm Rust WebRCON accessibility/deployment constraints.

## Phase 2: schema and golden fixtures

- Define source schema.
- Add schema 2 optional runtime fields.
- Implement deterministic compiler.
- Add fixtures/tests.
- Add C# compiled-track evaluator.
- Prove browser/compiler/runtime parity before UI work.

## Phase 3: website persistence and APIs

- Migration.
- Service layer.
- Draft APIs.
- Publish transaction.
- Server bundle endpoint.
- Snapshot endpoint.
- Receipt endpoint.
- Admin status/revision UI.

## Phase 4: browser editor

- Vite/TypeScript scaffold.
- Three.js scene.
- Waypoint editing.
- Timeline.
- Release editor.
- Undo/redo.
- Save/autosave/conflicts.
- Compile preview.
- Publish controls.

## Phase 5: bridge plugin

- Config/secrets.
- HMAC client.
- State.
- Startup check.
- Manual CUI.
- Pull/install/backups.
- Reload.
- Receipts.
- Snapshot upload.
- Conflict protection.
- Rollback.

## Phase 6: RCON event trigger

- One-shot website WebRCON.
- Publish & Sync.
- Failure messaging.
- Status receipt display.

## Phase 7: end-to-end hardening

- Bootstrap.
- Game-side save hook.
- Conflict workflow.
- Force pull.
- Rollback.
- Error simulation.
- Documentation.

---

# 36. Acceptance criteria

The task is complete only when all of these are true.

## Editor

- A profile can be created entirely in the website.
- Waypoints can be moved and rotated with gizmos.
- Exact numeric input works.
- The timeline scrubs the vehicle accurately.
- Waypoint times are draggable.
- Release times are draggable.
- Manual release mode works.
- Repeated release mode works.
- A 360/540-degree roll is preserved.
- Browser preview can switch to exact compiled frames.
- Undo/redo works.
- Draft autosave and concurrency protection work.
- Publish creates immutable revisions.
- Older revisions can be restored as new drafts/publications.

## Sync

- Normal operation requires no manual JSON import.
- First setup can bootstrap from the server file automatically.
- Publish & Sync sends one RCON command.
- The game performs one bundle pull.
- Default recurring polling is disabled.
- Startup performs only one delayed recovery check.
- Manual Sync Now works.
- Local game saves cause one snapshot upload.
- Local unsynced changes are not overwritten silently.
- The correct file is updated:
  ```text
  oxide/data/PortableAirstrikes/VisualProfiles.json
  ```
- Existing file is backed up.
- Replacement is safe.
- Runtime and editor reload without full server restart.
- Reload failure restores the prior file.
- Website shows installed revision and result.
- Rollback works.

## Security

- Plugin resolves the shared secret from `Secrets.local.json`.
- Real secrets are not committed.
- Secrets are not logged.
- Server endpoints require valid HMAC.
- Admin endpoints require auth and CSRF.
- RCON password never reaches the browser.
- Arbitrary RCON commands cannot be submitted.

## Quality

- Website build succeeds.
- TypeScript checks succeed.
- Tests pass.
- C# plugins compile against the target Oxide/Rust environment.
- No duplicate command attributes.
- No missing helper methods.
- No TODO-only features.
- No silent destructive fallback.

---

# 37. Non-goals

Do not expand the project into:

- A full Rust terrain/world replica.
- A browser-based Rust game client.
- Exact browser simulation of all Rust projectile physics.
- Constant polling from the game.
- A public endpoint that writes directly to the game server.
- A new secret-management system.
- A persistent website-to-game WebSocket.
- Automatic publication of unreviewed game-side changes.
- Dangerous live payload firing from the browser.
- Replacing the existing Raidlands website stack.

---

# 38. Required final Codex report

After implementation, report:

1. Summary of architecture implemented.
2. Exact files added.
3. Exact files modified.
4. Database migration added and how to run it.
5. Website build/test commands and results.
6. C# compile/test results.
7. New environment variables.
8. New Oxide config.
9. Required secrets-file entry.
10. New permissions and commands.
11. Bootstrap steps.
12. Publish & Sync workflow.
13. Manual fallback workflow.
14. Rollback workflow.
15. Any deployment limitation that could not be tested locally.
16. No claims of success for anything not actually verified.

Do not merely restate this specification. Implement it.
