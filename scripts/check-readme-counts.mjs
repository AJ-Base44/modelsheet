#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function checkReadmeCoverage(readme, artifact) {
  const coverageMatch = readme.match(
    /^\*\*Coverage: (\d+) models indexed, (\d+) documented\.\*\*$/m,
  );

  if (!coverageMatch) {
    throw new Error(
      'README.md must contain "**Coverage: N models indexed, M documented.**"',
    );
  }

  const readmeTotal = Number(coverageMatch[1]);
  const readmeDocumented = Number(coverageMatch[2]);
  const counts = artifact.counts;

  if (!counts || !Number.isInteger(counts.total_records)) {
    throw new Error("artifacts/api.json does not contain registry counts");
  }
  if (counts.documented + counts.indexed !== counts.total_records) {
    throw new Error("artifacts/api.json documentation counts do not sum to total_records");
  }
  if (
    readmeTotal !== counts.total_records ||
    readmeDocumented !== counts.documented
  ) {
    throw new Error(
      `README coverage says ${readmeTotal} indexed / ${readmeDocumented} documented, but api.json says ${counts.total_records} total / ${counts.documented} documented`,
    );
  }

  return `README coverage matches api.json (${counts.total_records} indexed, ${counts.documented} documented).`;
}

async function main() {
  const [readme, artifactSource] = await Promise.all([
    readFile(path.join(repositoryRoot, "README.md"), "utf8"),
    readFile(path.join(repositoryRoot, "artifacts", "api.json"), "utf8"),
  ]);
  console.log(checkReadmeCoverage(readme, JSON.parse(artifactSource)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
