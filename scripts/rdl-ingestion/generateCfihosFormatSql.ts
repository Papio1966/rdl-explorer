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

export function generateCfihosFormatSql(profile: RdlWorkbookMappingProfile): string {
  const path = resolve(profile.workbookPath);
  const bytes = readFileSync(path);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const workbook = XLSX.read(bytes, { type: "buffer" });
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
  const out: string[] = [];
  const emit = (line = "") => out.push(line);

  emit("\\set ON_ERROR_STOP on");
  emit("BEGIN;");
  emit(`INSERT INTO rdl.rdl_source (source_key, name, description, publisher, authoritative_uri, status) VALUES (${sql(profile.sourceKey)}, ${sql(profile.sourceName)}, ${sql(profile.sourceDescription)}, ${sql(profile.publisher)}, ${sql(profile.sourceUri)}, 'active') ON CONFLICT (source_key) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, publisher=EXCLUDED.publisher, authoritative_uri=EXCLUDED.authoritative_uri, updated_at=now();`);
  emit(`INSERT INTO rdl.rdl_release (source_id, release_key, version_label, release_status, notes) SELECT source_id, ${sql(profile.releaseKey)}, ${sql(profile.versionLabel)}, ${sql(profile.releaseStatus)}, ${sql(`Loaded through mapping profile ${profile.profileKey}.`)} FROM rdl.rdl_source WHERE source_key=${sql(profile.sourceKey)} ON CONFLICT (source_id, release_key) DO UPDATE SET version_label=EXCLUDED.version_label, release_status=EXCLUDED.release_status, notes=EXCLUDED.notes;`);
  emit(`INSERT INTO rdl.rdl_package (release_id, package_key, package_kind, package_status, source_uri, content_sha256, manifest, validated_at) SELECT release_id, ${sql(packageKey)}, 'normalized', 'validated', ${sql(profile.sourceUri)}, ${sql(sha256)}, ${jsonSql({ profileKey: profile.profileKey, adapterVersion: profile.adapterVersion, workbookFile: profile.workbookPath, sourceSha256: sha256, sheetCount: workbook.SheetNames.length })}, now() FROM rdl.rdl_release r JOIN rdl.rdl_source s ON s.source_id=r.source_id WHERE s.source_key=${sql(profile.sourceKey)} AND r.release_key=${sql(profile.releaseKey)} ON CONFLICT (package_key) DO UPDATE SET package_status='validated', source_uri=EXCLUDED.source_uri, content_sha256=EXCLUDED.content_sha256, manifest=EXCLUDED.manifest, validated_at=now();`);
  emit(`DELETE FROM rdl.rdl_relationship WHERE package_id=(SELECT package_id FROM rdl.rdl_package WHERE package_key=${sql(packageKey)});`);
  emit(`DELETE FROM rdl.rdl_entity WHERE package_id=(SELECT package_id FROM rdl.rdl_package WHERE package_key=${sql(packageKey)});`);
  emit(`DELETE FROM ingestion.ingestion_run WHERE package_id=(SELECT package_id FROM rdl.rdl_package WHERE package_key=${sql(packageKey)});`);

  function entity(type: string, nativeId: string, name: string, definition: string, metadata: Record<string, unknown>, sheet: string, rowIndex: number) {
    if (!nativeId || !name) return;
    emit(`INSERT INTO rdl.rdl_entity (package_id, entity_type_code, native_identifier, name, definition, lifecycle_status, is_authoritative, normalized_metadata, source_locator) SELECT package_id, ${sql(type)}, ${sql(nativeId)}, ${sql(name)}, ${definition ? sql(definition) : "NULL"}, 'active', true, ${jsonSql(metadata)}, ${jsonSql({ sheet, row: rowIndex + 2, mappingProfile: profile.profileKey })} FROM rdl.rdl_package WHERE package_key=${sql(packageKey)} ON CONFLICT (package_id, entity_type_code, native_identifier) DO UPDATE SET name=EXCLUDED.name, definition=EXCLUDED.definition, normalized_metadata=EXCLUDED.normalized_metadata, source_locator=EXCLUDED.source_locator;`);
  }

  rows("tagClass").forEach((r, i) => entity("tag_class", t(r,"tagClassId"), t(r,"tagClassName"), t(r,"tagClassDefinition"), { parentName:t(r,"tagParentName"), abstract:truthy(String(r["abstract class indicator"] ?? "")), equipmentExpectedInstalled:String(r["equipment expected to be installed indicator"] ?? "").trim() }, profile.sheetNames.tagClass, i));
  rows("equipmentClass").forEach((r, i) => entity("equipment_class", t(r,"equipmentClassId"), t(r,"equipmentClassName"), t(r,"equipmentClassDefinition"), { parentName:t(r,"equipmentParentName"), abstract:truthy(String(r["abstract class indicator"] ?? "")), sparePartInformationRequired:String(r["spare part information required indicator"] ?? "").trim() }, profile.sheetNames.equipmentClass, i));
  rows("property").forEach((r, i) => entity("property", t(r,"propertyId"), t(r,"propertyName"), t(r,"propertyDefinition"), { dataType:t(r,"propertyDataType"), dataTypeLength:t(r,"propertyLength"), unitId:t(r,"propertyUnitId"), controlledListId:t(r,"propertyPicklistId") }, profile.sheetNames.property, i));
  rows("documentType").forEach((r, i) => entity("document_type", t(r,"documentId"), t(r,"documentName"), t(r,"documentDefinition"), { shortCode:t(r,"documentShortCode"), classification:t(r,"documentClassification") }, profile.sheetNames.documentType, i));
  rows("discipline").forEach((r, i) => entity("discipline", t(r,"disciplineId"), t(r,"disciplineName"), t(r,"disciplineDescription"), { code:t(r,"disciplineCode") }, profile.sheetNames.discipline, i));
  rows("unit").forEach((r, i) => entity("unit_of_measure", t(r,"unitId"), t(r,"unitName"), String(r["unit of measure description"] ?? "").trim(), { symbol:t(r,"unitSymbol"), dimensionName:t(r,"unitDimensionName"), dimensionId:t(r,"unitId") }, profile.sheetNames.unit, i));
  rows("sourceStandard").forEach((r, i) => entity("source_standard", t(r,"sourceStandardId"), t(r,"sourceStandardCode") || t(r,"sourceStandardId"), t(r,"sourceStandardDescription"), {}, profile.sheetNames.sourceStandard, i));
  rows("handoverEvent").forEach((r, i) => entity("handover_event", t(r,"handoverId"), t(r,"handoverName"), t(r,"handoverDescription"), { sequence:String(r["handover event reporting sequence number"] ?? "").trim() }, profile.sheetNames.handoverEvent, i));

  const controlledLists = new Map<string,string>();
  rows("controlledValue").forEach((r) => { const id=t(r,"picklistId"); if(id) controlledLists.set(id,t(r,"picklistName")||id); });
  [...controlledLists].forEach(([id,name],i)=>entity("controlled_list",id,name,"",{},profile.sheetNames.controlledValue,i));
  rows("controlledValue").forEach((r,i)=>entity("controlled_value",t(r,"picklistValueId"),t(r,"picklistValueCode")||t(r,"picklistValueId"),t(r,"picklistValueDescription"),{controlledListId:t(r,"picklistId"),controlledListName:t(r,"picklistName")},profile.sheetNames.controlledValue,i));
  rows("informationRequirement").forEach((r,i)=>entity("information_requirement",t(r,"informationRequirementId"),t(r,"informationRequirementTitle")||t(r,"informationRequirementNumber")||t(r,"informationRequirementId"),t(r,"informationRequirementDescription"),{requirementNumber:t(r,"informationRequirementNumber"),typicalDeliverable:String(r["typical deliverable"]??"").trim(),sourceStandard:String(r["source standard"]??"").trim()},profile.sheetNames.informationRequirement,i));
  rows("sourceMapping").forEach((r,i)=>entity("source_mapping",t(r,"mappingId"),t(r,"mappingId"),"",{classId:t(r,"classId"),propertyId:t(r,"propertyId"),sourceStandardId:t(r,"sourceStandardId"),sourceSection:String(r["source standard section"]??"").trim(),sourceField:String(r["source standard field"]??"").trim()},profile.sheetNames.sourceMapping,i));

  const tagIds = new Set(rows("tagClass").map(r=>t(r,"tagClassId")).filter(Boolean));
  const equipmentIds = new Set(rows("equipmentClass").map(r=>t(r,"equipmentClassId")).filter(Boolean));

  function relation(type:string,sourceType:string,sourceId:string,targetType:string,targetId:string,attrs:Record<string,unknown>,sheet:string,rowIndex:number){
    if(!sourceId||!targetId) return;
    emit(`INSERT INTO rdl.rdl_relationship (package_id, relationship_type_code, source_entity_id, target_entity_id, relationship_status, is_authoritative, attributes, source_locator) SELECT p.package_id, ${sql(type)}, s.entity_id, t.entity_id, 'active', true, ${jsonSql(attrs)}, ${jsonSql({sheet,row:rowIndex+2,mappingProfile:profile.profileKey})} FROM rdl.rdl_package p JOIN rdl.rdl_entity s ON s.package_id=p.package_id AND s.entity_type_code=${sql(sourceType)} AND s.native_identifier=${sql(sourceId)} JOIN rdl.rdl_entity t ON t.package_id=p.package_id AND t.entity_type_code=${sql(targetType)} AND t.native_identifier=${sql(targetId)} WHERE p.package_key=${sql(packageKey)} ON CONFLICT (package_id, relationship_type_code, source_entity_id, target_entity_id) DO UPDATE SET attributes=EXCLUDED.attributes, source_locator=EXCLUDED.source_locator;`);
  }

  function hierarchy(key:string,type:string,idField:string,nameField:string,parentField:string){
    const data=rows(key); const byName=new Map(data.map(r=>[t(r,nameField).toLowerCase(),t(r,idField)]));
    data.forEach((r,i)=>{const parent=byName.get(t(r,parentField).toLowerCase()); if(parent) relation("entity_parent",type,t(r,idField),type,parent,{},profile.sheetNames[key],i);});
  }
  hierarchy("tagClass","tag_class","tagClassId","tagClassName","tagParentName");
  hierarchy("equipmentClass","equipment_class","equipmentClassId","equipmentClassName","equipmentParentName");

  rows("tagClassProperty").forEach((r,i)=>relation("class_property","tag_class",t(r,"tagClassId"),"property",t(r,"propertyId"),{sequence:String(r["property sequence number"]??"").trim()},profile.sheetNames.tagClassProperty,i));
  rows("equipmentClassProperty").forEach((r,i)=>relation("class_property","equipment_class",t(r,"equipmentClassId"),"property",t(r,"propertyId"),{mandatory:String(r["mandatory indicator"]??"").trim(),sequence:String(r["property sequence number"]??"").trim()},profile.sheetNames.equipmentClassProperty,i));
  const disciplineByCode = new Map(rows("discipline").map(r => [t(r,"disciplineCode").toLowerCase(), t(r,"disciplineId")]));
  rows("disciplineDocument").forEach((r,i)=>{
    const disciplineId = disciplineByCode.get(t(r,"disciplineRefCode").toLowerCase()) ?? "";
    relation("document_discipline","document_type",t(r,"documentId"),"discipline",disciplineId,{},profile.sheetNames.disciplineDocument,i);
  });
  rows("tagEquipment").forEach((r,i)=>relation("tag_equipment_mapping","tag_class",t(r,"tagClassId"),"equipment_class",t(r,"equipmentClassId"),{mappingId:t(r,"relationshipId"),reason:String(r["relationship reason for mapping"]??"").trim()},profile.sheetNames.tagEquipment,i));
  rows("controlledValue").forEach((r,i)=>relation("controlled_list_value","controlled_list",t(r,"picklistId"),"controlled_value",t(r,"picklistValueId"),{},profile.sheetNames.controlledValue,i));

  rows("property").forEach((r,i)=>{
    const prop=t(r,"propertyId"), pick=t(r,"propertyPicklistId"), unit=t(r,"propertyUnitId");
    if(pick) relation("property_controlled_list","property",prop,"controlled_list",pick,{},profile.sheetNames.property,i);
    if(unit) relation("property_unit","property",prop,"unit_of_measure",unit,{},profile.sheetNames.property,i);
  });

  rows("classDocument").forEach((r,i)=>{
    const classId=t(r,"classId"), doc=t(r,"documentId");
    if(tagIds.has(classId)) relation("class_document","tag_class",classId,"document_type",doc,{requirementId:t(r,"informationRequirementId")},profile.sheetNames.classDocument,i);
    if(equipmentIds.has(classId)) relation("class_document","equipment_class",classId,"document_type",doc,{requirementId:t(r,"informationRequirementId")},profile.sheetNames.classDocument,i);
  });

  rows("classSourceStandard").forEach((r,i)=>{
    const classId=t(r,"classId"), standard=t(r,"sourceStandardId");
    if(tagIds.has(classId)) relation("entity_source_standard","tag_class",classId,"source_standard",standard,{},profile.sheetNames.classSourceStandard,i);
    if(equipmentIds.has(classId)) relation("entity_source_standard","equipment_class",classId,"source_standard",standard,{},profile.sheetNames.classSourceStandard,i);
  });

  rows("sourceMapping").forEach((r,i)=>{
    const mapping=t(r,"mappingId"), classId=t(r,"classId"), prop=t(r,"propertyId"), standard=t(r,"sourceStandardId");
    relation("mapping_property","source_mapping",mapping,"property",prop,{},profile.sheetNames.sourceMapping,i);
    relation("mapping_standard","source_mapping",mapping,"source_standard",standard,{},profile.sheetNames.sourceMapping,i);
    if(tagIds.has(classId)) relation("mapping_tag_class","source_mapping",mapping,"tag_class",classId,{},profile.sheetNames.sourceMapping,i);
    if(equipmentIds.has(classId)) relation("mapping_equipment_class","source_mapping",mapping,"equipment_class",classId,{},profile.sheetNames.sourceMapping,i);
  });

  emit(`INSERT INTO ingestion.ingestion_run (package_id, source_uri, content_sha256, adapter_key, adapter_version, status, completed_at, validation_summary) SELECT package_id, ${sql(profile.sourceUri)}, ${sql(sha256)}, ${sql(profile.profileKey)}, ${sql(profile.adapterVersion)}, 'completed', now(), ${jsonSql({ mappingProfile: profile.profileKey, workbookSheets: workbook.SheetNames.length })} FROM rdl.rdl_package WHERE package_key=${sql(packageKey)};`);
  emit("COMMIT;");
  return out.join("\n")+"\n";
}
