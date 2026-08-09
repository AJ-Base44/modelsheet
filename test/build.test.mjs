import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildRegistry } from "../scripts/build.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIR, "..");
const FIXTURES_DIR = path.join(TEST_DIR, "fixtures");
const VALIDATOR_PATH = path.join(REPOSITORY_ROOT, "scripts", "validate.mjs");
const SCHEMA_PATH = path.join(
  REPOSITORY_ROOT,
  "schema",
  "source-v1.schema.json",
);

function runValidator(fixtureName) {
  return spawnSync(
    process.execPath,
    [
      VALIDATOR_PATH,
      "--models-dir",
      path.join(FIXTURES_DIR, fixtureName),
      "--schema",
      SCHEMA_PATH,
    ],
    { cwd: REPOSITORY_ROOT, encoding: "utf8" },
  );
}

test("the valid fixture passes validation", () => {
  const result = runValidator("valid");

  assert.equal(result.error, undefined, "validator process could not start");
  assert.equal(
    result.status,
    0,
    `validator rejected the valid fixture:\n${result.stdout}${result.stderr}`,
  );
});

test("the invalid fixture fails validation", () => {
  const result = runValidator("invalid");

  assert.equal(result.error, undefined, "validator process could not start");
  assert.notEqual(result.status, 0, "validator accepted the invalid fixture");
});

test("TOML formatting and key order do not affect api.json bytes", async (t) => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "modelsheet-build-test-"),
  );
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));

  const firstOutput = path.join(temporaryDirectory, "semantic-a.json");
  const secondOutput = path.join(temporaryDirectory, "semantic-b.json");

  await buildRegistry({
    modelsDir: path.join(FIXTURES_DIR, "semantic-a"),
    outputFile: firstOutput,
  });
  await buildRegistry({
    modelsDir: path.join(FIXTURES_DIR, "semantic-b"),
    outputFile: secondOutput,
  });

  const [firstBytes, secondBytes] = await Promise.all([
    readFile(firstOutput),
    readFile(secondOutput),
  ]);

  assert.deepEqual(secondBytes, firstBytes);
});

test("two consecutive builds of the same records are byte-identical", async (t) => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "modelsheet-repeat-test-"),
  );
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));

  const firstOutput = path.join(temporaryDirectory, "first.json");
  const secondOutput = path.join(temporaryDirectory, "second.json");
  const modelsDir = path.join(FIXTURES_DIR, "valid");

  await buildRegistry({ modelsDir, outputFile: firstOutput });
  await buildRegistry({ modelsDir, outputFile: secondOutput });

  const [firstBytes, secondBytes] = await Promise.all([
    readFile(firstOutput),
    readFile(secondOutput),
  ]);

  assert.deepEqual(secondBytes, firstBytes);
});
