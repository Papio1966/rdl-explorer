import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from "pg";
import type { DatabaseClient, DatabaseHealth } from "./DatabaseClient.ts";
import type { SqlJsonClient, SqlRow } from "./PsqlJsonClient.ts";

export type PgPoolLike = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
  connect(): Promise<PgClientLike>;
  end(): Promise<void>;
  totalCount?: number;
  idleCount?: number;
  waitingCount?: number;
};

export type PgClientLike = Pick<PoolClient, "query" | "release">;

export class DatabaseRuntimeError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

export class PgJsonClient implements SqlJsonClient, DatabaseClient {
  constructor(private readonly pool: PgPoolLike) {}

  static fromConfig(config: PoolConfig) {
    return new PgJsonClient(new Pool(config));
  }

  async query<T extends SqlRow = SqlRow>(sql: string): Promise<T[]> {
    try {
      const result = await this.pool.query<T & QueryResultRow>(sql);
      return result.rows as T[];
    } catch (error) {
      throw mapDatabaseError(error, "PostgreSQL query failed.");
    }
  }

  async transaction<T>(work: (client: SqlJsonClient) => Promise<T>): Promise<T> {
    let client: PgClientLike | undefined;
    try {
      client = await this.pool.connect();
      await client.query("BEGIN");
      const scoped: SqlJsonClient = {
        query: async <R extends SqlRow = SqlRow>(sql: string) => {
          const result = await client!.query<R & QueryResultRow>(sql);
          return result.rows as R[];
        },
      };
      const value = await work(scoped);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      if (client) {
        try { await client.query("ROLLBACK"); } catch { /* preserve original error */ }
      }
      throw mapDatabaseError(error, "PostgreSQL transaction failed.");
    } finally {
      client?.release();
    }
  }

  async health(): Promise<DatabaseHealth> {
    try {
      const rows = await this.query<{ database: string; version: string }>(
        "SELECT current_database() AS database, version() AS version",
      );
      const row = rows[0];
      return { ok: Boolean(row), database: row?.database, version: row?.version };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database health check failed.";
      return { ok: false, message };
    }
  }

  poolStats() {
    return {
      total: this.pool.totalCount ?? 0,
      idle: this.pool.idleCount ?? 0,
      waiting: this.pool.waitingCount ?? 0,
    };
  }

  close() {
    return this.pool.end();
  }
}

function mapDatabaseError(error: unknown, fallback: string) {
  if (error instanceof DatabaseRuntimeError) return error;
  const candidate = error as { code?: string; message?: string } | undefined;
  const code = candidate?.code ?? "RDL_DATABASE_ERROR";
  return new DatabaseRuntimeError(candidate?.message || fallback, code, error);
}
