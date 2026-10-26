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
 * @param {string} fullHash
 * @returns {string | undefined}
 */
function getCommitUrl(root, fullHash) {
  const server = process.env.GITHUB_SERVER_URL?.replace(/\/+$/, "");
  const repository = process.env.GITHUB_REPOSITORY;
  if (server && repository) return `${server}/${repository}/commit/${fullHash}`;

  try {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const match = remote
      .replace(/\/+$/, "")
      .match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);

    return match ? `https://github.com/${match[1]}/${match[2]}/commit/${fullHash}` : undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {string} root
 * @returns {{ hash: string, message: string, date: string, url?: string } | undefined}
 */
export function getBuildInfo(root) {
  try {
    const output = execFileSync("git", ["log", "-1", "--format=%H%n%h%n%s%n%cs"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const [fullHash, hash, message, date] = output.split("\n").map((line) => line.trim());

    return fullHash && hash && message && date
      ? { hash, message, date, url: getCommitUrl(root, fullHash) }
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {{ hash: string, message: string, date: string, url?: string } | undefined} info
 * @returns {string}
 */
export function renderBuildInfo(info) {
  if (!info) return "";

  const hash = info.url
    ? `<a href="${escapeHtml(info.url)}"><code>${escapeHtml(info.hash)}</code></a>`
    : `<code>${escapeHtml(info.hash)}</code>`;

  return `<footer class="build-info">
  <p>${hash} · ${escapeHtml(info.message)} · <time datetime="${escapeHtml(info.date)}">${escapeHtml(info.date)}</time></p>
</footer>`;
}
