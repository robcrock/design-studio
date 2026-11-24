import { createArtifactLifecycle, type ArtifactLifecycle } from './state.ts';
import { applied, readRevision, type RevisionSnapshot } from './inputs.ts';
import { rootOf } from '../roots.ts';

export type ArtifactFile = { contributor: string; prototype: string; path: string };

// The adapter is independently testable: disk reads, compiled evidence, and React commits
// arrive separately. A refresh counter alone is never evidence of applied source.
export function createCompiledTracker(
  read: () => Promise<RevisionSnapshot>,
  publish: (state: ArtifactLifecycle) => void,
  isApplied: (snapshot: RevisionSnapshot) => boolean = applied,
  timeout = 15000,
  interval = 250,
) {
  const lifecycle = createArtifactLifecycle(publish);
  let live = true;
  let serial = 0;
  let committed = false;
  let failure: { detail: string; retained: boolean } | null = null;
  let paths = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const clearRetry = () => {
    clearTimeout(retry);
    retry = undefined;
  };
  const clearDeadline = () => {
    clearTimeout(timer);
    timer = undefined;
    clearRetry();
  };
  const check = async () => {
    if (!live) return;
    const request = ++serial;
    try {
      const revision = await read();
      if (!live || request !== serial) return;
      paths = new Set(revision.sources.map(([path]) => path));
      lifecycle.observe(revision);
      const running = committed && isApplied(revision);
      if (failure && !running) {
        clearDeadline();
        const ticket = lifecycle.prepare(revision);
        if (ticket) lifecycle.fail(ticket, failure.detail, failure.retained);
        return;
      }
      if (!running) {
        if (lifecycle.state.phase !== 'preparing' || !lifecycle.state.preparing) lifecycle.prepare(revision);
        timer ??= setTimeout(() => {
          timer = undefined;
          clearRetry();
          ++serial; // A read still in flight must not restart the deadline.
          if (live)
            lifecycle.unknown('The latest preview could not be verified. Repair the files or reload this view.');
        }, timeout);
        // After a commit, a module the view loads lazily (an import() in an effect) records its
        // compiled inputs later, with no further commit to announce it. Look again until the deadline.
        clearRetry();
        if (committed) retry = setTimeout(() => void check(), interval);
        return;
      }
      failure = null;
      const ticket = lifecycle.prepare(revision);
      if (ticket) lifecycle.commit(ticket);
      clearDeadline();
    } catch (error) {
      if (live && request === serial) {
        clearDeadline();
        lifecycle.unknown(error instanceof Error ? error.message : 'Preview inputs could not be verified.');
        if (failure) lifecycle.error(failure.detail, failure.retained);
      }
    }
  };
  return {
    get state() {
      return lifecycle.state;
    },
    includes(path: string) {
      return paths.has(path);
    },
    invalidate() {
      committed = false;
      lifecycle.unknown();
      return check();
    },
    begin() {
      committed = false;
      return check();
    },
    ready() {
      committed = true;
      return check();
    },
    compilationFailed(detail: string) {
      failure = { detail, retained: true };
      return check();
    },
    failed(detail: string, retained: boolean) {
      failure = { detail, retained };
      committed = false;
      return check();
    },
    dispose() {
      live = false;
      ++serial;
      clearDeadline();
      lifecycle.dispose();
    },
  };
}

export function compiledLifecycle(file: ArtifactFile, publish: (state: ArtifactLifecycle) => void) {
  if (!import.meta.env.DEV) {
    // Published bundles have no changing repository or live compilation evidence.
    const lifecycle = createArtifactLifecycle(publish);
    const unknown = () => lifecycle.unknown();
    return {
      begin: unknown,
      ready: unknown,
      failed: (detail: string, retained: boolean) => lifecycle.error(detail, retained),
      dispose: () => lifecycle.dispose(),
    };
  }
  const entry = '/' + rootOf(file.contributor, file.prototype) + '/' + file.path;
  const tracker = createCompiledTracker(() => readRevision(file), publish);
  const source = (event: { path: string }) => {
    const path = event.path.startsWith('src/') ? '/' + event.path.slice(4) : event.path;
    if (path === entry || tracker.includes(path)) void tracker.invalidate();
  };
  const compileError = ({ err }: { err: { id?: string; message?: string } }) => {
    const id = err.id?.split('?')[0];
    const marker = id?.lastIndexOf('/src/');
    const path = id && marker !== undefined && marker >= 0 ? id.slice(marker + 4) : id;
    if (path && (path === entry || tracker.includes(path)))
      void tracker.compilationFailed(err.message ?? 'The latest code could not compile.');
  };
  import.meta.hot?.on('vite:error', compileError);
  // A compiled-module notification does not prove a React commit. Only renderer ready()
  // does, so Vite updates trigger checks in the renderer after it commits.
  import.meta.hot?.on('studio:source', source);
  return {
    begin: () => {
      void tracker.begin();
    },
    ready: () => {
      void tracker.ready();
    },
    failed: (detail: string, retained: boolean) => {
      void tracker.failed(detail, retained);
    },
    dispose: () => {
      import.meta.hot?.off('studio:source', source);
      import.meta.hot?.off('vite:error', compileError);
      tracker.dispose();
    },
  };
}
