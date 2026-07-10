#!/usr/bin/env node
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { canonicalJson } from "./canonical-json";
import { compileSourceBundle } from "./compiler";
import { evaluateCompiledTrack, localFrameToWorld } from "./math";
import type {
  CompiledVisualFrame,
  EditorSourceBundle,
  QuaternionValue,
  RuntimePayloadEvent,
  Vector3Value,
  VehiclePreviewMetadataFile,
} from "./types";

interface FixtureConfiguration {
  sampleTimes: number[];
  target?: Vector3Value;
  approach?: Vector3Value;
}

const DEFAULT_METADATA_PATH = resolve("assets/airstrike-animation-editor/vehicle-preview.json");

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function roundedFrame(frame: CompiledVisualFrame): CompiledVisualFrame {
  return JSON.parse(canonicalJson(frame)) as CompiledVisualFrame;
}

function roundedVector(value: Vector3Value): Vector3Value {
  return JSON.parse(canonicalJson(value)) as Vector3Value;
}

function roundedQuaternion(value: QuaternionValue): QuaternionValue {
  return JSON.parse(canonicalJson(value)) as QuaternionValue;
}

async function compileOne(sourcePath: string, outputDirectory?: string): Promise<void> {
  const source = await readJson<EditorSourceBundle>(sourcePath);
  const metadata = await readJson<VehiclePreviewMetadataFile>(DEFAULT_METADATA_PATH);
  const result = compileSourceBundle(source, { publishedRevision: 1, vehicleMetadata: metadata });
  if (!outputDirectory) {
    process.stdout.write(`${result.canonicalJson}\n`);
    return;
  }
  await writeFile(join(outputDirectory, "expected.runtime.json"), pretty(result.bundle));
  await writeFile(join(outputDirectory, "expected.canonical.json"), result.canonicalJson);
  await writeFile(
    join(outputDirectory, "manifest.json"),
    pretty({
      compilerVersion: result.bundle.CompilerVersion,
      publishedRevision: result.bundle.PublishedRevision,
      canonicalSha256: result.sha256,
      canonicalBytes: new TextEncoder().encode(result.canonicalJson).length,
      sourceHashes: result.sourceHashes,
    }),
  );
}

async function updateFixture(directory: string, update: boolean): Promise<void> {
  const sourcePath = join(directory, "source.json");
  const source = await readJson<EditorSourceBundle>(sourcePath);
  const fixture = await readJson<FixtureConfiguration>(join(directory, "fixture.json"));
  const metadata = await readJson<VehiclePreviewMetadataFile>(DEFAULT_METADATA_PATH);
  const result = compileSourceBundle(source, { publishedRevision: 1, vehicleMetadata: metadata });
  const profileKey = Object.keys(result.bundle.Profiles)[0]!;
  const profile = result.bundle.Profiles[profileKey]!;
  const target = fixture.target ?? { x: 0, y: 0, z: 0 };
  const approach = fixture.approach ?? { x: 0, y: 0, z: 1 };
  const samples = fixture.sampleTimes.map((time) => {
    const local = roundedFrame(evaluateCompiledTrack(profile.CompiledTrack, time));
    const world = localFrameToWorld(local, target, approach);
    return {
      Time: time,
      Local: local,
      World: {
        Position: roundedVector(world.position),
        Rotation: roundedQuaternion(world.rotation),
      },
    };
  });
  const expectedSamples = {
    ProfileKey: profileKey,
    Target: target,
    Approach: approach,
    Samples: samples,
    CompiledReleaseEvents: (profile.CompiledReleaseEvents ?? null) as RuntimePayloadEvent[] | null,
  };
  const expectedPaths = {
    runtime: join(directory, "expected.runtime.json"),
    canonical: join(directory, "expected.canonical.json"),
    samples: join(directory, "expected.samples.json"),
    manifest: join(directory, "manifest.json"),
  };
  const manifest = {
    compilerVersion: result.bundle.CompilerVersion,
    publishedRevision: result.bundle.PublishedRevision,
    canonicalSha256: result.sha256,
    canonicalBytes: new TextEncoder().encode(result.canonicalJson).length,
    sourceHashes: result.sourceHashes,
  };
  if (update) {
    await writeFile(expectedPaths.runtime, pretty(result.bundle));
    await writeFile(expectedPaths.canonical, result.canonicalJson);
    await writeFile(expectedPaths.samples, pretty(expectedSamples));
    await writeFile(expectedPaths.manifest, pretty(manifest));
    process.stdout.write(`updated ${basename(directory)}\n`);
    return;
  }
  const comparisons: Array<[string, string, string]> = [
    ["runtime", await readFile(expectedPaths.runtime, "utf8"), pretty(result.bundle)],
    ["canonical", await readFile(expectedPaths.canonical, "utf8"), result.canonicalJson],
    ["samples", await readFile(expectedPaths.samples, "utf8"), pretty(expectedSamples)],
    ["manifest", await readFile(expectedPaths.manifest, "utf8"), pretty(manifest)],
  ];
  const mismatch = comparisons.find(([, actual, expected]) => actual !== expected);
  if (mismatch) {
    throw new Error(`${basename(directory)} ${mismatch[0]} output differs; run npm run fixtures:update.`);
  }
  process.stdout.write(`verified ${basename(directory)}\n`);
}

async function fixtures(root: string, update: boolean): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    await updateFixture(join(root, entry.name), update);
  }
}

function optionValue(argumentsList: string[], name: string): string | undefined {
  const index = argumentsList.indexOf(name);
  return index >= 0 ? argumentsList[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  if (command === "compile") {
    const sourcePath = args[1];
    if (!sourcePath) {
      throw new Error("Usage: npm run compiler -- compile <source.json> [--out <directory>]");
    }
    await compileOne(resolve(sourcePath), optionValue(args, "--out") ? resolve(optionValue(args, "--out")!) : undefined);
    return;
  }
  if (command === "fixtures") {
    await fixtures(resolve(args[1] ?? "tests/fixtures/airstrike-animations"), args.includes("--update"));
    return;
  }
  throw new Error(
    `Usage:\n  npm run compiler -- compile <source.json> [--out ${dirname("source.json")}]\n  npm run compiler -- fixtures [root] [--update]`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
