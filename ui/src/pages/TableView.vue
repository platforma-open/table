<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue';
import { computedAsync } from '@vueuse/core';
import { useApp } from '../app';
import { model } from '@platforma-open/milaboratories.table.model';
import { PlAlert, PlBtnSecondary, PlDropdown, PlDropdownMulti } from '@milaboratories/uikit';
import {
  type ValueType,
  type PValueInt,
  PValueIntNA,
  PValueLongNA,
  type PValueFloat,
  PValueFloatNA,
  type PValueDouble,
  PValueDoubleNA,
  type PValueString,
  PValueStringNA,
  type PValueBytes,
  PValueBytesNA,
  getAxesId,
  type PColumnIdAndSpec,
  type PFrameHandle,
  type PObjectId,
  type JoinEntry,
  mapJoinEntry
} from '@platforma-sdk/model';
import * as lodash from 'lodash';
import {
  PlAgDataTable,
  type PlDataTableSheet,
  type PlDataTableSettings
} from '@platforma-sdk/ui-vue';

const app = useApp();
const uiState = app.createUiModel(undefined, () => ({
  settingsOpened: true,
  group: {
    mainColumn: undefined,
    additionalColumns: [],
    enrichmentColumns: [],
    labelColumns: [],
    possiblePartitioningAxes: []
  },
  partitioningAxes: [],
  tableState: {
    gridState: {},
    pTableParams: {
      sorting: [],
      filters: []
    }
  }
}));

const pfDriver = model.pFrameDriver;
const pFrame = computed(() => app.getOutputFieldOkOptional('pFrame'));

const settingsOpened = computed({
  get: () => uiState.model.settingsOpened,
  set: (opened) => {
    uiState.model.settingsOpened = opened;
  }
});

const columnOptionsEvaluating = ref(false);
const columnPlaceholder = computed(() =>
  columnOptionsEvaluating.value ? 'Loading columns...' : 'Select the main column'
);
const columnOptions = computedAsync(
  async () => {
    if (!pFrame.value) return [];
    const columns = await pfDriver.listColumns(pFrame.value);
    return columns
      .filter(
        (idAndSpec) =>
          !(idAndSpec.spec.axesSpec.length === 1 && idAndSpec.spec.name === 'pl7.app/label')
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
  columnOptionsEvaluating
);
const columnSelected = ref<PColumnIdAndSpec>();
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
const additionalSelected = ref<PColumnIdAndSpec[]>([]);
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
    if (!pFrame.value || !column.selected) return [];
    const response = await pfDriver.findColumns(pFrame.value, {
      columnFilter: {},
      compatibleWith: getAxesId(column.selected.spec.axesSpec).map(lodash.cloneDeep),
      strictlyCompatible: true
    });
    return response.hits
      .filter(
        (idAndSpec) =>
          !(idAndSpec.spec.axesSpec.length === 1 && idAndSpec.spec.name === 'pl7.app/label') &&
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
const enrichmentSelected = ref<PColumnIdAndSpec[]>([]);
const enrichmentDisabled = computed(() => !column.selected && !enrichmentEvaluating.value);
const enrichment = reactive({
  label: 'Enrichment columns',
  placeholder: enrichmentPlaceholder,
  options: enrichmentOptions,
  selected: enrichmentSelected,
  disabled: enrichmentDisabled
});

async function getLabelColumns(
  pFrame: PFrameHandle,
  idsAndSpecs: PColumnIdAndSpec[]
): Promise<PColumnIdAndSpec[]> {
  if (!idsAndSpecs.length) return [];

  const response = await pfDriver.findColumns(pFrame, {
    columnFilter: {
      name: ['pl7.app/label']
    },
    compatibleWith: lodash.uniqWith(
      idsAndSpecs.map((column) => getAxesId(column.spec.axesSpec).map(lodash.cloneDeep)).flat(),
      lodash.isEqual
    ),
    strictlyCompatible: true
  });
  return response.hits.filter((idAndSpec) => idAndSpec.spec.axesSpec.length === 1);
}

watch(
  () => uiState.model.group,
  (group) => {
    columnSelected.value = group.mainColumn;
    additionalSelected.value = group.additionalColumns;
    enrichmentSelected.value = group.enrichmentColumns;
  },
  { immediate: true }
);

function makeJoin(
  mainColumn: PColumnIdAndSpec | undefined,
  additionalColumns: PColumnIdAndSpec[],
  enrichmentColumns: PColumnIdAndSpec[],
  labelColumns: PColumnIdAndSpec[]
): JoinEntry<PColumnIdAndSpec> | undefined {
  if (!mainColumn) return undefined;
  return {
    type: 'outer',
    primary: {
      type: 'full',
      entries: [mainColumn, ...additionalColumns].map(
        (column) =>
          ({
            type: 'column',
            column: column
          }) as const
      )
    },
    secondary: [...enrichmentColumns, ...labelColumns].map((column) => ({
      type: 'column',
      column: column
    }))
  };
}

watch(
  () =>
    [
      pFrame.value,
      columnSelected.value,
      additionalOptions.value,
      additionalSelected.value,
      enrichmentEvaluating.value,
      enrichmentOptions.value,
      enrichmentSelected.value
    ] as const,
  async (state, prevState) => {
    if (lodash.isEqual(state, prevState)) return;

    const [
      pFrame,
      column,
      additionalOptions,
      additional,
      enrichmentEvaluating,
      enrichmentOptions,
      enrichment
    ] = state;
    const [_, prevColumn] = prevState;

    if (!lodash.isEqual(column, prevColumn)) {
      let labelColumns: PColumnIdAndSpec[] = [];
      if (column) {
        if (!pFrame) return;
        labelColumns = await getLabelColumns(pFrame, [column]);
      }
      const join = makeJoin(column, [], [], labelColumns);
      uiState.model.group = {
        mainColumn: column,
        additionalColumns: [],
        enrichmentColumns: [],
        labelColumns,
        possiblePartitioningAxes: getAxesId(column?.spec.axesSpec ?? []).map(lodash.cloneDeep),
        join
      };
      uiState.model.partitioningAxes = [];
      uiState.model.tableState = {
        gridState: {},
        pTableParams: {
          sorting: [],
          filters: []
        }
      };
      return;
    }

    if (!pFrame || !column || enrichmentEvaluating) return;

    (() => {
      const options = additionalOptions;
      additional.sort((lhs, rhs) => {
        const li = lodash.findIndex(options, (option) => lodash.isEqual(option.value, lhs));
        const ri = lodash.findIndex(options, (option) => lodash.isEqual(option.value, rhs));
        return li - ri;
      });
    })();

    (() => {
      const options = enrichmentOptions;
      enrichment.sort((lhs, rhs) => {
        const li = lodash.findIndex(options, (option) => lodash.isEqual(option.value, lhs));
        const ri = lodash.findIndex(options, (option) => lodash.isEqual(option.value, rhs));
        return li - ri;
      });
    })();

    const labelColumns = await getLabelColumns(pFrame, [column, ...enrichment]);
    const join = makeJoin(column, additional, enrichment, labelColumns);

    uiState.model.group = {
      mainColumn: column,
      additionalColumns: additional,
      enrichmentColumns: enrichment,
      labelColumns,
      possiblePartitioningAxes: getAxesId(column.spec.axesSpec).map(lodash.cloneDeep),
      join
    };
  }
);

function isValueNA(value: unknown, valueType: ValueType): boolean {
  switch (valueType) {
    case 'Int':
      return (value as PValueInt) === PValueIntNA;
    case 'Long':
      return (value as bigint) === PValueLongNA;
    case 'Float':
      return (value as PValueFloat) === PValueFloatNA;
    case 'Double':
      return (value as PValueDouble) === PValueDoubleNA;
    case 'String':
      return (value as PValueString) === PValueStringNA;
    case 'Bytes':
      return (value as PValueBytes) === PValueBytesNA;
    default:
      throw Error(`unsupported data type: ${valueType satisfies never}`);
  }
}

function toDisplayValue(
  value: string | number | bigint | Uint8Array,
  valueType: ValueType
): string | number {
  switch (valueType) {
    case 'Int':
      return value as number;
    case 'Long':
      return Number(value as bigint);
    case 'Float':
      return value as number;
    case 'Double':
      return value as number;
    case 'String':
      return value as string;
    case 'Bytes':
      return Buffer.from(value as Uint8Array).toString('hex');
    default:
      throw Error(`unsupported data type: ${valueType satisfies never}`);
  }
}

const partitioningEvaluating = ref(false);
const partitioningPlaceholder = computed(() =>
  !column.selected
    ? 'First, select the main column'
    : partitioningEvaluating.value
      ? 'Loading axes...'
      : 'Select axes for partitioning'
);
const partitioningOptions = computedAsync(
  async () => {
    const possiblePartitioningAxes = uiState.model.group.possiblePartitioningAxes;
    if (!possiblePartitioningAxes) return [];
    const axes = possiblePartitioningAxes.filter((spec) => spec.type !== 'Bytes');

    const join = uiState.model.group.join;
    if (!join) return [];

    const pFrameHandle = pFrame.value;
    if (!pFrameHandle) return [];

    const columns: PColumnIdAndSpec[] = [];
    mapJoinEntry(join, (idAndSpec) => {
      columns.push(idAndSpec);
      return idAndSpec;
    });

    const mapping: [number, number][][] = axes.map((_) => []);
    const labelCol: (PObjectId | null)[] = axes.map((_) => null);
    for (let i = 0; i < columns.length; ++i) {
      const axesId = getAxesId(columns[i].spec.axesSpec);
      for (let j = 0; j < axesId.length; ++j) {
        const k = lodash.findIndex(axes, (axis) => lodash.isEqual(axis, axesId[j]));
        if (k === -1 || labelCol[k]) continue;

        if (axesId.length === 1 && columns[i].spec.name === 'pl7.app/label') {
          mapping[k] = [[i, j]];
          labelCol[k] = columns[i].columnId;
        } else {
          mapping[k].push([i, j]);
        }
      }
    }

    for (let i = axes.length - 1; i >= 0; --i) {
      if (!mapping[i].length) {
        labelCol.splice(i, 1);
        mapping.splice(i, 1);
        axes.splice(i, 1);
      }
    }

    const limit = 100;
    const possibleValues: Set<string | number>[] = axes.map((_) => new Set());

    loop1: for (let i = axes.length - 1; i >= 0; --i) {
      for (const [column, _] of mapping[i]) {
        const response = await pfDriver.getUniqueValues(pFrameHandle, {
          columnId: columns[column].columnId,
          ...(!labelCol[i] && { axis: lodash.cloneDeep(axes[i]) }),
          filters: [],
          limit
        });
        if (response.overflow) {
          labelCol.splice(i, 1);
          mapping.splice(i, 1);
          axes.splice(i, 1);
          continue loop1;
        }

        const valueType = response.values.type;
        for (const value of response.values.data) {
          if (isValueNA(value, valueType) || value === null) continue;
          possibleValues[i].add(toDisplayValue(value, valueType));

          if (possibleValues[i].size === limit) {
            labelCol.splice(i, 1);
            mapping.splice(i, 1);
            axes.splice(i, 1);
            continue loop1;
          }
        }
      }

      if (!possibleValues[i].size) {
        labelCol.splice(i, 1);
        mapping.splice(i, 1);
        axes.splice(i, 1);
        continue loop1;
      }
    }

    const labels = mapping.map(
      (entries, i) =>
        columns[entries[0][0]].spec.axesSpec[entries[0][1]].annotations?.[
          'pl7.app/label'
        ]?.trim() ?? 'Unlabelled axis ' + i.toString()
    );

    return axes.map((axis, i) => {
      const options = [...possibleValues[i]].map((value) => ({
        value: value,
        text: value.toString()
      }));
      const defaultValue = options[0].value;
      return {
        text: labels[i],
        value: {
          axis: lodash.cloneDeep(axis),
          ...(labelCol[i] && { column: labelCol[i] }),
          options,
          defaultValue
        } as PlDataTableSheet
      };
    });
  },
  [],
  partitioningEvaluating
);
const partitioningSelected = computed({
  get: () => uiState.model.partitioningAxes,
  set: (partitioningAxes) => {
    const options = partitioningOptions.value;
    partitioningAxes.sort((lhs, rhs) => {
      const li = lodash.findIndex(options, (option) => lodash.isEqual(option.value, lhs));
      const ri = lodash.findIndex(options, (option) => lodash.isEqual(option.value, rhs));
      return li - ri;
    });

    uiState.model.partitioningAxes = partitioningAxes;
  }
});
const partitioningDisabled = computed(() => !column.selected && !partitioningEvaluating.value);
const partitioning = reactive({
  label: 'Axes for partitioning',
  placeholder: partitioningPlaceholder,
  options: partitioningOptions,
  selected: partitioningSelected,
  disabled: partitioningDisabled
});

const tableState = computed({
  get: () => uiState.model.tableState,
  set: (tableState) => {
    if (!lodash.isEqual(tableState, uiState.model.tableState)) {
      uiState.model.tableState = tableState;
    }
  }
});
const tableSettings = computed(
  () =>
    ({
      sourceType: 'ptable',
      pTable: app.outputs.pTable,
      sheets: partitioningSelected.value
    }) satisfies PlDataTableSettings
);
</script>

<template>
  <div class="box">
    <Transition name="alert-transition">
      <PlAlert :modelValue="!pFrame" type="warn" :icon="true" label="Columns not loaded">
        Outputs of upstream blocks are either not ready or contain malformed columns
      </PlAlert>
    </Transition>
    <div class="container">
      <div class="table-container">
        <PlAgDataTable v-model="tableState" :settings="tableSettings" />
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
                <PlDropdownMulti
                  :label="partitioning.label"
                  :placeholder="partitioning.placeholder"
                  :options="partitioning.options"
                  v-model="partitioning.selected"
                  clearable
                  :disabled="partitioning.disabled"
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

<style lang="css" scoped>
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
.table-container {
  flex: 1;
  position: relative;
}
.overlay {
  position: absolute;
  z-index: 2;
  top: 68px;
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
