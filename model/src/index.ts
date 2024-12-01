import {
  BlockModel,
  type InferOutputsType,
  type InferHrefType,
  isPColumn,
  type PColumnIdAndSpec,
  type PlDataTableState,
  type PlTableFiltersModel,
  type ValueType,
  type JoinEntry,
  mapJoinEntry,
  type AxisId,
  AxisSpec,
} from '@platforma-sdk/model';

export type BlockArgs = {};

export type UiState = {
  settingsOpened: boolean;
  filterModel: PlTableFiltersModel;
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

export const model = BlockModel.create('Heavy')
  .withArgs({})
  .withUiState<UiState>({
    settingsOpened: true,
    filterModel: {},
    group: {
      mainColumn: undefined,
      additionalColumns: [],
      enrichmentColumns: [],
      possiblePartitioningAxes: []
    },
    partitioningAxes: [],
    tableState: {
      gridState: {},
      pTableParams: {
        sorting: [],
        filters: []
      }
    }
  })
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
      // Remove this filter in 2025
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

    let columnMissing = false;
    const src = mapJoinEntry(join, (idAndSpec) => {
      const column = columns.find((it) => it.id === idAndSpec.columnId);
      if (!column) columnMissing = true;
      return column!;
    });
    if (columnMissing) return undefined;

    return ctx.createPTable({
      src,
      filters: [
        ...(ctx.uiState.tableState.pTableParams?.filters ?? []),
        ...(ctx.uiState.filterModel?.filters ?? [])
      ],
      sorting: ctx.uiState.tableState.pTableParams?.sorting ?? []
    });
  
  })
  .done();

export type BlockOutputs = InferOutputsType<typeof model>;

export type NavigationHref = InferHrefType<typeof model>;
