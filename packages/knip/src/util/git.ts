import { execSync } from 'node:child_process';
import { join } from './path.ts';
import { ConfigurationError } from './errors.ts';

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

const resolveBaseRef = (cwd: string, baseRef?: string): string => {
  if (baseRef) return baseRef;
  const candidates = ['main', 'master'];
  for (const ref of candidates) {
    try {
      execSync(`git rev-parse --verify ${ref}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], cwd });
      return ref;
    } catch (_error) {
      // try next candidate
    }
  }
  throw new ConfigurationError(
    'Unable to determine base ref for --changed. Neither "main" nor "master" branch found. Provide a base ref explicitly: --changed <base-ref>'
  );
};

export const getGitChangedFiles = (cwd: string, baseRef?: string): Set<string> => {
  const ref = resolveBaseRef(cwd, baseRef);

  const changedFiles = new Set<string>();

  // Get tracked files changed between base ref and HEAD (including staged and unstaged)
  try {
    const diffOutput = execSync(`git diff --name-only ${ref}...HEAD`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      cwd,
    });
    for (const line of diffOutput.split('\n')) {
      if (line.trim()) changedFiles.add(join(cwd, line.trim()));
    }
  } catch (_error) {
    throw new ConfigurationError(`Failed to get git diff against "${ref}". Is the base ref valid?`);
  }

  // Also include staged but uncommitted changes (not yet in HEAD)
  try {
    const stagedOutput = execSync('git diff --name-only --cached', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      cwd,
    });
    for (const line of stagedOutput.split('\n')) {
      if (line.trim()) changedFiles.add(join(cwd, line.trim()));
    }
  } catch (_error) {
    // non-critical, ignore
  }

  // Include untracked files (new files not yet in git)
  try {
    const untrackedOutput = execSync('git ls-files --others --exclude-standard', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      cwd,
    });
    for (const line of untrackedOutput.split('\n')) {
      if (line.trim()) changedFiles.add(join(cwd, line.trim()));
    }
  } catch (_error) {
    // non-critical, ignore
  }

  return changedFiles;
};
