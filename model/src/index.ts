import {
  BlockModelV3,
  ColumnRecipe,
  createPlDataTableSheet,
  createPlDataTableV3,
  ensureError,
  getUniquePartitionKeys,
  isPColumn,
  type InferOutputsType,
  type PColumn,
  type PColumnIdAndSpec,
  type TreeNodeAccessor,
} from "@platforma-sdk/model";
import { blockDataModel } from "./dataModel";
import type { BlockArgs } from "./types";

export { blockDataModel } from "./dataModel";
export * from "./types";

export const platforma = BlockModelV3.create(blockDataModel)
  .args<BlockArgs>(() => ({}))
  .output("pColumns", (ctx) => {
    const columns = ctx.resultPool
      .getData()
      .entries.map(({ obj }) => obj)
      .filter((obj): obj is PColumn<TreeNodeAccessor> => isPColumn(obj))
      .map((column) => ({
        id: column.id,
        spec: column.spec,
        resourceType: column.data.resourceType,
        dataInfo: column.data.getDataAsJson(),
      }));
    return columns;
  })
  .output("pFrame", (ctx) => {
    const collection = ctx.resultPool.getData();
    if (!collection.isComplete) return undefined;

    const columns = collection.entries
      .map(({ obj }) => obj)
      .filter((obj): obj is PColumn<TreeNodeAccessor> => isPColumn(obj));
    try {
      return ctx.createPFrame(columns);
    } catch (err: unknown) {
      ctx.logError(`Failed to create PFrame: ${ensureError(err)}`);
      return undefined;
    }
  })
  .output("sheets", (ctx) => {
    const mainColumn = ctx.data.group.mainColumn;
    if (!mainColumn) return undefined;

    const column = ctx.resultPool
      .getData()
      .entries.map(({ obj }) => obj)
      .filter((obj): obj is PColumn<TreeNodeAccessor> => isPColumn(obj))
      .find((it) => it.id === mainColumn.columnId);
    if (!column) return undefined;

    const r = getUniquePartitionKeys(column.data);
    if (!r) return undefined;

    return r.map((values, i) => createPlDataTableSheet(ctx, column.spec.axesSpec[i], values));
  })
  .outputWithStatus("pTable", (ctx) => {
    const mainColumn = ctx.data.group.mainColumn;
    if (!mainColumn) return undefined;

    // Build column recipes straight from the stored PObjectIds. A recipe factory
    // returns undefined when the referenced column's spec is not resolvable in
    // the active render ctx (e.g. still absent from the pool), which gives us the
    // same "all selected columns must be present" gating the previous
    // snapshot-collection did before rendering the table.
    const toRecipe = (id: PColumnIdAndSpec) =>
      ColumnRecipe(id.columnId as Parameters<typeof ColumnRecipe>[0]);

    const primaryColumns = [mainColumn, ...ctx.data.group.additionalColumns].map(toRecipe);
    if (primaryColumns.some((recipe) => recipe === undefined)) return undefined;

    const secondaryColumns = ctx.data.group.enrichmentColumns.map(toRecipe);
    if (secondaryColumns.some((recipe) => recipe === undefined)) return undefined;

    return createPlDataTableV3(ctx, {
      primaryColumns: primaryColumns as ColumnRecipe[],
      columns: secondaryColumns as ColumnRecipe[],
      tableState: ctx.data.tableStateV2,
    });
  })
  .sections(() => [{ type: "link" as const, href: "/" as const, label: "View" }])
  .done();

export type Platforma = typeof platforma;
export type BlockOutputs = InferOutputsType<typeof platforma>;
