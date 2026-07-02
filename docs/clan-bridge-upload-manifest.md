# Clan Bridge Upload Manifest

Upload these files to the Rust server if clan management should be live from the website or public clan API:

- `server-plugins/WebsiteClanBridge.cs` -> `oxide/plugins/WebsiteClanBridge.cs`
- `server-plugins/WebsiteClanBridge.config.example.json` -> reference shape for generated `oxide/config/WebsiteClanBridge.json`

The generated config must use the same values as the website:

- `ApiBaseUrl`: `https://raidlands.net`
- `ServerId`: same as `RAIDLANDS_BRIDGE_SERVER_ID`
- `SharedSecret`: same as `RAIDLANDS_BRIDGE_SHARED_SECRET`

The game-server Clans plugin must include the Raidlands hooks:

- `RaidlandsClanSnapshot`
- `RaidlandsClanAction`

After upload, reload `Clans` and `WebsiteClanBridge`, then confirm:

- `WebsiteClanBridge` posts `/api/server/clan-snapshot.php`.
- Queued website/API actions are claimed from `/api/server/clan-actions.php?limit=...`.
- Results post back to `/api/server/clan-action-result.php`.
