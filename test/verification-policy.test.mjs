import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { readTomlFile } from "../scripts/lib/records.mjs";
import { validateLoadedRecords } from "../scripts/validate.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const validFixture = path.join(testDirectory, "fixtures", "valid", "example.toml");

test("non-legacy records must explicitly declare unverified state", async () => {
  const record = await readTomlFile(validFixture);
  delete record.verification;

  const result = await validateLoadedRecords([
    { filePath: validFixture, record },
  ]);

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((error) => error.keyword === "verificationState"),
    "expected the verification policy to reject an omitted state",
  );
});
