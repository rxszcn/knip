import assert from 'node:assert/strict';
import test from 'node:test';
import { exec } from '../helpers/exec.ts';
import { resolve } from '../helpers/resolve.ts';

test('Support extends with a single string preset', async () => {
  const cwd = resolve('fixtures/extends-basic');
  const result = exec('knip', { cwd });
  assert.equal(result.stdout, '');
});

test('Support extends with deep merge of rules and concat of ignore arrays', async () => {
  const cwd = resolve('fixtures/extends-deep-merge');
  const result = exec('knip', { cwd });
  // Both generated.js and vendor.js should be ignored (concat of ignore arrays)
  // rules.exports from base should still be "off" (deep merge of rules)
  assert.equal(result.stdout, '');
});

test('Support extends chain (recursive resolution)', async () => {
  const cwd = resolve('fixtures/extends-chain');
  const result = exec('knip', { cwd });
  // All three levels (level0, level1, level2) should be ignored
  assert.equal(result.stdout, '');
});

test('Support extends with multiple presets (array)', async () => {
  const cwd = resolve('fixtures/extends-multi');
  const result = exec('knip', { cwd });
  // a-ignored.js, b-ignored.js, and main-ignored.js should all be ignored
  assert.equal(result.stdout, '');
});

test('Detect circular extends references', async () => {
  const cwd = resolve('fixtures/extends-circular');
  const result = exec('knip', { cwd });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Circular extends/);
});

test('Support extends with npm package preset', async () => {
  const cwd = resolve('fixtures/extends-npm');
  const result = exec('knip', { cwd });
  assert.equal(result.stdout, '');
});
