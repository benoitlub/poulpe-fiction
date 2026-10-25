import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBusinessSourceResponse, searchBusinessSources } from '../scripts/gerard-b2b-bridge.mjs';

const response = {
  status: 'ok', payload: { status: 'completed', output: {
    capability: 'business.sources.search', status: 'sources-found', executed: true, candidates: [
      { title: 'Distributeur', url: 'https://example.org/contact', snippet: 'Page publique' },
      { title: 'Doublon', url: 'https://example.org/contact' },
      { title: 'URL dangereuse', url: 'file:///etc/passwd' },
      { title: 'Identifiants', url: 'https://user:pass@example.org/' },
    ],
  } },
};

test('retrieves real candidates from the deployed Publisher Worker with the expected adapter contract', async () => {
  let called = false;
  const result = await searchBusinessSources({ publisherUrl: 'https://publisher.example', operationId: 'op',
    seed: { seedId: 'benoit-client-acquisition', parcelId: 'growth', objective: 'Partenaires B2B' },
    call: async (url, options) => {
      called = true;
      assert.equal(url, 'https://publisher.example/api/octopus-adapter/execute');
      const input = JSON.parse(options.body);
      assert.equal(input.mission.requiredCapabilities[0], 'business.sources.search');
      assert.deepEqual(input.mission.authorizedResources, ['tools.read']);
      assert.equal(input.mission.context.metadata.toolRequest.dryRun, false);
      return response;
    },
  });
  assert.equal(called, true);
  assert.equal(result.status, 'sources-found');
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].verification, 'search-result-only');
});

test('missing, failing, or mismatched adapter results never become prospects', () => {
  assert.equal(parseBusinessSourceResponse({ status: 'failed' }).status, 'unavailable');
  assert.equal(parseBusinessSourceResponse({ status: 'ok', payload: { status: 'completed', output: { capability: 'copy.generate', candidates: response.payload.output.candidates } } }).candidates.length, 0);
  assert.equal(parseBusinessSourceResponse({ status: 'ok', payload: { status: 'completed', output: { capability: 'business.sources.search', status: 'no-sources', executed: true, candidates: [] } } }).status, 'no-sources');
  assert.equal(parseBusinessSourceResponse({ status: 'ok', payload: { status: 'completed', output: { capability: 'business.sources.search', status: 'ready-to-read', executed: false, candidates: response.payload.output.candidates } } }).candidates.length, 0);
  assert.equal(parseBusinessSourceResponse({ status: 'ok', payload: { status: 'completed', output: { capability: 'business.sources.search', status: 'sources-found', executed: false, candidates: response.payload.output.candidates } } }).candidates.length, 0);
  assert.deepEqual(parseBusinessSourceResponse({ status: 'ok', payload: { status: 'needs-input', output: { capability: 'business.sources.search', status: 'blocked', reason: 'COMPOSIO_RATE_LIMITED', retryAfterSeconds: 90 } } }), {
    status: 'blocked', candidates: [], executed: false, reason: 'COMPOSIO_RATE_LIMITED', retryAfterSeconds: 90,
  });
});
