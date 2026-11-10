import test from "node:test";
import assert from "node:assert/strict";
import { rankJobCandidates } from "../scripts/gerard-job-radar.mjs";
import { parseBusinessSourceResponse } from "../scripts/gerard-b2b-bridge.mjs";
import { publicProjection } from "../scripts/gerard-private-runtime.mjs";

const offer = {
  title: "Conseiller de vente", employer: "Boutique Test",
  url: "https://www.hellowork.com/fr-fr/emplois/123.html", location: "Versailles 78000",
  employmentType: "FULL_TIME", verification: "source-opened", snippet: "Caisse et conseil",
};
function result(candidates) {
  return { status: "ok", payload: { status: "completed", output: {
    capability: "business.sources.search", status: "sources-found", executed: true, candidates,
  } } };
}

test("keeps only opened, paid or salaried opportunities and deduplicates mirrors", () => {
  const jobs = parseBusinessSourceResponse(result([
    offer,
    { ...offer, url: "https://candidat.francetravail.fr/offres/recherche/detail/ZZZ999" },
    { ...offer, url: offer.url.replace("123", "124"), title: "Vendeur indépendant", employmentType: "CONTRACTOR", salary: "2500 EUR", snippet: "Vous devez fixer vos propres tarifs" },
    { ...offer, url: offer.url.replace("123", "125"), verification: "search-result-only" },
  ]), { jobPostings: true });
  const drafts = rankJobCandidates(jobs.candidates);
  assert.equal(drafts.length, 1);
  assert.match(drafts[0].content, /Montant non indiqué/);
  assert.match(drafts[0].content, /Aucun e-mail de candidature vérifié/);
  assert.match(drafts[0].content, /Alter Smoke/);
  assert.match(drafts[0].content, /CV_Benoit_Lubert_Vente_2026.pdf/);
});

test("draft recipient and body are stripped from the public projection", () => {
  const [draft] = rankJobCandidates([{ ...offer, applicationEmail: "recrutement@example.org" }]);
  assert.match(draft.content, /recrutement@example.org/);
  const output = publicProjection("harvests.json", { harvests: [{ harvestId: draft.id, content: draft.content, capability: "candidature.draft" }] });
  assert.doesNotMatch(JSON.stringify(output), /@|Alter Smoke|Benoît Lubert/);
});
