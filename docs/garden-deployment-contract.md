# Garden deployment contract

This document defines the smallest server contract expected by the Garden UI prepared on branch `refactor/adopt-garden`.

The UI is remote-first and uses browser storage only as cache or offline fallback.

## Configuration

The production service base URLs are resolved only from `runtime-config.js`.

Production URLs:

- Octopus API: `https://octopus-engine.onrender.com`
- Publisher API: `https://blacklace-publisher-api.onrender.com`
- Publisher frontend: `https://blacklace-publisher.onrender.com`

Production ignores browser API overrides. Stale keys are removed by the runtime-config migration.

## Read endpoint

```http
GET /api/global-state/garden/:parcelId
Accept: application/json
```

Accepted response shapes:

```json
{
  "value": {
    "version": 1,
    "parcelId": "blacklace-ecosystem",
    "seedId": "feulette-tachetee",
    "seedTitle": "La Feulette Tachetée",
    "operationId": "operation_123",
    "status": "running",
    "activity": "Gérard prépare une campagne courte.",
    "updatedAt": "2026-07-12T12:00:00.000Z",
    "obstacle": null,
    "harvest": null,
    "nextAction": null
  }
}
```

or the same object directly without the `value` envelope.

## Statuses

The UI supports:

```text
idle
queued
running
paused
blocked
ready
failed
```

Do not introduce UI-only statuses without mapping them to this set.

## Operation endpoint

```http
POST /api/garden/operations
Content-Type: application/json
Idempotency-Key: <parcelId>:<seedId>:<action>:v1
```

Request:

```json
{
  "action": "prepare",
  "operationId": null,
  "parcelId": "blacklace-ecosystem",
  "seedId": "feulette-tachetee",
  "seedTitle": "La Feulette Tachetée",
  "objective": "Créer une promotion claire...",
  "expectedHarvest": "Page courte, visuels, posts...",
  "input": {},
  "authorizationPolicy": {
    "internalWork": "allowed",
    "externalAction": "requires-human-approval"
  }
}
```

Supported UI actions:

```text
prepare
resume
resolve-obstacle
authorize-external-action
```

The response should return the updated Garden record in the same shape as the read endpoint.

## Obstacle shape

```json
{
  "obstacle": {
    "code": "missing-synopsis",
    "title": "Synopsis manquant",
    "message": "Il faut un synopsis fiable avant de rédiger.",
    "requiredField": {
      "name": "synopsis",
      "label": "Synopsis",
      "placeholder": "Colle ici le synopsis validé",
      "value": ""
    }
  }
}
```

The UI sends the submitted value through `input.field` and `input.value` with action `resolve-obstacle`.

## Harvest shape

```json
{
  "harvest": {
    "id": "harvest_123",
    "title": "Campagne La Feulette Tachetée",
    "status": "ready",
    "productionPackId": "production_return_123",
    "artifactsReady": 1,
    "artifactsTotal": 4
  }
}
```

The frontend currently opens the matching local Production Pack when available. A later backend may return downloadable artifact URLs, but that is outside this migration.

## Ownership

- Poulpe Fiction owns the Garden record meaning and lifecycle.
- The deployed service persists and returns the record.
- Publisher may temporarily host generic shared state but must not decide Garden business transitions.
- Octopus Engine receives only neutral execution requests and never owns this schema.

## Security and authorization

The operation endpoint must treat `authorize-external-action` as an explicit user authorization request.

A `prepare`, `resume` or `resolve-obstacle` action must not publish, contact, spend, delete or deploy by itself.

## Required backend guarantees

- idempotency by header;
- persistent state independent from the browser tab;
- no duplicate paid execution;
- explicit updated timestamp;
- explicit failure or obstacle instead of endless running;
- authorization boundary for external actions;
- parcel visibility filtered by authenticated user when multi-user access is introduced.
