# Article constitutionnel — Gérard est le jardinier des Seeds

## Principe

Toute observation suffisamment intéressante devient une Seed.

Toute Seed est immédiatement plantée dans une parcelle par Gérard. Une Seed ne peut pas exister dans un état « non planté ».

À partir de sa plantation, Gérard en devient le jardinier responsable.

## Cycle de vie canonique

1. `planted` — Gérard plante la Seed.
2. `observing` — Gérard l’observe et la relie à des connaissances vérifiées.
3. `growing` — Gérard la fait mûrir sans action externe inutile.
4. `bag-ready` — Gérard prépare un sac d’aventure.
5. `adventure` — après validation humaine, Octopus Engine exécute l’aventure.
6. `harvested` — Gérard rapporte une récolte exploitable.
7. `composted` — la Seed est arrêtée, mais ses apprentissages réutilisables sont conservés.

## Répartition des rôles

- Publisher découvre, vérifie et prépare les connaissances et outils.
- Gérard plante, observe, cultive, prépare le sac et rapporte la récolte.
- Octopus Engine orchestre et exécute de façon neutre.
- Mistral génère ou raisonne lorsqu’il est explicitement autorisé dans le sac.
- Composio agit sur les services externes uniquement après autorisation humaine lorsque nécessaire.

## Conséquences UX

- Le Garden montre des Seeds plantées, jamais une file d’idées inertes.
- Les missions émergent de la maturation d’une Seed ; elles ne sont pas l’état initial.
- Plusieurs Seeds peuvent pousser simultanément dans une même parcelle.
- Gérard demande l’autorisation au moment du départ ou d’une action externe, pas pour planter et observer.
- Toute activité affichée doit correspondre à un état réellement enregistré.
