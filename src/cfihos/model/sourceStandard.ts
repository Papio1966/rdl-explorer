export type CfihosClassDomain =
  | "tag"
  | "equipment"
  | "tag-and-equipment"
  | "unknown";

export type CfihosClassMatchMethod =
  | "id"
  | "name"
  | null;

export type CfihosSourceStandard = {
  id: string;
  code: string;
  description: string | null;

  stillToBeCompleted: boolean;
};

export type CfihosResolvedClassReference = {
  /*
   * These are the raw values exactly as supplied
   * by the Source Standards relationship sheet.
   */
  classId: string;
  className: string;

  /*
   * Resolution is deliberately independent for
   * Tag and Equipment Classes.
   *
   * A CFIHOS class reference may legitimately
   * resolve to both domains.
   */
  classDomain: CfihosClassDomain;

  tagClassId: string | null;
  equipmentClassId: string | null;

  tagMatchMethod: CfihosClassMatchMethod;
  equipmentMatchMethod: CfihosClassMatchMethod;
};

export type CfihosClassSourceStandard =
  CfihosResolvedClassReference & {
    sourceStandardId: string;
    sourceStandardCode: string;
  };

export type CfihosClassPropertySourceStandard =
  CfihosResolvedClassReference & {
    id: string;

    propertyId: string;
    propertyName: string;

    sourceStandardId: string;
    sourceStandardCode: string;

    sourceStandardSection: string | null;

    propertyNameInSourceStandard: string | null;

    propertySequenceNumber: string | null;
  };

export type CfihosSourceStandardPicklistValue = {
  picklistId: string;
  picklistName: string;

  valueId: string;
  valueCode: string;
  valueDescription: string | null;

  sourceStandardId: string;
  sourceStandardCode: string;
};

export type CfihosSourceStandardUsage = {
  standard: CfihosSourceStandard;

  classRelationships:
    CfihosClassSourceStandard[];

  propertyRelationships:
    CfihosClassPropertySourceStandard[];

  picklistValues:
    CfihosSourceStandardPicklistValue[];
};

export type CfihosSourceStandardDiagnostics = {
  sourceStandardCount: number;

  classRelationshipCount: number;
  propertyRelationshipCount: number;
  picklistValueReferenceCount: number;

  /*
   * These retain the names used by the current
   * diagnostics page.
   *
   * A dual-domain relationship contributes to
   * both the Tag and Equipment counts.
   */
  tagClassRelationshipCount: number;
  equipmentClassRelationshipCount: number;
  unknownClassRelationshipCount: number;

  tagClassPropertyRelationshipCount: number;
  equipmentClassPropertyRelationshipCount: number;
  unknownClassPropertyRelationshipCount: number;

  unresolvedStandardClassRelationshipCount: number;
  unresolvedStandardPropertyRelationshipCount: number;
  unresolvedStandardPicklistReferenceCount: number;

  standardsWithoutUsageCount: number;

  /*
   * Additional diagnostics for the improved
   * multi-domain resolver.
   */
  dualClassRelationshipCount: number;
  dualClassPropertyRelationshipCount: number;

  classRelationshipsMatchedByNameCount: number;
  propertyRelationshipsMatchedByNameCount: number;
};