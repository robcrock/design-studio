import type { ComponentType } from 'react';
import type { CodeIcon } from '@hugeicons/core-free-icons';
import { capabilityAvailability, type ArtifactAvailabilityContext, type FileTypeSpec } from '../../core/fileTypes.ts';
export type { EmbedSurface } from '../../core/fileTypes.ts';
import type { Artifact, Prototype } from '@/platform/app/data/types';

// How the app opens a file type (<module folder>/open.tsx). What the build needs to know
// about the type is in its type.ts.
export type ArtifactContext = { proto: Prototype; item: Artifact };

// What a type shows where another item includes it (in documents or on canvases): a live preview, in a box of
// this size. A type without one is shown as a card.
// `still`: the surface wants a still picture, so an Embed with motion may hold it once rendered.
export type EmbedProps = {
  proto: Prototype;
  item: Artifact;
  width: number;
  height: number;
  // The screen width a view is laid out at, when the surface asks for one (a view on a canvas). Otherwise
  // the prototype's default screen, the first of its system's (Prototype.screens).
  viewport?: number;
  still: boolean;
  loadingStartedAt?: number;
};

export type FileTypeModule<Props extends object = any> = {
  // eslint-disable-line @typescript-eslint/no-explicit-any
  icon: typeof CodeIcon;
  // Loads the item's file before its page renders, so the open item stays on screen until the
  // next is ready. Returns the props for Page, or undefined if the file isn't there (the
  // not-found page).
  load(context: ArtifactContext): Promise<Props | undefined>;
  Page: ComponentType<Props> & { preload?: () => Promise<unknown> | undefined };
  Embed?: ComponentType<EmbedProps>;
  // Lightweight, module-owned document loading surface, available before a lazy Embed.
  EmbedPending?: ComponentType<{ loadingStartedAt: number }>;
  actions?: readonly ArtifactAction[];
};

export type ArtifactActionContext = ArtifactContext & { environment: ArtifactAvailabilityContext };
export type ArtifactAction = {
  id: string;
  label: string;
  icon?: typeof CodeIcon;
  localOnly: boolean;
  mutates: boolean;
  // Return a reason when unavailable, or null. Does not authorize a write.
  unavailable?: (context: ArtifactActionContext) => string | null;
  run(context: ArtifactActionContext): void | Promise<unknown>;
};

export function assertFileTypeModule(id: string, spec: FileTypeSpec, module: FileTypeModule | undefined) {
  const fail = (message: string): never => {
    throw new Error(`File type ${id}: ${message}`);
  };
  if (module && 'embedSurfaces' in module) fail('move embedSurfaces to capabilities.embeds in type.ts.');
  if (!module || !module.Page || typeof module.load !== 'function') fail('provide Page and load in open.tsx.');
  if (Boolean(module!.Embed) !== Boolean(spec.capabilities.embeds.length))
    fail('capabilities.embeds must match the Embed implementation.');
  if (module!.actions !== undefined && !Array.isArray(module!.actions))
    fail('actions in open.tsx must be an array, or omitted.');
  const actions = module!.actions ?? [];
  for (const action of actions) {
    if (
      !action ||
      typeof action !== 'object' ||
      typeof action.id !== 'string' ||
      !action.id.startsWith(id + '.') ||
      typeof action.label !== 'string' ||
      !action.label.trim() ||
      typeof action.run !== 'function' ||
      typeof action.localOnly !== 'boolean' ||
      typeof action.mutates !== 'boolean' ||
      (action.unavailable !== undefined && typeof action.unavailable !== 'function')
    )
      fail('actions need an owner-prefixed ID, label, run, localOnly and mutates declarations.');
  }
  const ids = actions.map(action => action.id);
  if (new Set(ids).size !== ids.length) fail('action implementations must have unique IDs.');
  if (ids.length !== spec.capabilities.actions.length || ids.some(id => !spec.capabilities.actions.includes(id)))
    fail('capabilities.actions must match action implementations.');
}

// The type's declared actions, then those other modules add to it (ModuleApp.artifactActions), each with its availability.
export function artifactActions(
  spec: FileTypeSpec | undefined,
  module: FileTypeModule | undefined,
  context: ArtifactActionContext,
  contributed: readonly ArtifactAction[] = [],
) {
  const env = context.environment;
  return [
    ...(module?.actions ?? []).filter(action => spec?.capabilities.actions.includes(action.id)),
    ...contributed,
  ].map(action => {
    const base = capabilityAvailability(
      true,
      !env.present && 'This artifact is unavailable.',
      !env.renderer && 'The artifact renderer is unavailable.',
      Boolean(spec && !(env.scope === 'prototype' ? spec.inPrototype : spec.inSystemContent)) &&
        'This artifact type is unavailable in this scope.',
      action.localOnly && !env.local && 'This operation is available only in a local studio.',
      action.mutates && (!env.local || !env.editable) && 'You do not have permission to change this artifact.',
    );
    if (!base.available) return { action, availability: base };
    try {
      const reason = action.unavailable ? action.unavailable(context) : null;
      if (reason !== null && (typeof reason !== 'string' || !reason.trim()))
        throw new Error('Return a nonempty reason or null.');
      return { action, availability: capabilityAvailability(true, reason ?? undefined) };
    } catch {
      return {
        action,
        availability: capabilityAvailability(
          true,
          'This action could not determine availability. Check its module availability callback.',
        ),
      };
    }
  });
}

export type ArtifactActionTarget = {
  spec: FileTypeSpec | undefined;
  module: FileTypeModule | undefined;
  context: ArtifactActionContext;
  contributed?: readonly ArtifactAction[];
};

// Resolve current state after the menu closes; handlers still need server-authorized writes.
export async function runArtifactAction(id: string, resolve: () => ArtifactActionTarget | undefined) {
  const target = resolve();
  if (!target) throw new Error('This artifact is unavailable.');
  const entry = artifactActions(target.spec, target.module, target.context, target.contributed).find(
    ({ action }) => action.id === id,
  );
  if (!entry) throw new Error('This artifact action is unsupported.');
  if (!entry.availability.available) throw new Error(entry.availability.reason);
  return entry.action.run(target.context);
}

// Every route reader uses the same handoff: data and renderer must both be prepared.
export async function prepareFile<Props extends object>(
  module: FileTypeModule<Props>,
  context: ArtifactContext,
): Promise<Props | undefined> {
  const [props] = await Promise.all([module.load(context), module.Page.preload?.()]);
  return props;
}
