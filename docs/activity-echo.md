# ActivityEcho

ActivityEcho est un composant portable qui affiche l'activite reelle deja presente dans Poulpe Fiction.

## Sources lues

- Seed active via `BlacklaceParcel` ou `GardenStore`.
- Etat runtime via `GardenRuntime.state`.
- `AdventureDraft` prepare ou valide.
- Greffons listes dans l'AdventureDraft.
- Retours d'aventure via `AdventureReturnProcessor.loadOutbox()`.

## Traduction Garden

- Seed active ou retour contenant une seed : `Nouvelle graine repérée`.
- Runtime en actualisation ou activite lue : `Gérard observe`.
- AdventureDraft : `Gérard prépare son sac`.
- Greffon present dans le draft : `Un greffon est consulté`.
- Runtime queued/running : `Une tentative est en cours`.
- Retour contenant une harvest : `Une récolte revient au Garden`.
- Runtime error, blocked, failed ou failure : `Une épine bloque la sortie`.

Quand aucune source ne produit d'evenement, le composant affiche seulement :

`Le jardin est calme. Gérard l’a décidé.`

## Limites

ActivityEcho ne cree aucun evenement, ne modifie pas le Garden et ne declenche aucune mission.
