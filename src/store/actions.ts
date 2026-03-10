import type { ThunkAction } from "redux-thunk";
import { fetchTableData } from "../api/mockTableApi";
import type { PageStatus, Phase, TableRow } from "../types";
import { INITIAL_FETCH_TO, PAGE_SIZE } from "./constants";
import type { RootState } from "./store";
import {
  APPLY_CHUNK,
  LOAD_START,
  MARK_FINAL_FAILURES,
  SET_CURRENT_PAGE,
  SET_FATAL_ERROR,
  SET_FILTER_QUERY,
  SET_PHASE,
  SET_SIMULATE_RETRY_FAILURE
} from "./actionTypes";

type PageRows = Record<number, TableRow[]>;

interface LoadStartAction {
  type: typeof LOAD_START;
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

interface SetSimulateRetryFailureAction {
  type: typeof SET_SIMULATE_RETRY_FAILURE;
  payload: boolean;
}

export type TableAction =
  | LoadStartAction
  | ApplyChunkAction
  | SetPhaseAction
  | MarkFinalFailuresAction
  | SetCurrentPageAction
  | SetFilterQueryAction
  | SetFatalErrorAction
  | SetSimulateRetryFailureAction;

export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, TableAction>;

export const loadStart = (): LoadStartAction => ({
  type: LOAD_START
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

export const setSimulateRetryFailure = (enabled: boolean): SetSimulateRetryFailureAction => ({
  type: SET_SIMULATE_RETRY_FAILURE,
  payload: enabled
});

const parseFailedSequences = (failedSequences: string[], pageSize: number): number[] => {
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

const normalizeFailedOffsets = (
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

const pagesFromRange = (from: number, to: number): number[] => {
  if (to < from) {
    return [];
  }

  const start = Math.floor((from - 1) / PAGE_SIZE) + 1;
  const end = Math.floor((to - 1) / PAGE_SIZE) + 1;
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

const expectedRowsForPage = (page: number, totalRecords: number): number => {
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, totalRecords);
  return Math.max(0, end - start + 1);
};

const mapRowsToPages = (
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

const runRetryIfNeeded = async (
  failedPages: number[],
  totalRecord: number,
  simulateRetryFailure: boolean,
  dispatch: (action: TableAction) => void
): Promise<number[]> => {
  if (failedPages.length === 0) {
    return [];
  }

  dispatch(setPhase("retrying_failed"));

  const retryResponse = await fetchTableData({
    failedSequences: failedPages.map((page) => {
      const start = (page - 1) * PAGE_SIZE + 1;
      const end = page * PAGE_SIZE;
      return `${start}-${end}`;
    }),
    simulateRetryFailure
  });
  const retryFailedOffsets = normalizeFailedOffsets(
    retryResponse.failedOffsets,
    retryResponse.failedSequences,
    PAGE_SIZE
  );
  const retryPageRows = mapRowsToPages(
    retryResponse.summary,
    failedPages,
    retryFailedOffsets,
    totalRecord
  );

  dispatch(applyChunk(totalRecord, retryPageRows, retryFailedOffsets));
  return retryFailedOffsets;
};

export const initializeTableData = (): AppThunk => async (
  dispatch: (action: TableAction) => void,
  getState: () => RootState
) => {
  dispatch(loadStart());

  try {
    const simulateRetryFailure = getState().table.simulateRetryFailure;

    const firstResponse = await fetchTableData({
      startSequence: 1,
      endSequence: INITIAL_FETCH_TO,
      simulateRetryFailure
    });
    const firstRangeTo = Math.min(firstResponse.count, INITIAL_FETCH_TO);
    const firstRequestedPages = pagesFromRange(1, firstRangeTo);

    const firstFailedOffsets = normalizeFailedOffsets(
      firstResponse.failedOffsets,
      firstResponse.failedSequences,
      PAGE_SIZE
    );

    dispatch(
      applyChunk(
        firstResponse.count,
        mapRowsToPages(
          firstResponse.summary,
          firstRequestedPages,
          firstFailedOffsets,
          firstResponse.count
        ),
        firstFailedOffsets
      )
    );

    const pendingFailedPages = new Set<number>(firstFailedOffsets);

    if (firstResponse.count > INITIAL_FETCH_TO) {
      dispatch(setPhase("fetching_rest"));

      const secondResponse = await fetchTableData({
        startSequence: INITIAL_FETCH_TO + 1,
        endSequence: firstResponse.count,
        simulateRetryFailure
      });
      const secondRequestedPages = pagesFromRange(INITIAL_FETCH_TO + 1, firstResponse.count);

      const secondFailedOffsets = normalizeFailedOffsets(
        secondResponse.failedOffsets,
        secondResponse.failedSequences,
        PAGE_SIZE
      );

      dispatch(
        applyChunk(
          firstResponse.count,
          mapRowsToPages(
            secondResponse.summary,
            secondRequestedPages,
            secondFailedOffsets,
            firstResponse.count
          ),
          secondFailedOffsets
        )
      );

      secondFailedOffsets.forEach((page) => pendingFailedPages.add(page));
    }

    const unresolvedAfterRetry = await runRetryIfNeeded(
      Array.from(pendingFailedPages).sort((a, b) => a - b),
      firstResponse.count,
      simulateRetryFailure,
      dispatch
    );

    if (unresolvedAfterRetry.length > 0) {
      dispatch(markFinalFailures(unresolvedAfterRetry));
      dispatch(setPhase("ready_with_failures"));
      return;
    }

    dispatch(setPhase("ready"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error while loading table data.";
    dispatch(setFatalError(message));
  }
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
