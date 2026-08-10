import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  countAcceptanceFilterActions,
  filterModels,
  getDocumentationPresentation,
  getVerificationPresentation,
  modelSupportsVerticalLongAudio,
  selectComparableModels,
} from "../src/lib/filters.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIR, "../..");
const registry = JSON.parse(
  await readFile(path.join(REPOSITORY_ROOT, "artifacts", "api.json"), "utf8"),
);

test("the vertical long-video generated-audio job takes two filter actions", () => {
  const filters = {
    modality: "video",
    job: "vertical-over-10s-generated-audio",
    query: "",
  };

  assert.equal(countAcceptanceFilterActions(filters), 2);

  const matches = filterModels(registry.models, filters);
  assert.ok(matches.length > 0, "the current registry should expose at least one explicit match");
  assert.ok(matches.every((record) => record.model.modality === "video"));
  assert.ok(matches.every((record) => record.documentation_state === "documented"));
  assert.ok(matches.every(modelSupportsVerticalLongAudio));
});

test("indexed records cannot enter filters or comparison", () => {
  const capabilityProfile = {
    duration: { state: "supported", mode: "range", unit: "second", min: 5, max: 20 },
    size: { state: "supported", options: [{ aspect_ratios: ["9:16"] }] },
    native_audio: { state: "supported" },
  };
  const documented = {
    documentation_state: "documented",
    model: { id: "fixture/documented", name: "Documented", modality: "video" },
    capability_profiles: [capabilityProfile],
  };
  const indexed = {
    documentation_state: "indexed",
    model: { id: "fixture/indexed", name: "Indexed", modality: "video" },
    capability_profiles: [capabilityProfile],
  };
  const records = [documented, indexed];

  assert.deepEqual(
    filterModels(records, { modality: "video", job: "all", query: "" })
      .map((record) => record.model.id),
    ["fixture/documented"],
  );
  assert.deepEqual(
    selectComparableModels(records, ["fixture/documented", "fixture/indexed"])
      .map((record) => record.model.id),
    ["fixture/documented"],
  );
});

test("the job preset requires all three capabilities on one profile", () => {
  const falseCrossProduct = {
    model: { id: "fixture/cross-product", modality: "video" },
    capability_profiles: [
      {
        duration: { state: "supported", mode: "range", unit: "second", min: 5, max: 20 },
        size: {
          state: "supported",
          options: [{ aspect_ratios: ["9:16"] }],
        },
        native_audio: { state: "unsupported" },
      },
      {
        duration: { state: "supported", mode: "range", unit: "second", min: 2, max: 8 },
        size: {
          state: "supported",
          options: [{ aspect_ratios: ["16:9"] }],
        },
        native_audio: { state: "supported" },
      },
    ],
  };

  assert.equal(modelSupportsVerticalLongAudio(falseCrossProduct), false);
});

test("unknown capability data never passes the explicit capability preset", () => {
  const unknownRecord = {
    model: { id: "fixture/unknown", modality: "video" },
    capability_profiles: [{
      duration: { state: "unknown" },
      size: { state: "unknown" },
      native_audio: { state: "unknown" },
    }],
  };

  assert.equal(modelSupportsVerticalLongAudio(unknownRecord), false);
});

test("verification is always represented by explicit text", () => {
  assert.equal(getVerificationPresentation({}).label, "Verification not recorded");
  assert.equal(
    getVerificationPresentation({ verification: { state: "unverified" } }).label,
    "Unverified",
  );
  assert.equal(
    getVerificationPresentation({ verification: { state: "verified" } }).label,
    "Verified",
  );
});

test("documentation state is always represented by explicit text", () => {
  assert.equal(
    getDocumentationPresentation({ documentation_state: "documented" }).label,
    "Documented record",
  );
  assert.equal(
    getDocumentationPresentation({ documentation_state: "indexed" }).label,
    "Indexed record",
  );
});
