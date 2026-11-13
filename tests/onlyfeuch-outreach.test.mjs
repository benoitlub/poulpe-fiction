import test from "node:test";
import assert from "node:assert/strict";
import { createMailDrafts } from "../scripts/gerard-mail-outbox.mjs";
import { assessBusinessPage } from "../scripts/gerard-b2b-qualification.mjs";

test("OnlyFeuch produit un brouillon séparé et jamais un envoi direct", () => {
  const drafts = createMailDrafts([{
    verification: "page-read",
    qualification: "priority-review",
    fitScore: 90,
    title: "Créatrice test",
    url: "https://creator.example/profile",
    contactEmail: "business@creator.example",
    evidence: "Profil public"
  }], { parcelId: "onlyfeuch-agency", profile: "onlyfeuch" });
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].brandId, "onlyfeuch");
  assert.equal(drafts[0].status, "ready-for-review");
  assert.match(drafts[0].subject, /OnlyFeuch/);
  assert.match(drafts[0].body, /créatrices adultes/i);
  assert.doesNotMatch(drafts[0].body, /Pro\.Hibited/);
});

test("OnlyFeuch exige un contexte créatrice et un email public avant priorité", () => {
  const html = `
    <html><body>
      <h1>Adult creator / OnlyFans model</h1>
      <p>Business inquiries and collaborations.</p>
      <a href="mailto:management@example.com">Contact</a>
    </body></html>`;
  const qualified = assessBusinessPage({ title:"Creator", url:"https://creator.example" }, html, { profile:"onlyfeuch" });
  assert.equal(qualified.qualification, "priority-review");
  assert.equal(qualified.contactEmail, "management@example.com");
  assert.ok(qualified.fitScore >= 80);

  const noMail = assessBusinessPage({ title:"Creator", url:"https://creator.example" }, "<p>OnlyFans creator, collaborations welcome</p>", { profile:"onlyfeuch" });
  assert.equal(noMail.qualification, "investigate");
  assert.equal(noMail.contactEmail, null);
});
