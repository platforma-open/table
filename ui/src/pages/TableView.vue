<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue';
import { computedAsync } from '@vueuse/core';
import { useApp } from '../app';
import { model, UiState } from '@platforma-open/milaboratories.table.model';
import {
  getAxisId,
  getAxesId,
  type PColumnIdAndSpec,
  type JoinEntry,
  PTableColumnSpec
} from '@platforma-sdk/model';
import * as lodash from 'lodash';
import {
  PlBlockPage,
  PlBtnGhost,
  PlSlideModal,
  PlAgDataTable,
  PlTableFilters,
  type PlDataTableSettings,
  PlAlert,
  PlDropdown,
  PlDropdownMulti,
  PlMaskIcon24
} from '@platforma-sdk/ui-vue';

const app = useApp();
const uiState = app.createUiModel<UiState>(undefined, () => ({
  settingsOpened: true,
  filtersOpen: false,
  filterModel: {},
  group: {
    mainColumn: undefined,
    additionalColumns: [],
    enrichmentColumns: [],
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

(() => {
  if (app.model.ui.filtersOpen === undefined) app.model.ui.filtersOpen = false;
  if (app.model.ui.filterModel === undefined) app.model.ui.filterModel = {};
})();

const pfDriver = model.pFrameDriver;
const pFrame = computed(() => app.model.outputs.pFrame);

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

watch(
  () => uiState.model.group,
  (group) => {
    const state = [group.mainColumn, group.additionalColumns, group.enrichmentColumns] as const;
    const prevState = [
      columnSelected.value,
      additionalSelected.value,
      enrichmentSelected.value
    ] as const;
    if (lodash.isEqual(state, prevState)) return;

    columnSelected.value = group.mainColumn;
    additionalSelected.value = group.additionalColumns;
    enrichmentSelected.value = group.enrichmentColumns;
  },
  { immediate: true }
);

function makeJoin(
  mainColumn: PColumnIdAndSpec | undefined,
  additionalColumns: PColumnIdAndSpec[],
  enrichmentColumns: PColumnIdAndSpec[]
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
    secondary: enrichmentColumns.map((column) => ({
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
      const join = makeJoin(column, [], []);
      uiState.model.group = {
        mainColumn: column,
        additionalColumns: [],
        enrichmentColumns: [],
        possiblePartitioningAxes: (column?.spec.axesSpec ?? []).map(lodash.cloneDeep),
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

    const join = makeJoin(column, additional, enrichment);
    const possiblePartitioningAxes = column.spec.axesSpec.map(lodash.cloneDeep);

    uiState.model.group = {
      mainColumn: column,
      additionalColumns: additional,
      enrichmentColumns: enrichment,
      possiblePartitioningAxes,
      join
    };
  }
);

const partitioningPlaceholder = computed(() =>
  !column.selected ? 'First, select the main column' : 'Select axes for partitioning'
);
const partitioningOptions = computed(() => {
  return uiState.model.group.possiblePartitioningAxes.map((axis, i) => ({
    text: axis.annotations?.['pl7.app/label']?.trim() ?? 'Unlabelled axis ' + i.toString(),
    value: getAxisId(axis)
  }));
});
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
const partitioningDisabled = computed(() => !column.selected);
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
      sourceType: 'pframe',
      pFrame: app.model.outputs.pFrame,
      join: uiState.model.group.join,
      sheetAxes: uiState.model.partitioningAxes,
      pTable: app.model.outputs.pTable
    }) satisfies PlDataTableSettings
);
const columns = ref<PTableColumnSpec[]>([]);
</script>

<template>
  <PlBlockPage>
    <template #title>Table</template>
    <template #append>
      <PlBtnGhost @click.stop="() => uiState.model.filtersOpen = true">
        Filters
        <template #append>
          <PlMaskIcon24 :name="columns.length > 0 && (app.model.ui.filterModel.filters ?? []).length > 0 ? 'filter-on' : 'filter'"/>
        </template>
      </PlBtnGhost>
      <PlBtnGhost @click.stop="() => settingsOpened = true">
        Settings
        <template #append>
          <PlMaskIcon24 name="settings" />
        </template>
      </PlBtnGhost>
    </template>
    <Transition name="alert-transition">
      <PlAlert :modelValue="!pFrame" type="warn" :icon="true" label="Columns not loaded">
        Outputs of upstream blocks are either not ready or contain malformed columns
      </PlAlert>
    </Transition>
    <div style="flex: 1">
      <PlAgDataTable v-model="tableState" :settings="tableSettings" @columns-changed="(newColumns) => columns = newColumns" />
    </div>
  </PlBlockPage>
  <PlSlideModal v-model="uiState.model.filtersOpen" :close-on-outside-click="true">
    <template #title>Filters</template>
    <PlTableFilters v-model="uiState.model.filterModel" :columns="columns" />
  </PlSlideModal>
  <PlSlideModal v-model="settingsOpened" :close-on-outside-click="true">
    <template #title>Settings</template>
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
  </PlSlideModal>
</template>

<style lang="css" scoped>
.alert-transition-enter-active,
.alert-transition-leave-active {
  transition: all 0.2s ease-in-out;
}
.alert-transition-enter-from,
.alert-transition-leave-to {
  margin-top: -88px;
}
</style>
