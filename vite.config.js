import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const assetRevision = createHash('sha256');
for (const name of ['doro.glb', 'doro-dog.glb', 'poster.png', 'poster-dog.png', 'palico.glb', 'palico.png', 'siamese.glb', 'siamese.png']) {
  assetRevision.update(readFileSync(new URL(`./public/assets/${name}`, import.meta.url)));
}

export default defineConfig({
  base: './',
  define: { __ASSET_REVISION__: JSON.stringify(assetRevision.digest('hex').slice(0, 12)) },
  build: { target: 'es2022', sourcemap: false },
});
