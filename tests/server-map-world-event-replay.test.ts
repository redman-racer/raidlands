import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  replayTimelineFrameIntervalMs,
  replayTimelineHistoryRate,
  rustWorldQuaternionToViewerQuaternion,
  sampleTimestampedWorldRoute,
  worldVehiclePositionIsOnMap,
} from "../assets/ts/server-map-viewer/world-event-replay-policy";

function displayedVehicleForward(rotation: Quaternion): Vector3 {
  return new Vector3(0, 0, -1).applyQuaternion(rotation).normalize();
}

describe("server-map live world-event replay", () => {
  it("faces viewer vehicles along Rust travel after the mirrored-X conversion", () => {
    expect(displayedVehicleForward(rustWorldQuaternionToViewerQuaternion({ x: 0, y: 0, z: 0, w: 1 })).z).toBeCloseTo(1, 6);

    const halfYaw = Math.PI / 4;
    const yawRight = rustWorldQuaternionToViewerQuaternion({
      x: 0,
      y: Math.sin(halfYaw),
      z: 0,
      w: Math.cos(halfYaw),
    });
    const forward = displayedVehicleForward(yawRight);
    expect(forward.x).toBeCloseTo(-1, 6);
    expect(forward.z).toBeCloseTo(0, 6);
  });

  it("makes timeline 1x exactly real-time", () => {
    expect(replayTimelineFrameIntervalMs(60, 0.25)).toBe(240_000);
    expect(replayTimelineFrameIntervalMs(60, 1)).toBe(60_000);
    expect(replayTimelineFrameIntervalMs(300, 2)).toBe(150_000);
    expect(replayTimelineHistoryRate(60, 0.25)).toBe(0.25);
    expect(replayTimelineHistoryRate(60, 1)).toBe(1);
  });

  it("interpolates vehicle routes by their actual timestamps and bounds live extrapolation", () => {
    const route = [
      { timestampMs: 1_000, position: new Vector3(0, 0, 0), rotation: new Quaternion() },
      { timestampMs: 6_000, position: new Vector3(10, 0, 0), rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI) },
    ];
    const middle = sampleTimestampedWorldRoute(route, 3_500);
    expect(middle?.position.x).toBeCloseTo(5);
    const extrapolated = sampleTimestampedWorldRoute(route, 20_000, new Vector3(2, 0, 0), 5_000);
    expect(extrapolated?.position.x).toBeCloseTo(20);
  });

  it("de-renders vehicles once their center reaches the map boundary", () => {
    expect(worldVehiclePositionIsOnMap({ x: 2249.9, z: -120 }, 4500)).toBe(true);
    expect(worldVehiclePositionIsOnMap({ x: 2250, z: -120 }, 4500)).toBe(false);
    expect(worldVehiclePositionIsOnMap({ x: 120, z: -2251 }, 4500)).toBe(false);
  });

  it("refreshes reused live-timeline vehicle runs with each server route update", () => {
    const viewerSource = readFileSync(resolve("assets/ts/server-map-viewer/app.ts"), "utf8");
    expect(viewerSource).toContain("if (!replayEventIsWorldVehicle(event))");
    expect(viewerSource).not.toContain("if (!this.persistent || !replayWorldVehicleIsActive(event))");
  });

  it("keeps portable-airstrike carriers in the live world-entity feed", () => {
    const source = readFileSync(resolve("server-plugins/WebsiteMapBridge.cs"), "utf8");
    expect(source).toContain('[Info("WebsiteMapBridge", "Raidlands", "1.1.0")]');
    expect(source).not.toContain("API_IsWebsiteReplayCarrier");
    expect(source).toContain("if (!TryDescribeWorldEntity(entity, out descriptor))");
    expect(source).toContain('typeName.Contains("f15") || prefab.Contains("f15")');
    expect(source).toContain('prefab.Contains("cargoplane")');
    expect(source).toContain("WorldEventInFlightTimeoutSeconds()");
  });

  it("polls live events even when heat-map and player overlays are off", () => {
    const viewerSource = readFileSync(resolve("assets/ts/server-map-viewer/app.ts"), "utf8");
    expect(viewerSource).not.toContain("wantsTimelineOverlay() || !(wantsHeatmap() || wantsPlayers())");
    expect(viewerSource).toContain("selectLiveReplayEvents(normalizedFrames");
  });

  it("serves replay frames live and bounds them by the active wipe start", () => {
    const serverSource = readFileSync(resolve("includes/server-status.php"), "utf8");
    expect(serverSource).toContain("['label' => 'Live', 'delay_seconds' => 0]");
    expect(serverSource).toContain("raidlands_server_map_replay_current_wipe_started_at");
    expect(serverSource).not.toContain("wipe_key IN (' . implode(', ', $wipe_placeholders)");
  });
});
