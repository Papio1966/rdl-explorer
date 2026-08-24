export type CfihosUnitReference = {
  id: string | null;
  name: string | null;
};

export function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();

  if (
    normalized.length === 0 ||
    normalized === "-" ||
    normalized === "—"
  ) {
    return null;
  }

  return normalized;
}

export function normalizeRequiredString(value: unknown): string {
  return normalizeOptionalString(value) ?? "";
}

export function normalizeBoolean(value: unknown): boolean {
  const normalized = normalizeOptionalString(value)?.toLowerCase();

  return normalized === "yes" || normalized === "true" || normalized === "1";
}

export function normalizeSynonyms(value: unknown): string[] {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}