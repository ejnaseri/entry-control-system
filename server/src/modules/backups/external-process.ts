import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";

const MAX_CAPTURED_OUTPUT_CHARS = 120_000;

function appendLimited(current: string, next: string) {
  const combined = current + next;
  return combined.length > MAX_CAPTURED_OUTPUT_CHARS
    ? combined.slice(combined.length - MAX_CAPTURED_OUTPUT_CHARS)
    : combined;
}

function terminateProcessTree(child: ReturnType<typeof spawn>) {
  if (!child.pid) {
    child.kill();
    return;
  }

  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
      shell: false,
    });
    killer.on("error", () => child.kill());
    killer.on("close", () => {
      if (child.exitCode === null && child.signalCode === null) child.kill();
    });
    return;
  }

  child.kill("SIGTERM");
}

export type ExternalProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

export type ExternalProcessOptions = {
  command: string;
  args: readonly string[];
  cwd: string;
  timeoutMs: number;
  timeoutMessage: string;
  failureMessage: string;
  rejectNonEmptyStderr?: boolean;
  sanitizeOutput?: (value: string) => string;
  spawnOptions?: Omit<SpawnOptionsWithoutStdio, "cwd" | "stdio">;
};

/**
 * Runs an external utility and, on timeout, waits for the child process to
 * actually close before rejecting. Callers can therefore safely clean up
 * files and persist a terminal operation state after this promise settles.
 */
export function runExternalProcess(options: ExternalProcessOptions): Promise<ExternalProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.command, [...options.args], {
      ...options.spawnOptions,
      cwd: options.cwd,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let spawnError: Error | null = null;

    const timeout = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child);
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendLimited(stdout, chunk.toString("utf8"));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendLimited(stderr, chunk.toString("utf8"));
    });
    child.on("error", (error) => {
      spawnError = error;
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(options.timeoutMessage));
        return;
      }
      if (spawnError) {
        reject(spawnError);
        return;
      }
      if (code === 0 && !(options.rejectNonEmptyStderr && stderr.trim())) {
        resolve({ stdout, stderr, exitCode: code });
        return;
      }
      const exitDetail = code === 0 ? "" : ` with exit code ${String(code)}`;
      const detail = options.sanitizeOutput ? options.sanitizeOutput(stderr || stdout) : stderr || stdout;
      reject(new Error(`${options.failureMessage}${exitDetail}. ${detail}`));
    });
  });
}
