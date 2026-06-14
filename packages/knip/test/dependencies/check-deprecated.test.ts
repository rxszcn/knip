import assert from 'node:assert/strict';
import { type Server, createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { main } from '../../src/index.ts';
import baseCounters from '../helpers/baseCounters.ts';
import { createOptions } from '../helpers/create-options.ts';
import { resolve } from '../helpers/resolve.ts';

const cwd = resolve('fixtures/check-deprecated');

const packuments: Record<string, unknown> = {
  'deprecated-pkg': {
    'dist-tags': { latest: '1.0.0' },
    versions: { '1.0.0': { deprecated: 'No longer maintained, use fine-pkg instead' } },
  },
  'fine-pkg': {
    'dist-tags': { latest: '2.0.0' },
    versions: { '2.0.0': {} },
  },
};

let server: Server;
let previousRegistry: string | undefined;

before(async () => {
  server = createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? '').replace(/^\//, ''));
    const packument = packuments[name];
    if (packument) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(packument));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>(r => server.listen(0, () => r()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  previousRegistry = process.env.npm_config_registry;
  process.env.npm_config_registry = `http://localhost:${port}`;
});

after(async () => {
  if (previousRegistry === undefined) delete process.env.npm_config_registry;
  else process.env.npm_config_registry = previousRegistry;
  await new Promise<void>(r => server.close(() => r()));
});

test('Report deprecated dependencies (--check-deprecated)', async () => {
  const options = await createOptions({ cwd, isCheckDeprecated: true });
  const { issues, counters } = await main(options);

  assert.equal(Object.keys(issues.deprecated['package.json']).length, 1);

  const issue = issues.deprecated['package.json']['deprecated-pkg'];
  assert(issue);
  assert.equal(issue.symbol, 'deprecated-pkg');
  assert.match(issue.specifier ?? '', /No longer maintained/);

  assert(!issues.deprecated['package.json']['fine-pkg']);

  assert.deepEqual(counters, {
    ...baseCounters,
    deprecated: 1,
    processed: 1,
    total: 1,
  });
});

test('Do not query registry without --check-deprecated', async () => {
  const options = await createOptions({ cwd });
  const { issues, counters } = await main(options);

  assert.equal(Object.keys(issues.deprecated).length, 0);
  assert.equal(counters.deprecated, 0);
});

test('Skip deprecated check when excluded (--exclude deprecated)', async () => {
  const options = await createOptions({ cwd, isCheckDeprecated: true, excludedIssueTypes: ['deprecated'] });
  const { issues, counters } = await main(options);

  assert.equal(Object.keys(issues.deprecated).length, 0);
  assert.equal(counters.deprecated, 0);
});
