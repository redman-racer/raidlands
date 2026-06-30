using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Oxide.Core;
using Oxide.Core.Libraries;
using Oxide.Core.Libraries.Covalence;

namespace Oxide.Plugins
{
    [Info("WebsiteVipBridge", "Raidlands", "1.0.0")]
    [Description("Syncs website VIP entitlements into managed Oxide permission groups.")]
    public class WebsiteVipBridge : CovalencePlugin
    {
        private Configuration config;
        private Timer syncTimer;
        private long cursor;

        private class Configuration
        {
            public string ApiBaseUrl = "https://raidlands.net";
            public string ServerId = "raidlands-main";
            public string SharedSecret = "";
            public int SyncIntervalSeconds = 120;
            public string FailMode = "log_only";
            public List<string> ManagedGroups = new List<string>
            {
                "vip_bronze",
                "vip_gold",
                "vip_elite",
                "perk_personal_mini",
                "perk_skinbox",
                "perk_raid_kit",
                "perk_queue_priority",
                "perk_supporter_badge"
            };
        }

        private class PlayerResponse
        {
            public bool ok;
            public string error;
            public string steam_id64;
            public List<string> managed_groups;
            public List<string> groups;
            public long cursor;
        }

        private class ChangesResponse
        {
            public bool ok;
            public string error;
            public List<string> managed_groups;
            public List<PlayerState> players;
            public long cursor;
        }

        private class PlayerState
        {
            public string steam_id64;
            public List<string> groups;
        }

        protected override void LoadDefaultConfig()
        {
            config = new Configuration();
        }

        protected override void LoadConfig()
        {
            base.LoadConfig();

            try
            {
                config = Config.ReadObject<Configuration>() ?? new Configuration();
            }
            catch
            {
                PrintWarning("Configuration was invalid; writing defaults.");
                config = new Configuration();
            }

            if (config.ManagedGroups == null)
            {
                config.ManagedGroups = new Configuration().ManagedGroups;
            }

            SaveConfig();
        }

        protected override void SaveConfig()
        {
            Config.WriteObject(config, true);
        }

        private void OnServerInitialized()
        {
            EnsureManagedGroups(config.ManagedGroups);
            SyncChanges();

            var interval = Math.Max(30, config.SyncIntervalSeconds);
            syncTimer = timer.Every(interval, SyncChanges);
            Puts($"WebsiteVipBridge syncing every {interval} seconds.");
        }

        private void Unload()
        {
            syncTimer?.Destroy();
        }

        private void OnUserConnected(IPlayer player)
        {
            if (player == null || string.IsNullOrWhiteSpace(player.Id))
            {
                return;
            }

            SyncPlayer(player.Id);
        }

        private void SyncPlayer(string steamId)
        {
            if (!CanRequest())
            {
                return;
            }

            var url = $"{TrimSlash(config.ApiBaseUrl)}/api/server/vip-player.php?steam_id64={Uri.EscapeDataString(steamId)}";
            SendGet(url, (code, response) =>
            {
                if (!IsSuccess(code, response, out var error))
                {
                    PrintWarning($"VIP player sync failed for {steamId}: {error}");
                    return;
                }

                var payload = JsonConvert.DeserializeObject<PlayerResponse>(response);

                if (payload == null || !payload.ok)
                {
                    PrintWarning($"VIP player sync failed for {steamId}: {payload?.error ?? "invalid response"}");
                    return;
                }

                ApplyDesiredGroups(steamId, payload.groups, payload.managed_groups);

                if (payload.cursor > cursor)
                {
                    cursor = payload.cursor;
                }
            });
        }

        private void SyncChanges()
        {
            if (!CanRequest())
            {
                return;
            }

            var url = $"{TrimSlash(config.ApiBaseUrl)}/api/server/vip-changes.php?since={cursor}";
            SendGet(url, (code, response) =>
            {
                if (!IsSuccess(code, response, out var error))
                {
                    PrintWarning($"VIP change sync failed: {error}");
                    return;
                }

                var payload = JsonConvert.DeserializeObject<ChangesResponse>(response);

                if (payload == null || !payload.ok)
                {
                    PrintWarning($"VIP change sync failed: {payload?.error ?? "invalid response"}");
                    return;
                }

                EnsureManagedGroups(payload.managed_groups);

                foreach (var player in payload.players ?? new List<PlayerState>())
                {
                    if (string.IsNullOrWhiteSpace(player.steam_id64))
                    {
                        continue;
                    }

                    ApplyDesiredGroups(player.steam_id64, player.groups, payload.managed_groups);
                }

                if (payload.cursor > cursor)
                {
                    cursor = payload.cursor;
                }
            });
        }

        private bool CanRequest()
        {
            if (string.IsNullOrWhiteSpace(config.ApiBaseUrl))
            {
                PrintWarning("ApiBaseUrl is not configured.");
                return false;
            }

            if (string.IsNullOrWhiteSpace(config.SharedSecret))
            {
                PrintWarning("SharedSecret is not configured.");
                return false;
            }

            return true;
        }

        private void SendGet(string url, Action<int, string> callback)
        {
            var headers = BuildHeaders("GET", url, "");
            webrequest.Enqueue(url, null, (code, response) => callback(code, response), this, RequestMethod.GET, headers);
        }

        private Dictionary<string, string> BuildHeaders(string method, string url, string body)
        {
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
            var pathAndQuery = new Uri(url).PathAndQuery;
            var bodyHash = Sha256(body ?? "");
            var payload = $"{method.ToUpperInvariant()}\n{pathAndQuery}\n{timestamp}\n{bodyHash}";
            var signature = HmacSha256(payload, config.SharedSecret);

            return new Dictionary<string, string>
            {
                ["X-Raidlands-Server"] = config.ServerId,
                ["X-Raidlands-Timestamp"] = timestamp,
                ["X-Raidlands-Signature"] = signature,
                ["Accept"] = "application/json"
            };
        }

        private void ApplyDesiredGroups(string steamId, List<string> desiredGroups, List<string> apiManagedGroups)
        {
            var managed = new HashSet<string>((config.ManagedGroups ?? new List<string>()).Where(IsGroupName), StringComparer.OrdinalIgnoreCase);

            foreach (var group in apiManagedGroups ?? new List<string>())
            {
                if (IsGroupName(group))
                {
                    managed.Add(group);
                }
            }

            var desired = new HashSet<string>((desiredGroups ?? new List<string>()).Where(IsGroupName), StringComparer.OrdinalIgnoreCase);

            EnsureManagedGroups(managed.ToList());

            foreach (var group in managed)
            {
                var hasGroup = permission.UserHasGroup(steamId, group);
                var shouldHaveGroup = desired.Contains(group);

                if (shouldHaveGroup && !hasGroup)
                {
                    permission.AddUserGroup(steamId, group);
                    Puts($"Granted {group} to {steamId}.");
                    continue;
                }

                if (!shouldHaveGroup && hasGroup)
                {
                    permission.RemoveUserGroup(steamId, group);
                    Puts($"Removed {group} from {steamId}.");
                }
            }
        }

        private void EnsureManagedGroups(IEnumerable<string> groups)
        {
            foreach (var group in groups ?? new List<string>())
            {
                if (!IsGroupName(group))
                {
                    continue;
                }

                if (!permission.GroupExists(group))
                {
                    permission.CreateGroup(group, group, 0);
                    Puts($"Created Oxide group {group}.");
                }
            }
        }

        private bool IsGroupName(string group)
        {
            return !string.IsNullOrWhiteSpace(group) && group.All(character =>
                char.IsLetterOrDigit(character) || character == '_' || character == '-');
        }

        private bool IsSuccess(int code, string response, out string error)
        {
            if (code >= 200 && code < 300 && !string.IsNullOrWhiteSpace(response))
            {
                error = "";
                return true;
            }

            error = $"HTTP {code}: {response}";
            return false;
        }

        private static string TrimSlash(string value)
        {
            return (value ?? "").TrimEnd('/');
        }

        private static string Sha256(string value)
        {
            using (var sha = SHA256.Create())
            {
                return Hex(sha.ComputeHash(Encoding.UTF8.GetBytes(value)));
            }
        }

        private static string HmacSha256(string value, string secret)
        {
            using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
            {
                return Hex(hmac.ComputeHash(Encoding.UTF8.GetBytes(value)));
            }
        }

        private static string Hex(byte[] bytes)
        {
            var builder = new StringBuilder(bytes.Length * 2);

            foreach (var item in bytes)
            {
                builder.Append(item.ToString("x2"));
            }

            return builder.ToString();
        }
    }
}
