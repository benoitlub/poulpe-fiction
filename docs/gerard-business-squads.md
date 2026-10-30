# Gérard — Business Squads

Cette couche rend le travail commercial de Gérard lisible sans remplacer le moteur Business Growth de Publisher.

## Principe chapardé

Le flux garde les mêmes preuves et garde-fous, mais le livrable devient immédiatement compréhensible :

**Marché → 10 cibles → 3 à approfondir → 1 prochaine action**

Les chiffres sont des objectifs de présentation, jamais des quotas justifiant l'invention de prospects.

## Squads Benoît

- **Squad Distribution Jeux** : distributeurs, grossistes et revendeurs de jeux physiques.
- **Squad Salons & Events** : organisateurs, exposants et partenaires d'événements.
- **Squad Éditeurs & Coédition** : éditeurs, coéditeurs, licences et partenariats de marque.

## Contrat de sortie

Chaque récolte B2B doit montrer en tête les squads actives, le nombre de sources réellement observées, jusqu'à trois cibles dont la page a été lue et dont le secteur correspond, puis une seule prochaine action vérifiable.

Une cible n'est jamais qualifiée de « hot lead » sur un score seul. Le décideur, le canal public, le besoin, le budget et l'échéance restent à vérifier.

## Garde-fous

- automaticOutreach reste toujours false dans le runtime Gérard ;
- aucune prise de contact n'est effectuée par ce changement ;
- aucun revenu, budget ou intérêt n'est déduit d'un snippet de recherche ;
- une source de recherche non lue reste research-only ;
- les données restent isolées par clientId, parcelId et knowledgeSlug.

## Non-objectifs

Cette PR ne crée ni CRM, ni nouveau serveur, ni nouvelle architecture. Elle ne modifie pas le mécanisme de publication. Elle améliore uniquement le packaging du flux d'acquisition déjà existant.
