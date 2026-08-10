import assert from "node:assert/strict";
import test from "node:test";

import { checkReadmeCoverage } from "../scripts/check-readme-counts.mjs";

const artifact = {
  counts: {
    total_records: 53,
    documented: 3,
    indexed: 50,
  },
};

test("README coverage accepts counts that match api.json", () => {
  assert.equal(
    checkReadmeCoverage(
      "# Modelsheet\n\n**Coverage: 53 models indexed, 3 documented.**\n",
      artifact,
    ),
    "README coverage matches api.json (53 indexed, 3 documented).",
  );
});

test("README coverage rejects counts that drift from api.json", () => {
  assert.throws(
    () =>
      checkReadmeCoverage(
        "# Modelsheet\n\n**Coverage: 53 models indexed, 53 documented.**\n",
        artifact,
      ),
    /README coverage says 53 indexed \/ 53 documented, but api\.json says 53 total \/ 3 documented/,
  );
});
