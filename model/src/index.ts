import {
  BlockModel,
  createPlDataTableSheet,
  createPlDataTableStateV2,
  createPlDataTableV2,
  ensureError,
  getUniquePartitionKeys,
  isPColumn,
  type InferOutputsType,
  type PColumnIdAndSpec,
  type PlDataTableStateV2,
} from '@platforma-sdk/model';

export type BlockArgs = Record<string, never>;

export type UiState = {
  group: {
    mainColumn?: PColumnIdAndSpec;
    additionalColumns: PColumnIdAndSpec[];
    enrichmentColumns: PColumnIdAndSpec[];
  };
  tableStateV2: PlDataTableStateV2;
};

export const model = BlockModel.create()
  .withArgs<BlockArgs>({})
  .withUiState<UiState>({
    group: {
      mainColumn: undefined,
      additionalColumns: [],
      enrichmentColumns: [],
    },
    tableStateV2: createPlDataTableStateV2(),
  })
  .sections((_ctx) => [{ type: 'link', href: '/', label: 'View' }])
  .output('pColumns', (ctx) => {
    const columns = ctx.resultPool.getData().entries
      .map(({ obj }) => obj)
      .filter(isPColumn)
      .map((column) => ({
        id: column.id,
        spec: column.spec,
        resourceType: column.data.resourceType,
        dataInfo: column.data.getDataAsJson(),
      }));
    return columns;
  })
  .output('pFrame', (ctx) => {
    const collection = ctx.resultPool.getData();
    if (!collection.isComplete) return undefined;

    const columns = collection.entries
      .map(({ obj }) => obj)
      .filter(isPColumn);
    try {
      return ctx.createPFrame(columns);
    } catch (err: unknown) {
      ctx.logError(`Failed to create PFrame: ${ensureError(err)}`);
      return undefined;
    }
  })
  .output('sheets', (ctx) => {
    const mainColumn = ctx.uiState?.group.mainColumn;
    if (!mainColumn) return undefined;

    const column = ctx.resultPool.getData().entries
      .map(({ obj }) => obj)
      .filter(isPColumn)
      .find((it) => it.id === mainColumn.columnId);
    if (!column) return undefined;

    const r = getUniquePartitionKeys(column.data);
    if (!r) return undefined;

    return r.map((values, i) => createPlDataTableSheet(ctx, column.spec.axesSpec[i], values));
  })
  .output('pTable', (ctx) => {
    const mainColumn = ctx.uiState?.group.mainColumn;
    if (!mainColumn) return undefined;

    const columns = ctx.resultPool.getData().entries
      .map(({ obj }) => obj)
      .filter(isPColumn);

    const primaryColumns = [mainColumn, ...ctx.uiState.group.additionalColumns]
      .map((idAndSpec) => columns.find((column) => column.id === idAndSpec.columnId))
      .filter((column) => column !== undefined);
    if (primaryColumns.length < ctx.uiState.group.additionalColumns.length + 1) return undefined;

    const secondaryColumns = ctx.uiState.group.enrichmentColumns
      .map((idAndSpec) => columns.find((column) => column.id === idAndSpec.columnId))
      .filter((column) => column !== undefined);
    if (secondaryColumns.length < ctx.uiState.group.enrichmentColumns.length) return undefined;

    return createPlDataTableV2(
      ctx,
      [...primaryColumns, ...secondaryColumns],
      ctx.uiState.tableStateV2,
      {
        coreColumnPredicate: ({ columnId }) => primaryColumns.some((column) => column.id === columnId),
        doNotSkipTechnicalColumns: true,
      },
    );
  })
  .done(2);

export type BlockOutputs = InferOutputsType<typeof model>;
