# Poulpe Fiction

Interface simple pour démontrer le principe Octopus :

> Le client exprime un objectif. L'outil pose les bonnes questions. Le moteur prépare un plan. Le client voit un résultat clair.

## Promesse

- Pas de dashboard au premier contact.
- Pas de jargon technique.
- Pas de jardin visible.
- Pas de poulpe visible côté client.
- Une interface orientée résultat.

## Convention Gérard

Poulpe Fiction évolue aussi comme la cabane de départ de Gérard : l'espace où il discute avec le jardinier, prépare son sac, choisit son pique-nique et revient au jardin avec une récolte ou un apprentissage.

La convention est documentée dans [`ADR/ADR-0001-convention-poulpe-fiction.md`](ADR/ADR-0001-convention-poulpe-fiction.md).

Principes courts :

- La curiosité grandit avec les observations.
- Quand elle devient forte, elle peut devenir jeu, rêve, carnet, observation prolongée ou aventure.
- Avant toute aventure, Gérard prépare son sac.
- Les greffons sont des outils temporaires d'aventure.
- Le LLM est le poète du poulpe, jamais son cerveau.
- Toute aventure revient au jardin.

## Parcours V1

1. Choisir un objectif.
2. Répondre à une question à la fois.
3. Voir une phase d'analyse.
4. Obtenir un plan clair.
5. Lancer une première mission.

## Développement

```bash
npm install
npm run dev
```
