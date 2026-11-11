# Pourquoi les mails de Gérard ne devenaient pas des publications

## Preuves réelles

Le [cycle de diffusion 43012041499](https://github.com/benoitlub/poulpe-fiction/actions/runs/43012041499)
a envoyé la proposition SpecTRL (`mail-sent`) sans preuve de programmation.
L’envoi d’un mail restait le chemin de la diffusion.

La PR #228 a depuis ajouté une voie directe dans **Production**, où Octopus et
Publisher sont déjà démarrés. Il ne faut pas reconstruire cette voie ni supposer
qu’elle est absente. Mais le [run Production 43026314689](https://github.com/benoitlub/poulpe-fiction/actions/runs/43026314689)
du 11 novembre 13:07 UTC montre deux blocages :

- `metricoolPreparation: no-draft-prepared`, `publisherFailure: provider-rate-limited` ;
- `GERARD_METRICOOL_DIRECT_EXECUTION_ENABLED: True` puis
  `direct-publishing-disabled` à 13:08:26 UTC.

GitHub accepte la comparaison de `True` à `true` dans le `if`, mais Node utilisait
une comparaison sensible à la casse. La valeur activée dans la configuration
était donc désactivée par le script. La limitation signalée concernait ici la
préparation textuelle ; elle ne prouve aucune génération d’image.

### Actualisation après les correctifs #230 et #231

Les PR #230 et #231 ont depuis été intégrées sur `main` : le repli local sourcé
et ses angles distincts sont conservés dans cette PR. Le conflit de rebase a
été résolu sans retirer ces corrections. Le test de légende vérifie désormais
les trois textes distincts, leur source commune et le même identifiant quand
deux catégories produisent exactement le même texte.

Le [run Production 43064995066](https://github.com/benoitlub/poulpe-fiction/actions/runs/43064995066)
du 11 novembre 17:07 UTC prépare effectivement `blacklace-dice` à 17:08:28 UTC
avec `strategy: local-editorial-sourced`. Le contrôle à blanc renvoie ensuite
`SOURCE_HARVEST_UNAVAILABLE_OR_PRIVATE` à l’étape `provenance`. L’étape directe
termine avec `status: blocked`, `scheduled: false`, `published: false` et
`confirmationRequired: true`. Le reçu est bien conservé dans PostgreSQL
(`changedFiles` contient `gerard-metricool-prepared-receipt.json`, version 120).
Ce run vert ne constitue donc pas une preuve de programmation. Son résumé
direct ne donne pas la raison du blocage ; cette PR conserve cette raison dans
le nouveau reçu. La PR Publisher #208 reste nécessaire et non déployée.

Autres raccordements défaillants vérifiés dans le code :

1. Le workflow ne transmettait pas d’autorisation Metricool au Publisher local.
2. Les légendes locales avaient un identifiant déterministe `gerard-facebook-*`,
   mais aucune ligne source correspondante dans `garden_harvests`. Le finalizer
   devait donc les refuser, même si le transport avait été activé.
3. Tout résultat direct produisait un reçu consommant le candidat, y compris
   un refus temporaire de quota ou d’autorisation.
4. Les mails déjà envoyés étaient comptés comme du contenu consommé sans
   programmation réelle ; la diffusion pouvait continuer à fabriquer des
   propositions distinctes pendant que Production était censé programmer.

## Correction proposée

### Poulpe Fiction

- `scripts/gerard-metricool-publication.mjs` normalise le booléen explicitement
  activé, permet le repli local **sourcé** en préparation et ne confond plus le
  mail envoyé avec la consommation d’une publication en mode direct. Il conserve
  identifiant/date du reçu fournisseur. Quand la voie directe est sélectionnée,
  Production est le propriétaire de la programmation ; le relais Gmail n’est
  plus exécuté comme substitut dans Diffusion. Le mode mail reste disponible
  lorsque la voie directe est désactivée.
- `scripts/gerard-direct-metricool-delivery.mjs` enregistre une légende locale
  exacte, issue des fiches existantes, via `/api/garden/harvests/sync`. Il refuse
  le texte modifié, les médias ajoutés ou une parcelle contradictoire. Le contrôle
  de provenance du Publisher reste intact. Il ne s’agit ni d’une simulation
  présentée comme réelle, ni d’une génération Mistral : c’est une légende locale
  réellement préparée à partir d’une fiche projet.
- Le même script conserve `postId`, date, état, étape et raison. Un refus
  **avant écriture** peut reprendre après temporisation. Une réponse acceptée
  seule, une erreur ambiguë ou une confirmation sans identifiant imposent une
  vérification ; aucune nouvelle tentative aveugle.
- `.github/workflows/gerard-production.yml` garde le `if` explicite d’activation
  ET le contrôle Node. Les runs `candidatures_only` ne programment jamais de
  publication. La préparation utilise le mode local sourcé pour ne pas dépendre
  d’un appel Mistral supplémentaire. La persistance reste exécutée après un
  échec de transport si la restauration privée a réussi.
- `.github/workflows/gerard-runtime.yml` transmet le choix direct à Diffusion
  pour éviter deux contrôleurs concurrents de Metricool. Les étapes Buffer
  existantes ne sont pas modifiées.

### Publisher — correction coordonnée

- Le forwarder Node demande un jeton GitHub OIDC frais juste avant la
  finalisation, uniquement depuis `gerard-production.yml@refs/heads/main`.
  Le jeton reste dans l’en-tête HTTP, jamais dans le contenu de la mission.
  Le secret statique existant, s’il est configuré, reste compatible.
- Le Worker vérifie une audience de publication distincte de Gmail,
  `blacklace-publisher-gerard-production-publish`, la signature GitHub,
  l’expiration, le dépôt, la branche, le workflow et l’événement
  `schedule`/`workflow_dispatch`. Un jeton mail, une PR ou une autre branche
  ne peut pas programmer.
- Le drapeau serveur existant `METRICOOL_PUBLISHING_ENABLED` est déclaré dans
  Wrangler pour permettre cette activation demandée. Le drapeau de dépôt direct
  reste explicitement requis côté runner. Le verrou serveur reste testé et
  effectif lorsqu’il est désactivé. Aucun nouveau secret ou compte.
- La provenance, les médias, les réservations, les doublons, la limite existante
  de 20 unités, la recherche de créneau et la confirmation auprès de Metricool
  sont inchangés. Aucun créneau n’est inventé côté Gérard.

La revue automatique a refusé une tentative de simplification du `if` du
workflow. Cette simplification n’est pas appliquée : le double contrôle
explicite est conservé. Aucun contrôle n’a été supprimé pour contourner ce refus.

## Tests reproductibles — simulations uniquement

```sh
# Poulpe
npm test
node --test tests/gerard-direct-metricool-delivery.test.mjs

# Publisher Worker
npm test
npm run typecheck
```

- **220 tests Poulpe réussis**.
- **159 tests Worker réussis, un test existant ignoré**, contrôle TypeScript réussi.
- Le fichier Node `metricool-forward.ts` a aussi passé un contrôle TypeScript
  autonome avec types Node et DOM.
- `git diff --check` réussi dans les deux dépôts.

Les tests couvrent `True`/`true`, préparation sans fournisseur payant, envoi de la
vraie mission au lieu de Gmail, source enregistrée avant finalisation, refus de
source inventée ou d’une autre parcelle, état programmé avec ID/date, absence de
faux succès sur acceptation seule, quota et reprise, blocage des écritures
incertaines, non-répétition d’une opération confirmée et absence de relais Gmail
concurrent. Les appels réseau des tests sont simulés, y compris Commons.

Les tests OIDC utilisent une clé RSA de fixture et vérifient aussi le véritable
point d’entrée HTTP du Worker : une identité valable passe l’authentification,
mais ne franchit pas le verrou serveur désactivé ni des dépendances absentes.
Aucune clé ou identité réelle n’est enregistrée dans ces tests.

## Limites et validation en réel

Aucun mail, test de publication, crédit IA, secret, compte, budget ou publication
programmée n’a été modifié pendant cette réparation. Aucun nouveau workflow ou
service permanent. Les propositions préparées ne sont pas annoncées comme déjà
programmées.

Après revue et déploiement des **deux** PR, le prochain run Production ordinaire
avec le drapeau direct activé devra enregistrer `confirmed-scheduled`, `postId`
et `publicationDate`, puis la réservation correspondante devra être retrouvée
chez Metricool. Toute erreur d’accès, de quota ou de dépendance reste un blocage
explicite, pas un succès vert déduit du mail. Aucun run live n’a été lancé pour
obtenir artificiellement cette preuve.
