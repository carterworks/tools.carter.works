import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const dist = join(root, "dist");

const sites = [
  ["home", ""],
  ["claude-code-buddy-creator", "claude-code-buddy-creator"],
  ["discord-text-image-worker", "discord-text-image-worker"],
  ["gamebook-viewer", "gamebook-viewer"],
  ["halftone-painting", "halftone-painting"],
];

await rm(dist, { recursive: true, force: true });

for (const [site, route] of sites) {
  const from = join(root, "packages", site, "dist");
  const to = join(dist, route);

  await mkdir(to, { recursive: true });

  for (const entry of await readdir(from)) {
    await cp(join(from, entry), join(to, entry), { recursive: true });
  }
}
