import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve build output directory (supports dist or build)
const staticDir = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, 'build');

// Serve built static assets with cache controls
app.use(express.static(staticDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html') || filePath.endsWith('sw.js') || filePath.endsWith('registerSW.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    } else if (filePath.includes('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Return 404 for missing static asset files to prevent SPA fallback syntax errors
app.use('/assets', (req, res) => {
  res.status(404).send('Asset not found');
});

app.get(['/*.js', '/*.css', '/*.map', '/*.json', '/*.webmanifest'], (req, res, next) => {
  if (!fs.existsSync(path.join(staticDir, req.path))) {
    return res.status(404).send('File not found');
  }
  next();
});

// SPA fallback for client-side routing
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Walk Nepal Walk server running on http://0.0.0.0:${PORT}`);
});
