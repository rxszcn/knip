import type { ParsedCLIArgs } from './cli-arguments.ts';
import { debugLogObject } from './debug.ts';
import { ConfigurationError } from './errors.ts';
import { resolveExtends } from './extends.ts';
import { _load } from './loader.ts';

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

export async function loadResolvedConfigFile(configPath: string, options: ParsedCLIArgs): Promise<any> {
  const loadedValue = await _load(configPath);
  try {
    const rawConfig = await unwrapFunction(loadedValue, options);
    return await resolveExtends(rawConfig as Record<string, any>, configPath);
  } catch (_error) {
    if (_error instanceof ConfigurationError) throw _error;
    throw new ConfigurationError(`Error running the function from ${configPath}`, { cause: _error });
  }
}
