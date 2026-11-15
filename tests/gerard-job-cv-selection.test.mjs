import test from "node:test";
import assert from "node:assert/strict";
import { rankJobCandidates, careerCvProfiles } from "../scripts/gerard-job-radar.mjs";

const base = { verification: "source-opened", employer: "Entreprise exemple", location: "Versailles", employmentType: "CDI", url: "https://example.org/offre/123", snippet: "Contrat CDI", applicationEmail: "recrutement@example.org" };
for (const [title, profile, filename] of [
  ["Conseiller de vente", "vente", careerCvProfiles.vente],
  ["Formateur multimédia", "formation", careerCvProfiles.formation],
  ["Graphiste", "creation", careerCvProfiles.creation],
]) {
  test(`choisit le profil CV ${profile} sans affirmer qu'une pièce jointe existe`, () => {
    const [result] = rankJobCandidates([{ ...base, title }]);
    assert.ok(result);
    assert.match(result.content, new RegExp(`Profil CV recommandé : ${profile}`));
    assert.ok(result.content.includes(filename));
    assert.match(result.content, /Pièce jointe : non vérifiée/);
    assert.match(result.content, /Ne pas envoyer automatiquement/);
  });
}
test("rejette les offres non vérifiées", () => {
  assert.deepEqual(rankJobCandidates([{ ...base, title: "Graphiste", verification: "search-snippet" }]), []);
});
