import test from 'node:test';
import assert from 'node:assert/strict';
import { communityRadarConfig, communityRadarQueries, normalizeCommunityCandidates, mergeCommunityRecords } from '../scripts/gerard-community-radar.mjs';

const template = { channels:['reddit'], discovery:{queryTemplates:['{{offer}} {{audience}} {{geography}}'],maxCandidates:20} };
const seed = {seedId:'s1',parcelId:'p1',knowledgeSlug:'k1',communityRadar:{enabled:true,audience:['joueurs'],offer:'jeu indépendant',geography:['France']}};

test('disabled parcel does not run radar', () => assert.equal(communityRadarConfig({ ...seed,communityRadar:{enabled:false} },template),null));
test('queries are parcel-specific', () => assert.deepEqual(communityRadarQueries(communityRadarConfig(seed,template)),['jeu indépendant joueurs France']));
test('deduplicates URLs without claiming verified rules or outreach', () => {
 const config=communityRadarConfig(seed,template);
 const rows=normalizeCommunityCandidates([{title:'A',url:'https://example.org/forum/'},{title:'duplicate',url:'https://example.org/forum'}],config);
 assert.equal(rows.length,1);
 assert.equal(rows[0].rulesVerified,false);
 assert.equal(rows[0].contacted,false);
 assert.equal(rows[0].score,null);
});
test('memory is isolated by parcel and preserves existing interaction status', () => {
 const old=[{parcelId:'p1',url:'https://example.org/forum',status:'review-required',contacted:false}];
 const fresh=[{parcelId:'p1',url:'https://example.org/forum',status:'discovered',sourceCheckedAt:'now'},
 {parcelId:'p2',url:'https://example.org/forum',status:'discovered'}];
 const rows=mergeCommunityRecords(old,fresh);
 assert.equal(rows.length,2);
 assert.equal(rows.find(x=>x.parcelId==='p1').status,'review-required');
});
