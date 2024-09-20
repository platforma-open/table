import {
  BlockModel,
  type InferOutputsType,
  type InferHrefType,
  isPColumn,
  type PColumnIdAndSpec,
  type PlDataTableState,
  type ValueType
} from '@milaboratory/sdk-ui';

export type BlockArgs = {};

export type UiState = {
  settingsOpened: boolean;
  mainColumn?: PColumnIdAndSpec;
  additionalColumns: PColumnIdAndSpec[];
  enrichmentColumns: PColumnIdAndSpec[];
  tableState: PlDataTableState;
};

export const model = BlockModel.create<BlockArgs, UiState>('Heavy')
  .initialArgs({})
  .sections([{ type: 'link', href: '/', label: 'View' }])
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
    if (!ctx.uiState?.mainColumn) return undefined;
    const primaryIds = [
      ctx.uiState!.mainColumn.columnId,
      ...ctx.uiState!.additionalColumns.map((idAndSpec) => idAndSpec.columnId)
    ];
    const secondaryIds = ctx.uiState!.enrichmentColumns.map((idAndSpec) => idAndSpec.columnId);

    const collection = ctx.resultPool.getDataFromResultPool();
    if (!collection || !collection.isComplete) return undefined;

    const primaryColumns = collection.entries
      .map(({ obj }) => obj)
      .filter(isPColumn)
      .filter((column) => !!primaryIds.find((id) => id === column.id));
    const secondaryColumns = collection.entries
      .map(({ obj }) => obj)
      .filter(isPColumn)
      .filter((column) => !!secondaryIds.find((id) => id === column.id));
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
