#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createArtifact } from "./build.mjs";
import { replaceCoverageBlock } from "./lib/readme-coverage.mjs";
import { loadRecords } from "./lib/records.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function checkReadmeCoverage(readme, artifact) {
  const counts = artifact.counts;
  const generated = replaceCoverageBlock(readme, counts);

  if (generated !== readme) {
    throw new Error(
      'README coverage block is stale. Run "npm run coverage" and commit README.md.',
    );
  }

  return `README coverage block is current (${counts.total_records} total, ${counts.documented} documented, ${counts.indexed} indexed).`;
}

async function main() {
  const [readme, entries] = await Promise.all([
    readFile(path.join(repositoryRoot, "README.md"), "utf8"),
    loadRecords(path.join(repositoryRoot, "models")),
  ]);
  console.log(checkReadmeCoverage(readme, createArtifact(entries)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
