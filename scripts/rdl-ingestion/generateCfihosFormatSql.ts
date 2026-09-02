import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import type { RdlWorkbookMappingProfile } from "./RdlWorkbookMappingProfile.ts";
import { mappedText } from "./RdlWorkbookMappingProfile.ts";

const sql = (value: unknown) => `'${String(value ?? "").replaceAll("'", "''")}'`;
const jsonSql = (value: unknown) => `${sql(JSON.stringify(value))}::jsonb`;
const truthy = (value: string) => ["yes", "y", "true", "1"].includes(value.toLowerCase());

type Row = Record<string, unknown>;

const text = (value: unknown) => String(value ?? "").trim();
const normalizedKey = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
function rowText(row: Row, candidates: string[]): string {
  for (const candidate of candidates) {
    const direct = text(row[candidate]);
    if (direct) return direct;
  }
  const keys = new Map(Object.keys(row).map((key) => [normalizedKey(key), key]));
  for (const candidate of candidates) {
    const actual = keys.get(normalizedKey(candidate));
    if (!actual) continue;
    const value = text(row[actual]);
    if (value) return value;
  }
  return "";
}
function rowTextContaining(row: Row, requiredTokens: string[]): string {
  const tokens = requiredTokens.map(normalizedKey);
  for (const [key, raw] of Object.entries(row)) {
    const normalized = normalizedKey(key);
    if (tokens.every((token) => normalized.includes(token))) {
      const value = text(raw);
      if (value) return value;
    }
  }
  return "";
}

function stableDerivedId(sourceKey: string, kind: string, parts: string[]): string {
  const seed = parts.map((part) => part.trim().toLowerCase()).join("|");
  const digest = createHash("sha256").update(seed).digest("hex").slice(0, 16);
  return `${sourceKey}:${kind}:${digest}`;
}

export function generateCfihosFormatSql(profile: RdlWorkbookMappingProfile): string {
  const path = resolve(profile.workbookPath);
  const bytes = readFileSync(path);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const workbook = XLSX.read(bytes, { type: "buffer" });
  const identityAudit = profile.identityAudit
    ? (() => {
        const auditBytes = readFileSync(resolve(profile.identityAudit.auditPath));
        return {
          fromReleaseKey: profile.identityAudit.fromReleaseKey,
          auditPath: profile.identityAudit.auditPath,
          auditSha256: createHash("sha256").update(auditBytes).digest("hex"),
        };
      })()
    : null;
  const rows = (key: string): Row[] => {
    const sheetName = profile.sheetNames[key];
    if (!sheetName) return [];
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return [];
    return XLSX.utils.sheet_to_json<Row>(worksheet, { defval: null, raw: false });
  };
  const f = profile.fields;
  const t = (row: Row, field: string) => mappedText(row, f[field] ?? [field]);
  const packageKey = `${profile.sourceKey}-${profile.versionLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${sha256.slice(0, 12)}`;
  const persistedReleaseStatus = profile.releaseKey.endsWith("0.1-draft") ? "superseded" : profile.releaseStatus;
  const out: string[] = [];
  const emit = (line = "") => out.push(line);

  emit("\\set ON_ERROR_STOP on");
  emit("BEGIN;");
  emit(`INSERT INTO rdl.rdl_source (source_key, name, description, publisher, authoritative_uri, status) VALUES (${sql(profile.sourceKey)}, ${sql(profile.sourceName)}, ${sql(profile.sourceDescription)}, ${sql(profile.publisher)}, ${sql(profile.sourceUri)}, 'active') ON CONFLICT (source_key) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, publisher=EXCLUDED.publisher, authoritative_uri=EXCLUDED.authoritative_uri, updated_at=now();`);
  emit(`INSERT INTO rdl.rdl_release (source_id, release_key, version_label, release_status, notes) SELECT source_id, ${sql(profile.releaseKey)}, ${sql(profile.versionLabel)}, ${sql(persistedReleaseStatus)}, ${sql(`Loaded through mapping profile ${profile.profileKey}.`)} FROM rdl.rdl_source WHERE source_key=${sql(profile.sourceKey)} ON CONFLICT (source_id, release_key) DO UPDATE SET version_label=EXCLUDED.version_label, release_status=EXCLUDED.release_status, notes=EXCLUDED.notes;`);
  emit(`SELECT rdl.assert_release_package_fingerprint(${sql(profile.sourceKey)}, ${sql(profile.releaseKey)}, ${sql(sha256)});`);
  emit(`INSERT INTO rdl.rdl_package (release_id, package_key, package_kind, package_status, source_uri, content_sha256, manifest, validated_at) SELECT release_id, ${sql(packageKey)}, 'normalized', 'validated', ${sql(profile.sourceUri)}, ${sql(sha256)}, ${jsonSql({ profileKey: profile.profileKey, adapterVersion: profile.adapterVersion, workbookFile: profile.workbookPath, sourceSha256: sha256, sheetCount: workbook.SheetNames.length, ...(identityAudit ? { identityAuditFromReleaseKey: identityAudit.fromReleaseKey, identityAuditPath: identityAudit.auditPath, identityAuditSha256: identityAudit.auditSha256 } : {}) })}, now() FROM rdl.rdl_release r JOIN rdl.rdl_source s ON s.source_id=r.source_id WHERE s.source_key=${sql(profile.sourceKey)} AND r.release_key=${sql(profile.releaseKey)} ON CONFLICT (package_key) DO UPDATE SET package_status='validated', validated_at=COALESCE(rdl.rdl_package.validated_at, now());`);
  emit(`DELETE FROM rdl.rdl_relationship WHERE package_id=(SELECT package_id FROM rdl.rdl_package WHERE package_key=${sql(packageKey)});`);
  emit(`DELETE FROM rdl.rdl_entity WHERE package_id=(SELECT package_id FROM rdl.rdl_package WHERE package_key=${sql(packageKey)});`);
  emit(`DELETE FROM ingestion.ingestion_run WHERE package_id=(SELECT package_id FROM rdl.rdl_package WHERE package_key=${sql(packageKey)});`);

  function entity(type: string, nativeId: string, name: string, definition: string, metadata: Record<string, unknown>, sheet: string, rowIndex: number) {
    if (!nativeId || !name) return;
    emit(`INSERT INTO rdl.rdl_entity (package_id, entity_type_code, native_identifier, name, definition, lifecycle_status, is_authoritative, normalized_metadata, source_locator) SELECT package_id, ${sql(type)}, ${sql(nativeId)}, ${sql(name)}, ${definition ? sql(definition) : "NULL"}, 'active', true, ${jsonSql(metadata)}, ${jsonSql({ sheet, row: rowIndex + 2, mappingProfile: profile.profileKey })} FROM rdl.rdl_package WHERE package_key=${sql(packageKey)} ON CONFLICT (package_id, entity_type_code, native_identifier) DO UPDATE SET name=EXCLUDED.name, definition=EXCLUDED.definition, normalized_metadata=EXCLUDED.normalized_metadata, source_locator=EXCLUDED.source_locator;`);
  }

  rows("tagClass").forEach((r, i) => entity("tag_class", t(r,"tagClassId"), t(r,"tagClassName"), t(r,"tagClassDefinition"), {
    parentName:t(r,"tagParentName") || rowText(r,["parent tag class name","parent class code"]), parentId:t(r,"tagParentId"), abstract:truthy(rowText(r,["abstract class indicator","abstract"])),
    equipmentExpectedInstalled:text(r["equipment expected to be installed indicator"]),
    synonym:rowText(r,["tag class synonym","tag class synonym name","synonym"]),
    existenceReason:rowText(r,["tag class existence reason","existence reason"]) || rowTextContaining(r,["existence","reason"]),
  }, profile.sheetNames.tagClass, i));
  rows("equipmentClass").forEach((r, i) => entity("equipment_class", t(r,"equipmentClassId"), t(r,"equipmentClassName"), t(r,"equipmentClassDefinition"), {
    parentName:t(r,"equipmentParentName") || rowText(r,["parent equipment class name","parent class code"]), parentId:t(r,"equipmentParentId"), abstract:truthy(rowText(r,["abstract class indicator","abstract"])),
    sparePartInformationRequired:text(r["spare part information required indicator"]),
    synonym:rowText(r,["equipment class synonym name","equipment class synonym","synonym"]),
    existenceReason:rowText(r,["equipment class existence reason","existence reason"]) || rowTextContaining(r,["existence","reason"]),
  }, profile.sheetNames.equipmentClass, i));
  rows("property").forEach((r, i) => entity("property", t(r,"propertyId"), t(r,"propertyName"), t(r,"propertyDefinition"), {
    dataType:t(r,"propertyDataType") || rowText(r,["property data type","data type"]), dataTypeLength:t(r,"propertyLength"), unitId:t(r,"propertyUnitId"), controlledListId:t(r,"propertyPicklistId"),
    controlledListName:rowText(r,["property picklist name","picklist name"]),
    dimensionReference:rowText(r,["unit of measure dimension code CFIHOS unique code","unit of measure dimension code","quantity kind","unit class or picklist reference"]),
    dimensionCode:rowText(r,["unit of measure dimension code","dimension code"]),
    dimensionName:rowText(r,["unit of measure dimension name","quantity kind"]),
    synonym:rowText(r,["property synonym name","property synonym","synonym"]),
    existenceReason:rowText(r,["property existence reason","existence reason"]) || rowTextContaining(r,["existence","reason"]),
  }, profile.sheetNames.property, i));
  rows("documentType").forEach((r, i) => entity("document_type", t(r,"documentId"), t(r,"documentName"), t(r,"documentDefinition"), {
    shortCode:t(r,"documentShortCode"), classification:t(r,"documentClassification"),
    synonym:rowText(r,["document type synonym name","document type synonym","synonym"]),
  }, profile.sheetNames.documentType, i));
  rows("discipline").forEach((r, i) => entity("discipline", t(r,"disciplineId"), t(r,"disciplineName"), t(r,"disciplineDescription"), { code:t(r,"disciplineCode") || rowText(r,["discipline code"]) }, profile.sheetNames.discipline, i));
  rows("unit").forEach((r, i) => entity("unit_of_measure", t(r,"unitId"), t(r,"unitName"), t(r,"unitDescription") || text(r["unit of measure description"]), {
    projectionDefinition:t(r,"unitDescription"), symbol:t(r,"unitSymbol") || rowText(r,["unit of measure symbol","symbol"]),
    uneceCode:rowText(r,["UNECE code","UNECE common code","unece code"]),
    dimensionId:rowText(r,["unit of measure dimension code CFIHOS unique code","dimension id","quantity kind id"]),
    dimensionCode:rowText(r,["unit of measure dimension code","dimension code"]),
    dimensionName:t(r,"unitDimensionName") || rowText(r,["unit of measure dimension name","dimension name","quantity kind"]),
    dimensionReference:rowText(r,["unit of measure dimension code CFIHOS unique code","unit of measure dimension CFIHOS unique code","unit of measure dimension code","unit of measure dimension name","quantity kind","Unit Class ID"]),
    measurementSystemId:rowText(r,["measurement system code CFIHOS unique code","measurement system id"]),
    measurementSystemCode:rowText(r,["measurement system code"]),
    measurementSystemName:rowText(r,["measurement system name"]),
    synonym:rowText(r,["unit of measure synonym name","unit of measure synonym","synonym"]),
  }, profile.sheetNames.unit, i));
  rows("sourceStandard").forEach((r, i) => entity("source_standard", t(r,"sourceStandardId"), t(r,"sourceStandardName") || t(r,"sourceStandardCode") || t(r,"sourceStandardId"), t(r,"sourceStandardDescription"), { projectionName:t(r,"sourceStandardName") || t(r,"sourceStandardId") }, profile.sheetNames.sourceStandard, i));
  rows("handoverEvent").forEach((r, i) => entity("handover_event", t(r,"handoverId"), t(r,"handoverName"), t(r,"handoverDescription"), { sequence:t(r,"handoverSequence") || text(r["handover event reporting sequence number"]) }, profile.sheetNames.handoverEvent, i));

  const controlledLists = new Map<string,string>();
  rows("controlledValue").forEach((r) => { const id=t(r,"picklistId"); if(id) controlledLists.set(id,t(r,"picklistName")||id); });
  [...controlledLists].forEach(([id,name],i)=>entity("controlled_list",id,name,"",{},profile.sheetNames.controlledValue,i));
  rows("controlledValue").forEach((r,i)=>{
    const listId=t(r,"picklistId");
    const valueCode=t(r,"picklistValueCode");
    const valueId=t(r,"picklistValueId") || stableDerivedId(profile.sourceKey,"controlled-value",[listId,valueCode,t(r,"picklistValueSequence")]);
    entity("controlled_value",valueId,valueCode||valueId,t(r,"picklistValueDescription"),{
      controlledListId:listId,controlledListName:t(r,"picklistName"),sequence:t(r,"picklistValueSequence"),
      sourceStandardId:t(r,"sourceStandardId"),sourceStandardCode:t(r,"sourceStandardCode"),
    },profile.sheetNames.controlledValue,i);
  });
  rows("informationRequirement").forEach((r,i)=>entity("information_requirement",t(r,"informationRequirementId"),t(r,"informationRequirementTitle")||t(r,"informationRequirementNumber")||t(r,"informationRequirementId"),t(r,"informationRequirementDescription"),{
    projectionName:t(r,"informationRequirementTitle") || t(r,"informationRequirementId"), requirementNumber:t(r,"informationRequirementNumber"), requirementTitle:t(r,"informationRequirementTitle"),
    classId:t(r,"informationRequirementClassId"), propertyId:t(r,"informationRequirementPropertyId"), requirementLevel:t(r,"informationRequirementLevel"),
    requirementGroup:rowText(r,["requirement group code","requirement group","requirement category"]), typicalDeliverable:rowText(r,["typical deliverable"]),
    submitAtProposal:rowText(r,["submit at proposal indicator","submit at proposal"]), submitForReview:rowText(r,["submit for review indicator","submit for review"]),
    submitAtDelivery:rowText(r,["submit at delivery indicator","submit at delivery"]), requiredHandoverStatus:rowText(r,["required handover status code"]),
    requiredTranslation:rowText(r,["required translation indicator"]), deliverableFormat:rowText(r,["deliverable format code"]),
    sourceChapter:rowText(r,["engineering standard source chapter","source chapter"]), reviewWeeks:rowText(r,["issue for review number of weeks"]),
    reviewReferenceDate:rowText(r,["issue for review reference date"]), approvalWeeks:rowText(r,["issue for approval number of weeks"]),
    approvalReferenceDate:rowText(r,["issue for approval reference date"]), informationWeeks:rowText(r,["for information number of weeks"]),
    informationReferenceDate:rowText(r,["for information reference date"]), sourceStandard:text(r["source standard"]),
  },profile.sheetNames.informationRequirement,i));
  rows("sourceMapping").forEach((r,i)=>{
    const classId=t(r,"classId"), propertyId=t(r,"propertyId"), sourceStandardId=t(r,"sourceStandardId");
    const mappingId=t(r,"mappingId") || stableDerivedId(profile.sourceKey,"source-mapping",[classId,propertyId,sourceStandardId,t(r,"mappingNote")]);
    entity("source_mapping",mappingId,mappingId,"",{
      classId,propertyId,sourceStandardId,sourceStandardCode:t(r,"sourceStandardCode"),
      sourceSection:rowText(r,["source standard section"]), sourceField:rowText(r,["source standard field"]),
      sourcePropertyName:rowText(r,["property name in source standard","source standard field"]), sequence:rowText(r,["property sequence number"]),
      mappingNote:t(r,"mappingNote"),
    },profile.sheetNames.sourceMapping,i);
  });

  const tagIds = new Set(rows("tagClass").map(r=>t(r,"tagClassId")).filter(Boolean));
  const equipmentIds = new Set(rows("equipmentClass").map(r=>t(r,"equipmentClassId")).filter(Boolean));

  function relation(type:string,sourceType:string,sourceId:string,targetType:string,targetId:string,attrs:Record<string,unknown>,sheet:string,rowIndex:number){
    if(!sourceId||!targetId) return;
    emit(`INSERT INTO rdl.rdl_relationship (package_id, relationship_type_code, source_entity_id, target_entity_id, relationship_status, is_authoritative, attributes, source_locator) SELECT p.package_id, ${sql(type)}, s.entity_id, t.entity_id, 'active', true, ${jsonSql(attrs)}, ${jsonSql({sheet,row:rowIndex+2,mappingProfile:profile.profileKey})} FROM rdl.rdl_package p JOIN rdl.rdl_entity s ON s.package_id=p.package_id AND s.entity_type_code=${sql(sourceType)} AND s.native_identifier=${sql(sourceId)} JOIN rdl.rdl_entity t ON t.package_id=p.package_id AND t.entity_type_code=${sql(targetType)} AND t.native_identifier=${sql(targetId)} WHERE p.package_key=${sql(packageKey)} ON CONFLICT (package_id, relationship_type_code, source_entity_id, target_entity_id) DO UPDATE SET attributes=EXCLUDED.attributes, source_locator=EXCLUDED.source_locator;`);
  }

  function hierarchy(key:string,type:string,idField:string,nameField:string,parentNameField:string,parentIdField:string){
    const data=rows(key);
    const byName=new Map(data.map(r=>[t(r,nameField).toLowerCase(),t(r,idField)]));
    const ids=new Set(data.map(r=>t(r,idField)).filter(Boolean));
    data.forEach((r,i)=>{
      const explicitParent=t(r,parentIdField);
      const namedParent=byName.get(t(r,parentNameField).toLowerCase()) ?? "";
      const parent=explicitParent && ids.has(explicitParent) ? explicitParent : namedParent;
      if(parent) relation("entity_parent",type,t(r,idField),type,parent,{},profile.sheetNames[key],i);
    });
  }
  hierarchy("tagClass","tag_class","tagClassId","tagClassName","tagParentName","tagParentId");
  hierarchy("equipmentClass","equipment_class","equipmentClassId","equipmentClassName","equipmentParentName","equipmentParentId");

  rows("tagClassProperty").forEach((r,i)=>relation("class_property","tag_class",t(r,"tagClassId"),"property",t(r,"propertyId"),{mandatory:t(r,"mandatory"),relevance:t(r,"relevance"),sequence:String(r["property sequence number"]??"").trim()},profile.sheetNames.tagClassProperty,i));
  rows("equipmentClassProperty").forEach((r,i)=>relation("class_property","equipment_class",t(r,"equipmentClassId"),"property",t(r,"propertyId"),{mandatory:t(r,"mandatory")||String(r["mandatory indicator"]??"").trim(),relevance:t(r,"relevance"),sequence:String(r["property sequence number"]??"").trim()},profile.sheetNames.equipmentClassProperty,i));
  const disciplineByCode = new Map(rows("discipline").map(r => [t(r,"disciplineCode").toLowerCase(), t(r,"disciplineId")]));
  rows("disciplineDocument").forEach((r,i)=>{
    const disciplineId = disciplineByCode.get(t(r,"disciplineRefCode").toLowerCase()) ?? "";
    relation("document_discipline","document_type",t(r,"documentId"),"discipline",disciplineId,{
      requirementLevel:t(r,"requirementLevel"), contextCode:rowText(r,["discipline document type short code"]),
      assetType:rowText(r,["asset type reference"]), representationType:rowText(r,["representation type"]),
      nativeFileDeliveryTiming:rowText(r,["native file delivery timing"]), nativeDocumentFormat:rowText(r,["native document format"]),
      authenticatedRecordFormat:rowText(r,["authenticated record format"]), detailedEngineeringStatus:rowText(r,["required document status for detailed engineering"]),
      constructionStatus:rowText(r,["required document status for construction"]), commissioningStatus:rowText(r,["required document status for commissioning"]),
      startupStatus:rowText(r,["required document status for startup"]), operationsStatus:rowText(r,["required document status for operations"]),
      reviewType:rowText(r,["review type"]), comment:rowText(r,["discipline document type comment"]),
    },profile.sheetNames.disciplineDocument,i);
  });
  rows("tagEquipment").forEach((r,i)=>relation("tag_equipment_mapping","tag_class",t(r,"tagClassId"),"equipment_class",t(r,"equipmentClassId"),{mappingId:t(r,"relationshipId"),relationshipType:t(r,"relationshipType"),reason:String(r["relationship reason for mapping"]??"").trim()},profile.sheetNames.tagEquipment,i));
  rows("controlledValue").forEach((r,i)=>{
    const listId=t(r,"picklistId");
    const valueCode=t(r,"picklistValueCode");
    const valueId=t(r,"picklistValueId") || stableDerivedId(profile.sourceKey,"controlled-value",[listId,valueCode,t(r,"picklistValueSequence")]);
    relation("controlled_list_value","controlled_list",listId,"controlled_value",valueId,{sequence:t(r,"picklistValueSequence")},profile.sheetNames.controlledValue,i);
  });

  rows("property").forEach((r,i)=>{
    const prop=t(r,"propertyId"), pick=t(r,"propertyPicklistId"), unit=t(r,"propertyUnitId");
    if(pick) relation("property_controlled_list","property",prop,"controlled_list",pick,{},profile.sheetNames.property,i);
    if(unit) relation("property_unit","property",prop,"unit_of_measure",unit,{},profile.sheetNames.property,i);
  });

  rows("classDocument").forEach((r,i)=>{
    const classId=t(r,"classId"), doc=t(r,"documentId");
    const attrs={requirementId:t(r,"informationRequirementId"),requirementLevel:t(r,"requirementLevel"),sourceStandardId:t(r,"sourceStandardId")};
    if(tagIds.has(classId)) relation("class_document","tag_class",classId,"document_type",doc,attrs,profile.sheetNames.classDocument,i);
    if(equipmentIds.has(classId)) relation("class_document","equipment_class",classId,"document_type",doc,attrs,profile.sheetNames.classDocument,i);
  });

  rows("classSourceStandard").forEach((r,i)=>{
    const classId=t(r,"classId"), standard=t(r,"sourceStandardId");
    if(tagIds.has(classId)) relation("entity_source_standard","tag_class",classId,"source_standard",standard,{mappingNote:t(r,"mappingNote")},profile.sheetNames.classSourceStandard,i);
    if(equipmentIds.has(classId)) relation("entity_source_standard","equipment_class",classId,"source_standard",standard,{mappingNote:t(r,"mappingNote")},profile.sheetNames.classSourceStandard,i);
  });

  rows("sourceMapping").forEach((r,i)=>{
    const classId=t(r,"classId"), prop=t(r,"propertyId"), standard=t(r,"sourceStandardId");
    const mapping=t(r,"mappingId") || stableDerivedId(profile.sourceKey,"source-mapping",[classId,prop,standard,t(r,"mappingNote")]);
    relation("mapping_property","source_mapping",mapping,"property",prop,{},profile.sheetNames.sourceMapping,i);
    relation("mapping_standard","source_mapping",mapping,"source_standard",standard,{},profile.sheetNames.sourceMapping,i);
    if(tagIds.has(classId)) relation("mapping_tag_class","source_mapping",mapping,"tag_class",classId,{},profile.sheetNames.sourceMapping,i);
    if(equipmentIds.has(classId)) relation("mapping_equipment_class","source_mapping",mapping,"equipment_class",classId,{},profile.sheetNames.sourceMapping,i);
  });

  emit(`SELECT rdl.assert_source_release_identity(${sql(packageKey)});`);
  emit(`INSERT INTO ingestion.ingestion_run (package_id, source_uri, content_sha256, adapter_key, adapter_version, status, completed_at, validation_summary) SELECT package_id, ${sql(profile.sourceUri)}, ${sql(sha256)}, ${sql(profile.profileKey)}, ${sql(profile.adapterVersion)}, 'completed', now(), ${jsonSql({ mappingProfile: profile.profileKey, workbookSheets: workbook.SheetNames.length, identityAuditRequired: Boolean(identityAudit), identityAuditSha256: identityAudit?.auditSha256 ?? null })} FROM rdl.rdl_package WHERE package_key=${sql(packageKey)};`);
  emit("COMMIT;");
  return out.join("\n")+"\n";
}
