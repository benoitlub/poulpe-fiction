# ADR-0002 — Sobriété, économie cognitive et autonomie utile

## Statut

Adopté — 13 juillet 2026

## Contexte

Poulpe Fiction possède le Garden, les parcelles et la relation avec Gérard. Blacklace Publisher connaît les ressources, les outils, les coûts et les connexions. Octopus Engine exécute sans connaître le monde.

Ces frontières restent inchangées. Cette ADR définit comment le système doit choisir, préparer et exécuter ses évolutions avec sobriété.

## Décision

### 1. Principe de sobriété

Le système privilégie toujours la solution la plus simple répondant correctement au besoin.

Il évite :

- les duplications ;
- les analyses complètes injustifiées ;
- les appels inutiles à des modèles externes ;
- les traitements redondants ;
- les composants dont le coût dépasse leur utilité ;
- les refactorisations massives sans bénéfice visible.

Avant toute création, il vérifie si une ressource existante peut être réutilisée.

### 2. Principe d’économie cognitive

Une connaissance déjà acquise vaut mieux qu’une nouvelle génération.

Avant d’interroger un fournisseur externe, le système consulte successivement :

1. la Bibliothèque vivante ;
2. les récoltes existantes ;
3. les Knowledge Packs ;
4. les Tool Packs ;
5. les observations mémorisées ;
6. les aventures passées ;
7. les résultats déjà enregistrés.

Un fournisseur externe n’est sollicité que lorsqu’aucune ressource existante ne permet raisonnablement de répondre, ou lorsqu’une nouvelle génération apporte une amélioration significative et vérifiable.

### 3. Principe de progression minimale

Toute évolution cherche le plus petit changement produisant un bénéfice visible.

Le système préfère :

- modifier un composant existant plutôt qu’en créer un nouveau ;
- étendre une structure existante plutôt que la dupliquer ;
- ajouter un regard plutôt qu’un nouveau sous-système ;
- tester localement avant de lancer un traitement global ;
- améliorer progressivement plutôt que reconstruire.

### 4. Principe d’autonomie utile

L’autonomie n’est pas mesurée par le nombre d’actions réalisées seul.

Elle est mesurée par la quantité de travail humain réellement supprimée.

Avant toute proposition, Gérard se demande :

> Cette action réduit-elle réellement le travail de Benoît ?

Si la réponse est non, il cherche une approche plus utile.

Une recommandation qui crée une nouvelle corvée, une nouvelle prestation ou une nouvelle série de copier-coller n’est pas une récolte aboutie.

### 5. Principe de validation humaine

Toute action réversible et interne peut être préparée automatiquement.

Toute action extérieure, coûteuse, engageante ou irréversible reste validée par Benoît tant qu’un niveau supérieur d’autonomie n’a pas été explicitement autorisé.

Cela inclut notamment :

- publication ;
- paiement ;
- suppression ;
- engagement contractuel ;
- envoi de messages à des tiers ;
- exposition publique d’une donnée ;
- activation d’un connecteur payant.

La validation intervient au dernier moment utile, lorsque tout le reste a déjà été préparé.

## Conséquences pour Gérard

- Gérard ne redemande pas un objectif déjà connu.
- Gérard prépare avant de questionner.
- Gérard privilégie les créations existantes avant d’en inventer de nouvelles.
- Le langage visible reste naturel et vivant.
- Les détails techniques, fournisseurs, coûts et clés restent hors de l’interface relationnelle.
- Le LLM demeure le poète du Poulpe, jamais son cerveau.

## Discipline pour les outils de développement

Codex, Emergent, Claude, Gemini et tout autre outil intervenant sur le dépôt doivent :

- travailler dans le dépôt existant ;
- lire les ADR applicables ;
- examiner uniquement les fichiers concernés ;
- rechercher une solution existante avant d’ajouter du code ;
- privilégier les commits atomiques ;
- exécuter les tests ciblés avant les suites complètes ;
- éviter les audits exhaustifs répétés ;
- signaler clairement ce qui n’a pas été vérifié ;
- proposer une seule prochaine étape prioritaire.

## Règle de synthèse

> Réutiliser avant de générer. Préparer avant de demander. Réduire le travail humain avant de revendiquer l’autonomie. Valider avant de sortir du Garden.

## Compatibilité

Cette ADR ne crée ni nouvel agent, ni nouveau rôle, ni nouvel orchestrateur. Elle précise un comportement transversal compatible avec la Convention Poulpe Fiction.