# Compact Garden-first UI

This branch intentionally changes only presentation and ordering before the Garden-domain implementation from issue #19.

## Visible priority

The first screen must show, in this order:

1. Poulpe Fiction identity;
2. active parcel and active Seed;
3. compact Seed picker;
4. Gérard conversation;
5. compact secondary information.

The user must not scroll through the Serre, dreams, play areas and generic objective cards before seeing the parcel.

## Changes already applied

- parcel inserted before the Gérard chat instead of at the bottom of the page;
- active Seed shown as one compact primary card;
- all other Seeds placed in a collapsible picker;
- Seed cards changed to compact rows;
- generic objective cards hidden from the default Garden view;
- Serre detail blocks hidden from the primary view;
- header and global spacing reduced;
- mobile layout reduced to one compact column.

## Constraints for issue #19

- preserve the Garden-first order;
- do not restore a long dashboard stack;
- show only one primary action per state;
- use progressive disclosure for bags, Tool Packs, sources, providers and diagnostics;
- keep the Production Pack visible when a Harvest exists;
- do not use CSS hiding as the final domain architecture: when issue #19 creates proper views, replace temporary hidden legacy blocks with explicit components or routes.

## Temporary nature

`compact-ui.css` is a safe presentation override for the migration branch. It avoids rewriting the legacy stylesheet while the domain is being moved.

After the Garden components are stable, its rules may be folded into the permanent stylesheet and obsolete legacy blocks may be removed.
