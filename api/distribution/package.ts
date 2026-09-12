import { beginApiRequest, completeApiRequest, queryValue } from "../_shared/request.ts";
import { authenticatedDistributionContext, handleApiError, type ApiRequest, type ApiResponse } from "./_shared.ts";

const RDL_DISTRIBUTION_CONTRACT_ID = "rdl-distribution-consumer";
const RDL_DISTRIBUTION_CONTRACT_VERSION = "v1";
const RDL_DISTRIBUTION_PACKAGE_SCHEMA_VERSION = "rdl-distribution-package/v1";
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

function safeToken(value: string, fallback: string): string {
  return (value || fallback).replace(/[^A-Za-z0-9_.-]+/g, "-");
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "distribution.package");
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

    const rawPackage = await service.package(releaseId);
    if (!rawPackage) throw new Error("A valid releaseId is required.");

    const pkg = asRecord(rawPackage);
    const release = asRecord(pkg.release);
    const integrity = asRecord(pkg.integrity);
    const generatedAt = new Date().toISOString();
    const releaseKey = text(release.releaseKey, text(pkg.releaseKey, `release-${releaseId}`));
    const releaseVersion = text(release.releaseVersion, text(pkg.releaseVersion, "unknown"));
    const publicationStatus = text(release.lifecycleStatus, text(release.publicationStatus, text(pkg.publicationStatus, "published")));
    const packageChecksum = checksumFrom(pkg, ["packageChecksum", "packageSha256"]) || checksumFrom(integrity, ["packageChecksum", "packageSha256"]);
    const manifestChecksum = checksumFrom(pkg, ["manifestChecksum", "compositionSha256"]) || checksumFrom(integrity, ["manifestChecksum", "compositionSha256", "manifestSha256"]);
    const distributionChecksum = checksumFrom(pkg, ["distributionChecksum", "distributionSha256"]) || checksumFrom(integrity, ["distributionChecksum", "distributionSha256"]) || packageChecksum || manifestChecksum;
    const etagValue = `sha256-${distributionChecksum || releaseId}`;
    const effectiveEntities = Array.isArray(pkg.effectiveEntities) ? pkg.effectiveEntities : [];

    response.setHeader?.("Content-Disposition", `attachment; filename=rdl-distribution-${safeToken(releaseKey, "release")}-${safeToken(releaseVersion, "version")}.json`);
    response.setHeader?.("ETag", `"${etagValue}"`);
    response.setHeader?.("X-RDL-Distribution-Contract", `${RDL_DISTRIBUTION_CONTRACT_ID}/${RDL_DISTRIBUTION_CONTRACT_VERSION}`);
    response.setHeader?.("X-RDL-Read-Only-Consumer", "true");
    completeApiRequest(context, 200, { releaseId, entityCount: effectiveEntities.length, contractId: RDL_DISTRIBUTION_CONTRACT_ID, contractVersion: RDL_DISTRIBUTION_CONTRACT_VERSION });
    response.status(200).json({
      ...pkg,
      schemaVersion: RDL_DISTRIBUTION_PACKAGE_SCHEMA_VERSION,
      contractId: RDL_DISTRIBUTION_CONTRACT_ID,
      contractVersion: RDL_DISTRIBUTION_CONTRACT_VERSION,
      generatedAt,
      releaseIdentity: { releaseId, releaseKey, releaseVersion, publicationStatus },
      packageIdentity: { packageChecksum, manifestChecksum, distributionChecksum, etag: etagValue, contentType: "application/vnd.rdl.distribution+json" },
      consumerContract: {
        contractId: RDL_DISTRIBUTION_CONTRACT_ID,
        contractVersion: RDL_DISTRIBUTION_CONTRACT_VERSION,
        schemaVersion: RDL_DISTRIBUTION_PACKAGE_SCHEMA_VERSION,
        consumerAccess: "read-only API/contract consumption",
        dataGateBoundary: DATAGATE_CONSUMER_BOUNDARY,
        directDatabaseMutation: "prohibited",
        staleContentDetection: ["contractId", "contractVersion", "releaseId", "releaseKey", "releaseVersion", "packageChecksum", "manifestChecksum", "distributionChecksum", "ETag"],
      },
      integrity: { ...integrity, packageChecksum, manifestChecksum, distributionChecksum, etag: etagValue },
    });
  } catch (error) {
    handleApiError(response, error, context);
  }
}
