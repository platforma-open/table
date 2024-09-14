<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue';
import { computedAsync } from '@vueuse/core';
import { useApp } from '../app';
import { model } from '@milaboratory/milaboratories.table.model';
import './ag-theme.css';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { type ColDef, ModuleRegistry } from '@ag-grid-community/core';
import { AgGridVue } from '@ag-grid-community/vue3';
import { PlBtnSecondary, PlDropdown, PlDropdownMulti } from '@milaboratory/platforma-uikit';
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

const app = useApp();
const uiState = app.createUiModel(undefined, () => ({
  settingsOpened: true,
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
    if (!pFrame || !pFrame.value) return [];
    const columns = await pfDriver.listColumns(pFrame.value);
    return columns.map((idAndSpec, i) => ({
      text: (
        idAndSpec.spec.annotations?.['pl7.app/label'] ?? 'Unlabelled column ' + i.toString()
      ).trim(),
      value: idAndSpec
    }));
  },
  [],
  columnOptionsEvaluating
);
const columnSelected = computed({
  get: () => uiState.model.mainColumn,
  set: (idAndSpec) => {
    uiState.model.mainColumn = idAndSpec;
    uiState.model.enrichmentColumns = [];
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
    if (!pFrame || !pFrame.value || !column.selected) return [];
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
          }) as AxisId
      ),
      strictlyCompatible: true
    });
    return response.hits
      .filter((idAndSpec) => idAndSpec.columnId !== column.selected?.columnId)
      .map((idAndSpec, i) => ({
        text: (
          idAndSpec.spec.annotations?.['pl7.app/label'] ?? 'Unlabelled column ' + i.toString()
        ).trim(),
        value: idAndSpec
      }));
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

function getValueType(spec: PTableColumnSpec): ValueType {
  if (spec.type == 'axis') {
    return spec.spec.type;
  } else {
    return spec.spec.valueType;
  }
}

function getColDef(colId: string, spec: PTableColumnSpec, iCol: number): ColDef {
  const colDef: ColDef = {
    field: colId,
    headerName: (spec.spec.annotations?.['pl7.app/label'] ?? 'Unlabeled ' + iCol.toString()).trim(),
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
    // filter: true
  };

  if (spec.type == 'axis') {
    // colDef.pinned = 'left';
    colDef.lockPosition = true;
  }

  const dataType = getValueType(spec);
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

class BooleanArrayView {
  array: Uint8Array;

  constructor(array: Uint8Array) {
    this.array = array;

    return new Proxy(this, {
      get(target, prop) {
        return prop in target ? target[prop as keyof typeof target] : target.get(Number(prop));
      }
    });
  }

  get(index: number): boolean {
    const chunkIndex = Math.floor(index / 8);
    const mask = 1 << (7 - (index % 8));
    return (this.array[chunkIndex] & mask) > 0;
  }
}

async function calculateAgTableData(columns: FullPTableColumnData[]): Promise<AgTableData> {
  const nCols = columns.length;
  const nRows = columns[0].data.data.length;

  const colDefs = [];
  for (let iCol = 0; iCol < nCols; ++iCol) {
    const colId = iCol.toString();
    colDefs.push(getColDef(colId, columns[iCol].spec, iCol));
  }

  const absenceReaders = [];
  for (let iCol = 0; iCol < nCols; ++iCol) {
    absenceReaders.push(new BooleanArrayView(columns[iCol].data.absent));
  }

  const rowData = [];
  for (let iRow = 0; iRow < nRows; ++iRow) {
    const row: Record<string, any> = {};

    for (let iCol = 0; iCol < nCols; ++iCol) {
      const col = columns[iCol];
      const colId = iCol.toString();
      const value = col.data.data[iRow];
      const dataType = getValueType(columns[iCol].spec);
      if (absenceReaders[iCol].get(iRow)) {
        row[colId] = null; // NULL
      } else if (isValueNA(value, dataType)) {
        row[colId] = undefined; // NA
      } else if (dataType === 'Long') {
        row[colId] = Number(value);
      } else {
        row[colId] = value;
      }
    }

    rowData.push(row);
  }

  return { colDefs, rowData };
}

watch(
  () => ({
    mainColumn: uiState.model.mainColumn,
    enrichmentColumns: uiState.model.enrichmentColumns
  }),
  async (selection) => {
    if (!pFrame || !pFrame.value || !selection.mainColumn) {
      agData.value = {
        colDefs: [],
        rowData: []
      };
      return;
    }

    const pTable = await pfDriver.calculateTableData(pFrame.value, {
      src: {
        type: 'outer',
        primary: {
          type: 'column',
          column: selection.mainColumn.columnId
        },
        secondary: selection.enrichmentColumns.map((column) => ({
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
  <div class="container">
    <div style="flex: 1">
      <AgGridVue
        :columnDefs="agData?.colDefs"
        :rowData="agData?.rowData"
        :style="{ height: '100%' }"
        :autoSizeStrategy="{ type: 'fitCellContents' }"
      />
      <div class="overlay">
        <Transition name="slide-fade">
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
</template>

<style lang="css">
.container {
  display: flex;
  height: 100%;
  gap: 12px;
  margin: 12px;
  min-width: 760px;
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
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-40px);
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
