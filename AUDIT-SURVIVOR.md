# Audit — passage de Gérard en classe Survivor

## Constat

La Convention est plus avancée que le code actuel.

Gérard possède déjà des notions d'attirance, de jeu, de rêve, d'envie d'aventure et de sac. Mais l'interface conversationnelle reste pilotée par une fonction locale à mots-clés (`gerardReply`) et son repli par défaut demande encore un objectif à Benoît.

L'état vivant est conservé uniquement dans `localStorage`. Il n'existe pas encore de boucle serveur persistante capable de travailler quand l'application est fermée. Les aventures préparent un sac, mais ne déclenchent pas encore une production concrète ni une tentative économique.

## Écart principal

La Convention dit : le LLM est le poète, pas le cerveau ; Gérard observe, développe une envie et revient avec une récolte.

Le code fait actuellement : message utilisateur → détection de mots-clés → réponse prédéfinie.

## Patch de classe supérieure

Cette branche ajoute une couche Survivor persistante qui :

- mémorise un objectif financier initial de 20 € ;
- ne redemande plus l'objectif lorsqu'il est déjà connu ;
- transforme chaque journée en une récolte économique visible ;
- produit immédiatement une offre, une publication et un message direct copiables ;
- distingue strictement ce qui est préparé de ce qui a réellement été publié ou vendu ;
- conserve les tentatives dans le carnet local.

## Limites assumées

Ce patch rend Gérard plus actif dans l'application, mais ne prétend pas encore à une autonomie hors ligne ou serveur.

Pour travailler application fermée, il faudra ensuite :

1. un état Survivor côté API ;
2. une boucle planifiée côté serveur ;
3. un registre de capacités réellement disponibles ;
4. une file de validations ;
5. des connecteurs autorisés pour publier, contacter et mesurer ;
6. des traces vérifiables afin que Gérard ne confonde jamais préparation et action réelle.

## Règle de passage

Une pensée n'est pas une récolte.

Une récolte doit laisser au minimum un artefact directement utilisable par Benoît.
