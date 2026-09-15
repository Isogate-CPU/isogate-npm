# Isogate Native Node (0.3.1)

Cross-platform CPU detection and deterministic benchmarking for desktop and server devices.

## Supported CPU architecture families

- x86-64 and x86: Intel, AMD, VIA, and Zhaoxin
- ARM64 and ARM32: Apple Silicon, Qualcomm Snapdragon, Ampere, Broadcom, and generic ARM
- RISC-V 64
- IBM Z and PowerPC 64
- MIPS, MIPS little-endian, and LoongArch 64 when supported by the installed Node.js runtime

The generic diagnostic works on Windows, macOS, and Linux using operating-system data exposed through Node.js. Intel PCM and AMD uProf counters are separate optional integrations and are not claimed unless those vendor tools are installed and explicitly enabled.

## Local use

```bash
pnpm --filter @isogate/node run build
node lib/isogate-node/dist/cli.js diagnose
node lib/isogate-node/dist/cli.js diagnose --json
node lib/isogate-node/dist/cli.js diagnose --output isogate-diagnostic.json
```

Reports include CPU model, classified vendor, architecture, logical processors, reported speed, memory, a real SHA-256 benchmark, and a report digest. Hostname and uptime are never included in exported JSON.

## Run as a compute provider

Import the diagnostic JSON in CPU Console and copy the provider ID and
one-time provider credential shown by registration. Then keep the native node
online:

```bash
isogate-node start \
  --server https://YOUR-ISOGATE-HOST/api \
  --provider YOUR-PROVIDER-ID
```

The CLI reads `ISOGATE_PROVIDER_CREDENTIAL` when that environment variable is
set. Otherwise, it prompts for the credential on an interactive TTY with
terminal echo disabled, so the input is not displayed. Set the environment
variable for noninteractive use; the credential is never part of the start
command or printed by the CLI.

The node sends heartbeats, claims bounded built-in deterministic jobs, executes
them locally, and submits replay results for independent server verification.
It does not execute arbitrary code and does not upload hostname, files,
environment variables, or credentials.

## Provider credential lifecycle

Registration returns a cryptographically random, one-time credential. The
server stores only a SHA-256 hash and never includes the credential in public
provider/network records, job input, or error responses. Native Node keeps the
credential only in process memory and sends it in the authenticated heartbeat,
job-claim, and completion requests. It is not written to disk or logged.

Because the Native Node does not persist credentials, provide the credential
again after a process restart. If it is unavailable, re-register the
diagnostic report to receive a replacement. Credential rotation also requires
restarting the node and pasting the replacement at the hidden prompt. Treat
the credential as a private provider control secret; it is not proof of wallet
ownership. Wallet binding is managed separately in CPU Console.