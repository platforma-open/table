<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue';
import { computedAsync } from '@vueuse/core';
import { useApp } from '../app';
import { model } from '@milaboratory/milaboratories.table.model';
import './ag-theme.css';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import {
  type ColDef,
  ModuleRegistry,
  type GridOptions,
  type GridApi
} from '@ag-grid-community/core';
import { AgGridVue } from '@ag-grid-community/vue3';
import {
  PlAlert,
  PlBtnSecondary,
  PlDropdown,
  PlDropdownMulti
} from '@milaboratory/platforma-uikit';
import {
  type PTableColumnSpec,
  type ValueType,
  type FullPTableColumnData,
  type AxisId,
  PValueInt,
  PValueIntNA,
  PValueLongNA,
  PValueFloat,
  PValueFloatNA,
  PValueDouble,
  PValueDoubleNA,
  PValueString,
  PValueStringNA,
  PValueBytes,
  PValueBytesNA
} from '@milaboratory/sdk-ui';
import * as lodash from 'lodash';

const app = useApp();
const uiState = app.createUiModel(undefined, () => ({
  settingsOpened: true,
  additionalColumns: [],
  enrichmentColumns: []
}));

const pfDriver = model.pFrameDriver;
const pFrame = computed(() => app.getOutputFieldOkOptional('pFrame'));

ModuleRegistry.registerModules([ClientSideRowModelModule]);

const settingsOpened = computed({
  get: () => uiState.model.settingsOpened,
  set: (opened) => {
    uiState.model.settingsOpened = opened;
    uiState.save();
  }
});

const columnOptionsEvaluating = ref(false);
const columnPlaceholder = computed(() =>
  columnOptionsEvaluating.value ? 'Loading columns...' : 'Select the main column'
);
const columnOptions = computedAsync(
  async () => {
    if (!pFrame?.value) return [];
    const columns = await pfDriver.listColumns(pFrame.value);
    return columns
      .map((idAndSpec, i) => ({
        text:
          idAndSpec.spec.annotations?.['pl7.app/label']?.trim() ??
          'Unlabelled column ' + i.toString(),
        value: idAndSpec
      }))
      .sort((lhs, rhs) => lhs.text.localeCompare(rhs.text));
  },
  [],
  columnOptionsEvaluating
);
const columnSelected = computed({
  get: () => uiState.model.mainColumn,
  set: (idAndSpec) => {
    uiState.model.mainColumn = idAndSpec;
    uiState.model.additionalColumns = [];
    uiState.model.enrichmentColumns = [];
    uiState.model.gridState = undefined;
    uiState.save();
  }
});
const column = reactive({
  label: 'Main column',
  placeholder: columnPlaceholder,
  options: columnOptions,
  selected: columnSelected,
  disabled: columnOptionsEvaluating
});

const additionalPlaceholder = computed(() =>
  !column.selected ? 'First, select the main column' : 'Select additional columns'
);
const additionalOptions = computed(() => {
  return columnOptions.value.filter(
    (option) =>
      !lodash.isEqual(option.value.columnId, column.selected?.columnId) &&
      lodash.isEqual(option.value.spec.axesSpec, column.selected?.spec.axesSpec)
  );
});
const additionalSelected = computed({
  get: () => uiState.model.additionalColumns,
  set: (idsAndSpecs) => {
    uiState.model.additionalColumns = idsAndSpecs;
    uiState.save();
  }
});
const additionalDisabled = computed(() => !column.selected);
const additional = reactive({
  label: 'Additional columns',
  placeholder: additionalPlaceholder,
  options: additionalOptions,
  selected: additionalSelected,
  disabled: additionalDisabled
});

const enrichmentEvaluating = ref(false);
const enrichmentPlaceholder = computed(() =>
  !column.selected
    ? 'First, select the main column'
    : enrichmentEvaluating.value
      ? 'Loading columns...'
      : 'Select enrichment columns'
);
const enrichmentOptions = computedAsync(
  async () => {
    if (!pFrame?.value || !column.selected) return [];
    const response = await pfDriver.findColumns(pFrame.value, {
      columnFilter: {},
      compatibleWith: column.selected.spec.axesSpec.map(
        (axis) =>
          ({
            type: axis.type,
            name: axis.name,
            domain: Object.entries(axis.domain ?? []).reduce(
              (acc, [key, value]) => {
                acc[key] = value;
                return acc;
              },
              {} as Record<string, string>
            )
          }) satisfies AxisId
      ),
      strictlyCompatible: true
    });
    return response.hits
      .filter(
        (idAndSpec) =>
          !lodash.isEqual(idAndSpec.columnId, column.selected?.columnId) &&
          lodash.findIndex(additional.options, (option) =>
            lodash.isEqual(option.value.columnId, idAndSpec.columnId)
          ) === -1
      )
      .map((idAndSpec, i) => ({
        text:
          idAndSpec.spec.annotations?.['pl7.app/label']?.trim() ??
          'Unlabelled column ' + i.toString(),
        value: idAndSpec
      }))
      .sort((lhs, rhs) => lhs.text.localeCompare(rhs.text));
  },
  [],
  enrichmentEvaluating
);
const enrichmentSelected = computed({
  get: () => uiState.model.enrichmentColumns,
  set: (idsAndSpecs) => {
    uiState.model.enrichmentColumns = idsAndSpecs;
    uiState.save();
  }
});
const enrichmentDisabled = computed(() => !column.selected && !enrichmentEvaluating.value);
const enrichment = reactive({
  label: 'Enrichment columns',
  placeholder: enrichmentPlaceholder,
  options: enrichmentOptions,
  selected: enrichmentSelected,
  disabled: enrichmentDisabled
});

type AgTableData = {
  colDefs: ColDef[];
  rowData: any[];
};
const agData = ref<AgTableData>();
const gridState = computed({
  get: () => uiState.model.gridState,
  set: (gridState) => {
    if (!lodash.isEqual(gridState, uiState.model.gridState)) {
      uiState.model.gridState = gridState;
      uiState.save();
    }
  }
});
let agGridApi: GridApi | undefined = undefined;
const agOptions: GridOptions = {
  animateRows: false,
  suppressColumnMoveAnimation: true,
  initialState: gridState.value,
  onGridReady: (event) => {
    agGridApi = event.api;
  },
  onStateUpdated: (event) => {
    gridState.value = event.state;
  },
  autoSizeStrategy: {
    type: 'fitCellContents'
  },
  onRowDataUpdated: (event) => {
    event.api.autoSizeAllColumns();
  }
};
const agReloadKey = ref(0);
watch(
  () => gridState.value,
  (gridState) => {
    if (!lodash.isEqual(gridState, agGridApi?.getState())) {
      agOptions.initialState = gridState;
      ++agReloadKey.value;
    }
  }
);

function getColDef(colId: string, spec: PTableColumnSpec, iCol: number): ColDef {
  const colDef: ColDef = {
    field: colId,
    headerName:
      spec.spec.annotations?.['pl7.app/label']?.trim() ??
      'Unlabeled ' + spec.type + ' ' + iCol.toString(),
    cellDataType: 'text',
    valueFormatter: (value) => {
      if (!value) {
        return 'ERROR';
      } else if (value.value === null) {
        return 'NULL';
      } else if (value.value === undefined) {
        return 'NA';
      } else {
        return value.value.toString();
      }
    }
  };

  if (spec.type == 'axis') {
    colDef.lockPosition = true;
  }

  let dataType: ValueType;
  if (spec.type == 'axis') {
    dataType = spec.spec.type;
  } else {
    dataType = spec.spec.valueType;
  }
  if (dataType == 'Int' || dataType == 'Long' || dataType == 'Float' || dataType == 'Double') {
    colDef.cellDataType = 'number';
  }

  return colDef;
}

function isValueNA(value: unknown, type: ValueType): boolean {
  if (type == 'Int') {
    return (value as PValueInt) === PValueIntNA;
  } else if (type == 'Long') {
    return (value as BigInt) === PValueLongNA;
  } else if (type == 'Float') {
    return (value as PValueFloat) === PValueFloatNA;
  } else if (type == 'Double') {
    return (value as PValueDouble) === PValueDoubleNA;
  } else if (type == 'String') {
    return (value as PValueString) === PValueStringNA;
  } else if (type == 'Bytes') {
    return (value as PValueBytes) === PValueBytesNA;
  } else {
    throw Error('Unsupported value type: ' + type);
  }
}

function isValueAbsent(array: Uint8Array, index: number): boolean {
  const chunkIndex = Math.floor(index / 8);
  const mask = 1 << (7 - (index % 8));
  return (array[chunkIndex] & mask) > 0;
}

async function calculateAgTableData(columns: FullPTableColumnData[]): Promise<AgTableData> {
  const nCols = columns.length;
  const nRows = columns[0].data.data.length;

  const colDefs = [];
  for (let iCol = 0; iCol < nCols; ++iCol) {
    const colId = iCol.toString();
    colDefs.push(getColDef(colId, columns[iCol].spec, iCol));
  }

  const rowData = [];
  for (let iRow = 0; iRow < nRows; ++iRow) {
    const row: Record<string, any> = {};

    for (let iCol = 0; iCol < nCols; ++iCol) {
      const col = columns[iCol];
      const colId = iCol.toString();
      const value = col.data.data[iRow];
      if (isValueAbsent(columns[iCol].data.absent, iRow)) {
        row[colId] = null; // NULL
      } else if (isValueNA(value, columns[iCol].data.type)) {
        row[colId] = undefined; // NA
      } else {
        row[colId] = columns[iCol].data.type === 'Long' ? Number(value) : value;
      }
    }

    rowData.push(row);
  }

  return { colDefs, rowData };
}

watch(
  () =>
    [
      pFrame?.value,
      columnSelected?.value,
      additionalSelected.value,
      enrichmentSelected.value
    ] as const,
  async (state, prevState) => {
    if (lodash.isEqual(state, prevState)) {
      return;
    }

    const [pFrame, mainColumn, additionalColumns, enrichmentColumns] = state;
    agData.value = undefined;
    if (!pFrame) return;
    if (!mainColumn) {
      agData.value = {
        colDefs: [],
        rowData: []
      };
      return;
    }

    const pTable = await pfDriver.calculateTableData(pFrame, {
      src: {
        type: 'outer',
        primary: {
          type: 'full',
          entries: additionalColumns
            .map(
              (column) =>
                ({
                  type: 'column',
                  column: column.columnId
                }) as const
            )
            .concat({
              type: 'column',
              column: mainColumn.columnId
            })
        },
        secondary: enrichmentColumns.map((column) => ({
          type: 'column',
          column: column.columnId
        }))
      },
      filters: [],
      sorting: []
    });
    agData.value = await calculateAgTableData(pTable);
  },
  { immediate: true }
);
</script>

<template>
  <div class="box">
    <Transition name="alert-transition">
      <PlAlert v-if="!pFrame" type="warn" :icon="true" label="Columns not loaded">
        Outputs of upstream blocks are either not ready or contain malformed columns
      </PlAlert>
    </Transition>
    <div class="container">
      <div style="flex: 1">
        <AgGridVue
          :gridOptions="agOptions"
          :columnDefs="agData?.colDefs"
          :rowData="agData?.rowData"
          style="height: 100%"
          :key="agReloadKey"
        />
        <div class="overlay">
          <Transition name="settings-transition">
            <div class="settings-panel" v-if="settingsOpened">
              <div class="text-subtitle-s settings-header">Select columns to view</div>
              <form class="settings-form">
                <PlDropdown
                  :label="column.label"
                  :placeholder="column.placeholder"
                  :options="column.options"
                  v-model="column.selected"
                  clearable
                  :disabled="column.disabled"
                />
                <PlDropdownMulti
                  :label="additional.label"
                  :placeholder="additional.placeholder"
                  :options="additional.options"
                  v-model="additional.selected"
                  clearable
                  :disabled="additional.disabled"
                />
                <PlDropdownMulti
                  :label="enrichment.label"
                  :placeholder="enrichment.placeholder"
                  :options="enrichment.options"
                  v-model="enrichment.selected"
                  clearable
                  :disabled="enrichment.disabled"
                />
              </form>
            </div>
          </Transition>
        </div>
      </div>
      <PlBtnSecondary
        size="large"
        icon="link"
        class="settings-button"
        :class="{ 'active-button': settingsOpened }"
        @click="settingsOpened = !settingsOpened"
      />
    </div>
  </div>
</template>

<style lang="css">
.box {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
  margin: 12px;
  min-width: 760px;
}
.alert-transition-enter-active,
.alert-transition-leave-active {
  transition: all 0.2s ease-in-out;
}
.alert-transition-enter-from,
.alert-transition-leave-to {
  margin-top: -88px;
}
.container {
  display: flex;
  flex-direction: row;
  flex: 1;
  gap: 12px;
}
.overlay {
  position: relative;
  z-index: 2;
  inset: calc(-100% + 68px) 0 0 0;
  display: flex;
  flex-direction: row-reverse;
  width: calc(100% + 74px);
}
.settings-button {
  gap: 0;
  z-index: 3;
}
.active-button {
  background: var(--btn-active-select);
}
.settings-transition-enter-active,
.settings-transition-leave-active {
  transition: all 0.15s ease-in-out;
}
.settings-transition-enter-from,
.settings-transition-leave-to {
  transform: translateY(-68px);
  opacity: 0;
}
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 40%;
  min-width: 280px;
  max-width: 420px;
  border-radius: 8px;
  border: 1px solid var(--border-color-default);
  background: var(--bg-elevated-01);
  box-shadow:
    0 6px 24px -2px rgba(15, 36, 77, 0.08),
    0px 4px 12px -2px rgba(15, 36, 77, 0.08);
}
.settings-header {
  padding: 12px;
  border-radius: 8px 8px 0 0;
  border-bottom: 1px solid var(--border-color-default);
  background-color: var(--bg-elevated-02);
}
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin: 6px 12px 18px;
}
</style>
