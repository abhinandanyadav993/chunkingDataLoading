import type { PageStatus, Phase, TableRow } from "../types";
import { PAGE_SIZE } from "./constants";
import {
  APPLY_CHUNK,
  INITIALIZE_TABLE,
  LOAD_START,
  MARK_FINAL_FAILURES,
  SET_CURRENT_PAGE,
  SET_FATAL_ERROR,
  SET_FILTER_QUERY,
  SET_PHASE
} from "./actionTypes";

type PageRows = Record<number, TableRow[]>;

interface LoadStartAction {
  type: typeof LOAD_START;
}

interface InitializeTableAction {
  type: typeof INITIALIZE_TABLE;
}

interface ApplyChunkAction {
  type: typeof APPLY_CHUNK;
  payload: {
    totalRecord: number;
    pageRows: PageRows;
    failedOffsets: number[];
  };
}

interface SetPhaseAction {
  type: typeof SET_PHASE;
  payload: Phase;
}

interface MarkFinalFailuresAction {
  type: typeof MARK_FINAL_FAILURES;
  payload: number[];
}

interface SetCurrentPageAction {
  type: typeof SET_CURRENT_PAGE;
  payload: number;
}

interface SetFilterQueryAction {
  type: typeof SET_FILTER_QUERY;
  payload: string;
}

interface SetFatalErrorAction {
  type: typeof SET_FATAL_ERROR;
  payload: string;
}

export type TableAction =
  | LoadStartAction
  | InitializeTableAction
  | ApplyChunkAction
  | SetPhaseAction
  | MarkFinalFailuresAction
  | SetCurrentPageAction
  | SetFilterQueryAction
  | SetFatalErrorAction;

export const loadStart = (): LoadStartAction => ({
  type: LOAD_START
});

export const initializeTableData = (): InitializeTableAction => ({
  type: INITIALIZE_TABLE
});

export const applyChunk = (
  totalRecord: number,
  pageRows: PageRows,
  failedOffsets: number[]
): ApplyChunkAction => ({
  type: APPLY_CHUNK,
  payload: {
    totalRecord,
    pageRows,
    failedOffsets
  }
});

export const setPhase = (phase: Phase): SetPhaseAction => ({
  type: SET_PHASE,
  payload: phase
});

export const markFinalFailures = (failedPages: number[]): MarkFinalFailuresAction => ({
  type: MARK_FINAL_FAILURES,
  payload: failedPages
});

export const setCurrentPage = (page: number): SetCurrentPageAction => ({
  type: SET_CURRENT_PAGE,
  payload: page
});

export const setFilterQuery = (query: string): SetFilterQueryAction => ({
  type: SET_FILTER_QUERY,
  payload: query
});

export const setFatalError = (error: string): SetFatalErrorAction => ({
  type: SET_FATAL_ERROR,
  payload: error
});

export const parseFailedSequences = (failedSequences: string[], pageSize: number): number[] => {
  const pages = new Set<number>();

  failedSequences.forEach((seq) => {
    const trimmed = seq.trim();
    if (!trimmed) {
      return;
    }

    const [startRaw, endRaw] = trimmed.split("-");
    const start = Number(startRaw);
    const end = Number(endRaw);

    if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0) {
      return;
    }

    const startPage = Math.floor((start - 1) / pageSize) + 1;
    const endPage = Math.floor((end - 1) / pageSize) + 1;

    for (let page = startPage; page <= endPage; page += 1) {
      pages.add(page);
    }
  });

  return Array.from(pages).sort((a, b) => a - b);
};

export const normalizeFailedOffsets = (
  failedOffsets: number[] | undefined,
  failedSequences: string[] | undefined,
  pageSize: number
): number[] => {
  if (failedOffsets && failedOffsets.length > 0) {
    return [...new Set(failedOffsets)].sort((a, b) => a - b);
  }

  if (failedSequences && failedSequences.length > 0) {
    return parseFailedSequences(failedSequences, pageSize);
  }

  return [];
};

export const pagesFromRange = (from: number, to: number): number[] => {
  if (to < from) {
    return [];
  }

  const start = Math.floor((from - 1) / PAGE_SIZE) + 1;
  const end = Math.floor((to - 1) / PAGE_SIZE) + 1;
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

export const expectedRowsForPage = (page: number, totalRecords: number): number => {
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, totalRecords);
  return Math.max(0, end - start + 1);
};

export const mapRowsToPages = (
  rows: TableRow[],
  requestedPages: number[],
  failedOffsets: number[],
  totalRecords: number
): PageRows => {
  const failed = new Set(failedOffsets);
  const pageRows: PageRows = {};
  let cursor = 0;

  requestedPages.forEach((page) => {
    if (failed.has(page)) {
      return;
    }

    const rowCount = expectedRowsForPage(page, totalRecords);
    pageRows[page] = rows.slice(cursor, cursor + rowCount);
    cursor += rowCount;
  });

  return pageRows;
};

export const pageStatusLabel = (status: PageStatus | undefined): string => {
  if (status === "loaded") {
    return "loaded";
  }

  if (status === "failed_final") {
    return "failed";
  }

  return "locked";
};
