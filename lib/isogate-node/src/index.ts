import { createHash } from "node:crypto";
import { arch, cpus, freemem, hostname, platform, release, totalmem, uptime } from "node:os";
import { performance } from "node:perf_hooks";
import {
  runCpuArt as runCanonicalCpuArt,
  runCpuReplay as runCanonicalCpuReplay,
  type CpuArtResult,
} from "@isogate/replay";
export type { CpuArtResult } from "@isogate/replay";

export interface ReplayInput {
  inputs: number[];
  cycles?: number;
}

export interface ReplayTraceFrame {
  cycle: number;
  pc: number;
  accumulator: number;
  ram: number;
  zero: boolean;
  carry: boolean;
  halted: boolean;
  lane: number;
  input: number;
  operation: "LOAD" | "ADD" | "XOR" | "ROTATE";
}

export interface ReplayResult {
  engine: string;
  digestAlgorithm: "SHA-256";
  digest: string;
  inputs: number[];
  requestedCycles: number;
  finalState: ReplayTraceFrame;
  outputs: number[];
  checkpoints: number[];
  trace: ReplayTraceFrame[];
}

export type CpuVendor =
  | "Intel"
  | "AMD"
  | "Apple"
  | "Qualcomm"
  | "Ampere"
  | "Broadcom"
  | "ARM"
  | "IBM"
  | "RISC-V"
  | "VIA"
  | "Zhaoxin"
  | "Unknown";

export interface NativeCpuReport {
  schemaVersion: 1;
  capturedAt: string;
  runtime: {
    platform: NodeJS.Platform;
    release: string;
    architecture: string;
    architectureFamily: string;
    nodeVersion: string;
  };
  cpu: {
    vendor: CpuVendor;
    model: string;
    logicalProcessors: number;
    reportedMhz: number | null;
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
  };
  benchmark: {
    algorithm: "SHA-256";
    iterations: number;
    durationMs: number;
    operationsPerSecond: number;
    digest: string;
  };
  reportDigest: string;
}

const ARCHITECTURE_FAMILIES: Record<string, string> = {
  x64: "x86-64",
  ia32: "x86",
  arm64: "ARM64",
  arm: "ARM32",
  riscv64: "RISC-V 64",
  ppc64: "PowerPC 64",
  s390x: "IBM Z",
  mips: "MIPS",
  mipsel: "MIPS LE",
  loong64: "LoongArch 64",
};

export function detectCpuVendor(model: string, architecture = arch()): CpuVendor {
  const value = model.toLowerCase();
  if (value.includes("intel")) return "Intel";
  if (value.includes("amd") || value.includes("ryzen") || value.includes("epyc")) return "AMD";
  if (value.includes("apple")) return "Apple";
  if (value.includes("qualcomm") || value.includes("snapdragon")) return "Qualcomm";
  if (value.includes("ampere")) return "Ampere";
  if (value.includes("broadcom")) return "Broadcom";
  if (value.includes("zhaoxin")) return "Zhaoxin";
  if (value.includes("via ")) return "VIA";
  if (value.includes("ibm") || architecture === "s390x" || architecture === "ppc64") return "IBM";
  if (value.includes("risc-v") || architecture === "riscv64") return "RISC-V";
  if (value.includes("arm") || architecture === "arm" || architecture === "arm64") return "ARM";
  return "Unknown";
}

export function runDeterministicBenchmark(iterations = 50_000) {
  let state = Buffer.from("isogate-native-node-v1", "utf8");
  const startedAt = performance.now();

  for (let index = 0; index < iterations; index += 1) {
    state = createHash("sha256")
      .update(state)
      .update(String(index))
      .digest();
  }

  const durationMs = performance.now() - startedAt;
  return {
    algorithm: "SHA-256" as const,
    iterations,
    durationMs,
    operationsPerSecond: Math.round(iterations / (durationMs / 1000)),
    digest: state.toString("hex"),
  };
}

export function runCpuReplay(input: ReplayInput): ReplayResult {
  return runCanonicalCpuReplay(input);
}

/** Execute the versioned built-in RGB565 identity workload. */
export function runCpuArt(seed: number[]): CpuArtResult {
  return runCanonicalCpuArt({ seed });
}

export function collectNativeCpuReport(iterations = 50_000): NativeCpuReport {
  const cpuList = cpus();
  const model = cpuList[0]?.model.trim() || "Not reported by operating system";
  const speeds = cpuList.map((cpu) => cpu.speed).filter((speed) => speed > 0);
  const benchmark = runDeterministicBenchmark(iterations);
  const report = {
    schemaVersion: 1 as const,
    capturedAt: new Date().toISOString(),
    runtime: {
      platform: platform(),
      release: release(),
      architecture: arch(),
      architectureFamily: ARCHITECTURE_FAMILIES[arch()] ?? arch(),
      nodeVersion: process.version,
    },
    cpu: {
      vendor: detectCpuVendor(model),
      model,
      logicalProcessors: cpuList.length,
      reportedMhz: speeds.length
        ? Math.round(speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length)
        : null,
    },
    memory: {
      totalBytes: totalmem(),
      freeBytes: freemem(),
    },
    benchmark,
  };
  const reportDigest = createHash("sha256")
    .update(JSON.stringify(report))
    .digest("hex");

  return { ...report, reportDigest };
}

export function getPrivateHostSummary() {
  return {
    hostname: hostname(),
    uptimeSeconds: Math.floor(uptime()),
  };
}