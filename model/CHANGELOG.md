# @platforma-open/milaboratories.table.model

## 1.1.3

### Patch Changes

- 87ea4de: Migrate to the block-tools structurer and to BlockModelV3.

  - Adopt the tool-managed layout (oxlint/oxfmt, managed tsconfig/turbo/catalog) and
    complete the SDK upgrade (model/ui-vue 1.79, workflow-tengo 6, tengo-builder 4).
  - Migrate the model from the legacy V1 API to BlockModelV3 with a unified data
    model; persisted state is carried over by a one-time legacy upgrader. All state
    is UI-only (column selection + table grid state); args project to an empty object.
  - Build the data table with createPlDataTableV3 (replacing createPlDataTableV2).
  - UI bindings move from app.model.ui to app.model.data; the app uses defineAppV3.

## 1.1.2

### Patch Changes

- bd8924a: Update SDK

## 1.1.1

### Patch Changes

- d2e9f5b: Technical release

## 1.1.0

### Minor Changes

- c904b9e: Migration to new boilerplate, PlAgDataTableV2

## 1.0.0

### Major Changes

- e4c9775: Depepdancy update

## 0.5.14

### Patch Changes

- 95b64ac: Dependancy update

## 0.5.13

### Patch Changes

- PlAgDataTable export CSV component

## 0.5.12

### Patch Changes

- 85cef8c: PlAgDataTable loading fix

## 0.5.11

### Patch Changes

- Table filters redesign

## 0.5.10

### Patch Changes

- PlAgDataTable export CSV

## 0.5.9

### Patch Changes

- Disable modal shadow

## 0.5.8

### Patch Changes

- Dependancy versions bump

## 0.5.7

### Patch Changes

- Added ui state upgrader

## 0.5.6

### Patch Changes

- Filters bugfix

## 0.5.5

### Patch Changes

- Added filters support

## 0.5.4

### Patch Changes

- PlAgDataTable version update

## 0.5.3

### Patch Changes

- Updated settings button icon

## 0.5.2

### Patch Changes

- Table design update

## 0.5.1

### Patch Changes

- Logo update

## 0.5.0

### Minor Changes

- Replace label-axes with label-columns

## 0.4.0

### Minor Changes

- dafb002: migratio to platforma-open

## 0.3.0

### Minor Changes

- migrated to public modules

## 0.2.4

### Patch Changes

- Fix limit behaviour

## 0.2.3

### Patch Changes

- Preserve sheet selectors order

## 0.2.2

### Patch Changes

- Initial partitioning support

## 0.2.1

### Patch Changes

- Wait for results before building ptable

## 0.2.0

### Minor Changes

- Migrated to PlAgTadaTable

## 0.1.5

### Patch Changes

- Css fix

## 0.1.4

### Patch Changes

- Fix placeholder

## 0.1.3

### Patch Changes

- Additional columns selector

## 0.1.2

### Patch Changes

- Alert when columns not loaded

## 0.1.1

### Patch Changes

- View is reloaded when new grid state is set over the network.
