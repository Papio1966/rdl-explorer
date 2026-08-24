export type CfihosLifecyclePhaseKey =
  | "detailed-engineering"
  | "construction"
  | "commissioning"
  | "startup"
  | "operations";

export type CfihosHandoverEvent = {
  id: string;
  name: string;
  description: string | null;
  reportingSequence: number | null;
  lifecyclePhaseKey: CfihosLifecyclePhaseKey;
};

export type CfihosHandoverEventDiagnostics = {
  sourceRowCount: number;
  eventCount: number;
  mappedLifecycleEventCount: number;

  duplicateIdCount: number;
  duplicateNameCount: number;
  duplicateSequenceCount: number;
  missingSequenceCount: number;
  invalidSequenceCount: number;

  expectedLifecyclePhaseCount: number;
  missingExpectedLifecyclePhaseCount: number;
  unmappedEventCount: number;
  sequenceMatchesLifecycleOrder: boolean;

  lifecycleRelationshipCount: number;
  lifecycleRelationshipsWithAnyStatusCount: number;

  missingExpectedLifecyclePhases: CfihosLifecyclePhaseKey[];
  unmappedEventNames: string[];

  events: CfihosHandoverEvent[];
};
