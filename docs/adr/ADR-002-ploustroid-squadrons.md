# ADR-002 — Escadrons Ploustroïdes (pilote)
Statut : expérimental, sans activation de diffusion.

## Décision
Poulpe Fiction coordonne des **escadrons** (tentacules) qui délèguent des missions à des **agents** (Gégé). Un agent est un rôle exécuté à la demande, jamais un processus permanent. Un escadron possède un responsable, une file de missions, des permissions et des preuves d'exécution.

## Topologie initiale
- diffusion : Gérard (chef), rédaction, visuel, édition, transport.
- commerce : prospection, qualification, courrier (préparation uniquement).
- studio : scénario, image, vidéo.
- intelligence : Publisher (chef), veille, vérification, mémoire.

## Contrat de mission
Chaque mission possède id, squadronId, kind, parcelId, createdAt et status. Les transitions sont explicites et traçables : queued → running → completed/blocked/failed. Le statut completed requiert une preuve contrôlable. Une mission bloquée ne devient pas terminée par simple absence d'erreur.

## Limites
Aucune publication, envoi, dépense, nouveau serveur ou modification de posts programmés. Le transport et les appels externes restent dans les tentacules existants, avec leurs permissions actuelles. Ne jamais présenter un rôle déclaré comme un agent réellement actif.

## Déploiement
Phase 1 : registre et moteur de transition purs, tests.
Phase 2 : adapter une mission réelle de diffusion en lecture seule et persister dans le snapshot PostgreSQL existant.
Phase 3 : raccordement aux workflows et au Jardin, états tirés de preuves réelles.
Phase 4 : autorisations explicites pour tout effet externe.
