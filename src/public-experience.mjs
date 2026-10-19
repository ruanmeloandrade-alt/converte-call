import {staticResponse} from './static-response.mjs';
import {mobileRevision} from './mobile-release.mjs';
import {readFileSync} from 'node:fs';
import {latestRelease} from './release-uploads.mjs';
const files={
 '/site-guard.js':['site-guard.js','text/javascript'],
 '/password-fields.js':['password-fields.js','text/javascript'],
 '/password-fields.css':['password-fields.css','text/css'],
 '/esqueci-senha':['password-recovery.html','text/html'],
 '/redefinir-senha':['password-recovery.html','text/html'],
 '/password-recovery.js':['password-recovery.js','text/javascript'],
 '/ios':['ios.html','text/html'],
 '/device.js':['device.js','text/javascript'],
 '/legal.css':['legal.css','text/css'],
 '/legal-footer.css':['legal-footer.css','text/css'],
 '/assinatura':['subscription-terms.html','text/html'],
 '/cookies':['cookies.html','text/html'],
 '/plataformas':['platforms.html','text/html'],
 '/seja-parceiro':['partner-landing.html','text/html'],
 '/trabalhe-conosco':['partner-landing.html','text/html'],
 '/partner-landing.css':['partner-landing.css','text/css'],
 '/partner-landing.js':['partner-landing.js','text/javascript'],
 '/trial-guarantee.css':['trial-guarantee.css','text/css'],
 '/sales-i18n.js':['sales-i18n.js','text/javascript'],
 '/sales-locales.json':['sales-locales.json','application/json'],
 '/globe-land.json':['globe-land.json','application/json'],
 '/access':['access.html','text/html'],
 '/access-tutorial.js':['access-tutorial.js','text/javascript'],
 '/access-tutorial.json':['access-tutorial.json','application/json'],
 '/story-portraits.png':['story-portraits.png','image/png'],
 '/':['sales.html','text/html'],'/sales':['sales.html','text/html'],'/sales.css':['sales.css','text/css'],'/sales.js':['sales.js','text/javascript'],'/experience-base.css':['experience-base.css','text/css'],'/brand.svg':['brand.svg','image/svg+xml'],
 '/download':['download.html','text/html'],'/download.css':['download.css','text/css'],'/download.js':['download.js','text/javascript'],'/install.js':['install.js','text/javascript'],
 '/account/module.css':['mobile-module.css','text/css'],'/account/app':['mobile.html','text/html'],'/account/mobile.css':['mobile.css','text/css'],'/account/mobile.js':['mobile.js','text/javascript'],'/account/mobile-update.js':['mobile-update.js','text/javascript'],'/account/recorder.js':['mobile-recordings.js','text/javascript'],'/account/manifest.webmanifest':['app.webmanifest','application/manifest+json'],'/account/sw.js':['app-sw.js','text/javascript'],'/account/offline':['offline.html','text/html'],
 '/app-icon-192.png':['app-icon-192.png','image/png'],'/app-icon-512.png':['app-icon-512.png','image/png'],'/app-icon-maskable.png':['app-icon-maskable.png','image/png']
};
for(const id of [1,2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,20,21,22,23,25,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60])files['/client-logos/'+id+'.png']=['client-logos/'+id+'.png','image/png'];
export function publicExperience(req,res,path,store){if(req.method!=='GET')return false;
 if(path==='/account/app-version'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({revision:mobileRevision(store)}));return true;}
 if(path==='/download/info'){const r=latestRelease(store);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({version:r.version,filename:r.filename,sha256:r.sha256,downloadUrl:'/downloads/'+r.filename}));return true;}
 const file=files[path];if(!file)return false;const headers={'Content-Type':file[1]+(file[1].startsWith('image/')?'':'; charset=utf-8'),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(path==='/account/sw.js'?{'Service-Worker-Allowed':'/account/'}:{}),'Content-Security-Policy':`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self'${path==='/account/app'?" blob:":''}; frame-src 'self'${path==='/access'?' https://www.youtube-nocookie.com':''}; frame-ancestors 'none'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'`};if(['text/javascript','text/css','image/png','image/svg+xml'].includes(file[1])&&path!=='/account/sw.js')headers['Cache-Control']=path.startsWith('/account/')&&new URL(req.url,'http://localhost').searchParams.get('v')===mobileRevision(store)?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate';const content=readFileSync(new URL('../public/'+file[0],import.meta.url));staticResponse(req,res,path==='/account/app'?content.toString('utf8').replace('<head>','<head><meta name="cc-mobile-revision" content="'+mobileRevision(store)+'">'):content,headers);return true;
}
