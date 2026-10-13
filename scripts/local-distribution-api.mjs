import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.env.RDL_LOCAL_REPO || process.cwd());
const port = Number(process.env.RDL_LOCAL_PORT || "43121");
const host = "127.0.0.1";
const routeFiles = {
  "/api/distribution/manifest": "api/distribution/manifest.ts",
  "/api/distribution/package": "api/distribution/package.ts",
  "/api/distribution/entities": "api/distribution/entities.ts",
  "/api/distribution/catalogue": "api/distribution/catalogue.ts",
  "/api/distribution/session": "api/distribution/session.ts",
};
const modules = new Map();

function responseBytes(value, encoding) {
  if (value === undefined || value === null || typeof value === "function") return Buffer.alloc(0);
  if (Buffer.isBuffer(value)) return value;
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  return Buffer.from(String(value), typeof encoding === "string" ? encoding : "utf8");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
    });
    req.on("error", reject);
  });
}

function responseShim(res) {
  return {
    statusCode: 200,
    headersSent: false,
    setHeader(name, value) { res.setHeader(name, value); },
    getHeader(name) { return res.getHeader(name); },
    status(code) { this.statusCode = code; return this; },
    json(value) {
      if (!res.headersSent) res.setHeader("content-type", "application/json; charset=utf-8");
      res.statusCode = this.statusCode || 200;
      res.end(JSON.stringify(value));
      this.headersSent = true;
      return this;
    },
    send(value) {
      res.statusCode = this.statusCode || 200;
      res.end(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value));
      this.headersSent = true;
      return this;
    },
    end(value) {
      res.statusCode = this.statusCode || 200;
      res.end(value);
      this.headersSent = true;
      return this;
    },
  };
}

async function loadHandler(file) {
  if (!modules.has(file)) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) throw new Error(`Missing RDL handler: ${file}`);
    const loaded = await import(pathToFileURL(full).href);
    const fn = loaded.default || loaded.handler || loaded.GET || loaded;
    if (typeof fn !== "function") throw new Error(`RDL handler has no callable export: ${file}`);
    modules.set(file, fn);
  }
  return modules.get(file);
}

async function invokeFetchStyle(fn, req, res) {
  const body = await readBody(req);
  const url = new URL(req.url, `http://${req.headers.host || host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((entry) => headers.append(key, entry));
    else if (value !== undefined) headers.set(key, value);
  }
  const request = new Request(url, {
    method: req.method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await fn(request);
  if (result && typeof result.status === "number" && result.headers && typeof result.text === "function") {
    res.statusCode = result.status;
    for (const [key, value] of result.headers) res.setHeader(key, value);
    res.end(await result.text());
    return;
  }
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(result));
}

async function invokeVercelStyle(fn, req, res) {
  const body = await readBody(req);
  const url = new URL(req.url, `http://${req.headers.host || host}`);
  const request = {
    method: req.method,
    url: req.url,
    originalUrl: req.url,
    headers: req.headers,
    query: Object.fromEntries(url.searchParams.entries()),
    body,
  };
  const shim = responseShim(res);
  const result = await fn(request, shim);
  if (!res.headersSent && !shim.headersSent && result !== undefined) {
    if (result && typeof result.status === "number" && result.headers && typeof result.text === "function") {
      res.statusCode = result.status;
      for (const [key, value] of result.headers) res.setHeader(key, value);
      res.end(await result.text());
    } else {
      res.statusCode = shim.statusCode || 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify(result));
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, `http://${req.headers.host || host}`).pathname;
    if (pathname === "/health") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ status: "ok", service: "rdl-explorer-local-distribution-api" }));
      return;
    }
    const file = routeFiles[pathname];
    if (!file) {
      res.statusCode = 404;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "route_not_found" }));
      return;
    }
    const fn = await loadHandler(file);
    if (fn.length <= 1) await invokeFetchStyle(fn, req, res);
    else await invokeVercelStyle(fn, req, res);
  } catch (error) {
    console.error("local distribution request failed", { type: error?.name || "Error" });
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "local_rdl_distribution_runtime_error" }));
    }
  }
});

server.listen(port, host, () => process.stdout.write(`LISTENING ${host}:${port}\n`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
