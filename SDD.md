# Software Design Document
## Browser-Native Digital Forensics Artifact Workbench (DFIR Workbench)

**Version:** 1.0
**Date:** 2026-07-31
**Author:** Principal Architecture Review (prepared for Jacob)
**Status:** Baseline blueprint, reconciled against the existing codebase

---

## 1. Executive Summary

DFIR Workbench is a single-page web application that lets a digital forensics or incident-response analyst upload a Windows Event Log (`.evtx`) file and get parsing, triage, and analysis entirely inside the browser — no server, no upload, no installation. The parsed events, the rule-based suspicious-activity findings derived from them, and the case-level risk score never leave the analyst's machine.

This document is the architectural blueprint for the project going forward. It is written against, and reconciled with, the codebase that already exists at the project root (React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Zustand + React Router, with a working EVTX parser, rule-based detection engine, dashboard, evidence table, timeline, and CSV/JSON export). That existing implementation is treated as the delivered baseline for Phases 0–7 of the roadmap in Section 25; this SDD formalizes its architecture as the standing design and defines the phases that follow it — hardening, testing, accessibility, and performance at scale — rather than re-architecting from zero.

Nothing in this document authorizes new code. It is the reference the team builds against, phase by phase, per the project's development rules.

## 2. Problem Statement Analysis

Windows Event Logs are one of the most common artifacts in an incident-response investigation — they record logons, process execution (via Sysmon/PowerShell logging), account and privilege changes, service installs, and audit-log tampering. Today, an analyst who wants to inspect a `.evtx` file exported from a compromised or suspect host has three broad options, each with a real drawback for the DFIR context specifically:

- **Native Windows Event Viewer** — only available on Windows, has no cross-event search/filter beyond XPath queries, no timeline view, no automated triage, and no export tailored to case work.
- **Desktop forensic suites** (e.g. commercial DFIR platforms, `python-evtx` + custom scripts) — powerful, but require installation, licensing, or a Python environment, and are typically used by the analyst on their own workstation, meaning the evidence file has to leave the acquisition environment and be copied onto tooling that is not itself under chain-of-custody control.
- **Cloud/SaaS log-analysis platforms** — convenient, but require uploading the evidence file to a third party. For forensic evidence this is frequently a non-starter: it can violate chain-of-custody requirements, client confidentiality agreements, or jurisdictional data-handling rules, and it introduces a party (the SaaS vendor) with no forensic accountability.

The gap is a tool that offers meaningful triage — not just raw record viewing — without requiring installation and without the evidence file ever transiting a network. A browser tab satisfies both constraints simultaneously: it needs no install, and if the parsing and analysis genuinely run client-side (verifiable by watching the Network tab during use), the evidence file never leaves the analyst's machine. That verifiability is itself a requirement, not a nice-to-have — an analyst should be able to prove to a client or to opposing counsel that no data left the browser.

The secondary problem this project solves is **triage speed**. A raw event table over tens of thousands of records is not, by itself, useful in the first five minutes of looking at a case. An analyst needs an immediate answer to "is anything here worth looking at, and where do I start" — which is what the dashboard, rule-based suspicious-event detection, and risk score are for.

## 3. Project Objectives

1. Parse real-world `.evtx` files — including files that are dirty, partially overwritten, or not cleanly closed, which is the norm for forensic acquisitions rather than the exception — entirely in the browser, with no server round-trip.
2. Surface a fast, defensible first read of a case: total event volume, severity breakdown, a 0–100 risk score, and a short narrative summary, all derived transparently from named, explainable rules rather than an opaque model.
3. Give the analyst a full-fidelity, searchable, filterable, sortable evidence table and a chronological timeline for deeper manual review, with cross-linking between findings, the table, and the timeline.
4. Let the analyst export whatever they are currently looking at (filtered/searched subset or full set) as CSV or JSON for inclusion in a report or downstream tooling.
5. Guarantee, architecturally, that no evidence data is ever transmitted off the device — no backend, no analytics beacon, no third-party API call that includes event content.
6. Keep the codebase strictly typed, modular, and phase-buildable, so the project can grow (more detection rules, more log types, larger files) without rewrites.
7. Ship a UI an analyst would trust in front of a client — not a hackathon prototype look, but a purpose-built SOC/DFIR-style interface.

## 4. Functional Requirements

**File ingestion**
- FR-1: The user can upload a `.evtx` file via drag-and-drop or a file picker on the landing page.
- FR-2: The application validates the file is plausibly a well-formed EVTX file (minimum size, header signature/checksum) before committing to a full parse, and reports a specific, actionable error if it is not.
- FR-3: Parsing runs off the UI thread; the UI remains responsive and shows live progress (chunks processed / events parsed so far) for the duration of the parse.
- FR-4: A parse that fails partway (corrupt chunk, unsupported record variant) recovers everything it can rather than aborting the whole file, and reports diagnostics on how much was recoverable.

**Dashboard / triage**
- FR-5: On successful parse, the analyst is shown a case dashboard with total/critical/warning/informational event counts.
- FR-6: The dashboard shows a 0–100 risk score with a qualitative level (low/medium/high/critical), derived deterministically from the severity and count of suspicious findings.
- FR-7: The dashboard lists every suspicious finding with a plain-English description, a severity, and — where applicable — a MITRE ATT&CK technique reference.
- FR-8: The dashboard shows an auto-generated investigation summary: headline, narrative, key findings, affected hosts, and the case's time range.
- FR-9: Clicking a suspicious finding navigates to the Evidence Viewer with the triggering event selected and in view.

**Evidence review**
- FR-10: The analyst can view every parsed event in a paginated, sortable table (timestamp, event ID, provider, computer, user, level, channel, message).
- FR-11: The analyst can free-text search across event fields, and filter by event ID, provider, level, channel, and a date range, in combination.
- FR-12: The analyst can select one or more rows for export or further action.
- FR-13: The analyst can export the currently filtered/searched result set (not necessarily the full case) as CSV or JSON.
- FR-14: The analyst can view a chronological, day-grouped timeline of all events, color-coded by severity, with the same cross-linking as the table.

**Application shell**
- FR-15: The analyst can toggle between dark and light themes.
- FR-16: The layout is fully usable from a phone-width viewport up through a wide desktop monitor.
- FR-17: Navigating between dashboard sub-views (Overview / Evidence Viewer / Timeline) never re-parses or re-fetches the case — it only changes which view is rendered, since all case data lives in client-side state.
- FR-18: The application clearly communicates its current state at all times: no case loaded, parsing, analyzing, ready, or error.

## 5. Non-Functional Requirements

- **NFR-1 (Privacy/Chain of Custody):** No network request may ever include event content, file bytes, or derived case data. This must be independently verifiable by inspecting the browser's Network tab during a full upload-to-export workflow.
- **NFR-2 (Performance):** The UI thread must remain interactive throughout parsing of files up to at least the tens-of-megabytes range; parsing runs in a Web Worker with periodic progress reporting, never blocking input or animation.
- **NFR-3 (Resilience):** A malformed or partially corrupted file must degrade gracefully — partial results plus diagnostics, never a silent empty result or an unhandled crash.
- **NFR-4 (Type Safety):** The codebase uses strict TypeScript throughout; `any` is disallowed. Domain types (events, findings, scores) are the single source of truth shared between the parsing layer, the analysis layer, and the UI.
- **NFR-5 (Maintainability):** UI, business/analysis logic, the parsing engine, and state management are kept in clearly separated layers so a change to one (e.g. swapping the parser implementation) does not require touching the others.
- **NFR-6 (Browser Compatibility):** The application targets current evergreen browsers (Chrome, Edge, Firefox, Safari) that support Web Workers, the File API, and ES2020+. No IE11 or legacy-browser support is required.
- **NFR-7 (Portability/Hosting):** The build output is a fully static bundle deployable to any static host or CDN, with no environment variables or server-side configuration required.
- **NFR-8 (Accuracy of Representation):** The tool must never fabricate data to fill a gap — e.g. a corrupt timestamp must never be silently replaced with a plausible-looking fake date, since that would corrupt timeline analysis in a way invisible to the analyst.
- **NFR-9 (Accessibility):** Core workflows (upload, review, export) must be usable via keyboard alone and be screen-reader navigable, per Section 21.
- **NFR-10 (Auditability):** Every automated finding must trace back to a specific, named, inspectable rule — never an unexplained score or black-box classification.

## 6. Scope

### In Scope
- Client-side parsing of single `.evtx` files (Windows Event Log, all channels — Security, System, Application, PowerShell operational logs, Sysmon, etc.).
- Rule-based suspicious-event detection and a derived case risk score.
- An auto-generated, deterministic (non-LLM) investigation summary.
- Full-fidelity evidence table with search, filter, sort, pagination, and row selection.
- Chronological timeline view.
- CSV and JSON export of the current (filtered) result set.
- Responsive, themeable (dark/light) UI.
- Static-site deployment (no backend infrastructure).

### Out of Scope (for this SDD's planning horizon)
- Any backend service, API, authentication, or user accounts.
- Persistent, cross-session case storage (a reload starts a new session; nothing is written to a database).
- Multi-file or multi-case correlation within a single session (one loaded case at a time).
- Log formats other than EVTX (e.g. Syslog, JSON logs, `.etl` traces) — a future extension point, not current scope.
- Machine-learning-based or statistical anomaly detection — detection is explicitly rule-based and explainable.
- SID-to-username resolution (requires AD/SAM access unavailable to a browser sandbox).
- Message-catalog-accurate event message rendering (Windows composes final message text from provider DLLs on the source machine at view time; this tool reconstructs a best-effort message from structured event data instead).
- Report generation beyond raw CSV/JSON export (e.g. formatted PDF case reports) — noted as a candidate for a later phase, not current scope.
- Collaboration features (comments, shared cases, multi-analyst review).

## 7. Final Feature List

### Must Have
- Drag-and-drop / file-picker `.evtx` upload with validation and progress reporting.
- Worker-based, resilient EVTX parsing (chunk/record-level fault tolerance).
- Case dashboard: stat cards, risk score, suspicious findings panel, investigation summary.
- Rule-based suspicious-event detection covering, at minimum: cleared audit log, brute-force logon, new account, group-membership change, new service, Defender detection, suspicious PowerShell activity, explicit-credential logon, privileged logon, account lockout.
- Evidence table: search, multi-field filter, sort, pagination, row selection.
- CSV and JSON export respecting active filters.
- Timeline view, day-grouped, severity color-coded.
- Cross-panel linking (finding → event in table/timeline).
- Dark/light theme.
- Fully responsive layout (mobile through desktop).
- Static, backend-free deployment.

### Nice to Have
- Automated test suite (unit tests for parser resilience, detection rules, risk scoring; component tests for critical UI flows).
- Configurable/extensible detection rule set (e.g. a rules panel to enable/disable individual heuristics).
- Event detail drill-down panel showing the full rendered XML for a single event.
- Saved filter presets within a session.
- Virtualized table rendering for very large event sets (100k+ rows) to reduce DOM overhead.
- Basic case notes (session-local, not persisted) an analyst can attach to a finding or event.
- Printable/exportable case summary (formatted single-page report of the dashboard view).

### Stretch Goals
- Additional log-source parsers (Sysmon-specific enrichment, `.etl` support) behind the same `EvtxEvent`-shaped contract.
- Multi-file case correlation (load several `.evtx` exports from the same host/incident as one case).
- WASM-based parsing core for a performance uplift on very large files.
- Local-only case persistence via the browser's IndexedDB (still zero-server, but survives a reload) — would require an explicit, opt-in "save case locally" action given the sensitivity of the data.
- Pluggable detection-rule packs (e.g. a MITRE ATT&CK–organized rule library an analyst can import).
- Offline-first / installable PWA packaging.

## 8. User Personas

**Primary: Incident Response Analyst ("Dana")**
A DFIR consultant or in-house security analyst who receives `.evtx` exports from client or internal hosts during an active investigation. Time-pressured, needs a fast first read before deciding where to dig deeper. Cares deeply about defensibility — every claim the tool makes needs to be traceable to evidence, because findings may end up referenced in a report to a client or in litigation. Often working on a locked-down laptop where installing new desktop software is restricted or requires approval, but a browser is always available.

**Secondary: SOC Tier-1/2 Analyst ("Marcus")**
Works triage queues, occasionally needs to inspect an exported event log from an endpoint flagging in the SIEM to confirm or rule out an alert. Less deep forensic training than Dana; benefits most from the dashboard's plain-English findings and risk score rather than raw record inspection.

**Tertiary: Security Researcher / Student ("Priya")**
Uses the tool to learn what real attack patterns look like in Windows Event Logs (e.g. working through public DFIR training datasets or CTF artifacts). Values the transparency of the rule-based detection — being able to see exactly which rule fired and why is itself the learning value.

## 9. User Journey

1. **Arrival** — Analyst opens the app (a URL, no login). Landing page states plainly that everything runs client-side and nothing is uploaded, with the upload drop zone front and center.
2. **Upload** — Drags a `.evtx` file onto the drop zone (or browses for one). A toast and inline status confirm the file was accepted and parsing has begun.
3. **Parsing** — A progress indicator shows chunks/events processed; the UI stays interactive. On completion, the analyst is routed to the dashboard automatically; on failure, an explanatory error with next-step guidance is shown in place of the dashboard.
4. **Triage (Dashboard)** — Analyst scans stat cards and the risk score first, then the suspicious findings panel. Each finding reads as a sentence an analyst could paste into a report draft. Clicking a finding jumps to the specific event.
5. **Deep review (Evidence Viewer)** — Analyst searches/filters (e.g. by event ID 4625, or a specific computer name) to manually verify or expand on what the findings panel surfaced. Sorts by timestamp to reconstruct a sequence of actions.
6. **Timeline cross-check** — Analyst switches to the timeline to see the chronological shape of activity across the whole case, not just the events a filter currently matches.
7. **Export** — Analyst narrows the evidence table to the events relevant to their report, exports as CSV (for a spreadsheet-based report) or JSON (for downstream tooling), and leaves the browser tab — nothing persists, nothing was ever sent anywhere.
8. **Repeat / next case** — Analyst uploads a new file, which resets all case state and starts the journey over.

## 10. Information Architecture

```
Landing (/)
  └─ Upload entry point — no case loaded yet

Dashboard shell (/dashboard) — only reachable once a case is loaded
  ├─ Overview (/dashboard)            — stat cards, risk score, findings, summary
  ├─ Evidence Viewer (/dashboard/evidence) — full searchable/filterable table
  └─ Timeline (/dashboard/timeline)   — chronological view

Not Found (*)
```

The information hierarchy is deliberately shallow — three sibling views under one shell, no nested drill-down routes — because case data is held in shared client state rather than fetched per route. Depth is added within a view (e.g. filtering the table, expanding a finding) rather than through additional route levels, keeping navigation predictable and bookmarkable-in-spirit even though case state itself isn't persisted across a hard reload.

## 11. System Architecture

The application is a single static bundle with four cleanly separated layers, all running in the browser:

**1. Presentation layer (React components + pages)** — renders state, captures user interaction, contains no parsing or analysis logic itself.

**2. State layer (Zustand stores)** — the single source of truth for the currently loaded case, view/filter state, and ephemeral UI state. Components read via selectors; no component reaches into the parsing or analysis layer directly.

**3. Service boundary (`services/evtxApi`)** — the one seam between the UI/state layer and the analysis engine. Every capability the UI needs (`parseEVTX`, `detectSuspicious`, `generateInvestigationSummary`, `exportCSV`, `exportJSON`) is exposed through this single module, which re-exports from the backend layer. This is what makes the parsing engine swappable (e.g. a future WASM parser) without touching UI or state code.

**4. Analysis/engine layer (`backend/*`)** — pure, framework-free TypeScript:
   - the EVTX parsing engine, running inside a dedicated Web Worker so a multi-second parse never blocks the main thread;
   - the rule-based suspicious-event detector;
   - the risk-scoring model;
   - the investigation-summary generator;
   - the CSV/JSON exporters.

There is no fifth layer. There is no server tier, no API gateway, no database — the "backend" name refers only to this in-browser analysis layer, not a networked service. Communication between the main thread and the parsing worker uses `postMessage` with transferable `ArrayBuffer`s (zero-copy handoff of the file's bytes) and a typed message protocol (`PARSE` / `PROGRESS` / `RESULT` / `ERROR` / `CANCEL`).

```
 ┌─────────────────────────────────────────────────────────────┐
 │                        Browser tab                            │
 │                                                                 │
 │  ┌───────────────┐   ┌───────────────┐   ┌──────────────────┐ │
 │  │  Presentation  │──▶│  State layer  │──▶│  Service boundary │ │
 │  │ (pages/comps)  │◀──│  (Zustand)    │◀──│  (evtxApi)         │ │
 │  └───────────────┘   └───────────────┘   └─────────┬─────────┘ │
 │                                                       │           │
 │                                          ┌────────────▼─────────┐ │
 │                                          │  Analysis engine      │ │
 │                                          │  (backend/*, mostly    │ │
 │                                          │   pure functions)      │ │
 │                                          └────────────┬─────────┘ │
 │                                                       │           │
 │                                          ┌────────────▼─────────┐ │
 │                                          │  Parser Web Worker     │ │
 │                                          │  (binary EVTX walk +    │ │
 │                                          │   XML → EvtxEvent map)  │ │
 │                                          └────────────────────────┘ │
 │                                                                 │
 └─────────────────────────────────────────────────────────────┘
              No network egress carrying case data, ever.
```

## 12. Folder Structure

```
dfir-workbench/
├── src/
│   ├── pages/         Route-level pages (Landing, Dashboard, Evidence Viewer, Timeline, NotFound)
│   ├── layouts/        AppShell (navbar + sidebar + routed content area)
│   ├── routes/          Route table (React Router route definitions)
│   ├── components/
│   │   ├── ui/           shadcn/ui primitives (button, card, table, dialog, ...)
│   │   ├── layout/        Navbar, Sidebar, MobileSidebar, PageHeader, Brand
│   │   ├── landing/       Hero, feature cards, footer
│   │   ├── upload/         DropZone
│   │   ├── evidence/       Table, toolbar, pagination, export controls, columns, state gate
│   │   ├── dashboard/      Stat cards, risk score card, suspicious events panel, summary panel
│   │   ├── timeline/       EventTimeline
│   │   ├── theme/           Theme provider + toggle
│   │   └── feedback/        EmptyState, ErrorBoundary, loading fallbacks
│   ├── store/            evidenceStore, filterStore, uiStore (Zustand, one file each)
│   ├── services/          evtxApi.ts — the only module UI code imports for backend capability
│   ├── backend/            Analysis engine
│   │   ├── engine/          parser.ts, parser.worker.ts, worker-client.ts, record-mapper.ts
│   │   ├── evtx-parser.ts   Public parse entry point (delegates to engine/worker-client)
│   │   ├── suspicious-detection.ts
│   │   ├── risk-score.ts
│   │   ├── investigation-summary.ts
│   │   ├── csv-export.ts
│   │   ├── json-export.ts
│   │   └── index.ts         The one exported contract surface for this whole layer
│   ├── types/              Shared domain types (EvtxEvent, SuspiciousFinding, RiskScore, ...)
│   ├── hooks/               Cross-cutting React hooks
│   ├── lib/                 cn() class-merge helper, download-blob utility, dev mock data
│   ├── utils/                Small framework-free helpers
│   ├── assets/
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
├── patches/                patch-package patches for @ts-evtx/core browser-compat fix
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json / tsconfig.node.json
├── components.json          shadcn/ui config
├── vercel.json               SPA rewrite rule for static hosting
└── package.json
```

This structure is already in place and is treated as settled — future phases add files within these boundaries rather than reshaping them. The one rule that keeps the architecture from eroding: **only `services/evtxApi.ts` imports from `backend/`.** No page or component is permitted to import a `backend/*` module directly; this is what keeps the analysis engine swappable.

## 13. Component Hierarchy

```
main.tsx
└─ RouterProvider (routes/index.tsx)
   ├─ LandingPage                          [/]
   │  ├─ LandingHero
   │  ├─ DropZone
   │  ├─ FeatureCards
   │  └─ LandingFooter
   │
   └─ AppShell                             [/dashboard/*]
      ├─ Sidebar / MobileSidebar (nav from nav-items.ts)
      ├─ Navbar (Brand, ThemeToggle)
      └─ <Outlet> (Suspense-wrapped)
         ├─ DashboardPage                  [/dashboard]
         │  └─ CaseStateGate
         │     ├─ SummaryCards → StatCard ×4
         │     ├─ RiskScoreCard
         │     ├─ SuspiciousEventsPanel
         │     └─ InvestigationSummaryPanel
         │
         ├─ EvidenceViewerPage             [/dashboard/evidence]
         │  └─ CaseStateGate
         │     ├─ EvidenceTableToolbar (search, filters, ExportControls)
         │     ├─ EvidenceTable (columns.tsx, SortableHeader, level-badge)
         │     │  └─ EvidenceTableSkeleton (loading state)
         │     └─ EvidenceTablePagination
         │
         └─ TimelinePage                   [/dashboard/timeline]
            └─ CaseStateGate
               └─ EventTimeline

   NotFoundPage                            [*]  — outside AppShell/Suspense

Cross-cutting, mounted at shell/page level as needed:
  ErrorBoundary, EmptyState, PageLoadingFallback, PageHeader, CaseStatusBadge
```

`CaseStateGate` is a shared structural component — every case-dependent page (Dashboard, Evidence Viewer, Timeline) delegates the no-case / parsing / error / ready branching to it instead of duplicating that four-way switch, so the empty/error/loading treatment only has one place to change.

## 14. Routing Structure

| Path | Element | Access | Notes |
|---|---|---|---|
| `/` | `LandingPage` | Always | Upload entry point; statically imported (no code-split, it's the first thing every visitor loads). |
| `/dashboard` | `AppShell` → `DashboardPage` (index) | Requires a loaded case (else `CaseStateGate` shows an empty state, not a redirect) | Lazy-loaded. |
| `/dashboard/evidence` | `AppShell` → `EvidenceViewerPage` | Same | Lazy-loaded. |
| `/dashboard/timeline` | `AppShell` → `TimelinePage` | Same | Lazy-loaded. |
| `*` | `NotFoundPage` | Always | Statically imported, rendered outside `AppShell`'s Suspense boundary. |

Design decisions:
- **No case data lives in route params or loaders.** Case state is entirely in `evidenceStore`, so navigating between the three dashboard sub-routes only swaps which panel renders — it never re-parses or re-fetches anything.
- **No case is not a hard redirect.** Visiting `/dashboard/evidence` with nothing loaded renders the page shell with an empty state and a link back to upload, rather than bouncing the user — this keeps direct links/bookmarks and back-button behavior predictable.
- **Client-side routing (`BrowserRouter`) requires a host-level rewrite** (already codified in `vercel.json`) so a hard refresh on a nested path doesn't 404 against the static host.
- **Code-splitting boundary is the dashboard shell.** Everything the landing page doesn't need (TanStack Table, the dashboard panels, and — transitively — the parser's dependency chain) is deferred until a case is actually loaded.

## 15. State Management Strategy

State is split into three independent Zustand stores, each with a single, narrow responsibility, so that a state change in one never causes unrelated re-renders in components that only consume another:

- **`evidenceStore`** — the source of truth for the loaded case: uploaded file metadata, parsed events, suspicious findings, investigation summary, and the pipeline's `LoadStatus` (`idle | parsing | analyzing | ready | error`) and error message. Owns the single orchestration action, `loadFile`, which drives the file through parse → detect → summarize and commits state after each stage. Detection/summary failures are caught independently of parse failures and degrade to empty results rather than failing the whole case — a bug in a detection rule must never undo an otherwise-successful parse.
- **`filterStore`** — view state for the evidence table only: search query, active column filters, sort state, and pagination. Deliberately isolated from `evidenceStore` so that typing in the search box never re-renders components that only read raw event data.
- **`uiStore`** — ephemeral, non-persisted UI state: sidebar collapse state, mobile nav drawer visibility, and the currently selected event (which drives cross-linking between the findings panel, the table, and the timeline).

Conventions carried forward:
- Every store uses the `devtools` middleware for inspectability during development.
- Components subscribe via narrow selectors (e.g. `selectEvents`, `selectStatus`) rather than destructuring the whole store, to minimize re-render surface.
- No store uses persistence middleware today — a fresh page load starts a fresh session with no case loaded. Any future "save case locally" capability (see Section 7, Stretch Goals) must be an explicit, opt-in action given the sensitivity of forensic data, never silent `localStorage`/`IndexedDB` persistence of case content.
- Server state and client UI state are never mixed in the same store — moot today (there is no server state), but the boundary is kept in case a future phase introduces any fetched data (e.g. a downloadable rule pack).

## 16. EVTX Parsing Pipeline

```
File (browser File object)
   │
   ▼
file.arrayBuffer()                              [main thread]
   │
   ▼  postMessage(buffer, [transfer])            zero-copy handoff
   ▼
Parser Web Worker spawned/reused                 [worker-client.ts]
   │
   ▼
FileHeader validation                             [engine/parser.ts]
   • minimum size check (≥ 4096 bytes)
   • EVTX signature + checksum verification
   • on failure: specific, actionable error — never a silent empty result
   │
   ▼
Chunk walk (header.chunks(includeInactive: true))
   • includeInactive=true: recovers chunks a not-cleanly-closed file
     allocated but never marked fully committed — maximum recovery,
     appropriate for forensic material rather than a live log reader
   • manually-driven iterator (not for...of) so one chunk's enumeration
     failure can't abort every remaining chunk in the file
   • per-chunk checksum verification; invalid chunks are skipped, not fatal
   │
   ▼
Record walk (chunk.records()), per valid chunk
   • manually-driven iterator, same resilience rationale as chunk walk
   • per-record verification; a single malformed record (bad BXML token,
     unresolved template, truncated substitution array) is skipped, never
     fatal to the chunk or file
   • yields to the event loop every N records (default 500) so the worker
     itself stays responsive to progress/cancel messages on large files
   │
   ▼
XML rendering + mapping (record.renderXml() → xmlToEvent())  [record-mapper.ts]
   • fast-xml-parser-based (not DOMParser — DOMParser is [Exposed=Window]
     only and unavailable in the Web Worker this file runs in, by spec, in
     every browser); output is never attached to the live DOM and never
     rendered via innerHTML — read only via typed accessor helpers
   • System/EventData/UserData fields mapped to the EvtxEvent shape
   • level mapped via the standard Windows level table (0/1/2/3/4/5)
   • timestamp: record.timestampAsDate() preferred; on a corrupt FILETIME,
     falls back to the raw SystemTime XML attribute string, never to a
     fabricated date — a corrupt timestamp must stay visibly corrupt
   • message: reconstructed from EventData/Data elements when no message
     catalog is available (mirrors Event Viewer's own fallback behavior)
   • user: resolved from well-known friendly-name fields
     (TargetUserName/SubjectUserName/AccountName/UserName) when present,
     else the raw Security UserID (a SID)
   │
   ▼
EvtxEvent[]  ── PROGRESS messages throughout, RESULT on completion
   │
   ▼  postMessage back to main thread
   │
evidenceStore.loadFile() commits events, moves status → "analyzing"
```

**Diagnostics on total failure.** If a file produces zero events despite having chunks, the parser reports exactly how far it got — chunks walked, chunks that passed checksum, records attempted, records verified, records successfully mapped — and a specific hypothesis (all chunks failed checksum → likely not a genuine/complete EVTX file; chunks fine but no records verified → corrupted record structure; records verified but XML mapping failed → an unsupported BinXML template variant). This turns "parsing failed" from a dead end into an actionable diagnostic for the analyst.

**Timeout and cancellation.** A parse that hasn't completed within a bounded timeout (default 2 minutes) is cancelled and the worker instructed to abort, guarding against a pathological or adversarial file hanging the session. The worker is spawned lazily on first use and reused across subsequent files in the same session rather than respawned per file.

## 17. Evidence Processing Pipeline

Once `EvtxEvent[]` is available, a second, independent pipeline runs to turn raw evidence into analyst-facing findings. This pipeline is deliberately **rule-based and deterministic** — every output must be traceable to a named rule, with no ML/statistical component, so a finding is always explainable in a report or under cross-examination.

```
EvtxEvent[]
   │
   ▼
detectSuspiciousEvents(events)                    [suspicious-detection.ts]
   • a fixed list of independent, named rule functions, each scanning the
     full event set and emitting zero or more SuspiciousFinding records
   • current baseline rule set:
       - cleared audit log (event 1102)                         — critical
       - brute-force logon (5+ failed 4625s / user+host / 15-min sliding window) — critical
       - suspicious PowerShell activity (4103/4104 pattern match: encoded
         commands, remote download cmdlets, IEX, base64 decode, hidden
         window, execution-policy bypass)                        — critical
       - Windows Defender detection (event 1116)                 — critical
       - new local user account created (event 4720)             — warning
       - security-group membership change (events 4728/4732)     — warning
       - new service installed (events 7045/4697)                — warning
       - account locked out (event 4740)                         — warning
       - explicit-credential logon (event 4648)                  — informational
       - privileged logon (event 4672)                           — informational
   • findings sorted most-severe-first for presentation
   • a bug or exception in any single rule must not abort the others —
     each rule's output is independent and additive
   │
   ▼
computeRiskScore(findings)                        [risk-score.ts]
   • pure function: severity → weight (critical 22, warning 9,
     informational 2), summed and capped at 100
   • banded into a qualitative level: low (0–14) / medium (15–44) /
     high (45–74) / critical (75–100)
   • swappable in isolation — no caller depends on the weighting scheme,
     only on the RiskScore shape
   │
   ▼
generateSummary(events, findings)                 [investigation-summary.ts]
   • composes a headline, a short narrative, up to 5 key findings (or,
     if none, basic case stats), the list of affected hosts, the case's
     time range, and the computed risk score
   • entirely template-driven from real numbers — no external call, no
     LLM, fully deterministic and reproducible for the same input
   │
   ▼
evidenceStore commits: suspiciousFindings, investigationSummary
status → "ready"
```

**Export sub-pipeline**, invoked on demand rather than as part of the load pipeline:

```
Evidence table's current view (post search + filter, from filterStore)
   │
   ▼
exportCSV(events) / exportJSON(events)            [csv-export.ts / json-export.ts]
   │
   ▼
Blob → download-blob.ts → browser file-save prompt
```

The export functions operate on whatever event array they are given by the caller — the UI is responsible for passing the filtered subset when the analyst wants "export what I'm looking at" rather than "export everything," per FR-13.

## 18. Data Models (TypeScript Interfaces)

These are the shared domain types — the contract between the parsing engine, the analysis engine, and the UI. They already exist in `src/types/evidence.ts` and are treated as stable; changes to this contract are cross-cutting and should be made deliberately, not incidentally.

```typescript
type EventLevel = "Critical" | "Error" | "Warning" | "Information" | "Verbose";

interface EvtxEvent {
  id: string;                // stable id, derived from the record number
  timestamp: string;         // ISO 8601; never fabricated — see Section 16
  eventId: number;
  provider: string;
  computer: string;
  user: string;               // friendly name if resolvable, else raw SID
  level: EventLevel;
  channel: string;
  message: string;            // reconstructed, not catalog-authoritative
  raw?: unknown;               // opaque payload (rendered XML) for drill-down
}

type SuspicionSeverity = "critical" | "warning" | "informational";

interface SuspiciousFinding {
  id: string;
  eventId: string;             // foreign key -> EvtxEvent.id
  title: string;
  description: string;
  severity: SuspicionSeverity;
  mitreTechnique?: string;      // e.g. "T1110"
}

type RiskLevel = "low" | "medium" | "high" | "critical";

interface RiskScore {
  score: number;                // 0-100
  level: RiskLevel;
}

interface InvestigationSummary {
  generatedAt: string;          // ISO 8601
  headline: string;
  narrative: string;
  keyFindings: string[];
  affectedHosts: string[];
  timeRange: { start: string; end: string };
  riskScore: RiskScore;
}

interface UploadedFileMeta {
  name: string;
  sizeBytes: number;
  uploadedAt: string;           // ISO 8601
}

type LoadStatus = "idle" | "parsing" | "analyzing" | "ready" | "error";

interface DateRange {
  start: string | null;
  end: string | null;
}

interface EvidenceFilters {
  eventId: number | null;
  provider: string | null;
  level: EventLevel | null;
  channel: string | null;
  dateRange: DateRange;
}

type ExportFormat = "csv" | "json";
```

Design notes:
- `EvtxEvent.raw` is intentionally `unknown`, not a typed structure — it exists purely for opaque drill-down/debug display, and typing it against the parser library's internal record shape would leak an implementation detail into the domain contract.
- `SuspiciousFinding.eventId` is a soft foreign key (string match against `EvtxEvent.id`), not a database relation — appropriate for an in-memory, single-session dataset.
- Every timestamp in the model is an ISO 8601 string, not a `Date` object, so the store remains trivially serializable (relevant for `devtools` middleware and any future export/persistence work).

## 19. UI/UX Design Guidelines

**Visual identity.** A dark, SOC/DFIR-analyst-console aesthetic by default (with a fully-supported light theme, not an afterthought) — dense information display without feeling cluttered, favoring data legibility over decoration. Severity is communicated primarily through consistent color coding (critical/error = red spectrum, warning = amber, information = blue/neutral, verbose = muted), applied consistently across stat cards, badges, findings, and the timeline so an analyst never has to re-learn the color language between views.

**Component system.** shadcn/ui (Radix primitives) + Tailwind utility classes, so every interactive control (dialogs, dropdowns, tooltips, checkboxes) has correct keyboard and ARIA behavior by construction rather than bespoke reimplementation.

**Information density with escape hatches.** The dashboard leads with the smallest number of high-signal facts (counts, risk score, top findings) an analyst needs to decide where to look next; full-fidelity detail (every field of every event) lives one click away in the Evidence Viewer, never crammed onto the dashboard itself.

**State always visible.** The current case status (no case / parsing / analyzing / ready / error) is always shown via a persistent badge in the page header, not just a transient toast — an analyst switching tabs and coming back should immediately know where things stand.

**Motion with restraint.** Framer Motion is used for state transitions (panel mount/unmount, progress indication) to reinforce what changed, not for decoration; motion must respect `prefers-reduced-motion`.

**Responsive behavior.** Sidebar collapses to an icon rail on medium viewports and to a slide-out drawer (Sheet) on mobile; the evidence table progressively hides lower-priority columns before it ever requires horizontal scrolling; dashboard cards restack from a multi-column grid to a single column.

**Empty and error states are first-class content**, not placeholders — every case-dependent view has a purpose-written empty/error state (via `EmptyState` + `CaseStateGate`) with a clear next action (e.g. "Upload a case file"), never a bare blank screen.

## 20. Performance Strategy

- **Off-main-thread parsing.** All EVTX parsing runs in a dedicated Web Worker; the main thread only ever handles a transferable `ArrayBuffer` handoff and progress/result messages, keeping input, animation, and layout fully responsive during a parse regardless of file size.
- **Zero-copy buffer transfer.** The file's `ArrayBuffer` is transferred (not structured-cloned) to the worker via `postMessage`'s transfer list, avoiding a full memory copy of potentially large evidence files.
- **Yielding within the parse loop.** The worker itself yields to its own event loop every N records (default 500) so it remains responsive to progress and cancellation messages even mid-chunk on a large file.
- **Route-level code splitting.** The landing page (the one route every visitor hits first) ships without TanStack Table, the dashboard panel components, or the parser's dependency chain — those are lazy-loaded only once a case is actually being loaded, via dynamic `import()` at the route and store level.
- **Bounded, cancellable work.** A hard timeout (default 2 minutes, configurable) guards against a pathological file monopolizing the worker indefinitely; an `AbortSignal`-based cancellation path exists end-to-end from caller to worker.
- **Selector-scoped state subscriptions.** Zustand selectors keep re-renders scoped to the components that actually depend on the changed slice (e.g. typing in search never re-renders the raw event list consumers).
- **Planned next steps (Nice to Have, Section 7):** virtualized rendering for the evidence table once event counts regularly exceed the tens of thousands, and profiling to determine whether a persistent worker pool (vs. the current single reused worker) is warranted for very large files.

## 21. Accessibility Strategy

- **Keyboard operability.** Every workflow — upload, filter, sort, select, export, navigate between views — must be completable without a mouse. shadcn/ui's Radix-based primitives provide correct focus trapping, roving tabindex, and keyboard activation out of the box for menus, dialogs, and the mobile nav drawer.
- **Skip link.** `AppShell` provides a "Skip to content" link, visually hidden until focused, so keyboard users can bypass the sidebar/navbar on every page.
- **Semantic structure.** Tables use real `<table>` semantics (via the shared `Table` primitive) rather than div-grids, so screen readers announce row/column structure correctly; headings follow a logical, non-skipping hierarchy per page.
- **Color is never the only signal.** Severity is communicated by color plus text label/icon together (e.g. a "Critical" badge, not a bare red dot) so the information survives for color-blind users and in monochrome printouts.
- **Focus management on navigation.** Route changes and modal/drawer open-close move focus predictably (to the new view's heading, or back to the triggering control on close) rather than leaving focus stranded.
- **Reduced motion.** All Framer Motion transitions respect `prefers-reduced-motion: reduce`, degrading to instant state changes.
- **Target compliance level:** WCAG 2.1 AA for all core workflows (upload, dashboard, evidence review, export). This is a design constraint to build to from the start of each phase, not a pass applied at the end.

## 22. Security Considerations

- **No network egress for case data — architecturally, not just by policy.** There is no backend, no analytics SDK, and no third-party call in the parse/analyze/export path. This is verifiable by an analyst (or a security reviewer) by inspecting Network activity during a full workflow, which is itself a stated product claim and must remain true through every future phase.
- **XML parsing is not an XXE vector.** Event record XML is parsed with `fast-xml-parser` (a pure-JavaScript parser with no DOM dependency, required because `DOMParser` is unavailable inside the Web Worker parsing runs in — see Section 16 and ADR-010), which does not resolve external entities — this holds even though the source bytes are fully attacker-controllable (a `.evtx` file is, by definition, untrusted input from a potentially compromised host). Parsed output is read only via plain string/attribute accessors and is never attached to a DOM or rendered via `innerHTML`, closing off any DOM-based XSS path through event content (provider names, messages, user names, etc. — all of which can contain attacker-influenced strings).
- **Untrusted binary input handling.** The EVTX binary walker treats the uploaded file as fully untrusted: every chunk and record is independently verified (checksum/structure), and a malformed or adversarially crafted record is skipped rather than trusted — see Section 16's resilience design. This is a security property as much as a robustness one: a hostile `.evtx` file should not be able to crash the tab or corrupt the parse of unrelated records.
- **Supply-chain patch transparency.** The one third-party runtime patch in the project (`patches/@ts-evtx+core+*.patch`, applied via `patch-package` on install) exists solely to remove a Node-only `process.env` read that would otherwise throw in a browser — it changes no parsing behavior. Any future patch to a dependency must be similarly scoped, documented, and reviewed; patches are not a mechanism for silently altering trusted-library behavior.
- **No sensitive data in build artifacts.** No API keys, credentials, or environment-specific secrets are required or embedded, since there is no backend to authenticate to.
- **Client-side "no data leaves the browser" is a claim that degrades if violated even once.** Any future feature that would introduce a network call touching case content (e.g. a hosted rule-pack fetch, a telemetry beacon) must be explicit, opt-in, and clearly disclosed — never silently added under an existing UI affordance.

## 23. Error Handling Strategy

- **Fail loud only where it's a real evidence-extraction failure; degrade quietly everywhere else.** A failed parse is the one condition that puts the whole pipeline into an `error` status, because it means the analyst has no evidence to work with at all. A failure in detection or summary generation (post-parse) degrades to empty findings/no summary rather than blocking access to the already-successfully-parsed events — the evidence table and timeline only need `events`, and a bug in one detection rule must never take those away from the analyst.
- **Errors are specific and actionable, never generic.** "Something went wrong" is not acceptable at any layer; the parser's header-validation and zero-events failure paths already model the right shape — state exactly what was checked, what passed, what failed, and a plausible next step (e.g. "try a freshly exported file").
- **Partial success is reported as partial success.** A file that yields, say, 40,000 of an expected larger set of events due to some corrupted chunks should present those 40,000 events normally, with a visible (not buried) diagnostic noting that some chunks/records were unrecoverable — never silently truncate without telling the analyst.
- **Render-time failures are caught at the shell level.** An `ErrorBoundary` wraps the routed content area so a rendering exception in one panel shows a recoverable fallback rather than a blank white screen for the whole app.
- **Cancellation and timeout are explicit states, not silent hangs.** A parse that exceeds its timeout or is user-cancelled resolves to a clear "cancelled" outcome, distinguishable in the UI from a validation failure or a crash.
- **Toasts are for transient confirmation only** (e.g. "File accepted, parsing started" / "Export complete") — they are never the sole channel for a state the analyst needs to still see after the toast disappears (that belongs in the persistent status badge / `CaseStateGate` states).

## 24. Testing Strategy

The current codebase has no automated test suite (verification to date has been type-checking, production builds, and manual walkthroughs). Establishing automated coverage is planned as an explicit phase (Section 25) rather than retrofitted piecemeal, prioritized in this order because it matches where a silent regression would be most costly to an analyst:

1. **Parsing engine unit tests** — the highest-value target given real-world files are frequently dirty/corrupted. Cover: valid well-formed files, truncated files, files with individually corrupted chunks/records, files with a corrupt timestamp (must never fabricate a date), and the zero-events diagnostic path.
2. **Detection rule unit tests** — one test per rule, asserting it fires on a crafted minimal event set that should trigger it and does not fire on adjacent event sets that shouldn't. Includes the brute-force rule's sliding-window boundary conditions (exactly 5 in-window vs. one just outside the 15-minute window).
3. **Risk-score and summary unit tests** — pure functions, straightforward to test exhaustively across severity/threshold boundaries.
4. **Store logic tests** — `evidenceStore.loadFile`'s branching (parse success/failure, detection/summary failure isolation) tested independently of any UI.
5. **Component/interaction tests** — critical flows: upload → dashboard render, search/filter/sort/paginate correctness in the evidence table, export producing the filtered (not full) set, cross-panel navigation from a finding to its event.
6. **Accessibility checks** — automated axe-core (or equivalent) checks integrated into component tests for the core workflows named in Section 21, plus periodic manual keyboard/screen-reader passes.
7. **Manual/exploratory testing** — real-world `.evtx` samples across Security/System/PowerShell-operational/Sysmon channels, plus deliberately malformed files, ahead of each release.

Target tooling: Vitest (fast, Vite-native, minimal config divergence from the existing build) with React Testing Library for component tests; axe-core for accessibility assertions. CI should run type-check + full test suite on every change once the suite exists, gating merges — consistent with the project's "keep the project buildable after every phase" rule.

## 25. Development Roadmap (Phase-by-Phase)

**Already delivered (baseline, treated as complete going into this SDD):**

- **Phase 0 — Scaffolding.** Vite + React + TypeScript + Tailwind + shadcn/ui project setup, routing skeleton, theme provider.
- **Phase 1 — Shell & Navigation.** AppShell, Sidebar/MobileSidebar, Navbar, landing page, responsive layout foundation.
- **Phase 2 — Domain types & state skeleton.** `evidence.ts` types, the three Zustand stores, mock data for UI development ahead of a real parser.
- **Phase 3 — Evidence table.** TanStack Table integration, columns, sorting, pagination, toolbar, skeleton loading state.
- **Phase 4 — Dashboard UI.** Stat cards, risk score card, findings panel, summary panel (against mock/derived data).
- **Phase 5 — Timeline view.** Day-grouped chronological rendering with severity color coding.
- **Phase 6 — Real EVTX parsing.** Browser-native binary/XML parsing via a deep import of `@ts-evtx/core`'s pure parsing classes, main-thread integration, corrupt-timestamp handling.
- **Phase 7 — Real analysis + export + resilience.** Rule-based suspicious detection, risk scoring, investigation summary generation, CSV/JSON export, `CaseStateGate` consolidation, and — beyond the original Phase 7 scope but delivered as part of hardening it — the move of parsing into a dedicated Web Worker for main-thread responsiveness on larger files.

**Planned next (this SDD's forward scope):**

- **Phase 8 — Automated test foundation.** Stand up Vitest + React Testing Library; deliver parser, detection-rule, risk-score, and store unit tests per Section 24, items 1–4. Gate: CI runs type-check + tests on every change.
- **Phase 9 — Accessibility hardening.** Audit against Section 21 (WCAG 2.1 AA target); close any gaps in focus management, keyboard operability, and screen-reader table semantics; add automated axe-core checks to the Phase 8 test suite. Gate: documented accessibility pass with no critical/serious axe violations on the three core workflows.
- **Phase 10 — Performance at scale.** Evaluate and, if warranted, implement evidence-table virtualization for large event counts; profile worker throughput on multi-hundred-MB files; revisit the fixed parse timeout against real large-file behavior. Gate: a defined large-file benchmark (event count, parse time, main-thread responsiveness) with measured results, not just a "feels fast" check.
- **Phase 11 — Detection & reporting depth (Nice to Have items).** Event detail drill-down (raw XML view), extensible/configurable rule set, printable case summary. Each shipped independently behind the existing architecture, no structural changes required.
- **Phase 12 — Stretch evaluation.** Revisit Section 7's Stretch Goals (additional log-source parsers, multi-file case correlation, optional local persistence) as explicit, separately-scoped proposals once Phases 8–11 are stable — not undertaken opportunistically mid-phase.

Per the project's standing development rules, each phase above is planned, explained, and approved before any implementation begins, is scoped to preserve everything delivered in prior phases, and leaves the project in a buildable state at every step.

---

*This SDD is the reference for implementation planning. No code has been written or modified as part of producing this document.*
