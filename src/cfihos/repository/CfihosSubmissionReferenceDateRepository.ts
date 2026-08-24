import {
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import type { CfihosSubmissionReferenceDate } from "../model/submissionReferenceDate";

const MASTER_SHEET = "RDL master object";
const FAMILY = "submission reference date";

type RepositoryState = {
  items: CfihosSubmissionReferenceDate[];
  byCode: Map<string, CfihosSubmissionReferenceDate>;
};

export class CfihosSubmissionReferenceDateRepository {
  private state: RepositoryState | null = null;
  private loadingPromise: Promise<RepositoryState> | null = null;

  async getAll(): Promise<CfihosSubmissionReferenceDate[]> {
    const state = await this.getState();
    return state.items;
  }

  async getByCode(
    code: string,
  ): Promise<CfihosSubmissionReferenceDate | null> {
    const state = await this.getState();
    return state.byCode.get(normalize(code)) ?? null;
  }

  private async getState(): Promise<RepositoryState> {
    if (this.state) {
      return this.state;
    }

    if (!this.loadingPromise) {
      this.loadingPromise = this.buildState();
    }

    try {
      this.state = await this.loadingPromise;
      return this.state;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async buildState(): Promise<RepositoryState> {
    const rows = await getCfihosWorksheetRows(MASTER_SHEET);
    const items = buildItems(rows);
    const byCode = new Map<string, CfihosSubmissionReferenceDate>();

    for (const item of items) {
      byCode.set(normalize(item.code), item);
    }

    return { items, byCode };
  }
}

function buildItems(
  rows: CfihosWorksheetRow[],
): CfihosSubmissionReferenceDate[] {
  return rows
    .filter(
      (row) =>
        normalize(asString(row["CFIHOS definition file"])) === FAMILY,
    )
    .map((row) => ({
      id: asString(row["CFIHOS unique code"]),
      code: asString(row["CFIHOS name"]),
      description: asString(row["CFIHOS description"]) || null,
    }))
    .filter((item) => item.id.length > 0 && item.code.length > 0)
    .sort((a, b) => a.code.localeCompare(b.code));
}

function asString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export const cfihosSubmissionReferenceDateRepository =
  new CfihosSubmissionReferenceDateRepository();
