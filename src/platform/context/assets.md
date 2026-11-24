---
title: "Assets and fonts"
---

Keep fonts, icons, logos, images, and other static files with the scope that owns them. Assets are part of a system alongside its theme, components, context, and skills. Asset folders are ordinary directories; they need no registration.

## Locations

| Owner or purpose | Location |
| --- | --- |
| Shared Studio UI assets | `src/platform/systems/studio/assets/` |
| A design system's brand assets and fonts | `src/systems/<id>/assets/` |
| Assets intentionally shared across prototypes and systems | `src/lib/assets/` |
| Assets used by one prototype | `src/prototypes/<contributor>/<prototype>/assets/` |
| Files that need a fixed public URL or unchanged filename | `public/` |

Create a directory when it is needed. Module-specific platform assets can live in that module's `assets/` folder, so they leave with the module.

Within a system, use recognizable subfolders such as `fonts/`, `icons/`, and `images/` when useful. Package-provided fonts and icons can remain dependencies rather than copied files. Declare those dependencies in package metadata and describe their source and usage in the system README. Local asset discovery does not activate a theme, font, or icon library; imports and scoped usage remain explicit.

A team logo or font used by its product views usually belongs to the assigned design system. Studio's logo and fonts belong to the platform. Use `src/lib/assets/` only when reuse is independent of a particular system.

## Imports and URLs

Prefer source imports for assets used by React code. CSS can reference local files with relative `url()` paths. Vite resolves these references and generates production asset URLs.

For example, a Product view can import `@/systems/product/assets/logo.svg`. A font referenced from `src/systems/product/styles/theme.css` can use `url("../assets/fonts/brand.woff2")`.

The repository's Vite configuration serves `public/` from the site root and copies its contents unchanged into the build. Reference `public/favicon.svg` as `/favicon.svg`, without `public` in the URL. Public files are site-wide URL resources, rather than scoped source imports.

See [Vite's static asset documentation](https://vite.dev/guide/assets.html) for import and public-directory behavior.

## Scope and fonts

Asset imports follow the same boundaries as code: a prototype can import its own assets, its assigned system's assets, and shared `src/lib/` assets. It cannot import private platform assets, another prototype's assets, or another system's assets. Shared assets cannot depend on those scopes.

Define system font usage in its scoped theme or components. When systems ship different fonts, use distinct font-family names; font-face registration is global even when the theme's use of it is scoped.

Assets support artifacts; they do not become navigable artifacts themselves. Follow the repository's [prototype workflow](../modules/prototypes/skills/build-prototype/SKILL.md) for asset-size checks and the [system contract](../modules/systems/README.md) for theme scoping.

## Asset Guard

Asset Guard prevents oversized files from entering Git history. The pre-commit hook in `.husky/pre-commit` runs `src/platform/node/check/check-asset-size.js --staged`. It checks added and modified files using their staged contents and blocks the commit when a file exceeds the limit the studio declares. CI runs the same guard against committed changes.

The guard applies to all files, including assets in `public/`. Existing oversized files are checked when modified.

Resize or compress a flagged asset, then stage the smaller version and commit again. For images, use WebP or compressed JPEG at the display size.

The limit is `assetLimitKB` in `studio.config.json`, the largest file in KB a commit may add or change. The guard reads it from the same staged copy or commit as the files it checks, so a new limit counts once it is committed. A missing or invalid `assetLimitKB` stops the check and says what to declare. When a file is blocked, the message links to [Large files](#large-files).

## Large files

Git keeps every committed version of every file, so deleting a large file later does not remove it from history. Every clone downloads all of it, and media files barely compress against earlier versions, so each changed version adds close to a full copy. Whether to keep larger files is your team's decision. Design Studio has no built-in support for large media today; work through these options in order:

1. **Keep the default.** A new studio blocks files over 750 KB. That fits images exported at the size they are shown, and keeps clones fast.
2. **Raise the limit.** If your team's files are a little bigger, such as detailed images or short clips, raise `assetLimitKB` in Studio settings under General, or in `studio.config.json`. Every file under the new limit then goes into Git history as usual.
3. **Use a tool built for large media.** For video, large raw images, or other heavy files, keep them out of Git history:
   - [Git LFS](https://git-lfs.com/) stores a small pointer in Git and the file itself with your Git host. Track by pattern, such as `git lfs track "*.mp4"`, which writes the rule to `.gitattributes`; Asset Guard passes these files at any size. Everyone who clones, and every CI job and deployment that builds the studio, needs Git LFS installed and fetching files, or they get the pointer text instead of the media. Git hosts include a limited LFS quota for storage and downloads, and moving files back out of LFS later means rewriting history.
   - External media hosting, such as a video platform, a CDN, or object storage, keeps the file out of the repository entirely. Prototypes reference it by URL.
