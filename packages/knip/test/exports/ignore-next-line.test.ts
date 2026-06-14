import assert from 'node:assert/strict';
import test from 'node:test';
import { main } from '../../src/index.ts';
import baseCounters from '../helpers/baseCounters.ts';
import { createOptions } from '../helpers/create-options.ts';
import { resolve } from '../helpers/resolve.ts';

const cwd = resolve('fixtures/exports/ignore-next-line');

test('// knip-ignore-next suppresses unused export warnings for all export types', async () => {
  const options = await createOptions({ cwd });
  const { issues, counters } = await main(options);

  // ignored-exports.ts: all `// knip-ignore-next`-annotated exports must NOT appear in issues
  assert.equal(issues.exports['ignored-exports.ts'], undefined, 'no exports issues from ignored-exports.ts');
  assert.equal(issues.types['ignored-exports.ts'], undefined, 'no types issues from ignored-exports.ts');

  // non-ignored-exports.ts: un-annotated exports SHOULD still be flagged
  const nonIgnoredExportIssues = issues.exports['non-ignored-exports.ts'];
  assert.ok(nonIgnoredExportIssues, 'should have export issues from non-ignored-exports.ts');
  assert.ok(nonIgnoredExportIssues['flaggedConst'], 'flaggedConst should be flagged');
  assert.ok(nonIgnoredExportIssues['flaggedFunction'], 'flaggedFunction should be flagged');
  assert.ok(nonIgnoredExportIssues['FlaggedClass'], 'FlaggedClass should be flagged');

  const nonIgnoredTypeIssues = issues.types['non-ignored-exports.ts'];
  assert.ok(nonIgnoredTypeIssues, 'should have type issues from non-ignored-exports.ts');
  assert.ok(nonIgnoredTypeIssues['FlaggedType'], 'FlaggedType should be flagged');
  assert.ok(nonIgnoredTypeIssues['FlaggedInterface'], 'FlaggedInterface should be flagged');

  // used exports should not be flagged
  assert.equal(issues.exports['non-ignored-exports.ts']['usedNonIgnored'], undefined);
  assert.equal(issues.exports['ignored-exports.ts']?.['usedExport'], undefined);

  assert.deepEqual(counters, {
    ...baseCounters,
    exports: 3, // flaggedConst, flaggedFunction, FlaggedClass
    types: 2, // FlaggedType, FlaggedInterface
    processed: 4,
    total: 4,
  });
});
