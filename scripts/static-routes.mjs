import { copyFileSync, mkdirSync } from 'node:fs';
for (const route of ['techniques', 'custom-build']) {
  mkdirSync(`dist/${route}`, { recursive: true });
  copyFileSync('dist/index.html', `dist/${route}/index.html`);
}
