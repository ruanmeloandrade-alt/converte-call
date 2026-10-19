import {createHash} from 'node:crypto';
import {brotliCompressSync,gzipSync,constants} from 'node:zlib';

// Static code is compressed once per content revision, never on each module visit.
const compressed=new Map();
export function staticResponse(req,res,content,headers={}){
 const body=Buffer.isBuffer(content)?content:Buffer.from(content),type=String(headers['Content-Type']||''),text=/^(text\/|application\/(json|javascript)|image\/svg)/.test(type);
 const hash=createHash('sha256').update(body).digest('hex'),etag='"'+hash+'"',vary=[res.getHeader('Vary'),headers.Vary,text?'Accept-Encoding':''].filter(Boolean).join(', '),out={...headers,ETag:etag,...(vary?{Vary:vary}:{})};
 if(req.headers['if-none-match']===etag&&!String(out['Cache-Control']).includes('no-store')){res.writeHead(304,out);res.end();return;}
 let result=body;
 if(text&&body.length>=512){const choices=String(req.headers['accept-encoding']||'').split(',').map(value=>{const[name,...params]=value.trim().split(';');const q=params.find(p=>p.trim().startsWith('q='));return {name:name.trim(),q:q?Number(q.trim().slice(2)):1};}).filter(v=>['br','gzip'].includes(v.name)&&v.q>0).sort((a,b)=>b.q-a.q||(a.name==='br'?-1:1));const encoding=choices[0]?.name;if(encoding){const key=hash+':'+encoding;result=compressed.get(key);if(!result){result=encoding==='br'?brotliCompressSync(body,{params:{[constants.BROTLI_PARAM_QUALITY]:4}}):gzipSync(body,{level:6});compressed.set(key,result);if(compressed.size>64)compressed.delete(compressed.keys().next().value);}out['Content-Encoding']=encoding;}}
 out['Content-Length']=result.length;res.writeHead(200,out);res.end(result);
}
