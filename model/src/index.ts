import {
  BlockModel,
  type InferOutputsType,
  type InferHrefType,
  isPColumn,
  type PColumnIdAndSpec,
  type PlDataTableState,
  type PlTableFiltersModel,
  type ValueType,
  getUniquePartitionKeys,
  createPlDataTableSheet,
  PObjectId,
  getAxisId,
  matchAxisId,
  PColumn,
  TreeNodeAccessor,
  ColumnJoinEntry,
} from '@platforma-sdk/model';

export type BlockArgs = {};

export type UiState = {
  settingsOpened: boolean;
  filterModel: PlTableFiltersModel;
  group: {
    mainColumn?: PColumnIdAndSpec;
    additionalColumns: PColumnIdAndSpec[];
    enrichmentColumns: PColumnIdAndSpec[];
  };
  tableState: PlDataTableState;
};

export const model = BlockModel.create()
  .withArgs({})
  .withUiState<UiState>({
    settingsOpened: true,
    filterModel: {},
    group: {
      additionalColumns: [],
      enrichmentColumns: []
    },
    tableState: {
      gridState: {}
    }
  })
  .sections([{ type: 'link', href: '/', label: 'View' }])
  .output('pColumns', (ctx) => {
    const valueTypes = ['Int', 'Long', 'Float', 'Double', 'String', 'Bytes'] as ValueType[];
    const columns = ctx.resultPool.getData().entries
      .map(({ obj }) => obj)
      .filter(isPColumn)
      .filter((column) => valueTypes.find((valueType) => valueType === column.spec.valueType))
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

    const valueTypes = ['Int', 'Long', 'Float', 'Double', 'String', 'Bytes'] as ValueType[];
    const columns = collection.entries
      .map(({ obj }) => obj)
      .filter(isPColumn)
      // Remove this filter in 2025
      .filter((column) => valueTypes.find((valueType) => valueType === column.spec.valueType));

    try {
      return ctx.createPFrame(columns);
    } catch (err) {
      console.error(err);
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

    // wait until sheet filters are set
    const sheetFilters = ctx.uiState.tableState.pTableParams?.filters;
    if (!sheetFilters) return undefined;

    const columns = ctx.resultPool.getData().entries
      .map(({ obj }) => obj)
      .filter(isPColumn);

    const primaryColumns = [mainColumn, ...ctx.uiState.group.additionalColumns]
      .map((idAndSpec) => columns.find((column) => column.id === idAndSpec.columnId))
      .filter((column) => column !== undefined)
      .filter((column) => column.data.getIsReadyOrError());
    if (primaryColumns.length < ctx.uiState.group.additionalColumns.length + 1) return undefined;

    const secondaryColumns = ctx.uiState.group.enrichmentColumns
      .map((idAndSpec) => columns.find((column) => column.id === idAndSpec.columnId))
      .filter((column) => column !== undefined)
      .filter((column) => column.data.getIsReadyOrError());
    if (secondaryColumns.length < ctx.uiState.group.enrichmentColumns.length) return undefined;

    const allLabelCols = columns
      .filter((p) => p.spec.name === 'pl7.app/label' && p.spec.axesSpec.length === 1);
    labelLoop: for (const labelCol of allLabelCols) {
      const labelAxisId = getAxisId(labelCol.spec.axesSpec[0]);
      for (const col of [primaryColumns[0], ...secondaryColumns]) {
        for (const axis of col.spec.axesSpec) {
          if (matchAxisId(getAxisId(axis), labelAxisId)) {
            if (!labelCol.data.getIsReadyOrError()) return undefined;
            secondaryColumns.push(labelCol);
            continue labelLoop;
          }
        }
      }
    }

    const makeColumnJoinEntry = <Col>(column: Col): ColumnJoinEntry<Col> =>
      ({ type: 'column', column, });
    return ctx.createPTable({
      src: {
        type: 'outer',
        primary: { type: 'full', entries: primaryColumns.map(makeColumnJoinEntry) },
        secondary: secondaryColumns.map(makeColumnJoinEntry)
      },
      filters: [...sheetFilters, ...(ctx.uiState.filterModel?.filters ?? [])],
      sorting: ctx.uiState.tableState.pTableParams?.sorting ?? []
    });
  })
  .done();

export type BlockOutputs = InferOutputsType<typeof model>;

export type NavigationHref = InferHrefType<typeof model>;
