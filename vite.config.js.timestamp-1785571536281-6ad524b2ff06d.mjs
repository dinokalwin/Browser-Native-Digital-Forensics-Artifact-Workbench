// vite.config.js
import { defineConfig } from "file:///sessions/determined-practical-cori/mnt/dfir-workbench-integrated2/dfir-workbench/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/determined-practical-cori/mnt/dfir-workbench-integrated2/dfir-workbench/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "/sessions/determined-practical-cori/mnt/dfir-workbench-integrated2/dfir-workbench";
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
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
    "process.env.EVTX_DEBUG": JSON.stringify("")
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZGV0ZXJtaW5lZC1wcmFjdGljYWwtY29yaS9tbnQvZGZpci13b3JrYmVuY2gtaW50ZWdyYXRlZDIvZGZpci13b3JrYmVuY2hcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9kZXRlcm1pbmVkLXByYWN0aWNhbC1jb3JpL21udC9kZmlyLXdvcmtiZW5jaC1pbnRlZ3JhdGVkMi9kZmlyLXdvcmtiZW5jaC92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvZGV0ZXJtaW5lZC1wcmFjdGljYWwtY29yaS9tbnQvZGZpci13b3JrYmVuY2gtaW50ZWdyYXRlZDIvZGZpci13b3JrYmVuY2gvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gICAgcGx1Z2luczogW3JlYWN0KCldLFxuICAgIHJlc29sdmU6IHtcbiAgICAgICAgYWxpYXM6IHtcbiAgICAgICAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgICAgICB9LFxuICAgIH0sXG4gICAgZGVmaW5lOiB7XG4gICAgICAgIC8vIEB0cy1ldnR4L2NvcmUncyBpbnRlcm5hbCBsb2dnaW5nIG1vZHVsZSAoZGlzdC9zcmMvbG9nZ2luZy9sb2dnZXIuanMsXG4gICAgICAgIC8vIGltcG9ydGVkIHRyYW5zaXRpdmVseSBieSBDaHVua0hlYWRlci5qcy9SZWNvcmQuanMgXHUyMDE0IHNlZVxuICAgICAgICAvLyBzcmMvYmFja2VuZC9ldnR4LXBhcnNlci50cykgaGFzIG9uZSBsaW5lIHRoYXQgcmVhZHNcbiAgICAgICAgLy8gYHByb2Nlc3MuZW52LkVWVFhfREVCVUdgIHVuY29uZGl0aW9uYWxseSBhdCBtb2R1bGUgc2NvcGU6XG4gICAgICAgIC8vICAgZXhwb3J0IGNvbnN0IEVOQUJMRV9ERUJVR19MT0dHSU5HID0gcHJvY2Vzcy5lbnYuRVZUWF9ERUJVRyA9PT0gJ3RydWUnIHx8IGZhbHNlO1xuICAgICAgICAvLyBgcHJvY2Vzc2AgZG9lc24ndCBleGlzdCBpbiB0aGUgYnJvd3Nlciwgc28gZXZhbHVhdGluZyB0aGF0IG1vZHVsZVxuICAgICAgICAvLyB0aHJldyBgUmVmZXJlbmNlRXJyb3I6IHByb2Nlc3MgaXMgbm90IGRlZmluZWRgIGFzIHNvb24gYXMgdGhlIEVWVFhcbiAgICAgICAgLy8gcGFyc2VyIGNvZGUgcGF0aCB3YXMgbG9hZGVkLiBUaGlzIHN0YXRpY2FsbHkgcmVwbGFjZXMganVzdCB0aGF0IG9uZVxuICAgICAgICAvLyBleHByZXNzaW9uIGF0IGJ1aWxkL2RldiB0aW1lIFx1MjAxNCBWaXRlIHBlcmZvcm1zIGEgY29tcGlsZS10aW1lIHRleHRcbiAgICAgICAgLy8gc3Vic3RpdHV0aW9uIGhlcmUsIHNvIHRoZSBzaGlwcGVkIGJ1bmRsZSBjb250YWlucyBubyBgcHJvY2Vzc2BcbiAgICAgICAgLy8gcmVmZXJlbmNlIGF0IGFsbCBmb3IgdGhpcyBsaW5lIChub3QgYSBydW50aW1lIHBvbHlmaWxsIG9mIGEgTm9kZVxuICAgICAgICAvLyBvYmplY3QpLiBFdmFsdWF0ZXMgdG8gYCcnID09PSAndHJ1ZScgfHwgZmFsc2VgIFx1MjE5MiBgZmFsc2VgLCBtYXRjaGluZ1xuICAgICAgICAvLyB0aGUgbGlicmFyeSdzIG93biBkZWZhdWx0IChkZWJ1ZyBsb2dnaW5nIG9mZikuXG4gICAgICAgIFwicHJvY2Vzcy5lbnYuRVZUWF9ERUJVR1wiOiBKU09OLnN0cmluZ2lmeShcIlwiKSxcbiAgICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXFhLFNBQVMsb0JBQW9CO0FBQ2xjLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFGakIsSUFBTSxtQ0FBbUM7QUFHekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDeEIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLFNBQVM7QUFBQSxJQUNMLE9BQU87QUFBQSxNQUNILEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN4QztBQUFBLEVBQ0o7QUFBQSxFQUNBLFFBQVE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBY0osMEJBQTBCLEtBQUssVUFBVSxFQUFFO0FBQUEsRUFDL0M7QUFDSixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
