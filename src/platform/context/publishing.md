---
title: "Publishing"
---

Hosting is optional. You can create prototypes locally and collaborate through Git before publishing a site. **Download** in a prototype's menu builds that one prototype into an HTML file on your machine; it is not this published site.

Publish when people need a shared viewing URL. The studio maintainer chooses the host, access requirements, and release process.

## What the build provides

Use the toolchain declared in `mise.toml` and `package.json`. Run `pnpm install --frozen-lockfile`, then `pnpm build`. This validates the manifest, module boundaries, types, and production compilation and writes a static site to `dist/`. Tests are separate: `pnpm test` runs ordinary regressions; `pnpm build:release` also runs disposable production fixtures. The site includes active prototypes, design-system pages, the system context, and the Manual when enabled.

Archived prototypes are excluded from the production build. Individual items cannot be archived. Archive content you want to keep locally without including it in the site.

| Local studio | Published site |
| --- | --- |
| Reads and changes repository files through the dev server. | Serves the files produced by the build. |
| Supports file creation and source editing within the permitted scope. | Does not offer repository file creation or source editing. |
| Shows local changes during development. | Changes when a new build is published. |

Interactive views still run in the browser. The published site does not provide a shared editing backend or an agent service.

## Choose a deployment process

The platform provides a portable static build. Configure a publishing workflow for the chosen host. Document repository-specific deployment configuration in its maintainer guidance. This project’s configuration is in [Releasing](releasing.md#project-repository-publishing).

For a host that serves the app below a URL prefix, pass that prefix through `STUDIO_BASE_PATH`. The build normalizes its trailing slash; local commands use `/` by default. For example:

```sh
STUDIO_BASE_PATH=/my-studio/ pnpm build
STUDIO_BASE_PATH=/my-studio/ pnpm preview
```

Choose a host that can serve the static files in `dist/`. Your team configures how that host receives a build, who can access the site, and when updates are published.

Ask your agent to help configure the chosen host when you are ready. Supply the destination and access requirements. Keep credentials in the host's or CI service's secret settings.

## Social link previews

The initial HTML includes Open Graph and Twitter large-image metadata. The default artwork is `public/images/design-studio-social.png` (1200 × 630). It represents the studio as a whole; individual prototype links use the same artwork. Asset variants and editable artwork are listed in the [Studio system README](../systems/studio/README.md#platform-brand-assets).

Set `STUDIO_PUBLIC_URL` to the complete published studio root, including any path prefix, when building. This writes absolute image URLs for social crawlers. Match its path to `STUDIO_BASE_PATH`:

```sh
STUDIO_PUBLIC_URL=https://example.com/my-studio/ STUDIO_BASE_PATH=/my-studio/ pnpm build
```

Without `STUDIO_PUBLIC_URL`, image URLs use the local base path. This supports local previews but does not guarantee a card on external services. Public previews require the page and image to be accessible to the service's crawler. After publishing, verify the image URL and refresh the service's cached preview when updating the artwork.

## Make direct links work

The app uses browser-history URLs, such as `/prototypes/ccncfpcyaa1hvjts/artifacts/5b9z6sp9580ks01r`. Configure the host to serve `index.html` for app paths that do not identify an asset.

Test a direct prototype URL and reload it. Opening the front page alone does not verify routing.

The build also copies `index.html` to `404.html` for hosts such as GitHub Pages. This loads the app for missing paths, but the HTTP response remains a 404. Hosts with rewrite support can return `index.html` with a successful response instead.

The router also contains guidance for hash-based URLs when a host cannot provide these rewrites. This is a code change, not a studio configuration option.

## Serve updates reliably

Configure caching at the chosen host:

| Files | Cache policy |
| --- | --- |
| HTML, including the app fallback | Revalidate on use (`Cache-Control: no-cache`). |
| `prototypes/manifest.json` and `prototypes/artifacts/**` | Revalidate. These filenames are mutable; artifact query hashes do not make their stored files immutable. |
| Content-hashed files under `assets/` | Long-lived caching (`Cache-Control: public, max-age=31536000, immutable`). |
| Other public files | Choose a policy for their actual update frequency. |

Publish complete output atomically when supported. Retain previous hashed assets during rollout when the host allows it. Do not return HTML for missing asset URLs; use the app fallback only for application routes.

The production page installs recovery before its entry module loads. A missing entry or lazy chunk can trigger one refresh with a cache-busting query while preserving the route, search, and hash. Retries are bounded for one minute, including when browser storage is unavailable. Offline failures do not trigger automatic refresh. Recovery helps with replaced assets but does not repair a missing upload or incorrect base path. Hosts with a Content Security Policy must allow the generated inline bootstrap, for example through its hash.

## Verify the viewing link

Run `pnpm build:inspect` after building. It verifies all asset references recorded in Vite's manifest and reports the static JavaScript/CSS dependency closure for the entry page. It excludes lazy feature downloads, HTML, data, images and fonts; gzip figures assume compression at the host. It is a build diagnostic, not a network timing measurement or a fixed budget for customized studios.

Preview the output, then verify the actual published URL: open Home, open a prototype directly and reload, open a Manual or system page when available, and open any canvas or diagram you intend to share. Check for missing assets and console errors. Repeat after updating an already-open viewing site. Provider queue, upload, CDN and cache behavior must be measured on that provider.

## Review the published content

Review what the build includes before uploading it. System context, prototype data, and bundled source may contain information you do not want to distribute.

The starter does not provide built-in sign-in or access control. Configure access at the hosting layer when your studio contains private work.

Run the development server in a trusted local environment. Its editing features are not intended to be exposed as a hosted service.
