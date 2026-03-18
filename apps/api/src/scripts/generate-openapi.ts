import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import app from '../index.js';

const doc = app.getOpenAPIDocument({
  openapi: '3.1.0',
  info: {
    title: 'PomoFocus API',
    version: '0.1.0',
  },
});

const outPath = resolve(import.meta.dirname, '../../openapi.json');
writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n');

console.log(`OpenAPI spec written to ${outPath}`);
