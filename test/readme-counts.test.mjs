import assert from "node:assert/strict";
import test from "node:test";

import { checkReadmeCoverage } from "../scripts/check-readme-counts.mjs";
import { replaceCoverageBlock } from "../scripts/lib/readme-coverage.mjs";

const artifact = {
  counts: {
    total_records: 53,
    documented: 3,
    indexed: 50,
    by_modality: {
      audio: 17,
      image: 18,
      video: 18,
    },
  },
};

const currentReadme = [
  "# Modelsheet",
  "",
  "<!-- coverage:start -->",
  "**Coverage: 53 total models: 3 documented, 50 indexed (18 image, 18 video, 17 audio).**",
  "<!-- coverage:end -->",
  "",
].join("\n");

test("README coverage accepts counts that match api.json", () => {
  assert.equal(
    checkReadmeCoverage(currentReadme, artifact),
    "README coverage block is current (53 total, 3 documented, 50 indexed).",
  );
});

test("README coverage rejects counts that drift from api.json", () => {
  const staleReadme = currentReadme.replace(
    "3 documented, 50 indexed",
    "53 documented, 0 indexed",
  );

  assert.throws(
    () => checkReadmeCoverage(staleReadme, artifact),
    /README coverage block is stale\. Run "npm run coverage" and commit README\.md\./,
  );
});

test("regenerating a stale README coverage block makes the guard pass", () => {
  const staleReadme = currentReadme.replace("53 total models", "52 total models");

  assert.throws(
    () => checkReadmeCoverage(staleReadme, artifact),
    /npm run coverage/,
  );

  const regenerated = replaceCoverageBlock(staleReadme, artifact.counts);
  assert.equal(regenerated, currentReadme);
  assert.doesNotThrow(() => checkReadmeCoverage(regenerated, artifact));
});

test("README coverage requires one ordered marker pair", () => {
  assert.throws(
    () => checkReadmeCoverage("# Modelsheet\n", artifact),
    /must contain exactly one/,
  );
  assert.throws(
    () =>
      checkReadmeCoverage(
        "<!-- coverage:end -->\n<!-- coverage:start -->",
        artifact,
      ),
    /markers are in the wrong order/,
  );
});
