import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULES, ENABLED_MODULES } from '../lib/modules.js';
import { PLATFORM_ID, SYSTEM_IDS, SYSTEM_SPECS } from '../../modules/systems/node/systems.js';
import { loadContributors } from '../lib/contributors.js';
import { resolveContributor } from '../cli/resolve-contributor.js';
import { compatible } from '../../core/modules/index.ts';
import { CONFIG_FILE, studioRole } from '../../core/config.ts';
import { SYSTEM_ROOTS } from '../../core/roots.ts';
import { readSettings, saveSettings } from '../lib/studio-settings.js';
import { readJson, sameOrigin, send } from './files/http.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
// A system's declaration (<system root>/<id>/system.ts), in either root, restarts the server like the config does.
const isSystemDeclaration = file =>
  SYSTEM_ROOTS.some(systemsRoot => /^[^\\/]+[\\/]system\.ts$/.test(path.relative(path.join(ROOT, systemsRoot), file)));
const restarting = new WeakSet();
export const configurationRestartPending = server => restarting.has(server);

export default function settings() {
  const runtimeId = randomUUID();
  const configFile = path.join(ROOT, CONFIG_FILE);
  let restartTimer;
  return {
    name: 'studio-settings',
    apply: 'serve',
    transformIndexHtml() {
      // Runs before the module graph loads, so a configuration restart cannot flash a blank page.
      const scripts = ['src/platform/app/settings/restart-transition.js'];
      if (ENABLED_MODULES.some(module => module.id === 'systems'))
        scripts.push('src/platform/modules/systems/pages/creation-transition.js');
      return scripts.map(file => ({
        tag: 'script',
        children: fs.readFileSync(path.join(ROOT, file), 'utf8'),
        injectTo: 'body',
      }));
    },
    async hotUpdate({ file, server }) {
      if (file !== configFile && !isSystemDeclaration(file)) return;
      restarting.add(server);
      // Open tabs cover the stale studio until the reload that follows the restart.
      server.ws.send({ type: 'custom', event: 'studio:restarting' });
      while (fs.existsSync(path.join(ROOT, '.studio-system-operation')))
        await new Promise(resolve => setTimeout(resolve, 100));
      clearTimeout(restartTimer);
      restartTimer = setTimeout(
        () =>
          void server
            .restart()
            .then(() => server.ws.send({ type: 'full-reload' }))
            .catch(error => server.config.logger.error(error.message))
            .finally(() => restarting.delete(server)),
        200,
      );
      return [];
    },
    configureServer(server) {
      // Own configuration updates so settings saves trigger one restart.
      server.config.configFileDependencies = server.config.configFileDependencies.filter(
        file => file !== configFile && !isSystemDeclaration(file),
      );
      server.watcher.add(configFile);
      server.middlewares.use('/__studio/settings', async (req, res) => {
        if (!sameOrigin(req)) return send(res, 403, { error: 'Only the app can use this.' });
        try {
          const contributors = loadContributors();
          const actor = resolveContributor();
          const options = {
            root: ROOT,
            contributors,
            modules: Object.values(MODULES),
            systems: SYSTEM_IDS,
            platformId: PLATFORM_ID,
          };
          if (req.method === 'GET') {
            const { config, version } = readSettings(ROOT, contributors);
            return send(res, 200, {
              config,
              version,
              runtimeId,
              restarting: configurationRestartPending(server),
              actor,
              role: studioRole(config, actor, Object.keys(contributors)),
              contributors: Object.entries(contributors).map(([key, person]) => ({
                key,
                name: person.name,
                github: person.github ?? '',
              })),
              modules: options.modules.map(m => ({
                id: m.id,
                label: m.label,
                description: m.description,
                optional: m.optional,
                settings: m.settings,
                compatible: compatible(m),
              })),
              systems: SYSTEM_IDS.map(id => ({ id, label: SYSTEM_SPECS[id].label, status: SYSTEM_SPECS[id].status })),
            });
          }
          if (req.method === 'POST') {
            const { changes, base } = await readJson(req);
            const plan = saveSettings({ ...options, actor, changes, base });
            // The config hotUpdate hook owns the restart; restarting here would race it.
            send(res, 200, {
              saved: true,
              runtimeId,
              restarting: plan.edits.some(edit => edit.file === path.join(ROOT, CONFIG_FILE)),
            });
            return;
          }
          return send(res, 405, { error: 'Use GET or POST for studio settings.' });
        } catch (error) {
          return send(res, error.status ?? 500, { error: error.message });
        }
      });
    },
  };
}
