# Spec 16: Block Studio and source-owned templates

Status: approved for implementation.

## Purpose

The Block Studio edits the persisted source that the delivery renderer consumes. It is not a mockup editor, a code example, or a parallel preview implementation.

## Block template model

Every authorable Block has active `html`, `css`, and optional `js` source. The public renderer and the Block Studio preview both pass those exact values through the same rendering pipeline.

`propsSchema` remains the data contract. Bindings are a projection of the source:

- `{{key}}` interpolates an escaped value.
- `data-nv-text`, `data-nv-rich`, `data-nv-image`, `data-nv-alt`, `data-nv-link`, and `data-nv-embed` bind a schema property.
- `data-nv-slot` binds a declared slot.

The Studio derives detected bindings from HTML and compares them with `propsSchema`. A detected but undeclared key is surfaced as a missing field. A schema property without a binding is surfaced as unused. A user chooses whether to add or remove fields, so editing code never silently destroys schema data.

New custom Blocks start without invented markup. Their author supplies the real source and fields. A blank template renders nothing until it has source.

## Native source and restoration

Native Blocks store two sources:

- active `html`, `css`, and `js`, used by every renderer;
- immutable `nativeHtml`, `nativeCss`, and `nativeJs`, the Neriva-provided baseline.

`templateSource` is `NATIVE` when active source equals the baseline and `CUSTOM` after an edit. `POST /blocks/:id/restore-native-template` restores the active source to the baseline, recomputes `templateSource`, and returns the saved Block. It is not the same operation as discarding an unsaved Studio draft.

The native seed advances its baseline across releases. A Block still using the prior native baseline receives the current native source. A custom source is preserved. Empty active strings left by the former editor are repaired to the native baseline, so no native Block opens with a misleading blank editor.

## Runtime and security

The main render path is template rendering. The renderer must never select a React component by ERC when a Block has a template. Native semantic needs are expressed as safe engine hooks, for example `data-nv-tag` for an allowed heading tag, rather than hidden markup in React.

Collection Blocks declare `data-nv-runtime="content-entries"` or `data-nv-runtime="object-records"` in persisted HTML and use `{{#each entries}}` or `{{#each records}}` for their data region. Runtime configuration is declared in the same source with attributes such as `data-nv-runtime-object-definition="objectDefinition"` and `data-nv-runtime-title-field="titleField"`. Those attribute values are schema bindings: they are detected in Studio and validated against the Block schema, so a data-driven Block does not hide its configuration in a separate renderer.

The generic runtime supplies data and fulfils a narrow set of action intents, then runs the same template engine, so authored markup and CSS remain the source of truth. Runtime JavaScript receives a read-only `Neriva.props` object and a `Neriva.request({ method, path, body })` bridge. The source declares its actual REST paths, for example `POST /object-definitions/:ref/records` and `PATCH /object-records/:id`. The bridge accepts only the Object-record methods and paths declared by the active runtime configuration, validates them against the current loaded records, and performs the authenticated REST call in the host. Direct network access remains unavailable inside the sandbox.

Optional Block JavaScript executes in an opaque-origin iframe with `sandbox="allow-scripts"` and a CSP that denies network access, storage, top-level navigation, and form submission. The script can manipulate its own rendered DOM and may call `parent.postMessage()` for a declared runtime action. The host verifies the iframe origin and action before performing any Objects API request. JavaScript cannot use slots because those are React nodes in the host document. HTML, CSS and JavaScript are validated on write, prop values are escaped or sanitized at render time, and CSS is scoped.

## Studio behavior

The Studio has Code, Fields, and Schema views around a live Preview. On desktop, the Code view is a fixed, four-pane workbench: HTML, CSS, JavaScript, and the live preview. Each source pane scrolls internally, so the author can compare all active sources and the result without scrolling the page. The preview offers desktop, tablet, mobile, and full-width viewports while continuing to use the same renderer as delivery. It shows the active source, draft status, line counts, detected bindings, source validation feedback, and native/custom source status. The visible preview uses authored HTML fallbacks and explicit schema defaults only. A separate, clearly labelled **Test data** control may supply temporary props for the standalone preview. Those values are never written into source, schema, or a page instance, and never appear as invented content below the preview.

- Save persists HTML, CSS, JavaScript, schema and Block metadata together.
- Reset changes restores the last saved payload locally.
- Restore native template is a persisted API operation for native Blocks.
- Leaving while dirty warns the author.
- The Preview constructs a temporary Block definition and uses `RenderTree`, the same component used by public pages.

## Migration note

`nv-post-list` and `nv-todo-list` are migrated to template-owned collection markup. Their former ERC-specific React renderers are removed from the primary render path. No new Block may use an ERC-specific renderer as its primary rendering mechanism.
