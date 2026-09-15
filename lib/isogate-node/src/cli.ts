#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { collectNativeCpuReport, getPrivateHostSummary, runCpuArt, runCpuReplay } from "./index.js";

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const command = process.argv[2] ?? "diagnose";
  if (command === "start") {
    await startProvider();
    return;
  }
  if (command !== "diagnose") {
    process.stderr.write([
      "Usage:",
      "  isogate-node diagnose [--json] [--output report.json] [--iterations 50000]",
      "  isogate-node start --server https://example.com/api --provider <uuid> [--poll-seconds 3]",
      "",
    ].join("\n"));
    process.exitCode = 1;
    return;
  }

  const requestedIterations = Number(readOption("--iterations") ?? "50000");
  if (!Number.isInteger(requestedIterations) || requestedIterations < 1_000 || requestedIterations > 2_000_000) {
    process.stderr.write("Iterations must be an integer between 1000 and 2000000.\n");
    process.exitCode = 1;
    return;
  }

  const report = collectNativeCpuReport(requestedIterations);
  const output = `${JSON.stringify(report, null, 2)}\n`;
  const outputPath = readOption("--output");

  if (outputPath) {
    await writeFile(outputPath, output, { encoding: "utf8", mode: 0o600 });
    process.stdout.write(`Diagnostic report written to ${outputPath}\n`);
    return;
  }

  if (process.argv.includes("--json")) {
    process.stdout.write(output);
    return;
  }

  const privateHost = getPrivateHostSummary();
  process.stdout.write([
    "ISOGATE NATIVE CPU DIAGNOSTIC",
    `Vendor: ${report.cpu.vendor}`,
    `Model: ${report.cpu.model}`,
    `Architecture: ${report.runtime.architectureFamily} (${report.runtime.architecture})`,
    `Logical processors: ${report.cpu.logicalProcessors}`,
    `Reported speed: ${report.cpu.reportedMhz ? `${report.cpu.reportedMhz} MHz` : "not reported"}`,
    `Memory: ${(report.memory.totalBytes / 1024 ** 3).toFixed(1)} GB`,
    `Benchmark: ${report.benchmark.operationsPerSecond.toLocaleString()} SHA-256 ops/s`,
    `Benchmark digest: ${report.benchmark.digest}`,
    `Report digest: ${report.reportDigest}`,
    "",
    "Privacy: hostname and uptime were read locally for diagnostics but are not included in the report.",
    `Local host check: ${privateHost.hostname ? "available" : "unavailable"}; uptime ${privateHost.uptimeSeconds}s`,
  ].join("\n"));
}

interface ProviderJob {
  id: string;
  leaseToken: string;
  workload: "cpu_replay" | "cpu_art_rgb565";
  inputs: number[];
  cycles: number;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(detail?.error ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function readProviderCredential(): Promise<string> {
  const environmentCredential = process.env.ISOGATE_PROVIDER_CREDENTIAL;
  if (environmentCredential !== undefined) return environmentCredential;

  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    throw new Error(
      "No interactive TTY is available for the hidden credential prompt. Set ISOGATE_PROVIDER_CREDENTIAL in the environment and retry.",
    );
  }

  const input = process.stdin;
  const output = process.stderr;
  return new Promise<string>((resolve, reject) => {
    let value = "";
    let settled = false;
    let rawModeEnabled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      input.off("data", onData);
      input.off("error", onError);
      process.off("SIGINT", onSigint);
      if (rawModeEnabled) {
        try {
          input.setRawMode(false);
        } catch {
          if (!error) error = new Error("Unable to restore terminal echo after reading the credential.");
        }
      }
      output.write("\n");
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };

    const onData = (chunk: Buffer | string) => {
      for (const character of chunk.toString()) {
        if (character === "\u0003" || character === "\u0004") {
          finish(new Error("Credential prompt cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= " ") value += character;
      }
    };
    const onError = (error: Error) => finish(error);
    const onSigint = () => finish(new Error("Credential prompt cancelled."));

    try {
      input.setRawMode(true);
      rawModeEnabled = true;
      input.on("data", onData);
      input.once("error", onError);
      process.once("SIGINT", onSigint);
      output.write("Provider credential (input hidden): ");
      input.resume();
    } catch (error) {
      finish(error instanceof Error ? error : new Error("Unable to read provider credential."));
    }
  });
}

async function startProvider() {
  const serverOption = readOption("--server");
  const providerId = readOption("--provider");
  const pollSeconds = Number(readOption("--poll-seconds") ?? "3");
  const unsupportedOption = process.argv.find(
    (argument) =>
      argument.startsWith("--") &&
      !["--server", "--provider", "--poll-seconds"].includes(argument),
  );
  if (unsupportedOption) {
    throw new Error("Unsupported start option. Use --server and --provider.");
  }
  if (!serverOption || !providerId) {
    throw new Error("start requires --server and --provider.");
  }
  if (!/^https?:\/\//.test(serverOption)) {
    throw new Error("--server must be an HTTP or HTTPS URL.");
  }
  if (!/^[0-9a-f-]{36}$/i.test(providerId)) {
    throw new Error("--provider must be a valid provider UUID.");
  }
  const providerCredential = await readProviderCredential();
  if (providerCredential.length < 32 || providerCredential.length > 128) {
    throw new Error("Provider credential must be the one-time credential returned by provider registration.");
  }
  if (!Number.isInteger(pollSeconds) || pollSeconds < 2 || pollSeconds > 60) {
    throw new Error("--poll-seconds must be an integer between 2 and 60.");
  }
  const baseUrl = serverOption.replace(/\/+$/, "");
  let stopping = false;
  process.once("SIGINT", () => { stopping = true; });
  process.once("SIGTERM", () => { stopping = true; });
  process.stdout.write(`Isogate provider ${providerId} is online. Press Ctrl+C to stop.\n`);

  let lastHeartbeat = 0;
  while (!stopping) {
    try {
      if (Date.now() - lastHeartbeat >= 30_000) {
        await requestJson(`${baseUrl}/providers/${providerId}/heartbeat`, {
          method: "POST",
          headers: { "x-isogate-provider-credential": providerCredential },
        });
        lastHeartbeat = Date.now();
      }
      const job = await requestJson<ProviderJob | null>(
        `${baseUrl}/providers/${providerId}/jobs/next`,
        { headers: { "x-isogate-provider-credential": providerCredential } },
      );
      if (job) {
        const startedAt = performance.now();
        const result = job.workload === "cpu_art_rgb565"
          ? runCpuArt(job.inputs)
          : runCpuReplay({ inputs: job.inputs, cycles: job.cycles });
        await requestJson(`${baseUrl}/providers/${providerId}/jobs/${job.id}/complete`, {
          method: "POST",
          headers: { "x-isogate-provider-credential": providerCredential },
          body: JSON.stringify({ result, leaseToken: job.leaseToken }),
        });
        process.stdout.write(
          `Completed job ${job.id} in ${(performance.now() - startedAt).toFixed(1)}ms; digest ${
            "digest" in result ? result.digest.slice(0, 12) : result.imageDigest.slice(0, 12)
          }…\n`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider loop failure";
      const safeMessage = message.replaceAll(providerCredential, "[redacted]");
      process.stderr.write(`Provider loop warning: ${safeMessage}; retrying.\n`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollSeconds * 1000));
  }
  process.stdout.write("Isogate provider stopped.\n");
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown diagnostic failure";
  process.stderr.write(`Isogate diagnostic failed: ${message}\n`);
  process.exitCode = 1;
});