<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Jardin des Gégé
- `src/garden-gege/contracts.ts`, `core.mjs`, `demo.ts` are copies of Codex's files (poulpe-fiction, branch codex/jardin-gege-audit-prototype); keep them in sync with Codex, don't add logic there — Codex owns data contracts.
- The scene only reads data through a `GardenSource` (`sources.ts`); switching demo → real is a source change, never a view change.
- Hamster poses derive only from observed mission status (`scene-model.ts`), never from timers — animations must not invent progress.
- GitHub source exports live in an isolated `prototypes/gege-visual/` application on `lovable/jardin-gege-visual`; preserve repository-root files and Codex's domain modules so copying the preview cannot replace the production home.
