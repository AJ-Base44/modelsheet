#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv from "ajv";
import addFormats from "ajv-formats";

import {
  discoverModelFiles,
  readTomlFile,
} from "./lib/records.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");

export const DEFAULT_MODELS_DIR = path.join(repositoryRoot, "models");
export const DEFAULT_SCHEMA_PATH = path.join(
  repositoryRoot,
  "schema",
  "source-v1.schema.json",
);

const LEGACY_RECORDS_WITHOUT_VERIFICATION = new Set([
  "black-forest-labs/flux-3-video",
  "openai/gpt-image-2",
  "elevenlabs/eleven-v3",
]);

function makeError(filePath, instancePath, message, keyword = "modelsheet") {
  return {
    filePath,
    instancePath: instancePath || "/",
    keyword,
    message,
  };
}

function pointerSegment(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function childPointer(parent, child) {
  return `${parent}/${pointerSegment(child)}`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates].sort();
}

function collectSchemaErrors(validate, entries) {
  const errors = [];

  for (const { filePath, record } of entries) {
    if (validate(record)) {
      continue;
    }

    for (const error of validate.errors ?? []) {
      let instancePath = error.instancePath || "/";
      if (error.keyword === "required" && error.params?.missingProperty) {
        instancePath = childPointer(
          instancePath === "/" ? "" : instancePath,
          error.params.missingProperty,
        );
      }

      errors.push(
        makeError(
          filePath,
          instancePath,
          error.message ?? "does not match the source schema",
          error.keyword,
        ),
      );
    }
  }

  return errors;
}

function checkArrayIds(items, basePath, filePath, errors) {
  if (!Array.isArray(items)) {
    return;
  }

  const ids = items
    .filter((item) => isObject(item) && typeof item.id === "string")
    .map((item) => item.id);

  for (const duplicate of findDuplicates(ids)) {
    errors.push(
      makeError(
        filePath,
        basePath,
        `contains duplicate stable id ${JSON.stringify(duplicate)}`,
        "uniqueStableId",
      ),
    );
  }
}

function checkNestedStableIds(value, instancePath, filePath, errors) {
  if (Array.isArray(value)) {
    checkArrayIds(value, instancePath, filePath, errors);
    value.forEach((item, index) =>
      checkNestedStableIds(item, childPointer(instancePath, index), filePath, errors),
    );
    return;
  }

  if (!isObject(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    checkNestedStableIds(
      nestedValue,
      childPointer(instancePath, key),
      filePath,
      errors,
    );
  }
}

function checkNoEmptyArrays(value, instancePath, filePath, errors) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      errors.push(
        makeError(
          filePath,
          instancePath,
          "must not use an empty array as an unknown-value placeholder",
          "nonEmptyArray",
        ),
      );
    }

    value.forEach((item, index) =>
      checkNoEmptyArrays(item, childPointer(instancePath, index), filePath, errors),
    );
    return;
  }

  if (!isObject(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    checkNoEmptyArrays(
      nestedValue,
      childPointer(instancePath, key),
      filePath,
      errors,
    );
  }
}

function checkSourceReferences(record, filePath, errors) {
  const sourceIds = new Set(
    asArray(record.sources)
      .map((source) => source?.id)
      .filter((id) => typeof id === "string"),
  );

  function visit(value, instancePath) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, childPointer(instancePath, index)));
      return;
    }

    if (!isObject(value)) {
      return;
    }

    if (Array.isArray(value.source_ids)) {
      value.source_ids.forEach((sourceId, index) => {
        if (typeof sourceId === "string" && !sourceIds.has(sourceId)) {
          errors.push(
            makeError(
              filePath,
              childPointer(childPointer(instancePath, "source_ids"), index),
              `references missing source ${JSON.stringify(sourceId)}`,
              "sourceReference",
            ),
          );
        }
      });
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      visit(nestedValue, childPointer(instancePath, key));
    }
  }

  visit(record, "");
}

function requireSources(value, instancePath, filePath, errors) {
  if (!isObject(value)) {
    return;
  }

  if (!Array.isArray(value.source_ids) || value.source_ids.length === 0) {
    errors.push(
      makeError(
        filePath,
        childPointer(instancePath, "source_ids"),
        "factual claim must carry at least one source reference",
        "claimSource",
      ),
    );
  }
}

function checkFactualClaimSources(record, filePath, errors) {
  requireSources(record.model, "/model", filePath, errors);
  asArray(record.api_identifiers).forEach((value, index) =>
    requireSources(value, `/api_identifiers/${index}`, filePath, errors),
  );

  if (record.language_support !== undefined) {
    requireSources(record.language_support, "/language_support", filePath, errors);
  }

  asArray(record.capability_profiles).forEach((profile, profileIndex) => {
    const profilePath = `/capability_profiles/${profileIndex}`;
    requireSources(profile, profilePath, filePath, errors);

    for (const key of [
      "duration",
      "text_input",
      "frame_rate",
      "size",
      "native_audio",
      "timing",
    ]) {
      if (profile?.[key] !== undefined) {
        requireSources(profile[key], `${profilePath}/${key}`, filePath, errors);
      }
    }

    asArray(profile?.size?.options).forEach((option, optionIndex) => {
      const optionPath = `${profilePath}/size/options/${optionIndex}`;
      requireSources(option, optionPath, filePath, errors);
      asArray(option?.examples).forEach((example, exampleIndex) =>
        requireSources(
          example,
          `${optionPath}/examples/${exampleIndex}`,
          filePath,
          errors,
        ),
      );
    });

    asArray(profile?.size?.examples).forEach((example, exampleIndex) =>
      requireSources(
        example,
        `${profilePath}/size/examples/${exampleIndex}`,
        filePath,
        errors,
      ),
    );

    for (const key of [
      "audio_formats",
      "audio_format_access",
      "reference_inputs",
      "delivery_profiles",
      "controls",
    ]) {
      asArray(profile?.[key]).forEach((claim, claimIndex) =>
        requireSources(
          claim,
          `${profilePath}/${key}/${claimIndex}`,
          filePath,
          errors,
        ),
      );
    }
  });

  asArray(record.limitations).forEach((limitation, index) =>
    requireSources(limitation, `/limitations/${index}`, filePath, errors),
  );

  requireSources(record.pricing, "/pricing", filePath, errors);
  asArray(record.pricing?.charges).forEach((charge, index) =>
    requireSources(charge, `/pricing/charges/${index}`, filePath, errors),
  );

  asArray(record.conflicts).forEach((conflict, index) =>
    requireSources(conflict, `/conflicts/${index}`, filePath, errors),
  );
}

function checkRange(min, max, instancePath, filePath, errors) {
  if (typeof min === "number" && typeof max === "number" && min > max) {
    errors.push(
      makeError(
        filePath,
        instancePath,
        `range minimum ${min} exceeds maximum ${max}`,
        "orderedRange",
      ),
    );
  }
}

function checkRecordInvariants(record, filePath, errors) {
  checkNestedStableIds(record, "", filePath, errors);
  checkNoEmptyArrays(record, "", filePath, errors);
  checkSourceReferences(record, filePath, errors);
  checkFactualClaimSources(record, filePath, errors);

  const modelId = record.model?.id;
  if (
    typeof modelId === "string" &&
    !LEGACY_RECORDS_WITHOUT_VERIFICATION.has(modelId) &&
    record.verification?.state !== "unverified"
  ) {
    errors.push(
      makeError(
        filePath,
        "/verification/state",
        'every non-legacy record must declare verification.state = "unverified"',
        "verificationState",
      ),
    );
  }

  const apiIdentifierValues = asArray(record.api_identifiers)
    .map((identifier) => identifier?.value)
    .filter((value) => typeof value === "string");
  for (const duplicate of findDuplicates(apiIdentifierValues)) {
    errors.push(
      makeError(
        filePath,
        "/api_identifiers",
        `contains duplicate API identifier value ${JSON.stringify(duplicate)}`,
        "uniqueApiIdentifier",
      ),
    );
  }

  const normalizedModelName =
    typeof record.model?.name === "string" ? record.model.name.toLowerCase() : null;
  const aliases = asArray(record.model?.aliases).filter(
    (alias) => typeof alias === "string",
  );
  const normalizedIdentifiers = new Set(
    apiIdentifierValues.map((value) => value.toLowerCase()),
  );

  aliases.forEach((alias, index) => {
    const normalizedAlias = alias.toLowerCase();
    if (normalizedAlias === normalizedModelName) {
      errors.push(
        makeError(
          filePath,
          `/model/aliases/${index}`,
          "alias must differ from the official model name",
          "aliasIdentity",
        ),
      );
    }
    if (normalizedIdentifiers.has(normalizedAlias)) {
      errors.push(
        makeError(
          filePath,
          `/model/aliases/${index}`,
          "alias must not duplicate an API identifier",
          "aliasIdentity",
        ),
      );
    }
  });

  if (
    Number.isInteger(record.language_support?.listed_count) &&
    Array.isArray(record.language_support?.languages) &&
    record.language_support.listed_count !== record.language_support.languages.length
  ) {
    errors.push(
      makeError(
        filePath,
        "/language_support/listed_count",
        `listed_count is ${record.language_support.listed_count}, but languages contains ${record.language_support.languages.length} entries`,
        "languageCount",
      ),
    );
  }

  const profileIds = new Set(
    asArray(record.capability_profiles)
      .map((profile) => profile?.id)
      .filter((id) => typeof id === "string"),
  );

  asArray(record.pricing?.charges).forEach((charge, chargeIndex) => {
    if (
      typeof charge?.profile_id === "string" &&
      !profileIds.has(charge.profile_id)
    ) {
      errors.push(
        makeError(
          filePath,
          `/pricing/charges/${chargeIndex}/profile_id`,
          `does not resolve to capability profile ${JSON.stringify(charge.profile_id)}`,
          "profileReference",
        ),
      );
    }
  });

  asArray(record.capability_profiles).forEach((profile, profileIndex) => {
    const profilePath = `/capability_profiles/${profileIndex}`;
    checkRange(
      profile?.duration?.min,
      profile?.duration?.max,
      `${profilePath}/duration`,
      filePath,
      errors,
    );
    checkRange(
      profile?.size?.min_total_pixels,
      profile?.size?.max_total_pixels,
      `${profilePath}/size`,
      filePath,
      errors,
    );

    asArray(profile?.controls).forEach((control, controlIndex) =>
      checkRange(
        control?.min,
        control?.max,
        `${profilePath}/controls/${controlIndex}`,
        filePath,
        errors,
      ),
    );

    asArray(profile?.reference_inputs).forEach((reference, referenceIndex) =>
      checkRange(
        reference?.min_count,
        reference?.max_count,
        `${profilePath}/reference_inputs/${referenceIndex}`,
        filePath,
        errors,
      ),
    );

    const deliveryIds = new Set(
      asArray(profile?.delivery_profiles)
        .map((delivery) => delivery?.id)
        .filter((id) => typeof id === "string"),
    );
    asArray(profile?.timing?.delivery_profile_ids).forEach((deliveryId, index) => {
      if (typeof deliveryId === "string" && !deliveryIds.has(deliveryId)) {
        errors.push(
          makeError(
            filePath,
            `${profilePath}/timing/delivery_profile_ids/${index}`,
            `references missing delivery profile ${JSON.stringify(deliveryId)}`,
            "deliveryProfileReference",
          ),
        );
      }
    });

    const deliveredFormats = new Set(
      asArray(profile?.delivery_profiles).flatMap((delivery) =>
        asArray(delivery?.formats).filter((format) => typeof format === "string"),
      ),
    );
    asArray(profile?.audio_format_access).forEach((access, accessIndex) => {
      asArray(access?.format_ids).forEach((formatId, formatIndex) => {
        if (typeof formatId === "string" && !deliveredFormats.has(formatId)) {
          errors.push(
            makeError(
              filePath,
              `${profilePath}/audio_format_access/${accessIndex}/format_ids/${formatIndex}`,
              `references format ${JSON.stringify(formatId)} not exposed by a delivery profile`,
              "audioFormatReference",
            ),
          );
        }
      });
    });
  });
}

function checkGlobalModelIds(entries, errors) {
  const modelLocations = new Map();

  for (const { filePath, record } of entries) {
    const modelId = record.model?.id;
    if (typeof modelId !== "string") {
      continue;
    }

    if (modelLocations.has(modelId)) {
      const firstPath = modelLocations.get(modelId);
      errors.push(
        makeError(
          filePath,
          "/model/id",
          `duplicates model id ${JSON.stringify(modelId)} first declared in ${firstPath}`,
          "uniqueModelId",
        ),
      );
    } else {
      modelLocations.set(modelId, filePath);
    }
  }
}

export async function validateLoadedRecords(
  entries,
  { schemaPath = DEFAULT_SCHEMA_PATH } = {},
) {
  const schema = JSON.parse(await readFile(path.resolve(schemaPath), "utf8"));
  const ajv = new Ajv({
    allErrors: true,
    allowUnionTypes: true,
    strict: true,
    strictRequired: false,
  });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const errors = collectSchemaErrors(validate, entries);

  for (const { filePath, record } of entries) {
    checkRecordInvariants(record, filePath, errors);
  }
  checkGlobalModelIds(entries, errors);

  return {
    valid: errors.length === 0,
    errors,
    records: entries,
  };
}

export async function validateRegistry({
  modelsDir = DEFAULT_MODELS_DIR,
  schemaPath = DEFAULT_SCHEMA_PATH,
} = {}) {
  const files = await discoverModelFiles(modelsDir);
  const entries = [];
  const parseErrors = [];

  for (const filePath of files) {
    try {
      entries.push({ filePath, record: await readTomlFile(filePath) });
    } catch (error) {
      parseErrors.push(
        makeError(
          filePath,
          "/",
          error.message,
          error.code === "MODELSHEET_TOML_PARSE_ERROR" ? "tomlParse" : "read",
        ),
      );
    }
  }

  const result = await validateLoadedRecords(entries, { schemaPath });
  result.errors.unshift(...parseErrors);
  result.valid = result.errors.length === 0;
  return result;
}

export function formatValidationErrors(errors, { cwd = process.cwd() } = {}) {
  return errors
    .map((error) => {
      const displayPath = path.relative(cwd, error.filePath) || error.filePath;
      return `- ${displayPath}${error.instancePath}: ${error.message}`;
    })
    .join("\n");
}

function parseArguments(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--models-dir") {
      if (!argv[index + 1]) {
        throw new Error("--models-dir requires a path");
      }
      options.modelsDir = argv[index + 1];
      index += 1;
    } else if (argument === "--schema") {
      if (!argv[index + 1]) {
        throw new Error("--schema requires a path");
      }
      options.schemaPath = argv[index + 1];
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/validate.mjs [--models-dir <path>] [--schema <path>]",
    );
    return;
  }

  const result = await validateRegistry(options);
  if (!result.valid) {
    console.error(`Validation failed with ${result.errors.length} error(s):`);
    console.error(formatValidationErrors(result.errors));
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${result.records.length} model record(s).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(`Validation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
