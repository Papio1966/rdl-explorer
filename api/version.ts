import { getBuildMetadata } from "../server/runtime/BuildMetadata.ts";
import { beginApiRequest, completeApiRequest, type RuntimeRequest, type RuntimeResponse } from "./_runtime.ts";

export default async function handler(request: RuntimeRequest, response: RuntimeResponse) {
  const context = beginApiRequest(request, response, "version");
  if (request.method && request.method !== "GET") {
    completeApiRequest(context, 405);
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  const build = getBuildMetadata();
  completeApiRequest(context, 200, { releaseId: build.releaseId, commitSha: build.commitSha });
  response.status(200).json({ ok: true, ...build });
}
