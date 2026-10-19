import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {announcedRelease,latestRelease,inspectZip,compareVersion} from './release-uploads.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex'),caches=new WeakMap();
const localFiles=['../public/account-security.js','../public/device.js','../public/install.js','../public/app.webmanifest','../public/employee.html','../public/mobile.html','../public/mobile.js','../public/mobile.css','../public/mobile-update.js','../public/mobile-recordings.js','../public/mobile-module.css','../public/web-bridge.js','../public/app-sw.js','./contact-identity.mjs','../extension/slim/runtime.js','../extension/slim/runtime.css'];
const runtimeFiles=new Set(['slim/mobile-runtime.json','slim/runtime.js','slim/runtime.css']);
// Pin the currently served baseline once. A server deploy must not replace installed mobile modules.
export function mobileBaseline(store,candidate,publication=null){
 const file=join(store.dir,'mobile-runtime-baseline.json');if(!existsSync(file)){let next=candidate||{seed:digest(Buffer.concat(localFiles.map(file=>readFileSync(new URL(file,import.meta.url))))),js:readFileSync(new URL('../extension/slim/runtime.js',import.meta.url),'utf8'),css:readFileSync(new URL('../extension/slim/runtime.css',import.meta.url),'utf8')};if(!candidate&&publication&&compareVersion(publication.version,JSON.parse(readFileSync(new URL('../extension/manifest.json',import.meta.url),'utf8')).version)>=0){const accepted=publishedRuntime(store);if(accepted)next={...next,...accepted};}writeFileSync(file,JSON.stringify({...next,publicationAtPin:publication?.sha256||null,jsHash:digest(next.js),cssHash:digest(next.css)}),{flag:'wx'});}
 const current=JSON.parse(readFileSync(file,'utf8'));if(!Object.hasOwn(current,'publicationAtPin')){current.publicationAtPin=publication?.sha256||null;writeFileSync(file,JSON.stringify(current));}if(!/^[a-f0-9]{64}$/.test(current.seed)||digest(current.js)!==current.jsHash||digest(current.css)!==current.cssHash)throw Object.assign(Error('A versão instalada do aplicativo está indisponível.'),{status:503});return current;
}
function publishedRuntime(store){const {files}=inspectZip(latestRelease(store).zip,runtimeFiles),marker=files.get('slim/mobile-runtime.json');if(!marker)return null;let manifest;try{manifest=JSON.parse(marker.toString('utf8'));}catch{return null;}const js=files.get('slim/runtime.js'),css=files.get('slim/runtime.css');return manifest?.schema===1&&js?.length&&css?.length&&digest(js)===manifest.runtimeSha256&&digest(css)===manifest.stylesSha256?{js:js.toString('utf8'),css:css.toString('utf8')}:null;}
export const initializeMobileRelease=store=>mobileBaseline(store,undefined,announcedRelease(store));
function state(store){
 const published=announcedRelease(store),key=published?.sha256||'local';let cached=caches.get(store);if(cached?.key===key)return cached;
 const baseline=mobileBaseline(store);let {js,css}=baseline;
 if(published&&published.sha256!==baseline.publicationAtPin){const accepted=publishedRuntime(store);if(accepted)({js,css}=accepted);}
 cached={key,revision:digest(baseline.seed+key),js,css};caches.set(store,cached);return cached;
}
export const mobileRevision=store=>state(store).revision;
export function mobileRuntimeAsset(store,path){if(!['/account/runtime.js','/account/runtime.css'].includes(path))return null;const current=state(store);return path.endsWith('.css')?current.css:current.js;}
