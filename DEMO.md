# Demo instructions

## Getting a sample .evtx file

The app doesn't ship with a sample file (real Windows Event Log exports aren't safe to bundle in a repo — they can contain hostnames, usernames, and other identifying data). To get one:

**From a Windows machine you own:**
1. Open **Event Viewer** (`eventvwr.msc`).
2. Pick a log — **Windows Logs → Security** tends to produce the most interesting demo data (logons, account changes), or **System** for service/driver events.
3. Right-click the log → **Save All Events As...** → save as `.evtx`.
4. Alternatively, the raw log files already exist at `C:\Windows\System32\winevt\Logs\*.evtx` (copy one out; you may need admin rights for `Security.evtx` specifically).

**If you don't have access to a Windows machine:** any `.evtx` file you can source (a colleague's export, a public DFIR training sample set, a CTF/forensics challenge archive) will work — the parser doesn't care about provenance, only that the file is a well-formed EVTX.

A few hundred KB to a few MB is a good demo size — enough events to make the dashboard and detection interesting without a long parse.

## Suggested walkthrough

1. **Landing page** — point out the "browser-native, no upload to a server" badge before doing anything. This is a real, verifiable claim: open devtools → Network tab, upload a file, and show that no request goes out. Everything happens client-side.
2. **Upload** — drag the `.evtx` file onto the drop zone (or click to browse). Watch the parsing progress indicator and the toast confirmation on success.
3. **Dashboard** — you land here automatically. Walk through, left to right:
   - **Risk score** gauge — explain it's derived from the severity/count of suspicious findings, not a black box.
   - **Stat cards** — total/critical/warning/information counts.
   - **Suspicious Events panel** — if your source log has failed logons (event ID 4625), an audit log clear (1102), a new account (4720), or similar, you'll see findings here with a MITRE ATT&CK technique tag. Click one — it jumps to the Evidence Viewer with the triggering event selected and searched for, showing the cross-panel linking.
   - **Investigation Summary** — the auto-generated narrative, key findings, and affected hosts.
4. **Evidence Viewer** — demonstrate search (try an event ID or a computer name), the Level/Provider filters, column sorting, row selection, and pagination. Then click **Export CSV** or **Export JSON** — show that the export respects whatever's currently filtered, not just "export everything."
5. **Timeline** — scroll through the day-grouped chronological view; click an entry to select it (same cross-panel link as the table).
6. **Theme toggle** — flip to light mode from the navbar to show it's not just a dark-mode-only skin.
7. **Resize the window** — collapse it to phone width to show the responsive layout (sidebar becomes a drawer, table columns progressively hide, cards restack).

## Things worth calling out to judges

- The EVTX parser genuinely runs in-browser — there's no npm package that does this out of the box, so this required deep-importing a real parser library's internal binary-parsing classes while avoiding its Node-`fs`-dependent convenience API. See the [Architecture section of the README](./README.md#architecture) if asked for detail.
- Suspicious-event detection and the investigation summary are rule-based and explainable — every finding traces back to a specific, named rule over specific event IDs, not an opaque score.
- Nothing about this app requires a backend at all. It could be hosted as a fully static site (see [DEPLOYMENT.md](./DEPLOYMENT.md)) with zero server-side moving parts, which matters for a forensics tool where you often can't (or shouldn't) upload evidence anywhere.

## If something goes wrong live

- **"Couldn't parse this file"** — the file either isn't a genuine `.evtx` (wrong extension aside, check it wasn't renamed from something else) or is truncated/corrupted. Try a freshly-exported file.
- **Nothing in Suspicious Events** — expected for a "quiet" log with no matching patterns; the panel says so explicitly rather than showing nothing unexplained. Try a `Security.evtx` export, which is more likely to contain logon events.
- **Large file feels slow** — parsing is main-thread with periodic yields (see README's Known Limitations); a multi-hundred-MB file will take a while. Pick a smaller export for a live demo.
