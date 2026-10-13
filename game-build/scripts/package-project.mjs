import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'netlify-ready-game.zip');
const files = new Map();
const includedFiles = ['README.md', 'netlify.toml', 'package.json', 'package-lock.json', 'questions.js'];
const includedFolders = ['public', 'lib', 'netlify', 'scripts', 'tests', 'dist'];

async function addFile(path) {
  const archivePath = relative(root, path).split(sep).join('/');
  if (archivePath === 'netlify-ready-game.zip' || archivePath.includes('/node_modules/') || archivePath.includes('/.git/') || /(?:^|\/)(?:\.cache|\.netlify|logs?)(?:\/|$)/i.test(archivePath)) return;
  files.set(archivePath, await readFile(path));
}

async function addFolder(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.cache' || entry.name === '.netlify' || /^(?:logs?|cache)$/i.test(entry.name)) continue;
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) await addFolder(child);
    else if (entry.isFile()) await addFile(child);
  }
}

for (const file of includedFiles) await addFile(resolve(root, file));
for (const folder of includedFolders) await addFolder(resolve(root, folder));
await addFile(resolve(root, 'artifacts/netlify-function.zip'));
const archive = zipSync(Object.fromEntries(files), { level: 9 });
await writeFile(output, archive);
console.log(`Packaged ${files.size} project files at ${relative(root, output)}`);
