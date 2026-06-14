import assert from 'node:assert/strict';
import test from 'node:test';
import { main } from '../../src/index.ts';
import baseCounters from '../helpers/baseCounters.ts';
import { createOptions } from '../helpers/create-options.ts';
import { resolve } from '../helpers/resolve.ts';

const cwd = resolve('fixtures/language/knip-ignore-next');

test('Suppress unused export reporting with // knip-ignore-next', async () => {
  const options = await createOptions({ cwd });
  const { issues, counters } = await main(options);

  // Preceded by `// knip-ignore-next` — must NOT be reported, for every export kind.
  assert(!issues.exports['module.ts']?.['ignoredConst']);
  assert(!issues.exports['module.ts']?.['ignoredFn']);
  assert(!issues.exports['module.ts']?.['IgnoredClass']);
  assert(!issues.exports['module.ts']?.['ignoredNamed']);
  assert(!issues.exports['module.ts']?.['ignoredReExport']);
  assert(!issues.exports['module.ts']?.['default']);
  assert(!issues.types['module.ts']?.['IgnoredType']);
  assert(!issues.types['module.ts']?.['IgnoredInterface']);

  // No directive — must still be reported.
  assert(issues.exports['module.ts']['unusedConst']);
  assert(issues.exports['module.ts']['unusedFn']);
  assert(issues.exports['module.ts']['UnusedClass']);
  assert(issues.exports['module.ts']['unusedNamed']);
  assert(issues.exports['module.ts']['unusedReExport']);
  assert(issues.types['module.ts']['UnusedType']);
  assert(issues.types['module.ts']['UnusedInterface']);

  assert.deepEqual(counters, {
    ...baseCounters,
    exports: 5,
    types: 2,
    processed: 3,
    total: 3,
  });
});
