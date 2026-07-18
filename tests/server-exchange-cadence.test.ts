import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(resolve(__dirname, "..", path), "utf8");

describe("centralized server exchange cadence", () => {
  it("uses a 30-second exchange and a four-interval status freshness window", () => {
    const config = read("includes/config.php");
    const status = read("includes/server-status.php");

    expect(config).toContain("RAIDLANDS_SERVER_EXCHANGE_INTERVAL_SECONDS', 30");
    expect(config).toContain("RAIDLANDS_SERVER_STATUS_STALE_SECONDS', 120");
    expect(status).toContain("return max($exchange_seconds * 4, $configured_seconds);");
  });

  it("passes the exchange cadence to both 3D map viewers", () => {
    for (const page of ["pages/home.php", "pages/server.php"]) {
      expect(read(page)).toContain('data-live-refresh-seconds="<?= e((string) ($site_config[\'serverStats\'][\'exchangeSeconds\'] ?? 30)) ?>"');
    }
  });

  it("does not poll live map feeds faster than their source exchange", () => {
    const viewer = read("assets/ts/server-map-viewer/app.ts");

    expect(viewer).toContain("const playerLocationRefreshMs = liveTelemetryCadenceSeconds(root) * 1000;");
    expect(viewer).toContain('["events", liveTelemetrySeconds]');
    expect(viewer).toContain('["players", liveTelemetrySeconds]');
    expect(viewer).toContain('["environment", liveTelemetrySeconds]');
  });
});
