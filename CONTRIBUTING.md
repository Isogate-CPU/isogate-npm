# Contributing

Thanks for helping improve the Isogate npm packages.

## Before opening a change

1. Search existing issues and pull requests.
2. For a behavior change, explain the compatibility impact and update the
   canonical vectors or tests where appropriate.
3. Never include credentials, host-specific output, database exports, build
   output, or generated package archives in a pull request.

## Local workflow

```bash
corepack enable
pnpm install
pnpm check
pnpm build
pnpm pack:dry-run
```

Keep public APIs typed and deterministic. Changes to replay digests, trace
shape, or CPU-art output are protocol changes and require an explicit
changelog entry and updated vector expectations.

## Pull requests

Use a concise title and describe the motivation, implementation, tests, and
any documentation changes. Keep unrelated formatting or dependency updates
out of feature changes. A maintainer will review the package surface,
backward compatibility, and release implications.

By contributing, you agree that your work is provided under the MIT license.