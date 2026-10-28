import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const OWNER = 'benoitlubert@gmail.com';
export const SENDER = 'gerardpoulpefiction@gmail.com';
export function diagnoseMail(env = process.env) {
  const missing = ['GERARD_GMAIL_CLIENT_ID','GERARD_GMAIL_CLIENT_SECRET','GERARD_GMAIL_REFRESH_TOKEN'].filter(k => !env[k]);
  return { capability: 'gmail.owner-test.send', ready: missing.length === 0, missing, sender: SENDER,
    nextAction: missing.length ? 'Connecter le compte Gmail de Gérard avec OAuth et renseigner les secrets GitHub Actions.' : 'Lancer le test propriétaire explicitement autorisé.' };
}
const b64url = s => Buffer.from(s, 'utf8').toString('base64url');
export async function sendOwnerTest({ env = process.env, fetcher = fetch, recipient = OWNER, operationId }) {
  if (recipient !== OWNER) throw new Error('recipient-not-authorized');
  if (!operationId || !/^[-a-zA-Z0-9_]{8,100}$/.test(operationId)) throw new Error('invalid-operation-id');
  const diagnostic = diagnoseMail(env);
  if (!diagnostic.ready) return { status: 'blocked', diagnostic };
  const params = new URLSearchParams({client_id:env.GERARD_GMAIL_CLIENT_ID,client_secret:env.GERARD_GMAIL_CLIENT_SECRET,refresh_token:env.GERARD_GMAIL_REFRESH_TOKEN,grant_type:'refresh_token'});
  const tokenResponse = await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:params});
  if (!tokenResponse.ok) return {status:'blocked',reason:'oauth-token-http-'+tokenResponse.status};
  const token = await tokenResponse.json();
  if (!token.access_token) return {status:'blocked',reason:'oauth-token-missing'};
  const profileResponse = await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{Authorization:'Bearer '+token.access_token}});
  if (!profileResponse.ok) return {status:'blocked',reason:'gmail-profile-http-'+profileResponse.status};
  const profile = await profileResponse.json();
  if (String(profile.emailAddress||'').toLowerCase() !== SENDER) return {status:'blocked',reason:'sender-identity-mismatch'};
  const subject = '[TEST GÉRARD] Connexion Gmail vérifiée';
  const body = 'Bonjour Benoît,\n\nCeci est le test unique de Gérard. Mon identité Gmail a été vérifiée avant cet envoi. Aucun prospect n’a été contacté.\n\nOpération : '+operationId+'\n\nGérard';
  const raw = ['From: Gérard <'+SENDER+'>','To: '+OWNER,'Subject: '+subject,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','',body].join('\r\n');
  const response = await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({raw:b64url(raw)})});
  if (!response.ok) return {status:'failed',reason:'gmail-send-http-'+response.status};
  const sent = await response.json();
  if (!sent.id) return {status:'failed',reason:'gmail-message-id-missing'};
  return {status:'sent',messageId:sent.id,threadId:sent.threadId??null,recipient:OWNER,sender:SENDER,sentAt:new Date().toISOString(),operationId};
}
async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const ledgerPath = path.join(root,'garden','gerard-gmail-test-ledger.json');
  let ledger;try{ledger=JSON.parse(await readFile(ledgerPath,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;ledger={operationId:'gerard-owner-mail-test-147',status:'pending'}}
  if (ledger.status==='sent' || ledger.status==='sending') {console.log(JSON.stringify({status:'skipped',reason:'already-sent-or-in-flight',messageId:ledger.messageId??null}));return;}
  const diag=diagnoseMail();
  if(process.env.GERARD_GMAIL_OWNER_TEST_ENABLED!=='true'||!diag.ready){console.log(JSON.stringify({status:'blocked',reason:'test-disabled-or-credentials-missing',diagnostic:diag}));return;}
  // Persist a reservation BEFORE calling Gmail. Never retry automatically after an uncertain response.
  ledger={...ledger,status:'sending',startedAt:new Date().toISOString()};
  await writeFile(ledgerPath,JSON.stringify(ledger,null,2)+'\n');
  try{const result=await sendOwnerTest({operationId:ledger.operationId});ledger={...ledger,...result};}
  catch(e){ledger={...ledger,status:'unknown',reason:String(e).slice(0,200)};}
  await writeFile(ledgerPath,JSON.stringify(ledger,null,2)+'\n');
  console.log(JSON.stringify(ledger));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1});
