export const used = 1;

// knip-ignore-next
export const ignoredConst = 1;

export const unusedConst = 1;

// knip-ignore-next
export function ignoredFn() {}

export function unusedFn() {}

// knip-ignore-next
export class IgnoredClass {}

export class UnusedClass {}

// knip-ignore-next
export type IgnoredType = string;

export type UnusedType = string;

// knip-ignore-next
export interface IgnoredInterface {
  a: number;
}

export interface UnusedInterface {
  a: number;
}

const a = 1;
const b = 2;

// knip-ignore-next
export { a as ignoredNamed };

export { b as unusedNamed };

// knip-ignore-next
export { foo as ignoredReExport } from './other';

export { bar as unusedReExport } from './other';

// knip-ignore-next
export default function ignoredDefault() {}
