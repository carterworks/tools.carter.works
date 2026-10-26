// @ts-check

import wasm, { initSync, Renderer } from "takumi-js/wasm";
import { container, googleFont, text } from "takumi-js/helpers";

// Load the WASM backend explicitly because takumi-js's auto-loader emits a
// bare dynamic import that Cloudflare Workers cannot resolve.
initSync({ module: wasm });

const renderer = new Renderer({ loadDefaultFonts: false });

/** @typedef {"left" | "center" | "right"} Alignment */
/**
 * @typedef {object} RenderParams
 * @property {string} text
 * @property {string} font
 * @property {Alignment} align
 * @property {string} bg
 * @property {string} color
 * @property {number} w
 * @property {number} h
 * @property {number} size
 * @property {number} pad
 */
/**
 * @typedef {object} LoadedFont
 * @property {string} family
 * @property {import("takumi-js").FontLoader[]} fonts
 */

const CACHE_VERSION = "v4";
const MAX_TEXT_LENGTH = 180;
const DEFAULT_FONT = "Inter";

const ALIGNMENTS = new Set(["left", "center", "right"]);

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function textImage(request) {
  try {
    const params = normalizeParams(new URL(request.url).searchParams);
    const defaultCache = cloudflareDefaultCache();
    const cacheRequest = new Request(normalizedCacheUrl(request.url, params), request);
    const cached = await defaultCache.match(cacheRequest);

    if (cached) {
      return cached;
    }

    const loadedFont = await loadFont(params.font, params.text);
    await renderer.loadFonts(loadedFont.fonts);
    const png = renderer.render(renderTree({ ...params, font: loadedFont.family }), {
      width: params.w,
      height: params.h,
    });
    const response = new Response(new Uint8Array(png).buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });

    await defaultCache.put(cacheRequest, response.clone());
    return response;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error(error);
    return jsonError("render_failed", 500);
  }
}

/**
 * @returns {Cache}
 */
function cloudflareDefaultCache() {
  return /** @type {CacheStorage & { default: Cache }} */ (caches).default;
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {RenderParams}
 */
function normalizeParams(searchParams) {
  const textValue = firstText(searchParams.get("text"));

  if (!textValue) {
    throw jsonError("missing_text", 400);
  }

  return {
    text: textValue.slice(0, MAX_TEXT_LENGTH),
    font: fontFamily(searchParams.get("font"), DEFAULT_FONT),
    align: alignment(searchParams.get("align")),
    bg: hex(searchParams.get("bg"), "111827"),
    color: hex(searchParams.get("color"), "facc15"),
    w: integer(searchParams.get("w"), 1200, 320, 1600),
    h: integer(searchParams.get("h"), 630, 180, 1200),
    size: integer(searchParams.get("size"), 0, 24, 180),
    pad: integer(searchParams.get("pad"), 72, 16, 160),
  };
}

/**
 * @param {RenderParams} params
 * @returns {import("takumi-js").Node}
 */
function renderTree(params) {
  /** @type {Record<Alignment, string>} */
  const justifyContentByAlignment = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
  };
  const fontSize = params.size || autoFontSize(params);

  return container({
    style: {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: justifyContentByAlignment[params.align],
      padding: params.pad,
      backgroundColor: `#${params.bg}`,
    },
    children: [
      text(params.text, {
        width: "100%",
        color: `#${params.color}`,
        fontFamily: params.font,
        fontSize,
        fontWeight: 400,
        lineHeight: 0.95,
        overflowWrap: "break-word",
        textAlign: params.align,
      }),
    ],
  });
}

/**
 * @param {string} rawUrl
 * @param {RenderParams} params
 * @returns {string}
 */
function normalizedCacheUrl(rawUrl, params) {
  const url = new URL(rawUrl);
  const normalized = new URL(url.origin + url.pathname);

  /** @type {(keyof RenderParams)[]} */
  const cacheKeys = ["text", "font", "align", "bg", "color", "w", "h", "size", "pad"];

  for (const key of cacheKeys) {
    normalized.searchParams.set(key, String(params[key]));
  }

  normalized.searchParams.set("v", CACHE_VERSION);
  normalized.searchParams.sort();
  return normalized.toString();
}

/**
 * @param {...(string | null | undefined)} values
 * @returns {string | undefined}
 */
function firstText(...values) {
  return values.find((value) => value && value.trim())?.trim();
}

/**
 * @param {string | null} value
 * @param {string} fallback
 * @returns {string}
 */
function hex(value, fallback) {
  const normalized = value?.replace(/^#/, "") ?? "";

  return /^[0-9a-f]{6}$/i.test(normalized) ? normalized.toLowerCase() : fallback;
}

/**
 * @param {string | null} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function integer(value, fallback, min, max) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

/**
 * @param {string | null} value
 * @returns {Alignment}
 */
function alignment(value) {
  return typeof value === "string" && ALIGNMENTS.has(value) ? /** @type {Alignment} */ (value) : "center";
}

/**
 * @param {string | null} value
 * @param {string} fallback
 * @returns {string}
 */
function fontFamily(value, fallback) {
  const normalized = (value?.trim() || fallback).replace(/\s+/g, " ").slice(0, 64);

  return /^[A-Za-z0-9][A-Za-z0-9 .,'-]*$/.test(normalized) ? normalized : DEFAULT_FONT;
}

/**
 * @param {string} family
 * @param {string} value
 * @returns {Promise<LoadedFont>}
 */
async function loadFont(family, value) {
  try {
    return { family, fonts: await googleFont(family, { weight: 400, text: value, display: "swap" }) };
  } catch (error) {
    if (family === DEFAULT_FONT) {
      throw error;
    }

    return { family: DEFAULT_FONT, fonts: await googleFont(DEFAULT_FONT, { weight: 400, text: value, display: "swap" }) };
  }
}

/**
 * @param {RenderParams} params
 * @returns {number}
 */
function autoFontSize({ text: value, w, h, pad }) {
  const usableWidth = w - pad * 2;
  const usableHeight = h - pad * 2;
  const byWidth = usableWidth / Math.max(5, Math.sqrt(value.length) * 1.5);
  const byHeight = usableHeight / 2.4;

  return Math.round(Math.min(180, Math.max(24, Math.min(byWidth, byHeight))));
}

/**
 * @param {string} code
 * @param {number} status
 * @returns {Response}
 */
function jsonError(code, status) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
