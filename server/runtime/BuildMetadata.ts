export type BuildMetadata = {
  service: "rdl-explorer";
  version: string;
  releaseId?: string;
  commitSha?: string;
  environment: string;
  builtAt?: string;
};

export function getBuildMetadata(env: NodeJS.ProcessEnv = process.env): BuildMetadata {
  return {
    service: "rdl-explorer",
    version: env.RDL_BUILD_VERSION?.trim() || "0.0.0",
    releaseId: nonEmpty(env.RDL_RELEASE_ID),
    commitSha: nonEmpty(env.RDL_COMMIT_SHA) ?? nonEmpty(env.VERCEL_GIT_COMMIT_SHA),
    environment: nonEmpty(env.RDL_RUNTIME_ENV) ?? nonEmpty(env.VERCEL_ENV) ?? "development",
    builtAt: nonEmpty(env.RDL_BUILD_TIMESTAMP),
  };
}

function nonEmpty(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}
