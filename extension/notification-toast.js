(() => {
 if(globalThis.ccNoticeInstalled)return;
 globalThis.ccNoticeInstalled=true;
 let host,timeout;
 function remove(){clearTimeout(timeout);host?.remove();host=null;}
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(sender.id!==chrome.runtime.id||message.channel!=='cc')return;
  if(message.type==='notification-toast-ready'){reply({ok:true});return;}
  if(message.type!=='notification-toast')return;
  remove();
  const notice=message.notice;
  if(!notice||document.visibilityState!=='visible'){reply({ok:false});return;}
  host=document.createElement('div');
  const shadow=host.attachShadow({mode:'closed'});
  const style=document.createElement('style');
  style.textContent=':host{all:initial!important;position:fixed!important;z-index:2147483647!important;right:16px!important;bottom:16px!important;width:min(340px,calc(100vw - 32px))!important}aside{font:14px/1.45 Arial,sans-serif;color:#302239;background:#fff;border:1px solid #e6d8e4;border-left:4px solid #b22f78;border-radius:12px;padding:12px;box-shadow:0 10px 32px #29152933}p{margin:5px 0 9px;overflow-wrap:anywhere}footer{display:flex;gap:8px}button{font:inherit;color:#713154;background:#faf1f7;border:1px solid #e7d6e3;border-radius:6px;padding:4px 8px;cursor:pointer}button:focus-visible{outline:2px solid #b22f78}';
  const card=document.createElement('aside'),title=document.createElement('strong'),body=document.createElement('p'),actions=document.createElement('footer');
  card.setAttribute('role','status');
  title.textContent=notice.title;body.textContent=notice.message;
  const pin=document.createElement('button'),close=document.createElement('button');
  pin.type=close.type='button';pin.textContent=notice.pinned?'Desafixar':'Fixar';close.textContent='Fechar';
  const update=async pinned=>{
   const result=await chrome.runtime.sendMessage({channel:'cc',type:'notification-pin',id:notice.id,pinned}).catch(()=>null);
   return result?.ok===true;
  };
  pin.onclick=async()=>{
   const pinned=!notice.pinned;
   if(!await update(pinned))return;
   notice.pinned=pinned;pin.textContent=pinned?'Desafixar':'Fixar';clearTimeout(timeout);
   if(!pinned)timeout=setTimeout(remove,8000);
  };
  close.onclick=async()=>{if(!notice.pinned||await update(false))remove();};
  actions.append(pin,close);card.append(title,body,actions);shadow.append(style,card);document.documentElement.append(host);
  if(!notice.pinned)timeout=setTimeout(remove,8000);
  reply({ok:true});
 });
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')remove();});
})();
