import type { Comment } from 'oxc-parser';
import { KNIP_IGNORE_DIRECTIVE, KNIP_IGNORE_TAG } from '../../constants.ts';

export const EMPTY_TAGS: Set<string> = new Set();

/**
 * Position of the first character that belongs to the declaration a leading comment applies to:
 * the next non-whitespace token at or after `from`, skipping blank lines and intervening `//`
 * line comments. Shared by JSDoc block tags and the `// knip-ignore-next` directive so both attach
 * to the same node (the `export` keyword's start) regardless of blank lines or stacked comments.
 */
function reachFrom(sourceText: string, from: number): number {
  let reach = from;
  for (;;) {
    while (reach < sourceText.length) {
      const ch = sourceText.charCodeAt(reach);
      if (ch === 32 || ch === 9 || ch === 10 || ch === 13) {
        reach++;
        continue;
      }
      break;
    }
    if (reach + 1 < sourceText.length && sourceText.charCodeAt(reach) === 47 && sourceText.charCodeAt(reach + 1) === 47) {
      const eol = sourceText.indexOf('\n', reach + 2);
      reach = eol === -1 ? sourceText.length : eol + 1;
      continue;
    }
    break;
  }
  return reach;
}

export function buildJSDocTagLookup(comments: Comment[], sourceText: string) {
  // Keyed by reach so a block comment's JSDoc tags and a `// knip-ignore-next` directive that land
  // on the same declaration are merged into a single tag set (e.g. `/** @public */` above the directive).
  const tagsByReach = new Map<number, Set<string>>();

  const addTags = (reach: number, tags: Set<string>) => {
    const existing = tagsByReach.get(reach);
    if (existing) for (const tag of tags) existing.add(tag);
    else tagsByReach.set(reach, tags);
  };

  for (const comment of comments) {
    if (comment.type === 'Line') {
      const directive = comment.value.trim();
      if (directive === KNIP_IGNORE_DIRECTIVE || directive.startsWith(`${KNIP_IGNORE_DIRECTIVE} `)) {
        addTags(reachFrom(sourceText, comment.end), new Set([KNIP_IGNORE_TAG]));
      }
      continue;
    }

    const value = comment.value;
    let index = value.indexOf('@');
    if (index === -1) continue;

    let tags: Set<string> | undefined;
    while (index !== -1) {
      let end = index + 1;
      while (
        end < value.length &&
        (((value.charCodeAt(end) | 32) >= 97 && (value.charCodeAt(end) | 32) <= 122) ||
          (value.charCodeAt(end) >= 48 && value.charCodeAt(end) <= 57) ||
          value.charCodeAt(end) === 95)
      )
        end++;
      if (end > index + 1) {
        if (!tags) tags = new Set();
        tags.add(value.slice(index, end));
      }
      index = value.indexOf('@', end);
    }
    if (!tags) continue;

    addTags(reachFrom(sourceText, comment.end), tags);
  }

  if (tagsByReach.size === 0) return () => EMPTY_TAGS;

  const entries = Array.from(tagsByReach, ([reach, tags]) => ({ reach, tags })).sort((a, b) => a.reach - b.reach);

  return function getJSDocTags(nodeStart: number): Set<string> {
    let lo = 0;
    let hi = entries.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const r = entries[mid].reach;
      if (r === nodeStart) return entries[mid].tags;
      if (r < nodeStart) lo = mid + 1;
      else hi = mid - 1;
    }
    return EMPTY_TAGS;
  };
}
