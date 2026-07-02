using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Oxide.Core;
using Oxide.Core.Libraries;
using Oxide.Core.Libraries.Covalence;

namespace Oxide.Plugins
{
    [Info("WebsiteVipBridge", "Raidlands", "1.3.0")]
    [Description("Syncs website VIP entitlements and player stats between Raidlands.net and the Rust server.")]
    public class WebsiteVipBridge : CovalencePlugin
    {
        private Configuration config;
        private Timer syncTimer;
        private Timer statsTimer;
        private Timer pendingStatsTimer;
        private long cursor;

        private class Configuration
        {
            public string ApiBaseUrl = "https://raidlands.net";
            [JsonProperty("Website Asset Base Url")]
            public string WebsiteAssetBaseUrl = "https://raidlands.net";
            [JsonProperty("Assets")]
            public AssetPaths Assets = new AssetPaths();
            [JsonProperty("Brand")]
            public BrandConfig Brand = new BrandConfig();
            public string ServerId = "raidlands-main";
            public string SharedSecret = "";
            public int SyncIntervalSeconds = 120;
            public string FailMode = "log_only";
            public bool StatsEnabled = true;
            public int StatsSyncIntervalSeconds = 300;
            public int StatsDebounceSeconds = 30;
            public string WipeKey = "";
            public string WipeStartedAt = "";
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

        private class AssetPaths
        {
            public string Logo = "/assets/media/raidlands-logo.png";
            public string NavLogo = "/assets/media/horizontal-logo-sm.webp";
            public string Hero = "/assets/media/website-hero-raid-overlook-v4.webp";
            public string Header = "/assets/media/header-bg-rust-v2.png";
            public string WipePanel = "/assets/media/wipe-countdown-panel-v2.jpg";
            public string BackpacksIcon = "/assets/media/feature-icons/backpacks.png";
            public string KitsIcon = "/assets/media/feature-icons/kit.png";
            public string TeleportIcon = "/assets/media/feature-icons/teleport.png";
            public string ClanIcon = "/assets/media/feature-icons/clan.png";
            public string SkinboxIcon = "/assets/media/feature-icons/skinbox.png";
            public string FastRaidsIcon = "/assets/media/feature-icons/fast-raids.png";
            public string GatherIcon = "/assets/media/feature-icons/gather.png";
            public string StatsIcon = "/assets/media/feature-icons/stats.png";
        }

        private class BrandConfig
        {
            [JsonProperty("CUI Colors")]
            public BrandCuiColors CuiColors = new BrandCuiColors();
            [JsonProperty("Hex Colors")]
            public BrandHexColors HexColors = new BrandHexColors();
            [JsonProperty("Styles")]
            public BrandStyles Styles = new BrandStyles();
        }

        private class BrandCuiColors
        {
            public string Background = "0.020 0.024 0.027 0.96";
            public string BackgroundAlt = "0.043 0.051 0.055 0.96";
            public string Panel = "0.063 0.071 0.078 0.94";
            public string PanelAlt = "0.090 0.106 0.118 0.94";
            public string Steel = "0.337 0.380 0.416 1";
            public string SteelDim = "0.165 0.196 0.220 1";
            public string Accent = "1.000 0.541 0.157 1";
            public string AccentDark = "0.788 0.341 0.133 1";
            public string Danger = "0.702 0.149 0.118 1";
            public string Warning = "1.000 0.820 0.400 1";
            public string Success = "0.486 1.000 0.420 1";
            public string Text = "0.953 0.933 0.890 1";
            public string Muted = "0.710 0.667 0.627 1";
            public string Dim = "0.502 0.463 0.427 1";
            public string Black = "0 0 0 1";
            public string Border = "1.000 0.541 0.157 0.32";
        }

        private class BrandHexColors
        {
            public string Background = "#050607";
            public string BackgroundAlt = "#0b0d0e";
            public string Panel = "#101214";
            public string PanelAlt = "#171b1e";
            public string Steel = "#56616a";
            public string SteelDim = "#2a3238";
            public string Accent = "#ff8a28";
            public string AccentDark = "#c95722";
            public string Danger = "#b3261e";
            public string Warning = "#ffd166";
            public string Success = "#7cff6b";
            public string Text = "#f3eee3";
            public string Muted = "#b5aaa0";
            public string Dim = "#80766d";
            public string Black = "#000000";
            public string Border = "#ff8a28";
        }

        private class BrandStyles
        {
            public string PanelMaterial = "assets/content/ui/uibackgroundblur.mat";
            public string OverlayMaterial = "assets/content/ui/uibackgroundblur.mat";
            public int TitleFontSize = 22;
            public int HeadingFontSize = 18;
            public int BodyFontSize = 14;
            public int CaptionFontSize = 12;
            public int ButtonFontSize = 15;
            public int Padding = 12;
            public int Gap = 8;
            public int Radius = 6;
            public int Cut = 14;
            public string PanelAlpha = "0.94";
            public string BorderAlpha = "0.32";
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

        private class StatsResponse
        {
            public bool ok;
            public string error;
        }

        private class StatsSnapshot
        {
            public string wipe_key;
            public string wipe_started_at;
            public string generated_at;
            public List<StatsPlayer> players = new List<StatsPlayer>();
        }

        private class StatsPlayer
        {
            public string steam_id64;
            public string display_name;
            public int kills;
            public int deaths;
            public int playtime_seconds;
            public int afk_seconds;
            public int reward_points;
        }

        private class KdrData
        {
            public ulong id;
            public string name;
            public int kills;
            public int deaths;
        }

        private class PlaytimeData
        {
            public Dictionary<string, PlaytimeUser> _userData = new Dictionary<string, PlaytimeUser>();
        }

        private class PlaytimeUser
        {
            public double playtime;
            public double afkTime;
            public string displayName;
            public double PlayTime;
            public double AFKTime;
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

            var defaults = new Configuration();

            if (string.IsNullOrWhiteSpace(config.WebsiteAssetBaseUrl))
            {
                config.WebsiteAssetBaseUrl = defaults.WebsiteAssetBaseUrl;
            }

            if (config.Assets == null)
            {
                config.Assets = new AssetPaths();
            }

            ApplyAssetDefaults(config.Assets, defaults.Assets);

            if (config.Brand == null)
            {
                config.Brand = new BrandConfig();
            }

            ApplyBrandDefaults(config.Brand, defaults.Brand);

            if (config.ManagedGroups == null)
            {
                config.ManagedGroups = defaults.ManagedGroups;
            }

            if (config.StatsSyncIntervalSeconds <= 0)
            {
                config.StatsSyncIntervalSeconds = defaults.StatsSyncIntervalSeconds;
            }

            if (config.StatsDebounceSeconds <= 0)
            {
                config.StatsDebounceSeconds = defaults.StatsDebounceSeconds;
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

            if (config.StatsEnabled)
            {
                var statsInterval = Math.Max(60, config.StatsSyncIntervalSeconds);
                timer.Once(10f, SyncStatsSnapshot);
                statsTimer = timer.Every(statsInterval, SyncStatsSnapshot);
                Puts($"WebsiteVipBridge syncing VIP every {interval} seconds and stats every {statsInterval} seconds.");
                return;
            }

            Puts($"WebsiteVipBridge syncing VIP every {interval} seconds. Stats sync is disabled.");
        }

        private void Unload()
        {
            syncTimer?.Destroy();
            statsTimer?.Destroy();
            pendingStatsTimer?.Destroy();
        }

        private void OnUserConnected(IPlayer player)
        {
            if (player == null || string.IsNullOrWhiteSpace(player.Id))
            {
                return;
            }

            SyncPlayer(player.Id);
            QueueStatsSync();
        }

        private void OnUserDisconnected(IPlayer player)
        {
            QueueStatsSync();
        }

        private void OnPointsUpdated(ulong userId, int balance)
        {
            QueueStatsSync();
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

        private void QueueStatsSync()
        {
            if (!config.StatsEnabled || !CanRequest())
            {
                return;
            }

            pendingStatsTimer?.Destroy();
            pendingStatsTimer = timer.Once(Math.Max(5, config.StatsDebounceSeconds), SyncStatsSnapshot);
        }

        private void SyncStatsSnapshot()
        {
            pendingStatsTimer?.Destroy();
            pendingStatsTimer = null;

            if (!config.StatsEnabled || !CanRequest())
            {
                return;
            }

            var snapshot = BuildStatsSnapshot();
            var body = JsonConvert.SerializeObject(snapshot);
            var url = $"{TrimSlash(config.ApiBaseUrl)}/api/server/stats-snapshot.php";

            SendPost(url, body, (code, response) =>
            {
                if (!IsSuccess(code, response, out var error))
                {
                    PrintWarning($"Stats snapshot sync failed: {error}");
                    return;
                }

                var payload = JsonConvert.DeserializeObject<StatsResponse>(response);

                if (payload == null || !payload.ok)
                {
                    PrintWarning($"Stats snapshot sync failed: {payload?.error ?? "invalid response"}");
                    return;
                }

                Puts($"Stats snapshot synced for {snapshot.players.Count} players.");
            });
        }

        private StatsSnapshot BuildStatsSnapshot()
        {
            var playersById = new Dictionary<string, StatsPlayer>();

            AddKdrStats(playersById);
            AddPlaytimeStats(playersById);
            AddRewardPoints(playersById);
            AddConnectedPlayers(playersById);

            return new StatsSnapshot
            {
                wipe_key = ResolveWipeKey(),
                wipe_started_at = string.IsNullOrWhiteSpace(config.WipeStartedAt) ? null : config.WipeStartedAt,
                generated_at = DateTime.UtcNow.ToString("o"),
                players = playersById.Values
                    .OrderByDescending(player => player.kills)
                    .ThenByDescending(player => player.playtime_seconds)
                    .ThenBy(player => player.steam_id64)
                    .ToList()
            };
        }

        private void AddKdrStats(Dictionary<string, StatsPlayer> playersById)
        {
            var directory = Path.Combine(Interface.Oxide.DataFileSystem.Directory, "KDRScoreboard");

            if (!Directory.Exists(directory))
            {
                return;
            }

            foreach (var path in Directory.GetFiles(directory, "*.json"))
            {
                try
                {
                    var data = JsonConvert.DeserializeObject<KdrData>(File.ReadAllText(path));

                    if (data == null || data.id == 0)
                    {
                        continue;
                    }

                    var steamId = data.id.ToString();

                    if (!IsSteamId64(steamId))
                    {
                        continue;
                    }

                    var player = EnsureStatsPlayer(playersById, steamId);
                    player.display_name = FirstNonEmpty(player.display_name, data.name);
                    player.kills = Math.Max(0, data.kills);
                    player.deaths = Math.Max(0, data.deaths);
                }
                catch (Exception ex)
                {
                    PrintWarning($"Could not read KDR stats from {Path.GetFileName(path)}: {ex.Message}");
                }
            }
        }

        private void AddPlaytimeStats(Dictionary<string, StatsPlayer> playersById)
        {
            var data = ReadDataFile<PlaytimeData>("PlaytimeTracker/user_data");

            if (data?._userData == null)
            {
                return;
            }

            foreach (var entry in data._userData)
            {
                if (!IsSteamId64(entry.Key) || entry.Value == null)
                {
                    continue;
                }

                var player = EnsureStatsPlayer(playersById, entry.Key);
                player.display_name = FirstNonEmpty(player.display_name, entry.Value.displayName);
                player.playtime_seconds = Math.Max(0, ToInt(Math.Max(entry.Value.PlayTime, entry.Value.playtime)));
                player.afk_seconds = Math.Max(0, ToInt(Math.Max(entry.Value.AFKTime, entry.Value.afkTime)));
            }
        }

        private void AddRewardPoints(Dictionary<string, StatsPlayer> playersById)
        {
            var balances = ReadDataFile<Dictionary<string, int>>("ServerRewards/player_balances");

            if (balances == null)
            {
                return;
            }

            foreach (var entry in balances)
            {
                if (!IsSteamId64(entry.Key))
                {
                    continue;
                }

                var player = EnsureStatsPlayer(playersById, entry.Key);
                player.reward_points = Math.Max(0, entry.Value);
            }
        }

        private void AddConnectedPlayers(Dictionary<string, StatsPlayer> playersById)
        {
            foreach (var player in players.Connected)
            {
                if (player == null || !IsSteamId64(player.Id))
                {
                    continue;
                }

                var statsPlayer = EnsureStatsPlayer(playersById, player.Id);
                statsPlayer.display_name = FirstNonEmpty(statsPlayer.display_name, player.Name);
            }
        }

        private StatsPlayer EnsureStatsPlayer(Dictionary<string, StatsPlayer> playersById, string steamId)
        {
            StatsPlayer player;

            if (!playersById.TryGetValue(steamId, out player))
            {
                player = new StatsPlayer
                {
                    steam_id64 = steamId,
                    display_name = ""
                };
                playersById[steamId] = player;
            }

            return player;
        }

        private T ReadDataFile<T>(string fileName)
        {
            try
            {
                if (!Interface.Oxide.DataFileSystem.ExistsDatafile(fileName))
                {
                    return default(T);
                }

                return Interface.Oxide.DataFileSystem.ReadObject<T>(fileName);
            }
            catch (Exception ex)
            {
                PrintWarning($"Could not read data file {fileName}: {ex.Message}");
                return default(T);
            }
        }

        private string ResolveWipeKey()
        {
            if (!string.IsNullOrWhiteSpace(config.WipeKey))
            {
                return config.WipeKey.Trim();
            }

            return $"{config.ServerId}-current";
        }

        private string AssetUrl(string configuredAssetPath)
        {
            return ResolveAssetUrl(configuredAssetPath, config?.WebsiteAssetBaseUrl);
        }

        private string GetAssetUrl(string key)
        {
            var assets = config?.Assets ?? new AssetPaths();

            switch (NormalizeKey(key))
            {
                case "logo":
                    return AssetUrl(assets.Logo);
                case "navlogo":
                    return AssetUrl(assets.NavLogo);
                case "hero":
                    return AssetUrl(assets.Hero);
                case "header":
                    return AssetUrl(assets.Header);
                case "wipepanel":
                    return AssetUrl(assets.WipePanel);
                case "backpacksicon":
                case "backpackicon":
                    return AssetUrl(assets.BackpacksIcon);
                case "kitsicon":
                case "kiticon":
                    return AssetUrl(assets.KitsIcon);
                case "teleporticon":
                    return AssetUrl(assets.TeleportIcon);
                case "clanicon":
                    return AssetUrl(assets.ClanIcon);
                case "skinboxicon":
                    return AssetUrl(assets.SkinboxIcon);
                case "fastraidsicon":
                case "fastraidicon":
                    return AssetUrl(assets.FastRaidsIcon);
                case "gathericon":
                    return AssetUrl(assets.GatherIcon);
                case "statsicon":
                    return AssetUrl(assets.StatsIcon);
                default:
                    return "";
            }
        }

        private Dictionary<string, string> GetAssetUrls()
        {
            return new Dictionary<string, string>
            {
                ["Logo"] = GetAssetUrl("Logo"),
                ["NavLogo"] = GetAssetUrl("NavLogo"),
                ["Hero"] = GetAssetUrl("Hero"),
                ["Header"] = GetAssetUrl("Header"),
                ["WipePanel"] = GetAssetUrl("WipePanel"),
                ["BackpacksIcon"] = GetAssetUrl("BackpacksIcon"),
                ["KitsIcon"] = GetAssetUrl("KitsIcon"),
                ["TeleportIcon"] = GetAssetUrl("TeleportIcon"),
                ["ClanIcon"] = GetAssetUrl("ClanIcon"),
                ["SkinboxIcon"] = GetAssetUrl("SkinboxIcon"),
                ["FastRaidsIcon"] = GetAssetUrl("FastRaidsIcon"),
                ["GatherIcon"] = GetAssetUrl("GatherIcon"),
                ["StatsIcon"] = GetAssetUrl("StatsIcon")
            };
        }

        private string GetBrandColor(string key)
        {
            var colors = config?.Brand?.CuiColors ?? new BrandCuiColors();

            switch (NormalizeKey(key))
            {
                case "background":
                    return colors.Background;
                case "backgroundalt":
                    return colors.BackgroundAlt;
                case "panel":
                    return colors.Panel;
                case "panelalt":
                    return colors.PanelAlt;
                case "steel":
                    return colors.Steel;
                case "steeldim":
                    return colors.SteelDim;
                case "accent":
                case "orange":
                    return colors.Accent;
                case "accentdark":
                case "orangedark":
                    return colors.AccentDark;
                case "danger":
                case "red":
                    return colors.Danger;
                case "warning":
                case "yellow":
                    return colors.Warning;
                case "success":
                case "green":
                    return colors.Success;
                case "text":
                case "white":
                    return colors.Text;
                case "muted":
                    return colors.Muted;
                case "dim":
                    return colors.Dim;
                case "black":
                    return colors.Black;
                case "border":
                    return colors.Border;
                default:
                    return "";
            }
        }

        private Dictionary<string, string> GetBrandColors()
        {
            return new Dictionary<string, string>
            {
                ["Background"] = GetBrandColor("Background"),
                ["BackgroundAlt"] = GetBrandColor("BackgroundAlt"),
                ["Panel"] = GetBrandColor("Panel"),
                ["PanelAlt"] = GetBrandColor("PanelAlt"),
                ["Steel"] = GetBrandColor("Steel"),
                ["SteelDim"] = GetBrandColor("SteelDim"),
                ["Accent"] = GetBrandColor("Accent"),
                ["AccentDark"] = GetBrandColor("AccentDark"),
                ["Danger"] = GetBrandColor("Danger"),
                ["Warning"] = GetBrandColor("Warning"),
                ["Success"] = GetBrandColor("Success"),
                ["Text"] = GetBrandColor("Text"),
                ["Muted"] = GetBrandColor("Muted"),
                ["Dim"] = GetBrandColor("Dim"),
                ["Black"] = GetBrandColor("Black"),
                ["Border"] = GetBrandColor("Border")
            };
        }

        private string GetBrandHexColor(string key)
        {
            var colors = config?.Brand?.HexColors ?? new BrandHexColors();

            switch (NormalizeKey(key))
            {
                case "background":
                    return colors.Background;
                case "backgroundalt":
                    return colors.BackgroundAlt;
                case "panel":
                    return colors.Panel;
                case "panelalt":
                    return colors.PanelAlt;
                case "steel":
                    return colors.Steel;
                case "steeldim":
                    return colors.SteelDim;
                case "accent":
                case "orange":
                    return colors.Accent;
                case "accentdark":
                case "orangedark":
                    return colors.AccentDark;
                case "danger":
                case "red":
                    return colors.Danger;
                case "warning":
                case "yellow":
                    return colors.Warning;
                case "success":
                case "green":
                    return colors.Success;
                case "text":
                case "white":
                    return colors.Text;
                case "muted":
                    return colors.Muted;
                case "dim":
                    return colors.Dim;
                case "black":
                    return colors.Black;
                case "border":
                    return colors.Border;
                default:
                    return "";
            }
        }

        private Dictionary<string, string> GetBrandHexColors()
        {
            return new Dictionary<string, string>
            {
                ["Background"] = GetBrandHexColor("Background"),
                ["BackgroundAlt"] = GetBrandHexColor("BackgroundAlt"),
                ["Panel"] = GetBrandHexColor("Panel"),
                ["PanelAlt"] = GetBrandHexColor("PanelAlt"),
                ["Steel"] = GetBrandHexColor("Steel"),
                ["SteelDim"] = GetBrandHexColor("SteelDim"),
                ["Accent"] = GetBrandHexColor("Accent"),
                ["AccentDark"] = GetBrandHexColor("AccentDark"),
                ["Danger"] = GetBrandHexColor("Danger"),
                ["Warning"] = GetBrandHexColor("Warning"),
                ["Success"] = GetBrandHexColor("Success"),
                ["Text"] = GetBrandHexColor("Text"),
                ["Muted"] = GetBrandHexColor("Muted"),
                ["Dim"] = GetBrandHexColor("Dim"),
                ["Black"] = GetBrandHexColor("Black"),
                ["Border"] = GetBrandHexColor("Border")
            };
        }

        private object GetBrandStyle(string key)
        {
            var styles = config?.Brand?.Styles ?? new BrandStyles();

            switch (NormalizeKey(key))
            {
                case "panelmaterial":
                    return styles.PanelMaterial;
                case "overlaymaterial":
                    return styles.OverlayMaterial;
                case "titlefontsize":
                    return styles.TitleFontSize;
                case "headingfontsize":
                    return styles.HeadingFontSize;
                case "bodyfontsize":
                    return styles.BodyFontSize;
                case "captionfontsize":
                    return styles.CaptionFontSize;
                case "buttonfontsize":
                    return styles.ButtonFontSize;
                case "padding":
                    return styles.Padding;
                case "gap":
                    return styles.Gap;
                case "radius":
                    return styles.Radius;
                case "cut":
                    return styles.Cut;
                case "panelalpha":
                    return styles.PanelAlpha;
                case "borderalpha":
                    return styles.BorderAlpha;
                default:
                    return null;
            }
        }

        private Dictionary<string, object> GetBrandStyles()
        {
            return new Dictionary<string, object>
            {
                ["PanelMaterial"] = GetBrandStyle("PanelMaterial"),
                ["OverlayMaterial"] = GetBrandStyle("OverlayMaterial"),
                ["TitleFontSize"] = GetBrandStyle("TitleFontSize"),
                ["HeadingFontSize"] = GetBrandStyle("HeadingFontSize"),
                ["BodyFontSize"] = GetBrandStyle("BodyFontSize"),
                ["CaptionFontSize"] = GetBrandStyle("CaptionFontSize"),
                ["ButtonFontSize"] = GetBrandStyle("ButtonFontSize"),
                ["Padding"] = GetBrandStyle("Padding"),
                ["Gap"] = GetBrandStyle("Gap"),
                ["Radius"] = GetBrandStyle("Radius"),
                ["Cut"] = GetBrandStyle("Cut"),
                ["PanelAlpha"] = GetBrandStyle("PanelAlpha"),
                ["BorderAlpha"] = GetBrandStyle("BorderAlpha")
            };
        }

        private static string ResolveAssetUrl(string configuredAssetPath, string websiteAssetBaseUrl)
        {
            if (string.IsNullOrWhiteSpace(configuredAssetPath))
            {
                return "";
            }

            var assetPath = configuredAssetPath.Trim();

            if (assetPath.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                || assetPath.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                return assetPath;
            }

            var baseUrl = TrimSlash(websiteAssetBaseUrl);
            var normalizedPath = NormalizeAssetPath(assetPath).TrimStart('/');

            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                return normalizedPath;
            }

            return $"{baseUrl}/{normalizedPath}";
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

        private void SendPost(string url, string body, Action<int, string> callback)
        {
            var headers = BuildHeaders("POST", url, body);
            headers["Content-Type"] = "application/json";
            webrequest.Enqueue(url, body, (code, response) => callback(code, response), this, RequestMethod.POST, headers);
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

        private bool IsSteamId64(string value)
        {
            return !string.IsNullOrWhiteSpace(value)
                && value.Length == 17
                && value.StartsWith("7656119")
                && value.All(char.IsDigit);
        }

        private string FirstNonEmpty(string current, string next)
        {
            return string.IsNullOrWhiteSpace(current) ? (next ?? "").Trim() : current;
        }

        private static string ConfiguredOrDefault(string value, string fallback)
        {
            return string.IsNullOrWhiteSpace(value) ? fallback : value;
        }

        private static int ConfiguredOrDefault(int value, int fallback)
        {
            return value <= 0 ? fallback : value;
        }

        private static void ApplyAssetDefaults(AssetPaths assets, AssetPaths defaults)
        {
            assets.Logo = ConfiguredOrDefault(assets.Logo, defaults.Logo);
            assets.NavLogo = ConfiguredOrDefault(assets.NavLogo, defaults.NavLogo);
            assets.Hero = ConfiguredOrDefault(assets.Hero, defaults.Hero);
            assets.Header = ConfiguredOrDefault(assets.Header, defaults.Header);
            assets.WipePanel = ConfiguredOrDefault(assets.WipePanel, defaults.WipePanel);
            assets.BackpacksIcon = ConfiguredOrDefault(assets.BackpacksIcon, defaults.BackpacksIcon);
            assets.KitsIcon = ConfiguredOrDefault(assets.KitsIcon, defaults.KitsIcon);
            assets.TeleportIcon = ConfiguredOrDefault(assets.TeleportIcon, defaults.TeleportIcon);
            assets.ClanIcon = ConfiguredOrDefault(assets.ClanIcon, defaults.ClanIcon);
            assets.SkinboxIcon = ConfiguredOrDefault(assets.SkinboxIcon, defaults.SkinboxIcon);
            assets.FastRaidsIcon = ConfiguredOrDefault(assets.FastRaidsIcon, defaults.FastRaidsIcon);
            assets.GatherIcon = ConfiguredOrDefault(assets.GatherIcon, defaults.GatherIcon);
            assets.StatsIcon = ConfiguredOrDefault(assets.StatsIcon, defaults.StatsIcon);
        }

        private static void ApplyBrandDefaults(BrandConfig brand, BrandConfig defaults)
        {
            if (brand.CuiColors == null)
            {
                brand.CuiColors = new BrandCuiColors();
            }

            if (brand.HexColors == null)
            {
                brand.HexColors = new BrandHexColors();
            }

            if (brand.Styles == null)
            {
                brand.Styles = new BrandStyles();
            }

            ApplyBrandCuiColorDefaults(brand.CuiColors, defaults.CuiColors);
            ApplyBrandHexColorDefaults(brand.HexColors, defaults.HexColors);
            ApplyBrandStyleDefaults(brand.Styles, defaults.Styles);
        }

        private static void ApplyBrandCuiColorDefaults(BrandCuiColors colors, BrandCuiColors defaults)
        {
            colors.Background = ConfiguredOrDefault(colors.Background, defaults.Background);
            colors.BackgroundAlt = ConfiguredOrDefault(colors.BackgroundAlt, defaults.BackgroundAlt);
            colors.Panel = ConfiguredOrDefault(colors.Panel, defaults.Panel);
            colors.PanelAlt = ConfiguredOrDefault(colors.PanelAlt, defaults.PanelAlt);
            colors.Steel = ConfiguredOrDefault(colors.Steel, defaults.Steel);
            colors.SteelDim = ConfiguredOrDefault(colors.SteelDim, defaults.SteelDim);
            colors.Accent = ConfiguredOrDefault(colors.Accent, defaults.Accent);
            colors.AccentDark = ConfiguredOrDefault(colors.AccentDark, defaults.AccentDark);
            colors.Danger = ConfiguredOrDefault(colors.Danger, defaults.Danger);
            colors.Warning = ConfiguredOrDefault(colors.Warning, defaults.Warning);
            colors.Success = ConfiguredOrDefault(colors.Success, defaults.Success);
            colors.Text = ConfiguredOrDefault(colors.Text, defaults.Text);
            colors.Muted = ConfiguredOrDefault(colors.Muted, defaults.Muted);
            colors.Dim = ConfiguredOrDefault(colors.Dim, defaults.Dim);
            colors.Black = ConfiguredOrDefault(colors.Black, defaults.Black);
            colors.Border = ConfiguredOrDefault(colors.Border, defaults.Border);
        }

        private static void ApplyBrandHexColorDefaults(BrandHexColors colors, BrandHexColors defaults)
        {
            colors.Background = ConfiguredOrDefault(colors.Background, defaults.Background);
            colors.BackgroundAlt = ConfiguredOrDefault(colors.BackgroundAlt, defaults.BackgroundAlt);
            colors.Panel = ConfiguredOrDefault(colors.Panel, defaults.Panel);
            colors.PanelAlt = ConfiguredOrDefault(colors.PanelAlt, defaults.PanelAlt);
            colors.Steel = ConfiguredOrDefault(colors.Steel, defaults.Steel);
            colors.SteelDim = ConfiguredOrDefault(colors.SteelDim, defaults.SteelDim);
            colors.Accent = ConfiguredOrDefault(colors.Accent, defaults.Accent);
            colors.AccentDark = ConfiguredOrDefault(colors.AccentDark, defaults.AccentDark);
            colors.Danger = ConfiguredOrDefault(colors.Danger, defaults.Danger);
            colors.Warning = ConfiguredOrDefault(colors.Warning, defaults.Warning);
            colors.Success = ConfiguredOrDefault(colors.Success, defaults.Success);
            colors.Text = ConfiguredOrDefault(colors.Text, defaults.Text);
            colors.Muted = ConfiguredOrDefault(colors.Muted, defaults.Muted);
            colors.Dim = ConfiguredOrDefault(colors.Dim, defaults.Dim);
            colors.Black = ConfiguredOrDefault(colors.Black, defaults.Black);
            colors.Border = ConfiguredOrDefault(colors.Border, defaults.Border);
        }

        private static void ApplyBrandStyleDefaults(BrandStyles styles, BrandStyles defaults)
        {
            styles.PanelMaterial = ConfiguredOrDefault(styles.PanelMaterial, defaults.PanelMaterial);
            styles.OverlayMaterial = ConfiguredOrDefault(styles.OverlayMaterial, defaults.OverlayMaterial);
            styles.TitleFontSize = ConfiguredOrDefault(styles.TitleFontSize, defaults.TitleFontSize);
            styles.HeadingFontSize = ConfiguredOrDefault(styles.HeadingFontSize, defaults.HeadingFontSize);
            styles.BodyFontSize = ConfiguredOrDefault(styles.BodyFontSize, defaults.BodyFontSize);
            styles.CaptionFontSize = ConfiguredOrDefault(styles.CaptionFontSize, defaults.CaptionFontSize);
            styles.ButtonFontSize = ConfiguredOrDefault(styles.ButtonFontSize, defaults.ButtonFontSize);
            styles.Padding = ConfiguredOrDefault(styles.Padding, defaults.Padding);
            styles.Gap = ConfiguredOrDefault(styles.Gap, defaults.Gap);
            styles.Radius = ConfiguredOrDefault(styles.Radius, defaults.Radius);
            styles.Cut = ConfiguredOrDefault(styles.Cut, defaults.Cut);
            styles.PanelAlpha = ConfiguredOrDefault(styles.PanelAlpha, defaults.PanelAlpha);
            styles.BorderAlpha = ConfiguredOrDefault(styles.BorderAlpha, defaults.BorderAlpha);
        }

        private int ToInt(double value)
        {
            if (double.IsNaN(value) || double.IsInfinity(value) || value <= 0)
            {
                return 0;
            }

            return (int)Math.Min(int.MaxValue, Math.Round(value));
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
            return (value ?? "").Trim().TrimEnd('/');
        }

        private static string NormalizeAssetPath(string value)
        {
            return string.Join("/", (value ?? "")
                .Replace('\\', '/')
                .Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries));
        }

        private static string NormalizeKey(string value)
        {
            return new string((value ?? "")
                .Where(char.IsLetterOrDigit)
                .Select(char.ToLowerInvariant)
                .ToArray());
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
