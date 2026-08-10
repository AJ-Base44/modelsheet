import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  filterRecords,
  findDataFile,
  loadRegistry,
  parseArguments,
} from "../scripts/query.mjs";

const DATA_FILE = new URL(
  "../../../packages/registry/data/api.json",
  import.meta.url,
);
const SCRIPT_FILE = new URL("../scripts/query.mjs", import.meta.url);
const DATA_PATH = fileURLToPath(DATA_FILE);
const SCRIPT_PATH = fileURLToPath(SCRIPT_FILE);

test("explicit local package data is discovered and loaded", async () => {
  const filePath = await findDataFile(DATA_PATH);
  const registry = await loadRegistry(filePath);
  assert.equal(registry.schema_version, 1);
  assert.equal(registry.counts.total_records, registry.models.length);
});

test("list defaults to documented records", () => {
  const options = parseArguments(["list", "--modality", "video"]);
  assert.equal(options.documentationState, "documented");
});

test("filterRecords preserves documentation and profile boundaries", async () => {
  const registry = await loadRegistry(DATA_FILE);
  const options = parseArguments([
    "list",
    "--modality",
    "video",
    "--aspect-ratio",
    "9:16",
    "--max-duration-at-least",
    "10",
    "--native-audio",
    "supported",
  ]);
  const records = filterRecords(registry.models, options);

  assert.ok(records.length > 0);
  assert.ok(records.every((record) => record.documentation_state === "documented"));
  for (const record of records) {
    assert.ok(
      record.capability_profiles.some((profile) => {
        const ratios = [
          ...(profile.size?.examples ?? []).map((item) => item.aspect_ratio),
          ...(profile.size?.options ?? []).flatMap((option) => [
            ...(option.aspect_ratios ?? []),
            ...(option.examples ?? []).map((item) => item.aspect_ratio),
          ]),
        ];
        return (
          ratios.includes("9:16") &&
          profile.duration?.state === "supported" &&
          profile.duration.max >= 10 &&
          profile.native_audio?.state === "supported"
        );
      }),
    );
  }
});

test("counts command produces machine-readable JSON without network access", () => {
  const result = spawnSync(
    process.execPath,
    [SCRIPT_PATH, "counts", "--data", DATA_PATH],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  const counts = JSON.parse(result.stdout);
  assert.ok(counts.total_records > 0);
  assert.equal(counts.documented + counts.indexed, counts.total_records);
});

test("invalid values fail during argument parsing", () => {
  assert.throws(
    () => parseArguments(["list", "--modality", "text"]),
    /audio, image, video/,
  );
  assert.throws(
    () => parseArguments(["list", "--max-duration-at-least", "unknown"]),
    /non-negative number/,
  );
});
