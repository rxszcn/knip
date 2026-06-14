import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { KNIP_CONFIG_LOCATIONS } from './constants.ts';
import { Plugins } from './plugins/index.ts';
import type { Plugin } from './types/config.ts';
import { findFile } from './util/fs.ts';
import { hasDependency } from './util/plugin.ts';

const initHelpText = `Usage: knip init [options]

Generate a knip.json configuration file based on your project's dependencies.

Options:
  -y, --yes    Skip confirmation prompts (overwrite existing config without asking)
  -h, --help   Print this help text`;

export const runInit = async () => {
  let args: { help?: boolean; yes?: boolean } = {};
  try {
    const result = parseArgs({
      args: process.argv.slice(3),
      options: {
        help: { type: 'boolean', short: 'h' },
        yes: { type: 'boolean', short: 'y' },
      },
    });
    args = result.values;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message);
      console.log(`\n${initHelpText}`);
      process.exit(1);
    }
    throw error;
  }

  if (args.help) {
    console.log(initHelpText);
    process.exit(0);
  }

  const cwd = process.cwd();

  // Load package.json
  const manifestPath = findFile(cwd, 'package.json');
  if (!manifestPath) {
    console.error('No package.json found in the current directory.');
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    console.error('Failed to parse package.json.');
    process.exit(1);
  }

  // Build dependency set from all dependency types
  const dependencies = new Set<string>();
  for (const deps of [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ]) {
    if (deps && typeof deps === 'object') {
      for (const name of Object.keys(deps)) {
        dependencies.add(name);
      }
    }
  }

  // Scan plugins and collect enabled ones
  const enabledPlugins: string[] = [];
  const entries: string[] = [];
  const projects: string[] = [];

  for (const [pluginName, plugin] of Object.entries(Plugins) as [string, Plugin][]) {
    let isEnabled = false;
    try {
      if (typeof plugin.isEnabled === 'function') {
        isEnabled = await plugin.isEnabled({
          cwd,
          manifest: Object.assign(manifest, {
            scriptNames: new Set(Object.keys(manifest.scripts ?? {})),
            getMajor: (name: string) => {
              const range = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
              const match = range?.match(/\d+/)?.[0];
              return match ? Number.parseInt(match, 10) : undefined;
            },
          }),
          dependencies,
          config: {} as any,
        });
      } else if (plugin.enablers) {
        const enablers = typeof plugin.enablers === 'string' ? [plugin.enablers] : plugin.enablers;
        isEnabled = hasDependency(dependencies, enablers);
      }
    } catch {
      // Skip plugins that fail during isEnabled check
    }

    if (isEnabled) {
      enabledPlugins.push(pluginName);
      if (plugin.entry) entries.push(...plugin.entry);
      if (plugin.project) projects.push(...plugin.project);
    }
  }

  // Build config object
  const config: Record<string, unknown> = {
    $schema: 'https://unpkg.com/knip@6/schema.json',
  };

  // Add entry and project patterns (deduplicated)
  const uniqueEntries = [...new Set(entries)];
  const uniqueProjects = [...new Set(projects)];

  if (uniqueEntries.length > 0) config.entry = uniqueEntries;
  if (uniqueProjects.length > 0) config.project = uniqueProjects;

  // Enable detected plugins
  for (const pluginName of enabledPlugins) {
    config[pluginName] = true;
  }

  // Check for existing config file
  let existingConfigPath: string | undefined;
  for (const location of KNIP_CONFIG_LOCATIONS) {
    const found = findFile(cwd, location);
    if (found) {
      existingConfigPath = found;
      break;
    }
  }

  // Also check package.json#knip
  if (!existingConfigPath && manifest.knip) {
    existingConfigPath = manifestPath;
  }

  const configPath = join(cwd, 'knip.json');

  if (existingConfigPath) {
    if (!args.yes) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise<string>(resolve => {
        rl.question(`Config file already exists at ${existingConfigPath}. Overwrite? (y/N) `, resolve);
      });
      rl.close();
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('Aborted. No changes were made.');
        process.exit(0);
      }
    }
  }

  // Write config file
  const output = JSON.stringify(config, null, 2) + '\n';
  await writeFile(configPath, output, 'utf8');

  // Print summary
  console.log(`\nGenerated ${configPath}\n`);
  console.log(`Detected ${enabledPlugins.length} plugin(s):`);
  if (enabledPlugins.length > 0) {
    for (const name of enabledPlugins) {
      console.log(`  - ${name}`);
    }
  } else {
    console.log('  (none)');
  }
  console.log(`\nRun \`knip\` to start analyzing your project.`);
};
