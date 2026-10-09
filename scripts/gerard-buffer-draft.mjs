import fs from "node:fs";
import crypto from "node:crypto";

const file = "garden/next-social-publication.json";
const ledgerFile = "garden/buffer-draft-ledger.json";
const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, "utf8")) : {};
const route = pkg.editorialRoute?.destination;
if (pkg.status !== "ready" || pkg.transport?.provider !== "buffer" || route?.preferredProvider !== "buffer" || pkg.bufferPreflight?.status !== "ready-for-controlled-test" || pkg.action !== "hold-for-buffer-draft") {
  console.log("Buffer draft skipped: not eligible"); process.exit(0);
}
const text = pkg.copy?.text;
const url = pkg.media?.url;
const channelId = pkg.bufferPreflight.channelId;
if (!text || !url || !/^https:\/\//.test(url) || channelId !== "6ac8c8226a5c39ccb65fdbf6") throw Error("Unsafe or incomplete book draft");
const key = process.env.BUFFER_API_KEY;
if (!key) { console.log("Buffer draft disabled: GitHub BUFFER_API_KEY secret missing"); process.exit(0); }
const fingerprint = crypto.createHash("sha256").update(JSON.stringify({channelId,text,url})).digest("hex");
if (ledger[fingerprint]) { console.log("Existing draft: " + ledger[fingerprint].postId); process.exit(0); }
// Persist a pending marker BEFORE the external mutation, so uncertain responses never trigger automatic retries.
ledger[fingerprint] = {status:"pending",harvestId:pkg.harvestId,createdAt:new Date().toISOString()};
fs.writeFileSync(ledgerFile,JSON.stringify(ledger,null,2)+"\n");
const query = `mutation { createPost(input: { text: ${JSON.stringify(text)}, channelId: ${JSON.stringify(channelId)}, schedulingType: automatic, mode: addToQueue, saveToDraft: true, assets: [{ image: { url: ${JSON.stringify(url)} } }] }) { ... on PostActionSuccess { post { id text } } ... on MutationError { message } } }`;
try {
  const response = await fetch("https://api.buffer.com",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({query}),signal:AbortSignal.timeout(12000)});
  const payload = await response.json();
  const post = payload?.data?.createPost?.post;
  if (response.ok && !payload.errors && post?.id) {
    ledger[fingerprint] = {status:"draft-created",postId:post.id,harvestId:pkg.harvestId,createdAt:new Date().toISOString()};
    pkg.delivery = {status:"confirmed-sent",kind:"buffer-draft",postId:post.id,publishingEnabled:false};
    pkg.action = "draft-created-awaiting-human-review";
    fs.writeFileSync(file,JSON.stringify(pkg,null,2)+"\n");
    console.log("Buffer draft created: "+post.id);
  } else { ledger[fingerprint].status="unknown"; console.log("Buffer draft result unconfirmed; manual review required"); }
} catch(e) { ledger[fingerprint].status="unknown"; console.log("Buffer request uncertain; manual review required"); }
fs.writeFileSync(ledgerFile,JSON.stringify(ledger,null,2)+"\n");
