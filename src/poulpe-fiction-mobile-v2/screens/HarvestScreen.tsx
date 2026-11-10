import { useEffect, useMemo, useRef, useState, type FC } from "react";
import "../styles/html-harvest.css";
import { HarvestActions } from "../components/HarvestActions";
import { ReadableHarvest, plainHarvestText } from "../components/ReadableHarvest";
import { restoreAllGardenHarvests } from "../runtime/restoreGardenHarvest";
import type { HarvestBundle, HarvestStatus } from "../types";

const STATUS_LABEL: Record<HarvestStatus, string> = { draft: "Brouillon", "ready-to-review": "Prêt à valider", "ready-to-use": "Prêt à utiliser" };
const copy = (text: string) => { void navigator.clipboard?.writeText(text); };
function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function openHtml(content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/html;charset=utf-8" }));
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const PARCEL_PAGE_SIZE = 15;
const LATEST_LIMIT = 12;
const GERARD_LIMIT = 8;
type ServerHarvest = { harvestId: string; parcelId: string; title: string; content: string; harvestedAt: string; state: string; capability?: string; mailStatus?: string; mailSentAt?: string; mailRecipient?: string };
const PRIVATE_GARDEN_API = "https://blacklace-publisher-worker.benoitlubert.workers.dev/api/garden/v1";
function validServerHarvests(data: any): ServerHarvest[] {
  if (!Array.isArray(data?.harvests)) return [];
  return data.harvests.filter((h: any) =>
    typeof h?.harvestId === "string" && typeof h?.parcelId === "string" &&
    typeof h?.content === "string" && h.content.trim() &&
    ["harvested", "ready-to-offer", "ready-to-use", "ready-to-review"].includes(h.state) &&
    !/mode mock actif|configurez AI_PROVIDER/i.test(h.content) &&
    !(h.parcelId === "project-yael-prospection" && /420 dice|pro[.]hbtd|blacklace dice/i.test(h.content))
  ).sort((a: ServerHarvest, b: ServerHarvest) => String(b.harvestedAt).localeCompare(String(a.harvestedAt)));
}

function parcelLabel(parcelId: string): string {
  return parcelId.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const HarvestCard: FC<{ bundle: HarvestBundle; initiallyOpen?: boolean; showParcel?: boolean }> = ({ bundle, initiallyOpen = false, showParcel = true }) => {
  const [open, setOpen] = useState(initiallyOpen);
  const harvest = bundle.harvest;
  const editAction = bundle.editorialSource?.url
    ? [{ label: "Modifier dans Notion", primary: true, onClick: () => window.open(bundle.editorialSource!.url, "_blank", "noopener,noreferrer") }]
    : [];

  return (
    <article className="pf-card" aria-label={`Récolte ${harvest.title}`}>
      <button className="pf-harvest-heading" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} style={{ width: "100%", border: 0, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer" }}>
        <div>
          <h2 className="pf-harvest-title">{harvest.title}</h2>
          <p className="pf-meta">{new Date(bundle.createdAt).toLocaleString("fr-FR")}{showParcel ? ` · ${parcelLabel(bundle.intent.parcelId)}` : ""}</p>
        </div>
        <span className="pf-harvest-status" data-status={harvest.status}>{open ? "Fermer" : STATUS_LABEL[harvest.status]}</span>
      </button>
      {open ? <>
        {bundle.editorialSource ? <p className="pf-meta">Source éditable Notion{bundle.editorialSource.lastSyncedAt ? ` · synchronisée le ${new Date(bundle.editorialSource.lastSyncedAt).toLocaleString("fr-FR")}` : ""}</p> : null}
        {harvest.kind === "publication-pack" ? <>
          <div className="pf-visual-preview"><img src={harvest.previewUrl} alt={harvest.title} /></div>
          <div className="pf-caption"><strong>Post prêt à publier</strong><br />{harvest.postText}</div>
          <div className="pf-meta">{harvest.format} · {harvest.dimensions} · visuel réel fourni par la récolte</div>
          <HarvestActions actions={[
            ...editAction,
            { label: "Copier le post", primary: !editAction.length, onClick: () => copy(harvest.postText) },
            { label: "Télécharger le visuel", onClick: () => window.open(harvest.downloadUrl ?? harvest.previewUrl, "_blank", "noopener,noreferrer") },
          ]} />
        </> : null}
        {harvest.kind === "visual" ? <><div className="pf-visual-preview"><img src={harvest.previewUrl} alt={harvest.title} loading="lazy" /></div><div className="pf-caption">{harvest.caption}</div><div className="pf-meta">{harvest.format} · {harvest.dimensions}</div><HarvestActions actions={[...editAction, { label: "Télécharger", primary: !editAction.length, onClick: () => window.open(harvest.downloadUrl ?? harvest.previewUrl, "_blank") }]} /></> : null}
        {harvest.kind === "contact-list" ? <><p className="pf-summary">{harvest.summary}</p>{harvest.contacts.map((contact) => <div key={`${contact.name}-${contact.organization}`} className="pf-contact-card"><div className="pf-contact-name">{contact.name}</div><div className="pf-contact-role">{contact.role} · {contact.organization}</div><div className="pf-contact-line">Ciblage : {contact.reason}</div><div className="pf-contact-line">Source : {contact.source}</div><div className="pf-contact-line">Contact : {contact.contact}</div><div className="pf-contact-line">Statut : {contact.status}</div></div>)}<HarvestActions actions={[...editAction, { label: "Exporter CSV", primary: !editAction.length, onClick: () => { const header = "Nom,Rôle,Organisation,Ciblage,Source,Contact,Statut\n"; const rows = harvest.contacts.map((contact) => [contact.name, contact.role, contact.organization, contact.reason, contact.source, contact.contact, contact.status].map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n"); download("contacts.csv", header + rows, "text/csv"); } }, { label: "Copier la liste", onClick: () => copy(harvest.contacts.map((contact) => `${contact.name} — ${contact.role} (${contact.contact})`).join("\n")) }]} /></> : null}
        {harvest.kind === "landing" ? <><iframe className="pf-html-harvest" title={harvest.title} srcDoc={harvest.html} sandbox="allow-popups allow-popups-to-escape-sandbox" /><div className="pf-caption">{harvest.copy}</div><HarvestActions actions={[...editAction, { label: "Ouvrir l’aperçu HTML", onClick: () => openHtml(harvest.html) }, { label: "Copier le texte", onClick: () => copy(harvest.copy) }, { label: "Télécharger HTML", primary: !editAction.length, onClick: () => download("recolte.html", harvest.html, "text/html;charset=utf-8") }]} /></> : null}
        {harvest.kind === "text" ? <><div className="pf-caption">{harvest.body}</div><HarvestActions actions={[...editAction, { label: "Copier", primary: !editAction.length, onClick: () => copy(harvest.body) }]} /></> : null}
      </> : null}
    </article>
  );
}

const ParcelGroup: FC<{ parcelId: string; items: HarvestBundle[]; initiallyOpen: boolean }> = ({ parcelId, items, initiallyOpen }) => {
  const [open, setOpen] = useState(initiallyOpen);
  const [visibleCount, setVisibleCount] = useState(PARCEL_PAGE_SIZE);
  const latest = items[0];
  const visible = items.slice(0, visibleCount);
  const remaining = items.length - visible.length;
  return (
    <section className="pf-card" aria-label={`Parcelle ${parcelLabel(parcelId)}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        style={{ width: "100%", border: 0, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}
      >
        <div>
          <h2 className="pf-harvest-title">{parcelLabel(parcelId)}</h2>
          <p className="pf-meta">{items.length} récolte{items.length > 1 ? "s" : ""} · dernière le {new Date(latest.createdAt).toLocaleDateString("fr-FR")}</p>
        </div>
        <span className="pf-harvest-status">{open ? "Replier" : "Déplier"}</span>
      </button>
      {open ? <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
        {visible.map((item, index) => <HarvestCard key={item.missionId} bundle={item} initiallyOpen={index === 0} showParcel={false} />)}
        {remaining > 0 ? <button className="pf-btn" type="button" onClick={() => setVisibleCount((count) => count + PARCEL_PAGE_SIZE)}>Afficher les {Math.min(remaining, PARCEL_PAGE_SIZE)} récoltes précédentes</button> : null}
      </div> : null}
    </section>
  );
}

const ArchiveByParcel: FC<{ groups: [string, HarvestBundle[]][] }> = ({ groups }) => {
  const [open, setOpen] = useState(false);
  const total = groups.reduce((sum, [, items]) => sum + items.length, 0);
  if (!groups.length) return null;
  return (
    <section className="pf-card" aria-label="Archive par parcelle">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        style={{ width: "100%", border: 0, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}
      >
        <div>
          <h2 className="pf-harvest-title">Archive par parcelle</h2>
          <p className="pf-meta">{total} récolte{total > 1 ? "s" : ""} · {groups.length} parcelle{groups.length > 1 ? "s" : ""}</p>
        </div>
        <span className="pf-harvest-status">{open ? "Replier" : "Déplier"}</span>
      </button>
      {open ? <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
        {groups.map(([parcelId, items], index) => <ParcelGroup key={parcelId} parcelId={parcelId} items={items} initiallyOpen={index === 0} />)}
      </div> : null}
    </section>
  );
}

type GoogleIdentity = {
  initialize(options: { client_id: string; callback: (response: { credential: string }) => void; auto_select: boolean }): void;
  renderButton(element: HTMLElement, options: { theme: "outline"; size: "large"; text: "signin_with"; locale: "fr" }): void;
};
const GOOGLE_CLIENT_ID = "692850297482-75umdcti8d45u0gr146h9egd1l7ah2uv.apps.googleusercontent.com";
let googleIdentity: Promise<GoogleIdentity> | undefined;
let receiveGoogleCredential: ((credential: string) => void) | undefined;

function loadGoogleIdentity(): Promise<GoogleIdentity> {
  googleIdentity ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      const google = (window as Window & { google?: { accounts: { id: GoogleIdentity } } }).google;
      const identity = google?.accounts.id;
      if (!identity) {
        reject(new Error("Google Sign-In indisponible"));
        return;
      }
      try {
        identity.initialize({
          client_id: GOOGLE_CLIENT_ID,
          auto_select: false,
          callback: ({ credential }) => receiveGoogleCredential?.(credential),
        });
        resolve(identity);
      } catch (error) {
        reject(error);
      }
    };
    script.onerror = () => reject(new Error("Google Sign-In indisponible"));
    document.head.appendChild(script);
  });
  return googleIdentity;
}

const CandidatureCard: FC<{ item: ServerHarvest; credential: string }> = ({ item, credential }) => {
  const [offer, draft] = item.content.split("\n### Brouillon de candidature\n");
  const subject = /^Objet : ([^\r\n]+)\n/.exec(draft || "")?.[1];
  const verifiedAddress = /^- Destinataire vérifié dans l’annonce : ([^\r\n]+)$/m.exec(offer)?.[1];
  const [address, setAddress] = useState("");
  const [mailStatus, setMailStatus] = useState(item.mailStatus || "");
  const [sentAt, setSentAt] = useState(item.mailSentAt || "");
  const [sentTo, setSentTo] = useState(item.mailRecipient || "");
  const [note, setNote] = useState("");
  const busy = useRef(false);
  const recipient = verifiedAddress || address.trim();
  const externalOutcome = mailStatus === "applied-externally" ? "Déposée via HelloWork" :
    mailStatus === "closed" ? "Offre fermée" : "";
  const reserved = Boolean(externalOutcome) || ["sent", "sending", "unknown"].includes(mailStatus);

  async function approve() {
    if (busy.current || reserved || !subject || !/^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/.test(recipient)) return;
    const approval = `Envoyer ce brouillon via le Gmail de Gérard ?\n\nÀ : ${recipient}\nObjet : ${subject}\nPièce jointe : aucune`;
    if (!window.confirm(approval)) return;
    busy.current = true;
    setMailStatus("sending");
    setNote("Envoi en cours…");
    try {
      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(item.content)));
      const revision = Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("");
      const response = await fetch(`${PRIVATE_GARDEN_API}/candidatures/${encodeURIComponent(item.harvestId)}/send`, {
        method: "POST",
        headers: { Authorization: "Bearer " + credential, "Content-Type": "application/json" },
        body: JSON.stringify({ revision, recipient }),
        redirect: "error",
        signal: AbortSignal.timeout(55000),
      });
      const result = await response.json();
      if (response.ok && result.status === "sent") {
        setMailStatus("sent");
        setSentAt(typeof result.sentAt === "string" ? result.sentAt : "");
        setSentTo(typeof result.recipient === "string" ? result.recipient : "");
        setNote("");
        return;
      }
      if (["unknown", "check-delivery"].includes(result.status)) {
        setMailStatus("unknown");
        setNote("");
        return;
      }
      if (["unauthorized", "draft-changed", "invalid-approval", "gmail-unavailable", "unavailable"].includes(result.status)) {
        setMailStatus("");
        setNote({
          unauthorized: "Reconnecte-toi avec ton compte Google pour valider l’envoi.",
          "draft-changed": "Le brouillon a changé. Rouvre Récoltes et relis la nouvelle version.",
          "invalid-approval": "Vérifie le destinataire et le brouillon avant de réessayer.",
          "gmail-unavailable": "Le compte Gmail de Gérard est indisponible. Le brouillon peut être validé à nouveau.",
          unavailable: "La validation est indisponible. Rouvre Récoltes pour vérifier l’état.",
        }[result.status as string] ?? "");
        return;
      }
      throw new Error("Résultat Gmail inconnu");
    } catch {
      setMailStatus("unknown");
      setNote("");
    } finally {
      busy.current = false;
    }
  }

  return <details className="pf-card" style={{ marginTop: 8 }}>
    <summary><strong>{item.title}</strong>{externalOutcome ? ` · ${externalOutcome}` : mailStatus === "sent" ? " · Envoyé" : ""}</summary>
    <ReadableHarvest content={offer} />
    {draft && <>
      <h4>Brouillon de candidature</h4>
      <div className="pf-caption" style={{ whiteSpace: "pre-wrap" }}>{draft}</div>
      <HarvestActions actions={[{ label: "Copier le brouillon", onClick: () => copy(draft) }]} />
      {subject && !reserved && <div>
        {!verifiedAddress && <label>Adresse de recrutement que tu as vérifiée
          <input type="email" value={address} onChange={event => setAddress(event.target.value)} autoComplete="off" />
        </label>}
        <p className="pf-meta">L’envoi via Gmail contient le texte ci-dessus. Les pièces jointes se gèrent séparément.</p>
        <button type="button" className="pf-btn pf-btn-primary" disabled={!recipient} onClick={() => void approve()}>
          Valider et envoyer via Gmail
        </button>
      </div>}
      {mailStatus === "sent" && <p role="status">Envoyé via Gmail{sentTo ? " à " + sentTo : ""}{sentAt ? " le " + new Date(sentAt).toLocaleString("fr-FR") : ""}.</p>}
      {mailStatus === "unknown" && <p role="status">Envoi à vérifier dans les messages envoyés de Gmail. Aucun renvoi automatique.</p>}
      {mailStatus === "sending" && !note && <p role="status">Envoi en cours ou à vérifier dans Gmail.</p>}
      {note && <p role="status">{note}</p>}
    </>}
  </details>;
};

type ProspectStage = "explore" | "contact" | "discussion";
function extractProspects(content: string): { name: string; url: string; score: number | null }[] {
  const matches = [...content.matchAll(/^\s*\d+\.\s+([^\n]+)\n([\s\S]*?)(?=^\s*\d+\.\s+|$(?![\s\S]))/gm)];
  return matches.flatMap((match) => {
    const url = /^\s*URL\s*:\s*(https?:\/\/\S+)/mi.exec(match[2])?.[1];
    if (!url) return [];
    try { new URL(url); } catch { return []; }
    const score = /score probant\s*(\d+)\/100/i.exec(match[2])?.[1];
    return [{ name: match[1].trim(), url, score: score ? Number(score) : null }];
  });
}
const ProspectHarvest: FC<{ item: ServerHarvest }> = ({ item }) => {
  const prospects = useMemo(() => extractProspects(item.content), [item.content]);
  const [stages, setStages] = useState<Record<string, ProspectStage>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [recipient, setRecipient] = useState("");
  if (!prospects.length) return null;
  const current = prospects.find((prospect) => prospect.url === selected);
  const stage = (url: string): ProspectStage => stages[url] || "explore";
  const stageLabel: Record<ProspectStage, string> = { explore: "À explorer", contact: "À contacter", discussion: "En discussion" };
  const compose = (name: string) => "Bonjour,\n\nJe suis créateur de jeux indépendants, notamment Pro.Hibited, Jointed et 420 Dice. Je souhaiterais savoir si vos activités pourraient accueillir une collaboration de distribution, coédition ou partenariat rémunéré.\n\nPourriez-vous m’indiquer si cette proposition correspond à votre activité et, le cas échéant, à qui présenter les jeux ?\n\nBien cordialement";
  return <div className="pf-prospect-list">
    <p className="pf-meta">Pistes issues de sources publiques, non qualifiées. Aucun contact ni budget confirmé.</p>
    {prospects.map((prospect) => <div key={prospect.url} className="pf-prospect-line">
      <div><strong>{prospect.name}</strong><div><a href={prospect.url} target="_blank" rel="noopener noreferrer">Voir la source</a> · {stageLabel[stage(prospect.url)]}{prospect.score !== null ? " · Indice " + prospect.score + "/100" : ""}</div></div>
      <div className="pf-prospect-controls">
        <button type="button" className="pf-btn" onClick={() => { setSelected(prospect.url); setDraft(compose(prospect.name)); setRecipient(""); }}>Préparer une proposition</button>
        <select aria-label={"Étape pour " + prospect.name} value={stage(prospect.url)} onChange={(event) => setStages((prev) => ({ ...prev, [prospect.url]: event.target.value as ProspectStage }))}>
          <option value="explore">À explorer</option><option value="contact">À contacter</option><option value="discussion">En discussion</option>
        </select>
      </div>
    </div>)}
    {current && <section className="pf-prospect-editor" aria-label="Proposition commerciale">
      <h4>Proposition pour {current.name}</h4>
      <p className="pf-meta">Brouillon local non enregistré sur le serveur. Vérifie le destinataire et personnalise le texte avant tout envoi.</p>
      <label>Adresse professionnelle vérifiée <input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="contact@entreprise.fr" /></label>
      <label>Message <textarea rows={9} value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
      <HarvestActions actions={[{ label: "Copier le brouillon", onClick: () => copy(draft) }]} />
      <button className="pf-btn pf-btn-primary" type="button" disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)} onClick={() => {
        const subject = "Proposition de partenariat — jeux indépendants";
        window.location.href = "mailto:" + encodeURIComponent(recipient) + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(draft);
      }}>Ouvrir le mail pour validation</button>
      <p className="pf-meta">L’envoi Gmail automatique n’est pas connecté à cette parcelle. Ouvrir le mail ne confirme aucun envoi.</p>
    </section>}
  </div>;
};

function PrivateHarvests() {
  const [session, setSession] = useState<{ items: ServerHarvest[]; expiresAt: number; credential: string } | null>(null);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const button = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session) {
      const timer = setTimeout(() => setSession(null), Math.max(0, session.expiresAt - Date.now()));
      return () => clearTimeout(timer);
    }

    const controller = new AbortController();
    receiveGoogleCredential = async (credential) => {
      setPending(true);
      setStatus("");
      try {
        const response = await fetch(`${PRIVATE_GARDEN_API}/private-harvests`, {
          headers: { Authorization: "Bearer " + credential },
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setStatus("Choisis ton compte Google propriétaire de Poulpe Fiction.");
          return;
        }
        if (!response.ok) throw new Error("Récoltes indisponibles");
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!Number.isSafeInteger(data.expiresAt) || data.expiresAt <= Date.now()) {
          throw new Error("Session expirée");
        }
        setSession({ items: validServerHarvests(data), expiresAt: data.expiresAt, credential });
      } catch {
        if (!controller.signal.aborted) setStatus("Lecture indisponible. Réessaie dans un instant.");
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    };
    void loadGoogleIdentity().then(identity => {
      if (!controller.signal.aborted && button.current) {
        identity.renderButton(button.current, { theme: "outline", size: "large", text: "signin_with", locale: "fr" });
      }
    }).catch(() => {
      if (!controller.signal.aborted) setStatus("Connexion Google indisponible. Recharge la page pour réessayer.");
    });
    return () => {
      controller.abort();
      receiveGoogleCredential = undefined;
    };
  }, [session]);

  const items = session?.items.filter(item => item.capability !== "candidature.draft") ?? null;
  const candidatures = session?.items.filter(item => item.capability === "candidature.draft" && item.parcelId === "benoit-career") ?? [];
  return (
    <section className="pf-card" aria-label="Récoltes privées du serveur">
      <h2 className="pf-harvest-title">Récoltes privées du serveur</h2>
      {items === null && <p className="pf-meta">Connecte-toi pour ouvrir tes récoltes et la parcelle Candidatures.</p>}
      {items === null ? (
        <>
          <div ref={button} hidden={pending} />
          {pending && <p className="pf-meta" role="status">Chargement des récoltes…</p>}
          {status && <p className="pf-meta" role="status">{status}</p>}
        </>
      ) : (
        <>
          <p className="pf-meta">{items.length} récolte(s) récente(s) du serveur</p>
          <button className="pf-btn" type="button" onClick={() => setSession(null)}>Fermer l’accès aux récoltes</button>
          <section className="pf-card" aria-label="Parcelle Candidatures" style={{ marginTop: 8 }}>
            <h3 className="pf-harvest-title">Candidatures</h3>
            <p className="pf-meta">Brouillons à relire · Envoi après validation</p>
            {candidatures.length === 0 && <p>Aucun brouillon issu d’une offre vérifiée pour le moment.</p>}
            {session && candidatures.map(item => <CandidatureCard key={item.harvestId} item={item} credential={session.credential} />)}
          </section>
          {items.map((item) => <details key={item.harvestId} className="pf-card" style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer" }}><strong>{item.title}</strong><p className="pf-meta">{item.harvestedAt ? new Date(item.harvestedAt).toLocaleString("fr-FR") : ""} · {parcelLabel(item.parcelId)} · {item.state}</p></summary>
            {/(?:prospection|investigate-contact|score probant)/i.test(item.content) && extractProspects(item.content).length ? <ProspectHarvest item={item} /> : <ReadableHarvest content={item.content} />}
            {/\[(?:[^\]]*à confirmer|URL[^\]]*)\]|\[lien[^\]]*\]/i.test(item.content) ? <p className="pf-meta" role="note">⚠️ Ce document contient encore des liens ou informations à compléter avant utilisation.</p> : null}
            <HarvestActions actions={[{ label: "Copier le texte propre", onClick: () => copy(plainHarvestText(item.content)) }, { label: "Télécharger .md", onClick: () => download("recolte.md", item.content, "text/markdown;charset=utf-8") }]} />
          </details>)}
        </>
      )}
    </section>
  );
}

export function HarvestScreen({ bundle, onBackToGerard }: { bundle: HarvestBundle | null; onBackToGerard: () => void }) {
  const readAccess = () => window.PoulpeAccess?.snapshot?.();
  const [access, setAccess] = useState(readAccess);
  const ownerView = access?.mode === "owner";
  const visibleParcelId = typeof access?.parcelId === "string" ? access.parcelId.trim() : "";
  const visibleHarvests = () => restoreAllGardenHarvests().filter((item) => !visibleParcelId || item.intent.parcelId === visibleParcelId);
  const [stored, setStored] = useState<HarvestBundle[]>(visibleHarvests);
  const [view, setView] = useState<"recent" | "projects" | "archive">("recent");
  useEffect(() => {
    const refresh = () => setAccess(readAccess());
    window.addEventListener("poulpe-access-changed", refresh);
    return () => window.removeEventListener("poulpe-access-changed", refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setStored(visibleHarvests());
    refresh();
    window.addEventListener("poulpe-github-harvest", refresh);
    window.addEventListener("poulpe-garden-changed", refresh);
    return () => {
      window.removeEventListener("poulpe-github-harvest", refresh);
      window.removeEventListener("poulpe-garden-changed", refresh);
    };
  }, [visibleParcelId]);

  const harvests = useMemo(() => {
    const scopedBundle = bundle && (!visibleParcelId || bundle.intent.parcelId === visibleParcelId) ? bundle : null;
    const scopedStored = stored.filter((item) => !visibleParcelId || item.intent.parcelId === visibleParcelId);
    const all = scopedBundle ? [scopedBundle, ...scopedStored] : scopedStored;
    const seen = new Set<string>();
    const unique = all.filter((item) => {
      if (!item || seen.has(item.missionId)) return false;
      seen.add(item.missionId);
      return true;
    });
    return unique.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [bundle, stored, visibleParcelId]);

  const groups = useMemo(() => {
    const byParcel = new Map<string, HarvestBundle[]>();
    for (const item of harvests) {
      const key = item.intent.parcelId || "sans-parcelle";
      const list = byParcel.get(key) ?? [];
      list.push(item);
      byParcel.set(key, list);
    }
    return [...byParcel.entries()];
  }, [harvests]);

  const gerardPicks = useMemo(() => harvests.filter((item) => item.harvest.kind === "publication-pack").slice(0, GERARD_LIMIT), [harvests]);
  const projectLatest = useMemo(() => groups.map(([parcelId, items]) => [parcelId, items[0]] as const).filter((entry) => Boolean(entry[1])).sort((left, right) => new Date(right[1].createdAt).getTime() - new Date(left[1].createdAt).getTime()), [groups]);
  const latestHarvests = useMemo(() => harvests.slice(0, LATEST_LIMIT), [harvests]);

  if (!harvests.length && !ownerView) {
    return <section className="pf-card"><div className="pf-empty"><h2>Pas encore de récolte</h2><p>Gérard n’affiche rien de fictif. Les vraies récoltes apparaîtront ici lorsqu’elles seront prêtes.</p><button className="pf-btn pf-btn-primary" onClick={onBackToGerard}>Confier une culture</button></div></section>;
  }

  return (
    <section className="pf-harvest-library" aria-label="Bibliothèque des récoltes">
      {ownerView && <PrivateHarvests />}
      <div className="pf-library-summary"><strong>{harvests.length}</strong><span>récoltes</span><i /> <strong>{groups.length}</strong><span>projets</span></div>
      <nav className="pf-library-tabs" aria-label="Vues des récoltes">
        <button type="button" data-active={view === "recent"} onClick={() => setView("recent")}>Récentes</button>
        <button type="button" data-active={view === "projects"} onClick={() => setView("projects")}>Par projet</button>
        <button type="button" data-active={view === "archive"} onClick={() => setView("archive")}>Archives</button>
      </nav>
      {view === "recent" && gerardPicks.length ? <section aria-label="Propositions de Gérard" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="pf-card"><div className="pf-harvest-heading"><div><h2 className="pf-harvest-title">Propositions de Gérard</h2><p className="pf-meta">{gerardPicks.length} publication{gerardPicks.length > 1 ? "s" : ""} prête{gerardPicks.length > 1 ? "s" : ""} à relire</p></div></div></div>
        {gerardPicks.map((item, index) => <HarvestCard key={item.missionId} bundle={item} initiallyOpen={index === 0} />)}
      </section> : null}
      {view === "projects" && projectLatest.length ? <section aria-label="Dernière récolte par projet" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="pf-card"><div className="pf-harvest-heading"><div><h2 className="pf-harvest-title">Dernière récolte par projet</h2><p className="pf-meta">{projectLatest.length} projet{projectLatest.length > 1 ? "s" : ""} · un aperçu de chaque parcelle</p></div></div></div>
        {projectLatest.map(([parcelId, item]) => <HarvestCard key={`project-latest-${parcelId}-${item.missionId}`} bundle={item} showParcel />)}
      </section> : null}
      {view === "recent" ? <section aria-label="Dernières récoltes" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="pf-card"><div className="pf-harvest-heading"><div><h2 className="pf-harvest-title">Dernières récoltes</h2><p className="pf-meta">{latestHarvests.length} récolte{latestHarvests.length > 1 ? "s" : ""} les plus récentes</p></div></div></div>
        {latestHarvests.map((item) => <HarvestCard key={item.missionId} bundle={item} />)}
      </section> : null}
      {view === "archive" ? <ArchiveByParcel groups={groups} /> : null}
    </section>
  );
}
