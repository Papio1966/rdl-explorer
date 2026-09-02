import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const SNAPSHOT = new URL("../public/cfihos-workbook.json", import.meta.url);
const workbook = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const sheets = workbook.sheets as Record<string, { rows: Record<string, unknown>[] }>;
const rows = (name: string) => sheets[name]?.rows ?? [];
const text = (value: unknown) => value == null ? "" : String(value).trim();
const sql = (value: unknown) => `'${String(value ?? "").replaceAll("'", "''")}'`;
const jsonSql = (value: unknown) => `${sql(JSON.stringify(value))}::jsonb`;
const bool = (value: unknown) => ["yes", "true", "1"].includes(text(value).toLowerCase());
const normalizedKey = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
const first = (row: Record<string, unknown>, candidates: string[]) => {
  for (const candidate of candidates) {
    const value = text(row[candidate]);
    if (value) return value;
  }
  const keys = new Map(Object.keys(row).map((key) => [normalizedKey(key), key]));
  for (const candidate of candidates) {
    const actual = keys.get(normalizedKey(candidate));
    if (!actual) continue;
    const value = text(row[actual]);
    if (value) return value;
  }
  return "";
};
const containing = (row: Record<string, unknown>, tokens: string[]) => {
  const wanted = tokens.map(normalizedKey);
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizedKey(key);
    if (wanted.every((token) => normalized.includes(token)) && text(value)) return text(value);
  }
  return "";
};
const sourceSha = text(workbook.source?.sha256) || createHash("sha256").update(readFileSync(SNAPSHOT)).digest("hex");

const sourceKey = "cfihos";
const releaseKey = "cfihos-2.0";
const packageKey = `cfihos-2.0-${sourceSha.slice(0, 12)}`;

const out: string[] = [];
const emit = (s = "") => out.push(s);

emit("\\set ON_ERROR_STOP on");
emit("BEGIN;");
emit(`INSERT INTO rdl.rdl_source (source_key, name, description, publisher, authoritative_uri, status) VALUES (${sql(sourceKey)}, 'CFIHOS', 'Capital Facilities Information Handover Specification', 'CFIHOS', ${sql(workbook.source?.url ?? "")}, 'active') ON CONFLICT (source_key) DO UPDATE SET name = EXCLUDED.name, authoritative_uri = EXCLUDED.authoritative_uri, updated_at = now();`);
emit(`INSERT INTO rdl.rdl_release (source_id, release_key, version_label, release_status, notes) SELECT source_id, ${sql(releaseKey)}, '2.0', 'published', 'Reviewed CFIHOS 2.0 snapshot used by RDL Explorer.' FROM rdl.rdl_source WHERE source_key = ${sql(sourceKey)} ON CONFLICT (source_id, release_key) DO UPDATE SET version_label = EXCLUDED.version_label, release_status = EXCLUDED.release_status;`);
emit(`INSERT INTO rdl.rdl_package (release_id, package_key, package_kind, package_status, source_uri, content_sha256, manifest, validated_at) SELECT release_id, ${sql(packageKey)}, 'normalized', 'validated', ${sql(workbook.source?.url ?? "")}, ${sql(sourceSha)}, ${jsonSql({ schema: workbook.schema, generatedAt: workbook.source?.generatedAt, sourceSha256: sourceSha })}, now() FROM rdl.rdl_release r JOIN rdl.rdl_source s ON s.source_id=r.source_id WHERE s.source_key=${sql(sourceKey)} AND r.release_key=${sql(releaseKey)} ON CONFLICT (package_key) DO UPDATE SET package_status='validated', source_uri=EXCLUDED.source_uri, content_sha256=EXCLUDED.content_sha256, manifest=EXCLUDED.manifest, validated_at=now();`);
emit(`DELETE FROM rdl.rdl_relationship WHERE package_id=(SELECT package_id FROM rdl.rdl_package WHERE package_key=${sql(packageKey)});`);
emit(`DELETE FROM rdl.rdl_entity WHERE package_id=(SELECT package_id FROM rdl.rdl_package WHERE package_key=${sql(packageKey)});`);
emit(`DELETE FROM ingestion.ingestion_run WHERE package_id=(SELECT package_id FROM rdl.rdl_package WHERE package_key=${sql(packageKey)});`);

function entity(type: string, nativeId: string, name: string, definition: string, metadata: Record<string, unknown>, sheet: string, rowIndex: number) {
  if (!nativeId || !name) return;
  emit(`INSERT INTO rdl.rdl_entity (package_id, entity_type_code, native_identifier, name, definition, lifecycle_status, is_authoritative, normalized_metadata, source_locator) SELECT package_id, ${sql(type)}, ${sql(nativeId)}, ${sql(name)}, ${definition ? sql(definition) : "NULL"}, 'active', true, ${jsonSql(metadata)}, ${jsonSql({ sheet, row: rowIndex + 2 })} FROM rdl.rdl_package WHERE package_key=${sql(packageKey)} ON CONFLICT (package_id, entity_type_code, native_identifier) DO UPDATE SET name=EXCLUDED.name, definition=EXCLUDED.definition, normalized_metadata=EXCLUDED.normalized_metadata, source_locator=EXCLUDED.source_locator;`);
}

rows("tag class").forEach((r, i) => entity("tag_class", text(r["CFIHOS unique code"]), text(r["tag class name"]), text(r["tag class definition"]), {
  abstract: bool(r["abstract class indicator"]), parentName: text(r["parent tag class name"]), tagNumberFormat: text(r["tag number format"]),
  equipmentExpectedInstalled: text(r["equipment expected to be installed indicator"]), synonym: text(r["tag class synonym"]),
  existenceReason: first(r,["tag class existence reason","existence reason"]) || containing(r,["existence","reason"]),
}, "tag class", i));
rows("equipment class").forEach((r, i) => entity("equipment_class", text(r["equipment class CFIHOS unique code"]), text(r["equipment class name"]), text(r["equipment class definition"]), {
  abstract: bool(r["abstract class indicator"]), parentName: text(r["parent equipment class name"]), sparePartInformationRequired: text(r["spare part information required indicator"]),
  synonym: text(r["equipment class synonym name"]), existenceReason: first(r,["equipment class existence reason","existence reason"]) || containing(r,["existence","reason"]),
}, "equipment class", i));
rows("property").forEach((r, i) => entity("property", text(r["CFIHOS unique code"]), text(r["property name"]), text(r["property definition"]), {
  dataType: text(r["property data type"]), dataTypeLength: text(r["property data type length"]), dimensionId: text(r["unit of measure dimension code CFIHOS unique code"]),
  dimensionCode: text(r["unit of measure dimension code"]), dimensionName: text(r["unit of measure dimension name"]), controlledListId: text(r["property picklist name CFIHOS unique code"]),
  controlledListName: text(r["property picklist name"]), synonym: text(r["property synonym name"]), existenceReason: first(r,["property existence reason","existence reason"]) || containing(r,["existence","reason"]),
}, "property", i));
rows("document type").forEach((r, i) => entity("document_type", text(r["CFIHOS unique code"]), text(r["document type name"]), text(r["document type description"]), { shortCode: text(r["document type short code"]), classification: text(r["document type classification"]), synonym: text(r["document type synonym name"]) }, "document type", i));
rows("discipline").forEach((r, i) => entity("discipline", text(r["CFIHOS unique code"]), text(r["discipline name"]), text(r["discipline description"]), { code: text(r["discipline code"]) }, "discipline", i));
rows("unit of measure").forEach((r, i) => entity("unit_of_measure", text(r["CFIHOS unique code"]), text(r["unit of measure name"]), text(r["unit of measure description"]), {
  uneceCode: text(r["UNECE code"]), symbol: text(r["unit of measure symbol"]), dimensionId: text(r["unit of measure dimension code CFIHOS unique code"]),
  dimensionCode: text(r["unit of measure dimension code"]), dimensionName: text(r["unit of measure dimension name"]), measurementSystemId: text(r["measurement system code CFIHOS unique code"]),
  measurementSystemCode: text(r["measurement system code"]), measurementSystemName: text(r["measurement system name"]), synonym: text(r["unit of measure synonym name"]),
}, "unit of measure", i));
rows("source standard").forEach((r, i) => entity("source_standard", text(r["CFIHOS unique code"]), text(r["source standard code"]), text(r["source standard description"]), { incomplete: text(r["source standard still to be completed indicator"]) }, "source standard", i));
rows("handover event").forEach((r, i) => entity("handover_event", text(r["CFIHOS unique code"]), text(r["handover event name"]), text(r["handover event description"]), { sequence: text(r["handover event reporting sequence number"]) }, "handover event", i));

const controlledLists = new Map<string, string>();
rows("property picklist values").forEach((r) => { const id=text(r["property picklist CFIHOS unique code"]); if(id) controlledLists.set(id, text(r["property picklist name"])); });
[...controlledLists].forEach(([id, name], i) => entity("controlled_list", id, name || id, "", {}, "property picklist values", i));
rows("property picklist values").forEach((r, i) => entity("controlled_value", text(r["property picklist value CFIHOS unique code"]), text(r["property picklist value code"]) || text(r["property picklist value CFIHOS unique code"]), text(r["property picklist value description"]), { controlledListId: text(r["property picklist CFIHOS unique code"]), controlledListName: text(r["property picklist name"]), sequence:first(r,["property picklist value sequence number","property picklist value sequence"]), sourceStandardId: text(r["Source standard CFIHOS unique code"]), sourceStandardCode: text(r["source standard code"]) }, "property picklist values", i));
rows("Jip33 info required spec").forEach((r, i) => entity("information_requirement", text(r["Source standard document and data requirement CFIHOS unique code"]), text(r["source standard document and data requirement title"]) || text(r["source standard document and data requirement number"]), text(r["source standard document and data requirement description"]), {
  projectionName:text(r["source standard document and data requirement title"]) || text(r["Source standard document and data requirement CFIHOS unique code"]), requirementNumber: text(r["source standard document and data requirement number"]), requirementTitle: text(r["source standard document and data requirement title"]),
  requirementType: text(r["document and data requirement type code"]),
  requirementGroup: first(r,["document and data requirement group code","requirement group code","requirement group"]),
  typicalDeliverable: first(r,["source standard document and data requirement typical deliverable","typical deliverable"]),
  handoverStatus: first(r,["default required handover status code"]),
  submitAtProposal:first(r,["submit at proposal indicator","submit at proposal"]),
  submitForReview:first(r,["submit for review indicator","submit for review"]), submitAtDelivery:first(r,["submit at delivery indicator","submit at delivery"]),
  requiredHandoverStatus:first(r,["required handover status code","default required handover status code"]), requiredTranslation:first(r,["required translation indicator"]),
  deliverableFormat:first(r,["deliverable format code"]), sourceChapter:first(r,["engineering standard source chapter","source chapter"]),
  reviewWeeks:first(r,["issue for review number of weeks"]), reviewReferenceDate:first(r,["issue for review reference date"]),
  approvalWeeks:first(r,["issue for approval number of weeks"]), approvalReferenceDate:first(r,["issue for approval reference date"]),
  informationWeeks:first(r,["for information number of weeks"]), informationReferenceDate:first(r,["for information reference date"]),
  // Browser-oracle relationship attributes deliberately mirror the exact aliases used
  // by generate-rdl-relationship-index.ts. Keep them separate from the richer legacy
  // metadata above so RDL-005/RDL-006 compatibility and browser projection parity can
  // coexist without one contract overwriting the other.
  projectionRequirementNumber:first(r,["source standard document and data requirement number"]),
  projectionRequirementTitle:first(r,["source standard document and data requirement title"]),
  projectionRequirementGroup:first(r,["requirement group code","requirement group"]),
  projectionTypicalDeliverable:first(r,["typical deliverable"]),
  projectionSubmitAtProposal:first(r,["submit at proposal indicator","submit at proposal"]),
  projectionSubmitForReview:first(r,["submit for review indicator","submit for review"]),
  projectionSubmitAtDelivery:first(r,["submit at delivery indicator","submit at delivery"]),
  projectionRequiredHandoverStatus:first(r,["required handover status code"]),
  projectionRequiredTranslation:first(r,["required translation indicator"]),
  projectionDeliverableFormat:first(r,["deliverable format code"]),
  projectionSourceChapter:first(r,["engineering standard source chapter","source chapter"]),
  projectionReviewWeeks:first(r,["issue for review number of weeks"]),
  projectionReviewReferenceDate:first(r,["issue for review reference date"]),
  projectionApprovalWeeks:first(r,["issue for approval number of weeks"]),
  projectionApprovalReferenceDate:first(r,["issue for approval reference date"]),
  projectionInformationWeeks:first(r,["for information number of weeks"]),
  projectionInformationReferenceDate:first(r,["for information reference date"]),
  classId:text(r["tag class CFIHOS unique code"]), propertyId:text(r["property CFIHOS unique code"]), documentId:text(r["document type CFIHOS unique code"]),
  sourceStandardId:text(r["source standard CFIHOS unique code"]),
}, "Jip33 info required spec", i));

function relation(type: string, sourceType: string, sourceId: string, targetType: string, targetId: string, attrs: Record<string, unknown>, sheet: string, rowIndex: number) {
  if (!sourceId || !targetId) return;
  emit(`INSERT INTO rdl.rdl_relationship (package_id, relationship_type_code, source_entity_id, target_entity_id, relationship_status, is_authoritative, attributes, source_locator) SELECT p.package_id, ${sql(type)}, s.entity_id, t.entity_id, 'active', true, ${jsonSql(attrs)}, ${jsonSql({ sheet, row: rowIndex + 2 })} FROM rdl.rdl_package p JOIN rdl.rdl_entity s ON s.package_id=p.package_id AND s.entity_type_code=${sql(sourceType)} AND s.native_identifier=${sql(sourceId)} JOIN rdl.rdl_entity t ON t.package_id=p.package_id AND t.entity_type_code=${sql(targetType)} AND t.native_identifier=${sql(targetId)} WHERE p.package_key=${sql(packageKey)} ON CONFLICT (package_id, relationship_type_code, source_entity_id, target_entity_id) DO UPDATE SET attributes=EXCLUDED.attributes, source_locator=EXCLUDED.source_locator;`);
}

function hierarchy(sheet: string, type: string, idField: string, nameField: string, parentField: string) {
  const byName = new Map(rows(sheet).map(r => [text(r[nameField]).toLowerCase(), text(r[idField])]));
  rows(sheet).forEach((r, i) => { const parent = text(r[parentField]); const parentId=byName.get(parent.toLowerCase()); if(parentId) relation("entity_parent", type, text(r[idField]), type, parentId, {}, sheet, i); });
}
hierarchy("tag class", "tag_class", "CFIHOS unique code", "tag class name", "parent tag class name");
hierarchy("equipment class", "equipment_class", "equipment class CFIHOS unique code", "equipment class name", "parent equipment class name");

rows("tag class property").forEach((r, i) => relation("class_property", "tag_class", text(r["tag class CFIHOS unique code"]), "property", text(r["property CFIHOS unique code"]), { siUnitId: text(r["SI unit of measure CFIHOS unique code"]), siUnitName: text(r["SI unit of measure name"]), imperialUnitId: text(r["imperial unit of measure CFIHOS unique code"]), imperialUnitName: text(r["imperial unit of measure name"]) }, "tag class property", i));
rows("equipment class property").forEach((r, i) => relation("class_property", "equipment_class", text(r["equipment class CFIHOS unique code"]), "property", text(r["property CFIHOS unique code"]), { equipmentRelevant: text(r["property relevant for equipment indicator"]), modelPartRelevant: text(r["property relevant for model / part indicator"]), siUnitId: text(r["SI unit of measure CFIHOS unique code"]), siUnitName: text(r["SI unit of measure name"]), imperialUnitId: text(r["imperial unit of measure CFIHOS unique code"]), imperialUnitName: text(r["imperial unit of measure name"]) }, "equipment class property", i));
rows("discipline document type").forEach((r, i) => relation("document_discipline", "document_type", text(r["document type CFIHOS unique code"]), "discipline", text(r["discipline CFIHOS unique code"]), {
  relationshipId:first(r,["discipline document type CFIHOS unique code"]), requirementLevel:first(r,["required status code","requirement level"]),
  contextCode:first(r,["discipline document type short code"]), assetType:first(r,["asset type reference"]), representationType:first(r,["representation type"]),
  nativeFileDeliveryTiming:first(r,["native file delivery timing"]), nativeDocumentFormat:first(r,["native document format"]), authenticatedRecordFormat:first(r,["authenticated record format"]),
  detailedEngineeringStatus:first(r,["required document status for detailed engineering"]), constructionStatus:first(r,["required document status for construction"]),
  commissioningStatus:first(r,["required document status for commissioning"]), startupStatus:first(r,["required document status for startup"]),
  operationsStatus:first(r,["required document status for operations"]), reviewType:first(r,["review type"]), comment:first(r,["discipline document type comment"]),
}, "discipline document type", i));
const tagIds = new Set(rows("tag class").map((r) => text(r["CFIHOS unique code"])).filter(Boolean));
const equipmentIds = new Set(rows("equipment class").map((r) => text(r["equipment class CFIHOS unique code"])).filter(Boolean));
rows("document required per class").forEach((r, i) => {
  const classId=text(r["tag or equipment class CFIHOS unique code"]), assetType=text(r["asset type reference"]).toLowerCase();
  const classTypes = assetType === "tag"
    ? (tagIds.has(classId) ? ["tag_class"] : [])
    : assetType === "equipment"
      ? (equipmentIds.has(classId) ? ["equipment_class"] : [])
      : [...(tagIds.has(classId) ? ["tag_class"] : []), ...(equipmentIds.has(classId) ? ["equipment_class"] : [])];
  for (const classType of classTypes) relation("class_document", classType, classId, "document_type", text(r["document type CFIHOS unique code"]), {
    requirementId: text(r["source standard document and data requirement CFIHOS unique code"]), sourceStandardId: text(r["source standard CFIHOS unique code"]),
    sourceStandardCode: text(r["source standard code"]), assetType: text(r["asset type reference"]),
  }, "document required per class", i);
});
rows("tag equipment class relationshi").forEach((r, i) => relation("tag_equipment_mapping", "tag_class", text(r["tag class CFIHOS unique code"]), "equipment_class", text(r["equipment class CFIHOS unique code"]), { reason: text(r["tag or equipment class relationship reason for mapping"]) }, "tag equipment class relationshi", i));

controlledLists.forEach((_, id) => {
  const propertyRows=rows("property").filter(r => text(r["property picklist name CFIHOS unique code"])===id);
  propertyRows.forEach((r, i) => relation("property_controlled_list", "property", text(r["CFIHOS unique code"]), "controlled_list", id, {}, "property", i));
});
rows("property picklist values").forEach((r, i) => {
  relation("controlled_list_value", "controlled_list", text(r["property picklist CFIHOS unique code"]), "controlled_value", text(r["property picklist value CFIHOS unique code"]), {}, "property picklist values", i);
  const std=text(r["Source standard CFIHOS unique code"]); if(std) relation("entity_source_standard", "controlled_value", text(r["property picklist value CFIHOS unique code"]), "source_standard", std, {}, "property picklist values", i);
});

rows("Jip33 info required spec").forEach((r, i) => {
  const req=text(r["Source standard document and data requirement CFIHOS unique code"]);
  relation("information_requirement_class", "information_requirement", req, "tag_class", text(r["tag class CFIHOS unique code"]), {}, "Jip33 info required spec", i);
  relation("information_requirement_standard", "information_requirement", req, "source_standard", text(r["source standard CFIHOS unique code"]), {}, "Jip33 info required spec", i);
  relation("information_requirement_document", "information_requirement", req, "document_type", text(r["document type CFIHOS unique code"]), {}, "Jip33 info required spec", i);
  relation("information_requirement_discipline", "information_requirement", req, "discipline", text(r["discipline CFIHOS unique code"]), {}, "Jip33 info required spec", i);
});

rows("tag equip class prop src std").forEach((r, i) => entity("source_mapping", text(r["CFIHOS unique code"]), text(r["CFIHOS unique code"]), "", {
  classId: text(r["tag or equipment class CFIHOS unique code"]), className: text(r["tag or equipment class name"]), propertyId: text(r["property CFIHOS unique code"]),
  propertyName:text(r["property name"]), sourceStandardId: text(r["source standard code CFIHOS unique code"]), sourceStandardCode:text(r["source standard code"]),
  sourceSection: text(r["source standard section"]), propertyNameInSource: text(r["property name in source standard"]),
  sourcePropertyName: text(r["property name in source standard"]), sequence: text(r["property sequence number"]),
}, "tag equip class prop src std", i));
rows("tag equip class prop src std").forEach((r, i) => {
  const mapping=text(r["CFIHOS unique code"]), classId=text(r["tag or equipment class CFIHOS unique code"]);
  relation("mapping_property", "source_mapping", mapping, "property", text(r["property CFIHOS unique code"]), {}, "tag equip class prop src std", i);
  relation("mapping_standard", "source_mapping", mapping, "source_standard", text(r["source standard code CFIHOS unique code"]), {}, "tag equip class prop src std", i);
  relation("mapping_tag_class", "source_mapping", mapping, "tag_class", classId, { sourceClassDomain: "ambiguous-tag-or-equipment" }, "tag equip class prop src std", i);
  relation("mapping_equipment_class", "source_mapping", mapping, "equipment_class", classId, { sourceClassDomain: "ambiguous-tag-or-equipment" }, "tag equip class prop src std", i);
});

// The source sheet does not disambiguate Tag vs Equipment. Preserve both resolvable identities and mark the ambiguity.
rows("tag or equip class src standard").forEach((r, i) => {
  const classId=text(r["tag or equipment class CFIHOS unique code"]), std=text(r["source standard CFIHOS unique code"]);
  relation("entity_source_standard", "tag_class", classId, "source_standard", std, { sourceClassDomain: "ambiguous-tag-or-equipment" }, "tag or equip class src standard", i);
  relation("entity_source_standard", "equipment_class", classId, "source_standard", std, { sourceClassDomain: "ambiguous-tag-or-equipment" }, "tag or equip class src standard", i);
});

emit(`INSERT INTO ingestion.ingestion_run (package_id, source_uri, content_sha256, adapter_key, adapter_version, status, completed_at, validation_summary) SELECT package_id, ${sql(workbook.source?.url ?? "")}, ${sql(sourceSha)}, 'cfihos-snapshot-v1', '1.0.0', 'completed', now(), jsonb_build_object('snapshotSchema', ${sql(workbook.schema)}, 'sheetCount', ${Number(workbook.sheetNames?.length ?? 0)}) FROM rdl.rdl_package WHERE package_key=${sql(packageKey)};`);
emit("COMMIT;");
process.stdout.write(out.join("\n") + "\n");
