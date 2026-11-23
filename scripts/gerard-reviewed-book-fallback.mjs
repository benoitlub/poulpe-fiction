/** Grounded recovery copy: existing book account, covers and provider safeguards. */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const BOOKS = [
  {
    seedId: 'terra', title: 'TERRA',
    source: 'https://app.notion.com/p/TERRA-38739119725381d68ecefd85494ebd6e',
    mediaUrl: 'https://raw.githubusercontent.com/benoitlub/blacklace-publisher-ai/main/public/media/books/terra/1000045325.jpg',
    text: 'Un monde tient dans un livre. Mais qu’en faisons-nous quand vient le moment de le transmettre ?\n\nTERRA, une fable cosmique de Benoît Lubert sur l’observation, l’enfance et les mondes que l’on confie à ceux qui viennent après nous.\n\n📖 https://www.amazon.fr/dp/B0H4CN5MSH',
  },
  {
    seedId: 'gerard-et-gerard', title: 'Gérard & Gérard',
    source: 'https://www.amazon.fr/dp/B0H68811RL',
    mediaUrl: 'https://raw.githubusercontent.com/benoitlub/blacklace-publisher-ai/main/public/media/books/Gerard_et_Gerard_couverture_retouchee.jpg',
    text: 'La salle de sport : cet endroit où les humains courent pour rester au même endroit. Vu de l’espace, il y a de quoi s’interroger.\n\nGérard & Gérard — Brèves histoires d’une simulation oubliée, de Benoît Lubert. Deux regards extraterrestres sur nos habitudes terriennes.\n\n📖 https://www.amazon.fr/dp/B0H68811RL',
  },
];
const confirmed = item => ['confirmed-scheduled', 'confirmed-published'].includes(item?.status) &&
  typeof item.postId === 'string' && Boolean(item.postId.trim());

export function reviewedBookCandidate(history = []) {
  const book = BOOKS.find(book => !history.some(item => confirmed(item) &&
    (item.harvestId === `gerard-reviewed-${book.seedId}-20261123` ||
      (item.copyText === book.text && item.mediaUrl === book.mediaUrl))));
  if (!book) return null;
  return {
    status: 'ready', harvestId: `gerard-reviewed-${book.seedId}-20261123`,
    seedId: book.seedId, title: book.title,
    copy: {text: book.text, strategy: 'reviewed-book-recovery'},
    media: {url: book.mediaUrl, direct: true, official: true},
    compatibleNetworks: ['instagram'],
    editorialRoute: {topic: 'book', destination: {preferredProvider: 'buffer', preferredAccount: 'benoitlubert'}},
    transport: {provider: 'buffer', draftOnly: true},
    provenance: {source: book.source, kind: 'grounded-editorial-recovery', generated: false},
    action: 'hold-for-buffer-draft', delivery: {status: 'not-attempted', publishingEnabled: false},
  };
}

export async function prepareReviewedBook(history, {fetchImpl = fetch, publisherUrl = process.env.PUBLISHER_URL} = {}) {
  const candidate = reviewedBookCandidate(history);
  if (!candidate) return null;
  const base = new URL(publisherUrl);
  if (base.protocol !== 'https:') throw Error('publisher-https-required');
  const response = await fetchImpl(new URL('/api/social/transports/buffer/book-preflight', base), {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({seedId: candidate.seedId, title: candidate.title, text: candidate.copy.text}),
    signal: AbortSignal.timeout(20000),
  });
  const check = await response.json();
  if (!response.ok || check.status !== 'ready-for-controlled-test' || check.topic !== 'book' ||
    check.channelId !== '6ac8c8226a5c39ccb65fdbf6') throw Error('reviewed-book-preflight-unavailable');
  return {...candidate, transport: {...candidate.transport, channelId: check.channelId}, bufferPreflight: check};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    let history = [];
    try { history = JSON.parse(await readFile('garden/gerard-buffer-confirmed-history.json', 'utf8')); }
    catch (error) {if (error.code !== 'ENOENT') throw error;}
    if (!Array.isArray(history)) throw Error('invalid-confirmed-book-history');
    const candidate = await prepareReviewedBook(history);
    if (!candidate) {console.log(JSON.stringify({reviewedBookRecovery: 'exhausted'}));process.exitCode = 1;}
    else {
      await writeFile('garden/next-social-publication.json', JSON.stringify(candidate, null, 2) + '\n');
      console.log(JSON.stringify({reviewedBookRecovery: 'ready', seedId: candidate.seedId, published: false}));
    }
  } catch (error) {
    console.log(JSON.stringify({reviewedBookRecovery: 'unavailable', reason: error.message, published: false}));
    process.exitCode = 1;
  }
}
