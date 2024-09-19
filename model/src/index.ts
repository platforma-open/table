import {
  BlockModel,
  type InferOutputsType,
  type InferHrefType,
  isPColumn,
  type PColumnIdAndSpec
} from '@milaboratory/sdk-ui';
import { type ColumnOrderState, type SortState } from '@ag-grid-community/core';

export type BlockArgs = {};

export type UiState = {
  settingsOpened: boolean;
  mainColumn?: PColumnIdAndSpec;
  additionalColumns: PColumnIdAndSpec[];
  enrichmentColumns: PColumnIdAndSpec[];
  gridState: {
    columnOrder?: ColumnOrderState;
    sort?: SortState;
  };
};

export const model = BlockModel.create<BlockArgs, UiState>('Heavy')
  .initialArgs({})
  .sections([{ type: 'link', href: '/', label: 'View' }])
  .output('pFrame', (ctx) => {
    const collection = ctx.resultPool.getDataFromResultPool();
    if (collection === undefined || !collection.isComplete) return undefined;

    const pColumns = collection.entries
      .map(({ obj }) => obj)
      .filter(isPColumn)
      .filter((column) => {
        const resourceType = column.data.resourceType;
        if (resourceType.version !== '1') return false;
        if (
          resourceType.name === 'PColumnData/Json' ||
          resourceType.name === 'PColumnData/JsonPartitioned' ||
          resourceType.name === 'PColumnData/BinaryPartitioned' ||
          resourceType.name === 'PColumnData/Partitioned/JsonPartitioned' ||
          resourceType.name === 'PColumnData/Partitioned/BinaryPartitioned'
        )
          return true;
        return false;
      });
    return ctx.createPFrame(pColumns);
  })
  .done();

export type BlockOutputs = InferOutputsType<typeof model>;

export type NavigationHref = InferHrefType<typeof model>;
