# Releasing the npm packages

The packages in `lib/isogate-replay` and `lib/isogate-node` are versioned and
published independently. A release tag is the repository-wide trigger; each
package's `package.json` version must already be set to the intended published
version before the tag is created.

## One-time npm configuration

For **each** package, configure an npm trusted publisher for:

- Repository: `Isogate-CPU/isogate-npm`
- Workflow: `Publish npm packages`
- Environment: `npm-release`

Trusted publishing uses GitHub Actions OIDC and short-lived authorization.
This repository intentionally does not support long-lived npm credentials.

## Prepare a release

1. Update the package version(s) and `CHANGELOG.md`.
2. Run the local checks:

   ```bash
   corepack enable
   pnpm install
   pnpm check
   pnpm build
   pnpm pack:dry-run
   ```

3. Inspect the dry-run output. The package allowlists include only `dist`,
   the package README, and the package license.
4. Commit the version and changelog updates.
5. Create and push an annotated tag such as `v1.0.1`.

The workflow runs checks again, builds both packages, performs both pack
dry-runs, and then publishes replay before node because node depends on the
published replay version. Publishing uses `npm publish --provenance
--access public`; there is no token-based authentication step.

## Recovery

If a release fails before publication, fix the cause and create a new tag.
npm package versions cannot be reused after a successful publication. Review
the workflow summary and npm package page before retrying; do not bypass the
OIDC workflow with a local credential.