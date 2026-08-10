import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

import registry, {
  findModels,
  getModel,
  getModelById,
  getModelCounts,
  listLabs,
  listTasks,
  models,
  resolveSources,
} from "../index.js";

const require = createRequire(import.meta.url);
const commonJs = require("../index.cjs");
const packageCommonJs = require("@modelsheet/registry");
const exportedJson = require("@modelsheet/registry/api.json");

test("ESM, CommonJS, and raw JSON expose the same registry", async () => {
  const raw = JSON.parse(
    await readFile(new URL("../data/api.json", import.meta.url), "utf8"),
  );

  assert.equal(registry.schema_version, 1);
  assert.equal(registry.counts.total_records, registry.models.length);
  assert.deepEqual(commonJs.registry, registry);
  assert.deepEqual(packageCommonJs.registry, registry);
  assert.deepEqual(exportedJson, registry);
  assert.deepEqual(raw, registry);
  assert.equal(models, registry.models);
  assert.ok(Object.isFrozen(registry));
  assert.ok(Object.isFrozen(registry.models[0]));
});

test("findModels filters model metadata", () => {
  const documentedVideo = findModels({
    documentationState: "documented",
    modality: "video",
  });

  assert.ok(documentedVideo.length > 0);
  assert.ok(
    documentedVideo.every(
      (record) =>
        record.documentation_state === "documented" &&
        record.model.modality === "video",
    ),
  );

  const counts = getModelCounts(documentedVideo);
  assert.equal(counts.total_records, documentedVideo.length);
  assert.equal(counts.indexed, 0);
  assert.equal(counts.by_modality.video, documentedVideo.length);
});

test("capability requirements must match one profile", () => {
  const candidates = findModels({
    documentationState: "documented",
    modality: "video",
    aspectRatio: "9:16",
    maxDurationAtLeast: 10,
    nativeAudioState: "supported",
  });

  assert.ok(candidates.length > 0);
  for (const record of candidates) {
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

test("model lookup supports stable IDs and published aliases", () => {
  const byId = getModelById("google/gemini-3-pro-image");
  assert.equal(byId?.model.name, "Gemini 3 Pro Image");
  assert.equal(getModel("Nano Banana Pro"), byId);
  assert.equal(getModel("definitely-not-a-model"), undefined);
});

test("enumeration and provenance helpers return registry values", () => {
  const labs = listLabs();
  const tasks = listTasks();
  const record = getModelById("black-forest-labs/flux-2-flex");

  assert.ok(labs.includes("Black Forest Labs"));
  assert.ok(tasks.includes("text_to_image"));
  assert.ok(record);

  const sources = resolveSources(record, record.model.source_ids);
  assert.ok(sources.length > 0);
  assert.ok(sources.every(({ id }) => record.model.source_ids.includes(id)));
});

test("invalid duration filters fail explicitly", () => {
  assert.throws(
    () => findModels({ maxDurationAtLeast: Number.NaN }),
    /non-negative finite number/,
  );
});
