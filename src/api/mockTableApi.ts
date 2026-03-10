import { INITIAL_FETCH_TO, PAGE_SIZE } from "../store/constants";
import type { TableApiRequest, TableApiResponse, TableRow } from "../types";

const TOTAL_RECORDS = 200;
const FAIL_ON_FIRST_SECOND_RANGE_PAGES = [7, 8];

const allRows: TableRow[] = Array.from({ length: TOTAL_RECORDS }, (_, index) => {
  const id = index + 1;

  return {
    companyIdentifier: String(2000 + id),
    companyName: `Company ${id}`,
    systemIdentifier: `SYS-${String(1000 + id)}`
  };
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const pagesFromRange = (from: number, to: number): number[] => {
  const boundedFrom = Math.max(1, from);
  const boundedTo = Math.min(to, TOTAL_RECORDS);

  if (boundedFrom > boundedTo) {
    return [];
  }

  const startPage = Math.floor((boundedFrom - 1) / PAGE_SIZE) + 1;
  const endPage = Math.floor((boundedTo - 1) / PAGE_SIZE) + 1;

  return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
};

const pageRows = (page: number): TableRow[] => {
  const start = (page - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, TOTAL_RECORDS);
  return allRows.slice(start, end);
};

const rowsForPages = (pages: number[]): TableRow[] =>
  pages.sort((a, b) => a - b).flatMap((page) => pageRows(page));

export const fetchTableData = async (request: TableApiRequest): Promise<TableApiResponse> => {
  await wait(600);

  const retryOffsets =
    request.failedSequences && request.failedSequences.length > 0
      ? request.failedSequences
          .flatMap((sequence) => {
            const [startRaw, endRaw] = sequence.split("-");
            const start = Number(startRaw);
            const end = Number(endRaw);
            if (!Number.isFinite(start) || !Number.isFinite(end)) {
              return [];
            }
            const startPage = Math.floor((start - 1) / PAGE_SIZE) + 1;
            const endPage = Math.floor((end - 1) / PAGE_SIZE) + 1;
            return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
          })
          .filter((page) => Number.isFinite(page))
      : [];

  if (retryOffsets.length > 0) {
    const sortedOffsets = [...new Set(retryOffsets)].sort((a, b) => a - b);

    if (request.simulateRetryFailure) {
      return {
        count: TOTAL_RECORDS,
        summary: [],
        failedSequences: sortedOffsets.map((page) => {
          const start = (page - 1) * PAGE_SIZE + 1;
          const end = Math.min(page * PAGE_SIZE, TOTAL_RECORDS);
          return `${start}-${end}`;
        })
      };
    }

    return {
      count: TOTAL_RECORDS,
      summary: rowsForPages(sortedOffsets),
      failedSequences: []
    };
  }

  if (typeof request.startSequence !== "number" || typeof request.endSequence !== "number") {
    throw new Error("Range request must provide both 'startSequence' and 'endSequence'.");
  }

  const requestedPages = pagesFromRange(request.startSequence, request.endSequence);
  const isSecondRangeRequest = request.startSequence > INITIAL_FETCH_TO;
  const failedOffsets = isSecondRangeRequest
    ? requestedPages.filter((page) => FAIL_ON_FIRST_SECOND_RANGE_PAGES.includes(page))
    : [];
  const successfulPages = requestedPages.filter((page) => !failedOffsets.includes(page));

  const failedSequences = failedOffsets.map((page) => {
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, TOTAL_RECORDS);
    return `${start}-${end}`;
  });

  return {
    count: TOTAL_RECORDS,
    summary: rowsForPages(successfulPages),
    failedOffsets,
    failedSequences
  };
};
