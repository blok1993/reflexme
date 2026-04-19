/**
 * Resolves apps/backend/prisma/schema.prisma from monorepo root, nested repo, or apps/backend cwd.
 * Usage: node scripts/run-prisma.cjs generate
 *        node scripts/run-prisma.cjs db push
 *        node scripts/run-prisma.cjs studio
 */
const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const CANDIDATES = [
  path.join('predictor', 'apps', 'backend', 'prisma', 'schema.prisma'),
  path.join('apps', 'backend', 'prisma', 'schema.prisma'),
  path.join('prisma', 'schema.prisma'),
];

function findSchema() {
  for (const p of CANDIDATES) {
    if (existsSync(p)) return p;
  }
  console.error(
    '[prisma] schema.prisma not found. Checked (from cwd %s):\n  %s',
    process.cwd(),
    CANDIDATES.join('\n  '),
  );
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
});

process.exit(result.status ?? 1);
