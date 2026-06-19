import { createPlDataTableStateV2, DataModelBuilder } from "@platforma-sdk/model";
import type { BlockData, ColumnGroup, LegacyBlockArgs, LegacyUiState } from "./types";

const emptyGroup = (): ColumnGroup => ({
  mainColumn: undefined,
  additionalColumns: [],
  enrichmentColumns: [],
});

export const blockDataModel = new DataModelBuilder()
  .from<BlockData>("v1")
  // Legacy V1 stored everything under `uiState`; args was always empty. Pick the
  // two fields we keep — obsolete keys (filtersOpen, filterModel, tableState,
  // settingsOpened) are dropped here instead of by the old UI-side upgrader.
  .upgradeLegacy<LegacyBlockArgs, LegacyUiState>(({ uiState }) => ({
    group: uiState?.group ?? emptyGroup(),
    tableStateV2: uiState?.tableStateV2 ?? createPlDataTableStateV2(),
  }))
  .init(() => ({
    group: emptyGroup(),
    tableStateV2: createPlDataTableStateV2(),
  }));
