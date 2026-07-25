# Deployment guide (Vercel)

This app is a fully static, client-side single-page app — there's no backend, no API routes, and no environment variables required. Any static host works; these instructions cover Vercel specifically.

## Why `vercel.json` is required

This app uses React Router's `BrowserRouter` (real paths like `/dashboard/evidence`, not `/#/dashboard/evidence`). A static host that doesn't know about client-side routing will 404 on a hard refresh or direct link to anything other than `/`, because it looks for a physical file at that path. `vercel.json` (already in the repo root) rewrites every path to `index.html` so React Router can take over:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## Option A — Vercel dashboard (Git-connected)

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In the [Vercel dashboard](https://vercel.com/new), click **Add New → Project** and import the repo.
3. Vercel auto-detects Vite. Confirm these build settings (they also come from `vercel.json`, so this is just a sanity check):
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Install command:** `npm install` (this runs `patch-package` automatically via the `postinstall` script — see README's Architecture section for why that matters)
4. No environment variables are needed.
5. Click **Deploy**. Every push to the connected branch redeploys automatically; pull requests get preview deployments.

## Option B — Vercel CLI

```bash
npm install -g vercel   # if you don't have it already
vercel login
vercel                  # first run: follow the prompts to link/create the project
vercel --prod           # subsequent production deploys
```

The CLI reads the same `vercel.json`, so no additional flags are needed for the SPA rewrite.

## Verifying the deployment

After it's live:
1. Visit the root URL — the landing page should load.
2. Upload a `.evtx` file and confirm it navigates to `/dashboard`.
3. Navigate to `/dashboard/evidence`, then **hard refresh the page** (not just client-side navigation). If you see the app (not a 404), the SPA rewrite is working correctly.
4. Open DevTools → Network while uploading a file and confirm no request is made anywhere except for the initial page/asset loads — the parser runs entirely client-side, so there should be nothing to see here.

## Custom domains

Handled entirely through Vercel's dashboard (**Project → Settings → Domains**) — no code or config changes needed on this end.
