// @ts-check

import { textImage } from "./text-image.js";

/**
 * The asset layer's binding to the built `public/` directory.
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
