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
  type AxisId,
  AxisSpec
} from '@platforma-sdk/model';
import * as lodash from 'lodash';

export type BlockArgs = {};

export type UiState = {
  settingsOpened: boolean;
  group: {
    mainColumn?: PColumnIdAndSpec;
    additionalColumns: PColumnIdAndSpec[];
    enrichmentColumns: PColumnIdAndSpec[];
    possiblePartitioningAxes: AxisSpec[];
    join?: JoinEntry<PColumnIdAndSpec>;
  };
  partitioningAxes: AxisId[];
  tableState: PlDataTableState;
};

export const model = BlockModel.create<BlockArgs, UiState>('Heavy')
  .initialArgs({})
  .sections([{ type: 'link', href: '/', label: 'View' }])
  .output('pColumns', (ctx) => {
    const collection = ctx.resultPool.getData();
    if (collection === undefined || !collection.isComplete) return undefined;

    const valueTypes = ['Int', 'Long', 'Float', 'Double', 'String', 'Bytes'] as ValueType[];
    const columns = collection.entries
      .map(({ obj }) => obj)
      .filter(isPColumn)
      .filter((column) => valueTypes.find((valueType) => valueType === column.spec.valueType));

    return columns;
  })
  .output('pFrame', (ctx) => {
    const collection = ctx.resultPool.getData();
    if (collection === undefined || !collection.isComplete) return undefined;

    const valueTypes = ['Int', 'Long', 'Float', 'Double', 'String', 'Bytes'] as ValueType[];
    const columns = collection.entries
      .map(({ obj }) => obj)
      .filter(isPColumn)
      .filter((column) => valueTypes.find((valueType) => valueType === column.spec.valueType));

    try {
      return ctx.createPFrame(columns);
    } catch (err) {
      return undefined;
    }
  })
  .output('pTable', (ctx) => {
    const join = ctx.uiState?.tableState.pTableParams?.join;
    if (!join) return undefined;

    const collection = ctx.resultPool.getData();
    if (!collection || !collection.isComplete) return undefined;

    const columns = collection.entries.map(({ obj }) => obj).filter(isPColumn);
    if (columns.length === 0) return undefined;

    try {
      return ctx.createPTable({
        src: mapJoinEntry(join, (idAndSpec) => {
          const column = lodash.find(columns, (column) => column.id === idAndSpec.columnId);
          if (!column) throw Error(`column '${column}' not ready`);
          return column;
        }),
        filters: ctx.uiState.tableState.pTableParams?.filters ?? [],
        sorting: ctx.uiState.tableState.pTableParams?.sorting ?? []
      });
    } catch (err) {
      return undefined;
    }
  })
  .done();

export type BlockOutputs = InferOutputsType<typeof model>;

export type NavigationHref = InferHrefType<typeof model>;
