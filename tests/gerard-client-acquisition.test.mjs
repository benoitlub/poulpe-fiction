import test from 'node:test';
import assert from 'node:assert/strict';
import { getAcquisitionConfig, assessAcquisitionCandidate, formatAcquisitionReview, handoffAcquisitionReviews } from '../scripts/gerard-client-acquisition.mjs';
import { searchBusinessSources } from '../scripts/gerard-b2b-bridge.mjs';

const instance = id => ({ parcelId: `parcel-${id}`, knowledgeSlug: `knowledge-${id}`, templates: [{ id: 'client-acquisition', config: { clientId: id, offer: 'Atelier IA', targetSectors: ['formation'] } }] });

test('each client config stays in its own parcel; disabled templates do not run', () => {
  assert.equal(getAcquisitionConfig(instance('a')).parcelId, 'parcel-a');
  assert.equal(getAcquisitionConfig(instance('b')).clientId, 'b');
  assert.equal(getAcquisitionConfig({ ...instance('a'), templates: [{ id: 'client-acquisition', enabled: false }] }), null);
});

test('a relevant page is not automatically a hot lead or contacted client', () => {
  const config = getAcquisitionConfig(instance('a'));
  const lead = assessAcquisitionCandidate({ title: 'Centre de formation', url: 'https://example.org', verification: 'page-read', evidence: 'Formation continue' }, config);
  assert.equal(lead.leadStage, 'investigate-contact');
  assert.equal(lead.hotLead, false);
  assert.equal(lead.contacted, false);
  assert.equal(lead.acquisitionScore, 25);
  assert.match(formatAcquisitionReview([lead], config), /aucune prise de contact/);
});

test('a search result and off-sector page remain research only', () => {
  const config = getAcquisitionConfig(instance('b'));
  assert.equal(assessAcquisitionCandidate({ verification: 'search-result-only', title: 'Formation' }, config).leadStage, 'research-only');
  assert.equal(assessAcquisitionCandidate({ verification: 'page-read', title: 'Actualités sportives' }, config).acquisitionScore, 0);
});

test('the existing Publisher search route receives client-specific sector and isolation context', async () => {
  const seed = instance('client-b');
  const response = await searchBusinessSources({ publisherUrl: 'https://publisher.example', operationId: 'test', seed,
    call: async (_url, options) => {
      const mission = JSON.parse(options.body).mission;
      assert.match(mission.prompt, /formation/);
      assert.equal(mission.context.id, 'parcel-client-b');
      assert.equal(mission.context.metadata.clientId, 'client-b');
      return { status: 'ok', payload: { status: 'completed', output: { capability: 'business.sources.search', executed: true, status: 'no-sources', candidates: [] } } };
    } });
  assert.equal(response.status, 'no-sources');
});

test('Notion handoff is disabled without its secret and sends only evidenced review candidates', async () => {
  const config = getAcquisitionConfig(instance('client-b'));
  const valid = assessAcquisitionCandidate({ title: 'Centre de formation', url: 'https://example.org', verification: 'page-read', evidence: 'Formation continue' }, config);
  const invalid = assessAcquisitionCandidate({ title: 'Article formation', url: 'https://news.example.org', verification: 'search-result-only' }, config);
  assert.equal((await handoffAcquisitionReviews([valid], config, { publisherUrl: 'https://publisher.example' })).status, 'disabled');
  let calls = 0;
  const result = await handoffAcquisitionReviews([valid, invalid], config, { publisherUrl: 'https://publisher.example', token: 'test',
    fetcher: async (_, init) => {
      calls++;
      const body = JSON.parse(init.body);
      assert.equal(body.clientId, 'client-b');
      assert.equal(body.sourceUrl, valid.url);
      return { ok: true, json: async () => ({ status: 'created-for-review' }) };
    } });
  assert.equal(calls, 1);
  assert.equal(result.created, 1);
});
