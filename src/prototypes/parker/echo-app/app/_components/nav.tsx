// Whether this view is the given screen, by its path from the prototype root.
import { useIsPrototypeArtifact } from '@module/prototypes';

export function useIsOn(screen: string) {
  return useIsPrototypeArtifact(screen);
}
