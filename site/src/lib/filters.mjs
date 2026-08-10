export const ALL_FILTER = "all";

export const JOB_PRESETS = Object.freeze([
  Object.freeze({
    id: "vertical-over-10s-generated-audio",
    label: "9:16 · over 10s · generated audio",
  }),
]);

function isSupported(value) {
  return value?.state === "supported";
}

function durationAllowsOver(duration, seconds) {
  if (!isSupported(duration) || duration.unit !== "second") {
    return false;
  }

  if (duration.mode === "range") {
    return Number.isFinite(duration.max) && duration.max > seconds;
  }

  if (duration.mode === "exact_set") {
    return Array.isArray(duration.values)
      && duration.values.some((value) => Number.isFinite(value) && value > seconds);
  }

  return false;
}

function sizeHasAspectRatio(size, targetRatio) {
  if (!isSupported(size)) {
    return false;
  }

  const optionRatios = (size.options ?? []).flatMap((option) => [
    ...(option.aspect_ratios ?? []),
    ...(option.examples ?? []).map((example) => example.aspect_ratio),
  ]);
  const directRatios = (size.examples ?? []).map((example) => example.aspect_ratio);

  return [...optionRatios, ...directRatios].includes(targetRatio);
}

export function profileSupportsVerticalLongAudio(profile) {
  return sizeHasAspectRatio(profile?.size, "9:16")
    && durationAllowsOver(profile?.duration, 10)
    && isSupported(profile?.native_audio);
}

export function modelSupportsVerticalLongAudio(record) {
  return (record?.capability_profiles ?? []).some(profileSupportsVerticalLongAudio);
}

export function getVerificationPresentation(record) {
  const state = record?.verification?.state;

  if (state === "verified") {
    return {
      key: "verified",
      label: "Verified",
      description: "A human checked this record against its cited sources.",
    };
  }

  if (state === "unverified") {
    return {
      key: "unverified",
      label: "Unverified",
      description: "This record still needs a human source check.",
    };
  }

  return {
    key: "not-recorded",
    label: "Verification not recorded",
    description: "This legacy record has no verification state in its data.",
  };
}

export function isDocumentedRecord(record) {
  return record?.documentation_state === "documented";
}

export function getDocumentationPresentation(record) {
  if (isDocumentedRecord(record)) {
    return {
      key: "documented",
      label: "Documented record",
      description: "This record has sourced capability constraints and lab pricing.",
    };
  }

  return {
    key: "indexed",
    label: "Indexed record",
    description: "This model is indexed from an official source but is not ready for capability comparison.",
  };
}

export function selectComparableModels(models, selectedIds) {
  const selected = new Set(selectedIds ?? []);
  return models.filter((record) => (
    isDocumentedRecord(record)
    && selected.has(record.model?.id)
  ));
}

export function countAcceptanceFilterActions(filters) {
  return Number(filters?.modality !== undefined && filters.modality !== ALL_FILTER)
    + Number(filters?.job !== undefined && filters.job !== ALL_FILTER);
}

export function filterModels(models, filters = {}) {
  const modality = filters.modality ?? ALL_FILTER;
  const job = filters.job ?? ALL_FILTER;
  const query = (filters.query ?? "").trim().toLocaleLowerCase();

  return models.filter((record) => {
    if (!isDocumentedRecord(record)) {
      return false;
    }

    if (modality !== ALL_FILTER && record.model?.modality !== modality) {
      return false;
    }

    if (
      job === "vertical-over-10s-generated-audio"
      && !modelSupportsVerticalLongAudio(record)
    ) {
      return false;
    }

    if (query) {
      const searchable = [
        record.model?.name,
        record.model?.lab,
        record.model?.id,
        ...(record.model?.aliases ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();

      if (!searchable.includes(query)) {
        return false;
      }
    }

    return true;
  });
}
