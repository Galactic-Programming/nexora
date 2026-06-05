#!/usr/bin/env node
// @ts-check
/**
 * Postman collection build script.
 *
 * Merges:
 *   - `src/collection.base.json` — info + auth + collection-level pre-request
 *   - `src/folders/<file>` referenced from `base.folders` in order
 *
 * Output:
 *   - `tourism-api.json` (one level above `src/`)
 *
 * Modes (selected by the `--mode` flag, default `write`):
 *   - `write` — overwrite the generated JSON.
 *   - `check` — fail with exit code 1 if the generated content differs from
 *               what's already on disk. Used by CI to ensure people don't
 *               hand-edit the generated file.
 *
 * Why a custom script (not a Postman extension)? Postman has no native
 * include/$ref. Keeping the splitter in plain Node means zero new deps and
 * the script doubles as repo documentation.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = HERE;
const BASE_FILE = join(SRC_DIR, 'collection.base.json');
const FOLDERS_DIR = join(SRC_DIR, 'folders');
const OUT_FILE = resolve(SRC_DIR, '..', 'tourism-api.json');

const args = new Set(process.argv.slice(2));
const mode = args.has('--check') ? 'check' : 'write';

/**
 * @param {string} path
 * @returns {Promise<unknown>}
 */
async function readJson(path) {
  const text = await readFile(path, 'utf8');
  return JSON.parse(text);
}

async function buildCollection() {
  const base = /** @type {Record<string, unknown> & { folders: string[] }} */ (
    await readJson(BASE_FILE)
  );

  if (!Array.isArray(base.folders) || base.folders.length === 0) {
    throw new Error(
      'collection.base.json must declare a non-empty `folders` array',
    );
  }

  /** @type {unknown[]} */
  const items = [];
  for (const file of base.folders) {
    const folder = await readJson(join(FOLDERS_DIR, file));
    items.push(folder);
  }

  // Strip the `folders` field — it's a build-time hint, not part of the
  // Postman v2.1 schema. Spread the rest verbatim and append items.
  const { folders: _, ...rest } = base;
  return { ...rest, item: items };
}

function stringify(collection) {
  // Match the formatting Postman GUI uses on Export: 2-space indent, trailing
  // newline. Keeps git diffs stable.
  return JSON.stringify(collection, null, 2) + '\n';
}

async function main() {
  const collection = await buildCollection();
  const out = stringify(collection);

  if (mode === 'check') {
    let existing = '';
    try {
      existing = await readFile(OUT_FILE, 'utf8');
    } catch {
      // File missing — same as a content mismatch.
    }
    // Compare EOL-insensitively: the generated string uses LF, but a checkout
    // on Windows (or a CRLF-committed blob) may have CRLF on disk. Line endings
    // are not meaningful content for this generated file, so normalize before
    // comparing to avoid false "out of date" failures across platforms.
    if (existing.replace(/\r\n/g, '\n') !== out) {
      console.error(
        '[postman:check] tourism-api.json is out of date. ' +
          'Run `pnpm postman:build` and commit the result.',
      );
      process.exit(1);
    }
    console.log('[postman:check] tourism-api.json is up to date.');
    return;
  }

  await writeFile(OUT_FILE, out, 'utf8');
  const folderCount = collection.item.length;
  const requestCount = collection.item.reduce(
    (sum, f) => sum + (f.item?.length ?? 0),
    0,
  );
  console.log(
    `[postman:build] wrote ${OUT_FILE} — ${folderCount} folders, ${requestCount} requests.`,
  );
}

main().catch((err) => {
  console.error('[postman:build] failed:', err);
  process.exit(1);
});
