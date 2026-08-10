"use strict";

const registryData = require("./data/api.json");

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function asValues(value) {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

function matchesOne(value, expected) {
  const values = asValues(expected);
  return values === undefined || values.includes(value);
}

function includesFolded(value, search) {
  return typeof value === "string" && value.toLocaleLowerCase().includes(search);
}

function profileAspectRatios(profile) {
  const ratios = new Set();
  const size = profile.size;

  for (const example of size?.examples ?? []) {
    if (example.aspect_ratio) ratios.add(example.aspect_ratio);
  }

  for (const option of size?.options ?? []) {
    for (const ratio of option.aspect_ratios ?? []) ratios.add(ratio);
    for (const example of option.examples ?? []) {
      if (example.aspect_ratio) ratios.add(example.aspect_ratio);
    }
  }

  return ratios;
}

function profileMatches(profile, query) {
  if (!matchesOne(profile.task, query.task)) return false;

  if (
    query.aspectRatio !== undefined &&
    !profileAspectRatios(profile).has(query.aspectRatio)
  ) {
    return false;
  }

  if (query.maxDurationAtLeast !== undefined) {
    if (
      profile.duration?.state !== "supported" ||
      typeof profile.duration.max !== "number" ||
      profile.duration.max < query.maxDurationAtLeast
    ) {
      return false;
    }
  }

  if (
    query.nativeAudioState !== undefined &&
    profile.native_audio?.state !== query.nativeAudioState
  ) {
    return false;
  }

  if (
    query.referenceRole !== undefined &&
    !(profile.reference_inputs ?? []).some(
      (input) => input.role === query.referenceRole && input.state === "supported",
    )
  ) {
    return false;
  }

  return true;
}

function hasProfileQuery(query) {
  return [
    "task",
    "aspectRatio",
    "maxDurationAtLeast",
    "nativeAudioState",
    "referenceRole",
  ].some((key) => query[key] !== undefined);
}

const registry = deepFreeze(registryData);
const models = registry.models;

function findModels(query = {}) {
  if (
    query.maxDurationAtLeast !== undefined &&
    (!Number.isFinite(query.maxDurationAtLeast) || query.maxDurationAtLeast < 0)
  ) {
    throw new TypeError("maxDurationAtLeast must be a non-negative finite number");
  }

  const foldedLab = query.lab?.toLocaleLowerCase();
  const foldedSearch = query.search?.toLocaleLowerCase();
  const needsProfile = hasProfileQuery(query);

  const matches = models.filter((record) => {
    if (!matchesOne(record.model.modality, query.modality)) return false;
    if (!matchesOne(record.documentation_state, query.documentationState)) return false;
    if (
      !matchesOne(
        record.verification?.state ?? "unspecified",
        query.verificationState,
      )
    ) {
      return false;
    }
    if (!matchesOne(record.model.status, query.status)) return false;
    if (!matchesOne(record.pricing.state, query.pricingState)) return false;
    if (foldedLab && !includesFolded(record.model.lab, foldedLab)) return false;

    if (foldedSearch) {
      const searchable = [
        record.model.id,
        record.model.name,
        record.model.lab,
        ...(record.model.aliases ?? []),
        ...(record.api_identifiers ?? []).map(({ value }) => value),
      ];
      if (!searchable.some((value) => includesFolded(value, foldedSearch))) {
        return false;
      }
    }

    return (
      !needsProfile ||
      record.capability_profiles.some((profile) => profileMatches(profile, query))
    );
  });

  return Object.freeze(matches);
}

function getModelById(id) {
  return models.find((record) => record.model.id === id);
}

function getModel(identifier) {
  const exact = getModelById(identifier);
  if (exact) return exact;

  const folded = identifier.toLocaleLowerCase();
  const matches = models.filter((record) => {
    const identifiers = [
      record.model.id,
      record.model.name,
      ...(record.model.aliases ?? []),
      ...(record.api_identifiers ?? []).map(({ value }) => value),
    ];
    return identifiers.some((value) => value.toLocaleLowerCase() === folded);
  });

  if (matches.length > 1) {
    throw new RangeError(
      `Model identifier ${JSON.stringify(identifier)} is ambiguous: ${matches
        .map((record) => record.model.id)
        .join(", ")}`,
    );
  }

  return matches[0];
}

function getModelCounts(records = models) {
  const counts = {
    total_records: records.length,
    documented: 0,
    indexed: 0,
    by_modality: { audio: 0, image: 0, video: 0 },
  };

  for (const record of records) {
    counts[record.documentation_state] += 1;
    counts.by_modality[record.model.modality] += 1;
  }

  return deepFreeze(counts);
}

function listLabs(records = models) {
  return Object.freeze(
    [...new Set(records.map((record) => record.model.lab))].sort(compareStrings),
  );
}

function listTasks(records = models) {
  return Object.freeze(
    [
      ...new Set(
        records.flatMap((record) =>
          record.capability_profiles.map((profile) => profile.task),
        ),
      ),
    ].sort(compareStrings),
  );
}

function resolveSources(record, sourceIds) {
  const wanted = new Set(sourceIds);
  return Object.freeze(record.sources.filter((source) => wanted.has(source.id)));
}

module.exports = {
  registry,
  models,
  findModels,
  getModel,
  getModelById,
  getModelCounts,
  listLabs,
  listTasks,
  resolveSources,
};
