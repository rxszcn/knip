import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { join } from '../../src/util/path.ts';
import { copyFixture } from '../helpers/copy-fixture.ts';
import { exec } from '../helpers/exec.ts';

test('knip init generates a config based on detected plugins', async () => {
  const cwd = await copyFixture('fixtures/init');
  const { status } = exec('knip init', { cwd });
  assert.equal(status, 0);

  const config = JSON.parse(await readFile(join(cwd, 'knip.json'), 'utf8'));
  assert.match(config.$schema, /knip@\d+\/schema\.json$/);
  assert.ok(Array.isArray(config.entry) && config.entry.length > 0);
  assert.ok(Array.isArray(config.project) && config.project.length > 0);
  assert.equal(config.prettier, true);
  assert.equal(config.vitest, true);
});

test('knip init --force overwrites an existing config without prompting', async () => {
  const cwd = await copyFixture('fixtures/init-existing');
  const { status } = exec('knip init --force', { cwd });
  assert.equal(status, 0);

  const config = JSON.parse(await readFile(join(cwd, 'knip.json'), 'utf8'));
  assert.equal(config.prettier, true);
  assert.ok(!config.entry.includes('old-entry.ts'));
});
