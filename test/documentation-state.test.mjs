import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { readTomlFile } from "../scripts/lib/records.mjs";
import { validateLoadedRecords } from "../scripts/validate.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const fullRecordPath = path.join(
  repositoryRoot,
  "models",
  "openai",
  "gpt-image-2.toml",
);

function documentationErrors(result) {
  return result.errors.filter((error) => error.keyword === "documentationState");
}

test("documented rejects capability profiles with no concrete constraint values", async () => {
  const record = await readTomlFile(fullRecordPath);
  record.documentation_state = "documented";
  record.capability_profiles = record.capability_profiles.map((profile) => ({
    id: profile.id,
    task: profile.task,
    source_ids: profile.source_ids,
  }));

  const result = await validateLoadedRecords([{ filePath: fullRecordPath, record }]);

  assert.equal(result.valid, false);
  assert.ok(
    documentationErrors(result).some(
      (error) => error.instancePath === "/documentation_state",
    ),
    "expected documented to require a concrete capability constraint",
  );
});

test("documented rejects unknown pricing even when constraints are present", async () => {
  const record = await readTomlFile(fullRecordPath);
  record.documentation_state = "documented";
  record.pricing = {
    state: "unknown",
    source_ids: record.pricing.source_ids,
  };

  const result = await validateLoadedRecords([{ filePath: fullRecordPath, record }]);

  assert.equal(result.valid, false);
  assert.ok(
    documentationErrors(result).some(
      (error) => error.instancePath === "/pricing/state",
    ),
    "expected documented to reject unknown pricing",
  );
});
