# tools.carter.works

Standalone HTML tools for <https://tools.carter.works>.

Each tool lives in its own `public/<tool>/index.html` file and pulls runtime dependencies from CDNs with browser ES modules. `GET /text` renders a PNG from query parameters; it is served by a Worker (`src/worker.js`), not a static file.

## Commands

- `pnpm install`
- `pnpm dev` — run the Worker and assets locally with `alchemy dev`
- `pnpm check` — typecheck with `tsc --noEmit`
- `pnpm build` — copy `public/` to `dist/`
- `pnpm deploy`

## Deployment

The site deploys to Cloudflare as a Worker serving static assets, defined in
[`alchemy.run.ts`](./alchemy.run.ts). Alchemy builds the site, hashes `dist/`,
and uploads it. The Worker only runs for `/text`; every other request is served
by the asset layer.

```sh
pnpm run deploy
```

Locally, authenticate first with `pnpm exec alchemy profile edit`. CI runs the
same command as `alchemy deploy --stage prod --yes` using `CLOUDFLARE_API_TOKEN`
and `CLOUDFLARE_ACCOUNT_ID`.

## DNS

The `prod` stage adopts the existing Cloudflare resources in the `carter.works`
zone: the zone itself, the `tools` subdomain record, and the
`tools.carter.works/*` Worker route. Nothing is created from scratch, and the
Cloudflare account is `Important@carter.works`.

The adopted CNAME currently points at the retired Pages project
(`tools-carter-works.pages.dev`); confirm its target against Cloudflare before
the first deploy.
