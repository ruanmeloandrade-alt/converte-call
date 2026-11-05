import {administrativeWorkspace} from './teams.mjs';

export const CONNECTION_MODEL='whatsapp-v1';
export function installConnectionEntitlements(store){
 store.db.exec(`CREATE TABLE IF NOT EXISTS whatsapp_entitlements(
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id),
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 3),
  updated_at INTEGER NOT NULL
 )`);
}
export function connectionEntitlements(store,workspaceId){
 const row=store.one('SELECT quantity FROM whatsapp_entitlements WHERE workspace_id=?',workspaceId);
 return {connections:administrativeWorkspace(store,workspaceId)?3:row?.quantity??1,model:row?CONNECTION_MODEL:'seats'};
}
export function grantConnections(store,workspaceId,quantity){
 if(!Number.isInteger(quantity)||quantity<1||quantity>3)throw Object.assign(Error('Escolha de um a três WhatsApps.'),{status:400});
 store.run('INSERT INTO whatsapp_entitlements VALUES(?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET quantity=excluded.quantity,updated_at=excluded.updated_at',workspaceId,quantity,Date.now());
}
export function requireConnection(store,workspaceId,slot){
 if(!Number.isInteger(slot)||slot<1||slot>connectionEntitlements(store,workspaceId).connections)throw Object.assign(Error('Esta conexão de WhatsApp ainda não está incluída na sua assinatura.'),{status:403});
}
