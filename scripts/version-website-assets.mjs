import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../website/', import.meta.url));
const write = process.argv.includes('--write');
const prepared = new Map();
const visiting = new Set();
const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

// Hash imported styles first so a changed dependency also changes its parent's URL.
function prepare(file) {
  if (prepared.has(file)) return prepared.get(file);
  if (visiting.has(file)) throw new Error(`Circular stylesheet import: ${file}`);
  visiting.add(file);
  const source = readFileSync(file, 'utf8');
  const result = file.endsWith('.css')
    ? source.replace(/(@import\s+url\(['"])([^'"]+)(['"]\))/g,
      (match, before, url, after) => {
        if (/^(?:[a-z]+:|\/\/)/i.test(url)) return match;
        return before + version(url, dirname(file)) + after;
      })
    : source;
  visiting.delete(file);
  prepared.set(file, result);
  return result;
}

function version(url, directory) {
  const [path] = url.split(/[?#]/);
  const file = resolve(directory, path);
  const name = relative(root, file);
  if (name.startsWith(`..${sep}`) || name === '..') throw new Error('Asset is outside website');
  return `${path}?v=${hash(prepare(file))}`;
}

for (const name of readdirSync(root).filter((name) => name.endsWith('.html'))) {
  const file = resolve(root, name);
  const source = readFileSync(file, 'utf8');
  prepared.set(file, source.replace(/((?:src|href)=["'])(assets\/[^"']+\.(?:css|js)(?:\?[^"']*)?)(["'])/g,
    (_, before, url, after) => before + version(url, root) + after));
}

const stale = [...prepared].filter(([file, text]) => readFileSync(file, 'utf8') !== text);
if (write) {
  for (const [file, text] of stale) writeFileSync(file, text);
  console.log(`Updated asset versions in ${stale.length} website files.`);
} else if (stale.length) {
  console.error('Stale website asset versions. Run npm run website:version and commit the results.');
  console.error(stale.map(([file]) => relative(root, file)).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Website asset versions match their content.');
}
