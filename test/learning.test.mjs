import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createApp} from '../src/server.mjs';import {youtubeId} from '../src/learning.mjs';
test('YouTube validation accepts video links and rejects other hosts and scripts',()=>{for(const url of ['https://youtu.be/ABCDEFGHIJK','https://www.youtube.com/watch?v=ABCDEFGHIJK','https://youtube.com/shorts/ABCDEFGHIJK','https://www.youtube.com/live/ABCDEFGHIJK'])assert.equal(youtubeId(url),'ABCDEFGHIJK');for(const url of ['javascript:alert(1)','https://evil.example/watch?v=ABCDEFGHIJK','https://youtube.com.evil.example/watch?v=ABCDEFGHIJK','http://youtube.com/watch?v=ABCDEFGHIJK','https://www.youtube.com/playlist?list=x'])assert.throws(()=>youtubeId(url),e=>e.status===400);});
test('only admin changes academy; students see published lessons and own progress; FAQ separates guide and provider answers',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-learning-')),requests=[];let providerOk=true;
 const app=createApp({dir,master:'a'.repeat(64),bootstrap:'local-test-owner',supportOptions:{fetcher:async(url,init)=>{requests.push({url,body:JSON.parse(init.body)});return Response.json(providerOk?{output:[{content:[{type:'output_text',text:'Use Gravar call e autorize o microfone.'}]}]}:{error:{}},{status:providerOk?200:500});}}});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,token,body,method=body?'POST':'GET')=>{const r=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 try{
  const admin=(await call('/v1/auth/bootstrap',null,{token:'local-test-owner',email:'admin@example.com',password:'Admin-only-test-password'})).data;
  const signup={firstName:'Aluno',lastName:'Teste',birthDate:'1990-01-02',whatsapp:'5522992888971',password:'Student-only-test-password',email:'student@example.com'};
  const student=(await call('/v1/auth/register',null,signup)).data;
  const another=(await call('/v1/auth/register',null,{...signup,whatsapp:'5522992888972',email:'another@example.com'})).data;
  const lesson={title:'Primeiros passos',description:'Aula local de validação',category:'Comece aqui',url:'https://youtu.be/ABCDEFGHIJK',position:1,published:false};
  assert.equal((await call('/v1/admin/academy',student.accessToken,lesson)).status,403);
  const draft=await call('/v1/admin/academy',admin.accessToken,lesson);assert.equal(draft.status,201);const id=draft.data.lesson.id;
  assert.equal((await call('/v1/academy',student.accessToken)).data.lessons.length,0);
  assert.equal((await call('/v1/admin/academy',admin.accessToken)).data.lessons.length,1);
  assert.equal((await call('/v1/admin/academy/'+id,student.accessToken,{...lesson,published:true},'PUT')).status,403);
  assert.equal((await call('/v1/admin/academy/'+id,admin.accessToken,{...lesson,published:true},'PUT')).status,200);
  const listed=await call('/v1/academy',student.accessToken);assert.equal(listed.data.lessons.length,1);assert.equal(listed.data.lessons[0].embedUrl,'https://www.youtube-nocookie.com/embed/ABCDEFGHIJK');
  assert.equal((await call('/v1/academy/'+id+'/progress',student.accessToken,{completed:true},'PUT')).status,200);
  assert((await call('/v1/academy',student.accessToken)).data.lessons[0].completedAt);
  assert.equal((await call('/v1/academy',another.accessToken)).data.lessons[0].completedAt,null);
  const guide=await call('/v1/support/ask',student.accessToken,{question:'Como funciona o teste gratuito e a assinatura?'});assert.equal(guide.status,200);assert.equal(guide.data.mode,'guide');assert(guide.data.answer.includes('7 dias'));assert.equal(guide.data.supportUrl,'https://wa.me/5522992888971');assert.equal(requests.length,0);
  assert.equal((await call('/v1/ai/credentials',student.accessToken,{apiKey:'sk-'+'t'.repeat(30),model:'test-model-only'},'PUT')).status,200);
  const generated=await call('/v1/support/ask',student.accessToken,{question:'Como gravar a tela?'});assert.equal(generated.data.mode,'ai');assert.equal(generated.data.answer,'Use Gravar call e autorize o microfone.');assert.equal(requests[0].url,'https://api.openai.com/v1/responses');assert.equal(requests[0].body.store,false);assert(!requests[0].body.input.includes('52998224725'));assert(!requests[0].body.input.includes('student@example.com'));
  const stored=app.store.one('SELECT payload FROM support_questions WHERE id=?',generated.data.id);assert(!stored.payload.includes('Como gravar a tela?'));
  providerOk=false;assert.equal((await call('/v1/support/ask',student.accessToken,{question:'Outra pergunta de suporte'})).status,502);
  app.store.run('UPDATE subscriptions SET expires_at=0 WHERE workspace_id=?',student.workspaceId);const callsBefore=requests.length;
  assert.equal((await call('/v1/academy',student.accessToken)).status,402);assert.equal((await call('/v1/support/ask',student.accessToken,{question:'Como renovar a assinatura?'})).data.mode,'guide');assert.equal(requests.length,callsBefore);
  assert.equal((await call('/v1/admin/academy/'+id,another.accessToken,undefined,'DELETE')).status,403);
  assert.equal((await call('/v1/admin/academy/'+id,admin.accessToken,undefined,'DELETE')).status,200);
  assert.equal((await call('/v1/academy',another.accessToken)).data.lessons.length,0);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
