# ADR-003: Template-based blocks (reversal of the no-template rule)

Status: accepted. Date: 2026-08-09. Supersedes the "no string-template HTML editing" rule in the original constitution and ADR-001's consequence of registry-only rendering.

## Context

v1 shipped blocks as JSON Schema props + named slots, rendered by a fixed React registry. Custom blocks fell back to a generic renderer: there was no way for an author to customize a block's presentation without changing application code. The project owner explicitly requires the Liferay fragment model (HTML + CSS authored in the admin, with editable-field markers), which is also the converged design of modern visual builders (Puck, GrapesJS, Builder.io): authorable template + field bindings + a JSON page tree.

## Decision

Blocks gain optional `html` and `css` columns authored in the admin:

- `html` is a template with three mechanisms: `{{prop}}` interpolation (always HTML-escaped), binding attributes that both render and make elements inline-editable on the studio canvas (`data-nv-text`, `data-nv-rich`, `data-nv-image`, `data-nv-link`), and slot placeholders (`data-nv-slot="name"`).
- `css` is scoped at render time to the block's wrapper (`[data-nv-b="<erc>"]` prefixing) and may use style book variables (`var(--nv-*)`).
- `js` is deferred (v1.1): it needs a sandboxing story before authors can ship arbitrary scripts to visitors.
- Blocks without a template keep the registry/generic rendering path.
- Native components (container, grid, heading, paragraph, button, image, card, separator, spacer, video, html) ship as seeded template blocks with the `nv-` ERC prefix, so users learn from and duplicate them, like Liferay's basic fragments.

Templates are still data (rows + JSONB/text), never dynamic DDL and never server-side code execution: interpolation is escape-only, sanitization rejects scripts and event handlers at write time, and editor prop values are escaped at render time.

## Consequences

- Custom presentation without redeploying, and Liferay-parity inline editing on the canvas becomes possible because templates declare their editable elements.
- The renderer gains a template engine (parse, interpolate, slot splicing) shared by the public route, the studio canvas and the block preview.
- Security surface grows: block authors are permissioned users (block:create), but content editors are not template authors; the escape/sanitize split above keeps editors unable to inject markup.
- v1 template constraints (documented in spec 12): binding attributes only on leaf elements, slots only on empty elements.
