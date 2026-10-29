import {
  createArtifactLifecycle,
  digestText,
  freshness,
  lifecycleAttributes,
  initialLifecycle,
  type Preparation,
} from '@/platform/core/artifact-lifecycle/index';
import { useEffect, useId, useRef, useState } from 'react';
import { DiagramViewport } from './DiagramViewport';
import { diagramTheme } from './diagramTheme';
import { useDiagramEnvironment } from './useDiagramEnvironment';

export function MermaidDiagram({
  source,
  compact = false,
  fit = false,
}: {
  source: string;
  compact?: boolean;
  fit?: boolean;
}) {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { host, environment } = useDiagramEnvironment();
  const [result, setResult] = useState<{
    svg?: string;
    error?: string;
    ticket?: Preparation;
    controller?: ReturnType<typeof createArtifactLifecycle>;
  }>({});
  const [lifecycle, setLifecycle] = useState(initialLifecycle);
  const current = useRef<ReturnType<typeof createArtifactLifecycle> | null>(null);
  useEffect(() => {
    const controller = createArtifactLifecycle(setLifecycle);
    current.current = controller;
    return () => {
      current.current = null;
      controller.dispose();
    };
  }, [id]);
  useEffect(() => {
    if (result.svg && result.ticket && result.controller === current.current) result.controller?.commit(result.ticket);
  }, [result]);

  useEffect(() => {
    let active = true;
    const controller = current.current!;
    controller.unknown(); // Keep the prior SVG until the replacement succeeds.
    if (!environment.width) return;
    const deadline = setTimeout(() => {
      active = false;
      controller.unknown('Diagram rendering took too long. Repair the source or reload this view.');
      setResult(previous => ({ svg: previous.svg }));
    }, 15000);
    void (async () => {
      let ticket: Preparation | null = null;
      try {
        const [sourceRevision, inputs] = await Promise.all([
          digestText(source),
          digestText(JSON.stringify([source, environment])),
        ]);
        if (!active) return;
        ticket = controller.prepare({ source: sourceRevision, inputs });
      } catch {
        if (!active) return;
        controller.unknown(); // Missing revision evidence must not prevent diagram rendering.
      }
      if (!active) return;
      try {
        if (source.length > 50000) throw new Error('Diagram source is longer than the limit of 50000 characters.');
        await Promise.allSettled([
          document.fonts.load(`14px ${environment.fontFamily}`, source),
          document.fonts.load(`14px ${environment.fontFamilyMono}`, source),
        ]);
        if (!active) return;
        const pele = await import('pele/lazy');
        await pele.load(pele.detectType(source));
        if (!active) return;
        pele.forgetTextWidths();
        const { svg } = pele.render(source, {
          idPrefix: id,
          autoDirection: false,
          maxWidth: environment.width,
          fontFamily: environment.fontFamily,
          fontFamilyMono: environment.fontFamilyMono,
          fontSize: 14,
          links: false,
          images: false,
          limit: 50000,
          outputLimit: 4000000,
          maxEdges: 500,
        });
        if (active) {
          clearTimeout(deadline);
          setResult({ svg, ticket: ticket ?? undefined, controller });
        }
      } catch (error) {
        if (!active) return;
        clearTimeout(deadline);
        const detail = error instanceof Error ? error.message : String(error);
        if (ticket) controller.fail(ticket, detail, false);
        else controller.error(detail, false);
        setResult({ error: detail });
      }
    })().catch(error => {
      if (active) {
        clearTimeout(deadline);
        controller.unknown(String(error));
        setResult({ error: String(error) });
      }
    });
    return () => {
      active = false;
      clearTimeout(deadline);
    };
  }, [source, id, environment]);

  return (
    <figure
      ref={host}
      style={diagramTheme(environment.dark)}
      {...lifecycleAttributes(lifecycle)}
      className={
        fit || compact
          ? `not-prose flex h-full min-h-0 min-w-0 flex-1 flex-col ${compact ? 'bg-card p-3' : 'bg-background p-6'}`
          : 'not-prose my-6 min-w-0 rounded-lg border border-border bg-card p-4'
      }
    >
      {(lifecycle.detail || (result.svg && freshness(lifecycle) === 'stale')) && (
        <figcaption role='status' className='text-xs text-muted-foreground'>
          {lifecycle.detail || 'Updating diagram…'}
        </figcaption>
      )}
      {result.svg ? (
        fit && !compact ? (
          <DiagramViewport svg={result.svg} resetKey={source} />
        ) : (
          <div
            className={
              fit || compact
                ? 'relative min-h-0 min-w-0 flex-1 overflow-hidden [&_svg]:absolute [&_svg]:inset-0 [&_svg]:h-full! [&_svg]:w-full! [&_svg]:max-w-none!'
                : 'overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full'
            }
            dangerouslySetInnerHTML={{ __html: result.svg }}
          />
        )
      ) : result.error ? (
        <div role='alert' className='min-h-0 overflow-auto'>
          <p className='text-sm font-medium'>Unable to render Mermaid diagram.</p>
          <pre className='mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground'>{result.error}</pre>
        </div>
      ) : (
        <p role='status' className='text-sm text-muted-foreground'>
          Rendering diagram…
        </p>
      )}
    </figure>
  );
}
