import { combineEpics, ofType } from "redux-observable";
import { concat, from, of } from "rxjs";
import { catchError, mergeMap, switchMap } from "rxjs/operators";
import { postTableData } from "../api/tableApi";
import {
  applyChunk,
  loadStart,
  mapRowsToPages,
  markFinalFailures,
  normalizeFailedOffsets,
  pagesFromRange,
  setFatalError,
  setPhase,
  type TableAction
} from "./actions";
import { INITIALIZE_TABLE } from "./actionTypes";
import { INITIAL_FETCH_TO, PAGE_SIZE } from "./constants";

const buildRetry$ = (failedPages: number[], totalCount: number) => {
  if (failedPages.length === 0) {
    return of(setPhase("ready"));
  }

  const sortedFailed = [...failedPages].sort((a, b) => a - b);

  return concat(
    of(setPhase("retrying_failed")),
    from(
      postTableData({
        failedSequences: sortedFailed.map((page) => {
          const start = (page - 1) * PAGE_SIZE + 1;
          const end = page * PAGE_SIZE;
          return `${start}-${end}`;
        })
      })
    ).pipe(
      mergeMap((retryResponse) => {
        const retryFailedOffsets = normalizeFailedOffsets(
          retryResponse.failedOffsets,
          retryResponse.failedSequences,
          PAGE_SIZE
        );
        const retryPageRows = mapRowsToPages(
          retryResponse.summary,
          sortedFailed,
          retryFailedOffsets,
          totalCount
        );
        const actions: TableAction[] = [applyChunk(totalCount, retryPageRows, retryFailedOffsets)];

        if (retryFailedOffsets.length > 0) {
          actions.push(markFinalFailures(retryFailedOffsets));
          actions.push(setPhase("ready_with_failures"));
        } else {
          actions.push(setPhase("ready"));
        }

        return from(actions);
      })
    )
  );
};

const initializeTableEpic = (action$: any) =>
  action$.pipe(
    ofType(INITIALIZE_TABLE),
    switchMap(() => {
      return concat(
        of(loadStart()),
        from(
          postTableData({
            startSequence: 1,
            endSequence: INITIAL_FETCH_TO
          })
        ).pipe(
          mergeMap((firstResponse) => {
            const firstRangeTo = Math.min(firstResponse.count, INITIAL_FETCH_TO);
            const firstRequestedPages = pagesFromRange(1, firstRangeTo);
            const firstFailedOffsets = normalizeFailedOffsets(
              firstResponse.failedOffsets,
              firstResponse.failedSequences,
              PAGE_SIZE
            );

            const firstApply = applyChunk(
              firstResponse.count,
              mapRowsToPages(
                firstResponse.summary,
                firstRequestedPages,
                firstFailedOffsets,
                firstResponse.count
              ),
              firstFailedOffsets
            );

            const pendingFailedPages = new Set<number>(firstFailedOffsets);

            if (firstResponse.count <= INITIAL_FETCH_TO) {
              return concat(of(firstApply), buildRetry$(Array.from(pendingFailedPages), firstResponse.count));
            }

            return concat(
              of(firstApply, setPhase("fetching_rest")),
              from(
                postTableData({
                  startSequence: INITIAL_FETCH_TO + 1,
                  endSequence: firstResponse.count
                })
              ).pipe(
                mergeMap((secondResponse) => {
                  const secondRequestedPages = pagesFromRange(
                    INITIAL_FETCH_TO + 1,
                    firstResponse.count
                  );
                  const secondFailedOffsets = normalizeFailedOffsets(
                    secondResponse.failedOffsets,
                    secondResponse.failedSequences,
                    PAGE_SIZE
                  );
                  secondFailedOffsets.forEach((page) => pendingFailedPages.add(page));

                  const secondApply = applyChunk(
                    firstResponse.count,
                    mapRowsToPages(
                      secondResponse.summary,
                      secondRequestedPages,
                      secondFailedOffsets,
                      firstResponse.count
                    ),
                    secondFailedOffsets
                  );

                  return concat(
                    of(secondApply),
                    buildRetry$(Array.from(pendingFailedPages), firstResponse.count)
                  );
                })
              )
            );
          })
        )
      ).pipe(
        catchError((error) => {
          const message =
            error instanceof Error ? error.message : "Unknown error while loading table data.";
          return of(setFatalError(message));
        })
      );
    })
  );

export const rootEpic = combineEpics(initializeTableEpic);
