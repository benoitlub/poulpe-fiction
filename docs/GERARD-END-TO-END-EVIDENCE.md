# Gérard — vérification de continuité (lecture seule)

## Constat vérifié (17 novembre 2026)
- Production run 43302312921 : Gérard a terminé un cycle, les snapshots privés ont été persistés, mais le test Metricool a retourné `METRICOOL_ACCOUNT_NOT_FOUND_FOR_USER`. La livraison directe était désactivée et le transport était en mode préparation.
- Studio run 43782025059 : cycle `blacklace-echo-image-studio` en échec `MISTRAL_IMAGE_ACCESS_DENIED` (HTTP 403), sans média publié. La conservation des fichiers et snapshots a réussi.
- Les états publics ne contiennent qu'une projection des états privés PostgreSQL. Un cycle `ok` n'est pas une preuve de publication.

## Commande de diagnostic sans effet de bord
```bash
node scripts/gerard-evidence-audit.mjs
node --test tests/gerard-evidence-audit.test.mjs
```
La commande ne contacte ni Notion, ni Mistral, ni Metricool, ni PostgreSQL. Elle ne modifie aucune donnée. Les fichiers manquants sont signalés, jamais assimilés à une réussite.

## Prochaines vérifications requises avant un correctif de production
1. Corréler `operationId`, `seedId`, `harvestId` et `postId` sur un même cycle à partir des snapshots privés et des journaux, sans exposer les secrets.
2. Vérifier l'identité et le périmètre du compte Metricool sur le chemin de diffusion réellement autorisé, sans forcer une nouvelle publication.
3. Confirmer l'accès du compte Mistral au modèle image : HTTP 403 ne se répare pas par un retry aveugle.
4. Ne marquer `livré` qu'avec un identifiant confirmé par le fournisseur ou un artefact vérifié.

Ce changement ne touche pas aux workflows, aux secrets, aux publications programmées ni à la logique de reprise.
