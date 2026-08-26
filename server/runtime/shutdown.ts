import { closeRdlDatabaseClient } from "../db/runtime.ts";

export type ShutdownLogger = (message: string) => void;

export function installGracefulShutdownHandlers(
  logger: ShutdownLogger = (message) => console.info(message),
) {
  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger(JSON.stringify({ event: "runtime.shutdown", signal, service: "rdl-explorer" }));
    try {
      await closeRdlDatabaseClient();
    } finally {
      process.exitCode = 0;
    }
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return shutdown;
}
