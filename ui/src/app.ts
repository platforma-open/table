import { model } from '@platforma-open/milaboratories.table.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import TableView from './pages/TableView.vue';

export const sdkPlugin = defineApp(model, () => {
  return {
    routes: {
      '/': () => TableView,
    },
  };
});

export const useApp = sdkPlugin.useApp;
