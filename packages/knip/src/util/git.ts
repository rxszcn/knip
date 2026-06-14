import { execFileSync, execSync } from 'node:child_process';
import { isAbsolute, join, toPosix } from './path.ts';

// TODO More hooks exists, but is it worth adding all of them?
// https://git-scm.com/docs/githooks
// https://github.com/fisker/git-hooks-list/blob/main/index.json

const hookFileNames = [
  'prepare-commit-msg',
  'commit-msg',
  'pre-{applypatch,commit,merge-commit,push,rebase,receive}',
  'post-{checkout,commit,merge,rewrite}',
];

const getGitHooksPath = (defaultPath = '.git/hooks', cwd: string | undefined) => {
  try {
    return execSync('git rev-parse --git-path hooks', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      cwd,
    }).trim();
  } catch (_error) {
    return defaultPath;
  }
};

export const getGitHookPaths = (defaultPath = '.git/hooks', followGitConfig = true, cwd?: string) => {
  const gitHooksPath = followGitConfig ? getGitHooksPath(defaultPath, cwd) : defaultPath;
  return hookFileNames.map(fileName => join(gitHooksPath, fileName));
};

// Run a git command without a shell, so refs/branch names can't be interpreted as shell input
const git = (args: string[], cwd: string) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], cwd }).trim();

const resolveBaseRef = (cwd: string, base?: string) => {
  for (const ref of base ? [base] : ['main', 'master']) {
    try {
      git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], cwd);
      return ref;
    } catch {
      // try next candidate
    }
  }
  return undefined;
};

/**
 * Returns the set of files changed compared to a base ref, as absolute (posix) paths.
 *
 * Includes commits on the current branch since its merge-base with the base ref, plus uncommitted
 * (staged + unstaged) modifications and untracked files. Deleted files are excluded.
 *
 * Returns `undefined` when changes can't be determined (e.g. not a git repository).
 */
export const getChangedFiles = (cwd: string, base?: string): Set<string> | undefined => {
  let root: string;
  try {
    root = toPosix(git(['rev-parse', '--show-toplevel'], cwd));
  } catch {
    return undefined;
  }

  const files = new Set<string>();
  const addLines = (output: string) => {
    for (const line of output.split('\n')) {
      const file = line.trim();
      if (file) files.add(isAbsolute(file) ? toPosix(file) : join(root, file));
    }
  };

  const baseRef = resolveBaseRef(cwd, base);
  let fromRef = baseRef ?? 'HEAD';
  if (baseRef) {
    try {
      fromRef = git(['merge-base', baseRef, 'HEAD'], cwd) || baseRef;
    } catch {
      fromRef = baseRef;
    }
  }

  try {
    addLines(git(['diff', '--name-only', '--diff-filter=ACMR', fromRef], cwd));
  } catch {
    // ignore; untracked files may still be added below
  }
  try {
    addLines(git(['ls-files', '--others', '--exclude-standard'], cwd));
  } catch {
    // ignore
  }

  return files;
};
