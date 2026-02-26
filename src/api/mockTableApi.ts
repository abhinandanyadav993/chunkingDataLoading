import { INITIAL_FETCH_TO, PAGE_SIZE } from "../store/constants";
import type { TableApiRequest, TableApiResponse, TableRow } from "../types";

const TOTAL_RECORDS = 200;
const FAIL_ON_FIRST_SECOND_RANGE_PAGES = [7, 8];

const cities = ["Mumbai", "Delhi", "Bengaluru", "Pune", "Chennai", "Hyderabad"];
const plans: TableRow["plan"][] = ["Basic", "Premium", "Enterprise"];

const allRows: TableRow[] = Array.from({ length: TOTAL_RECORDS }, (_, index) => {
  const id = index + 1;

  return {
    id,
    customerName: `Customer ${id}`,
    city: cities[index % cities.length],
    plan: plans[index % plans.length],
    amount: Number((200 + ((index * 37) % 1500)).toFixed(2)),
    lastUpdated: new Date(2026, index % 12, (index % 28) + 1).toISOString().slice(0, 10)
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

  if (request.failedOffsets && request.failedOffsets.length > 0) {
    const sortedOffsets = [...new Set(request.failedOffsets)].sort((a, b) => a - b);

    if (request.simulateRetryFailure) {
      return {
        totalRecord: TOTAL_RECORDS,
        records: [],
        failedOffsets: sortedOffsets
      };
    }

    return {
      totalRecord: TOTAL_RECORDS,
      records: rowsForPages(sortedOffsets),
      failedOffsets: []
    };
  }

  if (typeof request.from !== "number" || typeof request.to !== "number") {
    throw new Error("Range request must provide both 'from' and 'to'.");
  }

  const requestedPages = pagesFromRange(request.from, request.to);
  const isSecondRangeRequest = request.from > INITIAL_FETCH_TO;
  const failedOffsets = isSecondRangeRequest
    ? requestedPages.filter((page) => FAIL_ON_FIRST_SECOND_RANGE_PAGES.includes(page))
    : [];
  const successfulPages = requestedPages.filter((page) => !failedOffsets.includes(page));

  return {
    totalRecord: TOTAL_RECORDS,
    records: rowsForPages(successfulPages),
    failedOffsets
  };
};
