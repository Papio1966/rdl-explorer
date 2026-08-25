export type GovernanceSession = {
  authenticated: boolean;
  reviewer: string;
  roles: string[];
  authenticatedAt: string;
};

export type LiveGovernanceQueueItem = {
  mappingId: number;
  status: string;
  reviewVersion: number;
  mappingType: string;
  provenanceMethod: string;
  confidence: number;
  sourceKey: string;
  sourceEntityType: string;
  sourceNativeIdentifier: string;
  sourceName: string;
  targetKey: string;
  targetEntityType: string;
  targetNativeIdentifier: string;
  targetName: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRationale?: string;
};

export type GovernanceReviewAction = "approve" | "reject" | "supersede";

export async function loadGovernanceSession(): Promise<GovernanceSession | null> {
  const response = await fetch("/api/governance/session", { credentials: "same-origin", headers: { Accept: "application/json" } });
  if (response.status === 401 || response.status === 403 || response.status === 503) return null;
  if (!response.ok) throw new Error("Governance session check failed.");
  return response.json();
}

export async function loadLiveGovernanceQueue(status: string): Promise<LiveGovernanceQueueItem[]> {
  const response = await fetch(`/api/governance/queue?status=${encodeURIComponent(status)}&limit=500`, { credentials: "same-origin", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Live governance queue could not be loaded.");
  const body = await response.json() as { items?: LiveGovernanceQueueItem[] };
  return body.items ?? [];
}

export async function submitGovernanceReview(input: {
  mappingId: number;
  action: GovernanceReviewAction;
  rationale: string;
  expectedVersion: number;
  successorMappingId?: number;
}) {
  const response = await fetch("/api/governance/review", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => ({})) as { error?: string; result?: { mapping_id?: number; status?: string; review_version?: number } };
  if (!response.ok) throw new Error(body.error || "Governance review failed.");
  return body.result ?? {};
}
