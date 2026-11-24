// Supported runtime navigation for prototype code. Paths remain authoring
// dependencies; the supplied inventory resolves them to permanent public URLs.
import { createContext, createElement, useContext, type ComponentPropsWithoutRef, type ReactElement } from 'react';
import { Link as RouterLink, useNavigate as useRouterNavigate } from '@tanstack/react-router';

export type PrototypeNavigationScope = {
  studioId?: string;
  currentArtifactId?: string;
  artifacts: readonly { path: string; studioId?: string }[];
};
const scope = createContext<PrototypeNavigationScope | null>(null);
export const PrototypeNavigationProvider = scope.Provider;

export function prototypeArtifactHref(prototype: PrototypeNavigationScope, path: string): string {
  const suffixAt = path.search(/[?#]/);
  const file = suffixAt < 0 ? path : path.slice(0, suffixAt);
  const suffix = suffixAt < 0 ? '' : path.slice(suffixAt);
  const matches = prototype.artifacts.filter(item => item.path === file || item.path.replace(/\.[^./]+$/, '') === file);
  if (matches.length > 1) throw new Error(`Prototype path "${file}" is ambiguous.`);
  const artifact = matches[0];
  if (!prototype.studioId || !artifact?.studioId)
    throw new Error(
      `No identified artifact exists at prototype path "${file}". A new file gets its identity from the running dev server; without it, run pnpm studio identify <prototype folder> --yes.`,
    );
  if (![prototype.studioId, artifact.studioId].every(id => /^[0-9abcdefghjkmnpqrstvwxyz]{16}$/.test(id)))
    throw new Error('Invalid prototype navigation identity.');
  return `/prototypes/${prototype.studioId}/artifacts/${artifact.studioId}${suffix}`;
}

export function usePrototypeArtifactHref(): (path: string) => string {
  const prototype = useContext(scope);
  if (!prototype) throw new Error('Prototype navigation requires a rendered prototype view.');
  return path => prototypeArtifactHref(prototype, path);
}

// Selection belongs to the rendered view, including a prototype's index URL
// and embedded previews, rather than to a pathname that may show another view.
export function useIsPrototypeArtifact(path: string): boolean {
  const prototype = useContext(scope);
  if (!prototype) throw new Error('Prototype navigation requires a rendered prototype view.');
  let href: string;
  try {
    href = prototypeArtifactHref(prototype, path).split(/[?#]/)[0];
  } catch {
    return false; // The Link for this path reports the problem.
  }
  return Boolean(
    prototype.currentArtifactId &&
      href === `/prototypes/${prototype.studioId}/artifacts/${prototype.currentArtifactId}`,
  );
}

// A target is a prototype-relative path such as "app/main" (optionally with ?search or #hash). It resolves to the
// file's permanent URL. A target that already starts with "/" is an application URL and is used as given.
const targetHref = (resolve: (path: string) => string, to: string) => (to.startsWith('/') ? to : resolve(to));

export type LinkProps = Omit<ComponentPropsWithoutRef<'a'>, 'href'> & { to: string };

const reported = new Set<string>();

/** A link to another file of this prototype, by its prototype-relative path. */
export function Link({ to, ...props }: LinkProps): ReactElement {
  const resolve = usePrototypeArtifactHref();
  let href: string;
  try {
    href = targetHref(resolve, to);
  } catch (error) {
    // One unresolvable path, often in shared chrome, must not take down every view that renders it.
    // The link stays in place, inert and marked, and the console names the path.
    const message = error instanceof Error ? error.message : String(error);
    if (!reported.has(message)) {
      reported.add(message);
      console.error(`Link to "${to}": ${message}`);
    }
    return createElement('a', {
      ...props,
      'aria-disabled': true,
      'data-studio-broken-link': to,
      title: message,
      style: import.meta.env?.DEV ? { ...props.style, outline: '1px dashed #dc2626', outlineOffset: 2 } : props.style,
    });
  }
  return createElement(RouterLink, { ...props, to: href as never });
}

/** Returns a function that navigates to a prototype-relative path. */
export function useNavigate(): (to: string) => void {
  const navigate = useRouterNavigate();
  const resolve = usePrototypeArtifactHref();
  return to => void navigate({ to: targetHref(resolve, to) as never });
}
