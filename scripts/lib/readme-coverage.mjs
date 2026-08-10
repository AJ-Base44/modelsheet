import { readFile, writeFile } from "node:fs/promises";

export const COVERAGE_START = "<!-- coverage:start -->";
export const COVERAGE_END = "<!-- coverage:end -->";

const MODALITIES = ["image", "video", "audio"];

function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Registry count ${label} must be a non-negative integer`);
  }
}

export function validateCoverageCounts(counts) {
  if (!counts || typeof counts !== "object") {
    throw new Error("Registry artifact does not contain counts");
  }

  assertNonNegativeInteger(counts.total_records, "total_records");
  assertNonNegativeInteger(counts.documented, "documented");
  assertNonNegativeInteger(counts.indexed, "indexed");

  if (counts.documented + counts.indexed !== counts.total_records) {
    throw new Error(
      "Registry documentation counts do not sum to total_records",
    );
  }

  if (!counts.by_modality || typeof counts.by_modality !== "object") {
    throw new Error("Registry artifact does not contain per-modality counts");
  }

  for (const modality of MODALITIES) {
    assertNonNegativeInteger(
      counts.by_modality[modality],
      `by_modality.${modality}`,
    );
  }

  const modalityTotal = MODALITIES.reduce(
    (total, modality) => total + counts.by_modality[modality],
    0,
  );
  if (modalityTotal !== counts.total_records) {
    throw new Error("Registry modality counts do not sum to total_records");
  }

  return counts;
}

export function renderCoverageSentence(counts) {
  validateCoverageCounts(counts);

  return `**Coverage: ${counts.total_records} total models: ${counts.documented} documented, ${counts.indexed} indexed (${counts.by_modality.image} image, ${counts.by_modality.video} video, ${counts.by_modality.audio} audio).**`;
}

export function renderCoverageBlock(counts, newline = "\n") {
  return [
    COVERAGE_START,
    renderCoverageSentence(counts),
    COVERAGE_END,
  ].join(newline);
}

function countOccurrences(value, needle) {
  let count = 0;
  let offset = 0;

  while (true) {
    const index = value.indexOf(needle, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + needle.length;
  }
}

export function replaceCoverageBlock(readme, counts) {
  if (typeof readme !== "string") {
    throw new TypeError("README contents must be a string");
  }

  const startCount = countOccurrences(readme, COVERAGE_START);
  const endCount = countOccurrences(readme, COVERAGE_END);
  if (startCount !== 1 || endCount !== 1) {
    throw new Error(
      `README.md must contain exactly one ${COVERAGE_START} and one ${COVERAGE_END}`,
    );
  }

  const start = readme.indexOf(COVERAGE_START);
  const end = readme.indexOf(COVERAGE_END);
  if (end < start) {
    throw new Error("README.md coverage markers are in the wrong order");
  }

  const newline = readme.includes("\r\n") ? "\r\n" : "\n";
  return `${readme.slice(0, start)}${renderCoverageBlock(
    counts,
    newline,
  )}${readme.slice(end + COVERAGE_END.length)}`;
}

export async function updateReadmeCoverageFile(readmeFile, counts) {
  const readme = await readFile(readmeFile, "utf8");
  const generated = replaceCoverageBlock(readme, counts);

  if (generated !== readme) {
    await writeFile(readmeFile, generated, "utf8");
    return true;
  }

  return false;
}
