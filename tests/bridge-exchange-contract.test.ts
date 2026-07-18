import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const endpoint = readFileSync(resolve(__dirname, "../api/server/bridge-exchange.php"), "utf8");
const store = readFileSync(resolve(__dirname, "../includes/store.php"), "utf8");
const rewards = readFileSync(resolve(__dirname, "../includes/rewards.php"), "utf8");
const clans = readFileSync(resolve(__dirname, "../includes/clans.php"), "utf8");
const status = readFileSync(resolve(__dirname, "../includes/server-status.php"), "utf8");

describe("server bridge exchange contract", () => {
  it("authenticates once and enforces protocol and body limits", () => {
    expect(endpoint).toContain("raidlands_bridge_authorize($body)");
    expect(endpoint.match(/raidlands_bridge_authorize\(/g)).toHaveLength(1);
    expect(endpoint).toContain("RAIDLANDS_BRIDGE_EXCHANGE_PROTOCOL = 1");
    expect(endpoint).toContain("RAIDLANDS_BRIDGE_EXCHANGE_MAX_BYTES = 1048576");
    expect(endpoint).toContain("Unsupported bridge exchange protocol.");
    expect(endpoint).toContain("Invalid bridge exchange envelope.");
  });

  it("records acknowledgements before ingesting telemetry or claiming work", () => {
    const ack = endpoint.indexOf("Acknowledgements are deliberately processed");
    const heartbeat = endpoint.indexOf("raidlands_server_status_ingest_heartbeat");
    const purchaseClaim = endpoint.indexOf("raidlands_store_bridge_rp_requests");
    const clanClaim = endpoint.indexOf("raidlands_clans_claim_actions");
    expect(ack).toBeGreaterThan(0);
    expect(heartbeat).toBeGreaterThan(ack);
    expect(purchaseClaim).toBeGreaterThan(heartbeat);
    expect(clanClaim).toBeGreaterThan(purchaseClaim);
  });

  it("uses section-level failures and a 45-second exchange reclaim lease", () => {
    expect(endpoint).toContain("'retryable' => !($error instanceof InvalidArgumentException)");
    expect(endpoint).toContain("RAIDLANDS_BRIDGE_EXCHANGE_RECLAIM_SECONDS = 45");
    expect(store).toMatch(/raidlands_store_bridge_rp_requests\(int \$limit = 25, int \$reclaim_after_seconds = 600\)/);
    expect(rewards).toMatch(/raidlands_rewards_bridge_point_requests\(int \$limit = 25, int \$reclaim_after_seconds = 600\)/);
    expect(clans).toMatch(/raidlands_clans_claim_actions\(string \$server_id, int \$limit = 25, int \$reclaim_after_seconds = 300\)/);
  });

  it("returns replay acknowledgements by event key for idempotent outboxes", () => {
    expect(status).toContain("acceptedEventKeys");
    expect(status).toContain("rejectedEvents");
    expect(status).toContain("ON DUPLICATE KEY UPDATE");
    expect(endpoint).toContain("raidlands_server_map_replay_events_ingest_snapshot");
  });

  it("keeps all module responses independently addressable", () => {
    expect(endpoint).toContain("$response_modules['vip']");
    expect(endpoint).toContain("$response_modules['map']");
    expect(endpoint).toContain("$response_modules['clans']");
    expect(endpoint).toContain("'modules' => $response_modules");
  });

  it("carries VIP cursors and kit/permission revisions through the exchange", () => {
    expect(endpoint).toContain("raidlands_store_bridge_changes((int) ($vip['cursor'] ?? 0))");
    expect(endpoint).toContain("raidlands_kits_pending_sync((int) ($vip['kit_revision'] ?? 0))");
    expect(endpoint).toContain("raidlands_permissions_pending_sync((int) ($vip['permission_revision'] ?? 0))");
    expect(endpoint).toContain("'cursor' => $changes['cursor']");
  });
});
