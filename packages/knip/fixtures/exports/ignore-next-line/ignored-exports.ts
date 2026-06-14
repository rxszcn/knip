// knip-ignore-next
export const ignoredConst = 1;

// knip-ignore-next
export function ignoredFunction() {
  return 'ignored';
}

// knip-ignore-next
export class IgnoredClass {
  value = 42;
}

// knip-ignore-next
export type IgnoredType = string;

// knip-ignore-next
export interface IgnoredInterface {
  key: string;
}

// knip-ignore-next
export enum IgnoredEnum {
  A,
  B,
}

const localVar = 'local';
// knip-ignore-next
export { localVar };

// knip-ignore-next
export default function ignoredDefaultFunction() {
  return 'default-ignored';
}

// This one is actually used, no ignore needed
export const usedExport = 'used';

// knip-ignore-next
export { reExportedValue } from './source-module.js';

// knip-ignore-next
export { ReExportedType } from './source-module.js';
