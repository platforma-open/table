import {
  BlockModelV3,
  collectCtxColumnSnapshotProviders,
  ColumnCollectionBuilder,
  createPlDataTableSheet,
  createPlDataTableV3,
  ensureError,
  getUniquePartitionKeys,
  isPColumn,
  type InferOutputsType,
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
      .filter(isPColumn)
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

    const columns = collection.entries.map(({ obj }) => obj).filter(isPColumn);
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
      .filter(isPColumn)
      .find((it) => it.id === mainColumn.columnId);
    if (!column) return undefined;

    const r = getUniquePartitionKeys(column.data);
    if (!r) return undefined;

    return r.map((values, i) => createPlDataTableSheet(ctx, column.spec.axesSpec[i], values));
  })
  .outputWithStatus("pTable", (ctx) => {
    const mainColumn = ctx.data.group.mainColumn;
    if (!mainColumn) return undefined;

    // Snapshots (with real data status) for every result-pool column, via the
    // canonical collection builder — no hand-rolled ColumnSnapshots.
    const collection = new ColumnCollectionBuilder(ctx.getService("pframeSpec"))
      .addSources(collectCtxColumnSnapshotProviders(ctx))
      .build();
    if (!collection) return undefined;
    const snapshots = collection.findColumns();
    collection.dispose();

    const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));

    const primaryIds = [mainColumn, ...ctx.data.group.additionalColumns];
    const primaryColumns = primaryIds
      .map((idAndSpec) => byId.get(idAndSpec.columnId))
      .filter((snapshot) => snapshot !== undefined);
    if (primaryColumns.length < primaryIds.length) return undefined;

    const secondaryColumns = ctx.data.group.enrichmentColumns
      .map((idAndSpec) => byId.get(idAndSpec.columnId))
      .filter((snapshot) => snapshot !== undefined);
    if (secondaryColumns.length < ctx.data.group.enrichmentColumns.length) return undefined;

    return createPlDataTableV3(ctx, {
      columns: [
        ...primaryColumns.map((column) => ({ column, isPrimary: true })),
        ...secondaryColumns.map((column) => ({ column, isPrimary: false })),
      ],
      tableState: ctx.data.tableStateV2,
    });
  })
  .sections(() => [{ type: "link" as const, href: "/" as const, label: "View" }])
  .done();

export type Platforma = typeof platforma;
export type BlockOutputs = InferOutputsType<typeof platforma>;
