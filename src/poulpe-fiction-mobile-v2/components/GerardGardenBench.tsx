import { useEffect, useState } from "react";

type Message = { id: string; role: "benoit" | "gerard"; text: string; at: string };
type StateRecord = Record<string, unknown>;

const STORAGE_KEY = "poulpe-fiction:gerard-conversation:v1";
const STATE_URL = "https://raw.githubusercontent.com/benoitlub/poulpe-fiction/main/garden/gerard-state.json";
const PUBLICATION_URL = "https://raw.githubusercontent.com/benoitlub/poulpe-fiction/main/garden/next-social-publication.json";
const greeting: Message = {
  id: "welcome",
  role: "gerard",
  text: "Salut Benoît ! 🐙 Je peux te raconter mes dernières traces de travail et ce qui est préparé pour publication. Mon vrai dialogue libre avec Octopus est encore en préparation ; je ne vais pas inventer ce que j'ignore.",
  at: "",
};

function object(value: unknown): StateRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as StateRecord : {};
}
function string(value: unknown): string { return typeof value === "string" ? value : ""; }
function dateLabel(value: unknown): string {
  const valueString = string(value);
  const date = new Date(valueString);
  return valueString && !Number.isNaN(date.getTime())
    ? date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" })
    : "date inconnue";
}
async function jsonFrom(url: string): Promise<StateRecord> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
  return object(await response.json());
}

async function groundedAnswer(question: string): Promise<string> {
  const normalized = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/publi|post|reseau|instagram|tiktok|facebook|buffer/.test(normalized)) {
    const plan = await jsonFrom(PUBLICATION_URL);
    const title = string(plan.title);
    const status = string(plan.status) || "inconnu";
    const delivery = object(plan.delivery);
    const deliveryStatus = string(delivery.status) || "inconnu";
    return title
      ? `Dans le fichier de préparation du ${dateLabel(plan.preparedAt)}, j'ai « ${title} » (état : ${status}). Diffusion : ${deliveryStatus}. Une préparation n'est pas une publication confirmée.`
      : `Je ne vois pas de sujet de publication identifiable dans le fichier GitHub (état : ${status}).`;
  }
  if (/mission|recolte|travail|journee|fait|activite|phase|avance|etat|quoi|nouvelle|salut|bonjour/.test(normalized)) {
    const state = await jsonFrom(STATE_URL);
    const last = object(state.lastResult);
    const status = string(last.status) || "non renseigné";
    const mode = string(state.lastMode) || "inconnu";
    const when = dateLabel(state.lastRunAt);
    const history = Array.isArray(state.history) ? state.history : [];
    const latest = object(history[history.length - 1]);
    const outcome = string(latest.result) || "non renseigné";
    return `Ma dernière trace de cycle est datée du ${when} : phase ${mode}, résultat du cycle ${outcome} (statut détaillé : ${status}). C'est une trace enregistrée, pas la preuve que je suis actuellement en train de travailler.`;
  }
  if (/client|prospect|vente|revenu|argent|commercial/.test(normalized)) {
    return "Je ne peux pas déduire des clients, des ventes ou des revenus à partir des deux journaux publics que je lis ici. Pour une réponse fiable, il faudra connecter notre conversation aux récoltes de prospection et aux résultats vérifiés de Publisher.";
  }
  return "Je t'entends, Benoît. Pour l'instant je sais répondre sur mes derniers cycles et les publications préparées, grâce aux traces GitHub. Pour discuter librement de ce sujet, il reste à connecter le dialogue à Octopus/Publisher. Je préfère te le dire franchement plutôt que de jouer au poulpe omniscient.";
}

function loadHistory(): Message[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [greeting];
    const safe = raw.filter((row): row is Message => {
      const item = object(row);
      return typeof item.id === "string" && (item.role === "gerard" || item.role === "benoit")
        && typeof item.text === "string" && item.text.length <= 5000;
    }).slice(-24);
    return safe.length ? safe : [greeting];
  } catch { return [greeting]; }
}

/**
 * Le Banc du jardinier est volontairement en lecture seule.
 * Aucun ordre n'est transmis à Publisher, Octopus, aux campagnes ou aux emails.
 * Les réponses factuelles citent des fichiers publiés ; ce n'est pas encore un chatbot IA.
 */
export function GerardGardenBench() {
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-24)));
  }, [messages]);

  const send = async (suggestion?: string) => {
    const question = (suggestion || input).trim().slice(0, 500);
    if (!question || pending) return;
    setInput("");
    setPending(true);
    const at = new Date().toISOString();
    setMessages((previous) => [...previous, { id: `human-${at}`, role: "benoit", text: question, at }].slice(-24));
    let answer: string;
    try { answer = await groundedAnswer(question); }
    catch (error) {
      answer = `Je n'arrive pas à consulter mes traces GitHub : ${error instanceof Error ? error.message : "erreur inconnue"}. Je ne vais pas improviser un bilan.`;
    }
    setMessages((previous) => [...previous, { id: `gerard-${Date.now()}`, role: "gerard", text: answer, at: new Date().toISOString() }].slice(-24));
    setPending(false);
  };

  return (
    <section className="pf-card" aria-labelledby="gerard-bench-title">
      <div className="pf-section-heading"><span aria-hidden="true">🐙</span><div>
        <strong id="gerard-bench-title">Le banc du jardinier</strong>
        <small>Gérard, le poulpe jardinier · conversation factuelle en lecture seule</small>
      </div></div>
      <p className="pf-meta">Les Gégé sont les assistants hamsters. Les réponses ci-dessous s'appuient sur les traces GitHub ; le dialogue IA libre n'est pas encore connecté.</p>
      <div role="log" aria-live="polite" aria-label="Conversation avec Gérard" style={{ maxHeight: 320, overflowY: "auto", display: "grid", gap: 10, margin: "14px 0" }}>
        {messages.map((message) => (
          <div key={message.id} style={{
            maxWidth: "94%", justifySelf: message.role === "benoit" ? "end" : "start",
            background: message.role === "benoit" ? "rgba(20, 156, 132, 0.15)" : "rgba(127, 140, 155, 0.12)",
            padding: "10px 12px", borderRadius: 14, whiteSpace: "pre-wrap", overflowWrap: "anywhere",
          }}>
            <strong>{message.role === "benoit" ? "Benoît" : "🐙 Gérard"}</strong>
            <div>{message.text}</div>
          </div>
        ))}
      </div>
      <div className="pf-chips" aria-label="Questions proposées">
        {["Qu'as-tu fait aujourd'hui ?", "Quelle publication est préparée ?", "Où en est la prospection ?"].map((example) => (
          <button key={example} type="button" className="pf-chip" disabled={pending} onClick={() => void send(example)}>{example}</button>
        ))}
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void send(); }} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input className="pf-input" aria-label="Parler à Gérard" placeholder="Parler à Gérard…" value={input} maxLength={500} onChange={(event) => setInput(event.target.value)} />
        <button className="pf-btn pf-btn-primary" type="submit" disabled={pending || !input.trim()}>{pending ? "Lecture…" : "Envoyer"}</button>
      </form>
      <button className="pf-btn pf-btn-soft" type="button" style={{ marginTop: 8 }} onClick={() => setMessages([greeting])}>Effacer cette conversation locale</button>
    </section>
  );
}
