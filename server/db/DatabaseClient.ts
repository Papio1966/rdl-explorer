export type DatabaseHealth = {
  ok: boolean;
  database?: string;
  version?: string;
  message?: string;
};

/**
 * Runtime database adapter boundary.
 *
 * RDL-002 defines the contract without choosing a Node PostgreSQL driver yet.
 * A concrete implementation is introduced when the application starts reading
 * RDL data from PostgreSQL. This avoids coupling the current workbook runtime
 * to database infrastructure prematurely.
 */
export interface DatabaseClient {
  health(): Promise<DatabaseHealth>;
  close(): Promise<void>;
}
