import { model } from '@milaboratory/milaboratories.table.model';
import { defineApp } from '@milaboratory/sdk-vue';
import TableView from './pages/TableView.vue';

export const sdkPlugin = defineApp(model, () => {
  return {
    routes: {
      '/': TableView
    }
  };
});

export const useApp = sdkPlugin.useApp;
