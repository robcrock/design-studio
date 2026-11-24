// A fitted, read-only picture of a canvas. No editor, saving, remembered camera, or agent API.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw, restoreElements, CaptureUpdateAction, getCommonBounds } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { EmbedProps } from '@/platform/app/data/fileTypeModule';
import { readSource } from '@/platform/app/data/files';
import { rootOf } from '@/platform/core/roots';
import { useManifest } from '@/platform/app/data/useManifest';
import { canvasFiles } from './loader';
import { parseCanvas } from './format';
import { CanvasItem, openingEmbedIds, validateEmbed } from './embeds';
import { useCanvasOpening, CanvasOpeningSurface } from './CanvasOpening';
import { useCanvasDark } from './theme';
import '@excalidraw/excalidraw/index.css';
import './canvas.css';

export default function CanvasEmbed(props: EmbedProps) {
  return <FittedCanvas key={`${props.proto.contributorKey}/${props.proto.id}/${props.item.path}`} {...props} />;
}

function FittedCanvas({ proto, item, width, height, loadingStartedAt }: EmbedProps) {
  const manifest = useManifest();
  const [text, setText] = useState<string>();
  const [error, setError] = useState(false);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const dark = useCanvasDark();
  const container = useRef<HTMLDivElement>(null);
  const { revealed, openingStatus } = useCanvasOpening(
    container,
    api,
    () => openingEmbedIds(api!.getSceneElements(), api!.getAppState(), manifest, proto, false),
    loadingStartedAt,
  );
  useEffect(() => {
    let active = true;
    let revision = 0;
    setText(undefined);
    setError(false);
    const load = async () => {
      const request = ++revision;
      try {
        const content = import.meta.env.DEV
          ? (await readSource(proto, item.path)).content
          : await canvasFiles[`/${rootOf(proto.contributorKey, proto.id)}/${item.path}`]?.();
        if (active && request === revision) {
          setText(content);
          setError(content === undefined);
        }
      } catch {
        if (active && request === revision) setError(true);
      }
    };
    const changed = (file: { contributor: string; prototype: string; path: string }) => {
      if (file.contributor === proto.contributorKey && file.prototype === proto.id && file.path === item.path)
        void load();
    };
    void load();
    import.meta.hot?.on('studio:file', changed);
    return () => {
      active = false;
      import.meta.hot?.off('studio:file', changed);
    };
  }, [proto.contributorKey, proto.id, item.path]);
  const scene = useMemo(() => {
    if (text === undefined) return null;
    try {
      const parsed = parseCanvas(text);
      return {
        elements: restoreElements(parsed.elements as never, null, { refreshDimensions: true }),
        background: parsed.background,
      };
    } catch {
      return null;
    }
  }, [text]);
  // The whole scene, fitted with a margin and never past 100%.
  useEffect(() => {
    if (!api || !scene) return;
    api.updateScene({
      elements: scene.elements,
      appState: { viewBackgroundColor: scene.background },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    if (!scene.elements.length) return;
    const [left, top, right, bottom] = getCommonBounds(scene.elements);
    const [w, h] = [right - left, bottom - top];
    // After the editor has loaded its first scene, which would otherwise reset the camera.
    let active = true;
    void api.onEvent('editor:initialize').then(ready => {
      if (active)
        ready.setViewport({
          target: { x: left - w * 0.05, y: top - h * 0.05, width: w * 1.1, height: h * 1.1 },
          fit: 'scale-down',
          animation: false,
        });
    });
    return () => {
      active = false;
    };
  }, [api, scene, width, height]);
  if (error || (text !== undefined && !scene))
    return (
      <p role='alert' className='p-4 text-sm'>
        This canvas could not load. Open it to inspect its source.
      </p>
    );
  return (
    <div
      ref={container}
      className='canvas canvas-preview relative overflow-hidden bg-muted/30'
      data-canvas-opening={revealed ? 'ready' : 'loading'}
      style={{ width, height, pointerEvents: 'none' }}
      aria-hidden
    >
      {!revealed && <CanvasOpeningSurface visible={openingStatus} />}
      <div className='canvas-scene absolute inset-0' style={{ opacity: revealed ? 1 : 0 }}>
        {scene && (
          <Excalidraw
            onExcalidrawAPI={setApi}
            initialData={{
              elements: scene.elements,
              appState: { theme: dark ? 'dark' : 'light', viewBackgroundColor: scene.background },
            }}
            interaction={false}
            ui={false}
            theme={dark ? 'dark' : 'light'}
            validateEmbeddable={validateEmbed}
            renderEmbeddable={element => (
              <CanvasItem
                element={element}
                manifest={manifest}
                current={proto}
                item={item}
                offscreen={false}
                overview={false}
                mounted
                playing={false}
              />
            )}
          />
        )}
      </div>
    </div>
  );
}
