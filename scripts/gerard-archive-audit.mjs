// Audit non destructif des capacités d'archivage, sans récupération de médias ni publication.
import { execFileSync } from 'node:child_process';
const repo = process.env.GH_REPO;
const issue = Number(process.env.ISSUE_NUMBER || 247);
if (!Number.isSafeInteger(issue) || issue < 1) throw new Error('Invalid issue number');
function gh(...args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 });
}
const mission = JSON.parse(gh('api', `repos/${repo}/issues/${issue}`));
if (issue !== 247 && !/audit.*archive|archive.*audit/i.test(mission.title)) {
  throw new Error('Mission not an archive audit; no action taken');
}
const targets = ['benoitlub/poulpe-fiction', 'benoitlub/blacklace-publisher-ai'];
const patterns = /instagram|uncove|metricool|media|archive|catalog|notion|takeout|studio/i;
const lines = [
  `### Diagnostic automatisé — mission #${issue}`,
  '',
  'Audit des fichiers présents sur les branches principales (lecture seule). Aucun compte Instagram ou Uncove consulté, aucun média téléchargé.',
  ''
];
for (const target of targets) {
  try {
    const meta = JSON.parse(gh('api', `repos/${target}`));
    const tree = JSON.parse(gh('api', `repos/${target}/git/trees/${encodeURIComponent(meta.default_branch)}?recursive=1`));
    const matches = (tree.tree || []).filter(f => f.type === 'blob' && patterns.test(f.path) && !/node_modules|lock|\.png$|\.jpg$|\.mp4$|\.svg$/i.test(f.path)).slice(0, 35);
    lines.push(`#### ${target}`, `Branche : \`${meta.default_branch}\`. Fichiers candidats : ${matches.length}${tree.truncated ? ' (arbre tronqué)' : ''}.`);
    for (const f of matches) lines.push(`- \`${f.path}\``);
    lines.push('');
  } catch (error) {
    lines.push(`#### ${target}`, `Inspection impossible : ${String(error.message).slice(0, 250)}`, '');
  }
}
lines.push('#### Accès et limites', '- Instagram @natasha.pro.hbtd : accès API et droit de récupération **non vérifiés**.', '- Uncove natashablacklace : accès API et droit de récupération **non vérifiés**.', '- Google Takeout sur le PC : inaccessible depuis GitHub Actions sans transfert volontaire.', '- Un nom de fichier candidat ne démontre pas une capacité fonctionnelle : vérifier les implémentations et permissions avant toute collecte.', '- @feuchman et les médias personnels sont hors périmètre.', '', '**Prochaine étape :** revue ciblée des fichiers candidats et essai autorisé sur une publication publique, puis proposition de catalogue Notion. Aucun changement de production.', '', `Run : ${process.env.GITHUB_SERVER_URL}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`);
const body = lines.join('\n');
console.log(body);
gh('issue', 'comment', String(issue), '--repo', repo, '--body', body);
