import assert from 'node:assert/strict';
import test from 'node:test';
import { main } from '../../src/index.ts';
import baseCounters from '../helpers/baseCounters.ts';
import { createOptions } from '../helpers/create-options.ts';
import { resolve } from '../helpers/resolve.ts';

const cwd = resolve('fixtures/exports/ignore-next-line-edge');

test('// knip-ignore-next edge cases', async () => {
  const options = await createOptions({ cwd });
  const { issues, counters } = await main(options);

  const exportIssues = issues.exports['edge-cases.ts'];

  // Block comment variant: should be suppressed
  assert.equal(exportIssues?.['ignoredByBlockComment'], undefined, 'block comment should suppress export');

  // With reason suffix: should be suppressed
  assert.equal(exportIssues?.['ignoredWithReason'], undefined, 'comment with reason should suppress export');

  // Blank line between comment and export: should NOT be suppressed
  assert.ok(exportIssues?.['NOTIgnoredBlankLine'], 'blank line between comment and export should NOT suppress');

  // Used export: should not be flagged
  assert.equal(exportIssues?.['used'], undefined, 'used export should not be flagged');

  assert.deepEqual(counters, {
    ...baseCounters,
    exports: 1, // NOTIgnoredBlankLine
    processed: 2,
    total: 2,
  });
});
