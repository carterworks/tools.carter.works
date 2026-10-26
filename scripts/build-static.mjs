import { existsSync } from "node:fs";
import { cp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { build } from "esbuild";

const packageDir = process.cwd();
const publicDir = join(packageDir, "public");
const distDir = join(packageDir, "dist");
const entry = join(packageDir, "src", "main.js");

await rm(distDir, { recursive: true, force: true });
await cp(publicDir, distDir, { recursive: true });

if (existsSync(entry)) {
  await build({
    entryPoints: [entry],
    bundle: true,
    define: { "process.env.NODE_ENV": '"production"' },
    format: "esm",
    legalComments: "none",
    minify: true,
    outfile: join(distDir, "main.js"),
    platform: "browser",
    target: "es2022",
  });
}

const packageJson = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
const require = createRequire(join(packageDir, "package.json"));

for (const [output, specifier] of Object.entries(packageJson.staticAssets ?? {})) {
  await cp(require.resolve(specifier), join(distDir, output));
}
