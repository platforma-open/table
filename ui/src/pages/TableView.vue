<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue';
import { computedAsync } from '@vueuse/core';
import { useApp } from '../app';
import {
  getAxesId,
  getRawPlatformaInstance,
  type PColumnIdAndSpec,
  PTableColumnSpec
} from '@platforma-sdk/model';
import * as lodash from 'lodash';
import {
  PlBlockPage,
  PlBtnGhost,
  PlSlideModal,
  PlAgDataTable,
  PlTableFilters,
  PlAgDataTableToolsPanel,
  type PlDataTableSettings,
  type PlAgDataTableController,
  PlAlert,
  PlDropdown,
  PlDropdownMulti,
  PlMaskIcon24
} from '@platforma-sdk/ui-vue';

const app = useApp();

/** UI state upgrader */ (() => {
  if ('filtersOpen' in app.model.ui) delete app.model.ui.filtersOpen;
  if (app.model.ui.filterModel === undefined) app.model.ui.filterModel = {};
})();

const pfDriver = getRawPlatformaInstance().pFrameDriver;
const pFrame = computed(() => app.model.outputs.pFrame);

const settingsOpened = computed({
  get: () => app.model.ui.settingsOpened,
  set: (opened) => {
    app.model.ui.settingsOpened = opened;
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
  () => app.model.ui.group,
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
      app.model.ui.group = {
        mainColumn: column,
        additionalColumns: [],
        enrichmentColumns: []
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

    app.model.ui.group = {
      mainColumn: column,
      additionalColumns: additional,
      enrichmentColumns: enrichment
    };
  }
);

const tableState = computed({
  get: () => app.model.ui.tableState,
  set: (tableState) => {
    if (!lodash.isEqual(tableState, app.model.ui.tableState)) {
      app.model.ui.tableState = tableState;
    }
  }
});
const tableSettings = computed<PlDataTableSettings | undefined>(() =>
  app.model.ui.group.mainColumn
    ? {
        sourceType: 'ptable',
        pTable: app.model.outputs.pTable,
        sheets: app.model.outputs.sheets
      }
    : undefined
);
const columns = ref<PTableColumnSpec[]>([]);
const tableInstance = ref<PlAgDataTableController>();
</script>

<template>
  <PlBlockPage>
    <template #title>Table</template>
    <template #append>
      <PlAgDataTableToolsPanel>
        <PlTableFilters v-model="app.model.ui.filterModel" :columns="columns" />
      </PlAgDataTableToolsPanel>
      <PlBtnGhost @click.stop="() => tableInstance?.exportCsv()">
        Export
        <template #append>
          <PlMaskIcon24 name="export" />
        </template>
      </PlBtnGhost>
      <PlBtnGhost @click.stop="() => (settingsOpened = true)">
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
      <PlAgDataTable
        v-model="tableState"
        :settings="tableSettings"
        show-columns-panel
        @columns-changed="(newColumns) => (columns = newColumns)"
        ref="tableInstance"
      />
    </div>
  </PlBlockPage>
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
