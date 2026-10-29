import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('Operations opens sales management after stock without replacing the order screen',()=>{
 const source=readFileSync(new URL('../extension/v5.js',import.meta.url),'utf8'),context={views:{},groupsV4:[['Operação',[]],['Conta',[]]]};vm.runInNewContext(source.slice(0,source.indexOf('const renderBeforeSlim')),context);
 const nav=context.groupsV4[0][1],stock=nav.findIndex(i=>i[0]==='inventory');assert.deepEqual(Array.from(nav[stock+1]),['sales','Gestão de Vendas','chart']);assert.match(context.views.sales(),/module=sales/);assert.match(context.views.orders(),/module=orders/);assert.equal(nav.filter(i=>i[0]==='sales').length,1);
});
