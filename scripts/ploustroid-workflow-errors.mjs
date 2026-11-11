#!/usr/bin/env node
// GitHub workflow_run event -> private incident register. No email or publishing.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ingestIncident, resolveIncident, incidentDigest } from './ploustroid-incident-digest.mjs';
export function reconcileWorkflowRun(state, event) {
  const run = event?.workflow_run;
  if (!run || run.status !== 'completed' || run.head_branch !== 'main' ||
      !['schedule', 'workflow_dispatch', 'push'].includes(run.event) ||
      typeof run.id !== 'number' || typeof run.name !== 'string') {
    return { state, status: 'ignored' };
  }
  const fingerprint = 'github-actions:' + run.name;
  if (run.conclusion === 'success') {
    return { state: resolveIncident(state, fingerprint), status: 'resolved' };
  }
  if (!['failure', 'timed_out', 'startup_failure'].includes(run.conclusion))
    return { state, status: 'ignored' };
  const next = ingestIncident(state, {
    id: 'github-run:' + run.id + ':attempt:' + (run.run_attempt ?? 1),
    fingerprint, at: run.updated_at ?? run.created_at ?? new Date().toISOString(),
    severity: 'recoverable',
    detail: { conclusion: run.conclusion, workflow: run.name, runId: run.id },
  });
  return { state: next, status: 'recorded' };
}
async function main() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const path = new URL('../garden/ploustroid-incidents.json', import.meta.url);
  let state;
  try { state = JSON.parse(await readFile(path, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw e; state = { incidents: [] }; }
  const result = reconcileWorkflowRun(state, event);
  if (result.status !== 'ignored') await writeFile(path, JSON.stringify(result.state, null, 2) + '\n');
  const digest = incidentDigest(result.state);
  console.log(JSON.stringify({ event: 'ploustroid.workflow-incident', status: result.status,
    recoverable: digest.recoverable.length, repeated: digest.repeated.length,
    actionRequired: digest.actionRequired.length }));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e); process.exitCode = 1; });
