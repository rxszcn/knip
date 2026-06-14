import { createRequire } from 'node:module';
import type { ParsedCLIArgs } from './cli-arguments.ts';
import { debugLogObject } from './debug.ts';
import { ConfigurationError } from './errors.ts';
import { findFileWithExtensions } from './fs.ts';
import { _load } from './loader.ts';
import { deepMergeConfigs } from './object.ts';
import { dirname, extname, isAbsolute, join, toPosix } from './path.ts';

const CONFIG_EXTENSIONS = ['.json', '.jsonc', '.js', '.ts', '.mjs', '.cjs'];

const unwrapFunction = async (maybeFunction: unknown, options: ParsedCLIArgs) => {
  if (typeof maybeFunction === 'function') {
    try {
      return await maybeFunction(options);
    } catch (error) {
      debugLogObject('*', 'Error executing function:', error);
      throw error;
    }
  }
  return maybeFunction;
};

const resolveExtendsSpecifier = (specifier: string, configDir: string): string => {
  if (specifier.startsWith('.') || isAbsolute(specifier)) {
    const resolved = isAbsolute(specifier) ? specifier : join(configDir, specifier);
    if (!extname(resolved)) {
      const found = findFileWithExtensions(resolved, CONFIG_EXTENSIONS);
      if (found) return found;
    }
    return resolved;
  }

  try {
    const req = createRequire(join(configDir, 'noop.js'));
    return toPosix(req.resolve(specifier));
  } catch {
    throw new ConfigurationError(`Unable to resolve extends "${specifier}" from ${configDir}`);
  }
};

const resolveExtends = async (
  config: Record<string, unknown>,
  configDir: string,
  visited: Set<string>,
  options: ParsedCLIArgs,
): Promise<Record<string, unknown>> => {
  const extendsValue = config.extends;
  if (!extendsValue) return config;

  const extendsPaths = Array.isArray(extendsValue) ? extendsValue : [extendsValue];
  for (const p of extendsPaths) {
    if (typeof p !== 'string') {
      throw new ConfigurationError(`Invalid extends value: ${JSON.stringify(extendsValue)}`);
    }
  }

  const configWithoutExtends: Record<string, unknown> = { ...config };
  delete configWithoutExtends.extends;

  let base: Record<string, unknown> = {};

  for (const spec of extendsPaths) {
    const resolvedPath = resolveExtendsSpecifier(spec, configDir);

    if (visited.has(resolvedPath)) {
      throw new ConfigurationError(
        `Circular extends detected: ${[...visited, resolvedPath].join(' → ')}`,
      );
    }

    const loadedValue = await _load(resolvedPath);
    const rawExtended = await unwrapFunction(loadedValue, options);

    if (!rawExtended || typeof rawExtended !== 'object') {
      throw new ConfigurationError(`Extended config at ${resolvedPath} must export an object`);
    }

    const resolvedExtended = await resolveExtends(
      rawExtended as Record<string, unknown>,
      dirname(resolvedPath),
      new Set([...visited, resolvedPath]),
      options,
    );

    base = deepMergeConfigs(base, resolvedExtended);
  }

  return deepMergeConfigs(base, configWithoutExtends);
};

export async function loadResolvedConfigFile(configPath: string, options: ParsedCLIArgs) {
  const loadedValue = await _load(configPath);
  const rawConfig = await unwrapFunction(loadedValue, options);

  if (!rawConfig || typeof rawConfig !== 'object') {
    throw new ConfigurationError(`Config at ${configPath} must export an object`);
  }

  const configDir = dirname(configPath);
  return resolveExtends(
    rawConfig as Record<string, unknown>,
    configDir,
    new Set([configPath]),
    options,
  );
}
