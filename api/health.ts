export type HealthResponse = { status(code: number): HealthResponse; json(value: unknown): void; setHeader?(name: string, value: string | number): void };

export default async function handler(_request: unknown, response: HealthResponse) {
  response.setHeader?.("Cache-Control", "no-store");
  response.status(200).json({ ok: true, service: "rdl-explorer", check: "liveness" });
}
