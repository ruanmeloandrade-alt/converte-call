import {canonicalPhone} from './contact-identity.mjs';

// A LID is an opaque WhatsApp identifier, never a telephone number.
export function whatsappJid(value){
 const jid=String(value||'').trim().replace('@c.us','@s.whatsapp.net');
 if(/^\d{6,20}@lid$/.test(jid))return jid;
 if(!/^\d{8,15}(?::\d+)?@s\.whatsapp\.net$/.test(jid))return '';
 const phone=canonicalPhone(jid);return phone?phone+'@s.whatsapp.net':'';
}
export function messageIdentity(item){
 const key=item.key||{},remote=whatsappJid(key.remoteJid||item.from);
 if(!remote)return null; // Includes groups, status and broadcasts.
 const alt=whatsappJid(key.remoteJidAlt||item.remoteJidAlt);
 // senderPn identifies the sender, so cannot identify an outbound recipient.
 const peer=whatsappJid(key.fromMe?(key.recipientPn||item.recipientPn):(key.senderPn||item.senderPn));
 const aliases=[...new Set([remote,alt,...(remote.endsWith('@lid')&&!canonicalPhone(alt)?[peer]:[])].filter(Boolean))];
 // Two different phone JIDs are not evidence that two clients are one person.
 const primary=canonicalPhone(remote);
 if(primary&&alt&&canonicalPhone(alt)&&canonicalPhone(alt)!==primary)return {phone:primary,jid:remote,aliases:[remote]};
 const phone=aliases.map(j=>canonicalPhone(j)).find(Boolean)||'';
 return {phone,jid:remote,aliases};
}
export function findWhatsappLead(data,identity){
 return data.leads.find(l=>identity.phone&&canonicalPhone(l.phone)===identity.phone)
  ||data.leads.find(l=>(l.whatsappJids||[]).some(j=>identity.aliases.includes(j)));
}
export function attachWhatsappIdentity(lead,identity){
 lead.whatsappJids=[...new Set([...(lead.whatsappJids||[]),...identity.aliases])];
 if(!lead.phone&&identity.phone)lead.phone=identity.phone;
}
