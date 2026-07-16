# Poulpe-Fiction Mobile V2

Cette façade remplace progressivement l'ancienne UX sans recréer Octopus, Publisher, Garden, le moniteur ni l'adaptateur déjà présents.

## Source de vérité client

L'accès client fournit le contexte minimal et présente la cliente à Gérard :

- `clientId`
- `parcelId`
- `displayName`
- `activity`

Exemple : Yael est courtière en prêts immobiliers, spécialiste de la recherche des meilleurs taux. L'interface ne doit jamais réinventer son activité.

## Conversation progressive

Le client ne remplit pas un dossier complet au démarrage. Une parcelle minimale suffit. Lorsque le moteur a besoin d'une information supplémentaire, il renvoie `needs-input` et une `RuntimeQuestion`. Gérard l'affiche, transmet la réponse par l'adaptateur existant, puis la mission reprend.

## Limites strictes

Cette couche ne doit pas :

- créer un second adaptateur ou moniteur ;
- implémenter la logique Publisher ↔ Octopus ;
- créer un Knowledge Pack local ;
- stocker des clés API ;
- fabriquer des contacts, récoltes ou données métier ;
- ajouter une nouvelle source de vérité.

Elle doit seulement : recevoir le contexte client, envoyer une intention, afficher les questions du moteur et rendre la récolte exploitable.

## Branche de chantier

`rebuild/mobile-question-flow`

L'ancien frontend reste intact tant que la nouvelle façade n'est pas compilable et vérifiée.