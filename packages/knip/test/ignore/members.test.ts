import assert from 'node:assert/strict';
import test from 'node:test';
import { main } from '../../src/index.ts';
import baseCounters from '../helpers/baseCounters.ts';
import { createOptions } from '../helpers/create-options.ts';
import { resolve } from '../helpers/resolve.ts';

const cwd = resolve('fixtures/ignore/members');

test('Respect ignored members: exact string, regex, and glob patterns', async () => {
  const options = await createOptions({ cwd });
  const { issues, counters } = await main(options);

  // Direction enum: Up is used; Down matched by glob 'D*'; Left/Right matched by regex /Left|Right/
  assert(!issues.enumMembers['enums.ts']?.['Direction.Down'], 'Direction.Down should be ignored by glob "D*"');
  assert(!issues.enumMembers['enums.ts']?.['Direction.Left'], 'Direction.Left should be ignored by regex /Left|Right/');
  assert(!issues.enumMembers['enums.ts']?.['Direction.Right'], 'Direction.Right should be ignored by regex /Left|Right/');

  // Status enum: ACTIVE/INACTIVE are used; DEPRECATED_OLD/REMOVED_OLD matched by glob '*_OLD'; UNKNOWN is not matched
  assert(
    issues.enumMembers['enums.ts']?.['Status.UNKNOWN'],
    'Status.UNKNOWN should NOT be ignored by any pattern'
  );
  assert(
    !issues.enumMembers['enums.ts']?.['Status.DEPRECATED_OLD'],
    'Status.DEPRECATED_OLD should be ignored by glob "*_OLD"'
  );
  assert(
    !issues.enumMembers['enums.ts']?.['Status.REMOVED_OLD'],
    'Status.REMOVED_OLD should be ignored by glob "*_OLD"'
  );

  // MyClass: 'ignored' matched by exact string
  assert(!issues.exports?.['MyClass.ts']?.['ignored'], 'MyClass.ignored should be ignored by exact string');

  assert.deepEqual(counters, {
    ...baseCounters,
    enumMembers: 1,
    processed: 4,
    total: 4,
  });
});

test('Respect ignored members: exact string, regex, and glob patterns (production)', async () => {
  const options = await createOptions({ cwd, isProduction: true });
  const { counters, configurationHints } = await main(options);

  assert.deepEqual(counters, {
    ...baseCounters,
    enumMembers: 1,
    processed: 4,
    total: 4,
  });

  assert.deepEqual(configurationHints, []);
});
