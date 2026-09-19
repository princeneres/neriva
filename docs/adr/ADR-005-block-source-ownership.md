# ADR-005: Block source ownership

## Context

Template Blocks were persisted, but native defaults were not retained after seeding. The admin editor could fabricate starter code and the renderer could bypass persisted source for selected ERCs. That made the shown code unreliable.

## Decision

Persist active HTML, CSS and optional JavaScript separately from their immutable native baseline. Expose the baseline and source state through the Blocks API. Render all template Blocks through the shared template engine, including native semantic Blocks. JavaScript executes only in an opaque-origin iframe with a restrictive CSP and a validated action bridge. The Block Studio uses that same rendering path for its preview.

## Consequences

Block source is an API-owned product capability rather than UI state. Restoring native code is deterministic and does not overwrite schema or metadata. New custom Blocks must provide source rather than inheriting artificial starter markup. Native baselines can evolve while preserved custom code remains intact. The declarative action bridge gives data-driven Blocks behavior without returning to ERC-specific React renderers.
