import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export function launchApplicationAssistant(runId: string) {
  const workerPath = path.join(process.cwd(), "worker", "application-assistant.ts");
  if (!fs.existsSync(workerPath)) throw new Error("Executor semiautomático não encontrado.");

  const child = spawn(process.execPath, ["--import", "tsx", workerPath, runId], {
    cwd: process.cwd(),
    env: { ...process.env, APPLICATION_ASSISTANT_RUN_ID: runId },
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return child.pid;
}
