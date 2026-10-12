import { adopt } from "alchemy/AdoptPolicy";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Stage from "alchemy/Stage";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "tools-carter-works",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Stage.Stage;
    const site = yield* Cloudflare.Website.StaticSite("Website", {
      name: "tools-carter-works",
      compatibility: { date: "2026-06-24" },
      command: "pnpm run build",
      outdir: "dist",
      // The only dynamic route: `/text` renders a PNG, everything else is a
      // static file served by the `ASSETS` binding.
      main: "./src/worker.js",
    });

    if (stage === "prod") {
      const zone = yield* Cloudflare.Zone.Zone("CarterWorksZone", {
        name: "carter.works",
      }).pipe(adopt(true));

      // The subdomain record the route depends on. The Pages project already
      // owns this CNAME; its target is preserved so the adopted record matches
      // what Cloudflare has. Confirm the target before deploying.
      yield* Cloudflare.DNS.Record("ToolsSubdomain", {
        zoneId: zone.zoneId,
        name: "tools.carter.works",
        type: "CNAME",
        content: "tools-carter-works.pages.dev",
        proxied: true,
      }).pipe(adopt(true));

      yield* Cloudflare.Workers.WorkerRoute("ToolsRoute", {
        zoneId: zone.zoneId,
        pattern: "tools.carter.works/*",
        script: site.workerName,
      }).pipe(adopt(true));
    }

    return { url: site.url };
  }),
);
