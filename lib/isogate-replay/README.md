# @isogate/replay

Deterministic replay primitives and canonical vectors for Isogate workloads.
The package is an ESM module for Node.js 20 or newer.

## Install

```bash
npm install @isogate/replay
```

## Use

```js
import { runCpuReplay, runCpuArt } from "@isogate/replay";

const replay = runCpuReplay({
  inputs: [0x2a, 0x11, 0x00, 0x01],
  cycles: 32,
});

const art = runCpuArt({
  seed: [0x2a, 0x11, 0x00, 0x01, 0xa8, 0x3c, 0x10, 0xff],
});

console.log(replay.digest, art.imageDigest);
```

`runCpuReplay` returns a SHA-256 digest, the final state, checkpoint cycles,
outputs, and a complete trace. `runCpuArt` requires exactly eight byte values
and returns a deterministic 16×16 RGB565 pixel buffer. Both functions are
local and synchronous; no network access is performed.

The `@isogate/replay/vectors` subpath exports the canonical fixture inputs and
expected digest values used by the test suite.

## Development

From the repository root:

```bash
pnpm --filter @isogate/replay test
pnpm --filter @isogate/replay pack:dry-run
```

## License

MIT. See [LICENSE](./LICENSE).