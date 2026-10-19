'use strict';
// Firefox exposes promise-based APIs through browser.*; application code uses chrome.*.
if(typeof browser!=='undefined'&&browser.runtime?.getBrowserInfo){
 globalThis.chrome=browser;
 if(!chrome.storage.local.onChanged)chrome.storage.local.onChanged={addListener(fn){chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local')fn(changes);});}};
 if(!chrome.runtime.getContexts)chrome.runtime.getContexts=async filter=>{
  const tabs=await chrome.tabs.query({}),root=chrome.runtime.getURL('');
  return tabs.filter(t=>t.url?.startsWith(root)&&(!filter.documentUrls||filter.documentUrls.includes(t.url))&&(!filter.contextTypes||filter.contextTypes.includes(t.url===root+'offscreen.html'?'OFFSCREEN_DOCUMENT':'TAB'))).map(t=>({tabId:t.id,documentUrl:t.url,contextType:t.url===root+'offscreen.html'?'OFFSCREEN_DOCUMENT':'TAB'}));
 };
 if(!chrome.offscreen)chrome.offscreen={
  async createDocument({url}){await chrome.tabs.create({url:chrome.runtime.getURL(url),active:false});},
  async closeDocument(){const rows=await chrome.runtime.getContexts({documentUrls:[chrome.runtime.getURL('offscreen.html')]});for(const row of rows)await chrome.tabs.remove(row.tabId);}
 };
}
