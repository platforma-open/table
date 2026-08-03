import type { PColumnIdAndSpec, PlDataTableStateV2 } from "@platforma-sdk/model";

/**
 * The table block has no workflow inputs — its workflow is a pass-through and
 * all of its state is UI-only view state. Args therefore project to an empty
 * object and never gate the block.
 */
export type BlockArgs = Record<string, never>;

export type ColumnGroup = {
  mainColumn?: PColumnIdAndSpec;
  additionalColumns: PColumnIdAndSpec[];
  enrichmentColumns: PColumnIdAndSpec[];
};

/**
 * Unified V3 data. Everything here is pure UI/view state (column selection and
 * table grid state) — nothing is projected into args/prerunArgs.
 */
export type BlockData = {
  group: ColumnGroup;
  tableStateV2: PlDataTableStateV2;
};

/** Legacy V1 on-disk shapes, consumed once by `.upgradeLegacy`. */
export type LegacyBlockArgs = Record<string, never>;
export type LegacyUiState = {
  group?: ColumnGroup;
  tableStateV2?: PlDataTableStateV2;
};
