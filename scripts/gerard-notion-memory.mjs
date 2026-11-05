import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const garden = new URL("../garden/", import.meta.url);
const ledgerPath = new URL("gerard-notion-memory.json", garden);
const confirmed = new Set(["confirmed-scheduled", "confirmed-published", "published", "queued", "sent"]);
const labels = {
  reach: "portée", views: "vues", interactions: "interactions", likes: "j’aime", comments: "commentaires",
  shares: "partages", saves: "enregistrements", linkClicks: "clics",
};
const safeId = value => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value) ? value : null;
const calendarDate = value => /^\d{4}-\d{2}-\d{2}/.exec(String(value ?? ""))?.[0];

async function notion(path, token, init = {}) {
  const response = await fetch("https://api.notion.com/v1" + path, {
    ...init,
    headers: { Authorization: "Bearer " + token, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("notion-http-" + response.status);
  return response.json();
}

function retainedObservation(observation) {
  if (observation?.kind === "metricool-post-measurement" && observation.source === "metricool-connected-analytics") {
    let url;
    try { url = new URL(observation.postUrl); } catch { return null; }
    if (url.protocol !== "https:" || !/(^|\.)(facebook\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be)$/.test(url.hostname)) return null;
    url.search = "";
    url.hash = "";
    const metrics = Object.entries(labels).flatMap(([key, label]) => {
      const value = observation.metrics?.[key];
      return Number.isFinite(value) && value >= 0 ? [label + " " + value] : [];
    });
    if (!metrics.length) return null;
    const network = safeId(observation.network) ?? "réseau social";
    const date = calendarDate(observation.publishedDate);
    return {
      key: ["measurement", url.href, ...metrics],
      text: "Mesure " + network + (date ? " · post du " + date : "") + " · " + metrics.join(", ") +
        ". Comparer à des publications du même réseau et du même format.",
      url: url.href,
    };
  }
  const delivery = observation?.delivery;
  const post = safeId(delivery?.postId ?? delivery?.providerPostId);
  if (observation?.kind !== "gerard-experiment-cycle" || !confirmed.has(delivery?.status) || !post) return null;
  const seed = safeId(observation.seedId);
  const published = ["confirmed-published", "published", "sent"].includes(delivery.status);
  return {
    key: ["publication", post, delivery.status],
    text: (published ? "Publication confirmée" : "Programmation confirmée") + (seed ? " · " + seed : "") +
      " · identifiant " + post + ". Attendre une mesure attribuée avant de conclure sur l’audience.",
  };
}

async function main() {
  const token = process.env.NOTION_API_KEY;
  const page = process.env.GERARD_NOTION_MEMORY_PAGE_ID;
  if (!token || !/^[a-fA-F0-9-]{32,36}$/.test(page ?? "")) {
    console.log(JSON.stringify({ event: "gerard.notion-memory", status: "not-configured" }));
    return;
  }
  const learning = JSON.parse(await readFile(new URL("gerard-learning.json", garden), "utf8"));
  let ledger;
  try { ledger = JSON.parse(await readFile(ledgerPath, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; ledger = { keys: [] }; }
  const seen = new Set(ledger.page === page ? ledger.keys : []);
  const candidates = new Map();
  for (const observation of learning.observations ?? []) {
    const retained = retainedObservation(observation);
    if (!retained) continue;
    const id = createHash("sha256").update(JSON.stringify(retained.key)).digest("hex").slice(0, 20);
    if (!seen.has(id)) candidates.set(id, retained);
  }
  if (!candidates.size) {
    console.log(JSON.stringify({ event: "gerard.notion-memory", status: "no-new-confirmed-outcome" }));
    return;
  }
  const endpoint = "/blocks/" + page + "/children";
  let cursor;
  let archived = 0;
  try {
    // Reconcile by stable ID before append, including a prior ambiguous response.
    do {
      const suffix = "?page_size=100" + (cursor ? "&start_cursor=" + encodeURIComponent(cursor) : "");
      const blocks = await notion(endpoint + suffix, token);
      for (const block of blocks.results ?? []) {
        const content = block.paragraph?.rich_text?.map(part => part.plain_text ?? "").join("") ?? "";
        const id = /^Gérard · ([a-f0-9]{20}) · /.exec(content)?.[1];
        if (id) { seen.add(id); candidates.delete(id); }
      }
      cursor = blocks.has_more ? blocks.next_cursor : null;
    } while (cursor && candidates.size);

    const batch = [...candidates.entries()].slice(-12);
    if (batch.length) {
      const children = batch.map(([id, entry]) => ({ object: "block", type: "paragraph", paragraph: { rich_text: [
        { type: "text", text: { content: "Gérard · " + id + " · " + entry.text } },
        ...(entry.url ? [{ type: "text", text: { content: " Voir la publication.", link: { url: entry.url } } }] : []),
      ] } }));
      const saved = await notion(endpoint, token, { method: "PATCH", body: JSON.stringify({ children }) });
      if (saved.results?.length !== batch.length) throw new Error("notion-write-unconfirmed");
      for (const [id] of batch) seen.add(id);
      archived = batch.length;
    }
    await writeFile(ledgerPath, JSON.stringify({ page, keys: [...seen].slice(-500) }) + "\n");
    console.log(JSON.stringify({ event: "gerard.notion-memory", status: "synced", archived }));
  } catch (error) {
    console.log(JSON.stringify({ event: "gerard.notion-memory", status: "unavailable", reason: /^notion-http-\d+$/.test(error.message) ? error.message : "notion-unconfirmed" }));
  }
}

await main();
