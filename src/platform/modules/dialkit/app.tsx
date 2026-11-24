// DialKit in the Studio app (README.md): Add and Remove in a view's menu, Hide and Show in the open prototype's
// menu, and the toast for a Save to code that failed in a preview. All of it is local: published sites have no DialKit.
import { useEffect, useSyncExternalStore } from 'react';
import { SlidersHorizontalIcon, ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';
import type { ModuleApp } from '#studio/ui';
import { toast } from '#studio/components';
import {
  artifactLabel,
  callModule,
  contribution,
  readSource,
  useManifest,
  writeSource,
  type Prototype,
} from '#studio/data';
import { repoPath } from '@/platform/app/data/files';
import {
  CHANNEL,
  isHidden,
  isToggleShortcut,
  setHidden,
  subscribeHidden,
  toggleShortcutLabel,
  type ChannelMessage,
  type Panels,
} from './lib/shared';
import type { DialKitContribution } from './contribution';

const usesDials = (views: string[] | undefined, proto: Pick<Prototype, 'contributorKey' | 'id'>, path: string) =>
  Boolean(views?.includes(repoPath(proto as Prototype, path)));

// The live values of a view open in a preview, so Remove keeps tuning that wasn't saved yet. None if it isn't open.
function liveValues(proto: Prototype, path: string): Promise<Panels> {
  const channel = new BroadcastChannel(CHANNEL);
  const id = crypto.randomUUID();
  return new Promise<Panels>(resolve => {
    const done = (panels: Panels) => {
      clearTimeout(timer);
      channel.close();
      resolve(panels);
    };
    const timer = setTimeout(() => done([]), 400);
    channel.onmessage = ({ data }: MessageEvent<ChannelMessage>) => {
      if (data?.kind === 'values' && data.id === id) done(data.panels);
    };
    channel.postMessage({
      kind: 'request',
      id,
      target: { contributor: proto.contributorKey, prototype: proto.id, artifact: path },
    } satisfies ChannelMessage);
  });
}

// Read the view, let the module's route rewrite it, and save it only if it hasn't changed since it was read.
async function rewrite(proto: Prototype, path: string, request: object) {
  const { content, version } = await readSource(proto, path);
  const next = await callModule<{ content: string }>('dialkit', 'transform', { ...request, source: content });
  await writeSource(proto, path, next.content, version);
}

// While a prototype is open: the shortcut in the app, and a toast for a Save to code that failed in its preview.
let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener('keydown', event => {
    if (!isToggleShortcut(event)) return;
    event.preventDefault();
    setHidden(!isHidden());
  });
  new BroadcastChannel(CHANNEL).onmessage = ({ data }: MessageEvent<ChannelMessage>) => {
    if (data?.kind === 'error') toast.add({ type: 'error', title: data.message });
  };
}

export default {
  icon: SlidersHorizontalIcon,
  rail: 'none',
  order: 90,
  localOnly: true,
  artifactActions({ proto, item, environment, manifest }) {
    if (item.fileType !== 'view' || environment.scope !== 'prototype') return [];
    const views = contribution<DialKitContribution>(manifest, 'dialkit')?.views;
    if (!usesDials(views, proto, item.path))
      return [
        {
          id: 'dialkit.add',
          label: 'Add DialKit',
          icon: SlidersHorizontalIcon,
          localOnly: true,
          mutates: true,
          async run({ proto, item }) {
            await rewrite(proto, item.path, { action: 'add', group: artifactLabel(item.path) });
            toast.add({ title: 'DialKit added' });
          },
        },
      ];
    return [
      {
        id: 'dialkit.remove',
        label: 'Remove DialKit',
        icon: SlidersHorizontalIcon,
        localOnly: true,
        mutates: true,
        async run({ proto, item }) {
          await rewrite(proto, item.path, { action: 'remove', panels: await liveValues(proto, item.path) });
          toast.add({ title: 'DialKit removed. Values kept.' });
        },
      },
    ];
  },
  useActions(proto) {
    const manifest = useManifest();
    const hidden = useSyncExternalStore(subscribeHidden, isHidden);
    useEffect(listen, []);
    const views = contribution<DialKitContribution>(manifest, 'dialkit')?.views;
    if (!views?.some(view => view.startsWith(repoPath(proto as Prototype, '')))) return [];
    return [
      {
        label: hidden ? 'Show DialKit' : 'Hide DialKit',
        icon: hidden ? ViewIcon : ViewOffSlashIcon,
        onSelect: () => setHidden(!hidden),
        display: true,
        shortcut: toggleShortcutLabel(),
      },
    ];
  },
} satisfies ModuleApp;
