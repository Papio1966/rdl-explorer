export type ProposalBundleReviewState = "ready_for_review" | "incomplete_fail_closed" | "invalid_fail_closed" | "terminal";

export type ProposalBundleQueueItem = {
  proposalBundleId: number;
  proposalKey: string;
  sourceSystem: string;
  requestKey: string;
  targetLevel: string;
  targetContextKey: string;
  parentPackageKey: string;
  validationStatus: string;
  completenessStatus: "complete" | "incomplete_candidate";
  componentCount: number;
  dependencyCount: number;
  missingDependencyCount: number;
  proposalStatus: string;
  reviewVersion: number;
  createdAt: string;
  reviewState: ProposalBundleReviewState;
  canAccept: boolean;
  failClosedReason?: string;
};

export type ProposalBundleDetail = ProposalBundleQueueItem & {
  components: Array<{ componentKey: string; componentKind: string; entityTypeCode: string; nativeIdentifier: string; componentStatus: string }>;
  dependencies: Array<{ dependencyKey: string; sourceComponentKey: string; dependencyType: string; required: boolean; satisfiedBy: string }>;
  events: Array<{ action: string; actorKey: string; rationale: string; occurredAt: string }>;
  governanceBoundary: {
    acceptanceDoesNotPublish: true;
    promotionAuthority: "RDL_EXPLORER_ONLY";
    publicationAuthority: "RDL_EXPLORER_ONLY";
    directDataGateDatabaseMutation: "PROHIBITED";
  };
};

export function proposalBundleBadge(bundle: Pick<ProposalBundleQueueItem, "reviewState" | "missingDependencyCount">): string {
  if (bundle.reviewState === "ready_for_review") return "Ready for review";
  if (bundle.reviewState === "incomplete_fail_closed") return bundle.missingDependencyCount > 0 ? `${bundle.missingDependencyCount} missing dependencies` : "Incomplete candidate";
  if (bundle.reviewState === "invalid_fail_closed") return "Invalid - fail closed";
  return "Terminal";
}

export function proposalBundleCanBeAccepted(bundle: Pick<ProposalBundleQueueItem, "canAccept" | "completenessStatus" | "missingDependencyCount" | "validationStatus">): boolean {
  return bundle.canAccept && bundle.validationStatus === "schema_validated" && bundle.completenessStatus === "complete" && bundle.missingDependencyCount === 0;
}

export async function fetchProposalBundleQueue(fetcher: typeof fetch, query: URLSearchParams = new URLSearchParams()): Promise<ProposalBundleQueueItem[]> {
  const response = await fetcher(`/api/proposals/bundle-queue${query.toString() ? `?${query}` : ""}`);
  if (!response.ok) throw new Error(`Unable to load proposal bundle queue: ${response.status}`);
  const payload = await response.json() as { bundles?: ProposalBundleQueueItem[] };
  return payload.bundles ?? [];
}

export async function fetchProposalBundleDetail(fetcher: typeof fetch, proposalBundleId: number): Promise<ProposalBundleDetail> {
  const response = await fetcher(`/api/proposals/bundle-detail?proposalBundleId=${encodeURIComponent(String(proposalBundleId))}`);
  if (!response.ok) throw new Error(`Unable to load proposal bundle detail: ${response.status}`);
  const payload = await response.json() as { detail?: ProposalBundleDetail };
  if (!payload.detail) throw new Error("Proposal bundle detail response was empty.");
  return payload.detail;
}
