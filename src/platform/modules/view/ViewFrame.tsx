// Host-side descriptor only. Prototype components execute in the child runtime.
import PreviewHost from './preview/PreviewHost';
import { prototypeScopeOf } from './preview/protocol';
import type { loadPreview } from './preview/target';

export default function ViewFrame({ target, href, title }: ReturnType<typeof loadPreview>) {
  return (
    <PreviewHost
      key={prototypeScopeOf(target)}
      target={target}
      href={href}
      title={title}
      surface='page'
      still={false}
    />
  );
}
