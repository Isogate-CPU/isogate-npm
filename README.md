# Isogate npm packages

This repository contains the public TypeScript packages used to run and verify
Isogate's deterministic CPU workloads:

| Package | Purpose |
| --- | --- |
| [`@isogate/replay`](./lib/isogate-replay) | A small, deterministic replay engine, canonical vectors, and RGB565 CPU-art output. |
| [`@isogate/node`](./lib/isogate-node) | Node.js CPU diagnostics, benchmarking, replay helpers, and an optional provider CLI. |

The packages support Node.js 20 or newer and are published independently to the
public npm registry. Their APIs are intentionally narrow: workloads are
built-in and bounded, and the replay package does not execute arbitrary code.

## Development

```bash
corepack enable
pnpm install
pnpm check
pnpm build
pnpm pack:dry-run
```

`pnpm pack:dry-run` prints the exact files that each package would include.
Build output is generated in each package's ignored `dist/` directory and is
not committed.

## Publishing

Releases are made from version tags by
`.github/workflows/release.yml`. The workflow uses npm trusted publishing
with GitHub Actions OIDC and provenance. It does not use an npm access token.
See [`docs/releasing.md`](./docs/releasing.md) before creating a release.

## License

MIT. See [LICENSE](./LICENSE).