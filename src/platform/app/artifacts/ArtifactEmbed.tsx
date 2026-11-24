// Markdown owns responsive measurement; shared artifact services own resolution and presentation.
import { useContext, useLayoutEffect, useRef, useState } from 'react';
import { DocArtifact } from '../docs/DocBase';
import { ArtifactHost } from './ArtifactHost';
export default function ArtifactEmbed({ source, label = 'Artifact' }: { source: string; label?: string }) {
  const origin = useContext(DocArtifact);
  const [width, setWidth] = useState(640);
  const container = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (container.current) setWidth(Math.max(1, container.current.getBoundingClientRect().width));
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(1, entry.contentRect.width)));
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  return (
    <figure className='not-studio-prose my-6 min-w-0' ref={container}>
      {origin ? (
        <ArtifactHost
          request={{ reference: source, origin, surface: 'document' }}
          label={label}
          width={width}
          height={Math.max(220, Math.min(440, width * 0.6))}
          interaction='inert'
        />
      ) : (
        <p role='status' className='p-4 text-sm text-muted-foreground'>
          Choose a file inside this prototype.
        </p>
      )}
    </figure>
  );
}
