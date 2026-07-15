import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

describe("monument LOD contact-sheet review gate", () => {
  it("binds every approved source hash to a current fixed-view contact sheet", () => {
    const manifestPath = resolve("assets/media/models/monuments-lod/manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      sourceRepository: { revision: string };
      entries: Array<{ id: string; sourceSha256: string; reviewStatus: string; tiers: Record<"map" | "mid" | "close", { sha256: string }> }>;
    };
    const approvals = JSON.parse(readFileSync(resolve("data/monument-lod-approvals.json"), "utf8")) as {
      sourceRevision: string;
      approvals: Record<string, { status: string; sourceSha256: string; tierSha256: Record<"map" | "mid" | "close", string> }>;
    };
    const review = JSON.parse(readFileSync(resolve("assets/media/models/monuments-lod/review/review-index.json"), "utf8")) as {
      manifestSha256: string;
      sheets: Record<string, string>;
    };
    expect(manifest.entries).toHaveLength(78);
    expect(approvals.sourceRevision).toBe(manifest.sourceRepository.revision);
    expect(review.manifestSha256).toBe(sha256(manifestPath));
    for (const entry of manifest.entries) {
      const sheet = resolve("assets/media/models/monuments-lod/review", `${entry.id}.png`);
      expect(entry.reviewStatus, entry.id).toBe("approved");
      expect(approvals.approvals[entry.id]).toMatchObject({ status: "approved", sourceSha256: entry.sourceSha256 });
      expect(approvals.approvals[entry.id].tierSha256, entry.id).toEqual({
        map: entry.tiers.map.sha256,
        mid: entry.tiers.mid.sha256,
        close: entry.tiers.close.sha256,
      });
      expect(existsSync(sheet), entry.id).toBe(true);
      expect(review.sheets[entry.id], entry.id).toBe(sha256(sheet));
    }
  });
});
