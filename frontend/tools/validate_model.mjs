// Usage: node validate_model.mjs ../public/models/engine.glb
import fs from 'fs'; import validator from 'gltf-validator';
const buf = fs.readFileSync(process.argv[2] ?? '../public/models/engine.glb');
const r = await validator.validateBytes(new Uint8Array(buf));
console.log('errors', r.issues.numErrors, 'warnings', r.issues.numWarnings, '| triangles', r.info.totalTriangleCount, '| extensions', r.info.extensionsUsed);
process.exit(r.issues.numErrors ? 1 : 0);
