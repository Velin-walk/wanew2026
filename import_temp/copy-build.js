import fs from 'node:fs';

try {
  fs.cpSync('dist', 'build', { recursive: true });
} catch (err) {
  console.warn('Could not copy dist to build:', err.message);
}
