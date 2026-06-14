/* oxlint-disable no-console */
import { writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { DEFAULT_EXTENSIONS, KNIP_CONFIG_LOCATIONS } from '../constants.ts';
import { Plugins } from '../plugins/index.ts';
import type { Plugin, WorkspaceConfiguration } from '../types/config.ts';
import type { PackageJson } from '../types/package-json.ts';
import { version } from '../version.ts';
import type { ParsedCLIArgs } from './cli-arguments.ts';
import { ConfigurationError } from './errors.ts';
import { findFile, isFile, loadJSON } from './fs.ts';
import { createManifest } from './package-json.ts';
import { join, normalize, toAbsolute, toPosix } from './path.ts';

const exts = [...DEFAULT_EXTENSIONS].map(ext => ext.slice(1)).join(',');

// Plugins only consult `dependencies` (and a few `cwd`/`manifest`) in `isEnabled`; a minimal
// workspace config is enough to evaluate them outside of a full knip run.
const stubWorkspaceConfig = { entry: [], project: [] } as unknown as WorkspaceConfiguration;

const confirmOverwrite = async (filename: string) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`A knip configuration already exists (${filename}). Overwrite? [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
};

const findExistingConfig = (cwd: string, manifest: PackageJson) => {
  for (const name of KNIP_CONFIG_LOCATIONS) if (isFile(cwd, name)) return name;
  if (manifest.knip) return 'package.json#knip';
  return undefined;
};

export const initConfig = async (args: ParsedCLIArgs) => {
  const pcwd = toPosix(process.cwd());
  const cwd = normalize(toAbsolute(toPosix(args.directory ?? pcwd), pcwd));

  const manifestPath = findFile(cwd, 'package.json');
  const rawManifest: PackageJson = manifestPath && (await loadJSON(manifestPath));
  if (!(manifestPath && rawManifest)) throw new ConfigurationError('Unable to find package.json');

  const manifest = createManifest(rawManifest);
  const dependencies = new Set([
    ...Object.keys(rawManifest.dependencies ?? {}),
    ...Object.keys(rawManifest.devDependencies ?? {}),
  ]);

  const enabledPlugins: string[] = [];
  for (const [pluginName, plugin] of Object.entries(Plugins) as [string, Plugin][]) {
    if (typeof plugin.isEnabled !== 'function') continue;
    if (await plugin.isEnabled({ cwd, manifest, dependencies, config: stubWorkspaceConfig })) {
      enabledPlugins.push(pluginName);
    }
  }
  enabledPlugins.sort();

  const existingConfig = findExistingConfig(cwd, rawManifest);
  if (existingConfig && !args.force) {
    const shouldOverwrite = await confirmOverwrite(existingConfig);
    if (!shouldOverwrite) {
      console.log('Aborted, no changes were made.');
      return;
    }
  }

  const major = version.split('.')[0];
  const config: Record<string, unknown> = {
    $schema: `https://unpkg.com/knip@${major}/schema.json`,
    entry: [`{index,cli,main}.{${exts}}`, `src/{index,cli,main}.{${exts}}`],
    project: [`**/*.{${exts}}`],
  };
  for (const pluginName of enabledPlugins) config[pluginName] = true;

  const configFilePath = join(cwd, 'knip.json');
  await writeFile(configFilePath, `${JSON.stringify(config, null, 2)}\n`);

  console.log(`Created ${configFilePath}`);
  console.log(
    enabledPlugins.length > 0
      ? `Enabled ${enabledPlugins.length} plugin${enabledPlugins.length === 1 ? '' : 's'}: ${enabledPlugins.join(', ')}`
      : 'No plugins were detected from the dependencies in package.json.'
  );
};
