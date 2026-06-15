import assert from 'node:assert/strict';
import test from 'node:test';
import { main } from '../../src/index.ts';
import baseCounters from '../helpers/baseCounters.ts';
import { createOptions } from '../helpers/create-options.ts';
import { resolve } from '../helpers/resolve.ts';

const cwd = resolve('fixtures/ignore/members-glob');

test('Respect ignored members matched by glob patterns', async () => {
  const options = await createOptions({ cwd });
  const { issues, counters } = await main(options);

  // `Right` is not matched by any pattern; `T_*` is a glob (not a regex), so `TX` (no underscore)
  // is still reported, proving glob semantics rather than regex semantics.
  assert(issues.enumMembers['enums.ts']['Direction.Right']);
  assert(issues.enumMembers['enums.ts']['Token.TX']);

  assert.deepEqual(counters, {
    ...baseCounters,
    enumMembers: 2,
    processed: 3,
    total: 3,
  });
});
