// Assembles the Vercel deployment:
//   /            -> apps/website (static)
//   /backoffice  -> apps/admin-web (static SPA, base path /backoffice/)
//   /api/*       -> apps/api bundled into one serverless function
// Output uses the Vercel Build Output API (.vercel/output) so the function is created at
// build time; files under /api are not detected from the repo.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';

const run = (cmd, env = {}) =>
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });

const ROOT = '.vercel/output';
const OUT = `${ROOT}/static`;
const FN = `${ROOT}/functions/api/index.func`;
rmSync(ROOT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(FN, { recursive: true });

run('pnpm --filter @ameen/website build');
cpSync('apps/website/dist', OUT, { recursive: true });

// Same-origin API: empty VITE_API_URL makes the console call /api/v1/... relative to the site.
run('pnpm --filter @ameen/admin-web build', { VITE_BASE: '/backoffice/', VITE_API_URL: '' });
cpSync('apps/admin-web/dist', `${OUT}/backoffice`, { recursive: true });

// Native / optional modules stay external; everything else is bundled into one file.
await build({
  entryPoints: ['apps/api/src/serverless.ts'],
  outfile: `${FN}/index.js`,
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

// Native module `argon2` and its runtime deps are copied next to the bundle.
function copyPackage(name, fromDir, seen = new Set()) {
  const req = createRequire(join(fromDir, 'noop.js'));
  const pkgJson = req.resolve(`${name}/package.json`);
  const dir = realpathSync(dirname(pkgJson));
  if (seen.has(dir)) return;
  seen.add(dir);
  cpSync(dir, `${FN}/node_modules/${name}`, { recursive: true, dereference: true });
  const pkg = JSON.parse(readFileSync(pkgJson, 'utf8'));
  for (const dep of Object.keys(pkg.dependencies ?? {})) copyPackage(dep, dir, seen);
}
copyPackage('argon2', process.cwd());

writeFileSync(
  `${FN}/.vc-config.json`,
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.js', launcherType: 'Nodejs', maxDuration: 30 }),
);

writeFileSync(
  `${ROOT}/config.json`,
  JSON.stringify({
    version: 3,
    routes: [
      { src: '/api/(.*)', dest: '/api/index' },
      { src: '/backoffice(?:/(.*))?', headers: { 'X-Robots-Tag': 'noindex, nofollow' }, continue: true },
      { handle: 'filesystem' },
      { src: '/backoffice(?:/(.*))?', dest: '/backoffice/index.html' },
    ],
  }),
);
if (!existsSync(`${OUT}/index.html`)) throw new Error('website build missing from output');
