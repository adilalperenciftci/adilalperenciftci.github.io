import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "motion.js",
  "404.html",
  "robots.txt",
  "sitemap.xml",
  "site.webmanifest",
  "assets/favicon.svg",
  "assets/social-card.svg",
  ".github/workflows/pages.yml",
];

for (const file of requiredFiles) {
  assert.ok(existsSync(resolve(root, file)), `missing required file: ${file}`);
}

const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "styles.css"), "utf8");
const js = readFileSync(resolve(root, "app.js"), "utf8");
const workflow = readFileSync(resolve(root, ".github/workflows/pages.yml"), "utf8");

for (const id of ["research", "upstream", "labs", "identity", "contact"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `missing section #${id}`);
}

assert.match(html, /<meta\s+name="description"\s+content="[^"]{80,}"/i);
assert.match(html, /<link\s+rel="canonical"\s+href="https:\/\/adilalperenciftci\.github\.io\/"/i);
assert.match(html, /class="skip-link"/i);
assert.match(html, /<nav[^>]+aria-label=/i);
assert.match(html, /aria-live="polite"/i);

const filters = [...html.matchAll(/data-filter="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(new Set(filters), new Set(["all", "runtime", "identity", "protocol", "platform"]));

const cards = [...html.matchAll(/class="[^"]*project-card[^"]*"[^>]+data-category="([^"]+)"/g)];
assert.ok(cards.length >= 10, `expected at least 10 project cards, found ${cards.length}`);

for (const match of html.matchAll(/<a\b([^>]*\btarget="_blank"[^>]*)>/gi)) {
  assert.match(match[1], /\brel="[^"]*noopener[^"]*"/i, "external target must use rel=noopener");
}

for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  const value = match[1];
  if (/^(?:https?:|mailto:|#|data:)/.test(value)) continue;
  const local = value.split(/[?#]/, 1)[0];
  assert.ok(existsSync(resolve(root, local)), `missing linked asset: ${local}`);
}

assert.doesNotMatch(html, /href="(?:#|javascript:void\(0\))"/i);
assert.match(css, /@media\s*\([^)]*max-width/i);
assert.match(css, /prefers-reduced-motion/i);
assert.match(css, /:focus-visible/i);
assert.match(js, /addEventListener\(["']click["']/);
assert.match(js, /dataset\.filter/);
assert.match(js, /history\.replaceState/);

for (const token of [
  "pages: write",
  "id-token: write",
  "actions/configure-pages@",
  "actions/upload-pages-artifact@",
  "actions/deploy-pages@",
]) {
  assert.ok(workflow.includes(token), `Pages workflow missing ${token}`);
}

console.log(`site checks passed: ${requiredFiles.length} files, ${cards.length} project cards`);
