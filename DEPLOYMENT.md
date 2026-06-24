# Raidlands GoDaddy Deployment Guide

This site is a PHP-rendered multi-page website with shared includes, static CSS/JS,
and media assets. There is no package install, build step, database, or long-running
server process required.

## Hosting Requirement

Deploy to hosting that runs PHP for `index.php` files. A typical GoDaddy cPanel
Linux hosting account is fine. Static-only hosting will not render the pages.

## What Gets Deployed

Deploy the site files from the repository root:

- `.htaccess`
- `index.php`
- `robots.txt`
- `site.webmanifest`
- `includes/`
- `pages/`
- `assets/`
- `bans/`
- `clans/`
- `discord/`
- `events/`
- `features/`
- `leaderboard/`
- `link/`
- `play/`
- `privacy/`
- `profile/`
- `rules/`
- `store/`
- `support/`
- `terms/`
- `vote/`

Do not deploy local development folders such as `.git/`, `.agents/`, or `.codex/`.

## Pre-Deployment Checklist

1. Preview the site locally.

   With WAMP running, open:

   ```text
   http://localhost/raidlands/
   ```

   Or use PHP's built-in server:

   ```powershell
   Set-Location C:\wamp64\www\raidlands
   php -S 127.0.0.1:4177
   ```

   Open `http://127.0.0.1:4177/`.

2. Confirm the live values in `includes/config.php`.

   Check:

   - `connectCommand`
   - `steamConnectUrl`
   - `discordInviteUrl`
   - `playersOnline`
   - `maxPlayers`
   - `wipe.time`
   - `wipe.timezone`
   - `auth.steamUrl`
   - `auth.discordUrl`

3. Click through the local site.

   Verify the homepage, navigation links, mobile menu, images, favicon, manifest,
   Steam link, Discord link, copy-to-clipboard behavior, and direct page loads.

4. Confirm `.htaccess` is included.

   The current `.htaccess` disables directory browsing, prefers `index.php` as the
   directory index, and registers the web manifest MIME type.

## Create a Deployment Zip

From PowerShell:

```powershell
Set-Location C:\wamp64\www\raidlands
New-Item -ItemType Directory -Force dist | Out-Null

Compress-Archive -Force -DestinationPath .\dist\raidlands-godaddy.zip -Path `
  .\.htaccess, `
  .\index.php, `
  .\robots.txt, `
  .\site.webmanifest, `
  .\includes, `
  .\pages, `
  .\assets, `
  .\bans, `
  .\clans, `
  .\discord, `
  .\events, `
  .\features, `
  .\leaderboard, `
  .\link, `
  .\play, `
  .\privacy, `
  .\profile, `
  .\rules, `
  .\store, `
  .\support, `
  .\terms, `
  .\vote
```

After the zip is created, open it and confirm `.htaccess`, `index.php`,
`includes/`, and `pages/` are present at the top level of the zip. If `.htaccess`
is missing, upload it separately in GoDaddy File Manager after extracting the zip.

## Back Up the Existing GoDaddy Site

Before replacing files, take a backup of the current hosted site.

Recommended options:

- Use GoDaddy's cPanel backup tools or Daily Backups if available.
- Or use cPanel File Manager to compress and download the current document root.
- Or use FTP/SFTP to download the current live files.

Keep the backup somewhere outside the website root, with a timestamped name such
as `raidlands-live-backup-2026-06-24.zip`.

## Upload With GoDaddy cPanel File Manager

Use this path for a typical GoDaddy Web Hosting cPanel account:

1. Sign in to GoDaddy.
2. Open the product page.
3. Under Web Hosting, select **Manage** for the correct hosting account.
4. Open **File Manager** for the domain.
5. Go to the document root:
   - Primary domain: usually `/public_html`
   - Addon domain or subdomain: use the domain-specific root shown in cPanel
6. Upload `dist/raidlands-godaddy.zip`.
7. Extract the zip in the document root.
8. Confirm the extracted files are directly inside the document root.

The live root should look like this:

```text
public_html/
  .htaccess
  index.php
  robots.txt
  site.webmanifest
  includes/
  pages/
  assets/
  bans/
  clans/
  discord/
  events/
  features/
  leaderboard/
  link/
  play/
  privacy/
  profile/
  rules/
  store/
  support/
  terms/
  vote/
```

Avoid this nested layout:

```text
public_html/
  raidlands/
    index.php
    includes/
    assets/
```

If the files are nested under an extra folder, move that folder's contents up into
the document root.

## Upload With FTP or SFTP

FTP/SFTP is better if the File Manager upload times out or you prefer a local
sync workflow.

1. Create or confirm the FTP account in GoDaddy/cPanel.
2. Connect with an FTP client such as FileZilla.
3. Open the domain document root on the remote server.
4. Upload the same deployment files listed in this guide.
5. Make sure `.htaccess` is visible and uploaded.

For updates, overwrite changed files and remove remote files that no longer exist
in the repo.

## SSL and HTTPS

After upload, confirm the site works over HTTPS:

```text
https://your-domain.example/
```

If HTTPS is not active:

1. Confirm the domain DNS points to the GoDaddy hosting account.
2. Enable or install SSL in GoDaddy/cPanel.
3. Enable HTTPS redirect in cPanel once SSL is valid.

This repo does not currently force HTTPS in `.htaccess`, because GoDaddy/cPanel
can manage the redirect at the hosting layer. If you prefer to force it in the
repo later, test that change carefully on the live host.

## Post-Deployment Verification

Check these URLs on the live domain:

- `/`
- `/play/`
- `/discord/`
- `/vote/`
- `/rules/`
- `/leaderboard/`
- `/store/`
- `/support/`
- `/privacy/`
- `/terms/`
- `/site.webmanifest`
- `/assets/css/styles.css`
- `/assets/js/site.js`

Also verify:

- Images load without broken placeholders.
- The navigation menu works on desktop and mobile.
- The console connect command is correct.
- Discord, Steam, and store links go to the expected places.
- The favicon appears in the browser tab.
- Direct page loads work, such as `https://your-domain.example/rules/`.
- Directory listing is blocked, such as `https://your-domain.example/assets/`.
- Static-only URLs such as `/index.html` are no longer expected to exist.

## Rollback

If something goes wrong:

1. Keep the broken deployment in place long enough to capture the exact issue.
2. Delete the newly uploaded files from the document root.
3. Restore the timestamped backup into the document root.
4. Clear browser cache or test in a private window.
5. Re-check the homepage and the most important subpages.

If GoDaddy Daily Backups are enabled, you can also restore from the hosting backup
interface, but be careful: account-level restores can overwrite files, databases,
mailboxes, or related hosting data depending on the restore option selected.

## GoDaddy Reference Links

- [Upload files using cPanel File Manager](https://www.godaddy.com/help/upload-files-using-my-web-hosting-cpanel-file-manager-3239)
- [Manage files in cPanel File Manager](https://www.godaddy.com/help/manage-files-in-my-web-hosting-cpanel-account-12426)
- [Move a cPanel website with FTP and FileZilla](https://www.godaddy.com/help/move-my-cpanel-website-with-ftp-and-filezilla-31870)
- [Redirect HTTP to HTTPS automatically](https://www.godaddy.com/help/redirect-http-to-https-automatically-8828)
- [Download a site backup using Daily Backups](https://www.godaddy.com/help/download-a-site-backup-using-daily-backups-41163)
