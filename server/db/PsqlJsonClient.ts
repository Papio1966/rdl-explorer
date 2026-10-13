import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type SqlRow = Record<string, unknown>;

export interface SqlJsonClient {
  query<T extends SqlRow = SqlRow>(sql: string): Promise<T[]>;
}

export class PsqlJsonClient implements SqlJsonClient {
  constructor(private readonly connectionString: string) {}

  async query<T extends SqlRow = SqlRow>(sql: string): Promise<T[]> {
    const wrapped = `SELECT COALESCE(json_agg(row_to_json(q)), '[]'::json) FROM (${sql}) q;`;
    const { stdout } = await execFileAsync(
      "psql",
      [
        "--no-psqlrc",
        "-X",
        "-q",
        "-A",
        "-t",
        "-v",
        "ON_ERROR_STOP=1",
        this.connectionString,
        "-c",
        wrapped,
      ],
      // Governed effective-standard packages can exceed 16 MiB once
      // authoritative relationship closure is included. Keep the
      // subprocess transport bounded while allowing operational RDL packages.
      { maxBuffer: 128 * 1024 * 1024 },
    );

    const payload = stdout.trim();
    if (!payload) return [];
    const parsed: unknown = JSON.parse(payload);
    if (!Array.isArray(parsed)) {
      throw new Error("PostgreSQL JSON query did not return an array.");
    }
    return parsed as T[];
  }
}

export function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
