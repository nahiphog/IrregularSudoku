import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('dist/techniques', { recursive: true });
copyFileSync('dist/index.html', 'dist/techniques/index.html');
