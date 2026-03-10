import { ajax } from "rxjs/ajax";
import { type Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { TableApiRequest, TableApiResponse } from "../types";

const API_URL = "/v1/company/search";

export const postTableData = (payload: TableApiRequest): Observable<TableApiResponse> => {
  return ajax
    .post<TableApiResponse>(API_URL, payload, {
      "Content-Type": "application/json"
    })
    .pipe(map((response) => response.response));
};
