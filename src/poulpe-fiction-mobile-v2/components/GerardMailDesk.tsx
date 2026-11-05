import { useState } from "react";

const GERARD_SENDER_EMAIL = "gerard.poulpe-fiction@gmail.com";
const MAIL_WORKFLOW_URL = "https://github.com/benoitlub/poulpe-fiction/actions/workflows/gerard-runtime.yml";

export function GerardMailDesk() {
  const [open, setOpen] = useState(false);

  return <section className="pf-card">
    <div className="pf-section-heading">
      <span aria-hidden="true">✉</span>
      <div><strong>Courrier de Gérard</strong><small>Compte d’envoi et suivi</small></div>
    </div>
    <button type="button" className="pf-btn pf-btn-soft" aria-expanded={open} aria-controls="gerard-mail-details"
      onClick={() => setOpen(value => !value)}>
      {open ? "Masquer le suivi" : "Voir le suivi du courrier"}
    </button>
    {open && <div id="gerard-mail-details" style={{ display: "grid", gap: 12, marginTop: 16 }}>
      <div>
        <strong>Adresse d’envoi</strong>
        <p className="pf-meta">{GERARD_SENDER_EMAIL}</p>
      </div>
      <p className="pf-meta">Le tentacule Courrier confie l’envoi à Publisher. Les brouillons et leurs destinataires sont conservés dans sa boîte privée.</p>
      <a className="pf-btn pf-btn-soft" href={MAIL_WORKFLOW_URL} target="_blank" rel="noopener noreferrer">
        Voir les derniers passages du courrier
      </a>
    </div>}
  </section>;
}
