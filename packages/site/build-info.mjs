import { execFileSync } from "node:child_process";

const htmlEscapes = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => htmlEscapes[character]);
}

/**
 * @param {string} root
 * @returns {{ hash: string, message: string, date: string } | undefined}
 */
export function getBuildInfo(root) {
  try {
    const output = execFileSync("git", ["log", "-1", "--format=%h%n%s%n%cs"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const [hash, message, date] = output.split("\n").map((line) => line.trim());

    return hash && message && date ? { hash, message, date } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {{ hash: string, message: string, date: string } | undefined} info
 * @returns {string}
 */
export function renderBuildInfo(info) {
  if (!info) return "";

  return `<footer class="build-info">
  <p>Latest commit <code>${escapeHtml(info.hash)}</code> on <time datetime="${escapeHtml(info.date)}">${escapeHtml(info.date)}</time></p>
  <p>${escapeHtml(info.message)}</p>
</footer>`;
}
