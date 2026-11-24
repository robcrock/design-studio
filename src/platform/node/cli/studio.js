// pnpm studio <command>: configure, scaffold, and manage local modules and systems. For your agent: designers
// ask in plain words and the agent runs these. Every command that changes shared files says what it will do
// first, and changes nothing until it is run again with --yes.
const HELP = `Usage: pnpm studio <command> [options]

  configure [--name "..."] [--usage personal|team] [--system <id>] [--tagline "..."]
            [--admins key,key] [--maintainers system=key,key] [--recovery] [--yes]
                                      change only the settings you pass; the rest are kept
  status                              studio name, usage, default system, and contributor
  list                                what is installed, and what is on
  check                               validate the local studio
  sync [--check]                      synchronize routing and project skills; --check never writes
  context <prototype-folder> [--json] inspect assignment, rebuild target, scope, and guidance paths
  download <prototype-folder> [--out <file>]
                                      save the prototype as one HTML file that opens without Studio
                                      (the menu's Download; ~/Downloads/<id>.html unless --out)
  rename <prototype-folder> --title "..."
  duplicate <prototype-folder> [--title "..."] [--system <id> | --no-system]
                                      the prototype menu's Rename and Duplicate, for a prototype you own
  identity-audit [--json]             inspect existing and missing IDs; never writes
  identify <prototype-folder> [--yes] [--json]
                                      assign missing IDs to files created outside Studio
  enable <module> / disable <module>  turn an optional module on or off (its files stay)
  remove <module|system> [--content] [--yes] [--force]
                                      delete a module (its prototypes' content is kept unless --content) or a system
  create-module <id> [--label <name>] / create-system <id> [--label <name>]
                                      scaffold one in the local team root
  rename-system <id> --label <name> [--yes]
  archive-system <id> [--yes] / restore-system <id> [--restore-prototypes] [--yes] / delete-system <id> [--yes]
  preferences [--module <id>] --plan <file> / preferences --apply <file>`;
const command = process.argv[2];
if (command === 'help' || process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}
// Identity inspection and scoped assignment run without loading the runtime manifest.
if (['identity-audit', 'identify'].includes(command)) await import('./studio-identity.js');
else if (command === 'preferences') await import('./studio-preferences.js');
else await import('./studio-runtime.js');
