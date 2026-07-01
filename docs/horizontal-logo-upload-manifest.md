# Horizontal Logo Upload Manifest

Upload these files with the horizontal logo rollout:

- `assets/media/horizontal-logo-xxsm.webp`
- `assets/media/horizontal-logo-xsm.webp`
- `assets/media/horizontal-logo-sm.webp`
- `assets/media/horizontal-logo-med.webp`
- `assets/media/horizontal-logo-lrg.webp`
- `includes/footer.php`
- `admin/index.php`
- `assets/css/styles.css`

Rust server plugin handoff:

- Upload `server-plugins/WebsiteVipBridge.cs` to the uMod/Oxide plugins folder if you want the plugin default `NavLogo` to use `/assets/media/horizontal-logo-sm.webp`.

Existing cache note:

- If the live site has cached CSS or image responses, hard refresh after upload so the new `srcset` and sizing rules are used.
