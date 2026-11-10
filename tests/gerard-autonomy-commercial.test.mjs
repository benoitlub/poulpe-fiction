import test from 'node:test';
import assert from 'node:assert/strict';
import {acquisitionDossiers,acquisitionNextAction,integrateAcquisitionFeedback} from '../scripts/gerard-client-acquisition.mjs';
import {pendingMailDrafts,mailOperationId} from '../scripts/gerard-autonomous-mail.mjs';
import {loadSeeds,selectedStudioKind} from '../scripts/gerard-cycle.mjs';
const config={clientId:'benoit',parcelId:'business',products:['Pro.Hibited','Prout.Hibited','Jointed'],targets:[{organization:'Fixture editor',url:'https://editor.example/contact',approach:'Approche simulée.'}]};
const source={url:config.targets[0].url,verification:'page-read',evidence:'Fixture officielle',contactEmail:'contact@editor.example'};
test('dossier has product sheets, dated next action, evidence and cannot send without exact owner approval',()=>{
 const [draft]=acquisitionDossiers([source],config,[],new Date('2026-11-10T12:00:00Z'));
 assert.equal(draft.productSheets.length,3);assert.equal(draft.organizationVerified,true);
 assert.equal(draft.status,'awaiting-human-approval');assert.match(draft.nextAction.dueAt,/2026-11-11/);
 assert.equal(pendingMailDrafts({drafts:[draft]}).length,0);
 const approved={...draft,status:'human-approved',approval:{ownerGitHub:'benoitlub',approvedAt:'2026-11-10T12:00:00Z',operationId:mailOperationId(draft)}};
 assert.equal(pendingMailDrafts({drafts:[approved]}).length,1);
 assert.equal(pendingMailDrafts({drafts:[approved],sendingEnabled:false}).length,0);
 assert.deepEqual(acquisitionDossiers([source],config,[draft],new Date('2026-11-12T12:00:00Z'))[0].nextAction,draft.nextAction,'rediscovery cannot postpone the review forever');
 for(const changed of [{...approved,body:'changed'},{...approved,recipientEmail:'other@editor.example'},{...approved,approval:null}])assert.equal(pendingMailDrafts({drafts:[changed]}).length,0);
});
test('commercial cycle two: verified refusal changes next action without requeuing the lead; scopes remain isolated',()=>{
 const [first]=acquisitionDossiers([source],config);
 const response={verified:true,outcome:'refused',evidenceUrl:'https://mail.google.com/mail/u/0/#inbox/fixture'};
 const memory={...first,status:'refused',response,contacted:true,sentAt:'2026-11-10T10:00:00Z'};
 const learned=integrateAcquisitionFeedback({memories:['keep']},{drafts:[memory]});
 assert.equal(learned.guidance.acquisitionOutcomes[first.id].outcome,'refused');
 const [next]=acquisitionDossiers([source],config,[JSON.parse(JSON.stringify(memory))]);
 assert.match(next.nextAction.action,/Ne pas relancer/);
 const [fromLearning]=acquisitionDossiers([source],config,[],new Date(),JSON.parse(JSON.stringify(learned)));
 assert.equal(fromLearning.status,'refused','must consume learned refusal even when outbox record is absent');assert.equal(pendingMailDrafts({drafts:[next]}).length,0);
 const [other]=acquisitionDossiers([source],{...config,clientId:'other',parcelId:'other'},[memory]);
 assert.notEqual(other.id,next.id);assert.equal(other.contacted,false);
 assert.equal(acquisitionNextAction({...first,response:{...response,verified:false}}).outcome,'insufficient-data');
});
test('Production still selects acquisition seed despite optional image template; images need no voice dependency',async()=>{
 const previous=process.env.GERARD_TENTACLE;process.env.GERARD_TENTACLE='production';
 try {const seeds=await loadSeeds();assert.ok(seeds.some(s=>s.seedId==='benoit-client-acquisition'));assert.ok(!seeds.some(s=>s.imageStudioOnly));}
 finally {if(previous===undefined)delete process.env.GERARD_TENTACLE;else process.env.GERARD_TENTACLE=previous;}
 assert.equal(selectedStudioKind({imageStudioOnly:true}),'image');
 assert.equal(selectedStudioKind({templates:[{id:'video-studio'}]}),'video');
});
