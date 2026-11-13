import test from "node:test";
import assert from "node:assert/strict";
import { rankJobCandidates, jobSearchQueries } from "../scripts/gerard-job-radar.mjs";

test("Gégé Revenus recherche support distant, formation et relocalisation", () => {
  const joined = jobSearchQueries.join("\n");
  assert.match(joined, /support client/i);
  assert.match(joined, /formateur IA/i);
  assert.match(joined, /relocation package/i);
});

test("accepte un poste francophone avec relocalisation vers un pays ensoleillé", () => {
  const result = rankJobCandidates([{
    verification: "source-opened",
    title: "Customer Support Francophone",
    employer: "Example Co",
    location: "Athens, Greece",
    employmentType: "FULL_TIME",
    remote: false,
    salary: "1 250 EUR/month",
    url: "https://jobs.example.com/support-fr",
    snippet: "Relocation package with flight provided and accommodation provided."
  }]);
  assert.equal(result.length, 1);
  assert.match(result[0].content, /Athens, Greece/);
});

test("rejette les fausses opportunités à commission uniquement", () => {
  const result = rankJobCandidates([{
    verification: "source-opened",
    title: "Customer Support Francophone",
    employer: "Bad Gig",
    location: "Télétravail",
    employmentType: "CONTRACTOR",
    remote: true,
    salary: "Variable",
    url: "https://jobs.example.com/bad-gig",
    snippet: "Rémunération uniquement à la commission."
  }]);
  assert.equal(result.length, 0);
});
