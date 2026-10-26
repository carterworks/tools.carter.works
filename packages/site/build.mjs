import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getBuildInfo, renderBuildInfo } from "./build-info.mjs";
import { sites } from "./routes.mjs";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });

for (const [site, route] of sites) {
  const from = join(root, "packages", site, "dist");
  const to = join(dist, route);

  await mkdir(to, { recursive: true });

  for (const entry of await readdir(from)) {
    await cp(join(from, entry), join(to, entry), { recursive: true });
  }
}

const buildInfo = renderBuildInfo(getBuildInfo(root));
if (buildInfo) {
  const home = join(dist, "index.html");
  const html = await readFile(home, "utf8");
  await writeFile(home, html.replace("<!-- build-info -->", buildInfo));
}
