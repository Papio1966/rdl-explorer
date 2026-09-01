import { getDefaultReleaseKey, type RdlSourceKey } from "./catalog";

export type RdlBrowseFacetValue = {
  value: string;
  label?: string;
};

export type RdlSearchRecord = {
  sourceKey: RdlSourceKey;
  sourceName: string;
  releaseKey: string;
  releaseStatus: string;
  versionLabel: string;
  packageKey: string;
  entityType: string;
  nativeIdentifier: string;
  name: string;
  definition: string;
  sourceSheet: string;
  aliases?: string[];
  searchText?: string[];
  secondaryLabel?: string;
  tertiaryLabel?: string;
  badges?: string[];
  facets?: Record<string, RdlBrowseFacetValue>;
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

export function rdlSearchableValues(record: RdlSearchRecord): string[] {
  const facetValues = Object.values(record.facets ?? {}).flatMap((facet) => [facet.value, facet.label ?? ""]);
  return [
    record.nativeIdentifier,
    record.name,
    record.definition,
    record.entityType.replaceAll("_", " "),
    ...(record.aliases ?? []),
    ...(record.searchText ?? []),
    record.secondaryLabel ?? "",
    record.tertiaryLabel ?? "",
    ...(record.badges ?? []),
    ...facetValues,
  ].filter((value) => Boolean(value.trim()));
}

export function recordMatchesRdlQuery(record: RdlSearchRecord, query: string): boolean {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const searchable = rdlSearchableValues(record).join(" ").toLocaleLowerCase();
  return terms.every((term) => searchable.includes(term));
}

export function searchRdlRecords(records: RdlSearchRecord[], query: string, source: string, releaseKey: string | null = null, limit = 80): RdlSearchRecord[] {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];

  return records
    .filter((record) => {
      if (source === "all") return record.releaseKey === getDefaultReleaseKey(record.sourceKey);
      return record.sourceKey === source && (!releaseKey || record.releaseKey === releaseKey);
    })
    .map((record) => {
      const id = record.nativeIdentifier.toLocaleLowerCase();
      const name = record.name.toLocaleLowerCase();
      const definition = record.definition.toLocaleLowerCase();
      const aliases = (record.aliases ?? []).map((value) => value.toLocaleLowerCase());
      const searchable = rdlSearchableValues(record).join(" ").toLocaleLowerCase();
      if (!terms.every((term) => searchable.includes(term))) return null;
      let score = 0;
      const exactQuery = query.toLocaleLowerCase().trim();
      if (id === exactQuery) score += 100;
      if (name === exactQuery) score += 90;
      if (id.startsWith(exactQuery)) score += 60;
      if (name.startsWith(exactQuery)) score += 50;
      if (aliases.some((alias) => alias === exactQuery)) score += 45;
      if (name.includes(exactQuery)) score += 30;
      if (aliases.some((alias) => alias.includes(exactQuery))) score += 20;
      if (definition.includes(exactQuery)) score += 10;
      score += terms.reduce((sum, term) => sum + (id.includes(term) ? 6 : 0) + (name.includes(term) ? 4 : 0) + (aliases.some((alias) => alias.includes(term)) ? 3 : 0), 0);
      return { record, score };
    })
    .filter((candidate): candidate is { record: RdlSearchRecord; score: number } => candidate !== null)
    .sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name) || a.record.sourceKey.localeCompare(b.record.sourceKey))
    .slice(0, limit)
    .map(({ record }) => record);
}
