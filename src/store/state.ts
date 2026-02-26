import type { PageStatus, Phase, TableRow } from "../types";
import { PAGE_SIZE } from "./constants";

export interface TableState {
  phase: Phase;
  totalRecords: number;
  totalPages: number;
  pageSize: number;
  currentPage: number;
  filterQuery: string;
  rowsByPage: Record<number, TableRow[]>;
  pageStatus: Record<number, PageStatus>;
  retryTargets: number[];
  finalFailedPages: number[];
  simulateRetryFailure: boolean;
  error?: string;
}

export const initialTableState: TableState = {
  phase: "idle",
  totalRecords: 0,
  totalPages: 0,
  pageSize: PAGE_SIZE,
  currentPage: 1,
  filterQuery: "",
  rowsByPage: {},
  pageStatus: {},
  retryTargets: [],
  finalFailedPages: [],
  simulateRetryFailure: false
};
