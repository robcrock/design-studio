// Inert preview laid out at a screen width (the surface's, or the prototype's default screen), scaled to fit
// the embedding surface's width and cropped at its height.
import type { EmbedProps } from '@/platform/app/data/fileTypeModule';
import PreviewHost from './preview/PreviewHost';
import { prototypeScopeOf } from './preview/protocol';
import { loadPreview } from './preview/target';

export default function ViewEmbed({ proto, item, width, height, viewport, still }: EmbedProps) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const screen = viewport ?? proto.screens[0].width;
  const scale = width / screen;
  const preview = loadPreview({ proto, item });
  return (
    <div aria-hidden inert className='relative overflow-hidden bg-background' style={{ width, height }}>
      <div
        className='absolute left-0 top-0 flex origin-top-left'
        style={{ width: screen, height: height / scale, transform: 'scale(' + scale + ')' }}
      >
        <PreviewHost
          key={prototypeScopeOf(preview.target)}
          {...preview}
          surface='embed'
          still={still}
          width={screen}
          height={height / scale}
        />
      </div>
    </div>
  );
}
