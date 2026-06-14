import { usedExport } from './ignored-exports.js';
import { usedNonIgnored } from './non-ignored-exports.js';
import { reExportedValue, type ReExportedType } from './source-module.js';

const x: ReExportedType = reExportedValue;
console.log(usedExport, usedNonIgnored, x);
