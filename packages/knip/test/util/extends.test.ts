import assert from 'node:assert/strict';
import test from 'node:test';
import type { RawConfiguration } from '../../src/types/config.ts';
import type { ParsedCLIArgs } from '../../src/util/cli-arguments.ts';
import { ConfigurationError } from '../../src/util/errors.ts';
import { loadResolvedConfigFile } from '../../src/util/load-config.ts';
import { resolve } from '../helpers/resolve.ts';

const options = {} as ParsedCLIArgs;

test('Should load a config without extends unchanged', async () => {
  const config = (await loadResolvedConfigFile(resolve('fixtures/extends/base.json'), options)) as RawConfiguration;
  assert.deepEqual(config.entry, ['base-entry.ts']);
  assert.deepEqual(config.rules, { files: 'warn', dependencies: 'error' });
  assert.equal('extends' in config, false);
});

test('Should resolve and deep-merge a recursive extends chain with multiple presets', async () => {
  const config = (await loadResolvedConfigFile(resolve('fixtures/extends/knip.json'), options)) as RawConfiguration;

  // arrays are concatenated in resolution order (presets first, current config last)
  assert.deepEqual(config.entry, ['base-entry.ts', 'middle-entry.ts', 'a-entry.ts', 'b-entry.ts', 'root-entry.ts']);
  assert.deepEqual(config.ignore, ['base-ignore.ts', 'middle-ignore.ts', 'a-ignore.ts', 'root-ignore.ts']);
  assert.deepEqual(config.project, ['base/**', 'root/**']);

  // rules object is deep-merged, later/current values override
  assert.deepEqual(config.rules, { files: 'off', dependencies: 'off', exports: 'off' });

  // inherited-only fields are preserved
  assert.deepEqual(config.tags, ['+preset-b']);
  assert.deepEqual(config.ignoreDependencies, ['base-dep']);
  assert.equal(config.includeEntryExports, true);

  // the extends key itself is consumed and not leaked into the resolved config
  assert.equal('extends' in config, false);
});

test('Should resolve extends from an npm package preset in node_modules', async () => {
  const config = (await loadResolvedConfigFile(resolve('fixtures/extends-npm/knip.json'), options)) as RawConfiguration;

  assert.deepEqual(config.entry, ['preset-entry.ts', 'local-entry.ts']);
  assert.deepEqual(config.ignore, ['preset-ignore.ts']);
  assert.deepEqual(config.rules, { files: 'error', exports: 'off' });
  assert.equal('extends' in config, false);
});

test('Should throw on circular extends references', async () => {
  await assert.rejects(
    () => loadResolvedConfigFile(resolve('fixtures/extends-cycle/a.json'), options),
    error => error instanceof ConfigurationError && /Circular/.test(error.message)
  );
});
