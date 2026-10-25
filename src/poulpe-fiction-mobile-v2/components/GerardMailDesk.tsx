import { useEffect, useState } from "react";

const PROFILE_KEY = "poulpe-fiction:gerard:mail-profile:v1";
const OUTBOX_URL = "https://raw.githubusercontent.com/benoitlub/poulpe-fiction/main/garden/gerard-mail-outbox.json";
const GITHUB_VARIABLES_URL = "https://github.com/benoitlub/poulpe-fiction/settings/variables/actions";

type MailIdentity = "poulpe-fiction" | "pro-hibited" | "blacklace" | "benoit-lubert";
type MailProfile = { senderEmail: string; identity: MailIdentity; replyTo: string };
type Draft = { id: string; organization: string; brandId: string; subject: string; body: string;
  sourceUrl: string; status: string; recipientEmail: string | null };

const identities: Array<{ id: MailIdentity; name: string }> = [
  { id: "poulpe-fiction", name: "Poulpe Fiction" },
  { id: "pro-hibited", name: "Pro.Hibited" },
  { id: "blacklace", name: "Blacklace" },
  { id: "benoit-lubert", name: "Benoît Lubert" },
];

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;

export function GerardMailDesk() {
  const [profile, setProfile] = useState<MailProfile>({ senderEmail: "", replyTo: "", identity: "poulpe-fiction" });
  const [saved, setSaved] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [outboxMessage, setOutboxMessage] = useState("Chargement des propositions…");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
      if (stored && typeof stored.senderEmail === "string" &&
        identities.some(identity => identity.id === stored.identity)) {
        setProfile({ senderEmail: stored.senderEmail, replyTo: String(stored.replyTo || ""), identity: stored.identity });
        setSaved(true);
      }
    } catch { /* private browsing or invalid saved value */ }
    void fetch(OUTBOX_URL, { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Aucune boîte de propositions publiée pour le moment.");
      const data = await response.json();
      const items = Array.isArray(data.drafts) ? data.drafts.filter((item: Draft) => item && typeof item.id === "string") : [];
      setDrafts(items.slice(-12).reverse());
      setOutboxMessage(items.length ? "Propositions préparées : aucun envoi automatique." : "Aucune proposition pour le moment.");
    }).catch(() => setOutboxMessage("La boîte de propositions n'est pas encore disponible."));
  }, []);

  const canSave = validEmail(profile.senderEmail.trim()) && (!profile.replyTo.trim() || validEmail(profile.replyTo.trim()));
  const save = () => {
    if (!canSave) return;
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); setSaved(true); }
    catch { setSaved(false); }
  };
  const copyVariable = async () => {
    if (!canSave) return;
    try { await navigator.clipboard.writeText(profile.senderEmail.trim()); }
    catch { /* clipboard unavailable; the field remains selectable */ }
  };

  return <section className="pf-card">
    <div className="pf-section-heading"><span>✉</span><div><strong>Bureau e-mail de Gérard</strong><small>Identité, adresse professionnelle et propositions B2B</small></div></div>
    <button type="button" className="pf-btn pf-btn-soft" onClick={() => setOpen(value => !value)}>{open ? "Masquer les réglages" : "Configurer son adresse et voir les propositions"}</button>
    {open ? <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
      <label className="pf-field-label" htmlFor="gerard-mail-identity">Gérard représente</label>
      <select id="gerard-mail-identity" className="pf-input" value={profile.identity} onChange={event => { setProfile({ ...profile, identity: event.target.value as MailIdentity }); setSaved(false); }}>
        {identities.map(identity => <option key={identity.id} value={identity.id}>{identity.name}</option>)}
      </select>
      <label className="pf-field-label" htmlFor="gerard-sender-email">Son adresse d'expédition</label>
      <input id="gerard-sender-email" className="pf-input" type="email" autoComplete="email" placeholder="gerard@votre-domaine.fr" value={profile.senderEmail} onChange={event => { setProfile({ ...profile, senderEmail: event.target.value }); setSaved(false); }} />
      <label className="pf-field-label" htmlFor="gerard-reply-to">Adresse de réponse (facultative)</label>
      <input id="gerard-reply-to" className="pf-input" type="email" placeholder="benoit@votre-domaine.fr" value={profile.replyTo} onChange={event => { setProfile({ ...profile, replyTo: event.target.value }); setSaved(false); }} />
      <button type="button" className="pf-btn pf-btn-primary" disabled={!canSave} onClick={save}>Enregistrer sur cet appareil</button>
      <p className="pf-meta" role="status">{saved ? "✓ Profil sauvegardé localement." : "Renseigne une adresse valide pour sauvegarder."} La sauvegarde locale ne configure pas l'envoi depuis GitHub.</p>
      <div className="pf-live-alert"><strong>Activation du compte d'envoi — désactivée</strong><span>Pour synchroniser l'adresse avec Gérard côté GitHub, crée la variable de dépôt <code>GERARD_SENDER_EMAIL</code> et colle l'adresse ci-dessus. Une connexion authentifiée au fournisseur e-mail sera également nécessaire. Ne colle jamais de mot de passe dans cette page ou dans une variable publique.</span></div>
      <div className="pf-actions-row"><button type="button" className="pf-btn pf-btn-soft" disabled={!canSave} onClick={() => void copyVariable()}>Copier l'adresse</button><a className="pf-btn pf-btn-soft" href={GITHUB_VARIABLES_URL} target="_blank" rel="noopener noreferrer">Configurer GitHub</a></div>
      <div className="pf-section-heading"><span>📬</span><div><strong>Propositions préparées</strong><small>{outboxMessage}</small></div></div>
      {drafts.map(draft => <details key={draft.id} className="pf-contact-card"><summary><strong>{draft.organization}</strong> · {draft.status}</summary><p className="pf-meta">{draft.subject}</p><p className="pf-caption" style={{ whiteSpace: "pre-wrap" }}>{draft.body}</p><a href={draft.sourceUrl} target="_blank" rel="noopener noreferrer">Voir la source</a><p className="pf-meta">Destinataire à vérifier · Aucun message envoyé.</p></details>)}
    </div> : null}
  </section>;
}
