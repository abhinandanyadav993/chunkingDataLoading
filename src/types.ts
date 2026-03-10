export type Phase =
  | "idle"
  | "bootstrapping"
  | "fetching_rest"
  | "retrying_failed"
  | "ready"
  | "ready_with_failures"
  | "fatal";

export type PageStatus = "locked" | "loaded" | "failed_final";

export interface TableRow {
  companyIdentifier: string;
  companyName: string;
  systemIdentifier: string;
}

export interface TableApiRequest {
  startSequence?: number;
  endSequence?: number;
  failedSequences?: string[];
}

export interface TableApiResponse {
  count: number;
  summary: TableRow[];
  failedOffsets?: number[];
  failedSequences?: string[];
}
