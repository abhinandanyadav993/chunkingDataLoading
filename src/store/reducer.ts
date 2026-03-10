import type { PageStatus } from "../types";
import {
  APPLY_CHUNK,
  LOAD_START,
  MARK_FINAL_FAILURES,
  SET_CURRENT_PAGE,
  SET_FATAL_ERROR,
  SET_FILTER_QUERY,
  SET_PHASE
} from "./actionTypes";
import type { TableAction } from "./actions";
import { initialTableState, type TableState } from "./state";

const normalizePageStatuses = (
  currentStatuses: Record<number, PageStatus>,
  totalPages: number
): Record<number, PageStatus> => {
  const nextStatuses: Record<number, PageStatus> = { ...currentStatuses };

  for (let page = 1; page <= totalPages; page += 1) {
    if (!nextStatuses[page]) {
      nextStatuses[page] = "locked";
    }
  }

  return nextStatuses;
};

export const tableReducer = (
  state: TableState = initialTableState,
  action: TableAction
): TableState => {
  switch (action.type) {
    case LOAD_START:
      return {
        ...initialTableState,
        phase: "bootstrapping"
      };

    case APPLY_CHUNK: {
      const { totalRecord, pageRows, failedOffsets } = action.payload;
      const totalPages = Math.ceil(totalRecord / state.pageSize);
      const nextStatuses = normalizePageStatuses(state.pageStatus, totalPages);
      const nextRowsByPage = { ...state.rowsByPage };

      Object.entries(pageRows).forEach(([pageAsString, rows]) => {
        const page = Number(pageAsString);
        nextRowsByPage[page] = rows;
        nextStatuses[page] = "loaded";
      });

      return {
        ...state,
        totalRecords: totalRecord,
        totalPages,
        rowsByPage: nextRowsByPage,
        pageStatus: nextStatuses,
        retryTargets: [...failedOffsets]
      };
    }

    case SET_PHASE:
      return {
        ...state,
        phase: action.payload,
        error: action.payload === "fatal" ? state.error : undefined
      };

    case MARK_FINAL_FAILURES: {
      const updatedStatuses = { ...state.pageStatus };
      action.payload.forEach((page) => {
        updatedStatuses[page] = "failed_final";
      });

      return {
        ...state,
        pageStatus: updatedStatuses,
        finalFailedPages: [...action.payload],
        retryTargets: []
      };
    }

    case SET_CURRENT_PAGE: {
      if (action.payload < 1 || action.payload > state.totalPages) {
        return state;
      }

      return {
        ...state,
        currentPage: action.payload
      };
    }

    case SET_FILTER_QUERY:
      return {
        ...state,
        filterQuery: action.payload
      };

    case SET_FATAL_ERROR:
      return {
        ...state,
        phase: "fatal",
        error: action.payload
      };

    default:
      return state;
  }
};
