import { cfihosClassDocumentRepository } from "../repository/CfihosClassDocumentRepository";
import { cfihosDocumentRepository } from "../repository/CfihosDocumentRepository";
import { cfihosEquipmentRepository } from "../repository/CfihosEquipmentRepository";
import { cfihosRepository } from "../repository/CfihosRepository";
import { cfihosSourceStandardRepository } from "../repository/CfihosSourceStandardRepository";
import type { CisClassSelection } from "./projectInformationProfile";
import type {
  CisClassDocumentRecord,
  CisClassStandardRecord,
  CisDerivationDataSource,
  CisDisciplineDocumentRecord,
  CisPropertyRecord,
  CisPropertyStandardRecord,
  CisSourceStandardRecord,
} from "./CisDerivationService";

export class CfihosCisDerivationDataSource implements CisDerivationDataSource {
  async resolveClass(selection: CisClassSelection) {
    return selection.domain === "tag"
      ? cfihosRepository.getTagClass(selection.classId)
      : cfihosEquipmentRepository.getEquipmentClass(selection.classId);
  }

  async getEffectiveProperties(
    selection: CisClassSelection,
  ): Promise<CisPropertyRecord[]> {
    if (selection.domain === "tag") {
      const values = await cfihosRepository.getEffectiveTagClassProperties(
        selection.classId,
      );
      return values.map((item) => ({
        property: item.property,
        assignmentType: item.assignmentType,
        inheritanceDepth: item.inheritanceDepth,
        sourceClassId: item.sourceTagClassId,
        sourceClassName: item.sourceTagClassName,
        picklistValues: item.picklistValues,
      }));
    }

    const values = await cfihosEquipmentRepository.getEffectiveEquipmentClassProperties(
      selection.classId,
    );
    return values.map((item) => ({
      property: item.property,
      assignmentType: item.assignmentType,
      inheritanceDepth: item.inheritanceDepth,
      sourceClassId: item.sourceEquipmentClassId,
      sourceClassName: item.sourceEquipmentClassName,
      picklistValues: item.picklistValues,
    }));
  }

  /**
   * CIS semantics differ deliberately from the Tag/Equipment browser methods.
   * A contract profile needs every `document required per class` row that
   * references the selected CFIHOS object ID, regardless of whether that row's
   * asset context is Plant, Process Unit, Tag, Equipment or Model / Part.
   */
  async getClassDocumentRequirements(
    selection: CisClassSelection,
  ): Promise<CisClassDocumentRecord[]> {
    const requested = canonicalizeCfihosId(selection.classId);
    const values = await cfihosClassDocumentRepository.getResolvedRequirements();

    return values
      .filter(
        (item) =>
          canonicalizeCfihosId(item.requirement.classId) === requested,
      )
      .map((item) => ({
        requirementId: item.requirement.id,
        referencedClassId: item.requirement.classId,
        referencedClassName: item.requirement.className,
        assetContext: item.requirement.assetType,
        documentTypeId: item.requirement.documentTypeId,
        documentTypeName: item.requirement.documentTypeName,
        sourceStandardId: item.requirement.sourceStandardId,
        sourceStandardCode: item.requirement.sourceStandardCode,
      }));
  }

  async getClassStandards(
    selection: CisClassSelection,
  ): Promise<CisClassStandardRecord[]> {
    const values = await cfihosSourceStandardRepository.getStandardsForClass(
      selection.classId,
    );

    return values.flatMap((item) =>
      explodeStandardReference(
        item.sourceStandardId,
        item.sourceStandardCode,
      ),
    );
  }

  async getPropertyStandardsForClass(
    selection: CisClassSelection,
  ): Promise<CisPropertyStandardRecord[]> {
    const values =
      await cfihosSourceStandardRepository.getPropertyStandardsForClass(
        selection.classId,
      );

    return values.flatMap((item) =>
      explodeStandardReference(
        item.sourceStandardId,
        item.sourceStandardCode,
      ).map((standard) => ({
        propertyId: item.propertyId,
        propertyName: item.propertyName,
        sourceStandardId: standard.sourceStandardId,
        sourceStandardCode: standard.sourceStandardCode,
        sourceStandardSection: item.sourceStandardSection,
      })),
    );
  }

  async getSourceStandard(id: string): Promise<CisSourceStandardRecord | null> {
    return cfihosSourceStandardRepository.getSourceStandard(id);
  }

  async getDisciplineDocumentRelationships(): Promise<
    CisDisciplineDocumentRecord[]
  > {
    return cfihosDocumentRepository.getRelationships();
  }
}

function explodeStandardReference(
  rawIds: string,
  rawCodes: string,
): CisClassStandardRecord[] {
  const ids = splitSemicolonList(rawIds);
  const codes = splitSemicolonList(rawCodes);

  return ids.map((sourceStandardId, index) => ({
    sourceStandardId,
    sourceStandardCode:
      cleanPairedCode(codes[index]) ??
      cleanPairedCode(codes.length === 1 ? codes[0] : null) ??
      "",
  }));
}

function splitSemicolonList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanPairedCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/^\(+/, "").replace(/\)+$/, "").trim();
  return cleaned || null;
}

function canonicalizeCfihosId(value: string): string {
  const normalized = value.trim().toUpperCase();
  const match = /^CFIHOS-(\d+)$/.exec(normalized);

  if (!match) return normalized;

  const digits = match[1];
  if (digits.length === 8) return `CFIHOS-${digits}`;
  if (digits.length > 8) return `CFIHOS-${digits[0]}${digits.slice(-7)}`;
  if (digits.length > 1) {
    return `CFIHOS-${digits[0]}${digits.slice(1).padStart(7, "0")}`;
  }
  return `CFIHOS-${digits.padEnd(8, "0")}`;
}

export const cfihosCisDerivationDataSource =
  new CfihosCisDerivationDataSource();
