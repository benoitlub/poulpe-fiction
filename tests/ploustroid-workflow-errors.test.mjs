import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileWorkflowRun } from '../scripts/ploustroid-workflow-errors.mjs';
const event = (id, conclusion, branch = 'main') => ({ workflow_run: {
  id, run_attempt: 1, name: 'Gérard · Production', status: 'completed', conclusion,
  head_branch: branch, event: 'schedule', updated_at: '2026-11-11T12:00:00Z' } });
test('collects real failures and groups repeated runs', () => {
  const a = reconcileWorkflowRun({ incidents: [] }, event(1, 'failure'));
  const b = reconcileWorkflowRun(a.state, event(2, 'timed_out'));
  assert.equal(b.state.incidents.length, 1);
  assert.equal(b.state.incidents[0].count, 2);
  assert.equal(b.state.incidents[0].severity, 'repeated');
  assert.deepEqual(reconcileWorkflowRun(b.state, event(2, 'timed_out')).state, b.state);
});
test('success resolves and other branches are ignored', () => {
  const a = reconcileWorkflowRun({ incidents: [] }, event(1, 'failure'));
  assert.equal(reconcileWorkflowRun(a.state, event(3, 'success')).state.incidents[0].status, 'resolved');
  assert.equal(reconcileWorkflowRun(a.state, event(4, 'failure', 'feature')).status, 'ignored');
});
test('nonfinal or unsupported events are ignored', () => {
  const state = { incidents: [] };
  assert.equal(reconcileWorkflowRun(state, { workflow_run: { ...event(1, 'failure').workflow_run, status: 'in_progress' } }).status, 'ignored');
  assert.equal(reconcileWorkflowRun(state, { workflow_run: { ...event(1, 'failure').workflow_run, event: 'pull_request' } }).status, 'ignored');
});
