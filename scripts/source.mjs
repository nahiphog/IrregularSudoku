import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('public', { recursive: true });
// Ship corresponding source and build instructions alongside GPL-derived content.
execFileSync('tar', ['-czf', 'public/source.tar.gz', 'public/irregular.svg', 'src', 'vendor', 'tests', 'scripts', '.github', 'vite.config.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'index.html', 'README.md', 'LICENSE', '.gitignore']);
