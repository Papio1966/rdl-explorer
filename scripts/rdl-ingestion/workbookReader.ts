import readExcelFile from "read-excel-file/node";

export type WorkbookCell = string | null;
export type WorkbookMatrix = WorkbookCell[][];

export type WorkbookWorksheet = {
  name: string;
  matrix: WorkbookMatrix;
};

export type WorkbookData = {
  sheetNames: string[];
  sheets: Record<string, WorkbookWorksheet>;
};

type ParsedCell = string | number | boolean | Date | null;

type WorkbookInput = Buffer | string;

function formattedCell(value: ParsedCell): WorkbookCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

function trimTrailingNulls(row: WorkbookMatrix[number]): WorkbookMatrix[number] {
  let end = row.length;
  while (end > 0 && row[end - 1] === null) end -= 1;
  return row.slice(0, end);
}

function normalizedHeaders(headerRow: WorkbookMatrix[number]): string[] {
  const counts = new Map<string, number>();
  return headerRow.map((value) => {
    const base = value === null ? "__EMPTY" : String(value);
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    if (count === 0) return base;
    return base === "__EMPTY" ? `__EMPTY_${count}` : `${base}_${count}`;
  });
}

export async function readWorkbook(input: WorkbookInput): Promise<WorkbookData> {
  const parsed = await readExcelFile(input, { trim: false });
  const sheets: Record<string, WorkbookWorksheet> = {};
  const sheetNames: string[] = [];

  for (const sheet of parsed) {
    const name = sheet.sheet;
    const matrix = sheet.data.map((row) => trimTrailingNulls(row.map((value) => formattedCell(value as ParsedCell))));
    sheetNames.push(name);
    sheets[name] = { name, matrix };
  }

  return { sheetNames, sheets };
}

export function worksheetMatrix(worksheet: WorkbookWorksheet): WorkbookMatrix {
  return worksheet.matrix.map((row) => [...row]);
}

export function worksheetHeaders(worksheet: WorkbookWorksheet): string[] {
  const headerRow = worksheet.matrix[0] ?? [];
  return headerRow
    .map((value) => (value === null ? "" : String(value).trim()))
    .filter((value) => value.length > 0);
}

export function worksheetRows<T extends Record<string, unknown>>(worksheet: WorkbookWorksheet): T[] {
  if (worksheet.matrix.length === 0) return [];

  const headers = normalizedHeaders(worksheet.matrix[0] ?? []);
  const rows: T[] = [];

  for (const sourceRow of worksheet.matrix.slice(1)) {
    const hasValue = sourceRow.some((value) => value !== null && value !== "");
    if (!hasValue) continue;

    const row: Record<string, unknown> = {};
    for (let index = 0; index < headers.length; index += 1) {
      row[headers[index]] = sourceRow[index] ?? null;
    }
    rows.push(row as T);
  }

  return rows;
}
