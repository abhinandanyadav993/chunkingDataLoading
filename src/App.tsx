import { useEffect } from "react";
import {
  initializeTableData,
  pageStatusLabel,
  setCurrentPage,
  setFilterQuery,
  setSimulateRetryFailure
} from "./store/actions";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import {
  canUseFilterAndUnlockedPagination,
  filteredRowsForPage,
  isPageEnabled,
  maxContiguousLoadedPage
} from "./store/selectors";
import type { RootState } from "./store/store";

const phaseLabel: Record<string, string> = {
  idle: "Idle",
  bootstrapping: "Loading first 60 records",
  fetching_rest: "Loading remaining records",
  retrying_failed: "Retrying failed pages",
  ready: "Ready",
  ready_with_failures: "Ready (some pages failed)",
  fatal: "Fatal error"
};

function App() {
  const dispatch = useAppDispatch();
  const table = useAppSelector((state: RootState) => state.table);
  const rows = filteredRowsForPage(table);
  const canFilter = canUseFilterAndUnlockedPagination(table);
  const contiguousLoaded = maxContiguousLoadedPage(table);
  const loadedPages = Object.values(table.pageStatus).filter((status) => status === "loaded").length;

  useEffect(() => {
    dispatch(initializeTableData());
  }, [dispatch]);

  const pages = Array.from({ length: table.totalPages }, (_, index) => index + 1);
  const currentStatus = table.pageStatus[table.currentPage];
  const prevPage = table.currentPage - 1;
  const nextPage = table.currentPage + 1;

  return (
    <main className="app-shell">
      <section className="header">
        <h1>Legacy Redux: Table + Filter + Pagination</h1>
        <p>
          Page size is fixed to <strong>10</strong>. Initial fetch loads records <strong>1-60</strong>,
          then fetches the remaining range, retries failed pages (like 7 and 8), and marks final failures
          if retry also fails.
        </p>
      </section>

      <section className="toolbar">
        <label className="field">
          <span>Filter rows</span>
          <input
            value={table.filterQuery}
            onChange={(event) => dispatch(setFilterQuery(event.target.value))}
            disabled={!canFilter}
            placeholder={
              canFilter
                ? "Type to filter current page rows"
                : "Disabled until all data is fetched or failure is finalized"
            }
          />
        </label>

        <label className="inline-checkbox">
          <input
            type="checkbox"
            checked={table.simulateRetryFailure}
            onChange={(event) => dispatch(setSimulateRetryFailure(event.target.checked))}
          />
          <span>Simulate retry failure for pages 7 and 8</span>
        </label>

        <button type="button" onClick={() => dispatch(initializeTableData())}>
          Reload Table
        </button>
      </section>

      <section className="status-grid">
        <div>
          <strong>Phase:</strong> {phaseLabel[table.phase]}
        </div>
        <div>
          <strong>Total records:</strong> {table.totalRecords}
        </div>
        <div>
          <strong>Total pages:</strong> {table.totalPages}
        </div>
        <div>
          <strong>Loaded pages:</strong> {loadedPages}
        </div>
        <div>
          <strong>Currently unlocked upto:</strong> {contiguousLoaded}
        </div>
        {table.retryTargets.length > 0 && (
          <div>
            <strong>Retry pending:</strong> {table.retryTargets.join(", ")}
          </div>
        )}
      </section>

      <section className="table-panel">
        <table>
          <thead>
            <tr>
              <th>Company Identifier</th>
              <th>Company Name</th>
              <th>System Identifier</th>
            </tr>
          </thead>
          <tbody>
            {table.phase === "fatal" ? (
              <tr>
                <td colSpan={3} className="message error">
                  {table.error ?? "Unable to load data."}
                </td>
              </tr>
            ) : currentStatus === "failed_final" ? (
              <tr>
                <td colSpan={3} className="message warn">
                  Page {table.currentPage} failed after retry. Data is unavailable for this page.
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="message">
                  No rows found for this page{table.filterQuery ? " after applying filter" : ""}.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.companyIdentifier}-${row.systemIdentifier}`}>
                  <td>{row.companyIdentifier}</td>
                  <td>{row.companyName}</td>
                  <td>{row.systemIdentifier}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="pagination">
        <button
          type="button"
          onClick={() => dispatch(setCurrentPage(prevPage))}
          disabled={!isPageEnabled(table, prevPage)}
        >
          Prev
        </button>

        <div className="page-list">
          {pages.map((page) => {
            const enabled = isPageEnabled(table, page);
            const status = table.pageStatus[page];
            const isActive = table.currentPage === page;

            return (
              <button
                key={page}
                type="button"
                disabled={!enabled}
                className={isActive ? "active" : ""}
                onClick={() => dispatch(setCurrentPage(page))}
                title={`Page ${page} (${pageStatusLabel(status)})`}
              >
                {page}
                {status === "failed_final" ? " !" : ""}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => dispatch(setCurrentPage(nextPage))}
          disabled={!isPageEnabled(table, nextPage)}
        >
          Next
        </button>
      </section>
    </main>
  );
}

export default App;
