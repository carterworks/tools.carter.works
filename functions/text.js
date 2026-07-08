import { textImage } from "./_lib/text-image";

export function onRequestGet({ request }) {
  return textImage(request);
}
