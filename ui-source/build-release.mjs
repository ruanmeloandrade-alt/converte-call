import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import {transform} from 'esbuild';
import {createHash} from 'node:crypto';
const root=resolve('../extension'),out=resolve('../build/extensions'),sha=b=>createHash('sha256').update(b).digest('hex');
const jsonAllowed=new Set(['manifest.json','slim/mobile-runtime.json','slim/rpc-contract.json']);
const allowed=name=>['.js','.css','.html','.png'].includes(extname(name))||jsonAllowed.has(name);
const inputs=new Map();
function walk(dir,prefix=''){for(const e of readdirSync(dir,{withFileTypes:true})){const name=prefix+e.name;if(e.isDirectory())walk(join(dir,e.name),name+'/');else if(allowed(name))inputs.set(name,readFileSync(join(dir,e.name)));}}walk(root);
for(const target of ['chrome','edge','firefox']){
 const files=new Map(inputs),manifest=JSON.parse(files.get('manifest.json'));
 manifest.content_scripts.forEach(s=>s.js.unshift('browser-compat.js'));
 manifest.web_accessible_resources[0].resources.push('browser-compat.js');
 if(target==='firefox'){
  delete manifest.minimum_chrome_version;
  manifest.permissions=manifest.permissions.filter(p=>p!=='offscreen');
  const background=files.get('background.js').toString(),match=background.match(/importScripts\(([^;]+)\);/);
  const imports=[...match[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
  manifest.background={scripts:['browser-compat.js',...imports,'background.js']};
  manifest.browser_specific_settings={gecko:{id:'addon@convertecall.pro',strict_min_version:'140.0',data_collection_permissions:{required:['authenticationInfo','personallyIdentifyingInfo','personalCommunications','websiteContent','websiteActivity','financialAndPaymentInfo']}},gecko_android:{strict_min_version:'142.0'}};
  files.set('background.js',Buffer.from("if(/Android/i.test(navigator.userAgent)){chrome.action.onClicked.addListener(()=>chrome.tabs.create({url:'https://convertecall.pro/account/app?install=1'}));}else{"+background.replace(match[0],'')+'}'));
 }
 files.set('manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 for(const [name,bytes]of [...files]){
  if(name.endsWith('.html'))files.set(name,Buffer.from(bytes.toString().replace('<head>','<head><script src="browser-compat.js" defer></script>')));
  // Do not rename cross-file globals used by the existing interface.
  if(name.endsWith('.js')&&name!=='slim/runtime.js')files.set(name,Buffer.from((await transform(bytes.toString(),{minifyWhitespace:true,minifySyntax:true,minifyIdentifiers:false,target:target==='firefox'?'firefox140':'chrome116',legalComments:'eof'})).code));
 }
 if(target!=='firefox')files.set('background.js',Buffer.from("importScripts('browser-compat.js');"+files.get('background.js')));
 files.set('slim/mobile-runtime.json',Buffer.from(JSON.stringify({schema:1,runtimeSha256:sha(files.get('slim/runtime.js')),stylesSha256:sha(files.get('slim/runtime.css'))})));
 // Refuse packaging regressions before writing artifacts.
 for(const name of files.keys())if(/\.(ts|tsx|map|md|txt)$|source-manifest|provenance|(?:^|\/)\.env/.test(name))throw Error('Development file in client package: '+name);
 for(const [name,bytes]of files){const dest=join(out,target,name);mkdirSync(resolve(dest,'..'),{recursive:true});writeFileSync(dest,bytes);}
 console.log(target+': '+files.size+' runtime files; no sources, maps or internal documentation');
}
