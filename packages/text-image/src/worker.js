// @ts-check

import wasm, { initSync, Renderer } from "takumi-js/wasm";
import { createTextImage } from "./text-image.js";

// Load the WASM backend explicitly because takumi-js's auto-loader emits a
// bare dynamic import that Cloudflare Workers cannot resolve.
initSync({ module: wasm });

const renderer = new Renderer({ loadDefaultFonts: false });

const textImage = createTextImage({
  cache: /** @type {CacheStorage & { default: Cache }} */ (caches).default,
  async render(tree, { width, height, fonts }) {
    await renderer.loadFonts(fonts);
    return renderer.render(tree, { width, height });
  },
});

/**
 * The asset layer's binding to the built `dist/` directory.
 *
 * @typedef {object} Env
 * @property {{ fetch(request: Request): Promise<Response> }} ASSETS
 */

export default {
  /**
   * Serve `/text` from the renderer; every other request is a static file
   * (or a miss) handled by the `ASSETS` binding — the Worker only runs for
   * paths that match no asset.
   *
   * @param {Request} request
   * @param {Env} env
   * @returns {Promise<Response>}
   */
  fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/text") {
      return textImage(request);
    }

    return env.ASSETS.fetch(request);
  },
};
