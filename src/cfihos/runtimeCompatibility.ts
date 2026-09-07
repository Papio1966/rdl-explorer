import { cfihosDocumentRepository } from "./repository/CfihosDocumentRepository";
import {
  loadCfihosWorkbook,
  type CfihosWorksheetRow,
} from "./workbook";
import {
  getRdlBrowserReadMode,
  RdlBrowserDualReadError,
  RdlBrowserRuntimeReadError,
  type RdlBrowserReadMode,
} from "../rdl/runtimeDualRead";

const CFIHOS_SOURCE_KEY = "cfihos";
const CFIHOS_RELEASE_KEY = "cfihos-2.0";
const HANDOVER_EVENT_SHEET = "handover event";
const CLASS_RELATIONSHIP_SHEET = "tag equipment class relationshi";
const UNIT_OF_MEASURE_SHEET = "unit of measure";
const TAG_PROPERTY_SHEET = "tag class property";
const EQUIPMENT_PROPERTY_SHEET = "equipment class property";
const PROPERTY_SHEET = "property";
const TAG_CLASS_SHEET = "tag class";
const PROPERTY_PICKLIST_VALUE_SHEET = "property picklist values";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type CfihosHandoverEventSource = {
  rows: CfihosWorksheetRow[];
  lifecycleRelationshipCount: number;
  lifecycleRelationshipsWithAnyStatusCount: number;
  sourceSha256: string | null;
  packageKey: string | null;
};

type RuntimeHandoverItem = {
  id: string;
  name: string;
  description: string | null;
  reportingSequence: string | null;
  sourceLocator: Record<string, unknown>;
};

type RuntimeHandoverResponse = {
  schemaVersion: string;
  sourceKey: string;
  releaseKey: string;
  versionLabel: string;
  packageKey: string;
  contentSha256: string;
  sourceUri: string | null;
  items: RuntimeHandoverItem[];
  lifecycleRelationshipCount: number;
  lifecycleRelationshipsWithAnyStatusCount: number;
};


export type CfihosClassRelationshipSource = {
  rows: CfihosWorksheetRow[];
  sourceSha256: string | null;
  packageKey: string | null;
};

type RuntimeClassRelationshipItem = {
  tagClassId: string;
  tagClassName: string;
  equipmentClassId: string;
  equipmentClassName: string;
  mappingReason: string | null;
  sourceLocator: Record<string, unknown>;
};

type RuntimeClassRelationshipResponse = {
  schemaVersion: string;
  sourceKey: string;
  releaseKey: string;
  versionLabel: string;
  packageKey: string;
  contentSha256: string;
  sourceUri: string | null;
  items: RuntimeClassRelationshipItem[];
};

export type CfihosClassRelationshipRuntimeOptions = {
  mode?: RdlBrowserReadMode;
  fetcher?: FetchLike;
  reference?: CfihosClassRelationshipSource;
};

export type CfihosUnitOfMeasureSource = {
  unitRows: CfihosWorksheetRow[];
  tagPropertyRows: CfihosWorksheetRow[];
  equipmentPropertyRows: CfihosWorksheetRow[];
  propertyRows: CfihosWorksheetRow[];
  sourceSha256: string | null;
  packageKey: string | null;
};

type RuntimeUnitOfMeasureItem = {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
  sourceLocator: Record<string, unknown>;
};

type RuntimeUnitPropertyReference = {
  siUnitId: string | null;
  imperialUnitId: string | null;
  sourceLocator: Record<string, unknown>;
};

type RuntimePropertyDimensionReference = {
  dimensionId: string | null;
  sourceLocator: Record<string, unknown>;
};

type RuntimeUnitOfMeasureResponse = {
  schemaVersion: string;
  sourceKey: string;
  releaseKey: string;
  versionLabel: string;
  packageKey: string;
  contentSha256: string;
  sourceUri: string | null;
  items: RuntimeUnitOfMeasureItem[];
  tagPropertyReferences: RuntimeUnitPropertyReference[];
  equipmentPropertyReferences: RuntimeUnitPropertyReference[];
  propertyDimensionReferences: RuntimePropertyDimensionReference[];
};

export type CfihosUnitOfMeasureRuntimeOptions = {
  mode?: RdlBrowserReadMode;
  fetcher?: FetchLike;
  reference?: CfihosUnitOfMeasureSource;
};

export type CfihosHandoverEventRuntimeOptions = {
  mode?: RdlBrowserReadMode;
  fetcher?: FetchLike;
  reference?: CfihosHandoverEventSource;
};


export type CfihosPropertySource = {
  propertyRows: CfihosWorksheetRow[];
  tagClassRows: CfihosWorksheetRow[];
  tagClassPropertyRows: CfihosWorksheetRow[];
  picklistValueRows: CfihosWorksheetRow[];
  sourceSha256: string | null;
  packageKey: string | null;
};

type RuntimePropertyItem = {
  id: string;
  name: string;
  definition: string | null;
  metadata: Record<string, unknown>;
  sourceLocator: Record<string, unknown>;
};

type RuntimePropertyTagClassItem = {
  id: string;
  name: string;
  definition: string | null;
  metadata: Record<string, unknown>;
  sourceLocator: Record<string, unknown>;
};

type RuntimePropertyAssignmentItem = {
  tagClassId: string;
  tagClassName: string;
  propertyId: string;
  propertyName: string;
  siUnitId: string | null;
  siUnitName: string | null;
  imperialUnitId: string | null;
  imperialUnitName: string | null;
  sourceLocator: Record<string, unknown>;
};

type RuntimePropertyPicklistValueItem = {
  picklistId: string;
  picklistName: string;
  id: string;
  code: string;
  description: string | null;
  sourceStandardId: string | null;
  sourceStandardCode: string | null;
  sourceLocator: Record<string, unknown>;
};

type RuntimePropertyResponse = {
  schemaVersion: string;
  sourceKey: string;
  releaseKey: string;
  versionLabel: string;
  packageKey: string;
  contentSha256: string;
  sourceUri: string | null;
  items: RuntimePropertyItem[];
  tagClasses: RuntimePropertyTagClassItem[];
  tagClassPropertyAssignments: RuntimePropertyAssignmentItem[];
  picklistValues: RuntimePropertyPicklistValueItem[];
};

export type CfihosPropertyRuntimeOptions = {
  mode?: RdlBrowserReadMode;
  fetcher?: FetchLike;
  reference?: CfihosPropertySource;
};

export async function loadCfihosHandoverEventSource(
  options: CfihosHandoverEventRuntimeOptions = {},
): Promise<CfihosHandoverEventSource> {
  const mode = options.mode ?? getRdlBrowserReadMode();
  const fetcher = options.fetcher ?? fetch;

  if (mode === "api") {
    return fetchRuntimeSource(fetcher, runtimeFailure);
  }

  const reference = options.reference ?? await loadSnapshotReference();
  if (mode === "json") return reference;

  const runtime = await fetchRuntimeSource(fetcher, dualFailure);
  compareSources(reference, runtime);
  return runtime;
}

export async function loadCfihosClassRelationshipSource(
  options: CfihosClassRelationshipRuntimeOptions = {},
): Promise<CfihosClassRelationshipSource> {
  const mode = options.mode ?? getRdlBrowserReadMode();
  const fetcher = options.fetcher ?? fetch;

  if (mode === "api") {
    return fetchClassRelationshipRuntimeSource(fetcher, classRelationshipRuntimeFailure);
  }

  const reference = options.reference ?? await loadClassRelationshipSnapshotReference();
  if (mode === "json") return reference;

  const runtime = await fetchClassRelationshipRuntimeSource(
    fetcher,
    classRelationshipDualFailure,
  );
  compareClassRelationshipSources(reference, runtime);
  return runtime;
}

export async function loadCfihosUnitOfMeasureSource(
  options: CfihosUnitOfMeasureRuntimeOptions = {},
): Promise<CfihosUnitOfMeasureSource> {
  const mode = options.mode ?? getRdlBrowserReadMode();
  const fetcher = options.fetcher ?? fetch;

  if (mode === "api") {
    return fetchUnitOfMeasureRuntimeSource(fetcher, unitOfMeasureRuntimeFailure);
  }

  const reference = options.reference ?? await loadUnitOfMeasureSnapshotReference();
  if (mode === "json") return reference;

  const runtime = await fetchUnitOfMeasureRuntimeSource(fetcher, unitOfMeasureDualFailure);
  compareUnitOfMeasureSources(reference, runtime);
  return runtime;
}


export async function loadCfihosPropertySource(
  options: CfihosPropertyRuntimeOptions = {},
): Promise<CfihosPropertySource> {
  const mode = options.mode ?? getRdlBrowserReadMode();
  const fetcher = options.fetcher ?? fetch;

  if (mode === "api") {
    return fetchPropertyRuntimeSource(fetcher, propertyRuntimeFailure);
  }

  const reference = options.reference ?? await loadPropertySnapshotReference();
  if (mode === "json") return reference;

  const runtime = await fetchPropertyRuntimeSource(fetcher, propertyDualFailure);
  comparePropertySources(reference, runtime);
  return runtime;
}


async function loadPropertySnapshotReference(): Promise<CfihosPropertySource> {
  const workbook = await loadCfihosWorkbook();
  const propertySheet = workbook.sheets[PROPERTY_SHEET];
  const tagClassSheet = workbook.sheets[TAG_CLASS_SHEET];
  const tagPropertySheet = workbook.sheets[TAG_PROPERTY_SHEET];
  const picklistValueSheet = workbook.sheets[PROPERTY_PICKLIST_VALUE_SHEET];
  if (!propertySheet || !tagClassSheet || !tagPropertySheet || !picklistValueSheet) {
    throw new RdlBrowserRuntimeReadError(
      "The CFIHOS workbook snapshot is missing one or more Property dependency worksheets.",
    );
  }

  return {
    propertyRows: propertySheet.rows,
    tagClassRows: tagClassSheet.rows,
    tagClassPropertyRows: tagPropertySheet.rows,
    picklistValueRows: picklistValueSheet.rows,
    sourceSha256: String(workbook.source.sha256 ?? "").trim() || null,
    packageKey: null,
  };
}

async function fetchPropertyRuntimeSource(
  fetcher: FetchLike,
  failure: (detail: string) => Error,
): Promise<CfihosPropertySource> {
  const params = new URLSearchParams({
    sourceKey: CFIHOS_SOURCE_KEY,
    releaseKey: CFIHOS_RELEASE_KEY,
  });
  const path = `/api/rdl-runtime/cfihos-properties?${params.toString()}`;
  const response = await fetcher(path);
  if (!response.ok) throw failure(`${path} returned HTTP ${response.status}`);

  const payload = await response.json() as RuntimePropertyResponse;
  if (payload.schemaVersion !== "rdl-cfihos-properties/v1") {
    throw failure(
      `${path} returned schema '${payload.schemaVersion}' instead of 'rdl-cfihos-properties/v1'`,
    );
  }
  if (payload.sourceKey !== CFIHOS_SOURCE_KEY || payload.releaseKey !== CFIHOS_RELEASE_KEY) {
    throw failure(`${path} returned a different source/release scope`);
  }
  if (!String(payload.packageKey ?? "").trim()) throw failure(`${path} returned no package identity`);
  if (!String(payload.contentSha256 ?? "").trim()) throw failure(`${path} returned no source content SHA-256`);
  if (!Array.isArray(payload.items)
    || !Array.isArray(payload.tagClasses)
    || !Array.isArray(payload.tagClassPropertyAssignments)
    || !Array.isArray(payload.picklistValues)) {
    throw failure(`${path} returned an invalid Property compatibility collection`);
  }

  const propertyRows = payload.items.map((item, index): CfihosWorksheetRow => {
    if (!item || typeof item !== "object" || !String(item.id ?? "").trim() || !String(item.name ?? "").trim()) {
      throw failure(`${path} returned an invalid Property item at index ${index}`);
    }
    if (String(item.sourceLocator?.sheet ?? "").trim() !== PROPERTY_SHEET) {
      throw failure(`${path} returned Property provenance outside '${PROPERTY_SHEET}'`);
    }
    const metadata = item.metadata ?? {};
    return {
      "CFIHOS unique code": item.id,
      "property name": item.name,
      "property definition": item.definition,
      "property data type": metadata.dataType,
      "property data type length": metadata.dataTypeLength,
      "unit of measure dimension code CFIHOS unique code": metadata.dimensionId,
      "unit of measure dimension code": metadata.dimensionCode,
      "property picklist name CFIHOS unique code": metadata.controlledListId,
      "property picklist name": metadata.controlledListName,
      "property existence reason description": metadata.existenceReason,
      "property synonym name": metadata.synonym,
    };
  });

  const tagClassRows = payload.tagClasses.map((item, index): CfihosWorksheetRow => {
    if (!item || typeof item !== "object" || !String(item.id ?? "").trim() || !String(item.name ?? "").trim()) {
      throw failure(`${path} returned an invalid Tag Class item at index ${index}`);
    }
    if (String(item.sourceLocator?.sheet ?? "").trim() !== TAG_CLASS_SHEET) {
      throw failure(`${path} returned Tag Class provenance outside '${TAG_CLASS_SHEET}'`);
    }
    const metadata = item.metadata ?? {};
    return {
      "CFIHOS unique code": item.id,
      "tag class name": item.name,
      "tag class definition": item.definition,
      "parent tag class name": metadata.parentName,
      "abstract class indicator": metadata.abstract,
      "tag number format": metadata.tagNumberFormat,
      "equipment expected to be installed indicator": metadata.equipmentExpectedInstalled,
      "tag class existence reason description": metadata.existenceReason,
      "tag class synonym": metadata.synonym,
    };
  });

  const tagClassPropertyRows = payload.tagClassPropertyAssignments.map((item, index): CfihosWorksheetRow => {
    if (!item || typeof item !== "object" || !String(item.tagClassId ?? "").trim() || !String(item.propertyId ?? "").trim()) {
      throw failure(`${path} returned an invalid Tag Class Property assignment at index ${index}`);
    }
    if (String(item.sourceLocator?.sheet ?? "").trim() !== TAG_PROPERTY_SHEET) {
      throw failure(`${path} returned Tag Class Property provenance outside '${TAG_PROPERTY_SHEET}'`);
    }
    return {
      "tag class CFIHOS unique code": item.tagClassId,
      "tag class name": item.tagClassName,
      "property CFIHOS unique code": item.propertyId,
      "property name": item.propertyName,
      "SI unit of measure CFIHOS unique code": item.siUnitId,
      "SI unit of measure name": item.siUnitName,
      "imperial unit of measure CFIHOS unique code": item.imperialUnitId,
      "imperial unit of measure name": item.imperialUnitName,
    };
  });

  const picklistValueRows = payload.picklistValues.map((item, index): CfihosWorksheetRow => {
    if (!item || typeof item !== "object" || !String(item.picklistId ?? "").trim() || !String(item.id ?? "").trim()) {
      throw failure(`${path} returned an invalid Property picklist value at index ${index}`);
    }
    if (String(item.sourceLocator?.sheet ?? "").trim() !== PROPERTY_PICKLIST_VALUE_SHEET) {
      throw failure(`${path} returned Property picklist provenance outside '${PROPERTY_PICKLIST_VALUE_SHEET}'`);
    }
    return {
      "property picklist CFIHOS unique code": item.picklistId,
      "property picklist name": item.picklistName,
      "property picklist value CFIHOS unique code": item.id,
      "property picklist value code": item.code,
      "property picklist value description": item.description,
      "Source standard CFIHOS unique code": item.sourceStandardId,
      "source standard code": item.sourceStandardCode,
    };
  });

  return {
    propertyRows,
    tagClassRows,
    tagClassPropertyRows,
    picklistValueRows,
    sourceSha256: payload.contentSha256,
    packageKey: payload.packageKey,
  };
}

function comparePropertySources(reference: CfihosPropertySource, runtime: CfihosPropertySource) {
  if (reference.sourceSha256 && runtime.sourceSha256 !== reference.sourceSha256) {
    throw propertyDualMismatch(
      `source SHA expected=${reference.sourceSha256} actual=${runtime.sourceSha256 ?? "missing"}`,
    );
  }
  if (stableJson(normalizePropertyRows(reference.propertyRows)) !== stableJson(normalizePropertyRows(runtime.propertyRows))) {
    throw propertyDualMismatch("Property row semantics differ");
  }
  if (stableJson(normalizeTagClassRows(reference.tagClassRows)) !== stableJson(normalizeTagClassRows(runtime.tagClassRows))) {
    throw propertyDualMismatch("Tag Class dependency semantics differ");
  }
  if (stableJson(normalizeTagClassPropertyRows(reference.tagClassPropertyRows)) !== stableJson(normalizeTagClassPropertyRows(runtime.tagClassPropertyRows))) {
    throw propertyDualMismatch("Tag Class Property assignment semantics differ");
  }
  if (stableJson(normalizePicklistValueRows(reference.picklistValueRows)) !== stableJson(normalizePicklistValueRows(runtime.picklistValueRows))) {
    throw propertyDualMismatch("Property picklist value semantics differ");
  }
}

function normalizePropertyRows(rows: CfihosWorksheetRow[]) {
  return rows.map((row) => ({
    id: text(row["CFIHOS unique code"]),
    name: text(row["property name"]),
    definition: nullableText(row["property definition"]),
    dataType: nullableText(row["property data type"]),
    dataTypeLength: nullableText(row["property data type length"]),
    dimensionId: nullableText(row["unit of measure dimension code CFIHOS unique code"]),
    dimensionCode: nullableText(row["unit of measure dimension code"]),
    picklistId: nullableText(row["property picklist name CFIHOS unique code"]),
    picklistName: nullableText(row["property picklist name"]),
    existenceReason: nullableText(row["property existence reason description"]),
    synonyms: normalizeDelimited(row["property synonym name"]),
  })).filter((row) => row.id && row.name);
}

function normalizeTagClassRows(rows: CfihosWorksheetRow[]) {
  return rows.map((row) => ({
    id: text(row["CFIHOS unique code"]),
    name: text(row["tag class name"]),
    definition: nullableText(row["tag class definition"]),
    parentName: nullableText(row["parent tag class name"]),
    abstract: normalizeIndicator(row["abstract class indicator"]),
    tagNumberFormat: nullableText(row["tag number format"]),
    equipmentExpected: normalizeIndicator(row["equipment expected to be installed indicator"]),
    existenceReason: nullableText(row["tag class existence reason description"]),
    synonyms: normalizeDelimited(row["tag class synonym"]),
  })).filter((row) => row.id && row.name);
}

function normalizeTagClassPropertyRows(rows: CfihosWorksheetRow[]) {
  return rows.map((row) => ({
    tagClassId: text(row["tag class CFIHOS unique code"]),
    tagClassName: text(row["tag class name"]),
    propertyId: text(row["property CFIHOS unique code"]),
    propertyName: text(row["property name"]),
    siUnitId: nullableText(row["SI unit of measure CFIHOS unique code"]),
    siUnitName: nullableText(row["SI unit of measure name"]),
    imperialUnitId: nullableText(row["imperial unit of measure CFIHOS unique code"]),
    imperialUnitName: nullableText(row["imperial unit of measure name"]),
  })).filter((row) => row.tagClassId && row.propertyId);
}

function normalizePicklistValueRows(rows: CfihosWorksheetRow[]) {
  return rows.map((row) => ({
    picklistId: text(row["property picklist CFIHOS unique code"]),
    picklistName: text(row["property picklist name"]),
    id: text(row["property picklist value CFIHOS unique code"]),
    code: text(row["property picklist value code"]),
    description: nullableText(row["property picklist value description"]),
    sourceStandardId: nullableText(row["Source standard CFIHOS unique code"]),
    sourceStandardCode: nullableText(row["source standard code"]),
  })).filter((row) => row.picklistId && row.id);
}

function normalizeIndicator(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLowerCase();
  return normalized === "yes" || normalized === "true" || normalized === "1" || normalized === "y";
}

async function loadUnitOfMeasureSnapshotReference(): Promise<CfihosUnitOfMeasureSource> {
  const workbook = await loadCfihosWorkbook();
  const unitSheet = workbook.sheets[UNIT_OF_MEASURE_SHEET];
  const tagPropertySheet = workbook.sheets[TAG_PROPERTY_SHEET];
  const equipmentPropertySheet = workbook.sheets[EQUIPMENT_PROPERTY_SHEET];
  const propertySheet = workbook.sheets[PROPERTY_SHEET];
  if (!unitSheet || !tagPropertySheet || !equipmentPropertySheet || !propertySheet) {
    throw new RdlBrowserRuntimeReadError(
      "The CFIHOS workbook snapshot is missing one or more Unit of Measure dependency worksheets.",
    );
  }

  return {
    unitRows: unitSheet.rows,
    tagPropertyRows: tagPropertySheet.rows,
    equipmentPropertyRows: equipmentPropertySheet.rows,
    propertyRows: propertySheet.rows,
    sourceSha256: String(workbook.source.sha256 ?? "").trim() || null,
    packageKey: null,
  };
}

async function fetchUnitOfMeasureRuntimeSource(
  fetcher: FetchLike,
  failure: (detail: string) => Error,
): Promise<CfihosUnitOfMeasureSource> {
  const params = new URLSearchParams({
    sourceKey: CFIHOS_SOURCE_KEY,
    releaseKey: CFIHOS_RELEASE_KEY,
  });
  const path = `/api/rdl-runtime/cfihos-units-of-measure?${params.toString()}`;
  const response = await fetcher(path);
  if (!response.ok) throw failure(`${path} returned HTTP ${response.status}`);

  const payload = await response.json() as RuntimeUnitOfMeasureResponse;
  if (payload.schemaVersion !== "rdl-cfihos-units-of-measure/v1") {
    throw failure(
      `${path} returned schema '${payload.schemaVersion}' instead of 'rdl-cfihos-units-of-measure/v1'`,
    );
  }
  if (payload.sourceKey !== CFIHOS_SOURCE_KEY || payload.releaseKey !== CFIHOS_RELEASE_KEY) {
    throw failure(`${path} returned a different source/release scope`);
  }
  if (!String(payload.packageKey ?? "").trim()) {
    throw failure(`${path} returned no package identity`);
  }
  if (!String(payload.contentSha256 ?? "").trim()) {
    throw failure(`${path} returned no source content SHA-256`);
  }
  if (
    !Array.isArray(payload.items)
    || !Array.isArray(payload.tagPropertyReferences)
    || !Array.isArray(payload.equipmentPropertyReferences)
    || !Array.isArray(payload.propertyDimensionReferences)
  ) {
    throw failure(`${path} returned an invalid Unit of Measure compatibility collection`);
  }

  const unitRows = payload.items.map((item, index): CfihosWorksheetRow => {
    if (!item || typeof item !== "object") {
      throw failure(`${path} returned an invalid Unit of Measure item at index ${index}`);
    }
    if (!String(item.id ?? "").trim() || !String(item.name ?? "").trim()) {
      throw failure(`${path} returned an incomplete Unit of Measure identity at index ${index}`);
    }
    const sheet = String(item.sourceLocator?.sheet ?? "").trim();
    if (sheet !== UNIT_OF_MEASURE_SHEET) {
      throw failure(`${path} returned Unit of Measure provenance from sheet '${sheet || "missing"}'`);
    }
    const metadata = item.metadata ?? {};
    return {
      "CFIHOS unique code": item.id,
      "UNECE code": metadata.uneceCode,
      "unit of measure name": item.name,
      "unit of measure symbol": metadata.symbol,
      "unit of measure dimension code CFIHOS unique code": metadata.dimensionId,
      "unit of measure dimension code": metadata.dimensionCode,
      "unit of measure dimension name": metadata.dimensionName,
      "measurement system code CFIHOS unique code": metadata.measurementSystemId,
      "measurement system code": metadata.measurementSystemCode,
      "measurement system name": metadata.measurementSystemName,
      "unit of measure synonym name": metadata.synonym,
    };
  });

  const tagPropertyRows = payload.tagPropertyReferences.map((item, index): CfihosWorksheetRow => {
    assertRuntimeReference(item, TAG_PROPERTY_SHEET, path, `tag property reference ${index}`, failure);
    return {
      "SI unit of measure CFIHOS unique code": item.siUnitId,
      "imperial unit of measure CFIHOS unique code": item.imperialUnitId,
    };
  });
  const equipmentPropertyRows = payload.equipmentPropertyReferences.map((item, index): CfihosWorksheetRow => {
    assertRuntimeReference(item, EQUIPMENT_PROPERTY_SHEET, path, `equipment property reference ${index}`, failure);
    return {
      "SI unit of measure CFIHOS unique code": item.siUnitId,
      "imperial unit of measure CFIHOS unique code": item.imperialUnitId,
    };
  });
  const propertyRows = payload.propertyDimensionReferences.map((item, index): CfihosWorksheetRow => {
    if (!item || typeof item !== "object") {
      throw failure(`${path} returned an invalid property dimension reference at index ${index}`);
    }
    const sheet = String(item.sourceLocator?.sheet ?? "").trim();
    if (sheet !== PROPERTY_SHEET) {
      throw failure(`${path} returned property dimension provenance from sheet '${sheet || "missing"}'`);
    }
    return {
      "unit of measure dimension code CFIHOS unique code": item.dimensionId,
    };
  });

  return {
    unitRows,
    tagPropertyRows,
    equipmentPropertyRows,
    propertyRows,
    sourceSha256: payload.contentSha256,
    packageKey: payload.packageKey,
  };
}

function assertRuntimeReference(
  item: RuntimeUnitPropertyReference,
  expectedSheet: string,
  path: string,
  label: string,
  failure: (detail: string) => Error,
) {
  if (!item || typeof item !== "object") {
    throw failure(`${path} returned an invalid ${label}`);
  }
  const sheet = String(item.sourceLocator?.sheet ?? "").trim();
  if (sheet !== expectedSheet) {
    throw failure(`${path} returned ${label} provenance from sheet '${sheet || "missing"}'`);
  }
}

function compareUnitOfMeasureSources(
  reference: CfihosUnitOfMeasureSource,
  runtime: CfihosUnitOfMeasureSource,
) {
  if (reference.sourceSha256 && runtime.sourceSha256 !== reference.sourceSha256) {
    throw unitOfMeasureDualMismatch(
      `source SHA expected=${reference.sourceSha256} actual=${runtime.sourceSha256 ?? "missing"}`,
    );
  }
  if (stableJson(normalizeUnitRows(reference.unitRows)) !== stableJson(normalizeUnitRows(runtime.unitRows))) {
    throw unitOfMeasureDualMismatch("Unit of Measure row semantics differ");
  }
  if (stableJson(normalizeUnitReferences(reference.tagPropertyRows)) !== stableJson(normalizeUnitReferences(runtime.tagPropertyRows))) {
    throw unitOfMeasureDualMismatch("Tag Class property Unit of Measure references differ");
  }
  if (stableJson(normalizeUnitReferences(reference.equipmentPropertyRows)) !== stableJson(normalizeUnitReferences(runtime.equipmentPropertyRows))) {
    throw unitOfMeasureDualMismatch("Equipment Class property Unit of Measure references differ");
  }
  if (stableJson(normalizePropertyDimensions(reference.propertyRows)) !== stableJson(normalizePropertyDimensions(runtime.propertyRows))) {
    throw unitOfMeasureDualMismatch("Property dimension references differ");
  }
}

function normalizeUnitRows(rows: CfihosWorksheetRow[]) {
  return rows
    .map((row) => ({
      id: text(rowValue(row, ["CFIHOS unique code", "unit of measure CFIHOS unique code"])),
      uneceCommonCode: nullableText(rowValue(row, ["UNECE code", "UNECE Common Code", "UNECE common code"])),
      name: text(rowValue(row, ["unit of measure name"])),
      symbol: nullableText(rowValue(row, ["unit of measure symbol"])),
      dimensionId: nullableText(rowValue(row, ["unit of measure dimension code CFIHOS unique code", "unit of measure dimension CFIHOS unique code"])),
      dimensionCode: nullableText(rowValue(row, ["unit of measure dimension code"])),
      dimensionName: nullableText(rowValue(row, ["unit of measure dimension name"])),
      systemId: nullableText(rowValue(row, ["measurement system code CFIHOS unique code", "unit of measure system CFIHOS unique code", "unit of measure system code CFIHOS unique code"])),
      systemCode: nullableText(rowValue(row, ["measurement system code", "unit of measure system code", "unit of measure system"])),
      systemName: nullableText(rowValue(row, ["measurement system name", "unit of measure system name"])),
      synonyms: normalizeDelimited(rowValue(row, ["unit of measure synonym name"])),
    }))
    .filter((row) => row.id && row.name)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeUnitReferences(rows: CfihosWorksheetRow[]) {
  return rows
    .map((row) => ({
      siUnitId: nullableText(rowValue(row, ["SI unit of measure CFIHOS unique code"])),
      imperialUnitId: nullableText(rowValue(row, ["imperial unit of measure CFIHOS unique code"])),
    }))
    .filter((row) => row.siUnitId || row.imperialUnitId)
    .sort((a, b) =>
      String(a.siUnitId ?? "").localeCompare(String(b.siUnitId ?? ""))
      || String(a.imperialUnitId ?? "").localeCompare(String(b.imperialUnitId ?? ""))
    );
}

function normalizePropertyDimensions(rows: CfihosWorksheetRow[]) {
  return rows
    .map((row) => nullableText(rowValue(row, ["unit of measure dimension code CFIHOS unique code"])))
    .filter((value): value is string => Boolean(value))
    .sort();
}

function normalizeDelimited(value: unknown): string[] {
  const raw = text(value);
  if (!raw) return [];
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  return raw.split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
}

function rowValue(row: CfihosWorksheetRow, candidates: string[]): unknown {
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, candidate)) return row[candidate];
  }
  const normalizedCandidates = new Set(candidates.map(normalizeHeader));
  for (const [key, value] of Object.entries(row)) {
    if (normalizedCandidates.has(normalizeHeader(key))) return value;
  }
  return null;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function loadClassRelationshipSnapshotReference(): Promise<CfihosClassRelationshipSource> {
  const workbook = await loadCfihosWorkbook();
  const sheet = workbook.sheets[CLASS_RELATIONSHIP_SHEET];
  if (!sheet) {
    throw new RdlBrowserRuntimeReadError(
      `The worksheet '${CLASS_RELATIONSHIP_SHEET}' was not found in the CFIHOS workbook snapshot.`,
    );
  }

  return {
    rows: sheet.rows,
    sourceSha256: String(workbook.source.sha256 ?? "").trim() || null,
    packageKey: null,
  };
}

async function fetchClassRelationshipRuntimeSource(
  fetcher: FetchLike,
  failure: (detail: string) => Error,
): Promise<CfihosClassRelationshipSource> {
  const params = new URLSearchParams({
    sourceKey: CFIHOS_SOURCE_KEY,
    releaseKey: CFIHOS_RELEASE_KEY,
  });
  const path = `/api/rdl-runtime/cfihos-class-relationships?${params.toString()}`;
  const response = await fetcher(path);
  if (!response.ok) throw failure(`${path} returned HTTP ${response.status}`);

  const payload = await response.json() as RuntimeClassRelationshipResponse;
  if (payload.schemaVersion !== "rdl-cfihos-class-relationships/v1") {
    throw failure(
      `${path} returned schema '${payload.schemaVersion}' instead of 'rdl-cfihos-class-relationships/v1'`,
    );
  }
  if (payload.sourceKey !== CFIHOS_SOURCE_KEY || payload.releaseKey !== CFIHOS_RELEASE_KEY) {
    throw failure(`${path} returned a different source/release scope`);
  }
  if (!String(payload.packageKey ?? "").trim()) {
    throw failure(`${path} returned no package identity`);
  }
  if (!String(payload.contentSha256 ?? "").trim()) {
    throw failure(`${path} returned no source content SHA-256`);
  }
  if (!Array.isArray(payload.items)) {
    throw failure(`${path} returned an invalid item collection`);
  }

  const rows = payload.items.map((item, index): CfihosWorksheetRow => {
    if (!item || typeof item !== "object") {
      throw failure(`${path} returned an invalid class relationship item at index ${index}`);
    }
    if (
      !String(item.tagClassId ?? "").trim()
      || !String(item.tagClassName ?? "").trim()
      || !String(item.equipmentClassId ?? "").trim()
      || !String(item.equipmentClassName ?? "").trim()
    ) {
      throw failure(`${path} returned an incomplete class relationship identity at index ${index}`);
    }
    const sheet = String(item.sourceLocator?.sheet ?? "").trim();
    if (sheet !== CLASS_RELATIONSHIP_SHEET) {
      throw failure(
        `${path} returned class relationship provenance from sheet '${sheet || "missing"}'`,
      );
    }

    return {
      "tag class CFIHOS unique code": item.tagClassId,
      "tag class name": item.tagClassName,
      "equipment class CFIHOS unique code": item.equipmentClassId,
      "equipment class name": item.equipmentClassName,
      "tag or equipment class relationship reason for mapping": item.mappingReason,
    };
  });

  return {
    rows,
    sourceSha256: payload.contentSha256,
    packageKey: payload.packageKey,
  };
}

function compareClassRelationshipSources(
  reference: CfihosClassRelationshipSource,
  runtime: CfihosClassRelationshipSource,
) {
  if (reference.sourceSha256 && runtime.sourceSha256 !== reference.sourceSha256) {
    throw classRelationshipDualMismatch(
      `source SHA expected=${reference.sourceSha256} actual=${runtime.sourceSha256 ?? "missing"}`,
    );
  }

  const expectedRows = normalizeClassRelationshipRows(reference.rows);
  const actualRows = normalizeClassRelationshipRows(runtime.rows);
  if (stableJson(expectedRows) !== stableJson(actualRows)) {
    throw classRelationshipDualMismatch("tag/equipment relationship row semantics differ");
  }
}

function normalizeClassRelationshipRows(rows: CfihosWorksheetRow[]) {
  return rows
    .map((row) => ({
      tagClassId: text(row["tag class CFIHOS unique code"]),
      tagClassName: text(row["tag class name"]),
      equipmentClassId: text(row["equipment class CFIHOS unique code"]),
      equipmentClassName: text(row["equipment class name"]),
      mappingReason: nullableText(
        row["tag or equipment class relationship reason for mapping"],
      ),
    }))
    .filter((row) => row.tagClassId && row.equipmentClassId)
    .sort((a, b) =>
      a.tagClassId.localeCompare(b.tagClassId)
      || a.equipmentClassId.localeCompare(b.equipmentClassId)
      || String(a.mappingReason ?? "").localeCompare(String(b.mappingReason ?? ""))
    );
}

async function loadSnapshotReference(): Promise<CfihosHandoverEventSource> {
  const [workbook, relationships] = await Promise.all([
    loadCfihosWorkbook(),
    cfihosDocumentRepository.getRelationships(),
  ]);
  const sheet = workbook.sheets[HANDOVER_EVENT_SHEET];
  if (!sheet) {
    throw new RdlBrowserRuntimeReadError(
      `The worksheet '${HANDOVER_EVENT_SHEET}' was not found in the CFIHOS workbook snapshot.`,
    );
  }

  return {
    rows: sheet.rows,
    lifecycleRelationshipCount: relationships.length,
    lifecycleRelationshipsWithAnyStatusCount: relationships.filter(hasAnyLifecycleStatus).length,
    sourceSha256: String(workbook.source.sha256 ?? "").trim() || null,
    packageKey: null,
  };
}

async function fetchRuntimeSource(
  fetcher: FetchLike,
  failure: (detail: string) => Error,
): Promise<CfihosHandoverEventSource> {
  const params = new URLSearchParams({
    sourceKey: CFIHOS_SOURCE_KEY,
    releaseKey: CFIHOS_RELEASE_KEY,
  });
  const path = `/api/rdl-runtime/cfihos-handover-events?${params.toString()}`;
  const response = await fetcher(path);
  if (!response.ok) throw failure(`${path} returned HTTP ${response.status}`);

  const payload = await response.json() as RuntimeHandoverResponse;
  if (payload.schemaVersion !== "rdl-cfihos-handover-events/v1") {
    throw failure(
      `${path} returned schema '${payload.schemaVersion}' instead of 'rdl-cfihos-handover-events/v1'`,
    );
  }
  if (payload.sourceKey !== CFIHOS_SOURCE_KEY || payload.releaseKey !== CFIHOS_RELEASE_KEY) {
    throw failure(`${path} returned a different source/release scope`);
  }
  if (!String(payload.packageKey ?? "").trim()) {
    throw failure(`${path} returned no package identity`);
  }
  if (!String(payload.contentSha256 ?? "").trim()) {
    throw failure(`${path} returned no source content SHA-256`);
  }
  if (!Array.isArray(payload.items)) {
    throw failure(`${path} returned an invalid item collection`);
  }
  assertCount(payload.lifecycleRelationshipCount, "lifecycleRelationshipCount", failure);
  assertCount(
    payload.lifecycleRelationshipsWithAnyStatusCount,
    "lifecycleRelationshipsWithAnyStatusCount",
    failure,
  );
  if (payload.lifecycleRelationshipsWithAnyStatusCount > payload.lifecycleRelationshipCount) {
    throw failure(`${path} returned a lifecycle status count greater than its relationship count`);
  }

  const rows = payload.items.map((item, index): CfihosWorksheetRow => {
    if (!item || typeof item !== "object") {
      throw failure(`${path} returned an invalid handover item at index ${index}`);
    }
    if (!String(item.id ?? "").trim() || !String(item.name ?? "").trim()) {
      throw failure(`${path} returned an incomplete handover identity at index ${index}`);
    }
    const sheet = String(item.sourceLocator?.sheet ?? "").trim();
    if (sheet !== HANDOVER_EVENT_SHEET) {
      throw failure(`${path} returned handover provenance from sheet '${sheet || "missing"}'`);
    }
    return {
      "CFIHOS unique code": item.id,
      "handover event name": item.name,
      "handover event description": item.description,
      "handover event reporting sequence number": item.reportingSequence,
    };
  });

  return {
    rows,
    lifecycleRelationshipCount: payload.lifecycleRelationshipCount,
    lifecycleRelationshipsWithAnyStatusCount: payload.lifecycleRelationshipsWithAnyStatusCount,
    sourceSha256: payload.contentSha256,
    packageKey: payload.packageKey,
  };
}

function compareSources(
  reference: CfihosHandoverEventSource,
  runtime: CfihosHandoverEventSource,
) {
  if (reference.sourceSha256 && runtime.sourceSha256 !== reference.sourceSha256) {
    throw dualMismatch(
      `source SHA expected=${reference.sourceSha256} actual=${runtime.sourceSha256 ?? "missing"}`,
    );
  }
  if (reference.lifecycleRelationshipCount !== runtime.lifecycleRelationshipCount) {
    throw dualMismatch(
      `lifecycle relationship count expected=${reference.lifecycleRelationshipCount} actual=${runtime.lifecycleRelationshipCount}`,
    );
  }
  if (
    reference.lifecycleRelationshipsWithAnyStatusCount
    !== runtime.lifecycleRelationshipsWithAnyStatusCount
  ) {
    throw dualMismatch(
      `lifecycle relationship status count expected=${reference.lifecycleRelationshipsWithAnyStatusCount} actual=${runtime.lifecycleRelationshipsWithAnyStatusCount}`,
    );
  }

  const expectedRows = normalizeRows(reference.rows);
  const actualRows = normalizeRows(runtime.rows);
  if (stableJson(expectedRows) !== stableJson(actualRows)) {
    throw dualMismatch("handover event row semantics differ");
  }
}

function normalizeRows(rows: CfihosWorksheetRow[]) {
  return rows
    .map((row) => ({
      id: text(row["CFIHOS unique code"]),
      name: text(row["handover event name"]),
      description: nullableText(row["handover event description"]),
      reportingSequence: nullableNumber(row["handover event reporting sequence number"]),
    }))
    .sort((a, b) => a.id.localeCompare(b.id) || a.name.localeCompare(b.name));
}

function hasAnyLifecycleStatus(relationship: {
  requiredStatusDetailedEngineering?: string | null;
  requiredStatusConstruction?: string | null;
  requiredStatusCommissioning?: string | null;
  requiredStatusStartup?: string | null;
  requiredStatusOperations?: string | null;
}) {
  return Boolean(
    relationship.requiredStatusDetailedEngineering
      || relationship.requiredStatusConstruction
      || relationship.requiredStatusCommissioning
      || relationship.requiredStatusStartup
      || relationship.requiredStatusOperations,
  );
}

function assertCount(value: unknown, name: string, failure: (detail: string) => Error) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw failure(`${name} is not a non-negative integer`);
  }
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const result = text(value);
  return result || null;
}

function nullableNumber(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}


function propertyDualMismatch(detail: string) {
  const error = new RdlBrowserDualReadError(
    `CFIHOS Property dual-read mismatch: ${detail}`,
  );
  console.error(error.message);
  return error;
}

function propertyDualFailure(detail: string) {
  const error = new RdlBrowserDualReadError(
    `CFIHOS Property dual-read could not confirm PostgreSQL parity: ${detail}`,
  );
  console.error(error.message);
  return error;
}

function propertyRuntimeFailure(detail: string) {
  const error = new RdlBrowserRuntimeReadError(
    `CFIHOS Property runtime API read failed: ${detail}`,
  );
  console.error(error.message);
  return error;
}

function unitOfMeasureDualMismatch(detail: string) {
  const error = new RdlBrowserDualReadError(
    `CFIHOS Unit of Measure dual-read mismatch: ${detail}`,
  );
  console.error(error.message);
  return error;
}

function unitOfMeasureDualFailure(detail: string) {
  const error = new RdlBrowserDualReadError(
    `CFIHOS Unit of Measure dual-read could not confirm PostgreSQL parity: ${detail}`,
  );
  console.error(error.message);
  return error;
}

function unitOfMeasureRuntimeFailure(detail: string) {
  const error = new RdlBrowserRuntimeReadError(
    `CFIHOS Unit of Measure runtime API read failed: ${detail}`,
  );
  console.error(error.message);
  return error;
}

function classRelationshipDualMismatch(detail: string) {
  const error = new RdlBrowserDualReadError(
    `CFIHOS Class Relationship dual-read mismatch: ${detail}`,
  );
  console.error(error.message);
  return error;
}

function classRelationshipDualFailure(detail: string) {
  const error = new RdlBrowserDualReadError(
    `CFIHOS Class Relationship dual-read could not confirm PostgreSQL parity: ${detail}`,
  );
  console.error(error.message);
  return error;
}

function classRelationshipRuntimeFailure(detail: string) {
  const error = new RdlBrowserRuntimeReadError(
    `CFIHOS Class Relationship runtime API read failed: ${detail}`,
  );
  console.error(error.message);
  return error;
}

function dualMismatch(detail: string) {
  const error = new RdlBrowserDualReadError(
    `CFIHOS Handover Event dual-read mismatch: ${detail}`,
  );
  console.error(error.message);
  return error;
}

function dualFailure(detail: string) {
  const error = new RdlBrowserDualReadError(
    `CFIHOS Handover Event dual-read could not confirm PostgreSQL parity: ${detail}`,
  );
  console.error(error.message);
  return error;
}

function runtimeFailure(detail: string) {
  const error = new RdlBrowserRuntimeReadError(
    `CFIHOS Handover Event runtime API read failed: ${detail}`,
  );
  console.error(error.message);
  return error;
}
