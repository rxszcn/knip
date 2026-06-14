import type { Issue } from '../types/issues.ts';
import { debugLog } from './debug.ts';
import { isFile, loadJSON } from './fs.ts';
import { join } from './path.ts';

export interface DeprecatableDependencies {
  workspaceName: string;
  manifestPath: string;
  workspaceDir: string;
  names: string[];
}

interface AbbreviatedPackument {
  'dist-tags'?: { latest?: string };
  versions?: Record<string, { deprecated?: string }>;
}

const CONCURRENCY = 10;

export const getRegistryUrl = () =>
  (process.env.npm_config_registry ?? 'https://registry.npmjs.org').replace(/\/+$/, '');

const getInstalledVersion = async (workspaceDir: string, cwd: string, name: string) => {
  for (const dir of new Set([workspaceDir, cwd])) {
    const filePath = join(dir, 'node_modules', name, 'package.json');
    if (isFile(filePath)) {
      try {
        const manifest: { version?: string } = await loadJSON(filePath);
        if (manifest?.version) return manifest.version;
      } catch {}
    }
  }
};

const fetchPackument = async (registryUrl: string, name: string) => {
  const url = `${registryUrl}/${name.replace('/', '%2F')}`;
  try {
    const response = await fetch(url, { headers: { accept: 'application/vnd.npm.install-v1+json' } });
    if (!response.ok) {
      if (response.status !== 404) debugLog('*', `Registry responded ${response.status} for ${name}`);
      return;
    }
    return (await response.json()) as AbbreviatedPackument;
  } catch (error) {
    debugLog('*', `Failed to query registry for ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const getDeprecationMessage = (packument: AbbreviatedPackument, installedVersion?: string) => {
  const versions = packument.versions;
  if (!versions) return;
  if (installedVersion) {
    const deprecated = versions[installedVersion]?.deprecated;
    if (typeof deprecated === 'string' && deprecated.length > 0) return deprecated;
    // Installed version is present and not deprecated: the actual dependency is fine
    if (installedVersion in versions) return;
  }
  const latest = packument['dist-tags']?.latest;
  const deprecated = latest ? versions[latest]?.deprecated : undefined;
  if (typeof deprecated === 'string' && deprecated.length > 0) return deprecated;
};

export const getDeprecatedIssues = async (candidates: DeprecatableDependencies[], cwd: string): Promise<Issue[]> => {
  const registryUrl = getRegistryUrl();
  const issues: Issue[] = [];

  const tasks: Array<() => Promise<void>> = [];
  for (const { workspaceName, manifestPath, workspaceDir, names } of candidates) {
    for (const name of names) {
      tasks.push(async () => {
        const [packument, installedVersion] = await Promise.all([
          fetchPackument(registryUrl, name),
          getInstalledVersion(workspaceDir, cwd, name),
        ]);
        if (!packument) return;
        const message = getDeprecationMessage(packument, installedVersion);
        if (message) {
          issues.push({
            type: 'deprecated',
            filePath: manifestPath,
            workspace: workspaceName,
            symbol: name,
            specifier: `${name}: ${message}`,
            fixes: [],
          });
        }
      });
    }
  }

  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    await Promise.all(tasks.slice(i, i + CONCURRENCY).map(task => task()));
  }

  return issues.sort((a, b) => a.symbol.localeCompare(b.symbol));
};
