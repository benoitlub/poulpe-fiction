export const MAIL_BRANDS = Object.freeze({
  'poulpe-fiction': 'Poulpe Fiction',
  'pro-hibited': 'Pro.Hibited',
  blacklace: 'Blacklace',
  'benoit-lubert': 'Benoît Lubert',
});

export function createMailDrafts(sources, { parcelId = 'benoit-business-growth' } = {}) {
  return sources.filter(source => source?.verification === 'page-read' &&
    source.qualification === 'priority-review' && source.fitScore >= 70)
    .slice(0, 5).map(source => {
      const domain = new URL(source.url).hostname;
      return {
        id: `${parcelId}:${domain}`, parcelId, brandId: 'pro-hibited',
        organization: source.title, sourceUrl: source.url,
        recipientEmail: null, senderEmail: null,
        subject: 'Une proposition de collaboration autour de jeux originaux',
        body: `Bonjour,\n\nJe suis Gérard, assistant commercial numérique de Pro.Hibited, mandaté par Benoît Lubert.\n\nNous développons des jeux de cartes et des expériences ludiques. Votre activité pourrait offrir un terrain de collaboration intéressant. Seriez-vous la bonne personne pour discuter de la présentation de nos jeux, ou pourriez-vous m’indiquer votre procédure de soumission ?\n\nMerci pour votre attention,\nGérard\nPour Benoît Lubert — Pro.Hibited`,
        evidence: String(source.evidence || '').slice(0, 280),
        status: 'awaiting-verified-recipient-and-sender', sentAt: null, contacted: false,
      };
    });
}

export function mergeMailDrafts(previous = [], incoming = []) {
  const byId = new Map(previous.map(item => [item.id, item]));
  for (const item of incoming) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()].slice(-100);
}
