<script setup lang="ts">
import { computed, ref, reactive, Transition, watch } from 'vue';
import { useApp } from '../app';
import { model } from '@milaboratory/milaboratories.table.model';
import './ag-theme.css';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { ColDef, ModuleRegistry } from '@ag-grid-community/core';
import { AgGridVue } from '@ag-grid-community/vue3';
import { PlBtnSecondary, PlDropdown, PlDropdownMulti } from '@milaboratory/platforma-uikit';

const app = useApp();
const uiState = app.createUiModel(undefined, () => ({
  settingsOpened: true,
  settings: {}
}));

const pfDriver = model.pFrameDriver;
const frameRef = computed(() => app.getOutputFieldOkOptional('pFrame'));

ModuleRegistry.registerModules([ClientSideRowModelModule]);

type AgTableData = {
  colDefs: ColDef[];
  rowData: any[];
};

const agData = ref<AgTableData>();

const panel = reactive({
  opened: uiState.model.settingsOpened,
  toggle() {
    uiState.model.settingsOpened = !this.opened;
    uiState.save();
  },
  reset(opened: boolean) {
    this.opened = opened;
  }
});

watch(
  () => uiState.model.settingsOpened,
  (opened) => {
    panel.reset(opened);
  },
  { immediate: true }
);

const column = reactive({
  label: 'Main column',
  placeholder: 'Select main column',
  options: [
    { text: 'Item text 1', value: 1 },
    { text: 'Item text 2', value: 2 },
    { text: 'Item text 3', value: 3 },
    { text: 'Item text 4', value: 4 }
  ],
  selected: undefined
});

const enrichment = reactive({
  label: 'Enrichment columns',
  placeholder: 'Select enrichment columns',
  options: [
    { text: 'Item text 1', value: 1 },
    { text: 'Item text 2', value: 2 },
    { text: 'Item text 3', value: 3 },
    { text: 'Item text 4', value: 4 }
  ],
  selected: ref([])
});
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
          <div class="settings-panel" v-if="panel.opened">
            <div class="text-subtitle-s settings-header">Select columns to view</div>
            <form class="settings-form">
              <PlDropdown
                :label="column.label"
                :placeholder="column.placeholder"
                :options="column.options"
                v-model="column.selected"
                clearable
              />
              <PlDropdownMulti
                :label="enrichment.label"
                :placeholder="enrichment.placeholder"
                :options="enrichment.options"
                v-model="enrichment.selected"
                clearable
                :disabled="!column.selected"
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
      :style="{ background: panel.opened ? 'var(--btn-active-select)' : 'transparent' }"
      @click="panel.toggle()"
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
  inset: -100% 0 0 0;
  display: flex;
  flex-direction: row-reverse;
  width: 100%;
  /* height: 100%; */
}
.settings-button {
  gap: 0;
  z-index: 3;
}
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(80px);
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
  box-shadow: 0 6px 24px -2px rgba(15, 36, 77, 0.08), 0px 4px 12px -2px rgba(15, 36, 77, 0.08);
}
.settings-header {
  padding: 12px;
  border-bottom: 1px solid var(--border-color-default);
  background-color: var(--bg-elevated-02);
  border-radius: 8px 8px 0 0;
}
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin: 6px 12px 18px;
}
</style>
