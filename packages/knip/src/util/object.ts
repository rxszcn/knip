/** @internal */
export const getValuesByKeyDeep = (obj: any, key: string): unknown[] => {
  const objects = [];
  if (obj && typeof obj === 'object') {
    for (const i in obj) {
      if (obj[i] && typeof obj[i] === 'object') {
        const values = getValuesByKeyDeep(obj[i], key);
        objects.push(...values);
      } else if (i === key) {
        objects.push(obj[i]);
      }
    }
  }
  return objects;
};

export const findByKeyDeep = <T>(obj: any, key: string): T[] => {
  const objects = [];
  if (obj && typeof obj === 'object') {
    if (key in obj) {
      objects.push(obj);
    }
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          objects.push(...findByKeyDeep(item, key));
        }
      } else if (typeof value === 'object') {
        objects.push(...findByKeyDeep(value, key));
      }
    }
  }
  return objects;
};

export const getKeysByValue = <T>(obj: T, value: unknown): (keyof T)[] => {
  const keys = [];
  for (const key in obj) {
    if (obj[key] === value) keys.push(key);
  }
  return keys;
};

export const get = <T>(obj: T, path: string) => path.split('.').reduce((o: any, p) => o?.[p], obj);

const ARRAY_CONCAT_FIELDS = new Set([
  'entry',
  'project',
  'ignore',
  'ignoreFiles',
  'ignoreWorkspaces',
  'ignoreBinaries',
  'ignoreDependencies',
  'ignoreMembers',
  'ignoreUnresolved',
  'include',
  'exclude',
  'tags',
]);

const SHALLOW_OBJECT_MERGE_FIELDS = new Set([
  'rules',
  'compilers',
  'syncCompilers',
  'asyncCompilers',
  'ignoreExportsUsedInFile',
]);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof RegExp);

const isPluginObject = (v: unknown): v is Record<string, unknown> =>
  isPlainObject(v) && ('config' in v || 'entry' in v || 'project' in v);

const toArray = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return [v];
  return [];
};

const concatArrays = (a: unknown, b: unknown): unknown[] => [...toArray(a), ...toArray(b)];

const mergePluginConfig = (base: unknown, override: unknown): unknown => {
  if (override === undefined) return base;
  if (base === undefined) return override;
  if (isPluginObject(base) && isPluginObject(override)) {
    const result: Record<string, unknown> = { ...base, ...override };
    for (const field of ['config', 'entry', 'project'] as const) {
      if (base[field] !== undefined && override[field] !== undefined) {
        result[field] = concatArrays(base[field], override[field]);
      }
    }
    return result;
  }
  return override;
};

export const deepMergeConfigs = <T extends Record<string, unknown>>(base: T, override: T): T => {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overrideVal = override[key];
    if (overrideVal === undefined) continue;

    if (ARRAY_CONCAT_FIELDS.has(key)) {
      result[key] = concatArrays(baseVal, overrideVal);
      continue;
    }

    if (SHALLOW_OBJECT_MERGE_FIELDS.has(key)) {
      result[key] = isPlainObject(baseVal) && isPlainObject(overrideVal)
        ? { ...baseVal, ...overrideVal }
        : overrideVal;
      continue;
    }

    if (key === 'paths' || key === 'ignoreIssues') {
      if (isPlainObject(baseVal) && isPlainObject(overrideVal)) {
        const merged: Record<string, unknown> = { ...baseVal };
        for (const [subKey, subVal] of Object.entries(overrideVal)) {
          merged[subKey] = Array.isArray(merged[subKey]) && Array.isArray(subVal)
            ? [...(merged[subKey] as unknown[]), ...subVal]
            : subVal;
        }
        result[key] = merged;
      } else {
        result[key] = overrideVal;
      }
      continue;
    }

    if (key === 'workspaces') {
      if (isPlainObject(baseVal) && isPlainObject(overrideVal)) {
        const merged: Record<string, unknown> = { ...baseVal };
        for (const [wsName, wsConfig] of Object.entries(overrideVal)) {
          merged[wsName] = isPlainObject(merged[wsName]) && isPlainObject(wsConfig)
            ? deepMergeConfigs(merged[wsName] as Record<string, unknown>, wsConfig as Record<string, unknown>)
            : wsConfig;
        }
        result[key] = merged;
      } else {
        result[key] = overrideVal;
      }
      continue;
    }

    if (isPluginObject(baseVal) && isPluginObject(overrideVal)) {
      result[key] = mergePluginConfig(baseVal, overrideVal);
      continue;
    }

    result[key] = overrideVal;
  }

  return result as T;
};
