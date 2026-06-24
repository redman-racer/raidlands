# Raidlands Website

Static MVP website for Raidlands 1000x, built from the website plan and media kit.

## Local Preview

```powershell
Set-Location C:\wamp64\www\raidlands
python -m http.server 4177 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:4177/
```

## Important Config

Launch values live near the top of `assets/js/site.js`:

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
