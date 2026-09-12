import { beginApiRequest, completeApiRequest, queryValue } from "../_shared/request.ts";
import { authenticatedDistributionContext, handleApiError, type ApiRequest, type ApiResponse } from "./_shared.ts";

const RDL_DISTRIBUTION_CONTRACT_ID = "rdl-distribution-consumer";
const RDL_DISTRIBUTION_CONTRACT_VERSION = "v1";
const RDL_DISTRIBUTION_MANIFEST_SCHEMA_VERSION = "rdl-distribution-manifest/v1";
const DATAGATE_CONSUMER_BOUNDARY = "DataGate is a read-only API/contract consumer; no direct DataGate-to-RDL database mutation is allowed.";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback = ""): string {
  const rendered = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return rendered || fallback;
}

function checksumFrom(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = text(record[key]);
    if (value) return value;
  }
  return "";
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "distribution.manifest");
  if (request.method !== "GET") {
    completeApiRequest(context, 405);
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  try {
    const { service } = authenticatedDistributionContext(request, context);
    const releaseId = Number(queryValue(request.query?.id));
    if (!Number.isFinite(releaseId) || releaseId <= 0) {
      completeApiRequest(context, 400, { contractId: RDL_DISTRIBUTION_CONTRACT_ID });
      response.status(400).json({ error: "A valid releaseId is required.", contractId: RDL_DISTRIBUTION_CONTRACT_ID, contractVersion: RDL_DISTRIBUTION_CONTRACT_VERSION });
      return;
    }

    const rawManifest = await service.manifest(releaseId);
    if (!rawManifest) throw new Error("A valid releaseId is required.");

    const manifest = asRecord(rawManifest);
    const release = asRecord(manifest.release);
    const integrity = asRecord(manifest.integrity);
    const generatedAt = new Date().toISOString();
    const manifestChecksum = checksumFrom(integrity, ["manifestChecksum", "compositionSha256", "manifestSha256"]) || checksumFrom(manifest, ["manifestChecksum", "compositionSha256", "distributionSha256"]);
    const distributionChecksum = checksumFrom(integrity, ["distributionChecksum", "distributionSha256"]) || checksumFrom(manifest, ["distributionChecksum", "distributionSha256"]);
    const releaseKey = text(release.releaseKey, text(manifest.releaseKey, `release-${releaseId}`));
    const releaseVersion = text(release.releaseVersion, text(manifest.releaseVersion, "unknown"));
    const publicationStatus = text(release.lifecycleStatus, text(release.publicationStatus, text(manifest.publicationStatus, "published")));
    const etagValue = `sha256-${manifestChecksum || distributionChecksum || releaseId}`;

    response.setHeader?.("ETag", `"${etagValue}"`);
    response.setHeader?.("X-RDL-Distribution-Contract", `${RDL_DISTRIBUTION_CONTRACT_ID}/${RDL_DISTRIBUTION_CONTRACT_VERSION}`);
    response.setHeader?.("X-RDL-Read-Only-Consumer", "true");
    completeApiRequest(context, 200, { releaseId, contractId: RDL_DISTRIBUTION_CONTRACT_ID, contractVersion: RDL_DISTRIBUTION_CONTRACT_VERSION });
    response.status(200).json({
      ...manifest,
      schemaVersion: RDL_DISTRIBUTION_MANIFEST_SCHEMA_VERSION,
      contractId: RDL_DISTRIBUTION_CONTRACT_ID,
      contractVersion: RDL_DISTRIBUTION_CONTRACT_VERSION,
      generatedAt,
      releaseIdentity: { releaseId, releaseKey, releaseVersion, publicationStatus },
      consumerContract: {
        contractId: RDL_DISTRIBUTION_CONTRACT_ID,
        contractVersion: RDL_DISTRIBUTION_CONTRACT_VERSION,
        schemaVersion: RDL_DISTRIBUTION_MANIFEST_SCHEMA_VERSION,
        consumerAccess: "read-only API/contract consumption",
        dataGateBoundary: DATAGATE_CONSUMER_BOUNDARY,
        directDatabaseMutation: "prohibited",
        staleContentDetection: ["contractId", "contractVersion", "releaseId", "releaseKey", "releaseVersion", "manifestChecksum", "distributionChecksum", "ETag"],
      },
      integrity: { ...integrity, manifestChecksum, distributionChecksum, etag: etagValue },
    });
  } catch (error) {
    handleApiError(response, error, context);
  }
}
