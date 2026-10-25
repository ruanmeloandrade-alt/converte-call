import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('capture diagnostics remain internal without requiring a diagnostic DOM element',async()=>{
 const source=read('extension/recorder.js'),fn=source.slice(source.indexOf('function diagnostic('),source.indexOf('function statusUI('));let saved;
 const context=vm.createContext({navigator:{userAgent:'QA browser'},chrome:{storage:{local:{set:async entry=>{saved=entry;}}}},document:{querySelector:()=>{throw Error('Diagnostics must not access the page');}}});
 vm.runInContext(fn,context);context.diagnostic('ready');assert.equal(saved.ccCaptureDiagnostic.stage,'ready');context.diagnostic('capture-start',{name:'NotAllowedError',message:'Permission denied'});assert.equal(saved.ccCaptureDiagnostic.error,'NotAllowedError');assert.equal(saved.ccCaptureDiagnostic.message,'Permission denied');context.chrome.storage.local.set=async()=>{throw Error('Storage unavailable');};context.diagnostic('ready');await new Promise(resolve=>setImmediate(resolve));
});
test('pixel installation copies the complete configuration without rendering source code',async()=>{
 const source=read('extension/v8.js');let modal,copied;const snippet='<script src="https://example.test/pixel.js"></script>';
 const context=vm.createContext({callPixels:[{id:'p1',origin:'https://example.test',snippet}],openModal:(title,body)=>{modal=body;},esc:s=>s,button:()=>'<button>Copiar</button>',attr:()=>'',actions:{},navigator:{clipboard:{writeText:async value=>{copied=value;}}},toast:()=>{}});
 vm.runInContext(source.slice(source.indexOf('function showCallPixelCode('),source.indexOf("actions['pixel-code']")),context);context.showCallPixelCode('p1');assert(!modal.includes(snippet));assert(!modal.includes('<pre'));assert(modal.includes('<button>'));
 vm.runInContext(source.slice(source.indexOf("actions['pixel-copy']="),source.indexOf('\n',source.indexOf("actions['pixel-copy']="))),context);await context.actions['pixel-copy']({dataset:{id:'p1'}});assert.equal(copied,snippet);
});
