# RustRelay monument multi-LOD workflow

Raidlands builds monument runtime assets from the sibling `RustRelay.Assets` checkout. The audited source revision is `494242b`; generated assets remain subject to the RustRelay/Facepunch provenance of their source and are not standalone original Raidlands assets.

## Source and recipes

- `scripts/monument-lod-recipes.ts` is the versioned transform authority for all 78 registered monument prefab families.
- `data/rustrelay-asset-catalog.json` inventories the 9,098 GLBs at the pinned source revision and validates every layout or standalone override path.
- Each recipe defines its layout source, structural roles, exterior exclusions, size class, review state, named structural selections, and any standalone component placements.
- Abandoned Military Base hangars, tents, containers, sandbags, generators, fuel tanks, and MLRS placements live in these recipes. The shared viewer contains no monument-specific assembly logic.

Refresh or validate the source catalog with:

```powershell
npm run monuments:catalog
npm run monuments:catalog:check
```

The catalog command refuses to run when the sibling checkout is not at the pinned revision. When the revision is intentionally advanced, update the recipe revision only after reviewing the catalog diff. An approval is valid only while its recorded source SHA-256 still matches.

## Generation

`npm run monuments:lod` generates `Map`, `Mid`, and `Close` GLBs under `assets/media/models/monuments-lod/` plus a versioned manifest containing URLs, SHA-256 hashes, byte sizes, triangles, draw calls, bounds, structural selections, exclusions, budgets, and review status. `npm run monuments:lod:parallel` runs those same isolated recipe builds through a bounded three-process queue and reconciles the deterministic manifest afterward.

The generator selects structural components before simplification, keeps component transforms from the full layout GLB, applies standalone overrides from the recipe, simplifies components independently, and only then joins compatible materials. Map uses a texture-free palette; Mid and Close always retain WebP textures and progressively reduce their maximum texture resolution before reducing geometry. They never silently fall back to an untextured palette.

Validation commands:

```powershell
npm run monuments:lod:check
npm run typecheck
npm test
npm run build
```

## Contact sheets and approval

`npm run monuments:lod:review` creates one fixed contact sheet per recipe in `assets/media/models/monuments-lod/review/`. Every sheet contains source structural selection, Map, Mid, and Close from top-down, two isometric angles, and a low angle, with metrics and exclusions. The review index is bound to the exact manifest and sheet hashes.

Review decisions are recorded only after current contact sheets exist:

```powershell
npm run monuments:lod:approve -- --approve=airfield_1
npm run monuments:lod:approve -- --reject=airfield_1
npm run monuments:lod:approve -- --approve-all
npm run monuments:lod -- --manifest-only
npm run monuments:lod:review
```

Only an `approved` entry uses its generated tiers by default. Candidate or rejected entries retain their legacy paths. If a source hash changes, the generator returns that entry to `candidate` until its new contact sheet is reviewed.

## Runtime policy

Home and Server load the same `server-map-viewer.js` bundle and the same monument manifest.

- Map: below 80 projected pixels.
- Mid: 80 to 220 projected pixels.
- Close: above 220 projected pixels or focused.
- Preloading begins 20 percent before promotion; 20 percent hysteresis prevents rapid demotion and swapping.
- Map LOD never promotes. Auto follows projected size. Detailed prioritizes the nearest or focused monuments for Close.
- Low, Medium, High, and Ultra cap Close at 1/1/2/3 and Mid at 3/5/8/12, with total triangle budgets of 0.75/1.25/2/3 million and draw-call budgets of 500/650/800/1,000.
- A failed or pending tier retains the best successfully loaded lower tier or procedural fallback, so a monument never disappears.

The viewer root exposes active asset names, Map/Mid/Close counts, active and loaded bytes, triangles, draw calls, decode queue depth, failures, manifest version, recipe version, and RustRelay revision through `data-monument-*` diagnostics.
