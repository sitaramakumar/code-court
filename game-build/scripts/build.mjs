import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { zipSync } from 'fflate';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const artifacts = resolve(root, 'artifacts');
const functionBundle = resolve(artifacts, 'function', 'game.cjs');

await rm(dist, { recursive: true, force: true });
await rm(artifacts, { recursive: true, force: true });
await cp(resolve(root, 'public'), dist, { recursive: true });
await mkdir(dirname(functionBundle), { recursive: true });
await build({
  entryPoints: [resolve(root, 'netlify/functions/game.ts')],
  outfile: functionBundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  packages: 'bundle',
  external: ['node:*'],
  sourcemap: false,
  legalComments: 'none'
});

const bundledSource = await readFile(functionBundle);
const functionZip = zipSync({ 'game.cjs': bundledSource }, { level: 9 });
await writeFile(resolve(artifacts, 'netlify-function.zip'), functionZip);
console.log('Built dist/ and artifacts/netlify-function.zip');
