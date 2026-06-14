import type { WorkspacePackage } from '../types/package-json.ts';
import { join } from './path.ts';

export type WorkspaceGraph = Map<string, Set<string>>;

export type WorkspaceEdge = { dir: string; type: 'dependencies' | 'devDependencies' };
export type TypedWorkspaceGraph = Map<string, Set<WorkspaceEdge>>;

const types = ['peerDependencies', 'devDependencies', 'optionalDependencies', 'dependencies'] as const;

export function createWorkspaceGraph(
  cwd: string,
  wsNames: string[],
  wsPkgNames: Set<string>,
  wsPackages: Map<string, WorkspacePackage>
) {
  const graph: WorkspaceGraph = new Map();

  const packagesByPkgName = new Map<string, WorkspacePackage>();
  for (const pkg of wsPackages.values()) if (pkg.pkgName) packagesByPkgName.set(pkg.pkgName, pkg);

  const getWorkspaceDirs = (pkg: WorkspacePackage) => {
    const dirs = new Set<string>();
    for (const type of types) {
      if (pkg.manifest[type]) {
        for (const pkgName in pkg.manifest[type]) {
          if (wsPkgNames.has(pkgName)) {
            const wsPackage = packagesByPkgName.get(pkgName);
            if (wsPackage) dirs.add(wsPackage.dir);
          }
        }
      }
    }
    return dirs;
  };

  for (const name of wsNames) {
    const pkg = wsPackages.get(name);
    if (pkg) graph.set(join(cwd, name), getWorkspaceDirs(pkg));
  }

  return graph;
}

export function createTypedWorkspaceGraph(
  cwd: string,
  wsNames: string[],
  wsPkgNames: Set<string>,
  wsPackages: Map<string, WorkspacePackage>
): TypedWorkspaceGraph {
  const graph: TypedWorkspaceGraph = new Map();

  const packagesByPkgName = new Map<string, WorkspacePackage>();
  for (const pkg of wsPackages.values()) if (pkg.pkgName) packagesByPkgName.set(pkg.pkgName, pkg);

  const getWorkspaceEdges = (pkg: WorkspacePackage): Set<WorkspaceEdge> => {
    const edges = new Map<string, WorkspaceEdge>();
    for (const type of types) {
      if (pkg.manifest[type]) {
        for (const pkgName in pkg.manifest[type]) {
          if (wsPkgNames.has(pkgName)) {
            const wsPackage = packagesByPkgName.get(pkgName);
            if (wsPackage) {
              const edgeType: 'dependencies' | 'devDependencies' = type === 'dependencies' ? 'dependencies' : 'devDependencies';
              edges.set(wsPackage.dir, { dir: wsPackage.dir, type: edgeType });
            }
          }
        }
      }
    }
    return new Set(edges.values());
  };

  for (const name of wsNames) {
    const pkg = wsPackages.get(name);
    if (pkg) graph.set(join(cwd, name), getWorkspaceEdges(pkg));
  }

  return graph;
}
