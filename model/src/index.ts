import {
  BlockModel,
  type InferOutputsType,
  type InferHrefType,
  isPColumn,
  type PColumnIdAndSpec,
  type PlDataTableState,
  type ValueType
} from '@milaboratory/sdk-ui';
import { type PlDataTableSheet } from '@milaboratory/sdk-vue';

export type BlockArgs = {};

export type UiState = {
  settingsOpened: boolean;
  group: {
    mainColumn?: PColumnIdAndSpec;
    additionalColumns: PColumnIdAndSpec[];
    enrichmentColumns: PColumnIdAndSpec[];
    labelColumns: PColumnIdAndSpec[];
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
    if (!ctx.uiState?.group.mainColumn) return undefined;
    const primaryIds = [
      ctx.uiState!.group.mainColumn.columnId,
      ...ctx.uiState!.group.additionalColumns.map((idAndSpec) => idAndSpec.columnId)
    ];
    const secondaryIds = [
      ...ctx.uiState!.group.enrichmentColumns.map((idAndSpec) => idAndSpec.columnId),
      ...ctx.uiState!.group.labelColumns.map((idAndSpec) => idAndSpec.columnId)
    ];

    const collection = ctx.resultPool.getDataFromResultPool();
    if (!collection || !collection.isComplete) return undefined;

    const primaryColumns = collection.entries
      .map(({ obj }) => obj)
      .filter(isPColumn)
      .filter((column) => !!primaryIds.find((id) => id === column.id));
    if (primaryColumns.length !== primaryIds.length) return undefined;

    const secondaryColumns = collection.entries
      .map(({ obj }) => obj)
      .filter(isPColumn)
      .filter((column) => !!secondaryIds.find((id) => id === column.id));
    if (secondaryColumns.length !== secondaryIds.length) return undefined;

    return ctx.createPTable({
      src: {
        type: 'outer',
        primary: {
          type: 'full',
          entries: primaryColumns.map(
            (column) =>
              ({
                type: 'column',
                column: column
              }) as const
          )
        },
        secondary: secondaryColumns.map((column) => ({
          type: 'column',
          column: column
        }))
      },
      filters: ctx.uiState.tableState.pTableParams?.filters ?? [],
      sorting: ctx.uiState.tableState.pTableParams?.sorting ?? []
    });
  })
  .done();

export type BlockOutputs = InferOutputsType<typeof model>;

export type NavigationHref = InferHrefType<typeof model>;
