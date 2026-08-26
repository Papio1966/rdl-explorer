import { inspectRuntimeEnvironment } from "../server/runtime/environment.ts";

const report = inspectRuntimeEnvironment(process.env);
console.log(JSON.stringify({
  production: report.production,
  ok: report.errors.length === 0,
  warnings: report.warnings,
  errors: report.errors,
}, null, 2));
if (report.errors.length) process.exitCode = 1;
