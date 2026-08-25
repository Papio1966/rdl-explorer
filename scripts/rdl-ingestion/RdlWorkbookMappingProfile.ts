export type FieldAliases = Record<string, readonly string[]>;

export type RdlWorkbookMappingProfile = {
  profileKey: string;
  adapterVersion: string;
  sourceKey: string;
  sourceName: string;
  sourceDescription: string;
  publisher: string;
  releaseKey: string;
  versionLabel: string;
  releaseStatus: "candidate" | "published";
  workbookPath: string;
  sourceUri: string;
  sheetNames: Record<string, string>;
  fields: FieldAliases;
};

export function mappedText(row: Record<string, unknown>, aliases: readonly string[]): string {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}
