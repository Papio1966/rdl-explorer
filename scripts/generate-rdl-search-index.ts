import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { CCUS_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/CcusCfihosFormatProfile.ts";
import { CCUS_V2_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/CcusV2CfihosFormatProfile.ts";
import { WATER_DESALINATION_PROFILE } from "./rdl-ingestion/WaterDesalinationProfile.ts";
import { WATER_DESALINATION_V2_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/WaterDesalinationV2CfihosFormatProfile.ts";
import type { RdlWorkbookMappingProfile } from "./rdl-ingestion/RdlWorkbookMappingProfile.ts";
import { mappedText } from "./rdl-ingestion/RdlWorkbookMappingProfile.ts";

type RecordOut = { sourceKey:string; sourceName:string; releaseKey:string; releaseStatus:string; versionLabel:string; packageKey:string; entityType:string; nativeIdentifier:string; name:string; definition:string; sourceSheet:string };
type Row = Record<string, unknown>;
const output = new Map<string, RecordOut>();
const entitySpecs = [
  ["tagClass","tag_class","tagClassId","tagClassName","tagClassDefinition"],
  ["equipmentClass","equipment_class","equipmentClassId","equipmentClassName","equipmentClassDefinition"],
  ["property","property","propertyId","propertyName","propertyDefinition"],
  ["documentType","document_type","documentId","documentName","documentDefinition"],
  ["discipline","discipline","disciplineId","disciplineName","disciplineDescription"],
  ["unit","unit_of_measure","unitId","unitName","unitDescription"],
  ["sourceStandard","source_standard","sourceStandardId","sourceStandardName","sourceStandardDescription"],
  ["handoverEvent","handover_event","handoverId","handoverName","handoverDescription"],
  ["informationRequirement","information_requirement","informationRequirementId","informationRequirementTitle","informationRequirementDescription"],
] as const;
function stable(source:string,kind:string,parts:string[]){const seed=parts.map(x=>x.trim().toLowerCase()).join("|");return `${source}:${kind}:${createHash("sha256").update(seed).digest("hex").slice(0,16)}`;}
function add(sourceKey:string,sourceName:string,releaseKey:string,releaseStatus:string,versionLabel:string,packageKey:string,entityType:string,nativeIdentifier:string,name:string,definition:string,sourceSheet:string){if(!nativeIdentifier)return;const record={sourceKey,sourceName,releaseKey,releaseStatus,versionLabel,packageKey,entityType,nativeIdentifier,name:name||nativeIdentifier,definition,sourceSheet};output.set(`${packageKey}:${entityType}:${nativeIdentifier}`,record);}
function addProfile(profile:RdlWorkbookMappingProfile){
  const projectedStatus = profile.releaseKey.endsWith("0.1-draft") ? "superseded" : profile.releaseStatus;
  const bytes=readFileSync(profile.workbookPath);const sha=createHash("sha256").update(bytes).digest("hex");const packageKey=`${profile.sourceKey}-${profile.versionLabel.replace(/[^a-z0-9]+/gi,"-").toLowerCase()}-${sha.slice(0,12)}`;const wb=XLSX.read(bytes,{type:"buffer"});
  const rows=(key:string):Row[]=>{const sheet=wb.Sheets[profile.sheetNames[key]];return sheet?XLSX.utils.sheet_to_json<Row>(sheet,{defval:null,raw:false}):[];};
  const t=(r:Row,f:string)=>mappedText(r,profile.fields[f]??[f]);
  for(const [sheetKey,type,idField,nameField,defField] of entitySpecs){for(const r of rows(sheetKey)){add(profile.sourceKey,profile.sourceName,profile.releaseKey,projectedStatus,profile.versionLabel,packageKey,type,t(r,idField),t(r,nameField),t(r,defField),profile.sheetNames[sheetKey]);}}
  for(const r of rows("controlledValue")){const list=t(r,"picklistId"),value=t(r,"picklistValueCode"),seq=t(r,"picklistValueSequence");const id=t(r,"picklistValueId")||stable(profile.sourceKey,"controlled-value",[list,value,seq]);add(profile.sourceKey,profile.sourceName,profile.releaseKey,projectedStatus,profile.versionLabel,packageKey,"controlled_value",id,value||id,t(r,"picklistValueDescription"),profile.sheetNames.controlledValue);}
}
const snapshot=JSON.parse(readFileSync("public/cfihos-workbook.json","utf8")) as any;const csha=String(snapshot.source.sha256);const cpkg=`cfihos-2.0-${csha.slice(0,12)}`;const cfSpecs:any[]=[
["tag class","tag_class","CFIHOS unique code","tag class name","tag class definition"],["equipment class","equipment_class","equipment class CFIHOS unique code","equipment class name","equipment class definition"],["property","property","CFIHOS unique code","property name","property definition"],["document type","document_type","CFIHOS unique code","document type name","document type description"],["discipline","discipline","CFIHOS unique code","discipline name","discipline description"],["unit of measure","unit_of_measure","CFIHOS unique code","unit of measure name","unit of measure description"],["source standard","source_standard","CFIHOS unique code","source standard code","source standard description"],["handover event","handover_event","CFIHOS unique code","handover event name","handover event description"],["property picklist values","controlled_value","property picklist value CFIHOS unique code","property picklist value code","property picklist value description"],["Jip33 info required spec","information_requirement","Source standard document and data requirement CFIHOS unique code","source standard document and data requirement title","source standard document and data requirement description"]];
for(const [sheet,type,idf,nf,df] of cfSpecs){for(const r of snapshot.sheets[sheet]?.rows??[]){add("cfihos","CFIHOS","cfihos-2.0","reviewed","2.0",cpkg,type,String(r[idf]??"").trim(),String(r[nf]??"").trim(),String(r[df]??"").trim(),sheet);}}
addProfile(CCUS_CFIHOS_FORMAT_PROFILE);
addProfile(CCUS_V2_CFIHOS_FORMAT_PROFILE);
addProfile(WATER_DESALINATION_PROFILE);
addProfile(WATER_DESALINATION_V2_CFIHOS_FORMAT_PROFILE);
const records=[...output.values()].sort((a,b)=>a.sourceKey.localeCompare(b.sourceKey)||a.releaseKey.localeCompare(b.releaseKey)||a.entityType.localeCompare(b.entityType)||a.nativeIdentifier.localeCompare(b.nativeIdentifier));
writeFileSync("public/rdl-search-index.json",JSON.stringify(records));
console.log(`Generated ${records.length} release-aware RDL search records.`);
