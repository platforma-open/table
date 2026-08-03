---
"@platforma-open/milaboratories.table": patch
"@platforma-open/milaboratories.table.model": patch
"@platforma-open/milaboratories.table.ui": patch
"@platforma-open/milaboratories.table.workflow": patch
---

Migrate to the block-tools structurer and to BlockModelV3.

- Adopt the tool-managed layout (oxlint/oxfmt, managed tsconfig/turbo/catalog) and
  complete the SDK upgrade (model/ui-vue 1.79, workflow-tengo 6, tengo-builder 4).
- Migrate the model from the legacy V1 API to BlockModelV3 with a unified data
  model; persisted state is carried over by a one-time legacy upgrader. All state
  is UI-only (column selection + table grid state); args project to an empty object.
- Build the data table with createPlDataTableV3 (replacing createPlDataTableV2).
- UI bindings move from app.model.ui to app.model.data; the app uses defineAppV3.
