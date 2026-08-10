# `@modelsheet/registry`

Typed, dependency-free access to Modelsheet's generated media-model registry.
The package ships the deterministic `api.json` snapshot plus small query helpers
for Node.js 22 and later.

Publication is deliberately deferred. Version `0.1.0` is publish-ready, but the
package must not be published until the project chooses a release cadence.

## Usage

```js
import registry, {
  findModels,
  getModel,
  getModelCounts,
} from "@modelsheet/registry";

const candidates = findModels({
  documentationState: "documented",
  modality: "video",
  aspectRatio: "9:16",
  maxDurationAtLeast: 10,
  nativeAudioState: "supported",
});

const model = getModel("black-forest-labs/flux-3-video");
console.log(registry.schema_version, getModelCounts(candidates), model?.sources);
```

CommonJS exposes the same named values:

```js
const { findModels, registry } = require("@modelsheet/registry");
```

The raw, JSON-safe artifact is also exported:

```js
import data from "@modelsheet/registry/api.json" with { type: "json" };
```

`findModels()` accepts model-level filters (`modality`,
`documentationState`, `verificationState`, `lab`, `status`, `pricingState`,
and `search`) and capability-profile filters (`task`, `aspectRatio`,
`maxDurationAtLeast`, `nativeAudioState`, and `referenceRole`). Capability
filters must all match the same profile, so the helper never invents support by
combining unrelated profiles.

Use `getModel()` for an official ID, official name, alias, or API identifier.
It returns `undefined` when there is no match and throws when a non-ID lookup is
ambiguous. Use `getModelById()` when only a stable ID is acceptable.

## Preparing a release

From the repository root, build `artifacts/api.json`. Then run:

```powershell
cd packages/registry
npm.cmd ci
npm.cmd run sync-data
npm.cmd run check
npm.cmd pack --dry-run
```

Commit the synchronized `data/api.json` with any future version bump. Publishing
to npm remains a human release action and is not performed by CI.
