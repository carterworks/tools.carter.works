import { render } from "takumi-js";
import { container, googleFont, text } from "takumi-js/helpers";

const CACHE_VERSION = "v1";
const MAX_TEXT_LENGTH = 180;
const MAX_LABEL_LENGTH = 40;

const FONTS = {
  Inter: { weight: [400, 800], renderWeight: 800 },
  Bangers: { weight: 400, renderWeight: 400 },
  "JetBrains Mono": { weight: [400, 800], renderWeight: 800 },
  "Rubik Glitch": { weight: 400, renderWeight: 400 },
  Oswald: { weight: [400, 700], renderWeight: 700 },
};

const ALIGNMENTS = new Set(["left", "center", "right"]);

export async function textImage(request, preset = {}) {
  try {
    const params = normalizeParams(new URL(request.url).searchParams, preset);
    const cacheRequest = new Request(normalizedCacheUrl(request.url, params), request);
    const cached = await caches.default.match(cacheRequest);

    if (cached) {
      return cached;
    }

    const fontConfig = FONTS[params.font];
    const png = await render(renderTree(params, fontConfig), {
      width: params.w,
      height: params.h,
      fonts: await googleFont(params.font, {
        weight: fontConfig.weight,
        text: params.text,
        display: "swap",
      }),
      emoji: "from-font",
    });
    const response = new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });

    await caches.default.put(cacheRequest, response.clone());
    return response;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error(error);
    return jsonError("render_failed", 500);
  }
}

export function incidentPreset(searchParams) {
  const service = label(searchParams.get("service"), "deploys");
  const cause = label(searchParams.get("cause"), "entropy");

  return {
    text: `SEV-2: ${service} was defeated by ${cause}`,
    bg: "111827",
    color: "fb7185",
    font: "Oswald",
  };
}

export function oraclePreset(searchParams) {
  const repo = label(searchParams.get("repo"), "main");
  const prophecies = [
    "CI will pass after 3 unrelated flakes",
    "the cache is haunted but correct",
    "one line fixes it, nobody knows why",
    "the rollback will be called a migration",
    "types will reveal the betrayal",
  ];

  return {
    text: `${repo}: ${prophecies[hash(repo) % prophecies.length]}`,
    bg: "0f172a",
    color: "38bdf8",
    font: "Bangers",
  };
}

export function blamePreset(searchParams) {
  const user = label(searchParams.get("user"), "someone");
  const reason = label(searchParams.get("reason"), "force-pushed");

  return {
    text: `${user} did it: ${reason}`,
    bg: "facc15",
    color: "111827",
    font: "Rubik Glitch",
  };
}

function normalizeParams(searchParams, preset) {
  const textValue = firstText(searchParams.get("text"), preset.text);

  if (!textValue) {
    throw jsonError("missing_text", 400);
  }

  return {
    text: textValue.slice(0, MAX_TEXT_LENGTH),
    font: FONTS[searchParams.get("font")] ? searchParams.get("font") : preset.font ?? "Inter",
    align: ALIGNMENTS.has(searchParams.get("align")) ? searchParams.get("align") : "center",
    bg: hex(searchParams.get("bg"), preset.bg ?? "111827"),
    color: hex(searchParams.get("color"), preset.color ?? "facc15"),
    w: integer(searchParams.get("w"), 1200, 320, 1600),
    h: integer(searchParams.get("h"), 630, 180, 1200),
    size: integer(searchParams.get("size"), 0, 24, 180),
    pad: integer(searchParams.get("pad"), 72, 16, 160),
  };
}

function renderTree(params, fontConfig) {
  const justifyContent = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
  }[params.align];
  const fontSize = params.size || autoFontSize(params);

  return container({
    style: {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent,
      padding: params.pad,
      backgroundColor: `#${params.bg}`,
    },
    children: [
      text(params.text, {
        width: "100%",
        color: `#${params.color}`,
        fontFamily: params.font,
        fontSize,
        fontWeight: fontConfig.renderWeight,
        lineHeight: 0.95,
        overflowWrap: "break-word",
        textAlign: params.align,
        textTransform: "uppercase",
      }),
    ],
  });
}

function normalizedCacheUrl(rawUrl, params) {
  const url = new URL(rawUrl);
  const normalized = new URL(url.origin + url.pathname);

  for (const key of ["text", "font", "align", "bg", "color", "w", "h", "size", "pad"]) {
    normalized.searchParams.set(key, params[key]);
  }

  normalized.searchParams.set("v", CACHE_VERSION);
  normalized.searchParams.sort();
  return normalized.toString();
}

function firstText(...values) {
  return values.find((value) => value && value.trim())?.trim();
}

function hex(value, fallback) {
  const normalized = value?.replace(/^#/, "");

  return /^[0-9a-f]{6}$/i.test(normalized) ? normalized.toLowerCase() : fallback;
}

function integer(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function autoFontSize({ text: value, w, h, pad }) {
  const usableWidth = w - pad * 2;
  const usableHeight = h - pad * 2;
  const byWidth = usableWidth / Math.max(5, Math.sqrt(value.length) * 1.5);
  const byHeight = usableHeight / 2.4;

  return Math.round(Math.min(180, Math.max(24, Math.min(byWidth, byHeight))));
}

function label(value, fallback) {
  return (value?.trim() || fallback).slice(0, MAX_LABEL_LENGTH);
}

function hash(value) {
  let result = 0;

  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }

  return result;
}

function jsonError(code, status) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
