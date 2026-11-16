// Usage: node process_model.mjs <input scene.gltf> <output dir>
// Maps the model's parts to engine stations, decimates, merges to one material and meshopt-compresses.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, flatten, prune, meshopt, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import fs from 'fs';

const [input = './scene.gltf', outDir = '../public/models'] = process.argv.slice(2);

// ---- EDIT HERE to change which part belongs to which station -------------------------------------
const STATION = {
  Front_Rim:'fan', Primary_Turbine_Case:'fan', Primary_Turbine_Bushing:'fan', Primary_Turbine:'fan', 'Nose Cone':'fan',
  Bearing_Case:'lpc', Bearing_One:'lpc', Air_Turbine_One:'lpc', Air_Turbine_Two:'lpc',
  Air_Turbine_Case:'hpc', Air_Turbine_Bracket:'hpc', Air_Turbine_Three:'hpc', Air_Turbine_Four:'hpc', Air_Turbine_Five:'hpc',
  Pipe_Array:'combustor', Petrol_Intake_Case:'combustor', Petrol_Intake_Bracket:'combustor',
  Petrol_Turbine_One:'hpt', Petrol_Turbine_Two:'hpt',
  Petrol_Turbine_Three:'lpt', Petrol_Turbine_Four:'lpt', Petrol_Turbine_Five:'lpt', Petrol_Turbine_Case:'lpt', Petrol_Turbine_Bracket:'lpt',
  Rear_Case:'nozzle', Exhaust_Case:'nozzle', End_Cone:'nozzle',
  Central_Mounting_Shaft:'shaft', Rear_Mounting_Shaft:'shaft',
};
const RATIO = { Primary_Turbine: 0.30 };   // keep the fan blades readable
const DEFAULT_RATIO = 0.20;                // fraction of triangles kept per part
// ----------------------------------------------------------------------------------------------------

await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
const root = doc.getRoot();

const partOf = new Map();
const nameOfNode = (node) => { let n = node; while (n) { const nm = n.getName(); if (nm && nm.includes(':1_')) return nm.split(':1_')[0]; n = n.getParentNode(); } return null; };
for (const node of root.listNodes()) { const m = node.getMesh(); if (m) partOf.set(m, nameOfNode(node)); }
const missing = [...partOf.values()].filter((p) => !(p in STATION));
if (missing.length) throw new Error('Unmapped parts (add them to STATION): ' + [...new Set(missing)].join(', '));

const mat = doc.createMaterial('titanium').setBaseColorFactor([0.66, 0.69, 0.74, 1]).setMetallicFactor(0.85).setRoughnessFactor(0.38);
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) p.setMaterial(mat);

await doc.transform(flatten());
for (const node of root.listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const part = partOf.get(mesh); const station = STATION[part];
  const nm = `${station}__${part.replace(/\s+/g, '_')}`;
  node.setName(nm).setExtras({ station, part }); mesh.setName(nm);
}
await doc.transform(dedup(), weld());
const triCount = () => root.listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0);
const before = triCount();
for (const node of root.listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const ratio = RATIO[node.getExtras().part] ?? DEFAULT_RATIO;
  for (const p of mesh.listPrimitives()) {
    const idx = p.getIndices(); const pos = p.getAttribute('POSITION');
    const target = Math.max(60, Math.floor(idx.getArray().length * ratio / 3) * 3);
    const [out] = MeshoptSimplifier.simplify(new Uint32Array(idx.getArray()), new Float32Array(pos.getArray()), 3, target, 0.002, ['LockBorder']);
    idx.setArray(out.length < 65535 * 3 && pos.getCount() < 65535 ? new Uint16Array(out) : out);
  }
}
await doc.transform(prune({ keepAttributes: true }), weld({ tolerance: 0 }));
await doc.transform(prune());
for (const ext of root.listExtensionsUsed()) if (['KHR_materials_clearcoat', 'KHR_materials_specular'].includes(ext.extensionName)) ext.dispose();
console.log('triangles', Math.round(before), '->', Math.round(triCount()));
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

const meta = { source: 'Turbofan Engine by Xieyn (Sketchfab). Check the licence before publishing.', axis: 'x', stations: {}, parts: [] };
for (const node of root.listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const { station, part } = node.getExtras(); const b = getBounds(node);
  meta.parts.push({ node: node.getName(), station, part, x0: +b.min[0].toFixed(4), x1: +b.max[0].toFixed(4), dia: +(b.max[1] - b.min[1]).toFixed(4) });
  const s = (meta.stations[station] ??= { x0: 1e9, x1: -1e9, parts: 0 });
  s.x0 = Math.min(s.x0, b.min[0]); s.x1 = Math.max(s.x1, b.max[0]); s.parts++;
}
for (const s of Object.values(meta.stations)) { s.x0 = +s.x0.toFixed(4); s.x1 = +s.x1.toFixed(4); s.cx = +((s.x0 + s.x1) / 2).toFixed(4); }
const sb = getBounds(root.listScenes()[0]);
meta.bounds = { min: sb.min.map((v) => +v.toFixed(4)), max: sb.max.map((v) => +v.toFixed(4)) };
fs.mkdirSync(outDir, { recursive: true });
await io.write(`${outDir}/engine.glb`, doc);
fs.writeFileSync(`${outDir}/stations.json`, JSON.stringify(meta, null, 2));
console.log('wrote', `${outDir}/engine.glb`, fs.statSync(`${outDir}/engine.glb`).size, 'bytes');
