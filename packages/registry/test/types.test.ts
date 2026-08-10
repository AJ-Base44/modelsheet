import registry, {
  findModels,
  getModel,
  getModelCounts,
  listLabs,
  resolveSources,
  type Modality,
  type ModelsheetRecord,
} from "@modelsheet/registry";

const modality: Modality = "video";
const matches: readonly Readonly<ModelsheetRecord>[] = findModels({
  modality,
  documentationState: "documented",
  task: ["text_to_video", "image_to_video"],
  aspectRatio: "9:16",
  maxDurationAtLeast: 10,
  nativeAudioState: "supported",
});

const model = getModel("Grok Video 1.5");
if (model) {
  const sources = resolveSources(model, model.model.source_ids);
  sources.forEach((source) => new URL(source.url));
}

getModelCounts(matches);
listLabs(registry.models);
