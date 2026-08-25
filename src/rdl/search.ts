import type { RdlSourceKey } from "./catalog";

export type RdlSearchRecord = {
  sourceKey: RdlSourceKey;
  sourceName: string;
  versionLabel: string;
  packageKey: string;
  entityType: string;
  nativeIdentifier: string;
  name: string;
  definition: string;
  sourceSheet: string;
};

let indexPromise: Promise<RdlSearchRecord[]> | null = null;

export function loadRdlSearchIndex(): Promise<RdlSearchRecord[]> {
  indexPromise ??= fetch("/rdl-search-index.json")
    .then((response) => {
      if (!response.ok) throw new Error(`Unable to load RDL search index (${response.status})`);
      return response.json() as Promise<RdlSearchRecord[]>;
    });
  return indexPromise;
}

export function searchRdlRecords(records: RdlSearchRecord[], query: string, source: string, limit = 80): RdlSearchRecord[] {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];

  return records
    .filter((record) => source === "all" || record.sourceKey === source)
    .map((record) => {
      const id = record.nativeIdentifier.toLocaleLowerCase();
      const name = record.name.toLocaleLowerCase();
      const definition = record.definition.toLocaleLowerCase();
      const type = record.entityType.toLocaleLowerCase().replaceAll("_", " ");
      const searchable = `${id} ${name} ${definition} ${type}`;
      if (!terms.every((term) => searchable.includes(term))) return null;
      let score = 0;
      const exactQuery = query.toLocaleLowerCase().trim();
      if (id === exactQuery) score += 100;
      if (name === exactQuery) score += 90;
      if (id.startsWith(exactQuery)) score += 60;
      if (name.startsWith(exactQuery)) score += 50;
      if (name.includes(exactQuery)) score += 30;
      if (definition.includes(exactQuery)) score += 10;
      score += terms.reduce((sum, term) => sum + (id.includes(term) ? 6 : 0) + (name.includes(term) ? 4 : 0), 0);
      return { record, score };
    })
    .filter((candidate): candidate is { record: RdlSearchRecord; score: number } => candidate !== null)
    .sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name) || a.record.sourceKey.localeCompare(b.record.sourceKey))
    .slice(0, limit)
    .map(({ record }) => record);
}
