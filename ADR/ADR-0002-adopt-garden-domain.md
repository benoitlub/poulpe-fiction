# ADR-0002 — Adopt the Garden domain in Poulpe Fiction

## Status

Proposed for implementation by issue #19.

## Context

Poulpe Fiction already contains most user-facing Garden concepts:

- parcels and Seeds in `blacklace-parcel.js`;
- adventure preparation in `adventure-draft.js`;
- return processing in `adventure-return.js`;
- Knowledge Pack and Tool Pack clients;
- Connection Broker client;
- Production Plan and Production Pack;
- visible artifacts and landing page previews.

Octopus Engine currently contains active Garden domain code such as GardenStore, GardenProjector, Seed/Sprout types, resonance logic and Garden-specific routes. ADR-0008 in Octopus Engine establishes that these concepts belong to Poulpe Fiction and must be removed from the engine only after Poulpe Fiction has received and tested an equivalent implementation.

## Decision

Poulpe Fiction adopts the Garden domain without replacing its existing workflow.

The Garden is implemented as a small domain and projection layer around the files that already exist. No second parcel system, second Production Pack, second broker or second execution gateway may be introduced.

## Existing components to preserve

| Existing file | Role after migration |
|---|---|
| `blacklace-parcel.js` | parcel catalogue, active Seed context and Garden entry point |
| `adventure-draft.js` | preparation state for internal or external exploration |
| `adventure-return.js` | interpretation of neutral execution results and Garden return events |
| `publisher-knowledge.js` | Knowledge Pack adapter |
| `connection-broker.js` | Publisher route and provider adapter |
| `production-plan.js` | production dependency graph |
| `production-pack.js` | visible concrete artifacts and deliverables |
| `product-knowledge.js` | explicit offline fallback only |

## Smallest Garden domain

The implementation should add or adapt only the following responsibilities:

### Garden state

- parcel identity and access scope;
- Seed identity and visible status;
- optional Sprout projection if still used by the accepted rules;
- current visible activity;
- last meaningful change;
- explicit obstacle;
- Harvest or Production Pack association;
- neutral execution operation correlation.

### Garden events

Garden events belong to Poulpe Fiction, for example:

- `SeedSelected`;
- `SeedResonanceEvaluated` if retained;
- `GardenWorkPrepared`;
- `GardenWorkStarted`;
- `GardenWorkBlocked`;
- `GardenWorkPaused`;
- `GardenReturnReceived`;
- `HarvestReady`.

These events must not be exported as Octopus Engine Core events.

### Projection

A Poulpe Fiction Garden projector may update the visible read model from domain events.

It must not:

- create inner activity because the page opened;
- mutate Guardian, Publisher or Octopus Engine directly;
- trigger repeated paid execution from a render loop;
- use the read model itself as the source of authority.

## Neutral Octopus boundary

Poulpe Fiction translates Garden operations into a neutral execution request.

Recommended minimal shape:

```js
{
  operationId,
  intent,
  objective,
  context,
  requiredCapabilities,
  authorizedResources,
  authorizationPolicy
}
```

`parcelId`, `seedId`, `harvestId` and Garden vocabulary stay in Poulpe Fiction. They may cross the boundary only as opaque metadata or correlation identifiers.

The neutral result is interpreted by Poulpe Fiction as:

- visible activity;
- obstacle;
- learning;
- return;
- Harvest;
- Production Pack update.

## Persistence boundaries

### Source of authority

Poulpe Fiction owns the meaning and lifecycle rules of parcels, Seeds, activities and Harvests.

### Shared persistence

Publisher may continue to expose generic `global-state` persistence. It stores the value but does not interpret or mutate the Garden lifecycle.

### Browser storage

`localStorage` remains only:

- a cache;
- an offline fallback;
- temporary UI state.

It is not the authoritative source when shared persistence is available.

### Execution state

Session-bound execution must be described honestly. Persistent background work may only be claimed when a real persistent server process or job exists.

## UI target

The primary screen should show:

- Gérard;
- the active accessible parcel;
- current activity;
- the last meaningful change;
- a real obstacle when present;
- an available Harvest or Production Pack;
- the next useful user action.

The normal user path must not expose:

- Octopus Engine;
- providers;
- Composio;
- Connection Broker internals;
- adapter status;
- technical validation stages.

Human approval is required only before public, external, costly, destructive or irreversible actions.

## Migration sequence

1. Inventory current Garden-like state in Poulpe Fiction.
2. Add the smallest Garden state and projection layer around existing components.
3. Add or adapt the neutral Octopus gateway.
4. Translate current returns into Garden events and Harvest associations.
5. Add tests for state, projection, no duplicate launch and approval boundaries.
6. Reintroduce the useful UX parts from superseded PR #18.
7. Only then declare Poulpe Fiction ready for Octopus Engine issue #11.

## Explicit non-goals

- no new framework;
- no new database;
- no second broker;
- no second Production Pack;
- no rewrite of the interface;
- no background queue invented only for this migration;
- no automatic publication or contact;
- no claim of autonomy that the runtime cannot actually provide.

## Completion test

Poulpe Fiction is ready when a parcel and Seed can be loaded, transformed into one neutral Octopus operation, interpreted back into a visible Garden result, and associated with a Production Pack without exposing engine plumbing or launching duplicates.
