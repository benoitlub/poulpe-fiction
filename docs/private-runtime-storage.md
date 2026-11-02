# Données de travail et résumés publics

Les fichiers JSON générés à la racine de `garden/` sont conservés intégralement
dans la table dédiée `gerard_private_runtime`, dans la base PostgreSQL déjà
utilisée par Publisher. Aucun serveur ou abonnement supplémentaire n'est ajouté.

Le cycle restaure ces fichiers après l'installation des dépendances Publisher,
travaille sur les données complètes, puis sauvegarde et relit le snapshot avant
de remplacer les fichiers publics par des métadonnées. La mémoire de recherche,
les brouillons, les lettres et les textes complets ne sont pas détruits : ils
restent dans la base privée. Le site public ne donne plus accès à ces détails.

Les paramètres relus depuis GitHub restent versionnés : restart-seeds.json,
publication-experiment-30d.json, gerard-owner-feedback.json et
verified-external-publications.json. Ils ne sont jamais écrasés par restauration.
Ne pas y placer de coordonnées ou de documents confidentiels.

La création de table est additive (`CREATE TABLE IF NOT EXISTS`) ; aucune table
existante n'est modifiée. Les écritures sont paramétrées et versionnées. Une
version concurrente, une sauvegarde non vérifiée ou une base inaccessible fait
échouer le job avant le commit public. Ne pas contourner cet arrêt en committant
manuellement les fichiers restaurés.

## Accès privé

Les données sont accessibles à l'opérateur disposant de DATABASE_URL, via la base
ou la commande `hydrate`. Aucun endpoint public ni clé dans le navigateur n'est
ajouté. Une interface authentifiée de consultation privée est un chantier distinct.
La page publique montre donc uniquement l'activité et les métadonnées disponibles.

Le chemin GERARD_PUBLISHER_DB_PACKAGE désigne le package DB du checkout Publisher
afin de réutiliser son pilote pg. GERARD_PRIVATE_GARDEN_PATH et
GERARD_PRIVATE_VERSION_PATH permettent une validation sur des fixtures isolées.

## Validation et limite historique

Les tests vérifient le retour intégral des données, l'absence des textes privés
dans les projections, les versions concurrentes et le rejet des chemins invalides.
Un workflow teste aussi le cycle sauvegarde/lecture/restauration sur PostgreSQL 16
éphémère, sans secrets ni données de production.

Les snapshots déjà présents dans l'historique Git et les anciens logs ne sont pas
effacés par cette migration. Les médias sous garden/studio ne sont pas migrés par
ce mécanisme réservé aux JSON de premier niveau. Les documents privés originaux
doivent continuer à être fournis depuis une source privée, comme Notion.
