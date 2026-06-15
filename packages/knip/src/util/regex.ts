import picomatch from 'picomatch';

const isRegexLikeMatch = /[*+\\(|{^$]/;
const isRegexLike = (value: string) => isRegexLikeMatch.test(value);

/**
 * Regex-only metacharacters that do NOT appear in standard glob patterns.
 * Glob patterns use `*`, `?`, `[`, `]` — these are shared with regex but with
 * different semantics. If any of the characters below is present, the pattern
 * is treated as a regular expression rather than a glob.
 */
const REGEX_ONLY_CHARS = /[+\\()|^$]/;

const isGlobPattern = (value: string): boolean => {
  if (REGEX_ONLY_CHARS.test(value)) return false;
  return /[*?]/.test(value) || /\[.*\]/.test(value);
};

export const toRegexOrString = (value: string | RegExp) =>
  typeof value === 'string' && isRegexLike(value) ? new RegExp(value) : value;

/**
 * Like `toRegexOrString`, but distinguishes glob patterns from regex patterns.
 *
 * - Glob patterns (containing `*`, `?`, `[...]` without regex-only chars) are
 *   converted to a `RegExp` via picomatch so that `findMatch` uses `.test()`.
 * - Strings containing regex-specific metacharacters (`+`, `\`, `(`, `)`, `|`,
 *   `^`, `$`) are converted to `RegExp` directly (existing behaviour).
 * - Plain strings without any special characters are kept as-is for exact
 *   string comparison in `findMatch`.
 */
export const toGlobRegexOrString = (value: string | RegExp): string | RegExp => {
  if (value instanceof RegExp) return value;
  if (isGlobPattern(value)) return picomatch.makeRe(value);
  return toRegexOrString(value);
};

export const findMatch = (haystack: (string | RegExp)[], needle: string) =>
  haystack.find(n => (typeof n === 'string' ? n === needle : n.test(needle)));
