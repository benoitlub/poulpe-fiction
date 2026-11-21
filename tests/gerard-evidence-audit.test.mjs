import test from "node:test";
import assert from "node:assert/strict";
import { classifyCycle, classifyReceipt } from "../scripts/gerard-evidence-audit.mjs";

test("a green cycle is not delivery evidence", () => {
  assert.equal(classifyCycle({ status: "ok", operationId: "cycle-1" }).delivery, "not-proven");
});
test("studio 403 remains blocked, not delivered", () => {
  const result = classifyCycle({ status: "failed", studio: { reason: "MISTRAL_IMAGE_ACCESS_DENIED" }, published: false });
  assert.equal(result.reason, "MISTRAL_IMAGE_ACCESS_DENIED");
  assert.equal(result.delivery, "not-proven");
});
test("unconfirmed receipt with an id does not prove publication", () => {
  assert.equal(classifyReceipt({ status: "pending", postId: "123" }).delivery, "not-proven");
});
test("confirmed receipt needs provider id and delivery flag", () => {
  assert.equal(classifyReceipt({ status: "confirmed-scheduled", scheduled: true }).delivery, "not-proven");
  assert.equal(classifyReceipt({ status: "confirmed-scheduled", scheduled: true, postId: "123" }).delivery, "provider-confirmed");
});
