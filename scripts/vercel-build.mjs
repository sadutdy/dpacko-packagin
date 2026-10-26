// Assembles the Vercel deployment:
//   /            -> apps/website (static)
//   /backoffice  -> apps/admin-web (static SPA, base path /backoffice/)
//   /api/*       -> apps/api bundled into api/index.js (serverless function)
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { build } from 'esbuild';

const run = (cmd, env = {}) =>
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });

const OUT = 'dist-vercel';
rmSync(OUT, { recursive: true, force: true });
rmSync('api/index.js', { force: true });
mkdirSync(OUT, { recursive: true });

run('pnpm --filter @ameen/website build');
cpSync('apps/website/dist', OUT, { recursive: true });

// Same-origin API: empty VITE_API_URL makes the console call /api/v1/... relative to the site.
run('pnpm --filter @ameen/admin-web build', { VITE_BASE: '/backoffice/', VITE_API_URL: '' });
cpSync('apps/admin-web/dist', `${OUT}/backoffice`, { recursive: true });

// Native / optional modules stay external; everything else is bundled into one file.
await build({
  entryPoints: ['apps/api/src/serverless.ts'],
  outfile: 'api/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: false,
  logLevel: 'info',
  external: [
    'argon2',
    'kerberos',
    'snappy',
    '@mongodb-js/zstd',
    '@aws-sdk/credential-providers',
    'gcp-metadata',
    'socks',
    'mongodb-client-encryption',
    'aws4',
  ],
});
