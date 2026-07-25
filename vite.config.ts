import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // @ts-evtx/core's internal logging module (dist/src/logging/logger.js,
    // imported transitively by ChunkHeader.js/Record.js — see
    // src/backend/evtx-parser.ts) has one line that reads
    // `process.env.EVTX_DEBUG` unconditionally at module scope:
    //   export const ENABLE_DEBUG_LOGGING = process.env.EVTX_DEBUG === 'true' || false;
    // `process` doesn't exist in the browser, so evaluating that module
    // threw `ReferenceError: process is not defined` as soon as the EVTX
    // parser code path was loaded. This statically replaces just that one
    // expression at build/dev time — Vite performs a compile-time text
    // substitution here, so the shipped bundle contains no `process`
    // reference at all for this line (not a runtime polyfill of a Node
    // object). Evaluates to `'' === 'true' || false` → `false`, matching
    // the library's own default (debug logging off).
    "process.env.EVTX_DEBUG": JSON.stringify(""),
  },
});
