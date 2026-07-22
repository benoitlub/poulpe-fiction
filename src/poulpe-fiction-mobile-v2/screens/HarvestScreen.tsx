import { useEffect, useMemo, useState } from "react";
import "../styles/html-harvest.css";
import { HarvestActions } from "../components/HarvestActions";
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

function HarvestCard({ bundle, initiallyOpen = false }: { bundle: HarvestBundle; initiallyOpen?: boolean }) {
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
          <p className="pf-meta">{new Date(bundle.createdAt).toLocaleString("fr-FR")} · {bundle.intent.parcelId}</p>
        </div>
        <span className="pf-harvest-status" data-status={harvest.status}>{open ? "Fermer" : STATUS_LABEL[harvest.status]}</span>
      </button>
      {open ? <>
        {bundle.editorialSource ? <p className="pf-meta">Source éditable Notion{bundle.editorialSource.lastSyncedAt ? ` · synchronisée le ${new Date(bundle.editorialSource.lastSyncedAt).toLocaleString("fr-FR")}` : ""}</p> : null}
        {harvest.kind === "visual" ? <><div className="pf-visual-preview"><img src={harvest.previewUrl} alt={harvest.title} /></div><div className="pf-caption">{harvest.caption}</div><div className="pf-meta">{harvest.format} · {harvest.dimensions}</div><HarvestActions actions={[...editAction, { label: "Copier le texte", onClick: () => copy(harvest.caption) }, { label: "Télécharger", primary: !editAction.length, onClick: () => window.open(harvest.downloadUrl ?? harvest.previewUrl, "_blank") }]} /></> : null}
        {harvest.kind === "contact-list" ? <><p className="pf-summary">{harvest.summary}</p>{harvest.contacts.map((contact) => <div key={`${contact.name}-${contact.organization}`} className="pf-contact-card"><div className="pf-contact-name">{contact.name}</div><div className="pf-contact-role">{contact.role} · {contact.organization}</div><div className="pf-contact-line">Ciblage : {contact.reason}</div><div className="pf-contact-line">Source : {contact.source}</div><div className="pf-contact-line">Contact : {contact.contact}</div><div className="pf-contact-line">Statut : {contact.status}</div></div>)}<HarvestActions actions={[...editAction, { label: "Exporter CSV", primary: !editAction.length, onClick: () => { const header = "Nom,Rôle,Organisation,Ciblage,Source,Contact,Statut\n"; const rows = harvest.contacts.map((contact) => [contact.name, contact.role, contact.organization, contact.reason, contact.source, contact.contact, contact.status].map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n"); download("contacts.csv", header + rows, "text/csv"); } }, { label: "Copier la liste", onClick: () => copy(harvest.contacts.map((contact) => `${contact.name} — ${contact.role} (${contact.contact})`).join("\n")) }]} /></> : null}
        {harvest.kind === "landing" ? <><iframe className="pf-html-harvest" title={harvest.title} srcDoc={harvest.html} sandbox="allow-popups allow-popups-to-escape-sandbox" /><div className="pf-caption">{harvest.copy}</div><HarvestActions actions={[...editAction, { label: "Ouvrir l’aperçu HTML", onClick: () => openHtml(harvest.html) }, { label: "Copier le texte", onClick: () => copy(harvest.copy) }, { label: "Télécharger HTML", primary: !editAction.length, onClick: () => download("recolte.html", harvest.html, "text/html;charset=utf-8") }]} /></> : null}
        {harvest.kind === "text" ? <><div className="pf-caption">{harvest.body}</div><HarvestActions actions={[...editAction, { label: "Copier", primary: !editAction.length, onClick: () => copy(harvest.body) }]} /></> : null}
      </> : null}
    </article>
  );
}

export function HarvestScreen({ bundle, onBackToGerard }: { bundle: HarvestBundle | null; onBackToGerard: () => void }) {
  const [stored, setStored] = useState<HarvestBundle[]>(() => restoreAllGardenHarvests());

  useEffect(() => {
    const refresh = () => setStored(restoreAllGardenHarvests());
    refresh();
    window.addEventListener("poulpe-github-harvest", refresh);
    window.addEventListener("poulpe-garden-changed", refresh);
    return () => {
      window.removeEventListener("poulpe-github-harvest", refresh);
      window.removeEventListener("poulpe-garden-changed", refresh);
    };
  }, []);

  const harvests = useMemo(() => {
    const all = bundle ? [bundle, ...stored] : stored;
    const seen = new Set<string>();
    return all.filter((item) => {
      if (!item || seen.has(item.missionId)) return false;
      seen.add(item.missionId);
      return true;
    });
  }, [bundle, stored]);

  if (!harvests.length) {
    return <section className="pf-card"><div className="pf-empty"><h2>Pas encore de récolte</h2><p>Gérard n’affiche rien de fictif. Les vraies récoltes apparaîtront ici lorsqu’elles seront prêtes.</p><button className="pf-btn pf-btn-primary" onClick={onBackToGerard}>Confier une culture</button></div></section>;
  }

  return (
    <section aria-label="Toutes les récoltes">
      <div className="pf-card"><div className="pf-harvest-heading"><div><h2 className="pf-harvest-title">Toutes les récoltes</h2><p className="pf-meta">{harvests.length} récolte{harvests.length > 1 ? "s" : ""} conservée{harvests.length > 1 ? "s" : ""} dans le Garden</p></div></div></div>
      {harvests.map((item, index) => <HarvestCard key={item.missionId} bundle={item} initiallyOpen={index === 0} />)}
    </section>
  );
}
