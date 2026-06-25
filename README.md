# tools.carter.works

Standalone HTML tools for <https://tools.carter.works>.

Each tool lives in its own `public/<tool>/index.html` file and pulls runtime dependencies from CDNs with browser ES modules.

## Commands

- `pnpm install`
- `pnpm dev`
- `pnpm deploy`

## DNS

Cloudflare Pages project: `tools-carter-works`

Custom domain activation needs this DNS record in the `carter.works` zone:

- `CNAME tools -> tools-carter-works.pages.dev`
