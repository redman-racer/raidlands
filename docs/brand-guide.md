# Raidlands Brand Guide

This guide is derived from the current repository, not from an external brand book. Treat the files named here as the source of truth when updating the public website, admin UI, and Rust/Oxide plugin branding.

## Brand Position

Raidlands is a high-rate Rust server brand built around fast raids, repeat wipes, battlefield momentum, and a hardened industrial look.

Use copy that feels direct, competitive, and player-facing. Avoid internal implementation terms in public pages, such as MySQL, Oxide, bridge sync, config mappings, or plugin names, unless the page is explicitly admin or developer documentation.

Default public identity:

- Name: `Raidlands 1000x`
- Short name: `Raidlands`
- Tagline: `Raid. Respawn. Rebuild. Repeat.`
- Connect command: `connect raidlands.net:25607`
- Discord invite: `https://discord.gg/N6wnHzMhWS`

The defaults live in `includes/config.php`. Admin content edits write overrides to `data/site-content.json` when that file exists.

## Logo System

Primary website mark:

- `assets/media/raidlands-logo.webp` is used in the site header, page heroes, and loader payload.
- `assets/media/raidlands-logo.png` is the heavier PNG source/reference version.

Horizontal footer/admin mark:

- `assets/media/horizontal-logo-xxsm.webp`
- `assets/media/horizontal-logo-xsm.webp`
- `assets/media/horizontal-logo-sm.webp`
- `assets/media/horizontal-logo-med.webp`
- `assets/media/horizontal-logo-lrg.webp`

In-game optimized marks:

- `assets/media/in-game/raidlands-simple-logo.png`
- `assets/media/in-game/raidlands-footer-logo.png`

Supporting logo files:

- `assets/media/nav-logo.png`
- `assets/media/nav-logo.webp`
- `assets/media/og-image.png`

Usage notes:

- Use WebP on the website when a WebP asset exists.
- Keep PNG copies available for Rust UI plugins and integrations that are more reliable with PNG.
- Use the horizontal logo where width is available, especially footer, admin header, and broad panels.
- Do not point Rust UI configs at local filesystem paths. Store web-relative paths such as `/assets/media/raidlands-logo.png`.

## Color Palette

Website CSS tokens are defined in `assets/css/styles.css`.

Core darks:

- `--bg`: `#050607`
- `--bg-2`: `#0b0d0e`
- `--panel`: `#101214`
- `--panel-2`: `#171b1e`
- `--black`: `#000`

Industrial neutrals:

- `--steel`: `#56616a`
- `--steel-dim`: `#2a3238`
- `--white`: `#f3eee3`
- `--muted`: `#b5aaa0`
- `--dim`: `#80766d`

Accents:

- `--orange`: `#ff8a28`
- `--orange-dark`: `#c95722`
- `--red`: `#b3261e`
- `--yellow`: `#ffd166`
- `--green`: `#7cff6b`

Rust/Oxide bridge values:

- `PrimaryRed`: `#ff3b3b`
- `AccentGold`: `#ffd166`
- `DarkPanel`: `#151719`
- `MutedButton`: `#3a3d3f`

Usage notes:

- Build most surfaces from dark panels, steel borders, and off-white text.
- Use orange for heat, active states, and raid-energy emphasis.
- Use yellow/gold for values, rewards, and highlight metrics.
- Use green sparingly for live, ready, success, or online states.
- The website red token and bridge `PrimaryRed` are not identical; keep each value unless intentionally doing a cross-surface color pass.

## Typography

The website imports Google fonts in `assets/css/styles.css`:

- `Teko` for display and large condensed headings.
- `Barlow Condensed` for body/UI text.

CSS font stacks:

- `--font-display`: `"Teko", "Bahnschrift SemiCondensed", "Bahnschrift", "Arial Narrow", Impact, Arial, sans-serif`
- `--font-body`: `"Barlow Condensed", "Bahnschrift SemiCondensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", Arial, sans-serif`
- `--font-countdown`: `"Barlow Condensed", "Teko", "Bahnschrift SemiCondensed", "Arial Narrow", Impact, Arial, sans-serif`

Usage notes:

- Prefer condensed, uppercase-capable headings.
- Keep UI labels short and scannable.
- Use the countdown stack for wipe timers, numbers, and stat-heavy display blocks.
- Avoid mixing in unrelated serif or rounded brand fonts.

## Visual Texture

The site look comes from dark industrial surfaces, metal texture, scanline overlays, plate seams, ember effects, and high-contrast game imagery.

Core texture assets:

- `assets/media/nav-burnt-metal-base.webp`
- `assets/media/nav-plate-seams.webp`
- `assets/media/nav-active-ember.webp`
- `assets/media/texture-metal.svg`
- `assets/media/texture-grunge.svg`
- `assets/media/plate-seams.svg`
- `assets/media/section-divider.svg`
- `assets/media/console-scan.svg`

Hero and background assets:

- `assets/media/website-hero-raid-overlook-v4.webp`
- `assets/media/header-bg-rust-v2.webp`
- `assets/media/header-bg-rust-v2.png`
- `assets/media/pattern-bg.webp`
- `assets/media/wipe-day-rust-v2.webp`
- `assets/media/wipe-countdown-panel-v2.jpg`

UI shape tokens:

- `--radius`: `6px`
- `--cut`: `14px`
- `--shadow`: `0 18px 60px rgba(0, 0, 0, .55)`

Usage notes:

- Keep surfaces sharp, compact, and metal-like.
- Use small radii, hard borders, clipped/cut corners, and layered inner lines.
- Do not replace the brand feel with soft SaaS cards, pastel palettes, or generic game gradients.
- Favor actual Rust/raid imagery and branded media over abstract decoration.

## Feature Icons

Feature icons live in `assets/media/feature-icons/`. Most have both PNG and WebP versions.

Common bridge/web feature keys:

- Backpacks: `backpacks.png`
- Kits: `kit.png`
- Teleport: `teleport.png`
- Clan: `clan.png`
- Skinbox: `skinbox.png`
- Fast raids: `fast-raids.png`
- Gather: `gather.png`
- Stats: `stats.png`
- Search: `search.png`

Other available icons include `active-staff`, `appeal`, `ban`, `command`, `events`, `evidence`, `fix`, `id`, `mini`, `performance`, `play`, `pvp`, `risk`, `role`, `safe`, and `shop`.

Usage notes:

- Prefer WebP for website rendering.
- Prefer PNG where third-party Rust UI plugins expect PNG or have unreliable WebP handling.
- Keep icon names stable when they are referenced by `WebsiteVipBridge`.

## Website Implementation

Primary edit points:

- `assets/css/styles.css`: palette, typography stacks, textures, visual rhythm, responsive layout.
- `includes/config.php`: default site identity, tagline, server details, connect URLs, and content override loading.
- `includes/header.php`: page meta, Open Graph image, favicon links, and header logo.
- `includes/footer.php`: horizontal footer logo and footer copy.
- `includes/helpers.php`: loader payload and reusable page hero markup.
- `admin/index.php`: admin content fields for public brand text.

Content rules:

- Public pages should sound player-facing and live, not scaffold-like or technical.
- Admin pages can describe operational details, but should still avoid unexplained plugin jargon where a guided label is clearer.
- The admin "Server name" field changes website copy. It does not rename the Rust server itself.

## Rust/Oxide Brand Sync

`server-plugins/WebsiteVipBridge.cs` is the central bridge seam for Rust-side brand sync.

Default asset keys:

- `Logo`: `/assets/media/raidlands-logo.png`
- `NavLogo`: `/assets/media/nav-logo.png`
- `SimpleLogo`: `/assets/media/raidlands-logo.png`
- `Hero`: `/assets/media/website-hero-raid-overlook-v4.webp`
- `Header`: `/assets/media/header-bg-rust-v2.png`
- `CommandMenu`: `/assets/media/in-game/raidlands-command-menu-bg.png`
- `WipePanel`: `/assets/media/wipe-countdown-panel-v2.jpg`
- `BackpacksIcon`: `/assets/media/feature-icons/backpacks.png`
- `KitsIcon`: `/assets/media/feature-icons/kit.png`
- `TeleportIcon`: `/assets/media/feature-icons/teleport.png`
- `ClanIcon`: `/assets/media/feature-icons/clan.png`
- `SkinboxIcon`: `/assets/media/feature-icons/skinbox.png`
- `FastRaidsIcon`: `/assets/media/feature-icons/fast-raids.png`
- `GatherIcon`: `/assets/media/feature-icons/gather.png`
- `StatsIcon`: `/assets/media/feature-icons/stats.png`
- `SearchIcon`: `/assets/media/feature-icons/search.png`

Config rules:

- Keep `Website Asset Base Url` set to `https://raidlands.net` for live server configs.
- Store asset values as web-relative paths, then let the bridge resolve them to absolute URLs.
- Leave existing `http://` or `https://` asset values alone only when intentionally overriding with a full URL.
- Never use `file://` paths or `C:\...` paths in Rust UI configs.

The current bridge brand pass writes to the configured plugin files for `SimpleLogo`, `ServerInfo`, `ServerPop`, `SmartChatBot`, `Kits`, `DiscordWipe`, and `Scoreboards`.

## Change Checklist

When changing logo or visual identity:

- Update the source asset in `assets/media/`.
- Generate website WebP sizes where the site uses responsive `srcset`.
- Add or update an optimized in-game copy under `assets/media/in-game/` if Rust UI needs it.
- Update `assets/css/styles.css` if the palette, sizing, or placement changes.
- Update `server-plugins/WebsiteVipBridge.cs` and `server-plugins/WebsiteVipBridge.config.example.json` if asset keys or defaults change.
- Update `docs/horizontal-logo-upload-manifest.md` or create a new upload manifest when live deployment needs a file checklist.

When changing public brand copy:

- Start with the admin Content screen when possible.
- For default/fallback values, update `includes/config.php`.
- Check page heroes, footer copy, SEO metadata, and Open Graph previews.

When changing Rust UI branding:

- Update the website copy of `server-plugins/WebsiteVipBridge.cs`.
- Mirror the plugin file to the live Oxide plugins folder.
- Update live `oxide/config/WebsiteVipBridge.json` only when config values need to change.
- Reload with `oxide.reload WebsiteVipBridge`.
- Watch the server console for brand sync or config rewrite messages.
