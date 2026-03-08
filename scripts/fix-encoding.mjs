import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const mode = process.argv.includes('--fix') ? 'fix' : 'check';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage', '.vercel', '.next']);
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.scss', '.html', '.yml', '.yaml', '.sql', '.txt', '.mjs', '.cjs'
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (TEXT_EXT.has(ext) || entry.name === '.editorconfig' || entry.name === '.gitattributes') {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function count(re, s) {
  const m = s.match(re);
  return m ? m.length : 0;
}

function badScore(s) {
  return (
    count(/\uFFFD/g, s) +
    count(/[\u00C3\u00C2][\u0080-\u00BF]/g, s) +
    count(/\u00E2[\u0080-\u00BF\u20A0-\u20CF][\u0080-\u00BF\u2010-\u205E]?/g, s)
  );
}

function decodeLatin1AsUtf8(s) {
  return Buffer.from(s, 'latin1').toString('utf8');
}

function repairText(original) {
  let text = original;
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  let best = text;
  let bestScore = badScore(best);

  for (let i = 0; i < 3; i++) {
    const candidate = decodeLatin1AsUtf8(best);
    const candidateScore = badScore(candidate);
    if (candidateScore < bestScore) {
      best = candidate;
      bestScore = candidateScore;
      continue;
    }
    break;
  }

  return best;
}

const files = walk(ROOT);
const changed = [];

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const fixed = repairText(original);
  if (fixed !== original) {
    changed.push(path.relative(ROOT, file));
    if (mode === 'fix') {
      fs.writeFileSync(file, fixed, 'utf8');
    }
  }
}

console.log(`Encoding scan mode: ${mode}`);
console.log(`Scanned files: ${files.length}`);
console.log(`Files needing normalization: ${changed.length}`);
for (const file of changed) console.log(file);

if (mode === 'check' && changed.length > 0) {
  process.exit(1);
}
