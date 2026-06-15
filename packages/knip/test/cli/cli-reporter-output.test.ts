import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { exec } from '../helpers/exec.ts';
import { resolve } from '../helpers/resolve.ts';

const cwd = resolve('fixtures/exports/basic');

test('knip --output writes reporter output to a (new) file instead of stdout', () => {
  const dir = `${cwd}/.tmp-output`;
  const outputFile = `${dir}/knip-report.json`;
  rmSync(dir, { recursive: true, force: true });

  try {
    const { stdout } = exec('knip --reporter json --output ./.tmp-output/knip-report.json', { cwd });

    assert.equal(stdout, '');
    assert.ok(existsSync(outputFile), 'expected the output file (and its parent directory) to be created');

    const report = JSON.parse(readFileSync(outputFile, 'utf8'));
    assert.ok(Array.isArray(report.issues));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('knip --output overwrites an existing file', () => {
  const outputFile = `${cwd}/knip-overwrite.json`;
  writeFileSync(outputFile, 'STALE CONTENT');

  try {
    exec('knip --reporter json --output ./knip-overwrite.json', { cwd });

    const contents = readFileSync(outputFile, 'utf8');
    assert.doesNotMatch(contents, /STALE CONTENT/);
    assert.ok(Array.isArray(JSON.parse(contents).issues));
  } finally {
    rmSync(outputFile, { force: true });
  }
});

test('knip --output works with non-json reporters', () => {
  const outputFile = `${cwd}/knip-report.md`;
  rmSync(outputFile, { force: true });

  try {
    const { stdout } = exec('knip --reporter markdown --output ./knip-report.md', { cwd });

    assert.equal(stdout, '');
    assert.ok(existsSync(outputFile));
    assert.ok(readFileSync(outputFile, 'utf8').length > 0);
  } finally {
    rmSync(outputFile, { force: true });
  }
});
