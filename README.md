# Poulpe Fiction

Poulpe Fiction est l’interface relationnelle de Gérard et le propriétaire de son Garden.

> L’utilisateur ouvre une parcelle. Gérard observe une Seed, prépare un travail interne, demande une exécution neutre à Octopus Engine puis transforme le résultat en récolte visible.

## Responsabilités

Poulpe Fiction possède :

- le Garden ;
- les parcelles ;
- les Seeds, Sprouts, récoltes et compost ;
- la curiosité, les aventures et les retours de Gérard ;
- les Production Packs visibles ;
- la traduction entre le vocabulaire vivant et les opérations neutres du moteur.

Poulpe Fiction ne possède pas :

- le catalogue des providers et leurs coûts, qui restent dans Blacklace Publisher ;
- le moteur d’exécution, qui reste dans Octopus Engine ;
- les clés, connexions OAuth et diagnostics techniques.

## Promesse

- Pas de jargon moteur dans le parcours client.
- Pas de dashboard technique au premier contact.
- Gérard et les parcelles accessibles sont visibles.
- L’activité, les obstacles et les récoltes sont compréhensibles.
- Une validation humaine n’est demandée qu’avant une action extérieure.

## Convention Gérard

Poulpe Fiction est la cabane et le Garden de Gérard : l’espace où il observe les parcelles, prépare son sac, utilise temporairement des greffons et revient avec une récolte ou un apprentissage.

La convention est documentée dans [`ADR/ADR-0001-convention-poulpe-fiction.md`](ADR/ADR-0001-convention-poulpe-fiction.md).

Principes courts :

- La curiosité grandit avec les observations.
- Quand elle devient forte, elle peut devenir jeu, rêve, carnet, observation prolongée ou aventure.
- Le sac et les greffons restent une mécanique interne, pas une corvée technique imposée à l’utilisateur.
- Le LLM est le poète du poulpe, jamais son cerveau.
- Toute aventure revient au Garden.

## Développement

```bash
npm install
npm run dev
```
