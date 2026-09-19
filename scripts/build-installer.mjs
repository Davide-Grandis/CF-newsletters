import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = join(root, 'workers', 'installer', 'src', 'generated', 'artifacts.ts');
const workerNames = ['ingest', 'consumer', 'tracker', 'bounce', 'cleanup', 'admin'];
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function filesIn(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesIn(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function assetHash(bytes, extension) {
  return createHash('sha256').update(bytes.toString('base64') + extension.slice(1)).digest('hex').slice(0, 32);
}

const artifacts = {};
for (const name of workerNames) {
  const result = await build({
    entryPoints: [join(root, 'workers', name, 'src', 'index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    write: false,
    loader: { '.md': 'text' },
    external: ['cloudflare:*'],
  });
  artifacts[name] = result.outputFiles[0].text;
}

const publicDirectory = join(root, 'workers', 'admin', 'public');
const assets = Object.fromEntries(filesIn(publicDirectory).map((path) => {
  const bytes = readFileSync(path);
  const extension = extname(path).toLowerCase();
  return [`/${relative(publicDirectory, path).replaceAll('\\', '/')}`, {
    base64: bytes.toString('base64'),
    hash: assetHash(bytes, extension),
    size: bytes.byteLength,
    contentType: mimeTypes[extension] ?? 'application/octet-stream',
  }];
}));

const generated = [
  `export const WORKER_ARTIFACTS = ${JSON.stringify(artifacts)} as const;`,
  `export const ADMIN_ASSETS = ${JSON.stringify(assets)} as const;`,
  `export const DATABASE_SCHEMA = ${JSON.stringify(readFileSync(join(root, 'db', 'schema.sql'), 'utf8'))};`,
].join('\n\n');

mkdirSync(resolve(output, '..'), { recursive: true });
writeFileSync(output, generated);
console.log(`Generated installer payload: ${relative(root, output)}`);
