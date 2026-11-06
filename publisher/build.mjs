import { spawnSync } from 'node:child_process';

// The publisher build must also work in constrained CI/Docker environments:
// Turbopack's CSS worker may be unable to bind an internal port there.
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], {
  stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_BASE_PATH: '' },
});
process.exit(result.status ?? 1);
