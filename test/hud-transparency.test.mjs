import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('actual surface render restores the opaque recording form when leaving the HUD',()=>{
 const source=readFileSync(new URL('../extension/surface.js',import.meta.url),'utf8'),start=source.indexOf('function render(){'),end=source.indexOf('function recorder()',start),classes=new Map(),classList={toggle:(name,on)=>classes.set(name,on)},ctx=vm.createContext({document:{documentElement:{classList},body:{classList}},workspace:{},view:'hud',root:{},headerHTML:()=>'',hud:()=>'<p>Fala</p>',recorder:()=>'<form>Gravação</form>',customer:()=>''});
 vm.runInContext(source.slice(start,end),ctx);ctx.render();assert.equal(classes.get('call-hud-root'),true);assert.equal(ctx.root.innerHTML,'<p>Fala</p>');ctx.view='recorder';ctx.render();assert.equal(classes.get('call-hud-root'),false);assert.equal(classes.get('call-hud'),false);assert.equal(ctx.root.innerHTML,'<form>Gravação</form>');
});

for(const target of ['extension','build/extensions/chrome','build/extensions/edge','build/extensions/firefox']){
 test(target+': the actual surface sizer hides for HUD but stays available on other panels',()=>{
  const source=readFileSync(new URL('../'+target+'/content.js',import.meta.url),'utf8'),start=source.indexOf('function positionSurfaceSizer()'),end=source.indexOf('const surfaceSizeObserver',start),ctx=vm.createContext({surface:{dataset:{view:'hud'},getBoundingClientRect:()=>({width:350,height:150,right:450,bottom:300})},surfaceSizer:{style:{}},suspended:false});
  assert(start>=0&&end>start);vm.runInContext(source.slice(start,end),ctx);ctx.positionSurfaceSizer();assert.equal(ctx.surfaceSizer.style.display,'none');ctx.surface.dataset.view='customer';ctx.positionSurfaceSizer();assert.equal(ctx.surfaceSizer.style.display,'block');assert.equal(ctx.surfaceSizer.style.left,'422px');ctx.suspended=true;ctx.positionSurfaceSizer();assert.equal(ctx.surfaceSizer.style.display,'none');
 });
}
