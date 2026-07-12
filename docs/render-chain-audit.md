# Render chain audit

## Status

Blocking review for PR #20.

The current frontend composes behavior by repeatedly replacing the global `render` function and several secondary render/bind functions. The order is determined entirely by `<script>` order in `index.html`.

## Effective script order

```text
app.js
adventure-draft.js
adventure-return.js
blacklace-parcel.js
product-knowledge.js
publisher-knowledge.js
connection-broker.js
production-plan.js
production-pack.js
production-status-sync.js
landing-preview-fix.js
adventure-launch.js
garden-runtime.js
garden-runtime-actions.js
survivor.js
```

## Effective `render()` wrapper chain

```text
survivor.js
  → garden-runtime-actions.js
    → garden-runtime.js
      → production-pack.js
        → blacklace-parcel.js
          → adventure-return.js
            → app.js render()
```

Each wrapper calls the function it captured at load time, then performs DOM insertion or binding.

This chain is currently order-sensitive and has no central registry, priority or duplicate protection beyond individual DOM queries.

## Secondary wrapper chain

`renderAdventureUrge` is also replaced several times:

```text
app.js implementation
  → adventure-draft.js
    → production-plan.js
      → adventure-launch.js
```

`bindGreenhouseActions` is replaced by:

```text
app.js implementation
  → adventure-draft.js
    → adventure-launch.js
```

These secondary chains currently depend on every wrapper calling the previous implementation.

## Blocking defect 1 — Garden panel never renders

`app.js` declares application state with top-level `let state`.

A top-level `let` creates a global lexical binding but does not create `globalThis.state`.

`garden-runtime.js` declares another local constant also named `state` for the Garden runtime, then its wrapper tests:

```js
if (global.state?.step !== "objective") return;
```

Because `global.state` is undefined, the expression is always true:

```text
undefined !== "objective" → true
```

The wrapper therefore returns immediately after calling the previous renderer. The `.garden-runtime` panel is never inserted.

### Required correction

Rename the internal Garden state to `runtimeState`, then use the application lexical state in the wrapper:

```js
if (state.step !== "objective") return;
```

Or expose an explicit application API such as:

```js
global.PoulpeApp.getState()
```

The explicit API is preferable for the permanent implementation.

## Blocking defect 2 — two owners for Garden action binding

`garden-runtime.js` already binds:

- refresh;
- prepare;
- resume;
- obstacle resolution;
- API URL save;
- Harvest opening.

`garden-runtime-actions.js` binds again:

- obstacle resolution;
- Harvest opening;
- external approval.

Because both assign `element.onclick`, the last loaded script silently replaces handlers installed by the first one.

This is not deterministic ownership; it works only because script order currently makes `garden-runtime-actions.js` win.

### Required correction

Choose one owner.

Recommended:

- keep all Garden panel rendering and binding inside one `GardenRuntime` module;
- remove the `render` wrapper from `garden-runtime-actions.js`;
- use event delegation for optional external actions, or merge the file into `garden-runtime.js`.

## Defect 3 — obstacle payload is lost in the first implementation

`garden-runtime.js` defines:

```js
async function createOperation(action)
```

but calls it as:

```js
createOperation("resolve-obstacle", { value: input.value })
```

The second argument is ignored and no `input` field is sent.

`garden-runtime-actions.js` compensates with a second POST implementation, which is another sign that responsibilities are duplicated.

### Required correction

Use one function:

```js
async function createOperation(action, input = {})
```

and always include `input` in the request body.

## Defect 4 — duplicated Harvest preview ownership

Harvest preview behavior exists in three places:

1. `production-pack.js` assigns preview button handlers;
2. `landing-preview-fix.js` intercepts preview clicks in capture phase;
3. `garden-runtime-actions.js` assigns preview handlers again after inserting a pack.

`landing-preview-fix.js` calls `stopImmediatePropagation()`, so other preview handlers may never run for the same click.

This currently avoids the old `about:blank` bug, but the ownership is unclear and fragile.

### Required correction

Keep one global delegated preview handler in `landing-preview-fix.js` and remove direct preview binding from Garden modules.

`ProductionPack.render()` should render markup only.

## Defect 5 — `ProductionPack.bind` is called but not exported

`garden-runtime.js` calls:

```js
global.ProductionPack?.bind?.(pack)
```

but `production-pack.js` exports:

```js
global.ProductionPack = {
  STORE_KEY,
  load,
  save,
  createFromReturn,
  latestForReturn,
  render
}
```

The optional call fails silently. This hides the mismatch instead of proving that buttons were bound.

The delegated landing preview handler currently saves one behavior, but other future Production Pack actions would remain unbound.

### Required correction

Either export `bind`, or preferably make Production Pack actions delegated and remove the need for post-render binding.

## Defect 6 — Survivor re-expands the compact first screen

`survivor.js` is the final render wrapper and inserts a large `.survivor-card` immediately after Gérard's chat.

The compact Garden CSS hides generic objective cards and detailed Serre blocks, but does not hide or compact the Survivor card.

The resulting order is:

```text
parcel
Garden runtime (after defect 1 is fixed)
chat
large Survivor card
Serre
```

This partially recreates the long dashboard that the compact UI was intended to remove.

`survivorHarvest()` also writes a generated daily artifact during rendering, which makes rendering mutate domain state.

### Required correction

Move Survivor information into one compact Garden summary or a secondary disclosure panel.

Rendering must not create a new Harvest. Harvest preparation belongs to an explicit domain action or server event.

## Defect 7 — repeated module-load rendering

Several scripts call `render()` immediately after replacing a function:

- `adventure-draft.js`;
- `blacklace-parcel.js`;
- `garden-runtime.js`;
- `survivor.js`;
- other existing feature modules.

This does not currently create direct recursion because each wrapper captures the previous function before calling the new one. However, initial page load performs multiple full `root.innerHTML` replacements and repeated binding passes.

As the chain grows, initialization becomes increasingly difficult to reason about.

### Required correction

Only `app.js` should perform initial rendering.

Feature modules should register render contributions and bindings, then one final bootstrap should render once.

## Recommended minimal stabilization before backend work

Do not perform a framework rewrite. Add one small registry in `app.js`:

```js
const uiExtensions = [];

function registerUiExtension(extension) {
  uiExtensions.push(extension);
}

function runUiExtensions() {
  for (const extension of uiExtensions) {
    extension.afterRender?.({ state, root });
  }
}
```

At the end of the canonical `render()`:

```js
runUiExtensions();
```

Expose only:

```js
global.PoulpeUI = {
  register: registerUiExtension,
  getState: () => state,
  render: () => render()
};
```

Then migrate wrappers gradually:

1. GardenRuntime;
2. BlacklaceParcel;
3. Survivor;
4. AdventureReturn;
5. ProductionPack.

Secondary functions such as `renderAdventureUrge` may remain temporarily wrapped, but no new global `render` replacement should be added.

## Immediate patch order

1. Fix the Garden state-shadowing bug.
2. Merge Garden action ownership into one module.
3. Remove duplicate Harvest preview binding from Garden modules.
4. Compact or relocate Survivor.
5. Add the small UI extension registry.
6. Convert existing wrappers one by one.
7. Add a browser smoke test proving one render pass produces exactly one parcel, one Garden runtime panel and at most one Survivor summary.

## Required smoke assertions

After initial load with no active Seed:

```text
.blacklace-parcel = 1
.garden-runtime = 1
.gerard-chat = 1
.production-pack <= 1
.survivor-card <= 1
```

After selecting a Seed and re-rendering five times:

```text
no duplicate parcel
no duplicate Garden panel
no duplicate event-triggered POST
Seed buttons still work
Garden refresh still works
```

After a ready Harvest:

```text
one Production Pack
one preview behavior
one download behavior
no duplicated plan markup
```

## Verdict

PR #20 is structurally useful but not yet safe to merge.

The wrapper chain is currently finite and understandable, but one blocking state-shadowing bug prevents the main Garden runtime panel from appearing, and multiple features have overlapping event ownership.

Stabilize rendering before implementing the backend routes.