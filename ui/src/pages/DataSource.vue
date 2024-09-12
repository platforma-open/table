<script setup lang="ts">
import { PlBtnGroup, PlBtnPrimary, PlTextArea } from '@milaboratory/platforma-uikit';
import { FileInput } from '@milaboratory/sdk-vue';
import { reactive } from 'vue';
import { useApp } from '../app';

const app = useApp();
const args = app.createArgsModel();

type LocalState = {
  tab: 'fromFile' | 'fromText';
};
const localState = reactive<LocalState>({
  tab: args.model.fastaFile ? 'fromFile' : 'fromText'
});

const inputOptions = [
  { text: 'Paste text', value: 'fromText' },
  { text: 'From file', value: 'fromFile' }
];

const demoFasta =
  '>seq1\n' +
  'GGCCCTTGGTGGAGGCTGAGGAGACGGTGACCAGGGTTCCCTGGCCCCAGTAGTCAAAGGGGTGACTCCCTGAAACAAAGTATTTCGGCGTCGCGCAGTAATACACGGCCGTGTCTTCAGATCTCAGGCTGCTCAGTTCCATGTAGGCTGTGTCTGTAGATGTGTCCTCGGTCATGGTGACTCTGCCCTGGAAGTTCTTTGCGTAGATTGTGTCAGCATCTTCAGGATCAAAACCTCCCATCCACTCAAGCCCTTTTCCTGGAGCCTGTCGCACCCAGTGCATGGATAATTGAGT';

function setDemoData() {
  args.model.fastaData = demoFasta;
}
</script>

<template>
  <div class="container">
    <PlBtnGroup v-model="localState.tab" :options="inputOptions" />
    <div v-if="localState.tab === 'fromText'">
      <PlTextArea v-model="args.model.fastaData" :rows="10" :placeholder="demoFasta" label="FASTA" />
      <br />
      <PlBtnPrimary @click="setDemoData">Demo data</PlBtnPrimary>
    </div>
    <div v-if="localState.tab === 'fromFile'">
      <FileInput
        v-model="args.model.fastaFile"
        placeholder="Drag .fasta file"
        file-dialog-title="Select fasta file"
        clearable
      />
    </div>
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
