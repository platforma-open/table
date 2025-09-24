<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue';
import { computedAsync } from '@vueuse/core';
import { useApp } from '../app';
import {
  getAxesId,
  getRawPlatformaInstance,
  type PColumnIdAndSpec,
} from '@platforma-sdk/model';
import {
  PlAgDataTableV2,
  PlAlert,
  PlBlockPage,
  PlBtnGhost,
  PlDropdown,
  PlDropdownMulti,
  PlMaskIcon24,
  PlSlideModal,
  usePlDataTableSettingsV2,
} from '@platforma-sdk/ui-vue';
import { deepClone, isJsonEqual } from '@milaboratories/helpers';

const app = useApp();

/** UI state upgrader */ (() => {
  if ('filtersOpen' in app.model.ui) delete app.model.ui.filtersOpen;
  if ('filterModel' in app.model.ui) delete app.model.ui.filterModel;
  if ('tableState' in app.model.ui) delete app.model.ui.tableState;
  if ('settingsOpened' in app.model.ui) delete app.model.ui.settingsOpened;
})();

const pfDriver = getRawPlatformaInstance().pFrameDriver;
const pFrame = computed(() => app.model.outputs.pFrame);

const settingsOpened = ref(true);

const columnOptionsEvaluating = ref(false);
const columnPlaceholder = computed(() =>
  columnOptionsEvaluating.value ? 'Loading columns...' : 'Select the main column',
);
const columnOptions = computedAsync(
  async () => {
    if (!pFrame.value) return [];
    const columns = await pfDriver.listColumns(pFrame.value);
    return columns
      .filter(
        (idAndSpec) =>
          !(idAndSpec.spec.axesSpec.length === 1 && idAndSpec.spec.name === 'pl7.app/label'),
      )
      .map((idAndSpec, i) => ({
        text:
          idAndSpec.spec.annotations?.['pl7.app/label']?.trim()
          ?? 'Unlabelled column ' + i.toString(),
        value: idAndSpec,
      }))
      .sort((lhs, rhs) => lhs.text.localeCompare(rhs.text));
  },
  [],
  columnOptionsEvaluating,
);
const columnSelected = ref<PColumnIdAndSpec>();
const column = reactive({
  label: 'Main column',
  placeholder: columnPlaceholder,
  options: columnOptions,
  selected: columnSelected,
  disabled: columnOptionsEvaluating,
});

const additionalPlaceholder = computed(() =>
  !column.selected ? 'First, select the main column' : 'Select additional columns',
);
const additionalOptions = computed(() => {
  return columnOptions.value.filter(
    (option) =>
      !isJsonEqual(option.value.columnId, column.selected?.columnId)
      && isJsonEqual(option.value.spec.axesSpec, column.selected?.spec.axesSpec),
  );
});
const additionalSelected = ref<PColumnIdAndSpec[]>([]);
const additionalDisabled = computed(() => !column.selected);
const additional = reactive({
  label: 'Additional columns',
  placeholder: additionalPlaceholder,
  options: additionalOptions,
  selected: additionalSelected,
  disabled: additionalDisabled,
});

const enrichmentEvaluating = ref(false);
const enrichmentPlaceholder = computed(() =>
  !column.selected
    ? 'First, select the main column'
    : enrichmentEvaluating.value
      ? 'Loading columns...'
      : 'Select enrichment columns',
);
const enrichmentOptions = computedAsync(
  async () => {
    if (!pFrame.value || !column.selected) return [];
    const response = await pfDriver.findColumns(pFrame.value, {
      columnFilter: {},
      compatibleWith: getAxesId(column.selected.spec.axesSpec).map(deepClone),
      strictlyCompatible: true,
    });
    return response.hits
      .filter(
        (idAndSpec) =>
          !(idAndSpec.spec.axesSpec.length === 1 && idAndSpec.spec.name === 'pl7.app/label')
          && !isJsonEqual(idAndSpec.columnId, column.selected?.columnId)
          && additional.options.findIndex((option) =>
            isJsonEqual(option.value.columnId, idAndSpec.columnId),
          ) === -1,
      )
      .map((idAndSpec, i) => ({
        text:
          idAndSpec.spec.annotations?.['pl7.app/label']?.trim()
          ?? 'Unlabelled column ' + i.toString(),
        value: idAndSpec,
      }))
      .sort((lhs, rhs) => lhs.text.localeCompare(rhs.text));
  },
  [],
  enrichmentEvaluating,
);
const enrichmentSelected = ref<PColumnIdAndSpec[]>([]);
const enrichmentDisabled = computed(() => !column.selected && !enrichmentEvaluating.value);
const enrichment = reactive({
  label: 'Enrichment columns',
  placeholder: enrichmentPlaceholder,
  options: enrichmentOptions,
  selected: enrichmentSelected,
  disabled: enrichmentDisabled,
});

watch(
  () => app.model.ui.group,
  (group) => {
    const state = [group.mainColumn, group.additionalColumns, group.enrichmentColumns] as const;
    const prevState = [
      columnSelected.value,
      additionalSelected.value,
      enrichmentSelected.value,
    ] as const;
    if (isJsonEqual(state, prevState)) return;

    columnSelected.value = group.mainColumn;
    additionalSelected.value = group.additionalColumns;
    enrichmentSelected.value = group.enrichmentColumns;
  },
  { immediate: true },
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
      enrichmentSelected.value,
    ] as const,
  async (state, prevState) => {
    if (isJsonEqual(state, prevState)) return;

    const [
      pFrame,
      column,
      additionalOptions,
      additional,
      enrichmentEvaluating,
      enrichmentOptions,
      enrichment,
    ] = state;
    const [_, prevColumn] = prevState;

    if (!isJsonEqual(column, prevColumn)) {
      app.model.ui.group = {
        mainColumn: column,
        additionalColumns: [],
        enrichmentColumns: [],
      };
      return;
    }

    if (!pFrame || !column || enrichmentEvaluating) return;

    (() => {
      const options = additionalOptions;
      additional.sort((lhs, rhs) => {
        const li = options.findIndex((option) => isJsonEqual(option.value, lhs));
        const ri = options.findIndex((option) => isJsonEqual(option.value, rhs));
        return li - ri;
      });
    })();

    (() => {
      const options = enrichmentOptions;
      enrichment.sort((lhs, rhs) => {
        const li = options.findIndex((option) => isJsonEqual(option.value, lhs));
        const ri = options.findIndex((option) => isJsonEqual(option.value, rhs));
        return li - ri;
      });
    })();

    const group = {
      mainColumn: column,
      additionalColumns: additional,
      enrichmentColumns: enrichment,
    };
    if (!isJsonEqual(group, app.model.ui.group)) {
      app.model.ui.group = group;
    }
  },
);

const tableSettings = usePlDataTableSettingsV2({
  sourceId: () => columnSelected.value ? columnSelected.value.columnId : undefined,
  sheets: () => app.model.outputs.sheets,
  model: () => app.model.outputs.pTable,
});
</script>

<template>
  <PlBlockPage>
    <template #title>Table</template>
    <template #append>
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
    <PlAgDataTableV2
      v-model="app.model.ui.tableStateV2"
      :settings="tableSettings"
      show-export-button
    />
  </PlBlockPage>
  <PlSlideModal v-model="settingsOpened" :close-on-outside-click="true">
    <template #title>Settings</template>
    <PlDropdown
      v-model="column.selected"
      :label="column.label"
      :placeholder="column.placeholder"
      :options="column.options"
      clearable
      :disabled="column.disabled"
    />
    <PlDropdownMulti
      v-model="additional.selected"
      :label="additional.label"
      :placeholder="additional.placeholder"
      :options="additional.options"
      clearable
      :disabled="additional.disabled"
    />
    <PlDropdownMulti
      v-model="enrichment.selected"
      :label="enrichment.label"
      :placeholder="enrichment.placeholder"
      :options="enrichment.options"
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
