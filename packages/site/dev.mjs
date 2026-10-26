import { createServer } from "node:http";
import { createReadStream, watch } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "takumi-js";
import { getBuildInfo, renderBuildInfo } from "./build-info.mjs";
import { sites } from "./routes.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const port = Number(process.env.PORT ?? 3000);
const textImageSrc = join(root, "packages", "text-image", "src");
const textImageCache = new Map();
const clients = new Set();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const reloadScript = `<script>
(() => {
  const events = new EventSource("/__dev/events");
  events.onmessage = () => location.reload();
})();
</script>`;

let textImage;
let textImageVersion = 0;
let reloadTimer;

const cache = {
  async match(request) {
    return textImageCache.get(request.url)?.clone();
  },
  async put(request, response) {
    textImageCache.set(request.url, response.clone());
  },
};

async function getTextImage() {
  if (!textImage) {
    const { createTextImage } = await import(`../text-image/src/text-image.js?dev=${textImageVersion}`);
    textImage = createTextImage({
      cache,
      render: (tree, options) => render(tree, { ...options, emoji: "from-font" }),
    });
  }

  return textImage;
}

function matchRoute(pathname) {
  for (const [name, route] of sites) {
    if (!route) continue;

    const base = `/${route}`;
    if (pathname === base) return { name, rest: "/", redirect: true };
    if (pathname.startsWith(`${base}/`)) return { name, rest: pathname.slice(base.length) };
  }

  if (pathname === "/" || pathname === "/index.html") return { name: "home", rest: pathname };
  return undefined;
}

function sendNotFound(response) {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

async function sendStatic(request, response, url) {
  const route = matchRoute(url.pathname);
  if (!route) return sendNotFound(response);

  if (route.redirect) {
    response.writeHead(308, { Location: `${url.pathname}/${url.search}` });
    response.end();
    return;
  }

  let relativePath;
  try {
    relativePath = decodeURIComponent(route.rest).replace(/^\/+/, "");
  } catch {
    return sendNotFound(response);
  }

  if (!relativePath || relativePath.endsWith("/")) relativePath += "index.html";

  const publicDir = join(root, "packages", route.name, "public");
  const filePath = resolve(publicDir, relativePath);
  if (!filePath.startsWith(`${publicDir}${sep}`)) return sendNotFound(response);

  let file;
  try {
    file = await stat(filePath);
  } catch {
    return sendNotFound(response);
  }
  if (!file.isFile()) return sendNotFound(response);

  const contentType = mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  if (contentType.startsWith("text/html")) {
    let body = await readFile(filePath, "utf8");
    if (route.name === "home") {
      body = body.replace("<!-- build-info -->", renderBuildInfo(getBuildInfo(root)));
    }
    body = body.includes("</body>") ? body.replace("</body>", `${reloadScript}</body>`) : body + reloadScript;
    response.end(body);
    return;
  }

  createReadStream(filePath).pipe(response);
}

async function sendTextImage(request, response, url) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const textRequest = new Request(url, { method: request.method, headers });
  const textResponse = await (await getTextImage())(textRequest);
  const body = Buffer.from(await textResponse.arrayBuffer());

  response.writeHead(textResponse.status, {
    ...Object.fromEntries(textResponse.headers),
    "Cache-Control": "no-store",
  });

  if (request.method === "HEAD") {
    response.end();
  } else {
    response.end(body);
  }
}

function sendEvents(request, response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
  });
  response.write("retry: 500\n\n");
  clients.add(response);

  const heartbeat = setInterval(() => response.write(": ping\n\n"), 15000);
  request.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(response);
  });
}

function scheduleReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    for (const client of clients) client.write("data: reload\n\n");
  }, 100);
}

function watchSources() {
  const dirs = sites.map(([name]) => join(root, "packages", name, "public"));
  dirs.push(textImageSrc);

  return dirs.map((dir) =>
    watch(dir, { recursive: true }, (_event, filename) => {
      if (dir === textImageSrc && String(filename).endsWith("text-image.js")) {
        textImage = undefined;
        textImageVersion += 1;
        textImageCache.clear();
      }

      scheduleReload();
    }),
  );
}

const server = createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `localhost:${port}`}`);

    if (url.pathname === "/__dev/events") {
      sendEvents(request, response);
      return;
    }

    if (url.pathname === "/text") {
      await sendTextImage(request, response, url);
      return;
    }

    await sendStatic(request, response, url);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }
    response.end("Internal Server Error");
  }
});

const watchers = watchSources();
server.listen(port, () => {
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;

  console.log(`Dev server listening on http://localhost:${actualPort}`);
  for (const [name, route] of sites) {
    console.log(`  ${route ? `/${route}/` : "/"} -> packages/${name}/public`);
  }
  console.log("  /text -> native Takumi renderer");
});

function shutdown() {
  clearTimeout(reloadTimer);
  for (const watcher of watchers) watcher.close();
  for (const client of clients) client.end();
  server.close(() => process.exit(0));
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
