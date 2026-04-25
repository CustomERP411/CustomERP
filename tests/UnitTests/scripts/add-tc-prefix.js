#!/usr/bin/env node
/**
 * Bulk-rewrites every `// TC-UCx-NNN` commented test so that the TC id is
 * visible in the Jest output. Idempotent: if a test title already has a
 * (possibly incorrect) `TC-UC...` prefix, that prefix is replaced with
 * the TC id from the preceding comment.
 *
 * Usage:   node tests/UnitTests/scripts/add-tc-prefix.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'scripts' || entry.name === '__mocks__') continue;
      walk(full, out);
    } else if (entry.name.endsWith('.unit.test.js')) {
      out.push(full);
    }
  }
  return out;
}

// Match a // TC-UCx-NNN comment. The TC id has no spaces, so we capture
// everything non-whitespace after "TC-UC" up to the first space or end.
const TC_COMMENT = /^\s*\/\/\s*(TC-UC\S+)/;
const TEST_CALL = /^(\s*)(test|it)(\.only|\.skip)?\(\s*(['"`])([\s\S]*?)\4/;
// Existing TC prefix in a test title, optionally followed by " — " / ": " etc.
const EXISTING_TC = /^TC-UC\S*\s*[—\-:]?\s*/;

let totalFiles = 0;
let totalTitles = 0;

for (const file of walk(ROOT)) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const commentMatch = lines[i].match(TC_COMMENT);
    if (!commentMatch) continue;
    // Strip any trailing punctuation like "—" if the comment was
    // "// TC-UC2-006 — localization note" (unlikely but safe).
    const tc = commentMatch[1].replace(/[:,;—]+$/, '');

    // Find the next non-comment, non-blank line that starts a `test(` call.
    let j = i + 1;
    while (j < lines.length && /^\s*(\/\/|\/\*|\*|$)/.test(lines[j])) j++;
    if (j >= lines.length) continue;

    const m = lines[j].match(TEST_CALL);
    if (!m) continue;
    const [whole, indent, fn, modifier = '', quote, title] = m;

    // Strip any existing TC-UC prefix so re-runs fix up partial prefixes.
    const baseTitle = title.replace(EXISTING_TC, '');
    const newTitle = `${tc} — ${baseTitle}`;
    if (title === newTitle) continue; // already correct

    lines[j] = lines[j].replace(whole, `${indent}${fn}${modifier}(${quote}${newTitle}${quote}`);
    totalTitles++;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, lines.join('\n'));
    totalFiles++;
    console.log(`updated: ${path.relative(ROOT, file)}`);
  }
}

console.log(`\nDone. ${totalTitles} test title(s) prefixed across ${totalFiles} file(s).`);
