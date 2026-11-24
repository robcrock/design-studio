// Prototype navigation: everything about the prototype at the top (PrototypeHeader.tsx, or the
// Context / Skills tabs for a system content section), then its files (FileTree.tsx). It is a
// SectionNav (shell/nav/), so it resizes like every section's navigation.
import type { Artifact, Prototype } from '@/platform/app/data/types';
import { SectionNav } from '@/platform/app/shell/nav';
import PrototypeHeader from '@/platform/modules/prototypes/viewer/PrototypeHeader';
import { FileTree } from '#studio/ui';
import { contributedArtifactActions } from '@/platform/app/modules';
import { prototypeFileTreePolicy } from './fileTreePolicy';

// Its files' menus also carry what other modules add to them (ModuleApp.artifactActions).
const policy = { ...prototypeFileTreePolicy, artifactActions: contributedArtifactActions };

export default function PrototypeNav({ proto, current }: { proto: Prototype; current: Artifact | undefined }) {
  return (
    <SectionNav label='Prototype navigation'>
      <PrototypeHeader proto={proto} />
      <FileTree policy={policy} proto={proto} current={current} />
    </SectionNav>
  );
}
