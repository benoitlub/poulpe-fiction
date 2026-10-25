import test from 'node:test';
import assert from 'node:assert/strict';
import { assessBusinessPage, qualifyBusinessSources, isSafePublicUrl, formatQualifiedSources } from '../scripts/gerard-b2b-qualification.mjs';

const publicDns = async () => [{ address: '8.8.8.8' }];
const sample = { title: 'Distributeur', url: 'https://example.org/professionnels', snippet: '' };

test('only safe public HTTPS hosts are eligible for a page visit', async () => {
  assert.equal(await isSafePublicUrl(sample.url, publicDns), true);
  assert.equal(await isSafePublicUrl('http://example.org', publicDns), false);
  assert.equal(await isSafePublicUrl('https://127.0.0.1/', publicDns), false);
  assert.equal(await isSafePublicUrl('https://example.org:444/', publicDns), false);
  assert.equal(await isSafePublicUrl('https://example.org/', async () => [{ address: '192.168.1.2' }]), false);
  assert.equal(await isSafePublicUrl('https://example.org/', async () => [{ address: '8.8.8.8' }, { address: '10.0.0.3' }]), false);
});

test('verified business signals yield review priority, not a claimed lead or outreach', () => {
  const result = assessBusinessPage(sample, '<html><body>Grossiste jeux de société, catalogue B2B pour revendeurs.</body></html>');
  assert.equal(result.fitScore, 90);
  assert.equal(result.qualification, 'priority-review');
  assert.equal(result.contacted, false);
  assert.match(formatQualifiedSources([result]), /Aucun contact ni vente/);
});

test('unreadable sites remain unverified rather than receiving invented evidence', async () => {
  const results = await qualifyBusinessSources([sample], { resolve: publicDns,
    fetchPage: async () => { throw new Error('offline'); } });
  assert.equal(results[0].verification, 'unverified');
  assert.equal(results[0].fitScore, null);
  assert.equal(results[0].qualification, 'investigate');
});

test('read-only fetch refuses redirects, accepts html and orders strongest evidence first', async () => {
  const results = await qualifyBusinessSources([sample, { title: 'Autre', url: 'https://second.example.org/' }], {
    resolve: publicDns,
    fetchPage: async (url, options) => {
      assert.equal(options.redirect, 'manual');
      return { ok: true, headers: { get: key => key === 'content-type' ? 'text/html' : null },
        text: async () => url.includes('second') ? '<p>Grossiste jeux de cartes B2B</p>' : '<p>Page générale</p>' };
    },
  });
  assert.equal(results[0].title, 'Autre');
  assert.equal(results[1].fitScore, 0);
});
