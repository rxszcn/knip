import type { TypedWorkspaceGraph } from './create-workspace-graph.ts';
import { relative } from './path.ts';

const sanitizeId = (name: string) => name.replace(/[^a-zA-Z0-9]/g, '_');

export function outputWorkspaceGraph(
  graph: TypedWorkspaceGraph,
  cwd: string,
  wsPkgNames: Map<string, string | undefined>
) {
  const lines: string[] = ['flowchart TD'];

  const dirToName = new Map<string, string>();
  const idByName = new Map<string, string>();

  for (const [dir, pkgName] of wsPkgNames) {
    const name = pkgName ?? relative(cwd, dir);
    dirToName.set(dir, name);
    idByName.set(name, sanitizeId(name));
  }

  const declared = new Set<string>();

  const ensureDeclared = (name: string) => {
    if (declared.has(name)) return;
    declared.add(name);
    const id = idByName.get(name)!;
    lines.push(`  ${id}["${name}"]`);
  };

  for (const [fromDir, deps] of graph) {
    const fromName = dirToName.get(fromDir);
    if (!fromName) continue;
    ensureDeclared(fromName);

    for (const { dir: toDir, type } of deps) {
      const toName = dirToName.get(toDir);
      if (!toName) continue;
      ensureDeclared(toName);

      const fromId = idByName.get(fromName)!;
      const toId = idByName.get(toName)!;

      if (type === 'devDependencies') {
        lines.push(`  ${fromId} -.->|dev| ${toId}`);
      } else {
        lines.push(`  ${fromId} --> ${toId}`);
      }
    }
  }

  console.log(lines.join('\n'));
}
