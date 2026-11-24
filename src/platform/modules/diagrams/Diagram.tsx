import { useEffect, useState } from 'react';
import { MermaidDiagram } from '#studio/ui';
import { readSource, type Artifact, type Prototype } from '#studio/data';

export type DiagramProps = { proto: Prototype; item: Artifact; source: string; compact?: boolean };

export default function Diagram({ proto, item, source: initial, compact = false }: DiagramProps) {
  const [source, setSource] = useState(initial);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    let revision = 0;
    setSource(initial);
    setError(undefined);
    const changed = async (file: { contributor: string; prototype: string; path: string }) => {
      if (file.contributor !== proto.contributorKey || file.prototype !== proto.id || file.path !== item.path) return;
      const request = ++revision;
      try {
        const next = await readSource(proto, item.path);
        if (active && request === revision) {
          setSource(next.content);
          setError(undefined);
        }
      } catch (error) {
        if (active && request === revision) setError(error instanceof Error ? error.message : String(error));
      }
    };
    import.meta.hot?.on('studio:file', changed);
    return () => {
      active = false;
      import.meta.hot?.off('studio:file', changed);
    };
  }, [proto.contributorKey, proto.id, item.path, initial]);

  return (
    <div
      data-artifact-identity={JSON.stringify([
        proto.studioId ?? [proto.contributorKey, proto.id],
        item.studioId ?? item.path,
      ])}
      className={
        compact
          ? 'flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden bg-card'
          : 'flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-background'
      }
    >
      {error ? (
        <p role='alert' className='p-4 text-sm'>
          {error}
        </p>
      ) : (
        <MermaidDiagram source={source} compact={compact} fit zoomable={!compact} />
      )}
    </div>
  );
}
