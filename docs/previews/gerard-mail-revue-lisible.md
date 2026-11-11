# Aperçu du mail de revue de Gérard

Exemple déterministe du nouveau rendu, **aucun mail envoyé**. La description
provient de la fiche projet déjà présente dans le code. Ce document ne prouve
aucune génération d’image ni publication Facebook.

**Objet :** [Gerard Metricool v1] Proposition · Blacklace Dice · Facebook

```text
Bonjour Benoît,

Voici une proposition pour Blacklace Dice.
Destination : Facebook · compte Pro.Hibited
Format : texte seul — aucune image jointe.
Statut : proposition transmise pour revue. Aucune programmation ou publication confirmée par ce mail.

LÉGENDE PROPOSÉE

Blacklace Dice

Dé anti-procrastination absurde pour trancher ou relancer.

Tu hésites trop ? Quelle petite décision laisserais-tu volontiers à un dé ?

À relire avant diffusion : exactitude du contenu et adéquation du format.

Référence de suivi : exemple
Gérard
```

## Ce qui change

- Plus de hash complet dans l’objet ni de JSON brut dans le mail de revue.
- Légende, destination, compte et absence de média clairement visibles.
- Le contrat JSON `gerard-metricool-mail-v1` reste le format API ; Publisher le
  conserve dans la réservation privée existante, avec sa clé anti-doublon.
- Le rendu lisible est demandé par `presentation:editorial-review-v1`. Sans ce
  paramètre, les mails restent inchangés. Si un consommateur externe dépend du
  mail JSON, la variable de dépôt non secrète `GERARD_METRICOOL_MAIL_PRESENTATION=machine` conserve aussi l’ancien
  objet et le corps JSON exact. Aucun secret supplémentaire.
- Le repli local utilise les fiches des projets déjà sourcées, et non l’ancien
  catalogue de questions seul. Une catégorie ou une relance ajoutée ne fabrique
  plus une nouvelle légende. Jointed n’a pas de résumé dans cette liste : les
  suppositions de mécaniques de cartes ne sont plus expédiées par ce repli.
- Les anciennes propositions locales `local-editorial` encore en attente sont
  ignorées lors de la préparation du prochain mail. Leur historique est conservé ;
  aucune programmation existante n’est modifiée.

## Validation et limites

Les tests simulent OIDC et Gmail, vérifient l’objet court, la légende sourcée,
l’absence de fausse image, le mode machine inchangé, la clé stable et le refus
420 Dice conservé. Aucun compte connecté ou secret modifié et aucun envoi réel.
Le changement nécessite la PR coordonnée de Publisher, branche
`fix/gerard-readable-editorial-handoff`. Déployer Publisher avant d’activer le
nouveau producteur est compatible : les anciens clients ne demandent pas le
rendu lisible et restent inchangés.

Un mail livré reste une proposition transmise : ce n’est pas une confirmation
Metricool ou Facebook. Quand les textes locaux distincts et sourcés sont épuisés,
le cycle le signale au lieu d’ajouter des phrases de remplissage. Les autres
fonctions de Gérard continuent et aucun appel payant n’a été ajouté.

Résultats locaux : **196 tests Poulpe réussis** ; **157 tests Worker réussis,
un test existant ignoré**, contrôle TypeScript du Worker réussi. Les tests du
rendu couvrent aussi l’ancien contrat sans paramètre de présentation.
