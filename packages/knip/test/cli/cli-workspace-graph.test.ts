import assert from 'node:assert/strict';
import test from 'node:test';
import { showDiff } from '../helpers/diff.ts';
import { exec } from '../helpers/exec.ts';
import { resolve } from '../helpers/resolve.ts';

const cwd = resolve('fixtures/workspace-graph');

test('knip --workspace-graph', () => {
  const { stdout, status } = exec('knip --workspace-graph', { cwd });
  const expected = `flowchart TD
  %% --> dependencies, -.-> devDependencies
  _fixtures_workspace_graph["@fixtures/workspace-graph"]
  _graph_app["@graph/app"]
  _graph_core["@graph/core"]
  _graph_testing["@graph/testing"]
  _graph_utils["@graph/utils"]
  _graph_app --> _graph_core
  _graph_app -.-> _graph_testing
  _graph_app --> _graph_utils
  _graph_testing -.-> _graph_core
  _graph_utils --> _graph_core`;

  if (stdout !== expected) {
    showDiff(stdout, expected);
    assert.fail('Output mismatch (see diff above)');
  }
  assert.equal(status, 0);
});
