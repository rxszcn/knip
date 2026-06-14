import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
// oxlint-disable-next-line no-restricted-imports
import path from 'node:path';
import { KNIP_CONFIG_LOCATIONS } from '../constants.ts';
import { ConfigurationError } from './errors.ts';
import { _load } from './loader.ts';

const CONCAT_ARRAY_FIELDS = new Set([
  'entry',
  'project',
  'ignore',
  'ignoreFiles',
  'ignoreBinaries',
  'ignoreDependencies',
  'ignoreMembers',
  'ignoreUnresolved',
  'ignoreWorkspaces',
  'include',
  'exclude',
]);

const SHALLOW_MERGE_FIELDS = new Set(['rules', 'paths']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const arrayify = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
};

const mergeConfigs = (base: Record<string, any>, override: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = { ...base };

  for (const key of Object.keys(override)) {
    const baseValue = base[key];
    const overrideValue = override[key];

    if (CONCAT_ARRAY_FIELDS.has(key)) {
      result[key] = [...arrayify(baseValue), ...arrayify(overrideValue)];
    } else if (SHALLOW_MERGE_FIELDS.has(key)) {
      if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
        result[key] = { ...baseValue, ...overrideValue };
      } else {
        result[key] = overrideValue;
      }
    } else if (
      key !== '$schema' &&
      key !== 'compilers' &&
      key !== 'syncCompilers' &&
      key !== 'asyncCompilers' &&
      key !== 'tags' &&
      key !== 'extends' &&
      isPlainObject(baseValue) &&
      isPlainObject(overrideValue)
    ) {
      // Deep merge for workspaces, ignoreIssues, plugin configs, and other objects
      const merged: Record<string, any> = { ...baseValue };
      for (const subKey of Object.keys(overrideValue)) {
        if (isPlainObject(merged[subKey]) && isPlainObject(overrideValue[subKey])) {
          merged[subKey] = mergeConfigs(merged[subKey], overrideValue[subKey]);
        } else {
          merged[subKey] = overrideValue[subKey];
        }
      }
      result[key] = merged;
    } else {
      result[key] = overrideValue;
    }
  }

  return result;
};

const KNIP_CONFIG_FILE_EXTENSIONS = new Set([
  '.json',
  '.jsonc',
  '.json5',
  '.yaml',
  '.yml',
  '.toml',
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
]);

const resolvePresetPath = (preset: string, configDir: string): string => {
  // Relative or absolute path
  if (preset.startsWith('./') || preset.startsWith('../') || path.isAbsolute(preset)) {
    const resolved = path.resolve(configDir, preset);

    // If the path already has a known extension, check existence directly
    const ext = path.extname(resolved);
    if (KNIP_CONFIG_FILE_EXTENSIONS.has(ext)) {
      if (existsSync(resolved)) return resolved;
      throw new ConfigurationError(`Cannot resolve extends preset: ${preset} (looked for ${resolved})`);
    }

    // No extension: try the path as-is, then try appending knip config filenames
    if (existsSync(resolved)) return resolved;

    for (const name of KNIP_CONFIG_LOCATIONS) {
      const candidate = path.join(resolved, name);
      if (existsSync(candidate)) return candidate;
    }

    throw new ConfigurationError(`Cannot resolve extends preset: ${preset} (looked for ${resolved})`);
  }

  // npm package resolution
  try {
    const require = createRequire(path.join(configDir, 'package.json'));
    return require.resolve(preset);
  } catch {
    // Try appending knip config filenames under node_modules
    try {
      const require = createRequire(path.join(configDir, 'package.json'));
      const packageDir = path.dirname(require.resolve(`${preset}/package.json`));
      for (const name of KNIP_CONFIG_LOCATIONS) {
        const candidate = path.join(packageDir, name);
        if (existsSync(candidate)) return candidate;
      }
    } catch {
      // fall through
    }
    throw new ConfigurationError(`Cannot resolve extends preset: ${preset}`);
  }
};

const loadPresetConfig = async (presetPath: string): Promise<Record<string, any>> => {
  try {
    const loaded = await _load(presetPath);
    if (typeof loaded === 'function') {
      throw new ConfigurationError(`Function configs are not supported in extends presets: ${presetPath}`);
    }
    return loaded as Record<string, any>;
  } catch (error) {
    if (error instanceof ConfigurationError) throw error;
    throw new ConfigurationError(`Error loading extends preset: ${presetPath}`, { cause: error });
  }
};

export const resolveExtends = async (
  config: Record<string, any>,
  configFilePath: string,
  visited: Set<string> = new Set()
): Promise<Record<string, any>> => {
  const { extends: extendsField, ...restConfig } = config;

  if (!extendsField) {
    return config;
  }

  const normalizedPath = path.resolve(configFilePath);
  if (visited.has(normalizedPath)) {
    throw new ConfigurationError(`Circular extends detected: ${configFilePath}`);
  }
  visited.add(normalizedPath);

  const configDir = path.dirname(configFilePath);
  const extendsArray = Array.isArray(extendsField) ? extendsField : [extendsField];

  let mergedBase: Record<string, any> = {};

  for (const preset of extendsArray) {
    const presetPath = resolvePresetPath(preset, configDir);
    const presetConfig = await loadPresetConfig(presetPath);
    const resolvedPresetConfig = await resolveExtends(presetConfig, presetPath, visited);
    mergedBase = mergeConfigs(mergedBase, resolvedPresetConfig);
  }

  return mergeConfigs(mergedBase, restConfig);
};
