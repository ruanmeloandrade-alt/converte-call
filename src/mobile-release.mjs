import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {announcedRelease,latestRelease,inspectZip} from './release-uploads.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex'),caches=new WeakMap();
const localFiles=['../public/account-security.js','../public/device.js','../public/install.js','../public/app.webmanifest','../public/employee.html','../public/mobile.html','../public/mobile.js','../public/mobile.css','../public/mobile-update.js','../public/mobile-recordings.js','../public/mobile-module.css','../public/web-bridge.js','../public/app-sw.js','./contact-identity.mjs','../extension/slim/runtime.js','../extension/slim/runtime.css'];
const runtimeFiles=new Set(['slim/mobile-runtime.json','slim/runtime.js','slim/runtime.css']);
// Pin the currently served baseline once. A server deploy must not replace installed mobile modules.
export function mobileBaseline(store,candidate){
 const file=join(store.dir,'mobile-runtime-baseline.json');if(!existsSync(file)){const next=candidate||{seed:digest(Buffer.concat(localFiles.map(file=>readFileSync(new URL(file,import.meta.url))))),js:readFileSync(new URL('../extension/slim/runtime.js',import.meta.url),'utf8'),css:readFileSync(new URL('../extension/slim/runtime.css',import.meta.url),'utf8')};writeFileSync(file,JSON.stringify({...next,jsHash:digest(next.js),cssHash:digest(next.css)}),{flag:'wx'});}
 const current=JSON.parse(readFileSync(file,'utf8'));if(!/^[a-f0-9]{64}$/.test(current.seed)||digest(current.js)!==current.jsHash||digest(current.css)!==current.cssHash)throw Object.assign(Error('A versão instalada do aplicativo está indisponível.'),{status:503});return current;
}
function state(store){
 const published=announcedRelease(store),key=published?.sha256||'local';let cached=caches.get(store);if(cached?.key===key)return cached;
 const baseline=mobileBaseline(store);let {js,css}=baseline;
 if(published){const {files}=inspectZip(latestRelease(store).zip,runtimeFiles),marker=files.get('slim/mobile-runtime.json');if(marker){let manifest;try{manifest=JSON.parse(marker.toString('utf8'));}catch{}const script=files.get('slim/runtime.js'),styles=files.get('slim/runtime.css');if(manifest?.schema===1&&script?.length&&styles?.length&&digest(script)===manifest.runtimeSha256&&digest(styles)===manifest.stylesSha256){js=script;css=styles;}}}
 cached={key,revision:digest(baseline.seed+key),js,css};caches.set(store,cached);return cached;
}
export const mobileRevision=store=>state(store).revision;
export function mobileRuntimeAsset(store,path){if(!['/account/runtime.js','/account/runtime.css'].includes(path))return null;const current=state(store);return path.endsWith('.css')?current.css:current.js;}
