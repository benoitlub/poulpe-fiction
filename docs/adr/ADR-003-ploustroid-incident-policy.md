# ADR-003 — Ploustroïdes : journal d'incidents et alertes sobres
Statut : prototype, non connecté aux notifications GitHub.

Objectif : une entrée par problème identifié (fingerprint), pas un message par échec. Les événements sont idempotents par identifiant. Un incident peut être récupérable, répété ou nécessiter une action humaine.

- Récupérable : consigner, aucune alerte.
- Répété : regrouper dans le Journal de bord, aucune alerte immédiate.
- Action requise : une alerte potentielle par incident, marquée envoyée uniquement après confirmation de l'envoi.
- Résolu : sortir des rapports actifs ; un nouvel incident peut être créé si le problème revient.

Le moteur est volontairement pur : il n'envoie aucun e-mail, n'altère aucune programmation, ne modifie pas les paramètres de notifications GitHub. Le raccordement futur doit utiliser les événements réels des workflows, persister le registre dans PostgreSQL existant, gérer les tentatives et limiter les informations sensibles.

Important : les e-mails automatiques GitHub Actions sont contrôlés par les paramètres de notifications du compte GitHub. Cette ADR ne peut pas les désactiver.
