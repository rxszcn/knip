import picomatch from 'picomatch';

const isRegexLikeMatch = /[*+\\(|{^$]/;
const isRegexLike = (value: string) => isRegexLikeMatch.test(value);

export const toRegexOrString = (value: string | RegExp) =>
  typeof value === 'string' && isRegexLike(value) ? new RegExp(value) : value;

export const findMatch = (haystack: (string | RegExp)[], needle: string) =>
  haystack.find(n => (typeof n === 'string' ? n === needle : n.test(needle)));

/**
 * Convert an `ignoreMembers` entry into a matcher consumed by `findMatch`. A string is interpreted
 * as a glob pattern (e.g. `T_*` matches members prefixed with `T_`); a plain identifier without
 * glob characters still matches exactly. A `RegExp` is returned as-is for regular expression
 * matching. Falls back to the raw string if the glob cannot be compiled.
 */
export const toMemberMatcher = (value: string | RegExp): string | RegExp => {
  if (typeof value !== 'string') return value;
  return picomatch.makeRe(value) || value;
};
