# RustRelay tree multi-LOD workflow

Raidlands builds runtime tree assets from the sibling `RustRelay.Assets` checkout pinned to revision `494242b`. Tree placement remains deterministic because the current terrain payload does not publish resource entity coordinates. Rendering and placement are deliberately separate so authoritative tree positions can replace the placement policy later.

## Families and generation

`scripts/tree-lod-recipes.ts` registers representative full-size trees for temperate, tundra, arctic, arid, tropical, jungle, and swamp biomes. Palms, snow trees, and dead trees are included; saplings, bushes, ferns, and cacti remain outside this full-size tree layer.

Generate or validate all three textured tiers with:

```powershell
npm run trees:lod
npm run trees:lod:check
```

Generated Map, Mid, and Close GLBs and their versioned manifest live in `assets/media/models/trees-lod/`. Map uses real RustRelay geometry with a 128px texture ceiling, Mid uses 256px textures, and Close uses 512px textures. Geometry targets retain approximately 14%, 42%, and 88% of the source vertices respectively, subject to mesh topology and simplification error limits.

## Runtime policy

The terrain payload's fallback colours distinguish only land from water, so they are not a reliable biome source. Once the aligned current-map texture loads, the viewer samples and locally smooths that texture into a surface-colour grid. The placement policy combines that grid with elevation, height above water, slope, and deterministic seeded noise, then chooses a weighted model variant for the resulting biome. Placements are grouped into instanced draw calls by model and tier.

Desert placement is intentionally sparse and limited to low-lying palms. Snow-like surfaces always select snow-covered arctic families. Saturated green regions prefer jungle/tropical families; swamp trees require a rare, low shoreline condition and cannot take over a general jungle region.

- Map is the normal distant tier and always uses a textured RustRelay asset.
- Mid promotes within 650 world units, capped by environment quality.
- Close promotes within 180 world units, capped more tightly and receives shadows on High and Ultra.
- A requested tier retains the best loaded lower tier while decoding.
- The old procedural trunk/canopy geometry is hidden during normal operation and becomes visible only if a required Map model fails.

The viewer root reports tree manifest and recipe versions, RustRelay revision, active instance counts by tier, loaded assets, failures, decode queue depth, and fallback state through `data-tree-*` diagnostics.
