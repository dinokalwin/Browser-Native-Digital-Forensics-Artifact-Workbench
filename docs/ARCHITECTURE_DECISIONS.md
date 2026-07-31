# Architecture Decision Records — DFIR Workbench

A lightweight ADR log: context, decision, consequences. Entries are numbered sequentially and never renumbered or deleted, even once superseded — a superseded entry is marked as such, not removed, so the history of *why* stays intact.

## ADR-001: No backend — fully client-side architecture
**Status:** Accepted
**Context:** Forensic evidence files carry chain-of-custody and confidentiality constraints; uploading them to any server, even one the team controls, introduces a party and a transit path that undermines both.
**Decision:** The entire application — parsing, detection, scoring, summarization, export — runs in the browser. No backend service exists or is planned within current scope.
**Consequences:** No server infrastructure to build or secure, but also no server-side compute available for parsing/analysis — everything must run within browser constraints (main-thread responsiveness, memory limits), which directly motivated ADR-004.

## ADR-002: Rule-based, not ML-based, suspicious-event detection
**Status:** Accepted
**Context:** Findings presented to an analyst may end up referenced in a client report or, in principle, in legal proceedings. An opaque model's output is difficult to defend or explain in that context.
**Decision:** Detection is a fixed set of small, named, independently testable rule functions, each producing findings traceable to a specific rule and, where applicable, a MITRE ATT&CK technique ID.
**Consequences:** Detection coverage is only as good as the rule set — it will miss novel patterns a statistical model might catch — but every finding is fully explainable. This is a deliberate trade-off favoring defensibility over recall.

## ADR-003: Deep-import `@ts-evtx/core`'s pure parsing classes rather than its top-level API
**Status:** Accepted
**Context:** No mature, published npm package parses EVTX in a browser out of the box. `@ts-evtx/core`'s top-level API (`EvtxFile.open()`, etc.) reads files from disk via Node's `fs` module, which does not exist in a browser.
**Decision:** Deep-import only the pure binary/XML parsing classes (`BinaryReader`, `FileHeader`, `ChunkHeader`, `Record`, `BXmlNode`, `TemplateNode`), which operate purely on an in-memory `Uint8Array` with zero Node dependencies. The one resulting incompatibility — a `process.env` read at module scope in the library's internal logger — is neutralized via a documented `patch-package` patch plus a Vite `define` substitution.
**Consequences:** Ties the parser to this package's internal module layout, which could break on an unplanned upstream version bump. The pinned version and the patch must be explicitly reviewed on any dependency upgrade — never bumped blindly.

## ADR-004: EVTX parsing runs in a dedicated Web Worker
**Status:** Accepted
**Context:** Parsing a multi-megabyte EVTX file synchronously on the main thread freezes the UI for the duration — unacceptable beyond small demo files.
**Decision:** Parsing (chunk/record walking, XML rendering, event mapping) runs entirely inside a dedicated Web Worker, communicating via a typed `postMessage` protocol with zero-copy `ArrayBuffer` transfer.
**Consequences:** Adds message-passing complexity (progress/result/error/cancel protocol, worker lifecycle management) in exchange for a UI that stays fully responsive regardless of file size, and enables cancellation/timeout as first-class capabilities.

## ADR-005: Three separate Zustand stores instead of one combined store
**Status:** Accepted
**Context:** A single store combining case data, table view state (search/filter/sort/pagination), and ephemeral UI state would cause unrelated re-renders — e.g. typing in the search box re-rendering components that only read raw event data.
**Decision:** Split state into `evidenceStore` (case data + pipeline status), `filterStore` (table view state), and `uiStore` (ephemeral cross-panel UI state), each consumed via narrow selectors.
**Consequences:** Slightly more boilerplate than a single store, in exchange for re-render isolation that matters once event counts get large.

## ADR-006: Single backend service boundary (`services/evtxApi.ts`)
**Status:** Accepted
**Context:** The analysis engine (`backend/*`) may need a different implementation later (e.g. a WASM-based parser) without that change rippling through every UI component that currently uses it.
**Decision:** Every capability the UI needs from the backend is exposed through exactly one module, `services/evtxApi.ts`. No page or component imports `backend/*` directly.
**Consequences:** One clean seam to swap implementations behind. Requires ongoing discipline — enforced by a lint rule from Phase 1 onward — to keep the "only evtxApi.ts imports backend/*" boundary intact as the codebase grows.

## ADR-007: Never fabricate a timestamp for corrupt FILETIME values
**Status:** Accepted
**Context:** A forensics tool that silently substitutes a plausible-looking fake date for a corrupt timestamp would let a corrupt event masquerade as a real one, corrupting timeline analysis in a way invisible to the analyst.
**Decision:** `record-mapper.ts` falls back to the raw, unparsed `SystemTime` XML attribute string (still real evidence, just unparsed) rather than any fabricated date when `timestampAsDate()` fails or returns an invalid date.
**Consequences:** A small number of events may show an unparsed timestamp string instead of a normalized date in the UI. This is accepted as honest behavior, not treated as a bug to "fix" by guessing a date.

## ADR-008: No client-side persistence of case data by default
**Status:** Accepted
**Context:** Forensic evidence is sensitive; silently caching it in `localStorage`/`IndexedDB` would let it outlive the session on a shared or unmanaged machine without the analyst's explicit awareness.
**Decision:** Zustand stores hold case data in memory only; nothing persists across a reload. Any future local-persistence feature (see SDD §7 Stretch Goals) must be an explicit, opt-in action, never silent or on-by-default.
**Consequences:** A reload loses the current case — an accepted trade-off in exchange for not leaving evidence data resident on disk without the analyst's knowledge.

## ADR-009: shadcn/ui + Radix primitives for interactive components
**Status:** Accepted
**Context:** Building bespoke dropdowns, dialogs, and tooltips correctly — keyboard behavior, focus trapping, ARIA attributes — is easy to get subtly wrong.
**Decision:** Interactive UI elements are built on shadcn/ui, which wraps Radix UI primitives, rather than hand-rolled components.
**Consequences:** Correct accessibility behavior by construction, directly supporting the SDD §21 accessibility strategy, at the cost of depending on a component-generation workflow (`components.json`) rather than a single installed package.

## ADR-010: XML engine inside the parser Worker is fast-xml-parser, not DOMParser
**Status:** Accepted — supersedes the DOMParser-based approach originally used in `record-mapper.ts`.
**Context:** After parsing was moved into a dedicated Web Worker (ADR-004), event mapping silently produced zero usable events despite every chunk and record passing verification. Root-caused via instrumentation to `ReferenceError: DOMParser is not defined` inside `xmlToEvent()`. `DOMParser` is a Web IDL interface marked `[Exposed=Window]` in the DOM Parsing and Serialization spec — it is not exposed to any Worker global scope (dedicated, shared, or service worker), in any browser, by specification. This is not a Vite bug, not a module-vs-classic-worker distinction, and not a `@ts-evtx/core` limitation — `renderXml()` correctly produces valid XML; the failure was entirely in how the project's own code tried to consume that string on a thread with no `document`.
**Alternatives considered:**
| Option | Verdict |
|---|---|
| Move parsing back to the main thread | Rejected — defeats ADR-004, reintroduces main-thread blocking on large files (SDD NFR-2) |
| `linkedom` (lightweight DOM implementation, drop-in `DOMParser`-compatible) | Viable, smallest line-level diff, but heavier (fuller DOM emulation) and architecturally backwards — emulating a DOM inside an environment that fundamentally has none |
| Manual regex/string extraction of the known EVTX XML shape | Rejected — fragile against escaping, attribute ordering, and schema variation; unacceptable correctness risk for a forensics tool |
| **`fast-xml-parser`** | **Adopted** — pure JavaScript, zero DOM dependency (so it's genuinely Worker-native rather than polyfilled), actively maintained, fast on small documents (each EVTX record's rendered XML is a few hundred bytes to a few KB), TypeScript types included |
**Decision:** `record-mapper.ts` now parses `renderXml()`'s output with `fast-xml-parser`'s `XMLParser` (`ignoreAttributes:false`, `attributeNamePrefix:"@_"`, `isArray` forcing `Data` elements to always be an array) plus `XMLValidator.validate()` for malformed-XML detection, replacing `DOMParser` + `getElementsByTagName`/`.textContent`/`.getAttribute`. The function signature (`xmlToEvent(record): EvtxEvent | null`) is unchanged, so no other file in the parsing pipeline required modification.
**Verification:** Both implementations were cross-run against six representative EVTX record shapes (multi-field EventData, single-field EventData, no EventData, UserData instead of EventData, XML-escaped special characters in a PowerShell script block, and truncated/malformed XML) and produced byte-identical output on every case, including a "first friendly field in document order, not priority order" quirk in the original user-resolution logic that had to be preserved exactly, not "corrected." The actual compiled `record-mapper.ts` (not a reimplementation) was also executed directly against sample input to confirm the fix in the real shipped code, not just a model of it.
**Consequences:** Adds `fast-xml-parser` (~63 kB) to the parser Worker's bundle, isolated to that lazy-loaded chunk — no effect on initial page load. `XMLValidator` is deprecated as of fast-xml-parser v5 in favor of a separate `fast-xml-validator` package; kept for now since it's still shipped and functional, avoiding a second new dependency for one call. Revisit if a future major version removes it.
