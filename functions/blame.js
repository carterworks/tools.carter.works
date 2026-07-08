import { blamePreset, textImage } from "./_lib/text-image";

export function onRequestGet({ request }) {
  const url = new URL(request.url);

  return textImage(request, blamePreset(url.searchParams));
}
