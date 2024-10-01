import {
  BlockModel,
  type InferOutputsType,
  type InferHrefType,
  isPColumn,
  type PColumnIdAndSpec,
  type PlDataTableState,
  type ValueType,
  type JoinEntry,
  mapJoinEntry,
  type AxisId
} from '@platforma-sdk/model';
import * as lodash from 'lodash';
import { type PlDataTableSheet } from '@platforma-sdk/ui-vue';

export type BlockArgs = {};

export type UiState = {
  settingsOpened: boolean;
  group: {
    mainColumn?: PColumnIdAndSpec;
    additionalColumns: PColumnIdAndSpec[];
    enrichmentColumns: PColumnIdAndSpec[];
    labelColumns: PColumnIdAndSpec[];
    possiblePartitioningAxes: AxisId[];
    join?: JoinEntry<PColumnIdAndSpec>;
  };
  partitioningAxes: PlDataTableSheet[];
  tableState: PlDataTableState;
};

export const model = BlockModel.create<BlockArgs, UiState>('Heavy')
  .initialArgs({})
  .sections([{ type: 'link', href: '/', label: 'View' }])
  .output('pColumns', (ctx) => {
    const collection = ctx.resultPool.getDataFromResultPool();
    if (collection === undefined || !collection.isComplete) return undefined;

    const valueTypes = ['Int', 'Long', 'Float', 'Double', 'String', 'Bytes'] as ValueType[];
    const pColumns = collection.entries
      .map(({ obj }) => obj)
      .filter(isPColumn)
      .filter((column) => valueTypes.find((valueType) => valueType === column.spec.valueType));
    return pColumns.map((column) => ({
      id: column.id,
      spec: column.spec,
      resourceType: column.data.resourceType,
      data: column.data.getDataAsJson()
    }));
  })
  .output('pFrame', (ctx) => {
    const collection = ctx.resultPool.getDataFromResultPool();
    if (collection === undefined || !collection.isComplete) return undefined;

    const valueTypes = ['Int', 'Long', 'Float', 'Double', 'String', 'Bytes'] as ValueType[];
    const pColumns = collection.entries
      .map(({ obj }) => obj)
      .filter(isPColumn)
      .filter((column) => valueTypes.find((valueType) => valueType === column.spec.valueType));
    return ctx.createPFrame(pColumns);
  })
  .output('pTable', (ctx) => {
    if (!ctx.uiState?.group.join) return undefined;

    const collection = ctx.resultPool.getDataFromResultPool();
    if (!collection || !collection.isComplete) return undefined;

    const columns = collection.entries.map(({ obj }) => obj).filter(isPColumn);

    try {
      return ctx.createPTable({
        src: mapJoinEntry(ctx.uiState!.group.join, (idAndSpec) => {
          const column = lodash.find(columns, (column) => column.id === idAndSpec.columnId);
          if (!column) throw Error(`column '${column}' not ready`);
          return column;
        }),
        filters: ctx.uiState.tableState.pTableParams?.filters ?? [],
        sorting: ctx.uiState.tableState.pTableParams?.sorting ?? []
      });
    } catch (err) {
      console.log(err);
      return undefined;
    }
  })
  .done();

export type BlockOutputs = InferOutputsType<typeof model>;

export type NavigationHref = InferHrefType<typeof model>;
