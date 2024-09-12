import { BlockModel, ImportFileHandle, InferOutputsType, Option, Ref } from '@milaboratory/sdk-ui';

export type BlockArgs = {
  fastaData?: string;
  fastaFile?: ImportFileHandle;
};

export const model = BlockModel.create<BlockArgs>('Heavy')
  .initialArgs({})
  .output('data', (wf) => wf.outputs?.resolve('data')?.getRemoteFileHandle())
  .sections([
    { type: 'link', href: '/', label: 'Data source' },
    { type: 'link', href: '/alignmentsPretty', label: 'Alignments pretty' }
  ])
  .done();

export type BlockOutputs = InferOutputsType<typeof model>;
