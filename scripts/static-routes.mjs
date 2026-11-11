import { copyFileSync, mkdirSync } from 'node:fs';
for (const route of ['techniques', 'custom-build', 'import-grid', 'simulation']) {
  mkdirSync(`dist/${route}`, { recursive: true });
  copyFileSync('dist/index.html', `dist/${route}/index.html`);
}
