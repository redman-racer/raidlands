using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Facepunch.Utility;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Oxide.Core;
using Oxide.Core.Libraries;
using Oxide.Core.Libraries.Covalence;
using Oxide.Core.Plugins;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("WebsiteMapBridge", "Raidlands", "1.0.10")]
    [Description("Publishes the current RustMapApi map image and sampled terrain to the Raidlands website.")]
    public class WebsiteMapBridge : CovalencePlugin
    {
        [PluginReference] private Plugin RustMapApi;
        [PluginReference] private Plugin Clans;

        private const string SecretsConfigName = "Secrets.local";
        private const string VipBridgeConfigName = "WebsiteVipBridge";
        private const int EncodingJpg = 1;
        private const int EncodingPng = 2;

        private Configuration config;
        private Timer autoPublishTimer;
        private Timer playerLocationTimer;
        private Timer environmentTimer;
        private Dictionary<string, string> secrets;
        private string secretsConfigSource;
        private JObject vipBridgeConfig;
        private bool publishInFlight;
        private string lastPublishedWipeKey = "";
        private string lastEnvironmentSyncAt = "";

        private class Configuration
        {
            public string ApiBaseUrl = "https://raidlands.net";
            public string ServerId = "raidlands-main";
            public string SharedSecret = "";
            public string WipeKey = "";
            public string RenderName = "Icons";
            public string TextureRenderName = "Default";
            [JsonProperty("FileType (Jpg, Png)")]
            public string FileType = "Jpg";
            public float ImageResolutionScale = 0.5f;
            public bool AutoPublishOnRustMapApiReady = true;
            public int AutoPublishDelaySeconds = 10;
            public int WebRequestTimeoutMilliseconds = 60000;
            public bool PublishTerrain = true;
            public int TerrainSampleResolution = 129;
            public bool IncludeTerrainColors = true;
            public bool IncludeMonuments = true;
            public bool PublishSkybox = true;
            public string SkyboxImagePath = "oxide/data/WebsiteMapBridge/current-skybox.png";
            public bool PublishPlayerLocations = true;
            public int PlayerLocationIntervalSeconds = 15;
            public bool PublishReplayEvents = true;
            public bool PublishEnvironment = true;
            public int EnvironmentIntervalSeconds = 15;
        }

        private class MapUploadPayload
        {
            public string server_id;
            public string wipe_key;
            public string map_name;
            public string render_name;
            public string file_type;
            public string image_base64;
            public string image_sha256;
            public string texture_render_name;
            public string texture_image_base64;
            public string texture_image_sha256;
            public string skybox_image_base64;
            public string skybox_image_sha256;
            public int image_width;
            public int image_height;
            public int resolution;
            public int world_size;
            public int seed;
            public int protocol;
            public string generated_at;
            public TerrainUploadPayload terrain;
        }

        private class EnvironmentSnapshotPayload
        {
            public string server_id;
            public string wipe_key;
            public string sampled_at;
            public float rust_time;
            public float day_fraction;
            public EnvironmentVectorPayload sun_direction;
            public float sun_intensity;
            public string sun_color;
            public float ambient_intensity;
            public string ambient_color;
            public float? cloud_coverage;
            public float? rain_intensity;
            public float? fog_intensity;
            public string weather_sample_summary;
        }

        private class EnvironmentVectorPayload
        {
            public float x;
            public float y;
            public float z;
        }

        private class EnvironmentSnapshotResponse
        {
            public bool ok;
            public string error;
            public EnvironmentSnapshotResult environment;
        }

        private class EnvironmentSnapshotResult
        {
            public string sampledAt;
        }

        private class TerrainUploadPayload
        {
            public int version = 1;
            public string serverId;
            public string wipeKey;
            public string mapName;
            public int resolution;
            public int worldSize;
            public int seed;
            public float waterLevel;
            public float minHeight;
            public float maxHeight;
            public string generatedAt;
            public List<float> heights;
            public List<string> colors;
            public List<MonumentUploadPayload> monuments;
        }

        private class MonumentUploadPayload
        {
            public string name;
            public string prefab;
            public string kind;
            public float x;
            public float y;
            public float z;
            public float radius;
            public float rotationY;
        }

        private class MapUploadResponse
        {
            public bool ok;
            public string error;
            public string url;
            public MapUploadResult map;
        }

        private class MapUploadResult
        {
            public string url;
            public string publicUrl;
            public string textureUrl;
            public string terrainUrl;
            public string skyboxUrl;
            public string wipeKey;
            public string renderName;
            public string publishedAt;
            public int terrainResolution;
        }

        private class PlayerLocationSnapshotPayload
        {
            public string server_id;
            public string wipe_key;
            public string sampled_at;
            public List<PlayerLocationPayload> players;
        }

        private class PlayerLocationPayload
        {
            public string steam_id64;
            public string display_name;
            public string clan_tag;
            public float x;
            public float y;
            public float z;
        }

        private class PlayerLocationSnapshotResponse
        {
            public bool ok;
            public string error;
            public PlayerLocationSnapshotResult locations;
        }

        private class PlayerLocationSnapshotResult
        {
            public int acceptedPlayers;
            public string sampledAt;
        }

        private class ReplayEventSnapshotPayload
        {
            public string server_id;
            public string wipe_key;
            public List<ReplayEventPayload> events;
        }

        private class ReplayEventPayload
        {
            public string event_key;
            public string event_type;
            public string occurred_at;
            public float x;
            public float y;
            public float z;
            public string vehicle;
            public Dictionary<string, object> payload;
        }

        protected override void LoadDefaultConfig()
        {
            PrintWarning("Creating default WebsiteMapBridge config.");
            config = new Configuration();
        }

        protected override void LoadConfig()
        {
            base.LoadConfig();
            var hasPublishSkyboxSetting = ConfigHasProperty("PublishSkybox");
            Config.Settings.DefaultValueHandling = DefaultValueHandling.Populate;
            config = Config.ReadObject<Configuration>() ?? new Configuration();
            NormalizeConfig(hasPublishSkyboxSetting);
            Config.WriteObject(config, true);
        }

        private void OnServerInitialized()
        {
            LogBridgeSecretDiagnostics();
            QueueAutoPublish("server initialized");
            StartPlayerLocationPublisher();
            StartEnvironmentPublisher();
        }

        private void OnEntitySpawned(BaseNetworkable entity)
        {
            if (!config.PublishReplayEvents || entity == null)
            {
                return;
            }

            var baseEntity = entity as BaseEntity;
            var prefab = baseEntity == null ? "" : (baseEntity.PrefabName ?? baseEntity.ShortPrefabName ?? "");
            if (prefab.IndexOf("supply_drop", StringComparison.OrdinalIgnoreCase) < 0)
            {
                return;
            }

            timer.Once(0.25f, () => PublishAirdropReplayEvent(baseEntity));
        }

        private void Unload()
        {
            autoPublishTimer?.Destroy();
            autoPublishTimer = null;
            playerLocationTimer?.Destroy();
            playerLocationTimer = null;
            environmentTimer?.Destroy();
            environmentTimer = null;
        }

        private void OnRustMapApiReady()
        {
            QueueAutoPublish("RustMapApi ready");
        }

        [ConsoleCommand("rl_map_publish")]
        private void PublishCommand(ConsoleSystem.Arg arg)
        {
            if (!CanUsePublishCommand(arg))
            {
                ReplyToCommand(arg, "You must be server console, RCON, or auth level 2 to publish the website map.");
                return;
            }

            var renderName = arg.GetString(0, config.RenderName);
            var scale = config.ImageResolutionScale;

            if (arg.Args != null && arg.Args.Length > 1)
            {
                float parsedScale;

                if (!float.TryParse(arg.GetString(1, ""), out parsedScale) || parsedScale <= 0f)
                {
                    ReplyToCommand(arg, "Invalid syntax. Use rl_map_publish <renderName:optional> <resolutionScale:optional>");
                    return;
                }

                scale = parsedScale;
            }

            ReplyToCommand(arg, $"Website map publish requested for render '{renderName}' at scale {scale:0.###}.");
            PublishMap("manual command", message => ReplyToCommand(arg, message), true, renderName, scale);
        }

        [ConsoleCommand("rl_map_status")]
        private void StatusCommand(ConsoleSystem.Arg arg)
        {
            if (!CanUsePublishCommand(arg))
            {
                ReplyToCommand(arg, "You must be server console, RCON, or auth level 2 to inspect the website map bridge.");
                return;
            }

            var secretState = string.IsNullOrWhiteSpace(ResolveBridgeSharedSecret()) ? "missing" : "configured";
            var apiState = RustMapApi == null ? "missing" : RustMapApi.IsLoaded ? "loaded" : "not loaded";
            var readyState = RustMapApi != null && RustMapApi.IsLoaded ? RustMapApi.Call<bool>("IsReady").ToString() : "false";
            var heightMapState = TerrainMeta.HeightMap == null ? "missing" : "available";

            ReplyToCommand(
                arg,
                $"WebsiteMapBridge v1.0.9 status: server={ResolveServerId()}, api={apiState}, ready={readyState}, secret={secretState}, render={config.RenderName}, textureRender={config.TextureRenderName}, terrainEnabled={config.PublishTerrain}, terrainResolution={config.TerrainSampleResolution}, monumentsEnabled={config.IncludeMonuments}, skybox={config.PublishSkybox}/{config.SkyboxImagePath}, playerLocations={config.PublishPlayerLocations}/{config.PlayerLocationIntervalSeconds}s, environment={config.PublishEnvironment}/{config.EnvironmentIntervalSeconds}s last={FirstNonEmpty(lastEnvironmentSyncAt, "never")}, replayEvents={config.PublishReplayEvents}, heightMap={heightMapState}, lastWipe={lastPublishedWipeKey}."
            );
        }

        [ConsoleCommand("rl_map_locations_sync")]
        private void PlayerLocationsSyncCommand(ConsoleSystem.Arg arg)
        {
            if (!CanUsePublishCommand(arg))
            {
                ReplyToCommand(arg, "You must be server console, RCON, or auth level 2 to sync website player locations.");
                return;
            }

            ReplyToCommand(arg, "Website player location sync requested.");
            PublishPlayerLocations(message => ReplyToCommand(arg, message), true);
        }

        [ConsoleCommand("rl_map_environment_sync")]
        private void EnvironmentSyncCommand(ConsoleSystem.Arg arg)
        {
            if (!CanUsePublishCommand(arg))
            {
                ReplyToCommand(arg, "You must be server console, RCON, or auth level 2 to sync website environment.");
                return;
            }

            ReplyToCommand(arg, "Website environment sync requested.");
            PublishEnvironment(message => ReplyToCommand(arg, message), true);
        }

        private bool CanUsePublishCommand(ConsoleSystem.Arg arg)
        {
            if (arg == null || arg.Connection == null || arg.IsRcon || arg.IsAdmin)
            {
                return true;
            }

            return arg.Connection.authLevel >= 2;
        }

        private void ReplyToCommand(ConsoleSystem.Arg arg, string message)
        {
            Puts(message);
            arg?.ReplyWith(message);
        }

        private void QueueAutoPublish(string reason)
        {
            if (!config.AutoPublishOnRustMapApiReady)
            {
                return;
            }

            autoPublishTimer?.Destroy();
            autoPublishTimer = timer.Once(Math.Max(1, config.AutoPublishDelaySeconds), () =>
            {
                PublishMap(reason, message => Puts(message), false, config.RenderName, config.ImageResolutionScale);
            });
        }

        private void StartPlayerLocationPublisher()
        {
            playerLocationTimer?.Destroy();
            playerLocationTimer = null;

            if (!config.PublishPlayerLocations)
            {
                return;
            }

            var interval = Math.Max(5, config.PlayerLocationIntervalSeconds);
            playerLocationTimer = timer.Every(interval, () => PublishPlayerLocations(message => Puts(message), false));
            timer.Once(Math.Max(3, Math.Min(10, interval)), () => PublishPlayerLocations(message => Puts(message), false));
        }

        private void StartEnvironmentPublisher()
        {
            environmentTimer?.Destroy();
            environmentTimer = null;

            if (!config.PublishEnvironment)
            {
                return;
            }

            var interval = Math.Max(5, config.EnvironmentIntervalSeconds);
            environmentTimer = timer.Every(interval, () => PublishEnvironment(message => Puts(message), false));
            timer.Once(Math.Max(3, Math.Min(10, interval)), () => PublishEnvironment(message => Puts(message), false));
        }

        private void PublishEnvironment(Action<string> reply, bool verbose)
        {
            var secret = ResolveBridgeSharedSecret();

            if (string.IsNullOrWhiteSpace(secret))
            {
                if (verbose)
                {
                    reply?.Invoke("Cannot sync environment because the bridge SharedSecret is empty after resolving secrets.");
                }
                return;
            }

            var payload = CreateEnvironmentPayload();
            var body = JsonConvert.SerializeObject(payload);
            var url = $"{TrimSlash(ResolveApiBaseUrl())}/api/server/environment-snapshot.php";

            SendPost(url, body, (code, response) =>
            {
                if (!IsSuccess(code, response, out var requestError))
                {
                    if (verbose)
                    {
                        reply?.Invoke($"Website environment sync failed: {requestError}");
                    }
                    return;
                }

                EnvironmentSnapshotResponse result = null;

                try
                {
                    result = JsonConvert.DeserializeObject<EnvironmentSnapshotResponse>(response);
                }
                catch (Exception ex)
                {
                    if (verbose)
                    {
                        reply?.Invoke($"Website environment sync returned invalid JSON: {ex.Message}");
                    }
                    return;
                }

                if (result == null || !result.ok)
                {
                    if (verbose)
                    {
                        reply?.Invoke($"Website environment sync failed: {result?.error ?? "invalid response"}");
                    }
                    return;
                }

                lastEnvironmentSyncAt = result.environment?.sampledAt ?? payload.sampled_at;
                if (verbose)
                {
                    reply?.Invoke($"Website environment synced: TOD {payload.rust_time:0.00}, sun y {payload.sun_direction.y:0.###}.");
                }
            });
        }

        private EnvironmentSnapshotPayload CreateEnvironmentPayload()
        {
            var rustTime = 12f;
            var sunDirection = new Vector3(0.5f, 0.78f, 0.36f).normalized;
            var sunIntensity = 1.65f;
            var ambientIntensity = 0.38f;
            var sunColor = "#ffc47a";
            var ambientColor = "#ffead2";
            float? cloudCoverage = null;
            float? rainIntensity = null;
            float? fogIntensity = null;

            var sky = TOD_Sky.Instance;
            if (sky != null)
            {
                rustTime = Mathf.Clamp((float)sky.Cycle.Hour, 0f, 24f);
                var components = ReadObjectProperty(sky, "Components");
                var sunTransform = ReadObjectProperty(components, "SunTransform") as Transform;
                var sunLight = ReadObjectProperty(components, "SunLight") as Light;
                sunDirection = sunTransform != null ? (-sunTransform.forward).normalized : SunDirectionFromHour(rustTime);
                sunIntensity = Mathf.Clamp(sunLight != null ? sunLight.intensity : SunIntensityFromDirection(sunDirection), 0f, 4f);
                ambientIntensity = Mathf.Clamp(Mathf.Lerp(0.14f, 0.48f, Mathf.Clamp01(sunDirection.y)), 0f, 2f);
                sunColor = ColorToHex(sunLight != null ? sunLight.color : SunColorFromDirection(sunDirection));
                ambientColor = ColorToHex(RenderSettings.ambientLight == default(Color) ? new Color(1f, 0.92f, 0.82f) : RenderSettings.ambientLight);
                cloudCoverage = ReadFloatProperty(ReadObjectProperty(sky, "Atmosphere"), "Cloudiness");

                try
                {
                    fogIntensity = Mathf.Clamp01(RenderSettings.fogDensity * 100f);
                }
                catch
                {
                    fogIntensity = null;
                }
            }
            else
            {
                sunDirection = SunDirectionFromHour(rustTime);
                sunIntensity = SunIntensityFromDirection(sunDirection);
                sunColor = ColorToHex(SunColorFromDirection(sunDirection));
            }

            var weatherSample = SampleWeatherAroundMapCenter();
            if (weatherSample.HasClouds)
            {
                cloudCoverage = weatherSample.Clouds;
            }
            if (weatherSample.HasRain)
            {
                rainIntensity = weatherSample.Rain;
            }
            if (weatherSample.HasFog)
            {
                fogIntensity = weatherSample.Fog;
            }

            return new EnvironmentSnapshotPayload
            {
                server_id = ResolveServerId(),
                wipe_key = ResolveWipeKey(),
                sampled_at = DateTime.UtcNow.ToString("o"),
                rust_time = (float)Math.Round(rustTime, 3),
                day_fraction = (float)Math.Round(Mathf.Repeat(rustTime / 24f, 1f), 6),
                sun_direction = new EnvironmentVectorPayload
                {
                    x = (float)Math.Round(sunDirection.x, 6),
                    y = (float)Math.Round(sunDirection.y, 6),
                    z = (float)Math.Round(sunDirection.z, 6)
                },
                sun_intensity = (float)Math.Round(sunIntensity, 4),
                sun_color = sunColor,
                ambient_intensity = (float)Math.Round(ambientIntensity, 4),
                ambient_color = ambientColor,
                cloud_coverage = cloudCoverage,
                rain_intensity = rainIntensity,
                fog_intensity = fogIntensity,
                weather_sample_summary = weatherSample.Summary
            };
        }

        private class WeatherSample
        {
            public float Clouds;
            public float Rain;
            public float Fog;
            public bool HasClouds;
            public bool HasRain;
            public bool HasFog;
            public string Summary = "weather unavailable";
        }

        private WeatherSample SampleWeatherAroundMapCenter()
        {
            var sample = new WeatherSample();
            var worldSize = Math.Max(1000f, ConVar.Server.worldsize);
            var offset = worldSize * 0.23f;
            var positions = new[]
            {
                Vector3.zero,
                new Vector3(offset, 0f, offset),
                new Vector3(-offset, 0f, offset),
                new Vector3(offset, 0f, -offset),
                new Vector3(-offset, 0f, -offset)
            };

            var clouds = SampleClimateMethod("GetClouds", positions, out var cloudSummary);
            var rain = SampleClimateMethod("GetRain", positions, out var rainSummary);
            var fog = SampleClimateMethod("GetFog", positions, out var fogSummary);

            if (clouds.HasValue)
            {
                sample.Clouds = clouds.Value;
                sample.HasClouds = true;
            }
            if (rain.HasValue)
            {
                sample.Rain = rain.Value;
                sample.HasRain = true;
            }
            if (fog.HasValue)
            {
                sample.Fog = fog.Value;
                sample.HasFog = true;
            }

            sample.Summary = $"cloudSource={cloudSummary}, rainSource={rainSummary}, fogSource={fogSummary}";
            return sample;
        }

        private float? SampleClimateMethod(string methodName, Vector3[] positions, out string summary)
        {
            summary = "missing";

            try
            {
                var climateType = AppDomain.CurrentDomain
                    .GetAssemblies()
                    .Select(assembly => assembly.GetType("Climate", false))
                    .FirstOrDefault(type => type != null);

                if (climateType == null)
                {
                    return null;
                }

                var methods = climateType
                    .GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)
                    .Where(method => method.Name.Equals(methodName, StringComparison.OrdinalIgnoreCase))
                    .ToArray();

                if (methods.Length == 0)
                {
                    return null;
                }

                var values = new List<float>();
                foreach (var position in positions)
                {
                    foreach (var method in methods)
                    {
                        var parameters = method.GetParameters();
                        object result;

                        if (parameters.Length == 1 && parameters[0].ParameterType == typeof(Vector3))
                        {
                            result = method.Invoke(null, new object[] { position });
                        }
                        else if (parameters.Length == 0)
                        {
                            result = method.Invoke(null, null);
                        }
                        else
                        {
                            continue;
                        }

                        if (TryConvertFloat(result, out var value))
                        {
                            values.Add(Mathf.Clamp01(value));
                            break;
                        }
                    }
                }

                if (values.Count == 0)
                {
                    summary = $"{methodName}:no numeric samples";
                    return null;
                }

                var average = values.Average();
                summary = $"{methodName}:{average:0.###} raw=avg={average:0.###} min={values.Min():0.###} max={values.Max():0.###} samples={values.Count}";
                return (float)Math.Round(average, 4);
            }
            catch (Exception ex)
            {
                summary = $"{methodName}:error {ex.GetType().Name}";
                return null;
            }
        }

        private bool TryConvertFloat(object value, out float result)
        {
            result = 0f;
            if (value == null)
            {
                return false;
            }

            try
            {
                result = Convert.ToSingle(value);
                return !float.IsNaN(result) && !float.IsInfinity(result);
            }
            catch
            {
                return false;
            }
        }

        private Vector3 SunDirectionFromHour(float hour)
        {
            var angle = Mathf.Repeat((hour - 6f) / 24f, 1f) * Mathf.PI * 2f;
            return new Vector3(Mathf.Cos(angle) * 0.42f, Mathf.Sin(angle), Mathf.Sin(angle) * 0.58f).normalized;
        }

        private float SunIntensityFromDirection(Vector3 direction)
        {
            return Mathf.Lerp(0.05f, 1.85f, Mathf.Clamp01(direction.y));
        }

        private Color SunColorFromDirection(Vector3 direction)
        {
            return Color.Lerp(new Color(1f, 0.36f, 0.22f), new Color(1f, 0.78f, 0.48f), Mathf.Clamp01(direction.y));
        }

        private float? ReadFloatProperty(object instance, string propertyName)
        {
            if (instance == null || string.IsNullOrWhiteSpace(propertyName))
            {
                return null;
            }

            try
            {
                var property = instance.GetType().GetProperty(propertyName);
                if (property == null)
                {
                    return null;
                }

                var value = property.GetValue(instance, null);
                if (value == null)
                {
                    return null;
                }

                return Mathf.Clamp01(Convert.ToSingle(value));
            }
            catch
            {
                return null;
            }
        }

        private object ReadObjectProperty(object instance, string propertyName)
        {
            if (instance == null || string.IsNullOrWhiteSpace(propertyName))
            {
                return null;
            }

            try
            {
                var property = instance.GetType().GetProperty(propertyName);
                return property == null ? null : property.GetValue(instance, null);
            }
            catch
            {
                return null;
            }
        }

        private string ColorToHex(Color color)
        {
            color.r = Mathf.Clamp01(color.r);
            color.g = Mathf.Clamp01(color.g);
            color.b = Mathf.Clamp01(color.b);
            return $"#{ColorUtility.ToHtmlStringRGB(color).ToLowerInvariant()}";
        }

        private void PublishPlayerLocations(Action<string> reply, bool verbose)
        {
            var secret = ResolveBridgeSharedSecret();

            if (string.IsNullOrWhiteSpace(secret))
            {
                if (verbose)
                {
                    reply?.Invoke("Cannot sync player locations because the bridge SharedSecret is empty after resolving secrets.");
                }
                return;
            }

            var players = new List<PlayerLocationPayload>();

            foreach (var player in BasePlayer.activePlayerList)
            {
                if (player == null || !player.IsConnected || player.userID == 0)
                {
                    continue;
                }

                var position = player.transform.position;
                players.Add(new PlayerLocationPayload
                {
                    steam_id64 = player.UserIDString,
                    display_name = player.displayName ?? "",
                    clan_tag = ResolveClanTag(player),
                    x = (float)Math.Round(position.x, 3),
                    y = (float)Math.Round(position.y, 3),
                    z = (float)Math.Round(position.z, 3)
                });
            }

            var payload = new PlayerLocationSnapshotPayload
            {
                server_id = ResolveServerId(),
                wipe_key = ResolveWipeKey(),
                sampled_at = DateTime.UtcNow.ToString("o"),
                players = players
            };
            var body = JsonConvert.SerializeObject(payload);
            var url = $"{TrimSlash(ResolveApiBaseUrl())}/api/server/player-locations-snapshot.php";

            SendPost(url, body, (code, response) =>
            {
                if (!IsSuccess(code, response, out var requestError))
                {
                    if (verbose)
                    {
                        reply?.Invoke($"Website player location sync failed: {requestError}");
                    }
                    return;
                }

                PlayerLocationSnapshotResponse result = null;

                try
                {
                    result = JsonConvert.DeserializeObject<PlayerLocationSnapshotResponse>(response);
                }
                catch (Exception ex)
                {
                    if (verbose)
                    {
                        reply?.Invoke($"Website player location sync returned invalid JSON: {ex.Message}");
                    }
                    return;
                }

                if (result == null || !result.ok)
                {
                    if (verbose)
                    {
                        reply?.Invoke($"Website player location sync failed: {result?.error ?? "invalid response"}");
                    }
                    return;
                }

                if (verbose)
                {
                    reply?.Invoke($"Website player locations synced: {result.locations?.acceptedPlayers ?? players.Count} connected players.");
                }
            });
        }

        private void PublishAirdropReplayEvent(BaseEntity entity)
        {
            var secret = ResolveBridgeSharedSecret();
            if (entity == null || entity.IsDestroyed || string.IsNullOrWhiteSpace(secret))
            {
                return;
            }

            var position = entity.transform.position;
            var payload = new ReplayEventSnapshotPayload
            {
                server_id = ResolveServerId(),
                wipe_key = ResolveWipeKey(),
                events = new List<ReplayEventPayload>
                {
                    new ReplayEventPayload
                    {
                        event_key = "airdrop:" + entity.net.ID.Value + ":" + DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
                        event_type = "airdrop",
                        occurred_at = DateTime.UtcNow.ToString("o"),
                        x = (float)Math.Round(position.x, 3),
                        y = (float)Math.Round(position.y, 3),
                        z = (float)Math.Round(position.z, 3),
                        vehicle = "cargo_plane",
                        payload = new Dictionary<string, object>
                        {
                            ["prefab"] = entity.PrefabName ?? entity.ShortPrefabName ?? "",
                            ["networkId"] = entity.net.ID.Value.ToString()
                        }
                    }
                }
            };
            var body = JsonConvert.SerializeObject(payload);
            var url = $"{TrimSlash(ResolveApiBaseUrl())}/api/server/map-replay-events-snapshot.php";

            SendPost(url, body, (code, response) =>
            {
                if (!IsSuccess(code, response, out var requestError))
                {
                    PrintWarning("Website airdrop replay event post failed: " + requestError);
                }
            });
        }

        private string ResolveClanTag(BasePlayer player)
        {
            if (player == null || Clans == null || !Clans.IsLoaded)
            {
                return "";
            }

            try
            {
                var byString = Clans.Call("GetClanOf", player.UserIDString);
                var tag = ClanTagFromResult(byString);

                if (!string.IsNullOrWhiteSpace(tag))
                {
                    return tag;
                }

                var byId = Clans.Call("GetClanOf", player.userID);
                return ClanTagFromResult(byId);
            }
            catch
            {
                return "";
            }
        }

        private string ClanTagFromResult(object result)
        {
            if (result == null)
            {
                return "";
            }

            if (result is string text)
            {
                return text.Trim();
            }

            var token = result as JObject;
            if (token != null)
            {
                return FirstNonEmpty(token.Value<string>("tag"), token.Value<string>("Tag"), token.Value<string>("clan_tag"));
            }

            return "";
        }

        private void PublishMap(string reason, Action<string> reply, bool force, string renderName, float scale)
        {
            if (publishInFlight)
            {
                reply?.Invoke("Website map publish is already in progress.");
                return;
            }

            if (!CanPublish(out var error))
            {
                reply?.Invoke(error);
                return;
            }

            var wipeKey = ResolveWipeKey();

            if (!force && string.Equals(lastPublishedWipeKey, wipeKey, StringComparison.OrdinalIgnoreCase))
            {
                reply?.Invoke($"Website map already published for wipe key {wipeKey}.");
                return;
            }

            publishInFlight = true;
            renderName = string.IsNullOrWhiteSpace(renderName) ? config.RenderName : renderName.Trim();
            scale = Math.Max(0.05f, scale);

            try
            {
                var resolution = Math.Max(64, (int)Math.Round(World.Size * scale));
                var encoding = GetEncodingMode();
                var mapObject = RustMapApi.Call("CreatePluginImage", this, renderName, resolution, encoding);

                if (!(mapObject is Hash<string, object> map))
                {
                    publishInFlight = false;
                    reply?.Invoke($"RustMapApi could not render {renderName}: {mapObject ?? "empty response"}");
                    return;
                }

                var image = map["image"] as byte[];

                if (image == null || image.Length == 0)
                {
                    publishInFlight = false;
                    reply?.Invoke($"RustMapApi returned an empty {renderName} image.");
                    return;
                }

                var textureRenderName = string.IsNullOrWhiteSpace(config.TextureRenderName) ? "Default" : config.TextureRenderName.Trim();
                var textureImage = RenderTextureImage(textureRenderName, renderName, resolution, encoding, out textureRenderName);
                var skyboxImage = LoadSkyboxImage(out var skyboxSummary);

                var payload = new MapUploadPayload
                {
                    server_id = ResolveServerId(),
                    wipe_key = wipeKey,
                    map_name = GetMapDisplayName(),
                    render_name = renderName,
                    file_type = encoding == EncodingPng ? "Png" : "Jpg",
                    image_base64 = Convert.ToBase64String(image),
                    image_sha256 = Sha256Bytes(image),
                    texture_render_name = textureRenderName,
                    texture_image_base64 = textureImage != null && textureImage.Length > 0 ? Convert.ToBase64String(textureImage) : "",
                    texture_image_sha256 = textureImage != null && textureImage.Length > 0 ? Sha256Bytes(textureImage) : "",
                    skybox_image_base64 = skyboxImage != null && skyboxImage.Length > 0 ? Convert.ToBase64String(skyboxImage) : "",
                    skybox_image_sha256 = skyboxImage != null && skyboxImage.Length > 0 ? Sha256Bytes(skyboxImage) : "",
                    image_width = Convert.ToInt32(map["width"]),
                    image_height = Convert.ToInt32(map["height"]),
                    resolution = resolution,
                    world_size = Math.Max(0, ConVar.Server.worldsize),
                    seed = Math.Max(0, ConVar.Server.seed),
                    protocol = Rust.Protocol.network,
                    generated_at = DateTime.UtcNow.ToString("o")
                };
                payload.terrain = CreateTerrainPayload(payload.server_id, wipeKey, payload.map_name, payload.generated_at, out var terrainSummary);

                var body = JsonConvert.SerializeObject(payload);
                var url = $"{TrimSlash(ResolveApiBaseUrl())}/api/server/map-upload.php";

                var textureSummary = textureImage != null && textureImage.Length > 0 ? $", texture {textureRenderName} {textureImage.Length} bytes" : "";
                Puts($"Publishing {renderName} map to website ({payload.image_width}x{payload.image_height}, {image.Length} bytes{textureSummary}, {terrainSummary}, {skyboxSummary}) after {reason}.");
                SendPost(url, body, (code, response) =>
                {
                    publishInFlight = false;

                    if (!IsSuccess(code, response, out var requestError))
                    {
                        reply?.Invoke($"Website map publish failed: {requestError}");
                        return;
                    }

                    MapUploadResponse result = null;

                    try
                    {
                        result = JsonConvert.DeserializeObject<MapUploadResponse>(response);
                    }
                    catch (Exception ex)
                    {
                        reply?.Invoke($"Website map publish returned invalid JSON: {ex.Message}");
                        return;
                    }

                    if (result == null || !result.ok)
                    {
                        reply?.Invoke($"Website map publish failed: {result?.error ?? "invalid response"}");
                        return;
                    }

                    lastPublishedWipeKey = wipeKey;
                    var publicUrl = FirstNonEmpty(result.map?.url, result.map?.publicUrl, result.url);
                    var textureUrl = result.map?.textureUrl ?? "";
                    var terrainUrl = result.map?.terrainUrl ?? "";
                    var skyboxUrl = result.map?.skyboxUrl ?? "";

                    if (payload.terrain != null && string.IsNullOrWhiteSpace(terrainUrl))
                    {
                        reply?.Invoke($"Website map published: {publicUrl}. Terrain was sent, but the website response did not include a terrain URL; confirm database/migrations/050_server_map_terrain.sql and the website upload files are live.");
                        return;
                    }

                    if (!string.IsNullOrWhiteSpace(terrainUrl))
                    {
                        var terrainResolution = result.map?.terrainResolution ?? payload.terrain?.resolution ?? 0;
                        var textureMessage = string.IsNullOrWhiteSpace(textureUrl) ? "" : $" texture: {textureUrl};";
                        var skyboxMessage = string.IsNullOrWhiteSpace(skyboxUrl) ? "" : $" skybox: {skyboxUrl};";
                        reply?.Invoke($"Website map published: {publicUrl};{textureMessage}{skyboxMessage} terrain {terrainResolution}x{terrainResolution}: {terrainUrl}");
                        return;
                    }

                    reply?.Invoke($"Website map published: {publicUrl}");
                });
            }
            catch (Exception ex)
            {
                publishInFlight = false;
                reply?.Invoke($"Website map publish failed: {ex.GetType().Name}: {ex.Message}");
            }
        }

        private bool CanPublish(out string error)
        {
            if (RustMapApi == null || !RustMapApi.IsLoaded)
            {
                error = "Cannot publish map because RustMapApi is not loaded.";
                return false;
            }

            if (!RustMapApi.Call<bool>("IsReady"))
            {
                error = "Cannot publish map because RustMapApi is not ready yet.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(ResolveBridgeSharedSecret()))
            {
                error = "Cannot publish map because the bridge SharedSecret is empty after resolving secrets.";
                return false;
            }

            error = "";
            return true;
        }

        private byte[] RenderTextureImage(string configuredRenderName, string publicRenderName, int resolution, int encoding, out string usedRenderName)
        {
            usedRenderName = configuredRenderName;
            var candidates = new List<string>();

            AddRenderCandidate(candidates, configuredRenderName);
            AddRenderCandidate(candidates, "Default");

            foreach (var candidate in candidates)
            {
                if (string.Equals(candidate, publicRenderName, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var textureObject = RustMapApi.Call("CreatePluginImage", this, candidate, resolution, encoding);

                if (textureObject is Hash<string, object> textureMap)
                {
                    var image = textureMap["image"] as byte[];

                    if (image != null && image.Length > 0)
                    {
                        usedRenderName = candidate;
                        return image;
                    }
                }

                PrintWarning($"RustMapApi returned an empty {candidate} texture render.");
            }

            PrintWarning($"Terrain viewer texture render failed; it will fall back to {publicRenderName}.");
            return null;
        }

        private static void AddRenderCandidate(List<string> candidates, string renderName)
        {
            renderName = (renderName ?? "").Trim();

            if (renderName.Length == 0 || candidates.Any(existing => existing.Equals(renderName, StringComparison.OrdinalIgnoreCase)))
            {
                return;
            }

            candidates.Add(renderName);
        }

        private byte[] LoadSkyboxImage(out string summary)
        {
            if (!config.PublishSkybox)
            {
                summary = "skybox disabled";
                return null;
            }

            var configuredPath = (config.SkyboxImagePath ?? "").Trim();

            if (string.IsNullOrWhiteSpace(configuredPath))
            {
                summary = "skybox skipped: no path";
                return null;
            }

            var path = ResolveServerPath(configuredPath);

            if (!File.Exists(path))
            {
                summary = $"skybox skipped: missing {configuredPath}";
                return null;
            }

            try
            {
                var bytes = File.ReadAllBytes(path);
                summary = bytes.Length > 0 ? $"skybox {configuredPath} {bytes.Length} bytes" : $"skybox skipped: empty {configuredPath}";
                return bytes.Length > 0 ? bytes : null;
            }
            catch (Exception ex)
            {
                summary = $"skybox skipped: {ex.Message}";
                return null;
            }
        }

        private static string ResolveServerPath(string path)
        {
            path = (path ?? "").Trim().Replace('/', Path.DirectorySeparatorChar);

            if (Path.IsPathRooted(path))
            {
                return path;
            }

            return Path.Combine(Interface.Oxide.RootDirectory, path);
        }

        private TerrainUploadPayload CreateTerrainPayload(string serverId, string wipeKey, string mapName, string generatedAt, out string summary)
        {
            if (!config.PublishTerrain)
            {
                summary = "terrain disabled";
                return null;
            }

            if (TerrainMeta.HeightMap == null)
            {
                summary = "terrain skipped: heightmap unavailable";
                PrintWarning("Terrain export skipped because TerrainMeta.HeightMap is not available.");
                return null;
            }

            var resolution = Mathf.Clamp(config.TerrainSampleResolution, 17, 257);

            if (resolution % 2 == 0)
            {
                resolution += 1;
            }

            var worldSize = Math.Max(1, ConVar.Server.worldsize);
            var half = worldSize * 0.5f;
            var heights = new List<float>(resolution * resolution);
            var colors = config.IncludeTerrainColors ? new List<string>(resolution * resolution) : null;
            var minHeight = float.MaxValue;
            var maxHeight = float.MinValue;
            var waterLevel = EstimateOceanWaterLevel(worldSize, resolution);

            for (var row = 0; row < resolution; row++)
            {
                var v = resolution <= 1 ? 0f : row / (float)(resolution - 1);
                var z = half - (v * worldSize);

                for (var col = 0; col < resolution; col++)
                {
                    var u = resolution <= 1 ? 0f : col / (float)(resolution - 1);
                    var x = -half + (u * worldSize);
                    var position = new Vector3(x, 0f, z);
                    var height = TerrainMeta.HeightMap.GetHeight(position);

                    var sampleWaterLevel = TerrainMeta.WaterMap != null ? TerrainMeta.WaterMap.GetHeight(position) : 0f;

                    minHeight = Math.Min(minHeight, height);
                    maxHeight = Math.Max(maxHeight, height);
                    heights.Add((float)Math.Round(height, 3));

                    if (colors != null)
                    {
                        colors.Add(TerrainColor(position, height, sampleWaterLevel));
                    }
                }
            }

            if (minHeight == float.MaxValue)
            {
                minHeight = 0f;
            }

            if (maxHeight == float.MinValue)
            {
                maxHeight = 0f;
            }

            var monuments = CreateMonumentPayloads();
            summary = $"terrain {resolution}x{resolution}, height {minHeight:0.###}-{maxHeight:0.###}, ocean {waterLevel:0.###}, monuments {monuments.Count}";

            return new TerrainUploadPayload
            {
                serverId = serverId,
                wipeKey = wipeKey,
                mapName = mapName,
                resolution = resolution,
                worldSize = worldSize,
                seed = Math.Max(0, ConVar.Server.seed),
                waterLevel = (float)Math.Round(waterLevel, 3),
                minHeight = (float)Math.Round(minHeight, 3),
                maxHeight = (float)Math.Round(maxHeight, 3),
                generatedAt = generatedAt,
                heights = heights,
                colors = colors,
                monuments = monuments
            };
        }

        private float EstimateOceanWaterLevel(float worldSize, int resolution)
        {
            if (TerrainMeta.WaterMap == null)
            {
                return 0f;
            }

            var half = worldSize * 0.5f;
            var samples = new List<float>();
            var edgeSamples = Mathf.Clamp(resolution, 17, 129);

            for (var index = 0; index < edgeSamples; index++)
            {
                var t = edgeSamples <= 1 ? 0f : index / (float)(edgeSamples - 1);
                var coord = -half + (t * worldSize);
                AddWaterLevelSample(samples, new Vector3(coord, 0f, half));
                AddWaterLevelSample(samples, new Vector3(coord, 0f, -half));
                AddWaterLevelSample(samples, new Vector3(-half, 0f, coord));
                AddWaterLevelSample(samples, new Vector3(half, 0f, coord));
            }

            if (samples.Count == 0)
            {
                return 0f;
            }

            samples.Sort();
            return samples[samples.Count / 2];
        }

        private void AddWaterLevelSample(List<float> samples, Vector3 position)
        {
            var waterLevel = TerrainMeta.WaterMap.GetHeight(position);

            if (!float.IsNaN(waterLevel) && !float.IsInfinity(waterLevel))
            {
                samples.Add(waterLevel);
            }
        }

        private List<MonumentUploadPayload> CreateMonumentPayloads()
        {
            var monuments = new List<MonumentUploadPayload>();

            if (!config.IncludeMonuments || TerrainMeta.Path == null || TerrainMeta.Path.Monuments == null)
            {
                return monuments;
            }

            foreach (var monument in TerrainMeta.Path.Monuments)
            {
                if (monument == null || monument.transform == null)
                {
                    continue;
                }

                var position = monument.transform.position;
                var prefab = ShortPrefabName(monument.name);
                var name = MonumentDisplayName(monument, prefab);

                monuments.Add(new MonumentUploadPayload
                {
                    name = name,
                    prefab = prefab,
                    kind = MonumentKind(name, prefab),
                    x = (float)Math.Round(position.x, 3),
                    y = (float)Math.Round(position.y, 3),
                    z = (float)Math.Round(position.z, 3),
                    radius = (float)Math.Round(MonumentRadius(prefab), 3),
                    rotationY = (float)Math.Round(monument.transform.rotation.eulerAngles.y, 3)
                });
            }

            return monuments;
        }

        private string MonumentDisplayName(MonumentInfo monument, string prefab)
        {
            var name = monument.displayPhrase != null ? (monument.displayPhrase.english ?? "").Replace("\n", "").Trim() : "";

            if (!string.IsNullOrWhiteSpace(name))
            {
                return name;
            }

            if (monument.Type == MonumentType.Cave)
            {
                return "Cave";
            }

            if (prefab.Contains("power_sub"))
            {
                return "Power Sub Station";
            }

            return string.IsNullOrWhiteSpace(prefab) ? "Monument" : prefab;
        }

        private string ShortPrefabName(string prefab)
        {
            prefab = prefab ?? "";
            var separator = prefab.LastIndexOf('/');

            if (separator >= 0 && separator < prefab.Length - 1)
            {
                prefab = prefab.Substring(separator + 1);
            }

            return prefab.Replace(".prefab", "");
        }

        private string MonumentKind(string name, string prefab)
        {
            var key = ((name ?? "") + " " + (prefab ?? "")).ToLowerInvariant();

            if (key.Contains("airfield")) return "airfield";
            if (key.Contains("launch")) return "launch_site";
            if (key.Contains("sphere") || key.Contains("dome")) return "dome";
            if (key.Contains("satellite")) return "satellite";
            if (key.Contains("lighthouse")) return "lighthouse";
            if (key.Contains("oilrig") || key.Contains("oil rig")) return "oilrig";
            if (key.Contains("harbor")) return "harbor";
            if (key.Contains("powerplant") || key.Contains("power plant")) return "powerplant";
            if (key.Contains("excavator")) return "excavator";
            if (key.Contains("trainyard") || key.Contains("train yard")) return "trainyard";
            if (key.Contains("military") || key.Contains("tunnel") || key.Contains("bunker")) return "military_tunnel";
            if (key.Contains("gas")) return "gas_station";
            if (key.Contains("supermarket")) return "supermarket";
            if (key.Contains("warehouse")) return "warehouse";
            if (key.Contains("quarry") || key.Contains("mining")) return "quarry";
            if (key.Contains("bandit") || key.Contains("compound")) return "settlement";
            if (key.Contains("fishing") || key.Contains("stables")) return "village";

            return "monument";
        }

        private float MonumentRadius(string prefab)
        {
            switch (prefab)
            {
                case "airfield_1": return 255f;
                case "bandit_town": return 105f;
                case "compound": return 255f;
                case "excavator_1": return 150f;
                case "gas_station_1": return 60f;
                case "harbor_1":
                case "harbor_2": return 135f;
                case "junkyard_1": return 105f;
                case "launch_site_1": return 245f;
                case "lighthouse": return 50f;
                case "military_tunnel_1": return 105f;
                case "mining_quarry_a":
                case "mining_quarry_b":
                case "mining_quarry_c": return 30f;
                case "OilrigAI": return 100f;
                case "OilrigAI2": return 200f;
                case "power_sub_big_1":
                case "power_sub_big_2": return 30f;
                case "power_sub_small_1":
                case "power_sub_small_2": return 25f;
                case "powerplant_1": return 145f;
                case "radtown_small_3": return 95f;
                case "satellite_dish": return 85f;
                case "sphere_tank": return 75f;
                case "supermarket_1": return 60f;
                case "trainyard_1": return 145f;
                case "warehouse": return 50f;
                case "water_treatment_plant_1": return 175f;
            }

            if (prefab != null && prefab.Contains("cave")) return 75f;
            if (prefab != null && prefab.Contains("fishing_village")) return 55f;
            if (prefab != null && prefab.Contains("stables")) return 80f;
            if (prefab != null && prefab.Contains("swamp")) return 55f;
            if (prefab != null && prefab.Contains("water_well")) return 30f;

            return 50f;
        }

        private string TerrainColor(Vector3 position, float height, float waterLevel)
        {
            if (TerrainMeta.WaterMap != null && height <= waterLevel + 0.35f)
            {
                return "#2f6f86";
            }

            var splat = TerrainMeta.SplatMap != null ? TerrainMeta.SplatMap.GetSplatMaxType(position).ToString().ToLowerInvariant() : "";
            var biome = TerrainMeta.BiomeMap != null ? TerrainMeta.BiomeMap.GetBiomeMaxType(position).ToString().ToLowerInvariant() : "";

            if (splat.Contains("snow") || biome.Contains("arctic") || biome.Contains("tundra"))
            {
                return "#d9dedc";
            }

            if (splat.Contains("sand") || biome.Contains("desert"))
            {
                return "#b79a6a";
            }

            if (splat.Contains("forest") || biome.Contains("forest"))
            {
                return "#315a39";
            }

            if (splat.Contains("grass") || biome.Contains("temperate"))
            {
                return "#587447";
            }

            if (splat.Contains("rock") || splat.Contains("stone"))
            {
                return "#6e7470";
            }

            if (splat.Contains("dirt") || splat.Contains("gravel") || splat.Contains("road"))
            {
                return "#705b43";
            }

            return "#586d49";
        }

        private void SendPost(string url, string body, Action<int, string> callback)
        {
            var headers = BuildHeaders("POST", url, body);
            headers["Content-Type"] = "application/json";
            webrequest.Enqueue(url, body, (code, response) => callback(code, response ?? ""), this, RequestMethod.POST, headers, WebRequestTimeoutMilliseconds());
        }

        private float WebRequestTimeoutMilliseconds()
        {
            return (float)Math.Max(5000, config.WebRequestTimeoutMilliseconds);
        }

        private Dictionary<string, string> BuildHeaders(string method, string url, string body)
        {
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
            var pathAndQuery = new Uri(url).PathAndQuery;
            var bodyHash = Sha256(body ?? "");
            var payload = $"{method.ToUpperInvariant()}\n{pathAndQuery}\n{timestamp}\n{bodyHash}";
            var signature = HmacSha256(payload, ResolveBridgeSharedSecret());

            return new Dictionary<string, string>
            {
                ["X-Raidlands-Server"] = ResolveServerId(),
                ["X-Raidlands-Timestamp"] = timestamp,
                ["X-Raidlands-Signature"] = signature,
                ["Accept"] = "application/json"
            };
        }

        private void LogBridgeSecretDiagnostics()
        {
            var sharedSecret = ResolveBridgeSharedSecret();

            if (string.IsNullOrWhiteSpace(sharedSecret))
            {
                PrintWarning("Map bridge SharedSecret is empty after resolving secrets.");
                return;
            }

            Puts($"Map bridge SharedSecret source: {DescribeBridgeSecretSource()}; length: {sharedSecret.Length}; fingerprint: {SecretFingerprint(sharedSecret)}");
        }

        private string ResolveApiBaseUrl()
        {
            var configured = (config.ApiBaseUrl ?? "").Trim();

            if (!string.IsNullOrWhiteSpace(configured))
            {
                return configured;
            }

            return FirstNonEmpty(LoadVipBridgeSetting("ApiBaseUrl"), "https://raidlands.net");
        }

        private string ResolveServerId()
        {
            var configured = (config.ServerId ?? "").Trim();

            if (!string.IsNullOrWhiteSpace(configured))
            {
                return configured;
            }

            return FirstNonEmpty(LoadVipBridgeSetting("ServerId"), "raidlands-main");
        }

        private string ResolveWipeKey()
        {
            var configured = ResolveSecretValue(config.WipeKey);

            if (!string.IsNullOrWhiteSpace(configured))
            {
                return configured.Trim();
            }

            configured = ResolveSecretValue(LoadVipBridgeSetting("WipeKey"));

            if (!string.IsNullOrWhiteSpace(configured))
            {
                return configured.Trim();
            }

            return $"{ResolveServerId()}-current";
        }

        private string ResolveBridgeSharedSecret()
        {
            var configuredSecret = ResolveSecretValue(config.SharedSecret);

            if (!string.IsNullOrWhiteSpace(configuredSecret))
            {
                return configuredSecret;
            }

            return ResolveSecretValue(LoadVipBridgeSetting("SharedSecret"));
        }

        private string DescribeBridgeSecretSource()
        {
            var configuredSecret = ResolveSecretValue(config.SharedSecret);

            if (!string.IsNullOrWhiteSpace(configuredSecret))
            {
                return DescribeSecretSource(config.SharedSecret, "WebsiteMapBridge");
            }

            var vipSetting = LoadVipBridgeSetting("SharedSecret");

            if (string.IsNullOrWhiteSpace(vipSetting))
            {
                return $"oxide/config/{VipBridgeConfigName}.json";
            }

            return $"{DescribeSecretSource(vipSetting, VipBridgeConfigName)} via oxide/config/{VipBridgeConfigName}.json";
        }

        private string ResolveSecretValue(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return value;
            }

            var trimmed = value.Trim();

            if (!trimmed.StartsWith("${", StringComparison.Ordinal) || !trimmed.EndsWith("}", StringComparison.Ordinal))
            {
                return trimmed;
            }

            var key = trimmed.Substring(2, trimmed.Length - 3).Trim();

            if (string.IsNullOrWhiteSpace(key))
            {
                return "";
            }

            string secret;

            if (LoadSecrets().TryGetValue(key, out secret))
            {
                return (secret ?? "").Trim();
            }

            PrintWarning($"Secret variable {key} is not configured in oxide/config/{SecretsConfigName}.json.");
            return "";
        }

        private string DescribeSecretSource(string value, string configName)
        {
            var trimmed = (value ?? "").Trim();

            if (!trimmed.StartsWith("${", StringComparison.Ordinal) || !trimmed.EndsWith("}", StringComparison.Ordinal))
            {
                return $"oxide/config/{configName}.json";
            }

            var key = trimmed.Substring(2, trimmed.Length - 3).Trim();
            var source = string.IsNullOrWhiteSpace(secretsConfigSource) ? $"oxide/config/{SecretsConfigName}.json" : secretsConfigSource;

            return $"{key} in {source}";
        }

        private Dictionary<string, string> LoadSecrets()
        {
            if (secrets != null)
            {
                return secrets;
            }

            secrets = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var path = Path.Combine(Interface.Oxide.ConfigDirectory, $"{SecretsConfigName}.json");
            secretsConfigSource = $"oxide/config/{SecretsConfigName}.json";

            if (!File.Exists(path))
            {
                PrintWarning($"Optional secrets file not found: oxide/config/{SecretsConfigName}.json.");
                return secrets;
            }

            try
            {
                var loadedSecrets = JsonConvert.DeserializeObject<Dictionary<string, string>>(File.ReadAllText(path));

                if (loadedSecrets != null)
                {
                    secrets = new Dictionary<string, string>(loadedSecrets, StringComparer.OrdinalIgnoreCase);
                }
            }
            catch (Exception ex)
            {
                PrintWarning($"Could not read oxide/config/{SecretsConfigName}.json: {ex.Message}");
            }

            return secrets;
        }

        private string LoadVipBridgeSetting(string key)
        {
            var bridgeConfig = LoadVipBridgeConfig();

            if (bridgeConfig == null)
            {
                return "";
            }

            return (bridgeConfig.Value<string>(key) ?? "").Trim();
        }

        private JObject LoadVipBridgeConfig()
        {
            if (vipBridgeConfig != null)
            {
                return vipBridgeConfig;
            }

            var path = Path.Combine(Interface.Oxide.ConfigDirectory, $"{VipBridgeConfigName}.json");

            if (!File.Exists(path))
            {
                PrintWarning($"VIP bridge config not found: oxide/config/{VipBridgeConfigName}.json.");
                return null;
            }

            try
            {
                vipBridgeConfig = JObject.Parse(File.ReadAllText(path));
            }
            catch (Exception ex)
            {
                PrintWarning($"Could not read oxide/config/{VipBridgeConfigName}.json: {ex.Message}");
            }

            return vipBridgeConfig;
        }

        private string GetMapDisplayName()
        {
            var saveFile = World.SaveFileName ?? "";

            if (saveFile.StartsWith("proceduralmap", StringComparison.OrdinalIgnoreCase))
            {
                return "Procedural Map";
            }

            if (!string.IsNullOrWhiteSpace(saveFile))
            {
                var name = Path.GetFileNameWithoutExtension(saveFile).Replace('_', ' ').Replace('-', ' ').Trim();
                return string.IsNullOrWhiteSpace(name) ? "Procedural Map" : name;
            }

            return "Procedural Map";
        }

        private int GetEncodingMode()
        {
            return string.Equals(config.FileType, "Png", StringComparison.OrdinalIgnoreCase) ? EncodingPng : EncodingJpg;
        }

        private void NormalizeConfig(bool hasPublishSkyboxSetting)
        {
            var defaults = new Configuration();
            config.ApiBaseUrl = ConfiguredOrDefault(config.ApiBaseUrl, defaults.ApiBaseUrl);
            config.ServerId = ConfiguredOrDefault(config.ServerId, defaults.ServerId);
            config.RenderName = ConfiguredOrDefault(config.RenderName, defaults.RenderName);
            config.TextureRenderName = ConfiguredOrDefault(config.TextureRenderName, defaults.TextureRenderName);
            config.FileType = string.Equals(config.FileType, "Png", StringComparison.OrdinalIgnoreCase) ? "Png" : "Jpg";
            config.ImageResolutionScale = Math.Max(0.05f, config.ImageResolutionScale <= 0f ? defaults.ImageResolutionScale : config.ImageResolutionScale);
            config.AutoPublishDelaySeconds = Math.Max(1, config.AutoPublishDelaySeconds);
            config.WebRequestTimeoutMilliseconds = Math.Max(5000, config.WebRequestTimeoutMilliseconds);
            config.TerrainSampleResolution = Math.Max(17, Math.Min(257, config.TerrainSampleResolution <= 0 ? defaults.TerrainSampleResolution : config.TerrainSampleResolution));
            config.SkyboxImagePath = ConfiguredOrDefault(config.SkyboxImagePath, defaults.SkyboxImagePath);
            if (!hasPublishSkyboxSetting)
            {
                config.PublishSkybox = defaults.PublishSkybox;
            }
            config.PlayerLocationIntervalSeconds = Math.Max(5, config.PlayerLocationIntervalSeconds <= 0 ? defaults.PlayerLocationIntervalSeconds : config.PlayerLocationIntervalSeconds);
            config.EnvironmentIntervalSeconds = Math.Max(5, config.EnvironmentIntervalSeconds <= 0 ? defaults.EnvironmentIntervalSeconds : config.EnvironmentIntervalSeconds);
        }

        private bool ConfigHasProperty(string propertyName)
        {
            try
            {
                var path = Path.Combine(Interface.Oxide.ConfigDirectory, $"{Name}.json");

                if (!File.Exists(path))
                {
                    return false;
                }

                var json = JObject.Parse(File.ReadAllText(path));
                return json.Properties().Any(property => property.Name.Equals(propertyName, StringComparison.OrdinalIgnoreCase));
            }
            catch
            {
                return false;
            }
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

        private static string ConfiguredOrDefault(string value, string fallback)
        {
            return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
        }

        private static string FirstNonEmpty(params string[] values)
        {
            foreach (var value in values ?? Array.Empty<string>())
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value.Trim();
                }
            }

            return "";
        }

        private static string TrimSlash(string value)
        {
            return (value ?? "").Trim().TrimEnd('/');
        }

        private static string Sha256(string value)
        {
            using (var sha = SHA256.Create())
            {
                return Hex(sha.ComputeHash(Encoding.UTF8.GetBytes(value)));
            }
        }

        private static string Sha256Bytes(byte[] value)
        {
            using (var sha = SHA256.Create())
            {
                return Hex(sha.ComputeHash(value ?? Array.Empty<byte>()));
            }
        }

        private static string HmacSha256(string value, string secret)
        {
            using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret ?? "")))
            {
                return Hex(hmac.ComputeHash(Encoding.UTF8.GetBytes(value ?? "")));
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

        private static string SecretFingerprint(string value)
        {
            var hash = Sha256(value ?? "");
            return hash.Length <= 12 ? hash : hash.Substring(0, 12);
        }
    }
}
