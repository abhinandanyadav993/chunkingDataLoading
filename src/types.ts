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
  id: number;
  customerName: string;
  city: string;
  plan: "Basic" | "Premium" | "Enterprise";
  amount: number;
  lastUpdated: string;
}

export interface TableApiRequest {
  from?: number;
  to?: number;
  failedOffsets?: number[];
  simulateRetryFailure?: boolean;
}

export interface TableApiResponse {
  totalRecord: number;
  records: TableRow[];
  failedOffsets: number[];
}
