// Synthetic fixtures use the same persisted identity contract as source studios.
// Readable selectors remain convenient inputs to the fixture author, not storage.
import fs from 'node:fs';
import path from 'node:path';
import { createResourceId } from '../../../core/resourceIdentity.ts';
import { readDeclaration } from '../../../core/declarations.ts';
import { persistStudioReferences } from '../../../core/resourceReferences.ts';
import { ASSET_LIMIT_KB, CONFIG_FILE } from '../../../core/config.ts';
import { FORMAT_VERSIONS } from '../../../core/formats.ts';
import { serializeConfig, withSettings } from '../../../core/config-file.ts';
import { readResourceDirectory } from '../resource-directory.js';
import { editDeclaration } from '../studio-setup.js';
import { SUPPLIED_SYSTEMS_ROOT, TEAM_SYSTEMS_ROOT } from '../../../core/roots.ts';

// Writes studio.config.json for a fixture studio from a readable config, with the platform system installed beside
// the config's own systems. The config lists only prototype systems, as a real one does.
export function writeFixtureConfig(root, config) {
  for (const key of ['studio', ...config.systems]) {
    // The platform system (Studio) lives in the supplied root, the others in the team's.
    const file = path.join(root, key === 'studio' ? SUPPLIED_SYSTEMS_ROOT : TEAM_SYSTEMS_ROOT, key, 'system.ts');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file))
      fs.writeFileSync(
        file,
        `export default { role: '${key === 'studio' ? 'platform' : 'prototype'}', status: 'active', label: '${key}' };\n`,
      );
    const source = fs.readFileSync(file, 'utf8'),
      declaration = readDeclaration(source);
    if ('error' in declaration) throw new Error(declaration.error);
    if (!declaration.value.studioId) fs.writeFileSync(file, editDeclaration(source, { studioId: createResourceId() }));
  }
  const directory = readResourceDirectory(root);
  const persisted = persistStudioReferences(
    withSettings(config, {
      formatVersion: config.formatVersion ?? FORMAT_VERSIONS.config,
      assetLimitKB: config.assetLimitKB ?? ASSET_LIMIT_KB,
    }),
    directory,
  );
  fs.writeFileSync(path.join(root, CONFIG_FILE), serializeConfig(persisted));
  return { directory, persisted };
}
