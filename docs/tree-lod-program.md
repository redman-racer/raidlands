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

The terrain placement policy assigns a biome using terrain colour, elevation, height above water, slope, and deterministic seeded noise. It then chooses a weighted model variant for that biome. Placements are grouped into instanced draw calls by model and tier.

- Map is the normal distant tier and always uses a textured RustRelay asset.
- Mid promotes within 650 world units, capped by environment quality.
- Close promotes within 180 world units, capped more tightly and receives shadows on High and Ultra.
- A requested tier retains the best loaded lower tier while decoding.
- The old procedural trunk/canopy geometry is hidden during normal operation and becomes visible only if a required Map model fails.

The viewer root reports tree manifest and recipe versions, RustRelay revision, active instance counts by tier, loaded assets, failures, decode queue depth, and fallback state through `data-tree-*` diagnostics.
