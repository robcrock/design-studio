import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useManifest } from '../data/useManifest';
import { fileTypeModules, fileTypeOf } from '../data/fileTypes';
import { inspectArtifact, resolveArtifact, type ArtifactRequest, type ArtifactResolution } from './resolveArtifact';
import type { Manifest } from '../data/types';
import ArtifactCard from './ArtifactCard';
import EmbedFrame from './EmbedFrame';

export type ArtifactHostProps = {
  request: ArtifactRequest;
  width: number;
  height: number;
  viewport?: number; // the screen width a view is laid out at (EmbedProps)
  label?: string;
  presentation?: 'preview' | 'card';
  interaction?: 'inert' | 'interactive';
  mounted?: boolean;
  hidden?: boolean;
  still?: boolean;
  loadingStartedAt?: number;
  className?: string;
  children?: ReactNode;
  manifest?: Manifest;
};
export function ArtifactHost({
  request,
  width,
  height,
  viewport,
  label,
  presentation = 'preview',
  interaction = 'inert',
  mounted = true,
  hidden = false,
  still = false,
  loadingStartedAt,
  className,
  children,
  manifest: supplied,
}: ArtifactHostProps) {
  const current = useManifest();
  const manifest = supplied ?? current;
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const updated = () => setRevision(n => n + 1);
    import.meta.hot?.on('vite:afterUpdate', updated);
    return () => import.meta.hot?.off('vite:afterUpdate', updated);
  }, []);
  const inspected = inspectArtifact(request, manifest);
  const key = JSON.stringify([
    request.reference,
    request.surface,
    request.origin.proto.studioId,
    request.origin.item.studioId,
    request.origin.item.path,
  ]);
  const [completed, setCompleted] = useState<{ key: string; manifest: Manifest; result: ArtifactResolution } | null>(
    null,
  );
  const opening = useRef({ reference: request.reference, started: Date.now() });
  if (opening.current.reference !== request.reference)
    opening.current = { reference: request.reference, started: Date.now() };
  const started = loadingStartedAt ?? opening.current.started;
  useEffect(() => {
    if (inspected.state !== 'pending') return;
    const controller = new AbortController();
    resolveArtifact(request, { manifest, signal: controller.signal }).then(
      result => !controller.signal.aborted && setCompleted({ key, manifest, result }),
      error => {
        if (!controller.signal.aborted)
          setCompleted({
            key,
            manifest,
            result: {
              state: 'unavailable',
              code: 'unavailable',
              message: error instanceof Error ? error.message : 'This inventory could not load.',
            },
          });
      },
    );
    return () => controller.abort();
  }, [key, manifest, inspected.state]);
  const resolution =
    inspected.state === 'pending' && completed?.key === key && completed.manifest === manifest
      ? completed.result
      : inspected;
  const target = resolution.state === 'resolved' ? resolution.target : undefined;
  const type = target?.item.fileType ?? fileTypeOf(request.reference);
  const module = type ? fileTypeModules[type] : undefined;
  const Embed = module?.Embed;
  const Pending = module?.EmbedPending;
  const pending = Pending ? (
    <Pending loadingStartedAt={started} />
  ) : (
    <p role='status' className='p-4 text-sm text-muted-foreground'>
      Loading preview…
    </p>
  );
  const preview =
    resolution.state === 'resolved' && resolution.preview.available && presentation === 'preview' && Embed;
  if (resolution.state === 'unavailable' || (resolution.state === 'resolved' && !preview))
    return (
      <ArtifactCard
        proto={target?.proto}
        item={target?.item}
        elsewhere={resolution.state === 'unavailable' && resolution.code === 'unsupported_scope'}
        message={
          resolution.state === 'unavailable'
            ? resolution.message
            : resolution.state === 'resolved' && resolution.preview.code === 'missing_system'
              ? resolution.preview.message
              : undefined
        }
        className={className}
      />
    );
  return (
    <EmbedFrame proto={target?.proto} item={target?.item} label={label} className={className}>
      <div
        inert={interaction === 'inert' ? true : undefined}
        className='min-h-0'
        style={{
          height,
          flex: '1 1 auto',
          pointerEvents: interaction === 'inert' ? 'none' : undefined,
          ...(hidden ? { visibility: 'hidden', contentVisibility: 'hidden' } : {}),
        }}
      >
        {!mounted ? (
          <div className='h-full bg-muted/50' />
        ) : preview && target ? (
          <ErrorBoundary
            resetKeys={[request.reference, Embed, revision]}
            fallback={
              <p role='alert' className='p-4 text-sm'>
                This preview could not render. Open the file to inspect it.
              </p>
            }
          >
            <Suspense fallback={pending}>
              <Embed
                proto={target.proto}
                item={target.item}
                width={width}
                height={height}
                viewport={viewport}
                still={still}
                loadingStartedAt={started}
              />
            </Suspense>
          </ErrorBoundary>
        ) : (
          pending
        )}
      </div>
      {children}
    </EmbedFrame>
  );
}
