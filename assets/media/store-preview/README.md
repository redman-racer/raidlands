# Store preview assets

The GLB files in `models/` are curated, web-optimized reference models copied from the local
`RustRelay.Assets` repository for Raidlands store previews. They remain subject to the
[Facepunch Terms of Service](https://facepunch.com/legal/tos) described by that repository.
Raidlands is not affiliated with Facepunch Studios.

The files in `draco/` are the Three.js r166 Draco decoder distribution and are self-hosted so
the preview does not depend on a third-party CDN.

Add new models deliberately: copy only a mapped world/deployed model, give it a stable filename,
and register it in `includes/store-preview.php`. Missing mappings must continue to render the
existing Rust item icon rather than fail the complete scene.
