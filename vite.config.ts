import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function localSchemaDictionaryApi() {
  let handlerPromise: Promise<(request: any, response: any) => Promise<void>> | undefined;
  return {
    name: "local-schema-dictionary-api",
    configureServer(server: any) {
      server.middlewares.use((request: any, response: any, next: () => void) => {
        const url = new URL(request.url ?? "/", "http://rdl-explorer.local");
        if (url.pathname !== "/api/rdl-runtime/schema-dictionary") {
          next();
          return;
        }
        const run = async () => {
          handlerPromise ??= server.ssrLoadModule("/api/rdl-runtime/schema-dictionary.ts")
            .then((module: any) => module.default);
          const handler = await handlerPromise;
          const apiResponse: any = {};
          apiResponse.status = (code: number) => {
            response.statusCode = code;
            return apiResponse;
          };
          apiResponse.json = (value: unknown) => {
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify(value));
          };
          apiResponse.setHeader = (name: string, value: string | number) => {
            response.setHeader(name, String(value));
          };
          await handler({
            method: request.method,
            headers: request.headers,
            query: Object.fromEntries(url.searchParams.entries()),
          }, apiResponse);
        };
        void run().catch(() => {
          if (response.writableEnded) return;
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: "Local Schema Dictionary runtime failed." }));
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localSchemaDictionaryApi()],
});