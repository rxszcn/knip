import type { WorkspacePackage } from '../types/package-json.ts';

const sanitizeId = (name: string) => name.replace(/[^a-zA-Z0-9_]/g, '_');

type Edge = { from: string; to: string; isDev: boolean };

/**
 * Builds a Mermaid flowchart of internal workspace dependencies.
 * Solid arrows (-->) are `dependencies`, dotted arrows (-.->) are `devDependencies`.
 */
export function getWorkspaceGraphMermaid(packages: Map<string, WorkspacePackage>, wsPkgNames: Set<string>) {
  const pkgNames: string[] = [];
  for (const pkg of packages.values()) if (pkg.pkgName) pkgNames.push(pkg.pkgName);
  pkgNames.sort();

  const ids = new Map<string, string>();
  const usedIds = new Set<string>();
  for (const pkgName of pkgNames) {
    let id = sanitizeId(pkgName);
    if (usedIds.has(id)) {
      let i = 2;
      while (usedIds.has(`${id}_${i}`)) i++;
      id = `${id}_${i}`;
    }
    usedIds.add(id);
    ids.set(pkgName, id);
  }

  const edges = new Map<string, Map<string, boolean>>();
  const addEdges = (from: string, deps: Record<string, string> | undefined, isDev: boolean) => {
    if (!deps) return;
    for (const to in deps) {
      if (to === from || !wsPkgNames.has(to) || !ids.has(to)) continue;
      let targets = edges.get(from);
      if (!targets) edges.set(from, (targets = new Map()));
      if (isDev) {
        if (!targets.has(to)) targets.set(to, true);
      } else targets.set(to, false);
    }
  };

  // `dependencies` before `devDependencies` so a shared edge stays solid (non-dev)
  for (const pkg of packages.values()) {
    if (!pkg.pkgName) continue;
    addEdges(pkg.pkgName, pkg.manifest.dependencies, false);
    addEdges(pkg.pkgName, pkg.manifest.devDependencies, true);
  }

  const edgeList: Edge[] = [];
  for (const [from, targets] of edges) for (const [to, isDev] of targets) edgeList.push({ from, to, isDev });
  edgeList.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  const lines = ['flowchart TD', '  %% --> dependencies, -.-> devDependencies'];
  for (const pkgName of pkgNames) lines.push(`  ${ids.get(pkgName)}["${pkgName}"]`);
  for (const edge of edgeList) lines.push(`  ${ids.get(edge.from)} ${edge.isDev ? '-.->' : '-->'} ${ids.get(edge.to)}`);

  return lines.join('\n');
}
