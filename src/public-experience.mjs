import {readFileSync} from 'node:fs';
import {latestRelease} from './release-uploads.mjs';
const files={
 '/story-portraits.png':['story-portraits.png','image/png'],
 '/':['sales.html','text/html'],'/sales':['sales.html','text/html'],'/sales.css':['sales.css','text/css'],'/sales.js':['sales.js','text/javascript'],'/experience-base.css':['experience-base.css','text/css'],'/brand.svg':['brand.svg','image/svg+xml'],
 '/download':['download.html','text/html'],'/download.css':['download.css','text/css'],'/download.js':['download.js','text/javascript'],'/install.js':['install.js','text/javascript'],
 '/account/module.css':['mobile-module.css','text/css'],'/account/app':['mobile.html','text/html'],'/account/mobile.css':['mobile.css','text/css'],'/account/mobile.js':['mobile.js','text/javascript'],'/account/manifest.webmanifest':['app.webmanifest','application/manifest+json'],'/account/sw.js':['app-sw.js','text/javascript'],'/account/offline':['offline.html','text/html'],
 '/app-icon-192.png':['app-icon-192.png','image/png'],'/app-icon-512.png':['app-icon-512.png','image/png'],'/app-icon-maskable.png':['app-icon-maskable.png','image/png']
};
export function publicExperience(req,res,path,store){if(req.method!=='GET')return false;
 if(path==='/download/info'){const r=latestRelease(store);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({version:r.version,filename:r.filename,sha256:r.sha256,downloadUrl:'/downloads/'+r.filename}));return true;}
 const file=files[path];if(!file)return false;res.writeHead(200,{'Content-Type':file[1]+(file[1].startsWith('image/')?'':'; charset=utf-8'),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(path==='/account/sw.js'?{'Service-Worker-Allowed':'/account/'}:{}),'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'"});res.end(readFileSync(new URL('../public/'+file[0],import.meta.url)));return true;
}
