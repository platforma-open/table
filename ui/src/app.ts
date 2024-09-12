import { model } from '@milaboratory/milaboratories.table.model';
import { defineApp } from '@milaboratory/sdk-vue';
import DataSource from './pages/DataSource.vue';
import AlignmentsPretty from './pages/AlignmentsPretty.vue';

export const sdkPlugin = defineApp(model, () => {
  return {
    routes: {
      '/': DataSource,
      '/alignmentsPretty': AlignmentsPretty
    }
  };
});

export const useApp = sdkPlugin.useApp;
