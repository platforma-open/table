import {
  BlockModel,
  type InferOutputsType,
  type InferHrefType,
  PColumn,
  TreeNodeAccessor,
  isPColumn
} from '@milaboratory/sdk-ui';

export type BlockArgs = {};

export type UiState = {
  settingsOpened: boolean;
  settings: unknown;
};

export const model = BlockModel.create<BlockArgs, UiState>('Heavy')
  .initialArgs({})
  .sections([
    {
      type: 'link',
      href: '/',
      label: 'View'
    }
  ])
  .output('pFrame', (render) => {
    const collection = render.resultPool.getDataFromResultPool();
    if (collection === undefined || !collection.isComplete) return undefined;

    const pColumns = collection.entries.map(({ obj }) => obj).filter(isPColumn);
    return render.createPFrame(pColumns as PColumn<TreeNodeAccessor>[]);
  })
  .done();

export type BlockOutputs = InferOutputsType<typeof model>;

export type NavigationHref = InferHrefType<typeof model>;
