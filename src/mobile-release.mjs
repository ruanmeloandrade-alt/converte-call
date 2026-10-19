import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {announcedRelease,latestRelease,inspectZip} from './release-uploads.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex'),caches=new WeakMap();let localRevision;
const localFiles=['../public/employee.html','../public/mobile.html','../public/mobile.js','../public/mobile.css','../public/mobile-update.js','../public/mobile-recordings.js','../public/mobile-module.css','../public/web-bridge.js','../public/app-sw.js','./contact-identity.mjs','../extension/slim/runtime.js','../extension/slim/runtime.css'];
const runtimeFiles=new Set(['slim/mobile-runtime.json','slim/runtime.js','slim/runtime.css']);
function state(store){
 if(!localRevision)localRevision=digest(Buffer.concat(localFiles.map(file=>readFileSync(new URL(file,import.meta.url)))));
 const published=announcedRelease(store),key=published?.sha256||'local';let cached=caches.get(store);if(cached?.key===key)return cached;
 let js=null,css=null;
 if(published){const {files}=inspectZip(latestRelease(store).zip,runtimeFiles),marker=files.get('slim/mobile-runtime.json');if(marker){let manifest;try{manifest=JSON.parse(marker.toString('utf8'));}catch{}const script=files.get('slim/runtime.js'),styles=files.get('slim/runtime.css');if(manifest?.schema===1&&script?.length&&styles?.length&&digest(script)===manifest.runtimeSha256&&digest(styles)===manifest.stylesSha256){js=script;css=styles;}}}
 cached={key,revision:digest(localRevision+key),js,css};caches.set(store,cached);return cached;
}
export const mobileRevision=store=>state(store).revision;
export function mobileRuntimeAsset(store,path){if(!['/account/runtime.js','/account/runtime.css'].includes(path))return null;const current=state(store);return path.endsWith('.css')?current.css:current.js;}
