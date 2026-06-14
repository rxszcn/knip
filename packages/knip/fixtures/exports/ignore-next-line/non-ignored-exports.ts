export const flaggedConst = 1;

export function flaggedFunction() {
  return 'flagged';
}

export class FlaggedClass {
  value = 42;
}

export type FlaggedType = string;

export interface FlaggedInterface {
  key: string;
}

// This one is used, should not be flagged
export const usedNonIgnored = 'used';
