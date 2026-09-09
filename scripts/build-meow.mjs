import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const state = JSON.parse(readFileSync('.release-build.json', 'utf8'));
if (state.project !== 'doro' || state.phase !== 'reserved') {
  throw new Error('Reserve a new Doro build before building for Meow.');
}
const base = new URL(state.reservedBuild.publicUrl);
if (base.origin !== 'https://img.yuxino.cn' || !/^\/fe-build\/doro\/\d+\/$/.test(base.pathname)) {
  throw new Error('Unexpected Meow CDN directory.');
}
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit', env: { ...process.env, BUILD_PUBLIC_BASE_URL: base.href },
});
process.exit(result.status ?? 1);
