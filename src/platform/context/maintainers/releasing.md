---
title: Releasing
description: Manual acceptance, release tagging, and project deployment.
toc: true
---

A release is a reviewed upstream `main` commit tagged `v<version>`. Release preparation does not authorize pushing, tagging a real release, or publication; obtain the maintainer's direction for those actions.

## Versions

Set `PLATFORM_VERSION` in `src/platform/core/modules/index.ts` to match the tag. The project is pre-release and imposes no backwards-compatibility baseline. Review public API changes against current consumers and document any manual migration. Module `requires` declarations and stored-file validation still apply.

## Maintainer workspace and distributed source

Build release candidates in a separate clean clone. Keep the maintainer's real profile and private prototypes local; do not copy ignored files or existing build output into the clone. The upstream starter distributes fictional sample profiles, personal usage, and no personal permission grants. `check-starter.js` rejects personal work even when Git ignores it. Installed studios may contain real contributors.

## Release announcement

Publish only when explicitly directed. Before announcement, verify installation from the exact public tag, demo interactions, direct links, and reloads. Update this repository's installation guide and README prompt, and the website repository's installation prompts, to the new tag: `src/data/design-studio-setup.ts` and `src/data/design-studio-agent.txt`.

## Cut a release

1. Review a clean `main` candidate and its `CHANGELOG.md`. Confirm each community contribution credits its contributor. Set the version, date the Unreleased notes under `## <version> (YYYY-MM-DD)`, and start a new empty Unreleased section.
2. In the clean clone, run:

   ```sh
   pnpm install --frozen-lockfile
   pnpm studio sync --check
   pnpm format:check
   node src/platform/node/check/check-starter.js
   pnpm test:release
   pnpm build
   pnpm build:inspect
   ```

3. Exercise the built viewer, including direct prototype links and reloads. Record the candidate commit, results, and limitations for review. Repeat affected checks after changes.
4. With explicit release authorization, commit the version and notes and create an annotated `v<version>` tag. Review the commit and tag before an authorized push. No script edits files, rolls back changes, or pushes for you.

## After pushing

Verify installation from the exact tag using the [installation guide](../installing.md). Verify the public demo anonymously. If a published release is wrong, cut a new release rather than moving its tag.

Close the loop with contributors whose work shipped, as [Community contributions](community-contributions.md#close-the-loop) describes.

## Project repository publishing

The starter uses Parker Moss, a fictional sample contributor with a bundled illustrated avatar. Maintainer profiles and personal prototypes stay local through checkout-specific Git exclusions. Upstream CI and `check-starter.js` check that distributed source contains only sample profiles and no personal grants or local contributor work. Build releases from a clean clone; see [Maintainer workspace and distributed source](releasing.md#maintainer-workspace-and-distributed-source).

The ongoing [public demo](https://itspatmorgan.com/design-studio-demo/) is included in the GitHub Pages deployment of `itspatmorgan/itspatmorgan.com`. The website's `/design-studio/` product page and `/design-studio-demo/` interactive demo are separate paths. This source repository does not deploy its own Pages site.

An isolated ChatGPT Sites fixture validates the optional publishing workflow with approved learning examples. Native Sites updates reuse that fixture's project identity in `.openai/hosting.json` and its URL. Use native Sites tools with static output `dist`, SPA fallback, and the root base path. Retain release ancestry and use the pinned mise environment. Deploy the saved source commit and matching build archive, and verify a successful native deployment result and the actual viewer. Set public access only when authorized; preserve the audience on updates.

The fixture's SPA fallback returns HTML with HTTP 200 for missing assets. Verify referenced assets, browser errors, and direct-link reloads after publication. This provider behavior does not replace the portable [hosting requirements](../publishing.md#serve-updates-reliably).

For any host, install with Node 24 and pnpm 12, run `pnpm build`, and publish `dist/`. Use `pnpm test` for focused regressions or `pnpm build:release` for full release verification. `pnpm build:inspect` reports startup asset size and requests. Your chosen host owns routing, caching, access, and deployment configuration.

The [Checks workflow](../../../../.github/workflows/checks.yml) preserves the required `scope` and `build` checks. Upstream-only checks identify this repository by its permanent GitHub repository ID, `1401250166`, so a repository rename does not disable them. Copies run checks without triggering the public website.

After a successful upstream push to `main`, [Publish demo](../../../../.github/workflows/demo.yml) triggers the website's `deploy.yml` workflow. Set the `WEBSITE_DEPLOY_TOKEN` Actions secret here to a fine-grained GitHub token with **Actions: Read and write** access to **only** `itspatmorgan/itspatmorgan.com`. A missing token fails the publishing notification with a setup message; it does not bypass Studio checks. Pull requests and forks cannot trigger publication.

The website resolves the source repository by permanent ID and checks out the latest successful `main` push from `checks.yml` at its exact commit. It builds Studio with its declared mise toolchain and `STUDIO_BASE_PATH=/design-studio-demo/`, copies the output into the website's `dist/design-studio-demo/`, and uploads the combined Pages artifact. Set `STUDIO_PUBLIC_URL=https://itspatmorgan.com/design-studio-demo/` in that build to emit absolute social image URLs. Studio code remains in this repository. Failed Studio checks leave the prior passing version available for website builds.

The website's root `404.html` loads the demo's entry document only for demo application routes, preserving direct links and reloads. It also redirects the former `/design-studio-starter/` path while preserving the route, query, and fragment. These are browser redirects and Pages fallback responses retain HTTP 404 status. Disable this repository's old Pages site when switching to the combined deployment; otherwise it can claim `/design-studio/` after the rename.

To preview the demo's subpath locally:

```sh
STUDIO_PUBLIC_URL=https://itspatmorgan.com/design-studio-demo/ STUDIO_BASE_PATH=/design-studio-demo/ pnpm build
STUDIO_BASE_PATH=/design-studio-demo/ pnpm preview
```

See [Publishing](../publishing.md) for portable hosting, direct-link routing, and access requirements.

## Related contracts

- [Ownership and updates](../ownership.md) describes manual upgrades.
- [Community contributions](community-contributions.md) describes reviewing and crediting outside work.
- [Checks and fixes](checks.md) describes verification.
- [Format versions](../formats.md) describes retained-file validation.
