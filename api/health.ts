import { beginApiRequest, completeApiRequest, type RuntimeRequest, type RuntimeResponse } from "./_runtime.ts";

export default async function handler(request: RuntimeRequest, response: RuntimeResponse) {
  const context = beginApiRequest(request, response, "health");
  completeApiRequest(context, 200);
  response.status(200).json({
    ok: true,
    service: "rdl-explorer",
    check: "liveness",
    release: process.env.RDL_RELEASE_ID?.trim() || undefined,
  });
}
