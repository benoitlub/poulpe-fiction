# ADR-001 — Boucle d'apprentissage vérifiable, inspirée des principes Ruflo
Date : 2026-11-11
Statut : proposée — prototype isolé, non déployé
Décideur : Benoît ; implémentation soumise à revue

## Contexte
Poulpe Fiction dispose d'Octopus, Gérard, Publisher, de workflows GitHub Actions, d'une mémoire privée PostgreSQL et de mécanismes d'observation. Le code actuel sait conserver des observations mais ne démontre pas systématiquement leur influence sur la décision suivante. Une exécution du 7 novembre 2026 (42347307533) s'est terminée par `studio-production-blocked`. Le projet Ruflo/Claude Flow montre des patterns intéressants (orchestration, hooks, mémoire, adaptation), sans justifier l'importation de son framework.

## Décision
Conserver l'architecture existante et introduire progressivement une boucle **décider → exécuter → observer → évaluer → mémoriser → adapter** avec preuves traçables. Aucun nouveau swarm, serveur permanent, secret ou dépendance. Les décisions restent sous contrôle des permissions existantes.

### Contrat d'événements minimal
Chaque événement comporte `eventId`, `cycleId`, `parcelId`, `kind`, `at`, `payload`. Les événements sont append-only, dédupliqués par `eventId`, séparés par `parcelId`. Ne jamais mettre de secrets, coordonnées privées, brouillons sensibles ni tokens dans les événements. Identifiants de transport conservés séparément si nécessaire.

### Hooks
- `before-decision` : consulter les leçons pertinentes de la même parcelle ; enregistrer les IDs utilisés.
- `after-delivery` : enregistrer le résultat vérifié du transport (ou l'absence de preuve), sans confondre transport accepté et publication.
- `after-metrics` : joindre les métriques fournisseur attribuables par identifiant explicite, pas par ressemblance de texte.
- `before-next-decision` : générer des contraintes/recommandations explicables ; conserver le choix initial et le choix adapté.
- Échec d'un hook : journaliser sans publier automatiquement ni inventer de mesure.

### Mémoire
PostgreSQL privé demeure source de vérité. Le prototype local utilise un état injecté, sans accès DB. Indexation vectorielle facultative **uniquement après** mesure d'un besoin de recherche sémantique ; aucun stockage externe automatique. Chaque leçon a provenance, confiance, contexte et date ; une observation manquante n'est pas un échec d'audience.

### Adaptation
D'abord des règles déterministes et auditables : transport bloqué → diagnostiquer le canal ; métriques absentes → attendre la mesure ; répétition d'un contenu → tester un autre angle ; performance attribuée et comparable → proposer un essai contrôlé. Aucun classement de performance sans taille d'échantillon, métriques comparables et attribution vérifiée. Aucun changement autonome de code, budget, diffusion ou permissions.

### Validation
Deux cycles de test : le premier enregistre un échec de transport, le second doit consulter cette leçon et proposer de réparer le canal avant une nouvelle publication. Tests de non-régression : isolation par parcelle, idempotence, absence de fausse publication, données insuffisantes, persistance entre cycles. Un test unitaire ne prouve pas le fonctionnement réel des services.

### Phases
1. Prototype pur et tests (cette PR) : aucune intégration runtime.
2. Audit des points d'insertion dans `gerard-cycle.mjs`, `gerard-learning-cycle.mjs` et stockage privé ; validation des schémas.
3. Adaptateur d'événements et persistance atomique, avec reprise après interruption et migration non destructive.
4. Mode observation en production, métriques et journaux consultables.
5. Activation contrôlée de l'adaptation après comparaison A/B et validation humaine.
6. Option : évaluer Ruflo isolément, notamment sécurité, coûts, compatibilité et rollback ; voir issue #215.

### Critères de succès
Une décision future cite une leçon d'un cycle antérieur et change de stratégie de manière justifiée ; la mesure de performance et l'effet commercial restent séparés. Montrer des traces d'exécution réelles avant de conclure « autonome ».

### Alternatives rejetées
Installer Ruflo immédiatement ; ajouter une armée d'agents ; réécrire le moteur ; activer des boucles de publication sans preuve ; assimiler tests verts et succès commerciaux.

### Risques et retour arrière
Risques : données non attribuées, boucle auto-renforçante, duplication, fuite inter-parcelles, régression de publication. Réponse : provenance, déduplication, limites de confiance, feature flag, stockage privé et rollback par désactivation du hook. Aucun déploiement ni modification des programmations dans cette PR.
