import { platforma } from "@platforma-open/milaboratories.table.model";
import { defineAppV3 } from "@platforma-sdk/ui-vue";
import TableView from "./pages/TableView.vue";

export const sdkPlugin = defineAppV3(platforma, () => {
  return {
    routes: {
      "/": () => TableView,
    },
  };
});

export const useApp = sdkPlugin.useApp;
