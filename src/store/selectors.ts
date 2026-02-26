import type { TableRow } from "../types";
import type { TableState } from "./state";

export const canUseFilterAndUnlockedPagination = (state: TableState): boolean =>
  state.phase === "ready" || state.phase === "ready_with_failures";

export const maxContiguousLoadedPage = (state: TableState): number => {
  let page = 1;

  while (page <= state.totalPages && state.pageStatus[page] === "loaded") {
    page += 1;
  }

  return page - 1;
};

export const isPageEnabled = (state: TableState, page: number): boolean => {
  const status = state.pageStatus[page];
  return status === "loaded" || status === "failed_final";
};

export const filteredRowsForPage = (state: TableState): TableRow[] => {
  const rows = state.rowsByPage[state.currentPage] ?? [];
  const query = state.filterQuery.trim().toLowerCase();

  if (!canUseFilterAndUnlockedPagination(state) || query.length === 0) {
    return rows;
  }

  return rows.filter((row) =>
    Object.values(row).some((value) => String(value).toLowerCase().includes(query))
  );
};
