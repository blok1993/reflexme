/**
 * Resolves apps/backend/prisma/schema.prisma. Uses __dirname first so Prisma always
 * finds the file even when process.cwd() is wrong (Nixpacks, Railway, subdir builds).
 *
 * Usage: node scripts/run-prisma.cjs generate
 *        node scripts/run-prisma.cjs db push
 *        node scripts/run-prisma.cjs studio
 */
const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

/** This file: <monorepoRoot>/scripts/run-prisma.cjs → schema is next to “apps/” at root. */
const VIA_SCRIPT = path.resolve(__dirname, '..', 'apps', 'backend', 'prisma', 'schema.prisma');

const REPO_ROOT = path.resolve(__dirname, '..');

const CANDIDATES_REL_CWD = [
  path.join('predictor', 'apps', 'backend', 'prisma', 'schema.prisma'),
  path.join('apps', 'backend', 'prisma', 'schema.prisma'),
  path.join('prisma', 'schema.prisma'),
];

/** Walk parents of cwd (e.g. /app, /, repo roots) until apps/backend/prisma/schema.prisma appears */
function findSchemaWalkingUpFromCwd() {
  let dir = process.cwd();
  for (let i = 0; i < 16; i++) {
    const p = path.join(dir, 'apps', 'backend', 'prisma', 'schema.prisma');
    if (existsSync(p)) return p;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function findSchema() {
  const tried = [];

  if (existsSync(VIA_SCRIPT)) {
    return VIA_SCRIPT;
  }
  tried.push(VIA_SCRIPT);

  const walked = findSchemaWalkingUpFromCwd();
  if (walked) return walked;
  tried.push('(walk up from cwd: apps/backend/prisma/schema.prisma)');

  for (const rel of CANDIDATES_REL_CWD) {
    const abs = path.resolve(process.cwd(), rel);
    tried.push(abs);
    if (existsSync(rel)) return path.resolve(rel);
    if (existsSync(abs)) return abs;
  }

  console.error('[prisma] schema.prisma not found.');
  console.error('[prisma] cwd:', process.cwd());
  console.error('[prisma] __dirname:', __dirname);
  console.error('[prisma] tried:\n  %s', tried.join('\n  '));
  process.exit(1);
}

const schema = findSchema();
console.error('[prisma] using schema:', schema);

const rest = process.argv.slice(2);
if (rest.length === 0) {
  console.error('Usage: node scripts/run-prisma.cjs <generate | db push | studio | …>');
  process.exit(1);
}

const prismaArgs = ['prisma', ...rest, '--schema', schema];
const result = spawnSync('npx', prismaArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
  // Always resolve `prisma` from monorepo node_modules (same version as lockfile). Fixes wrong cwd + Prisma 7 from npx cache.
  cwd: REPO_ROOT,
});

process.exit(result.status ?? 1);
