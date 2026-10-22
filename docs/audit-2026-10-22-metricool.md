# Publication Metricool de Gérard via Octopus — 22 octobre 2026

Ce correctif dépend de #109 (exclusions éditoriales) et du correctif Publisher
basé sur #138. Le [bilan complet](https://github.com/benoitlub/blacklace-publisher-ai/blob/fix/gerard-metricool-execution/docs/audits/2026-10-22-metricool-execution.md)
contient le diagnostic, les limites et la procédure humaine restante.

Gérard transmet désormais sa décision au `/mission` existant d'Octopus avec
`social.publish`, une clé stable par livrable et les réseaux réellement compatibles.
L'adaptateur local Publisher fournit le passage authentifié au Worker. La réponse
revient dans `metricoolHandoff` avec ID, créneau, quota, état et motif du blocage.
Un HTTP 200, une mission terminée ou un ID seul ne devient pas une programmation
confirmée. Un timeout conserve le contenu et la même clé pour sa réconciliation.

Le flag Actions `GERARD_METRICOOL_EXECUTION_ENABLED` vaut `false` par défaut.
Le token est fourni uniquement à Publisher côté serveur. Le Worker exige aussi
son activation indépendante. Aucune valeur de secret/variable n'a été modifiée.
Le cron existant n'a été ni déclenché, arrêté ni modifié en production ; horaires,
déclencheurs, concurrence et autres étapes restent identiques à #109.

Tests exécutés : **93/93** dans `npm test`, build réussi, YAML et syntaxe shell
vérifiés. Les six nouveaux tests vérifient la mission, la clé stable, les réseaux,
le respect du routage Buffer et l'absence de faux succès. Depuis Publisher, deux
tests supplémentaires exécutent ce vrai client, le moteur Octopus déjà installé,
les adaptateurs Publisher et des transports entièrement simulés : Facebook texte,
puis Facebook + Instagram avec image. Pour chaque parcours : une création simulée,
lecture de confirmation et reprise sans deuxième écriture. Aucune création réelle.

Restent humains : revue/fusions manuelles, déploiement distinct, connexion Metricool
du bon utilisateur dans le bon projet Composio, validation du contrat API/quota et
de la persistance, fourniture sécurisée du token, recette en lecture seule, puis
décision explicite d'activation. Le 403 du diagnostic live empêche de certifier ici
la connexion et la consommation réelles ; aucun achat ni upgrade n'a été demandé.
