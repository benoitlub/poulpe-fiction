import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const OUTBOX = new URL("../garden/gerard-mail-outbox.json", import.meta.url);
const OWNER = "benoitlubert@gmail.com";
const PUBLISHER = process.env.PUBLISHER_URL || "https://blacklace-publisher-worker.benoitlubert.workers.dev";

async function githubOidcToken() {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const token = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !token) throw new Error("GitHub OIDC unavailable");
  const response = await fetch(url + "&audience=blacklace-publisher-gerard-owner-test", {
    headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("GitHub OIDC failed: " + response.status);
  const data = await response.json();
  if (!data.value) throw new Error("GitHub OIDC token missing");
  return data.value;
}

export function mailOperationId(draft) {
  const digest = createHash("sha256")
    .update(JSON.stringify([draft.id, draft.recipientEmail, draft.subject, draft.body]))
    .digest("hex").slice(0, 40);
  return "gerard-mail-" + digest;
}

export function pendingMailDrafts(outbox) {
  if (!outbox?.sendingEnabled || !Array.isArray(outbox.drafts)) return [];
  return outbox.drafts.filter(draft =>
    draft.status === "ready-for-autonomous-send" && !draft.sentAt && !draft.contacted &&
    typeof draft.recipientEmail === "string" && /^[^@\s<>]+@[^@\s<>]+\.[a-z]{2,}$/i.test(draft.recipientEmail) &&
    typeof draft.subject === "string" && typeof draft.body === "string").slice(0, 3);
}

async function run() {
  if (process.env.GERARD_MAIL_AUTONOMY_ENABLED !== "true") {
    console.log("gerard.mail.autonomy=disabled");
    return;
  }
  const outbox = JSON.parse(await readFile(OUTBOX, "utf8"));
  const pending = pendingMailDrafts(outbox);
  console.log(JSON.stringify({ event: "gerard.mail.pending", count: pending.length, cc: OWNER }));
  if (!pending.length) return;
  const oidc = await githubOidcToken();
  for (const draft of pending) {
    const operationId = mailOperationId(draft);
    // The Worker reserves the operation before sending. Replaying never sends a duplicate.
    let response, result;
    try {
      response = await fetch(PUBLISHER + "/api/gerard/gmail/send", {
        method: "POST",
        headers: { Authorization: "Bearer " + oidc, "Content-Type": "application/json" },
        body: JSON.stringify({ operationId, recipientEmail: draft.recipientEmail, subject: draft.subject, body: draft.body }),
        signal: AbortSignal.timeout(30000),
      });
      result = await response.json();
    } catch {
      result = { status: "unknown", reason: "transport-timeout-or-invalid-response" };
    }
    if (response?.status === 200 && result?.status === "sent") {
      draft.status = "sent";
      draft.sentAt = new Date().toISOString();
      draft.contacted = true;
    } else {
      // Preserve uncertainty: a timeout could occur after Gmail accepted the message.
      // Do not automatically replay this operation.
      draft.status = result?.reason === "operation-already-reserved" ? "duplicate-blocked" : "unknown";
      draft.lastError = String(result?.reason || result?.status || "unconfirmed").slice(0, 100);
    }
    draft.operationId = operationId;
    draft.cc = OWNER;
    await writeFile(OUTBOX, JSON.stringify(outbox, null, 2) + "\n", "utf8");
    console.log(JSON.stringify({ event: "gerard.mail.delivery", operationId, status: draft.status,
      recipient: draft.recipientEmail, cc: OWNER }));
  }
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  run().catch(error => {
    console.error("gerard.mail.error=" + String(error?.message || error).slice(0, 160));
    process.exitCode = 1;
  });
}
