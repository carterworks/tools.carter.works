// @ts-check

import { textImage } from "./_lib/text-image";

/**
 * @param {{ request: Request }} context
 * @returns {Promise<Response>}
 */
export function onRequestGet({ request }) {
  return textImage(request);
}
