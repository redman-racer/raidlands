# Horizontal Logo Upload Manifest

Upload these files with the horizontal logo rollout:

- `assets/media/horizontal-logo-xxsm.webp`
- `assets/media/horizontal-logo-xsm.webp`
- `assets/media/horizontal-logo-sm.webp`
- `assets/media/horizontal-logo-med.webp`
- `assets/media/horizontal-logo-lrg.webp`
- `assets/media/in-game/raidlands-footer-logo.png`
- `includes/footer.php`
- `admin/index.php`
- `assets/css/styles.css`

Rust server plugin handoff:

- Upload `server-plugins/WebsiteVipBridge.cs` to the uMod/Oxide plugins folder if you want the plugin default `SimpleLogo` to use the website menu/nav logo.
- Upload `server-plugins/WebsiteVipBridge.config.example.json` if you keep server config examples mirrored from the website repo.

Existing cache note:

- If the live site has cached CSS or image responses, hard refresh after upload so the new `srcset` and sizing rules are used.
