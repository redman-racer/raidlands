# Raidlands Website

PHP-rendered website for Raidlands 1000x, built from the website plan and media kit.

## Local Preview

With WAMP running, open:

```text
http://localhost/raidlands/
```

Or use PHP's built-in server:

```powershell
Set-Location C:\wamp64\www\raidlands
php -S 127.0.0.1:4177
```

Open:

```text
http://127.0.0.1:4177/
```

## Structure

- `includes/config.php` owns site config, navigation, page metadata, and reusable content data.
- `includes/header.php` renders the shared document head and site header.
- `includes/footer.php` renders the shared footer and toast region.
- `pages/` contains one content template per page.
- Each route has a small `index.php` that loads bootstrap, header, content, and footer.
- `assets/js/site.js` handles behavior only: mobile nav, copy buttons, auth placeholders, reveal effects, metrics, and wipe countdowns.

## Important Config

Launch values live in `includes/config.php`:

- `connectCommand`
- `steamConnectUrl`
- `discordInviteUrl`
- `playersOnline`
- `maxPlayers`
- `wipe.time`
- `wipe.timezone`
- `auth.steamUrl`
- `auth.discordUrl`

Steam and Discord account linking buttons are ready for OAuth URLs, but no real OAuth backend or credentials are included yet.
