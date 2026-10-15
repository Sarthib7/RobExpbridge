import { readFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { renderPublicCaseStudy } from './public-case-study.js';
const assets: Record<string,string> = {};
for (const [route,file] of [['/','index.html'],['/app.js','app.js'],['/styles.css','styles.css']]) assets[route] = await readFile('public/'+file,'utf8');
for (const file of ['checkpoint-20261013-agung.json','checkpoint-20261013-solana-devnet.json','peaqos-readiness.json','simulation-batches.json']) assets['/data/evidence/'+file] = await readFile('data/evidence/'+file,'utf8');
assets['/'] = assets['/'].replace('<body>', '<body class="public-preview">');
const report = await readFile('data/evidence/robot-failure-case-study-20261015.json', 'utf8');
if (!assets['/'].includes('<!-- recorded-case-study -->')) throw new Error('Case-study slot missing');
assets['/'] = assets['/'].replace('<!-- recorded-case-study -->', renderPublicCaseStudy(JSON.parse(report)));
assets['/data/evidence/robot-failure-case-study-20261015.json'] = report;
assets['/data/case-studies/robot-failures/manifest.json'] = await readFile('data/case-studies/robot-failures/manifest.json', 'utf8');
const evidence = await readFile('evidence.md','utf8');
let peaqos: unknown = { status:'blocked', reason:'Activation has not been verified. No machine ID is claimed.' };
try { peaqos=JSON.parse(await readFile('data/evidence/peaqos-readiness.json','utf8')); } catch { /* Build still labels missing evidence honestly. */ }
await mkdir('dist/public',{recursive:true});
await build({ stdin:{contents:`import {createPublicHandler} from './src/public-worker.ts'; export default {fetch:createPublicHandler(${JSON.stringify(assets)},${JSON.stringify(evidence)},${JSON.stringify(peaqos)})};`,resolveDir:process.cwd(),sourcefile:'public-entry.ts'},bundle:true,format:'esm',platform:'node',target:'es2022',minify:true,outfile:'dist/public/worker.js',external:['node:crypto'] });
console.log('Built public simulation preview. No wallet or signing imports.');
