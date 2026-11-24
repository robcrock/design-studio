import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditResourceIdentities } from '../lib/resource-identity-audit.js';
import { INSTALLED_FILE_TYPES } from '../lib/installed-file-types.js';
import { planPrototypeIdentification, applyPrototypeIdentification } from '../lib/prototype-identification.js';
import { resolveContributor } from './resolve-contributor.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const [command, ...args] = process.argv.slice(2);
const positional = [],
  flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--') continue;
  if (['--yes', '--json'].includes(args[i])) flags[args[i].slice(2)] = true;
  else if (args[i].startsWith('--')) throw new Error(`Unknown or incomplete option ${args[i]}.`);
  else positional.push(args[i]);
}
const usage = text => {
  throw new Error(`Usage: pnpm studio ${text}`);
};
const allowed = keys => {
  if (Object.keys(flags).some(key => !keys.includes(key))) usage(command);
};
const emit = (value, message) => console.log(flags.json ? JSON.stringify(value, null, 2) : message);

if (command === 'identity-audit') {
  allowed(['json']);
  if (positional.length) usage('identity-audit [--json]');
  const audit = auditResourceIdentities(ROOT, INSTALLED_FILE_TYPES);
  emit(
    audit,
    `${audit.resources.length} resources; ${audit.missing.length} missing identities.\n${audit.problems.join('\n')}`,
  );
  if (audit.problems.length || audit.missing.length) process.exitCode = 1;
} else if (command === 'identify') {
  allowed(['yes', 'json']);
  if (positional.length !== 1) usage('identify <prototype-folder> [--yes] [--json]');
  const actor = resolveContributor();
  const plan = planPrototypeIdentification(ROOT, INSTALLED_FILE_TYPES, positional[0], actor);
  // A preview lists the files only: IDs are drawn when --yes applies, in its own process.
  const result = flags.yes
    ? applyPrototypeIdentification(ROOT, INSTALLED_FILE_TYPES, plan, actor)
    : { folder: plan.folder, files: plan.changes.map(change => change.path) };
  emit(
    result,
    flags.yes
      ? `Assigned missing identities in ${plan.folder} (${result.changed} file(s)); existing identities retained.`
      : `${result.files.length} file(s) need identities in ${plan.folder}:\n${result.files.join('\n')}\nApply with --yes.`,
  );
}
