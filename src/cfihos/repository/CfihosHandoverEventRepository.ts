import type { CfihosWorksheetRow } from "../workbook";
import {
  loadCfihosHandoverEventSource,
  type CfihosHandoverEventSource,
} from "../runtimeCompatibility";
import {
  normalizeOptionalString,
  normalizeRequiredString,
} from "../model/common";
import type {
  CfihosHandoverEvent,
  CfihosHandoverEventDiagnostics,
  CfihosLifecyclePhaseKey,
} from "../model/handoverEvent";

const EXPECTED_PHASE_ORDER: CfihosLifecyclePhaseKey[] = [
  "detailed-engineering",
  "construction",
  "commissioning",
  "startup",
  "operations",
];

type HandoverEventRepositoryState = {
  events: CfihosHandoverEvent[];
  diagnostics: CfihosHandoverEventDiagnostics;
};

export class CfihosHandoverEventRepository {
  private state: HandoverEventRepositoryState | null = null;
  private loadingPromise: Promise<HandoverEventRepositoryState> | null = null;
  private readonly sourceLoader: () => Promise<CfihosHandoverEventSource>;

  constructor(
    sourceLoader: () => Promise<CfihosHandoverEventSource> = loadCfihosHandoverEventSource,
  ) {
    this.sourceLoader = sourceLoader;
  }

  async initialize(): Promise<void> {
    await this.getState();
  }

  async getHandoverEvents(): Promise<CfihosHandoverEvent[]> {
    const state = await this.getState();
    return state.events;
  }

  async getDiagnostics(): Promise<CfihosHandoverEventDiagnostics> {
    const state = await this.getState();
    return state.diagnostics;
  }

  private async getState(): Promise<HandoverEventRepositoryState> {
    if (this.state) return this.state;
    if (!this.loadingPromise) this.loadingPromise = this.loadState();

    try {
      this.state = await this.loadingPromise;
      return this.state;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async loadState(): Promise<HandoverEventRepositoryState> {
    const source = await this.sourceLoader();
    const rows = source.rows;

    const rawEvents = rows
      .map((row) => this.buildEvent(row))
      .filter((event): event is CfihosHandoverEvent => event !== null);

    const events = [...rawEvents].sort(compareHandoverEvents);

    const ids = events.map((event) => normalizeKey(event.id));
    const names = events.map((event) => normalizeKey(event.name));
    const sequences = events
      .map((event) => event.reportingSequence)
      .filter((value): value is number => value !== null && Number.isFinite(value));

    const mappedKeys = new Set(events.map((event) => event.lifecyclePhaseKey));
    const missingExpectedLifecyclePhases = EXPECTED_PHASE_ORDER.filter(
      (phase) => !mappedKeys.has(phase),
    );

    const unmappedEventNames = rows
      .map((row) => normalizeRequiredString(row["handover event name"]))
      .filter((name) => name.length > 0 && mapLifecyclePhaseKey(name) === null)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    const sequenceMatchesLifecycleOrder =
      events.length === EXPECTED_PHASE_ORDER.length &&
      events.every(
        (event, index) =>
          event.lifecyclePhaseKey === EXPECTED_PHASE_ORDER[index] &&
          event.reportingSequence === index + 1,
      );

    const diagnostics: CfihosHandoverEventDiagnostics = {
      sourceRowCount: rows.length,
      eventCount: events.length,
      mappedLifecycleEventCount: events.length,
      duplicateIdCount: countDuplicateValues(ids),
      duplicateNameCount: countDuplicateValues(names),
      duplicateSequenceCount: countDuplicateNumbers(sequences),
      missingSequenceCount: events.filter((event) => event.reportingSequence === null).length,
      invalidSequenceCount: events.filter(
        (event) =>
          event.reportingSequence !== null &&
          (!Number.isInteger(event.reportingSequence) || event.reportingSequence <= 0),
      ).length,
      expectedLifecyclePhaseCount: EXPECTED_PHASE_ORDER.length,
      missingExpectedLifecyclePhaseCount: missingExpectedLifecyclePhases.length,
      unmappedEventCount: unmappedEventNames.length,
      sequenceMatchesLifecycleOrder,
      lifecycleRelationshipCount: source.lifecycleRelationshipCount,
      lifecycleRelationshipsWithAnyStatusCount:
        source.lifecycleRelationshipsWithAnyStatusCount,
      missingExpectedLifecyclePhases,
      unmappedEventNames,
      events,
    };

    return { events, diagnostics };
  }

  private buildEvent(row: CfihosWorksheetRow): CfihosHandoverEvent | null {
    const id = normalizeRequiredString(row["CFIHOS unique code"]);
    const name = normalizeRequiredString(row["handover event name"]);
    const lifecyclePhaseKey = mapLifecyclePhaseKey(name);

    if (!id || !name || !lifecyclePhaseKey) return null;

    return {
      id,
      name,
      description: normalizeOptionalString(row["handover event description"]),
      reportingSequence: normalizeSequence(row["handover event reporting sequence number"]),
      lifecyclePhaseKey,
    };
  }
}

function mapLifecyclePhaseKey(name: string): CfihosLifecyclePhaseKey | null {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/^handover\s+for\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (normalized === "detailed engineering") return "detailed-engineering";
  if (normalized === "construction") return "construction";
  if (normalized === "commissioning") return "commissioning";
  if (normalized === "start up" || normalized === "startup") return "startup";
  if (normalized === "operations" || normalized === "operation") return "operations";

  return null;
}

function normalizeSequence(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function countDuplicateValues(values: string[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const value of values) {
    if (seen.has(value)) duplicates += 1;
    else seen.add(value);
  }
  return duplicates;
}

function countDuplicateNumbers(values: number[]): number {
  return countDuplicateValues(values.map(String));
}

function compareHandoverEvents(a: CfihosHandoverEvent, b: CfihosHandoverEvent): number {
  const aSequence = a.reportingSequence ?? Number.MAX_SAFE_INTEGER;
  const bSequence = b.reportingSequence ?? Number.MAX_SAFE_INTEGER;
  if (aSequence !== bSequence) return aSequence - bSequence;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

export const cfihosHandoverEventRepository = new CfihosHandoverEventRepository();
