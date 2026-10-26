# tools.carter.works

Standalone HTML tools for <https://tools.carter.works>.

The repo is a pnpm workspace. Every tool is an independent package under
`packages/`, with its own `package.json`, build script, and dependencies. Static
tools pull runtime dependencies from CDNs with browser ES modules.

| Package                            | URL                           |
| ---------------------------------- | ----------------------------- |
| `@tools/home`                      | `/`                           |
| `@tools/claude-code-buddy-creator` | `/claude-code-buddy-creator/` |
| `@tools/discord-text-image-worker` | `/discord-text-image-worker/` |
| `@tools/gamebook-viewer`           | `/gamebook-viewer/`           |
| `@tools/halftone-painting`         | `/halftone-painting/`         |
| `@tools/text-image`                | `/text`                       |

`@tools/site` depends on the tool packages, so pnpm builds it last. It copies
each package's `dist/` into the repository's `dist/` at the URLs above.
`GET /text` renders a PNG from query parameters; it is served by a Worker
(`packages/text-image/dist/worker.js`), not a static file.

## Commands

- `pnpm install`
- `pnpm dev` — run the Worker and assets locally with `alchemy dev`
- `pnpm check` — typecheck with `tsc --noEmit`
- `pnpm build` — run `pnpm --recursive run build`, which builds every package
  and assembles the deployable `dist/`
- `pnpm --filter @tools/gamebook-viewer build` — build one package
- `pnpm deploy`

To add a tool, create a package under `packages/`, add it to the dependencies
and route map in `packages/site`, then run `pnpm install`.

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
