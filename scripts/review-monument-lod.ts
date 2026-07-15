import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(root, "assets/media/models/monuments-lod/manifest.json");
const reviewDir = resolve(root, "assets/media/models/monuments-lod/review");
const reviewIndexPath = resolve(reviewDir, "review-index.json");
const approvalsPath = resolve(root, "data/monument-lod-approvals.json");
const approve = process.argv.find((argument) => argument.startsWith("--approve="))?.slice(10) || "";
const reject = process.argv.find((argument) => argument.startsWith("--reject="))?.slice(9) || "";
const approveAll = process.argv.includes("--approve-all");

type ManifestEntry = { id: string; sourceSha256: string; tiers: Record<"map" | "mid" | "close", { sha256: string }> };
type Manifest = { sourceRepository: { revision: string }; entries: ManifestEntry[] };
type Approval = { status: "approved" | "rejected"; sourceSha256: string; tierSha256: Record<"map" | "mid" | "close", string>; reviewedAt: string };
type ApprovalFile = { version: number; sourceRevision: string; approvals: Record<string, Approval> };

const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

if (!approve && !reject && !approveAll) throw new Error("Usage: npm run monuments:lod:approve -- --approve=<id> | --reject=<id> | --approve-all");
if (!existsSync(manifestPath) || !existsSync(reviewIndexPath)) throw new Error("Generate monument LODs and contact sheets before recording review decisions.");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
const reviewIndex = JSON.parse(readFileSync(reviewIndexPath, "utf8")) as { manifestSha256: string; sheets: Record<string, string> };
if (reviewIndex.manifestSha256 !== sha256(manifestPath)) throw new Error("Contact sheets are stale for the current monument manifest.");
const targets = approveAll ? manifest.entries : manifest.entries.filter((entry) => entry.id === (approve || reject));
if (!targets.length) throw new Error(`Unknown monument recipe: ${approve || reject}`);
for (const entry of targets) {
  const sheet = resolve(reviewDir, `${entry.id}.png`);
  if (!existsSync(sheet) || reviewIndex.sheets[entry.id] !== sha256(sheet)) throw new Error(`${entry.id}: fixed-view contact sheet is missing or stale.`);
}

const installed = existsSync(approvalsPath)
  ? JSON.parse(readFileSync(approvalsPath, "utf8")) as ApprovalFile
  : { version: 1, sourceRevision: manifest.sourceRepository.revision, approvals: {} };
const status = reject ? "rejected" : "approved";
const reviewedAt = new Date().toISOString();
for (const entry of targets) installed.approvals[entry.id] = {
  status,
  sourceSha256: entry.sourceSha256,
  tierSha256: {
    map: entry.tiers.map.sha256,
    mid: entry.tiers.mid.sha256,
    close: entry.tiers.close.sha256,
  },
  reviewedAt,
};
installed.version = 2;
installed.sourceRevision = manifest.sourceRepository.revision;
installed.approvals = Object.fromEntries(Object.entries(installed.approvals).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(approvalsPath, `${JSON.stringify(installed, null, 2)}\n`);
console.log(`Recorded ${status} review decisions for ${targets.length} monument recipes. Run npm run monuments:lod -- --manifest-only to publish the updated statuses.`);
