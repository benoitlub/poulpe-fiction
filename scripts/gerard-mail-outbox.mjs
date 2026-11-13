export const GERARD_SENDER_EMAIL = "gerardpoulpefiction@gmail.com";

export const MAIL_BRANDS = Object.freeze({
  'poulpe-fiction': 'Poulpe Fiction',
  'pro-hibited': 'Pro.Hibited',
  blacklace: 'Blacklace',
  'benoit-lubert': 'Benoît Lubert',
});

export function createMailDrafts(sources, { parcelId = 'benoit-business-growth', profile = 'pro-hibited' } = {}) {
  const onlyFeuch = profile === 'onlyfeuch';
  return sources.filter(source => source?.verification === 'page-read' &&
    source.qualification === 'priority-review' && source.fitScore >= 70)
    .slice(0, 5).map(source => {
      const domain = new URL(source.url).hostname;
      const recipientEmail = source.contactEmail || null;
      const common = {
        id: `${parcelId}:${domain}`, parcelId,
        organization: source.title, sourceUrl: source.url,
        recipientEmail, senderEmail: GERARD_SENDER_EMAIL,
        evidence: String(source.evidence || '').slice(0, 280),
        status: recipientEmail ? 'ready-for-review' : 'awaiting-published-recipient',
        sentAt: null, contacted: false,
      };
      if (onlyFeuch) return {
        ...common,
        brandId: 'onlyfeuch',
        subject: 'OnlyFeuch · accompagnement créatif pour créatrices',
        body: `Bonjour,\n\nJe suis Gérard, assistant de l’agence créative OnlyFeuch, portée par Benoît Lubert.\n\nNous développons un accompagnement destiné aux créatrices adultes qui souhaitent structurer leur univers, leur contenu et leur organisation sans promesse de revenu ni gestion imposée de leur compte.\n\nVotre profil nous semble pouvoir correspondre à cette approche. Si le sujet vous intéresse, je peux vous envoyer une présentation courte de l’accompagnement et vous laisser décider librement si vous souhaitez échanger.\n\nBien cordialement,\nGérard\nPour OnlyFeuch — Benoît Lubert`,
      };
      return {
        ...common,
        brandId: 'pro-hibited',
        subject: 'Une proposition de collaboration autour de jeux originaux',
        body: `Bonjour,\n\nJe suis Gérard, assistant commercial numérique de Pro.Hibited, mandaté par Benoît Lubert.\n\nNous développons des jeux de cartes et des expériences ludiques. Votre activité pourrait offrir un terrain de collaboration intéressant. Seriez-vous la bonne personne pour discuter de la présentation de nos jeux, ou pourriez-vous m’indiquer votre procédure de soumission ?\n\nMerci pour votre attention,\nGérard\nPour Benoît Lubert — Pro.Hibited`,
      };
    });
}

export function mergeMailDrafts(previous = [], incoming = []) {
  const byId = new Map(previous.map(item => [item.id, item]));
  for (const item of incoming) {
    const existing = byId.get(item.id);
    // Preserve any sent or attempted draft; fill missing verified recipient and sender only on pending drafts.
    if (existing && !existing.sentAt && !existing.contacted && (!existing.senderEmail || existing.senderEmail === "gerard.poulpe-fiction@gmail.com"))
      byId.set(item.id, { ...existing, senderEmail: GERARD_SENDER_EMAIL });
    else if (existing && !existing.sentAt && !existing.contacted && !existing.recipientEmail && item.recipientEmail &&
      !["sending", "unknown", "sent"].includes(existing.status))
      byId.set(item.id, { ...existing, recipientEmail: item.recipientEmail, status: "ready-for-autonomous-send" });
    else if (!existing) byId.set(item.id, item);
  }
  return [...byId.values()].slice(-100);
}
