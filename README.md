# DFIR Workbench

A browser-native Digital Forensics & Incident Response artifact workbench for Windows Event Log (`.evtx`) files. Upload a file, and it's parsed, analyzed, and visualized entirely client-side — nothing is ever uploaded to a server.

## Features

- **Browser-native EVTX parsing** — reads and parses Windows Event Log files directly in the browser using a pure-JavaScript binary parser. No upload, no server, no installation.
- **Case dashboard** — total/critical/warning/information event counts, a risk score gauge, suspicious-event findings, and an auto-generated investigation summary.
- **Evidence table** — searchable, sortable, filterable, paginated grid of every parsed event, with row selection and CSV/JSON export that respects your active search and filters.
- **Timeline** — chronological, day-grouped view of all events, color-coded by severity.
- **Suspicious event detection** — a rule-based (not ML) detector flags patterns like brute-force logons, cleared audit logs, new privileged accounts, suspicious PowerShell activity, Defender detections, and new services, each with a MITRE ATT&CK technique reference where applicable.
- **Risk scoring** — a 0–100 case-level score derived from the severity and count of suspicious findings.
- **Dark, SOC-style UI** — built with Tailwind CSS and shadcn/ui, responsive from mobile to desktop, with a light theme available via the theme toggle.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Routing | React Router v6 (client-side, code-split per route) |
| State | Zustand (evidence data, filters, UI state — three separate stores) |
| Table | TanStack Table |
| UI | Tailwind CSS + shadcn/ui (Radix primitives) |
| Animation | Framer Motion |
| Notifications | sonner |
| EVTX parsing | [`@ts-evtx/core`](https://github.com/NickSmet/ts-evtx) (deep-imported to its pure binary-parsing internals — see [Architecture](#architecture)) |

## Getting started

Requires Node.js 18+.

```bash
npm install
npm run dev       # start the dev server (http://localhost:5173)
```

Other scripts:

```bash
npm run build      # type-check + production build to dist/
npm run typecheck  # type-check only
npm run preview    # serve the production build locally
```

To try it out, drop a `.evtx` file onto the landing page. Don't have one handy? See [DEMO.md](./DEMO.md) for where to find one and a suggested walkthrough.

## Project structure

```
src/
├── pages/            Route-level pages (Landing, Dashboard, Evidence Viewer, Timeline, 404)
├── layouts/           AppShell (navbar + sidebar + content area)
├── components/
│   ├── ui/            shadcn/ui primitives
│   ├── layout/         Navbar, Sidebar, MobileSidebar, PageHeader, Brand
│   ├── landing/        Hero, feature cards, footer
│   ├── upload/          DropZone
│   ├── evidence/        Evidence table, toolbar, pagination, export controls, CaseStateGate
│   ├── dashboard/       Stat cards, risk score, suspicious events panel, summary panel
│   ├── timeline/        EventTimeline
│   ├── theme/            Theme provider + toggle
│   └── feedback/         EmptyState, ErrorBoundary, loading fallbacks
├── store/              evidenceStore, filterStore, uiStore (Zustand)
├── services/            evtxApi.ts — the only file that imports from backend/
├── backend/              parseEVTX, detectSuspicious, generateInvestigationSummary,
│                         exportCSV, exportJSON, and the risk-score model — all real,
│                         all client-side
├── types/                Shared domain types (EvtxEvent, SuspiciousFinding, etc.)
└── lib/                  cn() helper, mock data, download-blob utility
```

## Architecture

**State is split three ways.** `evidenceStore` holds the uploaded file, parsed events, suspicious findings, and investigation summary, plus the pipeline's loading/error status. `filterStore` holds search/sort/filter/pagination — kept separate so typing in the search box doesn't re-render every component that reads raw event data. `uiStore` holds ephemeral cross-panel state like the currently selected event and sidebar/mobile-nav visibility.

**The backend boundary is one file.** Every backend call goes through `src/services/evtxApi.ts`, which re-exports from `src/backend/index.ts`. This was originally scaffolded as a placeholder contract for a teammate's separate parser module in a hackathon split; all five functions are now real, but the boundary stayed, since it's still useful — it's the one place you'd swap in a different implementation (e.g. a WASM parser, or a server-backed detector) without touching any UI code.

**EVTX parsing runs entirely in the browser.** There's no mature, published npm package for browser-native EVTX parsing. `@ts-evtx/core` is a real, tested TypeScript EVTX parser, but its top-level API (`EvtxFile.open()`, etc.) reads files from disk via Node's `fs` module. `src/backend/evtx-parser.ts` deep-imports only its pure binary/XML parsing classes (`BinaryReader`, `FileHeader`, and what they pull in — `ChunkHeader`, `Record`, `BXmlNode`, `TemplateNode`), which operate purely on an in-memory `Uint8Array` with zero Node dependencies. This is verified by grepping the entire dependency tree for `fs`/`path`/`stream`/`Buffer`/`process` usage and by inspecting the actual bundled output, not just assumed.

One incidental issue this surfaced: the library's internal logging module reads `process.env.EVTX_DEBUG` unconditionally at module scope, which crashes in a browser (`process` doesn't exist there). This is patched via [`patch-package`](https://www.npmjs.com/package/patch-package) — see `patches/@ts-evtx+core+1.2.0.patch` — which reapplies automatically on every `npm install` via the `postinstall` script. Nothing else in the parsing path touches any Node API.

**Detection and summary are rule-based, not ML.** `src/backend/suspicious-detection.ts` runs a small set of named, explainable rules (brute-force logon patterns, cleared audit logs, new accounts/group membership changes, suspicious PowerShell command patterns, Defender detections, new services) over the parsed events. `src/backend/investigation-summary.ts` composes a narrative from those findings plus basic case stats (time range, affected hosts). `src/backend/risk-score.ts` turns finding severities into a single 0–100 score. All three are pure functions — easy to read, test, and extend with new rules.

## Known limitations

- **Message text is reconstructed, not authoritative.** EVTX files don't store final rendered "Message" strings — Windows composes those at view time from per-provider message-catalog DLLs on the originating machine, which aren't available in a browser. Messages here are rebuilt from each event's structured `EventData`/`UserData` fields, the same fallback Event Viewer itself uses when it can't find a catalog.
- **The `User` field is often a raw SID**, not a resolved username — SID-to-username resolution requires querying Active Directory or the local SAM, which isn't available client-side.
- **Detection is heuristic, not exhaustive.** The suspicious-event rules cover a handful of well-known patterns; absence of a finding does not mean absence of compromise.
- **No Web Worker yet.** Parsing runs on the main thread with periodic yields to keep the UI responsive (and the loading spinner animating) rather than fully blocking — fine for typical exported logs, but a dedicated worker would be the natural next step for very large files.
- **No automated test suite.** Verification so far has been manual/build-level (type-checking, production builds, targeted Node-side regression checks for the parser's error handling) rather than a Jest/Vitest suite.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deploying to Vercel.
