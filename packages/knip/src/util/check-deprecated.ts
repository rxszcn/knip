import type { DependencyDeputy } from '../DependencyDeputy.ts';
import type { IssueCollector } from '../IssueCollector.ts';

const NPM_REGISTRY_URL = 'https://registry.npmjs.org';
const REQUEST_TIMEOUT_MS = 5000;
const CONCURRENCY_LIMIT = 10;

interface NpmRegistryResponse {
  'dist-tags'?: Record<string, string>;
  versions?: Record<string, { deprecated?: string }>;
}

const fetchPackageInfo = async (packageName: string): Promise<string | undefined> => {
  const url = `${NPM_REGISTRY_URL}/${encodeURIComponent(packageName).replace('%40', '@')}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as NpmRegistryResponse;
    const latestVersion = data['dist-tags']?.latest;
    if (!latestVersion) return undefined;
    const versionInfo = data.versions?.[latestVersion];
    return versionInfo?.deprecated;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
};

export const checkDeprecatedDependencies = async (
  deputy: DependencyDeputy,
  collector: IssueCollector,
) => {
  const tasks: Array<{ name: string; filePath: string; workspace: string }> = [];

  for (const [workspaceName, manifest] of deputy._manifests) {
    const allDeps = [...manifest.dependencies, ...manifest.devDependencies];
    for (const dep of allDeps) {
      tasks.push({ name: dep, filePath: manifest.manifestPath, workspace: workspaceName });
    }
  }

  // Process in batches to limit concurrency
  for (let i = 0; i < tasks.length; i += CONCURRENCY_LIMIT) {
    const batch = tasks.slice(i, i + CONCURRENCY_LIMIT);
    const results = await Promise.allSettled(batch.map(task => fetchPackageInfo(task.name)));
    for (let j = 0; j < batch.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value) {
        const task = batch[j];
        collector.addIssue({
          type: 'deprecated',
          filePath: task.filePath,
          workspace: task.workspace,
          symbol: task.name,
          specifier: result.value,
          fixes: [],
        });
      }
    }
  }
};
