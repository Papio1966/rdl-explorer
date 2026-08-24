export type CfihosTagClass = {
  id: string;
  name: string;
  definition: string | null;

  parentName: string | null;
  parentId: string | null;

  abstract: boolean;

  tagNumberFormat: string | null;

  equipmentExpected: boolean;

  existenceReason: string | null;

  synonyms: string[];
};

export type CfihosTagClassTreeNode = CfihosTagClass & {
  children: CfihosTagClassTreeNode[];
};