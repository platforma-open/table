<script setup lang="ts">
import { model } from '@milaboratory/milaboratories.table.model';
import { PlTextArea } from '@milaboratory/platforma-uikit';
import { useWatchResult } from '@milaboratory/sdk-vue';
import { useApp } from '../app';

const app = useApp();

const data = useWatchResult(
  () => app.outputs.data,
  async (data) => {
    if (data?.ok) {
      return new TextDecoder().decode(await model.blobDriver.getContent(data.value?.handle!));
    } else {
      return 'Loading';
    }
  }
);
</script>

<template>
  <div class="container">
    <PlTextArea v-if="data.value" :model-value="data.value" :readonly="true" :rows="40" />
  </div>
</template>

<style lang="css">
.container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}
</style>
