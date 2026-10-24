import {runtimeFetch as fetch,runtimeEnv} from "./salesbot-context.mjs";
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// copied-server-source/lib/execution-context.ts
function createChildContext(parentContext, parentRunId, originType, originId) {
  if (parentContext.depth >= MAX_EXECUTION_DEPTH) {
    throw new Error(`Maximum execution depth of ${MAX_EXECUTION_DEPTH} reached`);
  }
  return {
    rootRunId: parentContext.rootRunId,
    parentRunId,
    depth: parentContext.depth + 1,
    originType,
    originId
  };
}
function createRootContext(rootRunId, originType, originId) {
  return {
    rootRunId,
    parentRunId: null,
    depth: 0,
    originType,
    originId
  };
}
var MAX_EXECUTION_DEPTH;
var init_execution_context = __esm({
  "copied-server-source/lib/execution-context.ts"() {
    MAX_EXECUTION_DEPTH = 8;
  }
});

// copied-server-source/lib/whatsapp-identity.ts
function validE164Digits(digits) {
  return digits.length >= E164_MIN_DIGITS && digits.length <= E164_MAX_DIGITS && /^[1-9]\d+$/.test(digits);
}
function onlyPhoneSyntax(value) {
  return /^[+\d\s().-]+$/.test(value);
}
function normalizeInternationalPhone(value, options = {}) {
  if (typeof value !== "string" || !value.trim()) return { ok: false, reason: "empty" };
  const raw = value.trim();
  if (!onlyPhoneSyntax(raw)) return { ok: false, reason: "invalid" };
  const compact = raw.replace(PHONE_SEPARATORS, "");
  if (compact.startsWith("+")) {
    const digits = compact.slice(1);
    if (!validE164Digits(digits)) return { ok: false, reason: "invalid" };
    return { ok: true, digits, e164: `+${digits}`, source: "explicit_plus" };
  }
  if (compact.startsWith("00")) {
    const digits = compact.slice(2);
    if (!validE164Digits(digits)) return { ok: false, reason: "invalid" };
    return { ok: true, digits, e164: `+${digits}`, source: "international_00" };
  }
  if (!/^\d+$/.test(compact)) return { ok: false, reason: "invalid" };
  if (!validE164Digits(compact)) return { ok: false, reason: "invalid" };
  if (!options.allowTrustedBare) return { ok: false, reason: "ambiguous" };
  return { ok: true, digits: compact, e164: `+${compact}`, source: "trusted_bare" };
}
function whatsappIdentityFromJid(value) {
  if (typeof value !== "string") return null;
  const remoteJid = value.trim();
  if (!remoteJid) return null;
  const lower = remoteJid.toLowerCase();
  if (lower.endsWith("@g.us")) {
    const local2 = remoteJid.slice(0, remoteJid.length - "@g.us".length);
    if (!/^[\d-]+$/.test(local2) || local2.replace(/\D/g, "").length < 8) return null;
    return {
      kind: "group",
      remoteJid,
      number: remoteJid,
      digits: null,
      e164: null
    };
  }
  if (!lower.endsWith("@s.whatsapp.net")) return null;
  const local = remoteJid.slice(0, remoteJid.length - "@s.whatsapp.net".length);
  const account = local.split(":")[0] ?? "";
  if (!/^\d+$/.test(account) || !validE164Digits(account)) return null;
  return {
    kind: "direct",
    remoteJid,
    number: account,
    digits: account,
    e164: `+${account}`
  };
}
var E164_MIN_DIGITS, E164_MAX_DIGITS, PHONE_SEPARATORS;
var init_whatsapp_identity = __esm({
  "copied-server-source/lib/whatsapp-identity.ts"() {
    E164_MIN_DIGITS = 8;
    E164_MAX_DIGITS = 15;
    PHONE_SEPARATORS = /[\s().-]+/g;
  }
});

// copied-server-source/lib/salesbot-group-actions.server.ts
function installEvolutionGroupTextCompatibility() {
  const globalRecord = globalThis;
  if (globalRecord[GROUP_TEXT_FETCH_SHIM] || typeof globalThis.fetch !== "function") return;
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = String(init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
    const body = init?.body;
    if (method !== "POST" || !url.includes("/message/sendText/") || typeof body !== "string") {
      return originalFetch(input, init);
    }
    let payload = null;
    try {
      const parsed = JSON.parse(body);
      payload = parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      payload = null;
    }
    const number = String(payload?.number ?? "").trim();
    const text = typeof payload?.text === "string" ? payload.text : "";
    if (!payload || !number.endsWith("@g.us") || !text) {
      return originalFetch(input, init);
    }
    const first = await originalFetch(input, init);
    if (first.status !== 400) return first;
    const mentioned = Array.isArray(payload.mentioned) ? payload.mentioned.map(String).filter(Boolean) : [];
    const mentionsEveryOne = payload.mentionsEveryOne === true;
    const compatibilityPayload = {
      number,
      text,
      textMessage: { text }
    };
    const delay = Number(payload.delay ?? 0);
    const presence = typeof payload.presence === "string" ? payload.presence : void 0;
    if (delay > 0 || presence || mentionsEveryOne || mentioned.length > 0) {
      compatibilityPayload.options = {
        ...delay > 0 ? { delay } : {},
        ...presence ? { presence } : {},
        ...mentionsEveryOne || mentioned.length > 0 ? { mentions: { everyOne: mentionsEveryOne, mentioned } } : {}
      };
    }
    return originalFetch(input, { ...init, body: JSON.stringify(compatibilityPayload) });
  });
  globalRecord[GROUP_TEXT_FETCH_SHIM] = true;
}
function trustedDirectPhoneDigits(value) {
  const jidIdentity = whatsappIdentityFromJid(value);
  if (jidIdentity) return jidIdentity.kind === "direct" ? jidIdentity.digits : null;
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.includes("@")) return null;
  const normalized = normalizeInternationalPhone(raw, { allowTrustedBare: true });
  return normalized.ok ? normalized.digits : null;
}
function normalizeEvolutionParticipantPhone(value) {
  return trustedDirectPhoneDigits(value);
}
function getSalesbotGroupParticipantPhone(variables) {
  const vars = variables ?? {};
  const candidates = [
    vars.participante_telefone,
    vars.membro_telefone,
    vars.sender_phone,
    vars.participant_phone,
    vars.member_phone
  ];
  for (const candidate of candidates) {
    const phone = normalizeEvolutionParticipantPhone(candidate);
    if (phone) return phone;
  }
  return null;
}
function getSalesbotGroupJid(leadPhone, variables) {
  const vars = variables ?? {};
  const candidates = [vars.group_jid, vars.grupo_jid, vars.remote_jid, vars.chat_jid, leadPhone];
  for (const candidate of candidates) {
    const jid = String(candidate ?? "").trim();
    if (jid.endsWith("@g.us")) return jid;
  }
  return null;
}
function getAdminPhonesFromEvolutionPayload(payload, ownPhone) {
  const parsed = payload ?? {};
  const participants = Array.isArray(payload) ? payload : Array.isArray(parsed.participants) ? parsed.participants : Array.isArray(parsed.group?.participants) ? parsed.group.participants : [];
  const ownDigits = trustedDirectPhoneDigits(ownPhone);
  const phones = /* @__PURE__ */ new Set();
  for (const participant of participants) {
    if (participant?.admin !== "admin" && participant?.admin !== "superadmin") continue;
    const digits = trustedDirectPhoneDigits(participant.id);
    if (!digits) continue;
    if (ownDigits && digits === ownDigits) continue;
    phones.add(digits);
  }
  return [...phones];
}
async function resolveSalesbotGroupAdminPhones(supabaseAdmin2, workspaceId, groupJid) {
  if (!groupJid.endsWith("@g.us")) return { ok: false, phones: [], error: "grupo inv\xE1lido" };
  const { data: group, error: groupError } = await supabaseAdmin2.from("whatsapp_groups").select("session_id, group_jid").eq("workspace_id", workspaceId).eq("group_jid", groupJid).maybeSingle();
  if (groupError) return { ok: false, phones: [], error: groupError.message ?? "erro ao localizar grupo" };
  const sessionId = String(group?.session_id ?? "").trim();
  if (!sessionId) return { ok: false, phones: [], error: "grupo n\xE3o sincronizado neste workspace" };
  const { data: session, error: sessionError } = await supabaseAdmin2.from("whatsapp_web_sessions").select("id, phone_number, status").eq("id", sessionId).eq("workspace_id", workspaceId).eq("provider", "evolution").eq("status", "conectado").maybeSingle();
  if (sessionError) return { ok: false, phones: [], error: sessionError.message ?? "erro ao localizar sess\xE3o" };
  if (!session) return { ok: false, phones: [], error: "sess\xE3o Evolution do grupo n\xE3o est\xE1 conectada neste workspace" };
  const encryptionKey = runtimeEnv("INTEGRATION_ENCRYPTION_KEY");
  if (!encryptionKey) return { ok: false, phones: [], error: "INTEGRATION_ENCRYPTION_KEY ausente" };
  const { data: creds, error: credsError } = await supabaseAdmin2.rpc("get_evolution_credentials_service", {
    _session_id: sessionId,
    _key: encryptionKey
  });
  if (credsError) return { ok: false, phones: [], error: credsError.message ?? "credenciais Evolution indispon\xEDveis" };
  const c = creds;
  if (!c?.instance_name || !c.api_key) return { ok: false, phones: [], error: "credenciais Evolution indispon\xEDveis" };
  const base = String(runtimeEnv("EVOLUTION_URL") ?? "").replace(/\/+$/, "");
  if (!base) return { ok: false, phones: [], error: "EVOLUTION_BASE_URL n\xE3o configurado" };
  try {
    const response = await fetch(
      `${base}/group/findGroupInfos/${encodeURIComponent(c.instance_name)}?groupJid=${encodeURIComponent(groupJid)}`,
      { headers: { apikey: c.api_key } }
    );
    const json = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, phones: [], error: `Evolution ${response.status}` };
    const phones = getAdminPhonesFromEvolutionPayload(
      json,
      session.phone_number ?? null
    );
    if (!phones.length) return { ok: false, phones: [], error: "nenhum administrador dispon\xEDvel para notifica\xE7\xE3o" };
    return { ok: true, phones, sessionId };
  } catch (error) {
    return { ok: false, phones: [], error: error.message };
  }
}
var GROUP_TEXT_FETCH_SHIM;
var init_salesbot_group_actions_server = __esm({
  "copied-server-source/lib/salesbot-group-actions.server.ts"() {
    init_whatsapp_identity();
    GROUP_TEXT_FETCH_SHIM = Symbol.for("mkton.evolution.groupTextFetchCompatibility");
    installEvolutionGroupTextCompatibility();
  }
});

// copied-server-source/lib/salesbot-ai-claim.server.ts
async function claimSalesbotAiTurn(supabaseAdmin2, params) {
  const { data, error } = await supabaseAdmin2.from("salesbot_runs").update({ status: "running", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", params.runId).eq("workspace_id", params.workspaceId).eq("status", "waiting_message").select("id");
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}
var init_salesbot_ai_claim_server = __esm({
  "copied-server-source/lib/salesbot-ai-claim.server.ts"() {
  }
});

// copied-server-source/lib/salesbot-run-guards.server.ts
function isSingleEntryConversationTrigger(trigger) {
  return SINGLE_ENTRY_CONVERSATION_TRIGGERS.has(String(trigger ?? "").trim().toLowerCase());
}
async function findPriorSingleEntrySalesbotRunId(supabaseAdmin2, params) {
  if (!isSingleEntryConversationTrigger(params.trigger)) return null;
  const { data, error } = await supabaseAdmin2.from("salesbot_runs").select("id, status, variables").eq("workspace_id", params.workspaceId).eq("salesbot_id", params.salesbotId).eq("lead_id", params.leadId).in("status", [...ACTIVE_RUN_STATUSES, "finished"]).order("started_at", { ascending: false }).limit(25);
  if (error || !Array.isArray(data)) return null;
  const prior = data.find(
    (row) => isSingleEntryConversationTrigger(
      typeof row.variables?.trigger === "string" ? row.variables.trigger : ""
    )
  );
  return typeof prior?.id === "string" ? prior.id : null;
}
async function findActiveSalesbotRunId(supabaseAdmin2, params) {
  const { data, error } = await supabaseAdmin2.from("salesbot_runs").select("id, status").eq("workspace_id", params.workspaceId).eq("salesbot_id", params.salesbotId).eq("lead_id", params.leadId).in("status", [...ACTIVE_RUN_STATUSES]).maybeSingle();
  if (error || !data) return null;
  return typeof data.id === "string" ? data.id : null;
}
async function waitForDurableSalesbotTimer(supabaseAdmin2, params, sleeper = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {
  const { data: parked, error: parkError } = await supabaseAdmin2.from("salesbot_runs").update({
    status: "waiting_timer",
    waiting_until: params.waitingUntil,
    current_block_id: params.currentBlockId,
    variables: params.waitingVariables
  }).eq("id", params.runId).eq("workspace_id", params.workspaceId).eq("status", "running").select("id");
  if (parkError || !Array.isArray(parked) || parked.length === 0) return false;
  await sleeper(Math.max(0, params.waitMs));
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const { data: claimed, error: claimError } = await supabaseAdmin2.from("salesbot_runs").update({
    status: "running",
    waiting_until: null,
    current_block_id: params.nextBlockId,
    variables: params.resumeVariables,
    updated_at: nowIso
  }).eq("id", params.runId).eq("workspace_id", params.workspaceId).eq("status", "waiting_timer").lte("waiting_until", nowIso).select("id");
  if (claimError) return false;
  return Array.isArray(claimed) && claimed.length > 0;
}
var ACTIVE_RUN_STATUSES, SINGLE_ENTRY_CONVERSATION_TRIGGERS;
var init_salesbot_run_guards_server = __esm({
  "copied-server-source/lib/salesbot-run-guards.server.ts"() {
    ACTIVE_RUN_STATUSES = ["running", "waiting_timer", "waiting_message"];
    SINGLE_ENTRY_CONVERSATION_TRIGGERS = /* @__PURE__ */ new Set(["primeira-mensagem", "qualquer-conversa"]);
  }
});

// copied-server-source/lib/ai-agent-x1-guards.server.ts
function leadActivitiesToAiHistory(rows) {
  return rows.slice().reverse().filter((row) => row.type === "message_in" || row.type === "message_out").map((row) => ({
    role: row.type === "message_in" ? "user" : "assistant",
    content: typeof row.payload?.text === "string" ? row.payload.text.trim() : ""
  })).filter((row) => row.content.length > 0);
}
var init_ai_agent_x1_guards_server = __esm({
  "copied-server-source/lib/ai-agent-x1-guards.server.ts"() {
  }
});

// copied-server-source/lib/whatsapp-session-routing.server.ts
async function resolveLeadEvolutionSession(sb, input) {
  const { data, error } = await sb.from("whatsapp_web_sessions").select("id").eq("workspace_id", input.workspaceId).eq("provider", "evolution").eq("status", "conectado").order("last_connected_at", { ascending: false });
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((row) => row.id).filter(Boolean);
  const preferred = input.preferredSessionId?.trim() || null;
  if (preferred) {
    if (ids.includes(preferred)) return preferred;
    throw new Error(
      "O n\xFAmero de WhatsApp desta conversa n\xE3o est\xE1 conectado. Reconecte a sess\xE3o correta antes de responder."
    );
  }
  if (ids.length === 1) return ids[0];
  if (ids.length === 0) throw new Error("Nenhum WhatsApp Evolution conectado neste workspace.");
  throw new Error(
    "Esta conversa n\xE3o est\xE1 vinculada a um n\xFAmero de WhatsApp. Receba uma mensagem por esse n\xFAmero ou vincule a sess\xE3o antes de responder."
  );
}
async function findLatestLeadWhatsappIdentity(sb, input) {
  const { data: activities, error: activityError } = await sb.from("lead_activities").select("payload,occurred_at").eq("workspace_id", input.workspaceId).eq("lead_id", input.leadId).in("type", ["message_in", "message_out"]).order("occurred_at", { ascending: false }).limit(80);
  if (activityError) throw new Error(activityError.message);
  const activityRows = activities ?? [];
  for (const activity of activityRows) {
    const payload = activity.payload ?? {};
    const identity = whatsappIdentityFromJid(payload.whatsapp_remote_jid);
    const sessionId = typeof payload.whatsapp_session_id === "string" && payload.whatsapp_session_id.trim() ? payload.whatsapp_session_id.trim() : typeof payload.session_id === "string" && payload.session_id.trim() ? payload.session_id.trim() : null;
    if (identity) {
      return {
        ...identity,
        sessionId,
        messageId: typeof payload.whatsapp_message_id === "string" ? payload.whatsapp_message_id : null,
        receivedAt: activity.occurred_at ?? null
      };
    }
  }
  const historicalPhone = normalizeInternationalPhone(input.phone, {
    allowTrustedBare: true
  });
  const messageIds = Array.from(
    new Set(
      activityRows.map((activity) => activity.payload?.whatsapp_message_id).filter((value) => typeof value === "string" && value.trim().length > 0)
    )
  );
  if (!messageIds.length) return null;
  const { data: messages, error: messageError } = await sb.from("whatsapp_web_messages").select("message_id,remote_jid,to_jid,session_id,received_at").eq("workspace_id", input.workspaceId).in("message_id", messageIds).order("received_at", { ascending: false }).limit(80);
  if (messageError) throw new Error(messageError.message);
  for (const row of messages ?? []) {
    const identity = whatsappIdentityFromJid(row.remote_jid) ?? whatsappIdentityFromJid(row.to_jid);
    if (!identity) continue;
    if (identity.kind === "direct") {
      if (historicalPhone.ok === false || historicalPhone.digits !== identity.digits) {
        continue;
      }
    }
    return {
      ...identity,
      sessionId: row.session_id?.trim() || null,
      messageId: row.message_id?.trim() || null,
      receivedAt: row.received_at ?? null
    };
  }
  return null;
}
var init_whatsapp_session_routing_server = __esm({
  "copied-server-source/lib/whatsapp-session-routing.server.ts"() {
    init_whatsapp_identity();
  }
});

// salesbot-environment.ts
var resolvePublicAppUrl;
var init_salesbot_environment = __esm({
  "salesbot-environment.ts"() {
    resolvePublicAppUrl = () => process.env.PUBLIC_URL || "";
  }
});

// copied-server-source/lib/agent-action-rules.ts
function listaAlvo(alvo, plural, singular) {
  const itens = String(alvo ?? "").split(/\s*[|,]\s*/).map((t) => t.trim()).filter(Boolean);
  if (!itens.length) return `${singular} configurado`;
  if (itens.length === 1) return `${singular}: "${itens[0]}"`;
  return `${plural}: ${itens.map((t) => `"${t}"`).join(", ")}`;
}
function describePromptAgentActions(actions, verdicts) {
  const list = (actions ?? []).filter((a) => a?.do?.action);
  if (!list.length) return "";
  const lines = list.map((a) => {
    const trigger = PROMPT_TRIGGER_TEXT[String(a.when?.trigger ?? "")] ?? "acontecer o gatilho configurado";
    const assunto = [...a.when?.subjects ?? [], a.when?.custom].filter(Boolean).join(", ");
    const v = verdicts?.[String(a.id ?? "")];
    const marca = !v ? "" : v.status === "ativo" ? `[ATIVO AGORA \u2014 ${v.detail}] ` : v.status === "inativo" ? `[N\xC3O SE APLICA AGORA \u2014 ${v.detail}] ` : `[VERIFIQUE VOC\xCA \u2014 ${v.detail}] `;
    const cond = `${marca}SE ${trigger}${assunto ? ` "${assunto}"` : ""}`;
    const act = String(a.do?.action ?? "");
    const alvo = a.do?.targetLabel || a.do?.target || "";
    const msg = (a.do?.message ?? "").trim();
    let then = "";
    switch (act) {
      case "nao-responda":
        then = "N\xC3O responda nada. Fique em sil\xEAncio e aguarde um atendente humano.";
        break;
      case "sempre-usar-mensagem":
        then = `responda EXATAMENTE com este texto, sem alterar nada: "${msg}"`;
        break;
      case "sempre-responder-info":
        then = `responda usando obrigatoriamente esta informa\xE7\xE3o: "${msg}"`;
        break;
      case "transferir-usuario":
        then = `${msg ? `diga "${msg}" e ` : ""}encerre finalizando com [[HANDOFF]] para transferir${alvo ? ` para ${alvo}` : ""}${a.do?.withPermission ? " (pe\xE7a permiss\xE3o ao cliente antes)" : ""}${a.do?.withSummary ? " (inclua um resumo curto da conversa)" : ""}`;
        break;
      case "sempre-falar-assunto":
        then = `traga sempre ${listaAlvo(alvo, "estes assuntos", "este assunto")} para a conversa`;
        break;
      case "adicionar-tarefa":
      case "definir-campo":
      case "gerenciar-tags":
        then = `${act === "definir-campo" ? "grave o campo personalizado configurado" : act === "gerenciar-tags" ? `aplique a tag "${alvo}" no lead` : "crie a tarefa configurada"} incluindo no fim da resposta o marcador [[AGENT_ACTION:${a.id}]]; nunca mostre nem explique esse marcador ao cliente`;
        break;
      case "tentar-falar-assunto":
        then = `conduza a conversa, de forma natural, para ${listaAlvo(alvo, "estes assuntos", "este assunto")}; n\xE3o force, mas n\xE3o encerre sem tentar`;
        break;
      case "nao-mencionar":
        then = `NUNCA mencione, cite ou responda sobre ${listaAlvo(alvo, "estes t\xF3picos", "este t\xF3pico")}. Se o cliente perguntar, desvie educadamente sem dar a informa\xE7\xE3o`;
        break;
      case "solicitar-cliente":
        then = `pe\xE7a OBRIGATORIAMENTE ao cliente ${listaAlvo(alvo, "estas informa\xE7\xF5es", "esta informa\xE7\xE3o")}. Pe\xE7a uma de cada vez, em linguagem natural; se o cliente n\xE3o responder, pergunte de novo mais adiante e n\xE3o encerre a conversa sem ter pedido`;
        break;
      case "responder-base-conhecimento":
        then = "responda apenas com base na fonte de conhecimento fornecida; se n\xE3o souber, diga que vai verificar";
        break;
      case "criar-compromisso":
      case "iniciar-salesbot":
      case "mudar-etapa-lead":
      case "alterar-responsavel":
      case "enviar-arquivo": {
        const oque = act === "criar-compromisso" ? `crie o compromisso no calend\xE1rio${alvo ? ` (${alvo})` : ""}, confirmando antes o melhor hor\xE1rio com o cliente` : act === "iniciar-salesbot" ? `o sistema inicia o salesbot selecionado${alvo ? ` (${alvo})` : ""}` : act === "mudar-etapa-lead" ? `o sistema move o lead para a etapa selecionada${alvo ? ` (${alvo})` : ""}` : act === "alterar-responsavel" ? `o sistema define o respons\xE1vel selecionado${alvo ? ` (${alvo})` : ""}` : `o sistema envia o arquivo selecionado${alvo ? ` (${alvo})` : ""}`;
        then = `${oque}. Inclua no fim da resposta o marcador [[AGENT_ACTION:${a.id}]]; nunca mostre nem explique esse marcador ao cliente${msg ? `. Mensagem para o cliente: "${msg}"` : ""}`;
        break;
      }
      default:
        then = `o sistema executa a a\xE7\xE3o "${act}"${alvo ? ` \u2192 ${alvo}` : ""}${msg ? ` e envia: "${msg}"` : ""}`;
        break;
    }
    return `- ${cond}: ${then}.${a.more?.trim() ? ` Contexto extra: ${a.more.trim()}` : ""}`;
  });
  return [
    "REGRAS OBRIGAT\xD3RIAS DE COMPORTAMENTO (t\xEAm prioridade sobre qualquer outra instru\xE7\xE3o):",
    ...lines,
    verdicts ? "Execute APENAS as regras marcadas como [ATIVO AGORA]. Ignore completamente as marcadas como [N\xC3O SE APLICA AGORA]. As marcadas como [VERIFIQUE VOC\xCA] dependem do seu julgamento sobre a inten\xE7\xE3o do cliente." : ""
  ].filter(Boolean).join("\n");
}
var PROMPT_TRIGGER_TEXT;
var init_agent_action_rules = __esm({
  "copied-server-source/lib/agent-action-rules.ts"() {
    PROMPT_TRIGGER_TEXT = {
      "cliente-quer": "o cliente quiser",
      "toda-vez-pergunta": "o cliente perguntar sobre",
      "primeira-vez-pergunta": "o cliente perguntar pela primeira vez sobre",
      sentimento: "o sentimento do cliente for",
      "cliente-fornece": "o cliente fornecer o",
      "mensagem-contem": "a mensagem contiver",
      "nao-responde-ha": "o cliente n\xE3o responder h\xE1",
      "formato-mensagem": "o formato da mensagem for",
      "horario-especifico": "a mensagem chegar no hor\xE1rio"
    };
  }
});

// copied-server-source/lib/agent-trigger-eval.ts
function matchSchedule(spec, now) {
  const s = norm(spec);
  const hours = [...s.matchAll(/(\d{1,2})[:h](\d{2})?/g)].map((m) => Number(m[1]) * 60 + Number(m[2] ?? 0));
  if (hours.length < 2) return null;
  const [start, end] = [hours[0], hours[1]];
  const dayMatch = s.match(/(dom|seg|ter|qua|qui|sex|sab)\s*(?:-|a|ate|até)\s*(dom|seg|ter|qua|qui|sex|sab)/);
  const singleDays = [...s.matchAll(/\b(dom|seg|ter|qua|qui|sex|sab)\b/g)].map((m) => WEEKDAYS[m[1]]);
  const dow = now.getDay();
  let dayOk = true;
  if (dayMatch) {
    const a = WEEKDAYS[dayMatch[1]];
    const b = WEEKDAYS[dayMatch[2]];
    dayOk = a <= b ? dow >= a && dow <= b : dow >= a || dow <= b;
  } else if (singleDays.length) {
    dayOk = singleDays.includes(dow);
  }
  const minutes = now.getHours() * 60 + now.getMinutes();
  const timeOk = start <= end ? minutes >= start && minutes <= end : minutes >= start || minutes <= end;
  return dayOk && timeOk;
}
function parseDurationMinutes(spec) {
  const s = norm(spec);
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(min|minuto|minutos|h|hora|horas|d|dia|dias)/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  const unit = m[2];
  if (unit.startsWith("h")) return n * 60;
  if (unit.startsWith("d")) return n * 60 * 24;
  return n;
}
function detectSentiment(text) {
  const t = norm(text);
  const pos = POSITIVAS.filter((w) => t.includes(norm(w))).length;
  const neg = NEGATIVAS.filter((w) => t.includes(norm(w))).length;
  if (neg > pos) return "negativo";
  if (pos > neg) return "positivo";
  return "neutro";
}
function detectProvidedData(subject, ctx) {
  const s = norm(subject);
  const text = ctx.message;
  if (s.includes("mail")) return RE_EMAIL.test(text);
  if (s.includes("telefone") || s.includes("whats") || s.includes("celular")) return RE_FONE.test(text);
  if (s.includes("cpf") || s.includes("cnpj")) return RE_CPF.test(text);
  if (s.includes("endereco")) return /\b(rua|av\.?|avenida|travessa|bairro|cep|numero|nº|n°)\b/.test(norm(text));
  if (s.includes("nome")) {
    const t = text.trim();
    if (!t || t.length > 80) return false;
    if (/\b(meu nome|me chamo|sou o|sou a)\b/.test(norm(t))) return true;
    const semNome = !ctx.lead?.name || /^lead\b|^contato\b|^\+?\d+$/i.test(String(ctx.lead?.name ?? ""));
    return semNome && /^[\p{L}\s'.-]{2,60}$/u.test(t) && t.split(/\s+/).length <= 4;
  }
  return null;
}
function splitTerms(subject) {
  return String(subject ?? "").split("/").map((t) => t.trim()).filter(Boolean);
}
function mentionsSubject(text, subject) {
  const termos = splitTerms(subject);
  if (!termos.length) return false;
  const alvo = norm(text);
  return termos.some((t) => alvo.includes(norm(t)));
}
function evaluateTrigger(when, ctx) {
  const trigger = String(when?.trigger ?? "");
  const subjects = [...when?.subjects ?? [], when?.custom ?? ""].map((s) => String(s ?? "").trim()).filter(Boolean);
  const anySubject = (text) => subjects.some((s) => mentionsSubject(text, s));
  switch (trigger) {
    case "horario-especifico": {
      const res = subjects.map((s) => matchSchedule(s, ctx.now)).find((r) => r !== null);
      if (res === void 0 || res === null) {
        return { status: "ia", detail: "janela de hor\xE1rio n\xE3o reconhecida \u2014 confira o formato (ex.: seg-sex 09:00-18:00)" };
      }
      const hhmm = `${String(ctx.now.getHours()).padStart(2, "0")}:${String(ctx.now.getMinutes()).padStart(2, "0")}`;
      return { status: res ? "ativo" : "inativo", detail: `agora s\xE3o ${hhmm}` };
    }
    case "formato-mensagem": {
      if (!subjects.length) return { status: "ia", detail: "nenhum formato selecionado" };
      const ok = subjects.some((s) => norm(s) === norm(ctx.messageFormat));
      return { status: ok ? "ativo" : "inativo", detail: `a mensagem atual \xE9 ${ctx.messageFormat}` };
    }
    case "nao-responde-ha": {
      const alvo = subjects.map(parseDurationMinutes).find((m) => m !== null);
      if (alvo == null) return { status: "ia", detail: "tempo n\xE3o reconhecido (ex.: 30 minutos, 2 horas)" };
      if (ctx.minutesSinceCustomerMessage == null) return { status: "ia", detail: "tempo sem resposta desconhecido" };
      const ok = ctx.minutesSinceCustomerMessage >= alvo;
      return { status: ok ? "ativo" : "inativo", detail: `${Math.round(ctx.minutesSinceCustomerMessage)} min desde a \xFAltima mensagem do cliente` };
    }
    case "mensagem-contem": {
      if (!subjects.length) return { status: "ia", detail: "nenhum termo informado" };
      const ok = anySubject(ctx.message);
      return { status: ok ? "ativo" : "inativo", detail: ok ? "termo encontrado na mensagem" : "termo n\xE3o encontrado na mensagem atual" };
    }
    case "sentimento": {
      if (!subjects.length) return { status: "ia", detail: "nenhum sentimento selecionado" };
      const s = detectSentiment(ctx.message);
      const mapa = {
        positivo: ["positivo", "feliz"],
        negativo: ["negativo", "frustrado", "irritado"],
        neutro: ["neutro"]
      };
      const aceitos = subjects.map(norm);
      const ok = aceitos.some((a) => mapa[s]?.includes(a));
      return ok ? { status: "ativo", detail: `sentimento detectado: ${s}` } : { status: "ia", detail: `sentimento prov\xE1vel: ${s} \u2014 confirme pelo tom da conversa` };
    }
    case "cliente-fornece": {
      if (!subjects.length) return { status: "ia", detail: "nenhum dado selecionado" };
      const res = subjects.map((s) => detectProvidedData(s, ctx));
      if (res.every((r) => r === null)) return { status: "ia", detail: "dado sem detector autom\xE1tico" };
      const ok = res.some((r) => r === true);
      return { status: ok ? "ativo" : "inativo", detail: ok ? "dado identificado na mensagem atual" : "o cliente ainda n\xE3o forneceu esse dado nesta mensagem" };
    }
    case "primeira-vez-pergunta": {
      if (!subjects.length) return { status: "ia", detail: "nenhum assunto selecionado" };
      const agora = anySubject(ctx.message);
      if (!agora) return { status: "inativo", detail: "o assunto n\xE3o apareceu na mensagem atual" };
      const jaFalou = ctx.history.some((m) => m.role === "user" && anySubject(m.content));
      return jaFalou ? { status: "inativo", detail: "o cliente j\xE1 tinha perguntado sobre isso antes" } : { status: "ativo", detail: "\xE9 a primeira vez que o cliente toca nesse assunto" };
    }
    case "toda-vez-pergunta": {
      if (!subjects.length) return { status: "ia", detail: "nenhum assunto selecionado" };
      const ok = anySubject(ctx.message);
      return ok ? { status: "ativo", detail: "o assunto apareceu na mensagem atual" } : { status: "ia", detail: "o assunto n\xE3o apareceu literalmente \u2014 avalie a inten\xE7\xE3o" };
    }
    case "cliente-quer": {
      if (!subjects.length) return { status: "ia", detail: "nenhuma inten\xE7\xE3o selecionada" };
      const ok = anySubject(ctx.message);
      return ok ? { status: "ativo", detail: "inten\xE7\xE3o citada na mensagem atual" } : { status: "ia", detail: "avalie pela inten\xE7\xE3o do cliente, n\xE3o s\xF3 pela palavra" };
    }
    default:
      return { status: "ia", detail: "avalie pelo contexto da conversa" };
  }
}
function describeConversationFacts(ctx) {
  const dias = ["domingo", "segunda", "ter\xE7a", "quarta", "quinta", "sexta", "s\xE1bado"];
  const hhmm = `${String(ctx.now.getHours()).padStart(2, "0")}:${String(ctx.now.getMinutes()).padStart(2, "0")}`;
  const linhas = [
    `- Agora: ${dias[ctx.now.getDay()]}, ${String(ctx.now.getDate()).padStart(2, "0")}/${String(ctx.now.getMonth() + 1).padStart(2, "0")} \xE0s ${hhmm}`,
    `- Formato da \xFAltima mensagem do cliente: ${ctx.messageFormat}`,
    ctx.minutesSinceCustomerMessage == null ? "- Tempo desde a \xFAltima mensagem do cliente: desconhecido" : `- Tempo desde a \xFAltima mensagem do cliente: ${Math.round(ctx.minutesSinceCustomerMessage)} minuto(s)`,
    `- Mensagens anteriores nesta conversa: ${ctx.history.length}`,
    ctx.messageFormat === "\xE1udio" && /^\[áudio transcrito\]/i.test(ctx.message) ? `- Transcri\xE7\xE3o do \xE1udio recebido: "${ctx.message.replace(/^\[áudio transcrito\]\s*/i, "").slice(0, 1200)}"` : ""
  ].filter(Boolean);
  return ["FATOS DA CONVERSA AGORA (calculados pelo sistema, confie neles):", ...linhas].join("\n");
}
var norm, WEEKDAYS, POSITIVAS, NEGATIVAS, RE_EMAIL, RE_FONE, RE_CPF;
var init_agent_trigger_eval = __esm({
  "copied-server-source/lib/agent-trigger-eval.ts"() {
    norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    WEEKDAYS = {
      dom: 0,
      seg: 1,
      ter: 2,
      qua: 3,
      qui: 4,
      sex: 5,
      sab: 6
    };
    POSITIVAS = ["obrigado", "obrigada", "otimo", "\xF3timo", "perfeito", "adorei", "gostei", "top", "maravilha", "show", "excelente", "legal", "bacana", "amei"];
    NEGATIVAS = ["pessimo", "p\xE9ssimo", "horrivel", "ruim", "nao gostei", "cancelar", "reclamacao", "absurdo", "demora", "demorando", "problema", "erro", "insatisfeito", "decepcionado", "irritado", "revoltado", "palhacada", "merda", "porcaria", "raiva"];
    RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
    RE_FONE = /(?:\+?55\s*)?\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/;
    RE_CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/;
  }
});

// copied-server-source/lib/agent-conditional-rules.ts
function compareText(actual, op, expected) {
  const a = norm2(actual);
  const alternativas = expected.split("/").map(norm2).filter(Boolean);
  switch (op) {
    case "contem":
      return alternativas.some((t) => a.includes(t));
    case "igual":
      return alternativas.some((t) => a === t);
    case "diferente":
      return alternativas.length ? alternativas.every((t) => a !== t) : true;
    case "maior":
      return a.length > (toNumber(expected) ?? 0);
    case "menor":
      return a.length < (toNumber(expected) ?? 0);
    default:
      return false;
  }
}
function compareNumber(actual, op, expected) {
  const e = toNumber(expected);
  if (actual === null || e === null) return false;
  switch (op) {
    case "igual":
      return actual === e;
    case "diferente":
      return actual !== e;
    case "maior":
      return actual > e;
    case "menor":
      return actual < e;
    case "contem":
      return actual >= e;
    default:
      return false;
  }
}
function compareList(list, op, expected) {
  const alvos = expected.split(/[,/]/).map(norm2).filter(Boolean);
  const atuais = list.map(norm2);
  if (!alvos.length) return false;
  switch (op) {
    case "contem":
    case "igual":
      return alvos.some((t) => atuais.includes(t));
    case "diferente":
      return alvos.every((t) => !atuais.includes(t));
    default:
      return false;
  }
}
function evaluateCondition(c, ctx) {
  const op = String(c.op ?? "contem");
  const value = String(c.value ?? "");
  switch (String(c.field ?? "")) {
    case "mensagem-cliente":
      return value.trim() ? compareText(ctx.message, op, value) : false;
    case "interacoes":
      return compareNumber(ctx.interactions, op, value);
    case "sem-resposta-min":
      return compareNumber(ctx.minutesSinceCustomerMessage, op === "contem" ? "maior" : op, value);
    case "tag-lead":
      return compareList(ctx.tags, op, value);
    case "etapa-atual": {
      const igual = norm2(ctx.stageId) === norm2(value) && !!value.trim();
      return op === "diferente" ? !igual : igual;
    }
    case "objetivo-atingido": {
      const esperado = norm2(value) !== "nao";
      const bate = ctx.objectiveReached === esperado;
      return op === "diferente" ? !bate : bate;
    }
    case "campo-personalizado":
    case "campo": {
      const fieldId = String(c.fieldId ?? "").trim();
      if (!fieldId) return false;
      const atual = String(ctx.customFieldValues?.[fieldId] ?? "");
      if (op === "existe") return atual.trim().length > 0;
      if (op === "vazio") return atual.trim().length === 0;
      const num = toNumber(atual);
      if ((op === "maior" || op === "menor") && num !== null) return compareNumber(num, op, value);
      return compareText(atual, op, value);
    }
    default: {
      const key = String(c.field ?? "");
      if (/^(trafego|social|workflow|tracking)-/.test(key)) {
        const atual = ctx.systemMetrics?.[key];
        return compareNumber(typeof atual === "number" ? atual : null, op, value);
      }
      return false;
    }
  }
}
function matchAgentRules(rules, ctx) {
  const out = [];
  for (const rule of rules ?? []) {
    const conds = (rule?.conditions ?? []).filter((c) => c && String(c.field ?? "").trim());
    if (!conds.length) continue;
    const results = conds.map((c) => evaluateCondition(c, ctx));
    const ok = (rule.logic ?? "e") === "ou" ? results.some(Boolean) : results.every(Boolean);
    if (ok) out.push(rule);
  }
  return out;
}
function ruleActionToRuntime(rule) {
  const type = String(rule.action?.type ?? "").trim();
  const target = String(rule.action?.target ?? "").trim();
  const targetLabel = rule.action?.targetLabel;
  const map = {
    "trocar-etapa": "mudar-etapa",
    "transferir-humano": "transferir-humano",
    "iniciar-bot": "iniciar-salesbot",
    "enviar-formulario": "enviar-formulario",
    "enviar-arquivo": "enviar-arquivo",
    "adicionar-tag": "adicionar-tag",
    "criar-tarefa": "criar-tarefa",
    "remover-tag": "remover-tag",
    "definir-campo": "definir-campo",
    "atualizar-campo": "definir-campo",
    "criar-tarefa-workflow": "criar-tarefa-workflow"
  };
  const action = map[type];
  if (!action) return null;
  return { action, target, targetLabel };
}
function ruleEndsConversation(rule) {
  return String(rule.action?.type ?? "") === "encerrar-conversa";
}
var norm2, toNumber;
var init_agent_conditional_rules = __esm({
  "copied-server-source/lib/agent-conditional-rules.ts"() {
    norm2 = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    toNumber = (v) => {
      const n = Number(String(v ?? "").replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };
  }
});

// copied-server-source/lib/crm-mock.ts
function normalizeTrigger(t) {
  if (!t) return { kind: "created-or-moved" };
  if (typeof t === "string") return { kind: t };
  return t;
}
function webhookPreviewPayload(cfg) {
  const base = {
    event: WEBHOOK_PRESET_EVENT[cfg.preset],
    event_id: "evt_<gerado_no_envio>",
    workspace_id: "<ws_id>",
    sent_at: "<ISO-8601>",
    lead: {
      id: "<lead_id>",
      name: "Fulano de Tal",
      email: "fulano@exemplo.com",
      phone: "5511999998888",
      value: 1500,
      tags: ["quente"],
      pipeline: "Funil principal",
      stage_from: "Negocia\xE7\xE3o",
      stage_to: "Fechado",
      responsible: { id: "<user_id>", name: "Vendedor" }
    }
  };
  switch (cfg.preset) {
    case "sale-won":
      return { ...base, sale: { valor: 1500, produto: "<produto>", vendedor_id: "<user_id>", data_fechamento: "<ISO-8601>" } };
    case "sale-lost":
      return { ...base, loss: { motivo: cfg.motivoPadrao ?? "<preenchido pelo vendedor>", etapa: "<\xFAltima etapa>", valor_previsto: 1500 } };
    case "remarketing":
      return { ...base, audience: cfg.audienceName ?? "<nome-da-audiencia>", hashes: { email_sha256: "<hash>", phone_sha256: "<hash>" } };
    case "meeting":
      return { ...base, meeting: { agendada_para: "<ISO-8601>", link: "<url>", vendedor_id: "<user_id>" } };
    case "billing":
      return { ...base, billing: { valor: Number(cfg.valorPadrao) || 0, metodo: cfg.metodo ?? "pix", vencimento: "<ISO-8601>" } };
    case "lead-qualified":
      return { ...base, qualification: { score: 80, etapa: "<etapa atual>" } };
    case "custom":
    default:
      return base;
  }
}
function isAutomationConfigured(action) {
  const cfg = action.config;
  if (!cfg) return false;
  switch (cfg.kind) {
    case "mudar-etapa":
      return !!cfg.stageId;
    case "editar-tags": {
      const mode = cfg.mode ?? "add";
      if (mode === "replace") return !!cfg.replace?.length;
      return !!(cfg.add?.length || cfg.remove?.length);
    }
    case "alterar-user":
      return !!cfg.userId;
    case "alterar-campo": {
      if (!cfg.campo || cfg.valor === void 0 || cfg.valor === "") return false;
      if (cfg.campo === "custom" && !cfg.customFieldId) return false;
      return validateFieldValue(cfg.campo, cfg.valor, cfg.customFieldType).ok;
    }
    case "tarefa":
      return !!cfg.titulo?.trim();
    case "tarefa-concluida":
    case "excluir-tarefas":
      return (cfg.escopo ?? "todas") === "todas" ? true : !!cfg.taskId;
    case "excluir-lead":
    case "pausar-ia":
      return true;
    case "duplicar-lead":
      return true;
    case "salesbot":
      return !!cfg.botId;
    case "executar-ia":
      return !!cfg.agentId;
    case "msg-interna":
      return !!cfg.toUserId && !!cfg.mensagem?.trim();
    case "gerar-form":
      return !!cfg.formId;
    case "deletar-arquivos": {
      const esc = cfg.escopo ?? "todos";
      if (esc === "por-tipo") return !!cfg.tipo;
      if (esc === "por-tag") return !!cfg.tag;
      return true;
    }
    case "meta-ads":
      return !!cfg.pixelId && !!cfg.eventName;
    case "vincular-produto":
      return !!cfg.productId;
    case "webhook":
      return false;
    // front-end only por enquanto
    case "webhook-inbound":
      return false;
    // front-end only por enquanto
    case "none":
      return false;
  }
}
function validateFieldValue(campo, valor, customFieldType) {
  const v = (valor ?? "").trim();
  if (!v) return { ok: false, error: "Informe um valor." };
  if (campo === "name") {
    if (v.length < 2) return { ok: false, error: "Nome muito curto." };
    if (/^\d+$/.test(v)) return { ok: false, error: "Nome n\xE3o pode ser s\xF3 n\xFAmeros." };
    return { ok: true, normalized: v };
  }
  if (campo === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { ok: false, error: "E-mail inv\xE1lido (precisa ter @ e dom\xEDnio)." };
    return { ok: true, normalized: v.toLowerCase() };
  }
  if (campo === "phone") {
    const digits = v.replace(/\D/g, "");
    if (digits.length < 10) return { ok: false, error: "Telefone precisa ter DDD + n\xFAmero (m\xEDn. 10 d\xEDgitos)." };
    if (digits.length > 15) return { ok: false, error: "Telefone muito longo." };
    return { ok: true, normalized: digits };
  }
  if (campo === "value") {
    const cleaned = v.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const num = Number(cleaned);
    if (!Number.isFinite(num) || num < 0) return { ok: false, error: "Valor precisa ser um n\xFAmero (ex.: 1500 ou 1.500,50)." };
    return { ok: true, normalized: num };
  }
  const t = String(customFieldType ?? "text").toLowerCase();
  if (t === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { ok: false, error: "E-mail inv\xE1lido." };
    return { ok: true, normalized: v };
  }
  if (t === "phone" || t === "tel") {
    const digits = v.replace(/\D/g, "");
    if (digits.length < 8) return { ok: false, error: "Telefone inv\xE1lido." };
    return { ok: true, normalized: digits };
  }
  if (t === "number" || t === "numeric" || t === "price") {
    const cleaned = v.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const num = Number(cleaned);
    if (!Number.isFinite(num)) return { ok: false, error: "Precisa ser um n\xFAmero." };
    return { ok: true, normalized: num };
  }
  if (t === "url") {
    try {
      new URL(v.startsWith("http") ? v : `https://${v}`);
      return { ok: true, normalized: v };
    } catch {
      return { ok: false, error: "URL inv\xE1lida." };
    }
  }
  if (t === "date") {
    if (Number.isNaN(new Date(v).getTime())) return { ok: false, error: "Data inv\xE1lida." };
    return { ok: true, normalized: v };
  }
  return { ok: true, normalized: v };
}
var WEBHOOK_PRESET_EVENT;
var init_crm_mock = __esm({
  "copied-server-source/lib/crm-mock.ts"() {
    WEBHOOK_PRESET_EVENT = {
      "custom": "lead.stage_entered",
      "sale-won": "sale.won",
      "sale-lost": "sale.lost",
      "remarketing": "remarketing.add",
      "meeting": "meeting.scheduled",
      "billing": "billing.request",
      "lead-qualified": "lead.qualified"
    };
  }
});

// copied-server-source/lib/forms.functions.ts
function splitName(full) {
  const t = (full ?? "").trim();
  if (!t) return { primeiro: "", sobrenome: "" };
  const parts = t.split(/\s+/);
  const primeiro = parts.shift() ?? "";
  return { primeiro, sobrenome: parts.join(" ") };
}
function renderFormMessage(template, params) {
  const nameFallback = (params.nome ?? "").trim();
  const split = splitName(params.nomeCompleto ?? params.nome ?? null);
  const primeiro = nameFallback || split.primeiro || "tudo bem";
  const sobrenome = (params.sobrenome ?? split.sobrenome ?? "").trim();
  const nomeCompleto = (params.nomeCompleto ?? [primeiro, sobrenome].filter(Boolean).join(" ")).trim() || primeiro;
  const base = {
    link: params.link,
    nome: primeiro,
    sobrenome,
    nome_completo: nomeCompleto,
    email: (params.email ?? "").trim(),
    telefone: (params.telefone ?? "").trim(),
    empresa: (params.empresa ?? "").trim(),
    valor: params.valor === null || params.valor === void 0 || params.valor === "" ? "" : String(params.valor),
    etapa: (params.etapa ?? "").trim(),
    funil: (params.funil ?? "").trim()
  };
  const custom = /* @__PURE__ */ new Map();
  for (const [k, v] of Object.entries(params.customFields ?? {})) {
    custom.set(normalizeVarKey(k), (v ?? "").toString());
  }
  return template.replace(/\{\{\s*([^}\s][^}]*?)\s*\}\}/g, (_full, rawKey) => {
    const key = normalizeVarKey(rawKey);
    if (key in base) return base[key];
    if (custom.has(key)) return custom.get(key);
    return "";
  });
}
function normalizeVarKey(input) {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function formShareOrigin() {
  return resolvePublicAppUrl();
}
function buildFormPublicUrl(origin, slug, leadId) {
  const base = `${origin.replace(/\/$/, "")}/${FORM_PUBLIC_PREFIX}/${encodeURIComponent(slug)}`;
  if (!leadId) return base;
  return `${base}?leadId=${encodeURIComponent(leadId)}`;
}
function buildFormShareUrl(slug, leadId) {
  return buildFormPublicUrl(formShareOrigin(), slug, leadId);
}
var DEFAULT_FORM_MESSAGE_TEMPLATE, FORM_PUBLIC_PREFIX;
var init_forms_functions = __esm({
  "copied-server-source/lib/forms.functions.ts"() {
    init_salesbot_environment();
    DEFAULT_FORM_MESSAGE_TEMPLATE = "Ol\xE1 {{nome}}! Para agilizar o pr\xF3ximo passo, preencha este formul\xE1rio rapidinho: {{link}}";
    FORM_PUBLIC_PREFIX = "l";
  }
});

// ../node_modules/date-fns/locale/en-US/_lib/formatDistance.js
var formatDistanceLocale, formatDistance;
var init_formatDistance = __esm({
  "../node_modules/date-fns/locale/en-US/_lib/formatDistance.js"() {
    formatDistanceLocale = {
      lessThanXSeconds: {
        one: "less than a second",
        other: "less than {{count}} seconds"
      },
      xSeconds: {
        one: "1 second",
        other: "{{count}} seconds"
      },
      halfAMinute: "half a minute",
      lessThanXMinutes: {
        one: "less than a minute",
        other: "less than {{count}} minutes"
      },
      xMinutes: {
        one: "1 minute",
        other: "{{count}} minutes"
      },
      aboutXHours: {
        one: "about 1 hour",
        other: "about {{count}} hours"
      },
      xHours: {
        one: "1 hour",
        other: "{{count}} hours"
      },
      xDays: {
        one: "1 day",
        other: "{{count}} days"
      },
      aboutXWeeks: {
        one: "about 1 week",
        other: "about {{count}} weeks"
      },
      xWeeks: {
        one: "1 week",
        other: "{{count}} weeks"
      },
      aboutXMonths: {
        one: "about 1 month",
        other: "about {{count}} months"
      },
      xMonths: {
        one: "1 month",
        other: "{{count}} months"
      },
      aboutXYears: {
        one: "about 1 year",
        other: "about {{count}} years"
      },
      xYears: {
        one: "1 year",
        other: "{{count}} years"
      },
      overXYears: {
        one: "over 1 year",
        other: "over {{count}} years"
      },
      almostXYears: {
        one: "almost 1 year",
        other: "almost {{count}} years"
      }
    };
    formatDistance = (token, count, options) => {
      let result;
      const tokenValue = formatDistanceLocale[token];
      if (typeof tokenValue === "string") {
        result = tokenValue;
      } else if (count === 1) {
        result = tokenValue.one;
      } else {
        result = tokenValue.other.replace("{{count}}", count.toString());
      }
      if (options?.addSuffix) {
        if (options.comparison && options.comparison > 0) {
          return "in " + result;
        } else {
          return result + " ago";
        }
      }
      return result;
    };
  }
});

// ../node_modules/date-fns/locale/_lib/buildFormatLongFn.js
function buildFormatLongFn(args) {
  return (options = {}) => {
    const width = options.width ? String(options.width) : args.defaultWidth;
    const format3 = args.formats[width] || args.formats[args.defaultWidth];
    return format3;
  };
}
var init_buildFormatLongFn = __esm({
  "../node_modules/date-fns/locale/_lib/buildFormatLongFn.js"() {
  }
});

// ../node_modules/date-fns/locale/en-US/_lib/formatLong.js
var dateFormats, timeFormats, dateTimeFormats, formatLong;
var init_formatLong = __esm({
  "../node_modules/date-fns/locale/en-US/_lib/formatLong.js"() {
    init_buildFormatLongFn();
    dateFormats = {
      full: "EEEE, MMMM do, y",
      long: "MMMM do, y",
      medium: "MMM d, y",
      short: "MM/dd/yyyy"
    };
    timeFormats = {
      full: "h:mm:ss a zzzz",
      long: "h:mm:ss a z",
      medium: "h:mm:ss a",
      short: "h:mm a"
    };
    dateTimeFormats = {
      full: "{{date}} 'at' {{time}}",
      long: "{{date}} 'at' {{time}}",
      medium: "{{date}}, {{time}}",
      short: "{{date}}, {{time}}"
    };
    formatLong = {
      date: buildFormatLongFn({
        formats: dateFormats,
        defaultWidth: "full"
      }),
      time: buildFormatLongFn({
        formats: timeFormats,
        defaultWidth: "full"
      }),
      dateTime: buildFormatLongFn({
        formats: dateTimeFormats,
        defaultWidth: "full"
      })
    };
  }
});

// ../node_modules/date-fns/locale/en-US/_lib/formatRelative.js
var formatRelativeLocale, formatRelative;
var init_formatRelative = __esm({
  "../node_modules/date-fns/locale/en-US/_lib/formatRelative.js"() {
    formatRelativeLocale = {
      lastWeek: "'last' eeee 'at' p",
      yesterday: "'yesterday at' p",
      today: "'today at' p",
      tomorrow: "'tomorrow at' p",
      nextWeek: "eeee 'at' p",
      other: "P"
    };
    formatRelative = (token, _date, _baseDate, _options) => formatRelativeLocale[token];
  }
});

// ../node_modules/date-fns/locale/_lib/buildLocalizeFn.js
function buildLocalizeFn(args) {
  return (value, options) => {
    const context = options?.context ? String(options.context) : "standalone";
    let valuesArray;
    if (context === "formatting" && args.formattingValues) {
      const defaultWidth = args.defaultFormattingWidth || args.defaultWidth;
      const width = options?.width ? String(options.width) : defaultWidth;
      valuesArray = args.formattingValues[width] || args.formattingValues[defaultWidth];
    } else {
      const defaultWidth = args.defaultWidth;
      const width = options?.width ? String(options.width) : args.defaultWidth;
      valuesArray = args.values[width] || args.values[defaultWidth];
    }
    const index = args.argumentCallback ? args.argumentCallback(value) : value;
    return valuesArray[index];
  };
}
var init_buildLocalizeFn = __esm({
  "../node_modules/date-fns/locale/_lib/buildLocalizeFn.js"() {
  }
});

// ../node_modules/date-fns/locale/en-US/_lib/localize.js
var eraValues, quarterValues, monthValues, dayValues, dayPeriodValues, formattingDayPeriodValues, ordinalNumber, localize;
var init_localize = __esm({
  "../node_modules/date-fns/locale/en-US/_lib/localize.js"() {
    init_buildLocalizeFn();
    eraValues = {
      narrow: ["B", "A"],
      abbreviated: ["BC", "AD"],
      wide: ["Before Christ", "Anno Domini"]
    };
    quarterValues = {
      narrow: ["1", "2", "3", "4"],
      abbreviated: ["Q1", "Q2", "Q3", "Q4"],
      wide: ["1st quarter", "2nd quarter", "3rd quarter", "4th quarter"]
    };
    monthValues = {
      narrow: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
      abbreviated: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
      ],
      wide: [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
      ]
    };
    dayValues = {
      narrow: ["S", "M", "T", "W", "T", "F", "S"],
      short: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
      abbreviated: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      wide: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
      ]
    };
    dayPeriodValues = {
      narrow: {
        am: "a",
        pm: "p",
        midnight: "mi",
        noon: "n",
        morning: "morning",
        afternoon: "afternoon",
        evening: "evening",
        night: "night"
      },
      abbreviated: {
        am: "AM",
        pm: "PM",
        midnight: "midnight",
        noon: "noon",
        morning: "morning",
        afternoon: "afternoon",
        evening: "evening",
        night: "night"
      },
      wide: {
        am: "a.m.",
        pm: "p.m.",
        midnight: "midnight",
        noon: "noon",
        morning: "morning",
        afternoon: "afternoon",
        evening: "evening",
        night: "night"
      }
    };
    formattingDayPeriodValues = {
      narrow: {
        am: "a",
        pm: "p",
        midnight: "mi",
        noon: "n",
        morning: "in the morning",
        afternoon: "in the afternoon",
        evening: "in the evening",
        night: "at night"
      },
      abbreviated: {
        am: "AM",
        pm: "PM",
        midnight: "midnight",
        noon: "noon",
        morning: "in the morning",
        afternoon: "in the afternoon",
        evening: "in the evening",
        night: "at night"
      },
      wide: {
        am: "a.m.",
        pm: "p.m.",
        midnight: "midnight",
        noon: "noon",
        morning: "in the morning",
        afternoon: "in the afternoon",
        evening: "in the evening",
        night: "at night"
      }
    };
    ordinalNumber = (dirtyNumber, _options) => {
      const number = Number(dirtyNumber);
      const rem100 = number % 100;
      if (rem100 > 20 || rem100 < 10) {
        switch (rem100 % 10) {
          case 1:
            return number + "st";
          case 2:
            return number + "nd";
          case 3:
            return number + "rd";
        }
      }
      return number + "th";
    };
    localize = {
      ordinalNumber,
      era: buildLocalizeFn({
        values: eraValues,
        defaultWidth: "wide"
      }),
      quarter: buildLocalizeFn({
        values: quarterValues,
        defaultWidth: "wide",
        argumentCallback: (quarter) => quarter - 1
      }),
      month: buildLocalizeFn({
        values: monthValues,
        defaultWidth: "wide"
      }),
      day: buildLocalizeFn({
        values: dayValues,
        defaultWidth: "wide"
      }),
      dayPeriod: buildLocalizeFn({
        values: dayPeriodValues,
        defaultWidth: "wide",
        formattingValues: formattingDayPeriodValues,
        defaultFormattingWidth: "wide"
      })
    };
  }
});

// ../node_modules/date-fns/locale/_lib/buildMatchFn.js
function buildMatchFn(args) {
  return (string, options = {}) => {
    const width = options.width;
    const matchPattern = width && args.matchPatterns[width] || args.matchPatterns[args.defaultMatchWidth];
    const matchResult = string.match(matchPattern);
    if (!matchResult) {
      return null;
    }
    const matchedString = matchResult[0];
    const parsePatterns = width && args.parsePatterns[width] || args.parsePatterns[args.defaultParseWidth];
    const key = Array.isArray(parsePatterns) ? findIndex(parsePatterns, (pattern) => pattern.test(matchedString)) : (
      // [TODO] -- I challenge you to fix the type
      findKey(parsePatterns, (pattern) => pattern.test(matchedString))
    );
    let value;
    value = args.valueCallback ? args.valueCallback(key) : key;
    value = options.valueCallback ? (
      // [TODO] -- I challenge you to fix the type
      options.valueCallback(value)
    ) : value;
    const rest = string.slice(matchedString.length);
    return { value, rest };
  };
}
function findKey(object, predicate) {
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key) && predicate(object[key])) {
      return key;
    }
  }
  return void 0;
}
function findIndex(array, predicate) {
  for (let key = 0; key < array.length; key++) {
    if (predicate(array[key])) {
      return key;
    }
  }
  return void 0;
}
var init_buildMatchFn = __esm({
  "../node_modules/date-fns/locale/_lib/buildMatchFn.js"() {
  }
});

// ../node_modules/date-fns/locale/_lib/buildMatchPatternFn.js
function buildMatchPatternFn(args) {
  return (string, options = {}) => {
    const matchResult = string.match(args.matchPattern);
    if (!matchResult) return null;
    const matchedString = matchResult[0];
    const parseResult = string.match(args.parsePattern);
    if (!parseResult) return null;
    let value = args.valueCallback ? args.valueCallback(parseResult[0]) : parseResult[0];
    value = options.valueCallback ? options.valueCallback(value) : value;
    const rest = string.slice(matchedString.length);
    return { value, rest };
  };
}
var init_buildMatchPatternFn = __esm({
  "../node_modules/date-fns/locale/_lib/buildMatchPatternFn.js"() {
  }
});

// ../node_modules/date-fns/locale/en-US/_lib/match.js
var matchOrdinalNumberPattern, parseOrdinalNumberPattern, matchEraPatterns, parseEraPatterns, matchQuarterPatterns, parseQuarterPatterns, matchMonthPatterns, parseMonthPatterns, matchDayPatterns, parseDayPatterns, matchDayPeriodPatterns, parseDayPeriodPatterns, match;
var init_match = __esm({
  "../node_modules/date-fns/locale/en-US/_lib/match.js"() {
    init_buildMatchFn();
    init_buildMatchPatternFn();
    matchOrdinalNumberPattern = /^(\d+)(th|st|nd|rd)?/i;
    parseOrdinalNumberPattern = /\d+/i;
    matchEraPatterns = {
      narrow: /^(b|a)/i,
      abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
      wide: /^(before christ|before common era|anno domini|common era)/i
    };
    parseEraPatterns = {
      any: [/^b/i, /^(a|c)/i]
    };
    matchQuarterPatterns = {
      narrow: /^[1234]/i,
      abbreviated: /^q[1234]/i,
      wide: /^[1234](th|st|nd|rd)? quarter/i
    };
    parseQuarterPatterns = {
      any: [/1/i, /2/i, /3/i, /4/i]
    };
    matchMonthPatterns = {
      narrow: /^[jfmasond]/i,
      abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
      wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
    };
    parseMonthPatterns = {
      narrow: [
        /^j/i,
        /^f/i,
        /^m/i,
        /^a/i,
        /^m/i,
        /^j/i,
        /^j/i,
        /^a/i,
        /^s/i,
        /^o/i,
        /^n/i,
        /^d/i
      ],
      any: [
        /^ja/i,
        /^f/i,
        /^mar/i,
        /^ap/i,
        /^may/i,
        /^jun/i,
        /^jul/i,
        /^au/i,
        /^s/i,
        /^o/i,
        /^n/i,
        /^d/i
      ]
    };
    matchDayPatterns = {
      narrow: /^[smtwf]/i,
      short: /^(su|mo|tu|we|th|fr|sa)/i,
      abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
      wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
    };
    parseDayPatterns = {
      narrow: [/^s/i, /^m/i, /^t/i, /^w/i, /^t/i, /^f/i, /^s/i],
      any: [/^su/i, /^m/i, /^tu/i, /^w/i, /^th/i, /^f/i, /^sa/i]
    };
    matchDayPeriodPatterns = {
      narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
      any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
    };
    parseDayPeriodPatterns = {
      any: {
        am: /^a/i,
        pm: /^p/i,
        midnight: /^mi/i,
        noon: /^no/i,
        morning: /morning/i,
        afternoon: /afternoon/i,
        evening: /evening/i,
        night: /night/i
      }
    };
    match = {
      ordinalNumber: buildMatchPatternFn({
        matchPattern: matchOrdinalNumberPattern,
        parsePattern: parseOrdinalNumberPattern,
        valueCallback: (value) => parseInt(value, 10)
      }),
      era: buildMatchFn({
        matchPatterns: matchEraPatterns,
        defaultMatchWidth: "wide",
        parsePatterns: parseEraPatterns,
        defaultParseWidth: "any"
      }),
      quarter: buildMatchFn({
        matchPatterns: matchQuarterPatterns,
        defaultMatchWidth: "wide",
        parsePatterns: parseQuarterPatterns,
        defaultParseWidth: "any",
        valueCallback: (index) => index + 1
      }),
      month: buildMatchFn({
        matchPatterns: matchMonthPatterns,
        defaultMatchWidth: "wide",
        parsePatterns: parseMonthPatterns,
        defaultParseWidth: "any"
      }),
      day: buildMatchFn({
        matchPatterns: matchDayPatterns,
        defaultMatchWidth: "wide",
        parsePatterns: parseDayPatterns,
        defaultParseWidth: "any"
      }),
      dayPeriod: buildMatchFn({
        matchPatterns: matchDayPeriodPatterns,
        defaultMatchWidth: "any",
        parsePatterns: parseDayPeriodPatterns,
        defaultParseWidth: "any"
      })
    };
  }
});

// ../node_modules/date-fns/locale/en-US.js
var enUS;
var init_en_US = __esm({
  "../node_modules/date-fns/locale/en-US.js"() {
    init_formatDistance();
    init_formatLong();
    init_formatRelative();
    init_localize();
    init_match();
    enUS = {
      code: "en-US",
      formatDistance,
      formatLong,
      formatRelative,
      localize,
      match,
      options: {
        weekStartsOn: 0,
        firstWeekContainsDate: 1
      }
    };
  }
});

// ../node_modules/date-fns/_lib/defaultLocale.js
var init_defaultLocale = __esm({
  "../node_modules/date-fns/_lib/defaultLocale.js"() {
    init_en_US();
  }
});

// ../node_modules/date-fns/_lib/defaultOptions.js
function getDefaultOptions() {
  return defaultOptions;
}
var defaultOptions;
var init_defaultOptions = __esm({
  "../node_modules/date-fns/_lib/defaultOptions.js"() {
    defaultOptions = {};
  }
});

// ../node_modules/date-fns/constants.js
var daysInYear, maxTime, minTime, millisecondsInWeek, millisecondsInDay, secondsInHour, secondsInDay, secondsInWeek, secondsInYear, secondsInMonth, secondsInQuarter, constructFromSymbol;
var init_constants = __esm({
  "../node_modules/date-fns/constants.js"() {
    daysInYear = 365.2425;
    maxTime = Math.pow(10, 8) * 24 * 60 * 60 * 1e3;
    minTime = -maxTime;
    millisecondsInWeek = 6048e5;
    millisecondsInDay = 864e5;
    secondsInHour = 3600;
    secondsInDay = secondsInHour * 24;
    secondsInWeek = secondsInDay * 7;
    secondsInYear = secondsInDay * daysInYear;
    secondsInMonth = secondsInYear / 12;
    secondsInQuarter = secondsInMonth * 3;
    constructFromSymbol = Symbol.for("constructDateFrom");
  }
});

// ../node_modules/date-fns/constructFrom.js
function constructFrom(date, value) {
  if (typeof date === "function") return date(value);
  if (date && typeof date === "object" && constructFromSymbol in date)
    return date[constructFromSymbol](value);
  if (date instanceof Date) return new date.constructor(value);
  return new Date(value);
}
var init_constructFrom = __esm({
  "../node_modules/date-fns/constructFrom.js"() {
    init_constants();
  }
});

// ../node_modules/date-fns/toDate.js
function toDate(argument, context) {
  return constructFrom(context || argument, argument);
}
var init_toDate = __esm({
  "../node_modules/date-fns/toDate.js"() {
    init_constructFrom();
  }
});

// ../node_modules/date-fns/_lib/getTimezoneOffsetInMilliseconds.js
function getTimezoneOffsetInMilliseconds(date) {
  const _date = toDate(date);
  const utcDate = new Date(
    Date.UTC(
      _date.getFullYear(),
      _date.getMonth(),
      _date.getDate(),
      _date.getHours(),
      _date.getMinutes(),
      _date.getSeconds(),
      _date.getMilliseconds()
    )
  );
  utcDate.setUTCFullYear(_date.getFullYear());
  return +date - +utcDate;
}
var init_getTimezoneOffsetInMilliseconds = __esm({
  "../node_modules/date-fns/_lib/getTimezoneOffsetInMilliseconds.js"() {
    init_toDate();
  }
});

// ../node_modules/date-fns/_lib/normalizeDates.js
function normalizeDates(context, ...dates) {
  const normalize = constructFrom.bind(
    null,
    context || dates.find((date) => typeof date === "object")
  );
  return dates.map(normalize);
}
var init_normalizeDates = __esm({
  "../node_modules/date-fns/_lib/normalizeDates.js"() {
    init_constructFrom();
  }
});

// ../node_modules/date-fns/startOfDay.js
function startOfDay(date, options) {
  const _date = toDate(date, options?.in);
  _date.setHours(0, 0, 0, 0);
  return _date;
}
var init_startOfDay = __esm({
  "../node_modules/date-fns/startOfDay.js"() {
    init_toDate();
  }
});

// ../node_modules/date-fns/differenceInCalendarDays.js
function differenceInCalendarDays(laterDate, earlierDate, options) {
  const [laterDate_, earlierDate_] = normalizeDates(
    options?.in,
    laterDate,
    earlierDate
  );
  const laterStartOfDay = startOfDay(laterDate_);
  const earlierStartOfDay = startOfDay(earlierDate_);
  const laterTimestamp = +laterStartOfDay - getTimezoneOffsetInMilliseconds(laterStartOfDay);
  const earlierTimestamp = +earlierStartOfDay - getTimezoneOffsetInMilliseconds(earlierStartOfDay);
  return Math.round((laterTimestamp - earlierTimestamp) / millisecondsInDay);
}
var init_differenceInCalendarDays = __esm({
  "../node_modules/date-fns/differenceInCalendarDays.js"() {
    init_getTimezoneOffsetInMilliseconds();
    init_normalizeDates();
    init_constants();
    init_startOfDay();
  }
});

// ../node_modules/date-fns/startOfYear.js
function startOfYear(date, options) {
  const date_ = toDate(date, options?.in);
  date_.setFullYear(date_.getFullYear(), 0, 1);
  date_.setHours(0, 0, 0, 0);
  return date_;
}
var init_startOfYear = __esm({
  "../node_modules/date-fns/startOfYear.js"() {
    init_toDate();
  }
});

// ../node_modules/date-fns/getDayOfYear.js
function getDayOfYear(date, options) {
  const _date = toDate(date, options?.in);
  const diff = differenceInCalendarDays(_date, startOfYear(_date));
  const dayOfYear = diff + 1;
  return dayOfYear;
}
var init_getDayOfYear = __esm({
  "../node_modules/date-fns/getDayOfYear.js"() {
    init_differenceInCalendarDays();
    init_startOfYear();
    init_toDate();
  }
});

// ../node_modules/date-fns/startOfWeek.js
function startOfWeek(date, options) {
  const defaultOptions2 = getDefaultOptions();
  const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions2.weekStartsOn ?? defaultOptions2.locale?.options?.weekStartsOn ?? 0;
  const _date = toDate(date, options?.in);
  const day = _date.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  _date.setDate(_date.getDate() - diff);
  _date.setHours(0, 0, 0, 0);
  return _date;
}
var init_startOfWeek = __esm({
  "../node_modules/date-fns/startOfWeek.js"() {
    init_defaultOptions();
    init_toDate();
  }
});

// ../node_modules/date-fns/startOfISOWeek.js
function startOfISOWeek(date, options) {
  return startOfWeek(date, { ...options, weekStartsOn: 1 });
}
var init_startOfISOWeek = __esm({
  "../node_modules/date-fns/startOfISOWeek.js"() {
    init_startOfWeek();
  }
});

// ../node_modules/date-fns/getISOWeekYear.js
function getISOWeekYear(date, options) {
  const _date = toDate(date, options?.in);
  const year = _date.getFullYear();
  const fourthOfJanuaryOfNextYear = constructFrom(_date, 0);
  fourthOfJanuaryOfNextYear.setFullYear(year + 1, 0, 4);
  fourthOfJanuaryOfNextYear.setHours(0, 0, 0, 0);
  const startOfNextYear = startOfISOWeek(fourthOfJanuaryOfNextYear);
  const fourthOfJanuaryOfThisYear = constructFrom(_date, 0);
  fourthOfJanuaryOfThisYear.setFullYear(year, 0, 4);
  fourthOfJanuaryOfThisYear.setHours(0, 0, 0, 0);
  const startOfThisYear = startOfISOWeek(fourthOfJanuaryOfThisYear);
  if (_date.getTime() >= startOfNextYear.getTime()) {
    return year + 1;
  } else if (_date.getTime() >= startOfThisYear.getTime()) {
    return year;
  } else {
    return year - 1;
  }
}
var init_getISOWeekYear = __esm({
  "../node_modules/date-fns/getISOWeekYear.js"() {
    init_constructFrom();
    init_startOfISOWeek();
    init_toDate();
  }
});

// ../node_modules/date-fns/startOfISOWeekYear.js
function startOfISOWeekYear(date, options) {
  const year = getISOWeekYear(date, options);
  const fourthOfJanuary = constructFrom(options?.in || date, 0);
  fourthOfJanuary.setFullYear(year, 0, 4);
  fourthOfJanuary.setHours(0, 0, 0, 0);
  return startOfISOWeek(fourthOfJanuary);
}
var init_startOfISOWeekYear = __esm({
  "../node_modules/date-fns/startOfISOWeekYear.js"() {
    init_constructFrom();
    init_getISOWeekYear();
    init_startOfISOWeek();
  }
});

// ../node_modules/date-fns/getISOWeek.js
function getISOWeek(date, options) {
  const _date = toDate(date, options?.in);
  const diff = +startOfISOWeek(_date) - +startOfISOWeekYear(_date);
  return Math.round(diff / millisecondsInWeek) + 1;
}
var init_getISOWeek = __esm({
  "../node_modules/date-fns/getISOWeek.js"() {
    init_constants();
    init_startOfISOWeek();
    init_startOfISOWeekYear();
    init_toDate();
  }
});

// ../node_modules/date-fns/getWeekYear.js
function getWeekYear(date, options) {
  const _date = toDate(date, options?.in);
  const year = _date.getFullYear();
  const defaultOptions2 = getDefaultOptions();
  const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
  const firstWeekOfNextYear = constructFrom(options?.in || date, 0);
  firstWeekOfNextYear.setFullYear(year + 1, 0, firstWeekContainsDate);
  firstWeekOfNextYear.setHours(0, 0, 0, 0);
  const startOfNextYear = startOfWeek(firstWeekOfNextYear, options);
  const firstWeekOfThisYear = constructFrom(options?.in || date, 0);
  firstWeekOfThisYear.setFullYear(year, 0, firstWeekContainsDate);
  firstWeekOfThisYear.setHours(0, 0, 0, 0);
  const startOfThisYear = startOfWeek(firstWeekOfThisYear, options);
  if (+_date >= +startOfNextYear) {
    return year + 1;
  } else if (+_date >= +startOfThisYear) {
    return year;
  } else {
    return year - 1;
  }
}
var init_getWeekYear = __esm({
  "../node_modules/date-fns/getWeekYear.js"() {
    init_defaultOptions();
    init_constructFrom();
    init_startOfWeek();
    init_toDate();
  }
});

// ../node_modules/date-fns/startOfWeekYear.js
function startOfWeekYear(date, options) {
  const defaultOptions2 = getDefaultOptions();
  const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
  const year = getWeekYear(date, options);
  const firstWeek = constructFrom(options?.in || date, 0);
  firstWeek.setFullYear(year, 0, firstWeekContainsDate);
  firstWeek.setHours(0, 0, 0, 0);
  const _date = startOfWeek(firstWeek, options);
  return _date;
}
var init_startOfWeekYear = __esm({
  "../node_modules/date-fns/startOfWeekYear.js"() {
    init_defaultOptions();
    init_constructFrom();
    init_getWeekYear();
    init_startOfWeek();
  }
});

// ../node_modules/date-fns/getWeek.js
function getWeek(date, options) {
  const _date = toDate(date, options?.in);
  const diff = +startOfWeek(_date, options) - +startOfWeekYear(_date, options);
  return Math.round(diff / millisecondsInWeek) + 1;
}
var init_getWeek = __esm({
  "../node_modules/date-fns/getWeek.js"() {
    init_constants();
    init_startOfWeek();
    init_startOfWeekYear();
    init_toDate();
  }
});

// ../node_modules/date-fns/_lib/addLeadingZeros.js
function addLeadingZeros(number, targetLength) {
  const sign = number < 0 ? "-" : "";
  const output = Math.abs(number).toString().padStart(targetLength, "0");
  return sign + output;
}
var init_addLeadingZeros = __esm({
  "../node_modules/date-fns/_lib/addLeadingZeros.js"() {
  }
});

// ../node_modules/date-fns/_lib/format/lightFormatters.js
var lightFormatters;
var init_lightFormatters = __esm({
  "../node_modules/date-fns/_lib/format/lightFormatters.js"() {
    init_addLeadingZeros();
    lightFormatters = {
      // Year
      y(date, token) {
        const signedYear = date.getFullYear();
        const year = signedYear > 0 ? signedYear : 1 - signedYear;
        return addLeadingZeros(token === "yy" ? year % 100 : year, token.length);
      },
      // Month
      M(date, token) {
        const month = date.getMonth();
        return token === "M" ? String(month + 1) : addLeadingZeros(month + 1, 2);
      },
      // Day of the month
      d(date, token) {
        return addLeadingZeros(date.getDate(), token.length);
      },
      // AM or PM
      a(date, token) {
        const dayPeriodEnumValue = date.getHours() / 12 >= 1 ? "pm" : "am";
        switch (token) {
          case "a":
          case "aa":
            return dayPeriodEnumValue.toUpperCase();
          case "aaa":
            return dayPeriodEnumValue;
          case "aaaaa":
            return dayPeriodEnumValue[0];
          case "aaaa":
          default:
            return dayPeriodEnumValue === "am" ? "a.m." : "p.m.";
        }
      },
      // Hour [1-12]
      h(date, token) {
        return addLeadingZeros(date.getHours() % 12 || 12, token.length);
      },
      // Hour [0-23]
      H(date, token) {
        return addLeadingZeros(date.getHours(), token.length);
      },
      // Minute
      m(date, token) {
        return addLeadingZeros(date.getMinutes(), token.length);
      },
      // Second
      s(date, token) {
        return addLeadingZeros(date.getSeconds(), token.length);
      },
      // Fraction of second
      S(date, token) {
        const numberOfDigits = token.length;
        const milliseconds = date.getMilliseconds();
        const fractionalSeconds = Math.trunc(
          milliseconds * Math.pow(10, numberOfDigits - 3)
        );
        return addLeadingZeros(fractionalSeconds, token.length);
      }
    };
  }
});

// ../node_modules/date-fns/_lib/format/formatters.js
function formatTimezoneShort(offset, delimiter = "") {
  const sign = offset > 0 ? "-" : "+";
  const absOffset = Math.abs(offset);
  const hours = Math.trunc(absOffset / 60);
  const minutes = absOffset % 60;
  if (minutes === 0) {
    return sign + String(hours);
  }
  return sign + String(hours) + delimiter + addLeadingZeros(minutes, 2);
}
function formatTimezoneWithOptionalMinutes(offset, delimiter) {
  if (offset % 60 === 0) {
    const sign = offset > 0 ? "-" : "+";
    return sign + addLeadingZeros(Math.abs(offset) / 60, 2);
  }
  return formatTimezone(offset, delimiter);
}
function formatTimezone(offset, delimiter = "") {
  const sign = offset > 0 ? "-" : "+";
  const absOffset = Math.abs(offset);
  const hours = addLeadingZeros(Math.trunc(absOffset / 60), 2);
  const minutes = addLeadingZeros(absOffset % 60, 2);
  return sign + hours + delimiter + minutes;
}
var dayPeriodEnum, formatters;
var init_formatters = __esm({
  "../node_modules/date-fns/_lib/format/formatters.js"() {
    init_getDayOfYear();
    init_getISOWeek();
    init_getISOWeekYear();
    init_getWeek();
    init_getWeekYear();
    init_addLeadingZeros();
    init_lightFormatters();
    dayPeriodEnum = {
      am: "am",
      pm: "pm",
      midnight: "midnight",
      noon: "noon",
      morning: "morning",
      afternoon: "afternoon",
      evening: "evening",
      night: "night"
    };
    formatters = {
      // Era
      G: function(date, token, localize2) {
        const era = date.getFullYear() > 0 ? 1 : 0;
        switch (token) {
          // AD, BC
          case "G":
          case "GG":
          case "GGG":
            return localize2.era(era, { width: "abbreviated" });
          // A, B
          case "GGGGG":
            return localize2.era(era, { width: "narrow" });
          // Anno Domini, Before Christ
          case "GGGG":
          default:
            return localize2.era(era, { width: "wide" });
        }
      },
      // Year
      y: function(date, token, localize2) {
        if (token === "yo") {
          const signedYear = date.getFullYear();
          const year = signedYear > 0 ? signedYear : 1 - signedYear;
          return localize2.ordinalNumber(year, { unit: "year" });
        }
        return lightFormatters.y(date, token);
      },
      // Local week-numbering year
      Y: function(date, token, localize2, options) {
        const signedWeekYear = getWeekYear(date, options);
        const weekYear = signedWeekYear > 0 ? signedWeekYear : 1 - signedWeekYear;
        if (token === "YY") {
          const twoDigitYear = weekYear % 100;
          return addLeadingZeros(twoDigitYear, 2);
        }
        if (token === "Yo") {
          return localize2.ordinalNumber(weekYear, { unit: "year" });
        }
        return addLeadingZeros(weekYear, token.length);
      },
      // ISO week-numbering year
      R: function(date, token) {
        const isoWeekYear = getISOWeekYear(date);
        return addLeadingZeros(isoWeekYear, token.length);
      },
      // Extended year. This is a single number designating the year of this calendar system.
      // The main difference between `y` and `u` localizers are B.C. years:
      // | Year | `y` | `u` |
      // |------|-----|-----|
      // | AC 1 |   1 |   1 |
      // | BC 1 |   1 |   0 |
      // | BC 2 |   2 |  -1 |
      // Also `yy` always returns the last two digits of a year,
      // while `uu` pads single digit years to 2 characters and returns other years unchanged.
      u: function(date, token) {
        const year = date.getFullYear();
        return addLeadingZeros(year, token.length);
      },
      // Quarter
      Q: function(date, token, localize2) {
        const quarter = Math.ceil((date.getMonth() + 1) / 3);
        switch (token) {
          // 1, 2, 3, 4
          case "Q":
            return String(quarter);
          // 01, 02, 03, 04
          case "QQ":
            return addLeadingZeros(quarter, 2);
          // 1st, 2nd, 3rd, 4th
          case "Qo":
            return localize2.ordinalNumber(quarter, { unit: "quarter" });
          // Q1, Q2, Q3, Q4
          case "QQQ":
            return localize2.quarter(quarter, {
              width: "abbreviated",
              context: "formatting"
            });
          // 1, 2, 3, 4 (narrow quarter; could be not numerical)
          case "QQQQQ":
            return localize2.quarter(quarter, {
              width: "narrow",
              context: "formatting"
            });
          // 1st quarter, 2nd quarter, ...
          case "QQQQ":
          default:
            return localize2.quarter(quarter, {
              width: "wide",
              context: "formatting"
            });
        }
      },
      // Stand-alone quarter
      q: function(date, token, localize2) {
        const quarter = Math.ceil((date.getMonth() + 1) / 3);
        switch (token) {
          // 1, 2, 3, 4
          case "q":
            return String(quarter);
          // 01, 02, 03, 04
          case "qq":
            return addLeadingZeros(quarter, 2);
          // 1st, 2nd, 3rd, 4th
          case "qo":
            return localize2.ordinalNumber(quarter, { unit: "quarter" });
          // Q1, Q2, Q3, Q4
          case "qqq":
            return localize2.quarter(quarter, {
              width: "abbreviated",
              context: "standalone"
            });
          // 1, 2, 3, 4 (narrow quarter; could be not numerical)
          case "qqqqq":
            return localize2.quarter(quarter, {
              width: "narrow",
              context: "standalone"
            });
          // 1st quarter, 2nd quarter, ...
          case "qqqq":
          default:
            return localize2.quarter(quarter, {
              width: "wide",
              context: "standalone"
            });
        }
      },
      // Month
      M: function(date, token, localize2) {
        const month = date.getMonth();
        switch (token) {
          case "M":
          case "MM":
            return lightFormatters.M(date, token);
          // 1st, 2nd, ..., 12th
          case "Mo":
            return localize2.ordinalNumber(month + 1, { unit: "month" });
          // Jan, Feb, ..., Dec
          case "MMM":
            return localize2.month(month, {
              width: "abbreviated",
              context: "formatting"
            });
          // J, F, ..., D
          case "MMMMM":
            return localize2.month(month, {
              width: "narrow",
              context: "formatting"
            });
          // January, February, ..., December
          case "MMMM":
          default:
            return localize2.month(month, { width: "wide", context: "formatting" });
        }
      },
      // Stand-alone month
      L: function(date, token, localize2) {
        const month = date.getMonth();
        switch (token) {
          // 1, 2, ..., 12
          case "L":
            return String(month + 1);
          // 01, 02, ..., 12
          case "LL":
            return addLeadingZeros(month + 1, 2);
          // 1st, 2nd, ..., 12th
          case "Lo":
            return localize2.ordinalNumber(month + 1, { unit: "month" });
          // Jan, Feb, ..., Dec
          case "LLL":
            return localize2.month(month, {
              width: "abbreviated",
              context: "standalone"
            });
          // J, F, ..., D
          case "LLLLL":
            return localize2.month(month, {
              width: "narrow",
              context: "standalone"
            });
          // January, February, ..., December
          case "LLLL":
          default:
            return localize2.month(month, { width: "wide", context: "standalone" });
        }
      },
      // Local week of year
      w: function(date, token, localize2, options) {
        const week = getWeek(date, options);
        if (token === "wo") {
          return localize2.ordinalNumber(week, { unit: "week" });
        }
        return addLeadingZeros(week, token.length);
      },
      // ISO week of year
      I: function(date, token, localize2) {
        const isoWeek = getISOWeek(date);
        if (token === "Io") {
          return localize2.ordinalNumber(isoWeek, { unit: "week" });
        }
        return addLeadingZeros(isoWeek, token.length);
      },
      // Day of the month
      d: function(date, token, localize2) {
        if (token === "do") {
          return localize2.ordinalNumber(date.getDate(), { unit: "date" });
        }
        return lightFormatters.d(date, token);
      },
      // Day of year
      D: function(date, token, localize2) {
        const dayOfYear = getDayOfYear(date);
        if (token === "Do") {
          return localize2.ordinalNumber(dayOfYear, { unit: "dayOfYear" });
        }
        return addLeadingZeros(dayOfYear, token.length);
      },
      // Day of week
      E: function(date, token, localize2) {
        const dayOfWeek = date.getDay();
        switch (token) {
          // Tue
          case "E":
          case "EE":
          case "EEE":
            return localize2.day(dayOfWeek, {
              width: "abbreviated",
              context: "formatting"
            });
          // T
          case "EEEEE":
            return localize2.day(dayOfWeek, {
              width: "narrow",
              context: "formatting"
            });
          // Tu
          case "EEEEEE":
            return localize2.day(dayOfWeek, {
              width: "short",
              context: "formatting"
            });
          // Tuesday
          case "EEEE":
          default:
            return localize2.day(dayOfWeek, {
              width: "wide",
              context: "formatting"
            });
        }
      },
      // Local day of week
      e: function(date, token, localize2, options) {
        const dayOfWeek = date.getDay();
        const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
        switch (token) {
          // Numerical value (Nth day of week with current locale or weekStartsOn)
          case "e":
            return String(localDayOfWeek);
          // Padded numerical value
          case "ee":
            return addLeadingZeros(localDayOfWeek, 2);
          // 1st, 2nd, ..., 7th
          case "eo":
            return localize2.ordinalNumber(localDayOfWeek, { unit: "day" });
          case "eee":
            return localize2.day(dayOfWeek, {
              width: "abbreviated",
              context: "formatting"
            });
          // T
          case "eeeee":
            return localize2.day(dayOfWeek, {
              width: "narrow",
              context: "formatting"
            });
          // Tu
          case "eeeeee":
            return localize2.day(dayOfWeek, {
              width: "short",
              context: "formatting"
            });
          // Tuesday
          case "eeee":
          default:
            return localize2.day(dayOfWeek, {
              width: "wide",
              context: "formatting"
            });
        }
      },
      // Stand-alone local day of week
      c: function(date, token, localize2, options) {
        const dayOfWeek = date.getDay();
        const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
        switch (token) {
          // Numerical value (same as in `e`)
          case "c":
            return String(localDayOfWeek);
          // Padded numerical value
          case "cc":
            return addLeadingZeros(localDayOfWeek, token.length);
          // 1st, 2nd, ..., 7th
          case "co":
            return localize2.ordinalNumber(localDayOfWeek, { unit: "day" });
          case "ccc":
            return localize2.day(dayOfWeek, {
              width: "abbreviated",
              context: "standalone"
            });
          // T
          case "ccccc":
            return localize2.day(dayOfWeek, {
              width: "narrow",
              context: "standalone"
            });
          // Tu
          case "cccccc":
            return localize2.day(dayOfWeek, {
              width: "short",
              context: "standalone"
            });
          // Tuesday
          case "cccc":
          default:
            return localize2.day(dayOfWeek, {
              width: "wide",
              context: "standalone"
            });
        }
      },
      // ISO day of week
      i: function(date, token, localize2) {
        const dayOfWeek = date.getDay();
        const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
        switch (token) {
          // 2
          case "i":
            return String(isoDayOfWeek);
          // 02
          case "ii":
            return addLeadingZeros(isoDayOfWeek, token.length);
          // 2nd
          case "io":
            return localize2.ordinalNumber(isoDayOfWeek, { unit: "day" });
          // Tue
          case "iii":
            return localize2.day(dayOfWeek, {
              width: "abbreviated",
              context: "formatting"
            });
          // T
          case "iiiii":
            return localize2.day(dayOfWeek, {
              width: "narrow",
              context: "formatting"
            });
          // Tu
          case "iiiiii":
            return localize2.day(dayOfWeek, {
              width: "short",
              context: "formatting"
            });
          // Tuesday
          case "iiii":
          default:
            return localize2.day(dayOfWeek, {
              width: "wide",
              context: "formatting"
            });
        }
      },
      // AM or PM
      a: function(date, token, localize2) {
        const hours = date.getHours();
        const dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
        switch (token) {
          case "a":
          case "aa":
            return localize2.dayPeriod(dayPeriodEnumValue, {
              width: "abbreviated",
              context: "formatting"
            });
          case "aaa":
            return localize2.dayPeriod(dayPeriodEnumValue, {
              width: "abbreviated",
              context: "formatting"
            }).toLowerCase();
          case "aaaaa":
            return localize2.dayPeriod(dayPeriodEnumValue, {
              width: "narrow",
              context: "formatting"
            });
          case "aaaa":
          default:
            return localize2.dayPeriod(dayPeriodEnumValue, {
              width: "wide",
              context: "formatting"
            });
        }
      },
      // AM, PM, midnight, noon
      b: function(date, token, localize2) {
        const hours = date.getHours();
        let dayPeriodEnumValue;
        if (hours === 12) {
          dayPeriodEnumValue = dayPeriodEnum.noon;
        } else if (hours === 0) {
          dayPeriodEnumValue = dayPeriodEnum.midnight;
        } else {
          dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
        }
        switch (token) {
          case "b":
          case "bb":
            return localize2.dayPeriod(dayPeriodEnumValue, {
              width: "abbreviated",
              context: "formatting"
            });
          case "bbb":
            return localize2.dayPeriod(dayPeriodEnumValue, {
              width: "abbreviated",
              context: "formatting"
            }).toLowerCase();
          case "bbbbb":
            return localize2.dayPeriod(dayPeriodEnumValue, {
              width: "narrow",
              context: "formatting"
            });
          case "bbbb":
          default:
            return localize2.dayPeriod(dayPeriodEnumValue, {
              width: "wide",
              context: "formatting"
            });
        }
      },
      // in the morning, in the afternoon, in the evening, at night
      B: function(date, token, localize2) {
        const hours = date.getHours();
        let dayPeriodEnumValue;
        if (hours >= 17) {
          dayPeriodEnumValue = dayPeriodEnum.evening;
        } else if (hours >= 12) {
          dayPeriodEnumValue = dayPeriodEnum.afternoon;
        } else if (hours >= 4) {
          dayPeriodEnumValue = dayPeriodEnum.morning;
        } else {
          dayPeriodEnumValue = dayPeriodEnum.night;
        }
        switch (token) {
          case "B":
          case "BB":
          case "BBB":
            return localize2.dayPeriod(dayPeriodEnumValue, {
              width: "abbreviated",
              context: "formatting"
            });
          case "BBBBB":
            return localize2.dayPeriod(dayPeriodEnumValue, {
              width: "narrow",
              context: "formatting"
            });
          case "BBBB":
          default:
            return localize2.dayPeriod(dayPeriodEnumValue, {
              width: "wide",
              context: "formatting"
            });
        }
      },
      // Hour [1-12]
      h: function(date, token, localize2) {
        if (token === "ho") {
          let hours = date.getHours() % 12;
          if (hours === 0) hours = 12;
          return localize2.ordinalNumber(hours, { unit: "hour" });
        }
        return lightFormatters.h(date, token);
      },
      // Hour [0-23]
      H: function(date, token, localize2) {
        if (token === "Ho") {
          return localize2.ordinalNumber(date.getHours(), { unit: "hour" });
        }
        return lightFormatters.H(date, token);
      },
      // Hour [0-11]
      K: function(date, token, localize2) {
        const hours = date.getHours() % 12;
        if (token === "Ko") {
          return localize2.ordinalNumber(hours, { unit: "hour" });
        }
        return addLeadingZeros(hours, token.length);
      },
      // Hour [1-24]
      k: function(date, token, localize2) {
        let hours = date.getHours();
        if (hours === 0) hours = 24;
        if (token === "ko") {
          return localize2.ordinalNumber(hours, { unit: "hour" });
        }
        return addLeadingZeros(hours, token.length);
      },
      // Minute
      m: function(date, token, localize2) {
        if (token === "mo") {
          return localize2.ordinalNumber(date.getMinutes(), { unit: "minute" });
        }
        return lightFormatters.m(date, token);
      },
      // Second
      s: function(date, token, localize2) {
        if (token === "so") {
          return localize2.ordinalNumber(date.getSeconds(), { unit: "second" });
        }
        return lightFormatters.s(date, token);
      },
      // Fraction of second
      S: function(date, token) {
        return lightFormatters.S(date, token);
      },
      // Timezone (ISO-8601. If offset is 0, output is always `'Z'`)
      X: function(date, token, _localize) {
        const timezoneOffset = date.getTimezoneOffset();
        if (timezoneOffset === 0) {
          return "Z";
        }
        switch (token) {
          // Hours and optional minutes
          case "X":
            return formatTimezoneWithOptionalMinutes(timezoneOffset);
          // Hours, minutes and optional seconds without `:` delimiter
          // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
          // so this token always has the same output as `XX`
          case "XXXX":
          case "XX":
            return formatTimezone(timezoneOffset);
          // Hours, minutes and optional seconds with `:` delimiter
          // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
          // so this token always has the same output as `XXX`
          case "XXXXX":
          case "XXX":
          // Hours and minutes with `:` delimiter
          default:
            return formatTimezone(timezoneOffset, ":");
        }
      },
      // Timezone (ISO-8601. If offset is 0, output is `'+00:00'` or equivalent)
      x: function(date, token, _localize) {
        const timezoneOffset = date.getTimezoneOffset();
        switch (token) {
          // Hours and optional minutes
          case "x":
            return formatTimezoneWithOptionalMinutes(timezoneOffset);
          // Hours, minutes and optional seconds without `:` delimiter
          // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
          // so this token always has the same output as `xx`
          case "xxxx":
          case "xx":
            return formatTimezone(timezoneOffset);
          // Hours, minutes and optional seconds with `:` delimiter
          // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
          // so this token always has the same output as `xxx`
          case "xxxxx":
          case "xxx":
          // Hours and minutes with `:` delimiter
          default:
            return formatTimezone(timezoneOffset, ":");
        }
      },
      // Timezone (GMT)
      O: function(date, token, _localize) {
        const timezoneOffset = date.getTimezoneOffset();
        switch (token) {
          // Short
          case "O":
          case "OO":
          case "OOO":
            return "GMT" + formatTimezoneShort(timezoneOffset, ":");
          // Long
          case "OOOO":
          default:
            return "GMT" + formatTimezone(timezoneOffset, ":");
        }
      },
      // Timezone (specific non-location)
      z: function(date, token, _localize) {
        const timezoneOffset = date.getTimezoneOffset();
        switch (token) {
          // Short
          case "z":
          case "zz":
          case "zzz":
            return "GMT" + formatTimezoneShort(timezoneOffset, ":");
          // Long
          case "zzzz":
          default:
            return "GMT" + formatTimezone(timezoneOffset, ":");
        }
      },
      // Seconds timestamp
      t: function(date, token, _localize) {
        const timestamp = Math.trunc(+date / 1e3);
        return addLeadingZeros(timestamp, token.length);
      },
      // Milliseconds timestamp
      T: function(date, token, _localize) {
        return addLeadingZeros(+date, token.length);
      }
    };
  }
});

// ../node_modules/date-fns/_lib/format/longFormatters.js
var dateLongFormatter, timeLongFormatter, dateTimeLongFormatter, longFormatters;
var init_longFormatters = __esm({
  "../node_modules/date-fns/_lib/format/longFormatters.js"() {
    dateLongFormatter = (pattern, formatLong2) => {
      switch (pattern) {
        case "P":
          return formatLong2.date({ width: "short" });
        case "PP":
          return formatLong2.date({ width: "medium" });
        case "PPP":
          return formatLong2.date({ width: "long" });
        case "PPPP":
        default:
          return formatLong2.date({ width: "full" });
      }
    };
    timeLongFormatter = (pattern, formatLong2) => {
      switch (pattern) {
        case "p":
          return formatLong2.time({ width: "short" });
        case "pp":
          return formatLong2.time({ width: "medium" });
        case "ppp":
          return formatLong2.time({ width: "long" });
        case "pppp":
        default:
          return formatLong2.time({ width: "full" });
      }
    };
    dateTimeLongFormatter = (pattern, formatLong2) => {
      const matchResult = pattern.match(/(P+)(p+)?/) || [];
      const datePattern = matchResult[1];
      const timePattern = matchResult[2];
      if (!timePattern) {
        return dateLongFormatter(pattern, formatLong2);
      }
      let dateTimeFormat;
      switch (datePattern) {
        case "P":
          dateTimeFormat = formatLong2.dateTime({ width: "short" });
          break;
        case "PP":
          dateTimeFormat = formatLong2.dateTime({ width: "medium" });
          break;
        case "PPP":
          dateTimeFormat = formatLong2.dateTime({ width: "long" });
          break;
        case "PPPP":
        default:
          dateTimeFormat = formatLong2.dateTime({ width: "full" });
          break;
      }
      return dateTimeFormat.replace("{{date}}", dateLongFormatter(datePattern, formatLong2)).replace("{{time}}", timeLongFormatter(timePattern, formatLong2));
    };
    longFormatters = {
      p: timeLongFormatter,
      P: dateTimeLongFormatter
    };
  }
});

// ../node_modules/date-fns/_lib/protectedTokens.js
function isProtectedDayOfYearToken(token) {
  return dayOfYearTokenRE.test(token);
}
function isProtectedWeekYearToken(token) {
  return weekYearTokenRE.test(token);
}
function warnOrThrowProtectedError(token, format3, input) {
  const _message = message(token, format3, input);
  if (throwTokens.includes(token)) throw new RangeError(_message);
}
function message(token, format3, input) {
  const subject = token[0] === "Y" ? "years" : "days of the month";
  return `Use \`${token.toLowerCase()}\` instead of \`${token}\` (in \`${format3}\`) for formatting ${subject} to the input \`${input}\`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md`;
}
var dayOfYearTokenRE, weekYearTokenRE, throwTokens;
var init_protectedTokens = __esm({
  "../node_modules/date-fns/_lib/protectedTokens.js"() {
    dayOfYearTokenRE = /^D+$/;
    weekYearTokenRE = /^Y+$/;
    throwTokens = ["D", "DD", "YY", "YYYY"];
  }
});

// ../node_modules/date-fns/isDate.js
function isDate(value) {
  return value instanceof Date || typeof value === "object" && Object.prototype.toString.call(value) === "[object Date]";
}
var init_isDate = __esm({
  "../node_modules/date-fns/isDate.js"() {
  }
});

// ../node_modules/date-fns/isValid.js
function isValid(date) {
  return !(!isDate(date) && typeof date !== "number" || isNaN(+toDate(date)));
}
var init_isValid = __esm({
  "../node_modules/date-fns/isValid.js"() {
    init_isDate();
    init_toDate();
  }
});

// ../node_modules/date-fns/format.js
function format(date, formatStr, options) {
  const defaultOptions2 = getDefaultOptions();
  const locale = options?.locale ?? defaultOptions2.locale ?? enUS;
  const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
  const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions2.weekStartsOn ?? defaultOptions2.locale?.options?.weekStartsOn ?? 0;
  const originalDate = toDate(date, options?.in);
  if (!isValid(originalDate)) {
    throw new RangeError("Invalid time value");
  }
  let parts = formatStr.match(longFormattingTokensRegExp).map((substring) => {
    const firstCharacter = substring[0];
    if (firstCharacter === "p" || firstCharacter === "P") {
      const longFormatter = longFormatters[firstCharacter];
      return longFormatter(substring, locale.formatLong);
    }
    return substring;
  }).join("").match(formattingTokensRegExp).map((substring) => {
    if (substring === "''") {
      return { isToken: false, value: "'" };
    }
    const firstCharacter = substring[0];
    if (firstCharacter === "'") {
      return { isToken: false, value: cleanEscapedString(substring) };
    }
    if (formatters[firstCharacter]) {
      return { isToken: true, value: substring };
    }
    if (firstCharacter.match(unescapedLatinCharacterRegExp)) {
      throw new RangeError(
        "Format string contains an unescaped latin alphabet character `" + firstCharacter + "`"
      );
    }
    return { isToken: false, value: substring };
  });
  if (locale.localize.preprocessor) {
    parts = locale.localize.preprocessor(originalDate, parts);
  }
  const formatterOptions = {
    firstWeekContainsDate,
    weekStartsOn,
    locale
  };
  return parts.map((part) => {
    if (!part.isToken) return part.value;
    const token = part.value;
    if (!options?.useAdditionalWeekYearTokens && isProtectedWeekYearToken(token) || !options?.useAdditionalDayOfYearTokens && isProtectedDayOfYearToken(token)) {
      warnOrThrowProtectedError(token, formatStr, String(date));
    }
    const formatter = formatters[token[0]];
    return formatter(originalDate, token, locale.localize, formatterOptions);
  }).join("");
}
function cleanEscapedString(input) {
  const matched = input.match(escapedStringRegExp);
  if (!matched) {
    return input;
  }
  return matched[1].replace(doubleQuoteRegExp, "'");
}
var formattingTokensRegExp, longFormattingTokensRegExp, escapedStringRegExp, doubleQuoteRegExp, unescapedLatinCharacterRegExp;
var init_format = __esm({
  "../node_modules/date-fns/format.js"() {
    init_defaultLocale();
    init_defaultOptions();
    init_formatters();
    init_longFormatters();
    init_protectedTokens();
    init_isValid();
    init_toDate();
    formattingTokensRegExp = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g;
    longFormattingTokensRegExp = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;
    escapedStringRegExp = /^'([^]*?)'?$/;
    doubleQuoteRegExp = /''/g;
    unescapedLatinCharacterRegExp = /[a-zA-Z]/;
  }
});

// ../node_modules/date-fns/addDays.js
var init_addDays = __esm({
  "../node_modules/date-fns/addDays.js"() {
  }
});

// ../node_modules/date-fns/addMonths.js
var init_addMonths = __esm({
  "../node_modules/date-fns/addMonths.js"() {
  }
});

// ../node_modules/date-fns/add.js
var init_add = __esm({
  "../node_modules/date-fns/add.js"() {
  }
});

// ../node_modules/date-fns/isSaturday.js
var init_isSaturday = __esm({
  "../node_modules/date-fns/isSaturday.js"() {
  }
});

// ../node_modules/date-fns/isSunday.js
var init_isSunday = __esm({
  "../node_modules/date-fns/isSunday.js"() {
  }
});

// ../node_modules/date-fns/isWeekend.js
var init_isWeekend = __esm({
  "../node_modules/date-fns/isWeekend.js"() {
  }
});

// ../node_modules/date-fns/addBusinessDays.js
var init_addBusinessDays = __esm({
  "../node_modules/date-fns/addBusinessDays.js"() {
  }
});

// ../node_modules/date-fns/addMilliseconds.js
var init_addMilliseconds = __esm({
  "../node_modules/date-fns/addMilliseconds.js"() {
  }
});

// ../node_modules/date-fns/addHours.js
var init_addHours = __esm({
  "../node_modules/date-fns/addHours.js"() {
  }
});

// ../node_modules/date-fns/setISOWeekYear.js
var init_setISOWeekYear = __esm({
  "../node_modules/date-fns/setISOWeekYear.js"() {
  }
});

// ../node_modules/date-fns/addISOWeekYears.js
var init_addISOWeekYears = __esm({
  "../node_modules/date-fns/addISOWeekYears.js"() {
  }
});

// ../node_modules/date-fns/addMinutes.js
var init_addMinutes = __esm({
  "../node_modules/date-fns/addMinutes.js"() {
  }
});

// ../node_modules/date-fns/addQuarters.js
var init_addQuarters = __esm({
  "../node_modules/date-fns/addQuarters.js"() {
  }
});

// ../node_modules/date-fns/addSeconds.js
var init_addSeconds = __esm({
  "../node_modules/date-fns/addSeconds.js"() {
  }
});

// ../node_modules/date-fns/addWeeks.js
var init_addWeeks = __esm({
  "../node_modules/date-fns/addWeeks.js"() {
  }
});

// ../node_modules/date-fns/addYears.js
var init_addYears = __esm({
  "../node_modules/date-fns/addYears.js"() {
  }
});

// ../node_modules/date-fns/areIntervalsOverlapping.js
var init_areIntervalsOverlapping = __esm({
  "../node_modules/date-fns/areIntervalsOverlapping.js"() {
  }
});

// ../node_modules/date-fns/max.js
var init_max = __esm({
  "../node_modules/date-fns/max.js"() {
  }
});

// ../node_modules/date-fns/min.js
var init_min = __esm({
  "../node_modules/date-fns/min.js"() {
  }
});

// ../node_modules/date-fns/clamp.js
var init_clamp = __esm({
  "../node_modules/date-fns/clamp.js"() {
  }
});

// ../node_modules/date-fns/closestIndexTo.js
var init_closestIndexTo = __esm({
  "../node_modules/date-fns/closestIndexTo.js"() {
  }
});

// ../node_modules/date-fns/closestTo.js
var init_closestTo = __esm({
  "../node_modules/date-fns/closestTo.js"() {
  }
});

// ../node_modules/date-fns/compareAsc.js
var init_compareAsc = __esm({
  "../node_modules/date-fns/compareAsc.js"() {
  }
});

// ../node_modules/date-fns/compareDesc.js
var init_compareDesc = __esm({
  "../node_modules/date-fns/compareDesc.js"() {
  }
});

// ../node_modules/date-fns/constructNow.js
var init_constructNow = __esm({
  "../node_modules/date-fns/constructNow.js"() {
  }
});

// ../node_modules/date-fns/daysToWeeks.js
var init_daysToWeeks = __esm({
  "../node_modules/date-fns/daysToWeeks.js"() {
  }
});

// ../node_modules/date-fns/isSameDay.js
var init_isSameDay = __esm({
  "../node_modules/date-fns/isSameDay.js"() {
  }
});

// ../node_modules/date-fns/differenceInBusinessDays.js
var init_differenceInBusinessDays = __esm({
  "../node_modules/date-fns/differenceInBusinessDays.js"() {
  }
});

// ../node_modules/date-fns/differenceInCalendarISOWeekYears.js
var init_differenceInCalendarISOWeekYears = __esm({
  "../node_modules/date-fns/differenceInCalendarISOWeekYears.js"() {
  }
});

// ../node_modules/date-fns/differenceInCalendarISOWeeks.js
var init_differenceInCalendarISOWeeks = __esm({
  "../node_modules/date-fns/differenceInCalendarISOWeeks.js"() {
  }
});

// ../node_modules/date-fns/differenceInCalendarMonths.js
var init_differenceInCalendarMonths = __esm({
  "../node_modules/date-fns/differenceInCalendarMonths.js"() {
  }
});

// ../node_modules/date-fns/getQuarter.js
var init_getQuarter = __esm({
  "../node_modules/date-fns/getQuarter.js"() {
  }
});

// ../node_modules/date-fns/differenceInCalendarQuarters.js
var init_differenceInCalendarQuarters = __esm({
  "../node_modules/date-fns/differenceInCalendarQuarters.js"() {
  }
});

// ../node_modules/date-fns/differenceInCalendarWeeks.js
var init_differenceInCalendarWeeks = __esm({
  "../node_modules/date-fns/differenceInCalendarWeeks.js"() {
  }
});

// ../node_modules/date-fns/differenceInCalendarYears.js
var init_differenceInCalendarYears = __esm({
  "../node_modules/date-fns/differenceInCalendarYears.js"() {
  }
});

// ../node_modules/date-fns/differenceInDays.js
var init_differenceInDays = __esm({
  "../node_modules/date-fns/differenceInDays.js"() {
  }
});

// ../node_modules/date-fns/differenceInHours.js
var init_differenceInHours = __esm({
  "../node_modules/date-fns/differenceInHours.js"() {
  }
});

// ../node_modules/date-fns/subISOWeekYears.js
var init_subISOWeekYears = __esm({
  "../node_modules/date-fns/subISOWeekYears.js"() {
  }
});

// ../node_modules/date-fns/differenceInISOWeekYears.js
var init_differenceInISOWeekYears = __esm({
  "../node_modules/date-fns/differenceInISOWeekYears.js"() {
  }
});

// ../node_modules/date-fns/differenceInMilliseconds.js
var init_differenceInMilliseconds = __esm({
  "../node_modules/date-fns/differenceInMilliseconds.js"() {
  }
});

// ../node_modules/date-fns/differenceInMinutes.js
var init_differenceInMinutes = __esm({
  "../node_modules/date-fns/differenceInMinutes.js"() {
  }
});

// ../node_modules/date-fns/endOfDay.js
var init_endOfDay = __esm({
  "../node_modules/date-fns/endOfDay.js"() {
  }
});

// ../node_modules/date-fns/endOfMonth.js
var init_endOfMonth = __esm({
  "../node_modules/date-fns/endOfMonth.js"() {
  }
});

// ../node_modules/date-fns/isLastDayOfMonth.js
var init_isLastDayOfMonth = __esm({
  "../node_modules/date-fns/isLastDayOfMonth.js"() {
  }
});

// ../node_modules/date-fns/differenceInMonths.js
var init_differenceInMonths = __esm({
  "../node_modules/date-fns/differenceInMonths.js"() {
  }
});

// ../node_modules/date-fns/differenceInQuarters.js
var init_differenceInQuarters = __esm({
  "../node_modules/date-fns/differenceInQuarters.js"() {
  }
});

// ../node_modules/date-fns/differenceInSeconds.js
var init_differenceInSeconds = __esm({
  "../node_modules/date-fns/differenceInSeconds.js"() {
  }
});

// ../node_modules/date-fns/differenceInWeeks.js
var init_differenceInWeeks = __esm({
  "../node_modules/date-fns/differenceInWeeks.js"() {
  }
});

// ../node_modules/date-fns/differenceInYears.js
var init_differenceInYears = __esm({
  "../node_modules/date-fns/differenceInYears.js"() {
  }
});

// ../node_modules/date-fns/eachDayOfInterval.js
var init_eachDayOfInterval = __esm({
  "../node_modules/date-fns/eachDayOfInterval.js"() {
  }
});

// ../node_modules/date-fns/eachHourOfInterval.js
var init_eachHourOfInterval = __esm({
  "../node_modules/date-fns/eachHourOfInterval.js"() {
  }
});

// ../node_modules/date-fns/eachMinuteOfInterval.js
var init_eachMinuteOfInterval = __esm({
  "../node_modules/date-fns/eachMinuteOfInterval.js"() {
  }
});

// ../node_modules/date-fns/eachMonthOfInterval.js
var init_eachMonthOfInterval = __esm({
  "../node_modules/date-fns/eachMonthOfInterval.js"() {
  }
});

// ../node_modules/date-fns/startOfQuarter.js
var init_startOfQuarter = __esm({
  "../node_modules/date-fns/startOfQuarter.js"() {
  }
});

// ../node_modules/date-fns/eachQuarterOfInterval.js
var init_eachQuarterOfInterval = __esm({
  "../node_modules/date-fns/eachQuarterOfInterval.js"() {
  }
});

// ../node_modules/date-fns/eachWeekOfInterval.js
var init_eachWeekOfInterval = __esm({
  "../node_modules/date-fns/eachWeekOfInterval.js"() {
  }
});

// ../node_modules/date-fns/eachWeekendOfInterval.js
var init_eachWeekendOfInterval = __esm({
  "../node_modules/date-fns/eachWeekendOfInterval.js"() {
  }
});

// ../node_modules/date-fns/startOfMonth.js
var init_startOfMonth = __esm({
  "../node_modules/date-fns/startOfMonth.js"() {
  }
});

// ../node_modules/date-fns/eachWeekendOfMonth.js
var init_eachWeekendOfMonth = __esm({
  "../node_modules/date-fns/eachWeekendOfMonth.js"() {
  }
});

// ../node_modules/date-fns/endOfYear.js
var init_endOfYear = __esm({
  "../node_modules/date-fns/endOfYear.js"() {
  }
});

// ../node_modules/date-fns/eachWeekendOfYear.js
var init_eachWeekendOfYear = __esm({
  "../node_modules/date-fns/eachWeekendOfYear.js"() {
  }
});

// ../node_modules/date-fns/eachYearOfInterval.js
var init_eachYearOfInterval = __esm({
  "../node_modules/date-fns/eachYearOfInterval.js"() {
  }
});

// ../node_modules/date-fns/endOfDecade.js
var init_endOfDecade = __esm({
  "../node_modules/date-fns/endOfDecade.js"() {
  }
});

// ../node_modules/date-fns/endOfHour.js
var init_endOfHour = __esm({
  "../node_modules/date-fns/endOfHour.js"() {
  }
});

// ../node_modules/date-fns/endOfWeek.js
var init_endOfWeek = __esm({
  "../node_modules/date-fns/endOfWeek.js"() {
  }
});

// ../node_modules/date-fns/endOfISOWeek.js
var init_endOfISOWeek = __esm({
  "../node_modules/date-fns/endOfISOWeek.js"() {
  }
});

// ../node_modules/date-fns/endOfISOWeekYear.js
var init_endOfISOWeekYear = __esm({
  "../node_modules/date-fns/endOfISOWeekYear.js"() {
  }
});

// ../node_modules/date-fns/endOfMinute.js
var init_endOfMinute = __esm({
  "../node_modules/date-fns/endOfMinute.js"() {
  }
});

// ../node_modules/date-fns/endOfQuarter.js
var init_endOfQuarter = __esm({
  "../node_modules/date-fns/endOfQuarter.js"() {
  }
});

// ../node_modules/date-fns/endOfSecond.js
var init_endOfSecond = __esm({
  "../node_modules/date-fns/endOfSecond.js"() {
  }
});

// ../node_modules/date-fns/endOfToday.js
var init_endOfToday = __esm({
  "../node_modules/date-fns/endOfToday.js"() {
  }
});

// ../node_modules/date-fns/endOfTomorrow.js
var init_endOfTomorrow = __esm({
  "../node_modules/date-fns/endOfTomorrow.js"() {
  }
});

// ../node_modules/date-fns/endOfYesterday.js
var init_endOfYesterday = __esm({
  "../node_modules/date-fns/endOfYesterday.js"() {
  }
});

// ../node_modules/date-fns/formatDistance.js
var init_formatDistance2 = __esm({
  "../node_modules/date-fns/formatDistance.js"() {
  }
});

// ../node_modules/date-fns/formatDistanceStrict.js
var init_formatDistanceStrict = __esm({
  "../node_modules/date-fns/formatDistanceStrict.js"() {
  }
});

// ../node_modules/date-fns/formatDistanceToNow.js
var init_formatDistanceToNow = __esm({
  "../node_modules/date-fns/formatDistanceToNow.js"() {
  }
});

// ../node_modules/date-fns/formatDistanceToNowStrict.js
var init_formatDistanceToNowStrict = __esm({
  "../node_modules/date-fns/formatDistanceToNowStrict.js"() {
  }
});

// ../node_modules/date-fns/formatDuration.js
var init_formatDuration = __esm({
  "../node_modules/date-fns/formatDuration.js"() {
  }
});

// ../node_modules/date-fns/formatISO.js
var init_formatISO = __esm({
  "../node_modules/date-fns/formatISO.js"() {
  }
});

// ../node_modules/date-fns/formatISO9075.js
var init_formatISO9075 = __esm({
  "../node_modules/date-fns/formatISO9075.js"() {
  }
});

// ../node_modules/date-fns/formatISODuration.js
var init_formatISODuration = __esm({
  "../node_modules/date-fns/formatISODuration.js"() {
  }
});

// ../node_modules/date-fns/formatRFC3339.js
var init_formatRFC3339 = __esm({
  "../node_modules/date-fns/formatRFC3339.js"() {
  }
});

// ../node_modules/date-fns/formatRFC7231.js
var init_formatRFC7231 = __esm({
  "../node_modules/date-fns/formatRFC7231.js"() {
  }
});

// ../node_modules/date-fns/formatRelative.js
var init_formatRelative2 = __esm({
  "../node_modules/date-fns/formatRelative.js"() {
  }
});

// ../node_modules/date-fns/fromUnixTime.js
var init_fromUnixTime = __esm({
  "../node_modules/date-fns/fromUnixTime.js"() {
  }
});

// ../node_modules/date-fns/getDate.js
var init_getDate = __esm({
  "../node_modules/date-fns/getDate.js"() {
  }
});

// ../node_modules/date-fns/getDay.js
var init_getDay = __esm({
  "../node_modules/date-fns/getDay.js"() {
  }
});

// ../node_modules/date-fns/getDaysInMonth.js
var init_getDaysInMonth = __esm({
  "../node_modules/date-fns/getDaysInMonth.js"() {
  }
});

// ../node_modules/date-fns/isLeapYear.js
var init_isLeapYear = __esm({
  "../node_modules/date-fns/isLeapYear.js"() {
  }
});

// ../node_modules/date-fns/getDaysInYear.js
var init_getDaysInYear = __esm({
  "../node_modules/date-fns/getDaysInYear.js"() {
  }
});

// ../node_modules/date-fns/getDecade.js
var init_getDecade = __esm({
  "../node_modules/date-fns/getDecade.js"() {
  }
});

// ../node_modules/date-fns/getDefaultOptions.js
function getDefaultOptions2() {
  return Object.assign({}, getDefaultOptions());
}
var init_getDefaultOptions = __esm({
  "../node_modules/date-fns/getDefaultOptions.js"() {
    init_defaultOptions();
  }
});

// ../node_modules/date-fns/getHours.js
var init_getHours = __esm({
  "../node_modules/date-fns/getHours.js"() {
  }
});

// ../node_modules/date-fns/getISODay.js
var init_getISODay = __esm({
  "../node_modules/date-fns/getISODay.js"() {
  }
});

// ../node_modules/date-fns/getISOWeeksInYear.js
var init_getISOWeeksInYear = __esm({
  "../node_modules/date-fns/getISOWeeksInYear.js"() {
  }
});

// ../node_modules/date-fns/getMilliseconds.js
var init_getMilliseconds = __esm({
  "../node_modules/date-fns/getMilliseconds.js"() {
  }
});

// ../node_modules/date-fns/getMinutes.js
var init_getMinutes = __esm({
  "../node_modules/date-fns/getMinutes.js"() {
  }
});

// ../node_modules/date-fns/getMonth.js
var init_getMonth = __esm({
  "../node_modules/date-fns/getMonth.js"() {
  }
});

// ../node_modules/date-fns/getOverlappingDaysInIntervals.js
var init_getOverlappingDaysInIntervals = __esm({
  "../node_modules/date-fns/getOverlappingDaysInIntervals.js"() {
  }
});

// ../node_modules/date-fns/getSeconds.js
var init_getSeconds = __esm({
  "../node_modules/date-fns/getSeconds.js"() {
  }
});

// ../node_modules/date-fns/getTime.js
var init_getTime = __esm({
  "../node_modules/date-fns/getTime.js"() {
  }
});

// ../node_modules/date-fns/getUnixTime.js
var init_getUnixTime = __esm({
  "../node_modules/date-fns/getUnixTime.js"() {
  }
});

// ../node_modules/date-fns/getWeekOfMonth.js
var init_getWeekOfMonth = __esm({
  "../node_modules/date-fns/getWeekOfMonth.js"() {
  }
});

// ../node_modules/date-fns/lastDayOfMonth.js
var init_lastDayOfMonth = __esm({
  "../node_modules/date-fns/lastDayOfMonth.js"() {
  }
});

// ../node_modules/date-fns/getWeeksInMonth.js
var init_getWeeksInMonth = __esm({
  "../node_modules/date-fns/getWeeksInMonth.js"() {
  }
});

// ../node_modules/date-fns/getYear.js
var init_getYear = __esm({
  "../node_modules/date-fns/getYear.js"() {
  }
});

// ../node_modules/date-fns/hoursToMilliseconds.js
var init_hoursToMilliseconds = __esm({
  "../node_modules/date-fns/hoursToMilliseconds.js"() {
  }
});

// ../node_modules/date-fns/hoursToMinutes.js
var init_hoursToMinutes = __esm({
  "../node_modules/date-fns/hoursToMinutes.js"() {
  }
});

// ../node_modules/date-fns/hoursToSeconds.js
var init_hoursToSeconds = __esm({
  "../node_modules/date-fns/hoursToSeconds.js"() {
  }
});

// ../node_modules/date-fns/interval.js
var init_interval = __esm({
  "../node_modules/date-fns/interval.js"() {
  }
});

// ../node_modules/date-fns/intervalToDuration.js
var init_intervalToDuration = __esm({
  "../node_modules/date-fns/intervalToDuration.js"() {
  }
});

// ../node_modules/date-fns/intlFormat.js
var init_intlFormat = __esm({
  "../node_modules/date-fns/intlFormat.js"() {
  }
});

// ../node_modules/date-fns/intlFormatDistance.js
var init_intlFormatDistance = __esm({
  "../node_modules/date-fns/intlFormatDistance.js"() {
  }
});

// ../node_modules/date-fns/isAfter.js
var init_isAfter = __esm({
  "../node_modules/date-fns/isAfter.js"() {
  }
});

// ../node_modules/date-fns/isBefore.js
var init_isBefore = __esm({
  "../node_modules/date-fns/isBefore.js"() {
  }
});

// ../node_modules/date-fns/isEqual.js
var init_isEqual = __esm({
  "../node_modules/date-fns/isEqual.js"() {
  }
});

// ../node_modules/date-fns/isExists.js
var init_isExists = __esm({
  "../node_modules/date-fns/isExists.js"() {
  }
});

// ../node_modules/date-fns/isFirstDayOfMonth.js
var init_isFirstDayOfMonth = __esm({
  "../node_modules/date-fns/isFirstDayOfMonth.js"() {
  }
});

// ../node_modules/date-fns/isFriday.js
var init_isFriday = __esm({
  "../node_modules/date-fns/isFriday.js"() {
  }
});

// ../node_modules/date-fns/isFuture.js
var init_isFuture = __esm({
  "../node_modules/date-fns/isFuture.js"() {
  }
});

// ../node_modules/date-fns/transpose.js
var init_transpose = __esm({
  "../node_modules/date-fns/transpose.js"() {
  }
});

// ../node_modules/date-fns/setWeek.js
var init_setWeek = __esm({
  "../node_modules/date-fns/setWeek.js"() {
  }
});

// ../node_modules/date-fns/setISOWeek.js
var init_setISOWeek = __esm({
  "../node_modules/date-fns/setISOWeek.js"() {
  }
});

// ../node_modules/date-fns/setDay.js
var init_setDay = __esm({
  "../node_modules/date-fns/setDay.js"() {
  }
});

// ../node_modules/date-fns/setISODay.js
var init_setISODay = __esm({
  "../node_modules/date-fns/setISODay.js"() {
  }
});

// ../node_modules/date-fns/parse.js
var init_parse = __esm({
  "../node_modules/date-fns/parse.js"() {
  }
});

// ../node_modules/date-fns/isMatch.js
var init_isMatch = __esm({
  "../node_modules/date-fns/isMatch.js"() {
  }
});

// ../node_modules/date-fns/isMonday.js
var init_isMonday = __esm({
  "../node_modules/date-fns/isMonday.js"() {
  }
});

// ../node_modules/date-fns/isPast.js
var init_isPast = __esm({
  "../node_modules/date-fns/isPast.js"() {
  }
});

// ../node_modules/date-fns/startOfHour.js
var init_startOfHour = __esm({
  "../node_modules/date-fns/startOfHour.js"() {
  }
});

// ../node_modules/date-fns/isSameHour.js
var init_isSameHour = __esm({
  "../node_modules/date-fns/isSameHour.js"() {
  }
});

// ../node_modules/date-fns/isSameWeek.js
var init_isSameWeek = __esm({
  "../node_modules/date-fns/isSameWeek.js"() {
  }
});

// ../node_modules/date-fns/isSameISOWeek.js
var init_isSameISOWeek = __esm({
  "../node_modules/date-fns/isSameISOWeek.js"() {
  }
});

// ../node_modules/date-fns/isSameISOWeekYear.js
var init_isSameISOWeekYear = __esm({
  "../node_modules/date-fns/isSameISOWeekYear.js"() {
  }
});

// ../node_modules/date-fns/startOfMinute.js
var init_startOfMinute = __esm({
  "../node_modules/date-fns/startOfMinute.js"() {
  }
});

// ../node_modules/date-fns/isSameMinute.js
var init_isSameMinute = __esm({
  "../node_modules/date-fns/isSameMinute.js"() {
  }
});

// ../node_modules/date-fns/isSameMonth.js
var init_isSameMonth = __esm({
  "../node_modules/date-fns/isSameMonth.js"() {
  }
});

// ../node_modules/date-fns/isSameQuarter.js
var init_isSameQuarter = __esm({
  "../node_modules/date-fns/isSameQuarter.js"() {
  }
});

// ../node_modules/date-fns/startOfSecond.js
var init_startOfSecond = __esm({
  "../node_modules/date-fns/startOfSecond.js"() {
  }
});

// ../node_modules/date-fns/isSameSecond.js
var init_isSameSecond = __esm({
  "../node_modules/date-fns/isSameSecond.js"() {
  }
});

// ../node_modules/date-fns/isSameYear.js
var init_isSameYear = __esm({
  "../node_modules/date-fns/isSameYear.js"() {
  }
});

// ../node_modules/date-fns/isThisHour.js
var init_isThisHour = __esm({
  "../node_modules/date-fns/isThisHour.js"() {
  }
});

// ../node_modules/date-fns/isThisISOWeek.js
var init_isThisISOWeek = __esm({
  "../node_modules/date-fns/isThisISOWeek.js"() {
  }
});

// ../node_modules/date-fns/isThisMinute.js
var init_isThisMinute = __esm({
  "../node_modules/date-fns/isThisMinute.js"() {
  }
});

// ../node_modules/date-fns/isThisMonth.js
var init_isThisMonth = __esm({
  "../node_modules/date-fns/isThisMonth.js"() {
  }
});

// ../node_modules/date-fns/isThisQuarter.js
var init_isThisQuarter = __esm({
  "../node_modules/date-fns/isThisQuarter.js"() {
  }
});

// ../node_modules/date-fns/isThisSecond.js
var init_isThisSecond = __esm({
  "../node_modules/date-fns/isThisSecond.js"() {
  }
});

// ../node_modules/date-fns/isThisWeek.js
var init_isThisWeek = __esm({
  "../node_modules/date-fns/isThisWeek.js"() {
  }
});

// ../node_modules/date-fns/isThisYear.js
var init_isThisYear = __esm({
  "../node_modules/date-fns/isThisYear.js"() {
  }
});

// ../node_modules/date-fns/isThursday.js
var init_isThursday = __esm({
  "../node_modules/date-fns/isThursday.js"() {
  }
});

// ../node_modules/date-fns/isToday.js
var init_isToday = __esm({
  "../node_modules/date-fns/isToday.js"() {
  }
});

// ../node_modules/date-fns/isTomorrow.js
var init_isTomorrow = __esm({
  "../node_modules/date-fns/isTomorrow.js"() {
  }
});

// ../node_modules/date-fns/isTuesday.js
var init_isTuesday = __esm({
  "../node_modules/date-fns/isTuesday.js"() {
  }
});

// ../node_modules/date-fns/isWednesday.js
var init_isWednesday = __esm({
  "../node_modules/date-fns/isWednesday.js"() {
  }
});

// ../node_modules/date-fns/isWithinInterval.js
var init_isWithinInterval = __esm({
  "../node_modules/date-fns/isWithinInterval.js"() {
  }
});

// ../node_modules/date-fns/subDays.js
var init_subDays = __esm({
  "../node_modules/date-fns/subDays.js"() {
  }
});

// ../node_modules/date-fns/isYesterday.js
var init_isYesterday = __esm({
  "../node_modules/date-fns/isYesterday.js"() {
  }
});

// ../node_modules/date-fns/lastDayOfDecade.js
var init_lastDayOfDecade = __esm({
  "../node_modules/date-fns/lastDayOfDecade.js"() {
  }
});

// ../node_modules/date-fns/lastDayOfWeek.js
var init_lastDayOfWeek = __esm({
  "../node_modules/date-fns/lastDayOfWeek.js"() {
  }
});

// ../node_modules/date-fns/lastDayOfISOWeek.js
var init_lastDayOfISOWeek = __esm({
  "../node_modules/date-fns/lastDayOfISOWeek.js"() {
  }
});

// ../node_modules/date-fns/lastDayOfISOWeekYear.js
var init_lastDayOfISOWeekYear = __esm({
  "../node_modules/date-fns/lastDayOfISOWeekYear.js"() {
  }
});

// ../node_modules/date-fns/lastDayOfQuarter.js
var init_lastDayOfQuarter = __esm({
  "../node_modules/date-fns/lastDayOfQuarter.js"() {
  }
});

// ../node_modules/date-fns/lastDayOfYear.js
var init_lastDayOfYear = __esm({
  "../node_modules/date-fns/lastDayOfYear.js"() {
  }
});

// ../node_modules/date-fns/lightFormat.js
var init_lightFormat = __esm({
  "../node_modules/date-fns/lightFormat.js"() {
  }
});

// ../node_modules/date-fns/milliseconds.js
var init_milliseconds = __esm({
  "../node_modules/date-fns/milliseconds.js"() {
  }
});

// ../node_modules/date-fns/millisecondsToHours.js
var init_millisecondsToHours = __esm({
  "../node_modules/date-fns/millisecondsToHours.js"() {
  }
});

// ../node_modules/date-fns/millisecondsToMinutes.js
var init_millisecondsToMinutes = __esm({
  "../node_modules/date-fns/millisecondsToMinutes.js"() {
  }
});

// ../node_modules/date-fns/millisecondsToSeconds.js
var init_millisecondsToSeconds = __esm({
  "../node_modules/date-fns/millisecondsToSeconds.js"() {
  }
});

// ../node_modules/date-fns/minutesToHours.js
var init_minutesToHours = __esm({
  "../node_modules/date-fns/minutesToHours.js"() {
  }
});

// ../node_modules/date-fns/minutesToMilliseconds.js
var init_minutesToMilliseconds = __esm({
  "../node_modules/date-fns/minutesToMilliseconds.js"() {
  }
});

// ../node_modules/date-fns/minutesToSeconds.js
var init_minutesToSeconds = __esm({
  "../node_modules/date-fns/minutesToSeconds.js"() {
  }
});

// ../node_modules/date-fns/monthsToQuarters.js
var init_monthsToQuarters = __esm({
  "../node_modules/date-fns/monthsToQuarters.js"() {
  }
});

// ../node_modules/date-fns/monthsToYears.js
var init_monthsToYears = __esm({
  "../node_modules/date-fns/monthsToYears.js"() {
  }
});

// ../node_modules/date-fns/nextDay.js
var init_nextDay = __esm({
  "../node_modules/date-fns/nextDay.js"() {
  }
});

// ../node_modules/date-fns/nextFriday.js
var init_nextFriday = __esm({
  "../node_modules/date-fns/nextFriday.js"() {
  }
});

// ../node_modules/date-fns/nextMonday.js
var init_nextMonday = __esm({
  "../node_modules/date-fns/nextMonday.js"() {
  }
});

// ../node_modules/date-fns/nextSaturday.js
var init_nextSaturday = __esm({
  "../node_modules/date-fns/nextSaturday.js"() {
  }
});

// ../node_modules/date-fns/nextSunday.js
var init_nextSunday = __esm({
  "../node_modules/date-fns/nextSunday.js"() {
  }
});

// ../node_modules/date-fns/nextThursday.js
var init_nextThursday = __esm({
  "../node_modules/date-fns/nextThursday.js"() {
  }
});

// ../node_modules/date-fns/nextTuesday.js
var init_nextTuesday = __esm({
  "../node_modules/date-fns/nextTuesday.js"() {
  }
});

// ../node_modules/date-fns/nextWednesday.js
var init_nextWednesday = __esm({
  "../node_modules/date-fns/nextWednesday.js"() {
  }
});

// ../node_modules/date-fns/parseISO.js
var init_parseISO = __esm({
  "../node_modules/date-fns/parseISO.js"() {
  }
});

// ../node_modules/date-fns/parseJSON.js
var init_parseJSON = __esm({
  "../node_modules/date-fns/parseJSON.js"() {
  }
});

// ../node_modules/date-fns/previousDay.js
var init_previousDay = __esm({
  "../node_modules/date-fns/previousDay.js"() {
  }
});

// ../node_modules/date-fns/previousFriday.js
var init_previousFriday = __esm({
  "../node_modules/date-fns/previousFriday.js"() {
  }
});

// ../node_modules/date-fns/previousMonday.js
var init_previousMonday = __esm({
  "../node_modules/date-fns/previousMonday.js"() {
  }
});

// ../node_modules/date-fns/previousSaturday.js
var init_previousSaturday = __esm({
  "../node_modules/date-fns/previousSaturday.js"() {
  }
});

// ../node_modules/date-fns/previousSunday.js
var init_previousSunday = __esm({
  "../node_modules/date-fns/previousSunday.js"() {
  }
});

// ../node_modules/date-fns/previousThursday.js
var init_previousThursday = __esm({
  "../node_modules/date-fns/previousThursday.js"() {
  }
});

// ../node_modules/date-fns/previousTuesday.js
var init_previousTuesday = __esm({
  "../node_modules/date-fns/previousTuesday.js"() {
  }
});

// ../node_modules/date-fns/previousWednesday.js
var init_previousWednesday = __esm({
  "../node_modules/date-fns/previousWednesday.js"() {
  }
});

// ../node_modules/date-fns/quartersToMonths.js
var init_quartersToMonths = __esm({
  "../node_modules/date-fns/quartersToMonths.js"() {
  }
});

// ../node_modules/date-fns/quartersToYears.js
var init_quartersToYears = __esm({
  "../node_modules/date-fns/quartersToYears.js"() {
  }
});

// ../node_modules/date-fns/roundToNearestHours.js
var init_roundToNearestHours = __esm({
  "../node_modules/date-fns/roundToNearestHours.js"() {
  }
});

// ../node_modules/date-fns/roundToNearestMinutes.js
var init_roundToNearestMinutes = __esm({
  "../node_modules/date-fns/roundToNearestMinutes.js"() {
  }
});

// ../node_modules/date-fns/secondsToHours.js
var init_secondsToHours = __esm({
  "../node_modules/date-fns/secondsToHours.js"() {
  }
});

// ../node_modules/date-fns/secondsToMilliseconds.js
var init_secondsToMilliseconds = __esm({
  "../node_modules/date-fns/secondsToMilliseconds.js"() {
  }
});

// ../node_modules/date-fns/secondsToMinutes.js
var init_secondsToMinutes = __esm({
  "../node_modules/date-fns/secondsToMinutes.js"() {
  }
});

// ../node_modules/date-fns/setMonth.js
var init_setMonth = __esm({
  "../node_modules/date-fns/setMonth.js"() {
  }
});

// ../node_modules/date-fns/set.js
var init_set = __esm({
  "../node_modules/date-fns/set.js"() {
  }
});

// ../node_modules/date-fns/setDate.js
var init_setDate = __esm({
  "../node_modules/date-fns/setDate.js"() {
  }
});

// ../node_modules/date-fns/setDayOfYear.js
var init_setDayOfYear = __esm({
  "../node_modules/date-fns/setDayOfYear.js"() {
  }
});

// ../node_modules/date-fns/setDefaultOptions.js
var init_setDefaultOptions = __esm({
  "../node_modules/date-fns/setDefaultOptions.js"() {
  }
});

// ../node_modules/date-fns/setHours.js
var init_setHours = __esm({
  "../node_modules/date-fns/setHours.js"() {
  }
});

// ../node_modules/date-fns/setMilliseconds.js
var init_setMilliseconds = __esm({
  "../node_modules/date-fns/setMilliseconds.js"() {
  }
});

// ../node_modules/date-fns/setMinutes.js
var init_setMinutes = __esm({
  "../node_modules/date-fns/setMinutes.js"() {
  }
});

// ../node_modules/date-fns/setQuarter.js
var init_setQuarter = __esm({
  "../node_modules/date-fns/setQuarter.js"() {
  }
});

// ../node_modules/date-fns/setSeconds.js
var init_setSeconds = __esm({
  "../node_modules/date-fns/setSeconds.js"() {
  }
});

// ../node_modules/date-fns/setWeekYear.js
var init_setWeekYear = __esm({
  "../node_modules/date-fns/setWeekYear.js"() {
  }
});

// ../node_modules/date-fns/setYear.js
var init_setYear = __esm({
  "../node_modules/date-fns/setYear.js"() {
  }
});

// ../node_modules/date-fns/startOfDecade.js
var init_startOfDecade = __esm({
  "../node_modules/date-fns/startOfDecade.js"() {
  }
});

// ../node_modules/date-fns/startOfToday.js
var init_startOfToday = __esm({
  "../node_modules/date-fns/startOfToday.js"() {
  }
});

// ../node_modules/date-fns/startOfTomorrow.js
var init_startOfTomorrow = __esm({
  "../node_modules/date-fns/startOfTomorrow.js"() {
  }
});

// ../node_modules/date-fns/startOfYesterday.js
var init_startOfYesterday = __esm({
  "../node_modules/date-fns/startOfYesterday.js"() {
  }
});

// ../node_modules/date-fns/subMonths.js
var init_subMonths = __esm({
  "../node_modules/date-fns/subMonths.js"() {
  }
});

// ../node_modules/date-fns/sub.js
var init_sub = __esm({
  "../node_modules/date-fns/sub.js"() {
  }
});

// ../node_modules/date-fns/subBusinessDays.js
var init_subBusinessDays = __esm({
  "../node_modules/date-fns/subBusinessDays.js"() {
  }
});

// ../node_modules/date-fns/subHours.js
var init_subHours = __esm({
  "../node_modules/date-fns/subHours.js"() {
  }
});

// ../node_modules/date-fns/subMilliseconds.js
var init_subMilliseconds = __esm({
  "../node_modules/date-fns/subMilliseconds.js"() {
  }
});

// ../node_modules/date-fns/subMinutes.js
var init_subMinutes = __esm({
  "../node_modules/date-fns/subMinutes.js"() {
  }
});

// ../node_modules/date-fns/subQuarters.js
var init_subQuarters = __esm({
  "../node_modules/date-fns/subQuarters.js"() {
  }
});

// ../node_modules/date-fns/subSeconds.js
var init_subSeconds = __esm({
  "../node_modules/date-fns/subSeconds.js"() {
  }
});

// ../node_modules/date-fns/subWeeks.js
var init_subWeeks = __esm({
  "../node_modules/date-fns/subWeeks.js"() {
  }
});

// ../node_modules/date-fns/subYears.js
var init_subYears = __esm({
  "../node_modules/date-fns/subYears.js"() {
  }
});

// ../node_modules/date-fns/weeksToDays.js
var init_weeksToDays = __esm({
  "../node_modules/date-fns/weeksToDays.js"() {
  }
});

// ../node_modules/date-fns/yearsToDays.js
var init_yearsToDays = __esm({
  "../node_modules/date-fns/yearsToDays.js"() {
  }
});

// ../node_modules/date-fns/yearsToMonths.js
var init_yearsToMonths = __esm({
  "../node_modules/date-fns/yearsToMonths.js"() {
  }
});

// ../node_modules/date-fns/yearsToQuarters.js
var init_yearsToQuarters = __esm({
  "../node_modules/date-fns/yearsToQuarters.js"() {
  }
});

// ../node_modules/date-fns/index.js
var init_date_fns = __esm({
  "../node_modules/date-fns/index.js"() {
    init_add();
    init_addBusinessDays();
    init_addDays();
    init_addHours();
    init_addISOWeekYears();
    init_addMilliseconds();
    init_addMinutes();
    init_addMonths();
    init_addQuarters();
    init_addSeconds();
    init_addWeeks();
    init_addYears();
    init_areIntervalsOverlapping();
    init_clamp();
    init_closestIndexTo();
    init_closestTo();
    init_compareAsc();
    init_compareDesc();
    init_constructFrom();
    init_constructNow();
    init_daysToWeeks();
    init_differenceInBusinessDays();
    init_differenceInCalendarDays();
    init_differenceInCalendarISOWeekYears();
    init_differenceInCalendarISOWeeks();
    init_differenceInCalendarMonths();
    init_differenceInCalendarQuarters();
    init_differenceInCalendarWeeks();
    init_differenceInCalendarYears();
    init_differenceInDays();
    init_differenceInHours();
    init_differenceInISOWeekYears();
    init_differenceInMilliseconds();
    init_differenceInMinutes();
    init_differenceInMonths();
    init_differenceInQuarters();
    init_differenceInSeconds();
    init_differenceInWeeks();
    init_differenceInYears();
    init_eachDayOfInterval();
    init_eachHourOfInterval();
    init_eachMinuteOfInterval();
    init_eachMonthOfInterval();
    init_eachQuarterOfInterval();
    init_eachWeekOfInterval();
    init_eachWeekendOfInterval();
    init_eachWeekendOfMonth();
    init_eachWeekendOfYear();
    init_eachYearOfInterval();
    init_endOfDay();
    init_endOfDecade();
    init_endOfHour();
    init_endOfISOWeek();
    init_endOfISOWeekYear();
    init_endOfMinute();
    init_endOfMonth();
    init_endOfQuarter();
    init_endOfSecond();
    init_endOfToday();
    init_endOfTomorrow();
    init_endOfWeek();
    init_endOfYear();
    init_endOfYesterday();
    init_format();
    init_formatDistance2();
    init_formatDistanceStrict();
    init_formatDistanceToNow();
    init_formatDistanceToNowStrict();
    init_formatDuration();
    init_formatISO();
    init_formatISO9075();
    init_formatISODuration();
    init_formatRFC3339();
    init_formatRFC7231();
    init_formatRelative2();
    init_fromUnixTime();
    init_getDate();
    init_getDay();
    init_getDayOfYear();
    init_getDaysInMonth();
    init_getDaysInYear();
    init_getDecade();
    init_getDefaultOptions();
    init_getHours();
    init_getISODay();
    init_getISOWeek();
    init_getISOWeekYear();
    init_getISOWeeksInYear();
    init_getMilliseconds();
    init_getMinutes();
    init_getMonth();
    init_getOverlappingDaysInIntervals();
    init_getQuarter();
    init_getSeconds();
    init_getTime();
    init_getUnixTime();
    init_getWeek();
    init_getWeekOfMonth();
    init_getWeekYear();
    init_getWeeksInMonth();
    init_getYear();
    init_hoursToMilliseconds();
    init_hoursToMinutes();
    init_hoursToSeconds();
    init_interval();
    init_intervalToDuration();
    init_intlFormat();
    init_intlFormatDistance();
    init_isAfter();
    init_isBefore();
    init_isDate();
    init_isEqual();
    init_isExists();
    init_isFirstDayOfMonth();
    init_isFriday();
    init_isFuture();
    init_isLastDayOfMonth();
    init_isLeapYear();
    init_isMatch();
    init_isMonday();
    init_isPast();
    init_isSameDay();
    init_isSameHour();
    init_isSameISOWeek();
    init_isSameISOWeekYear();
    init_isSameMinute();
    init_isSameMonth();
    init_isSameQuarter();
    init_isSameSecond();
    init_isSameWeek();
    init_isSameYear();
    init_isSaturday();
    init_isSunday();
    init_isThisHour();
    init_isThisISOWeek();
    init_isThisMinute();
    init_isThisMonth();
    init_isThisQuarter();
    init_isThisSecond();
    init_isThisWeek();
    init_isThisYear();
    init_isThursday();
    init_isToday();
    init_isTomorrow();
    init_isTuesday();
    init_isValid();
    init_isWednesday();
    init_isWeekend();
    init_isWithinInterval();
    init_isYesterday();
    init_lastDayOfDecade();
    init_lastDayOfISOWeek();
    init_lastDayOfISOWeekYear();
    init_lastDayOfMonth();
    init_lastDayOfQuarter();
    init_lastDayOfWeek();
    init_lastDayOfYear();
    init_lightFormat();
    init_max();
    init_milliseconds();
    init_millisecondsToHours();
    init_millisecondsToMinutes();
    init_millisecondsToSeconds();
    init_min();
    init_minutesToHours();
    init_minutesToMilliseconds();
    init_minutesToSeconds();
    init_monthsToQuarters();
    init_monthsToYears();
    init_nextDay();
    init_nextFriday();
    init_nextMonday();
    init_nextSaturday();
    init_nextSunday();
    init_nextThursday();
    init_nextTuesday();
    init_nextWednesday();
    init_parse();
    init_parseISO();
    init_parseJSON();
    init_previousDay();
    init_previousFriday();
    init_previousMonday();
    init_previousSaturday();
    init_previousSunday();
    init_previousThursday();
    init_previousTuesday();
    init_previousWednesday();
    init_quartersToMonths();
    init_quartersToYears();
    init_roundToNearestHours();
    init_roundToNearestMinutes();
    init_secondsToHours();
    init_secondsToMilliseconds();
    init_secondsToMinutes();
    init_set();
    init_setDate();
    init_setDay();
    init_setDayOfYear();
    init_setDefaultOptions();
    init_setHours();
    init_setISODay();
    init_setISOWeek();
    init_setISOWeekYear();
    init_setMilliseconds();
    init_setMinutes();
    init_setMonth();
    init_setQuarter();
    init_setSeconds();
    init_setWeek();
    init_setWeekYear();
    init_setYear();
    init_startOfDay();
    init_startOfDecade();
    init_startOfHour();
    init_startOfISOWeek();
    init_startOfISOWeekYear();
    init_startOfMinute();
    init_startOfMonth();
    init_startOfQuarter();
    init_startOfSecond();
    init_startOfToday();
    init_startOfTomorrow();
    init_startOfWeek();
    init_startOfWeekYear();
    init_startOfYear();
    init_startOfYesterday();
    init_sub();
    init_subBusinessDays();
    init_subDays();
    init_subHours();
    init_subISOWeekYears();
    init_subMilliseconds();
    init_subMinutes();
    init_subMonths();
    init_subQuarters();
    init_subSeconds();
    init_subWeeks();
    init_subYears();
    init_toDate();
    init_transpose();
    init_weeksToDays();
    init_yearsToDays();
    init_yearsToMonths();
    init_yearsToQuarters();
  }
});

// ../node_modules/date-fns-tz/dist/esm/_lib/tzIntlTimeZoneName/index.js
function tzIntlTimeZoneName(length, date, options) {
  const defaultOptions2 = getDefaultOptions2();
  const dtf = getDTF(length, options.timeZone, options.locale ?? defaultOptions2.locale);
  return "formatToParts" in dtf ? partsTimeZone(dtf, date) : hackyTimeZone(dtf, date);
}
function partsTimeZone(dtf, date) {
  const formatted = dtf.formatToParts(date);
  for (let i = formatted.length - 1; i >= 0; --i) {
    if (formatted[i].type === "timeZoneName") {
      return formatted[i].value;
    }
  }
  return void 0;
}
function hackyTimeZone(dtf, date) {
  const formatted = dtf.format(date).replace(/\u200E/g, "");
  const tzNameMatch = / [\w-+ ]+$/.exec(formatted);
  return tzNameMatch ? tzNameMatch[0].substr(1) : "";
}
function getDTF(length, timeZone, locale) {
  return new Intl.DateTimeFormat(locale ? [locale.code, "en-US"] : void 0, {
    timeZone,
    timeZoneName: length
  });
}
var init_tzIntlTimeZoneName = __esm({
  "../node_modules/date-fns-tz/dist/esm/_lib/tzIntlTimeZoneName/index.js"() {
    init_date_fns();
  }
});

// ../node_modules/date-fns-tz/dist/esm/_lib/tzTokenizeDate/index.js
function tzTokenizeDate(date, timeZone) {
  const dtf = getDateTimeFormat(timeZone);
  return "formatToParts" in dtf ? partsOffset(dtf, date) : hackyOffset(dtf, date);
}
function partsOffset(dtf, date) {
  try {
    const formatted = dtf.formatToParts(date);
    const filled = [];
    for (let i = 0; i < formatted.length; i++) {
      const pos = typeToPos[formatted[i].type];
      if (pos !== void 0) {
        filled[pos] = parseInt(formatted[i].value, 10);
      }
    }
    return filled;
  } catch (error) {
    if (error instanceof RangeError) {
      return [NaN];
    }
    throw error;
  }
}
function hackyOffset(dtf, date) {
  const formatted = dtf.format(date);
  const parsed = /(\d+)\/(\d+)\/(\d+),? (\d+):(\d+):(\d+)/.exec(formatted);
  return [
    parseInt(parsed[3], 10),
    parseInt(parsed[1], 10),
    parseInt(parsed[2], 10),
    parseInt(parsed[4], 10),
    parseInt(parsed[5], 10),
    parseInt(parsed[6], 10)
  ];
}
function getDateTimeFormat(timeZone) {
  if (!dtfCache[timeZone]) {
    dtfCache[timeZone] = hourCycleSupported ? new Intl.DateTimeFormat("en-US", {
      hourCycle: "h23",
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }) : new Intl.DateTimeFormat("en-US", {
      hour12: false,
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }
  return dtfCache[timeZone];
}
var typeToPos, dtfCache, testDateFormatted, hourCycleSupported;
var init_tzTokenizeDate = __esm({
  "../node_modules/date-fns-tz/dist/esm/_lib/tzTokenizeDate/index.js"() {
    typeToPos = {
      year: 0,
      month: 1,
      day: 2,
      hour: 3,
      minute: 4,
      second: 5
    };
    dtfCache = {};
    testDateFormatted = new Intl.DateTimeFormat("en-US", {
      hourCycle: "h23",
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(/* @__PURE__ */ new Date("2014-06-25T04:00:00.123Z"));
    hourCycleSupported = testDateFormatted === "06/25/2014, 00:00:00" || testDateFormatted === "\u200E06\u200E/\u200E25\u200E/\u200E2014\u200E \u200E00\u200E:\u200E00\u200E:\u200E00";
  }
});

// ../node_modules/date-fns-tz/dist/esm/_lib/newDateUTC/index.js
function newDateUTC(fullYear, month, day, hour, minute, second, millisecond) {
  const utcDate = /* @__PURE__ */ new Date(0);
  utcDate.setUTCFullYear(fullYear, month, day);
  utcDate.setUTCHours(hour, minute, second, millisecond);
  return utcDate;
}
var init_newDateUTC = __esm({
  "../node_modules/date-fns-tz/dist/esm/_lib/newDateUTC/index.js"() {
  }
});

// ../node_modules/date-fns-tz/dist/esm/_lib/tzParseTimezone/index.js
function tzParseTimezone(timezoneString, date, isUtcDate) {
  if (!timezoneString) {
    return 0;
  }
  let token = patterns.timezoneZ.exec(timezoneString);
  if (token) {
    return 0;
  }
  let hours;
  let absoluteOffset;
  token = patterns.timezoneHH.exec(timezoneString);
  if (token) {
    hours = parseInt(token[1], 10);
    if (!validateTimezone(hours)) {
      return NaN;
    }
    return -(hours * MILLISECONDS_IN_HOUR);
  }
  token = patterns.timezoneHHMM.exec(timezoneString);
  if (token) {
    hours = parseInt(token[2], 10);
    const minutes = parseInt(token[3], 10);
    if (!validateTimezone(hours, minutes)) {
      return NaN;
    }
    absoluteOffset = Math.abs(hours) * MILLISECONDS_IN_HOUR + minutes * MILLISECONDS_IN_MINUTE;
    return token[1] === "+" ? -absoluteOffset : absoluteOffset;
  }
  if (isValidTimezoneIANAString(timezoneString)) {
    date = new Date(date || Date.now());
    const utcDate = isUtcDate ? date : toUtcDate(date);
    const offset = calcOffset(utcDate, timezoneString);
    const fixedOffset = isUtcDate ? offset : fixOffset(date, offset, timezoneString);
    return -fixedOffset;
  }
  return NaN;
}
function toUtcDate(date) {
  return newDateUTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
}
function calcOffset(date, timezoneString) {
  const tokens = tzTokenizeDate(date, timezoneString);
  const asUTC = newDateUTC(tokens[0], tokens[1] - 1, tokens[2], tokens[3] % 24, tokens[4], tokens[5], 0).getTime();
  let asTS = date.getTime();
  const over = asTS % 1e3;
  asTS -= over >= 0 ? over : 1e3 + over;
  return asUTC - asTS;
}
function fixOffset(date, offset, timezoneString) {
  const localTS = date.getTime();
  let utcGuess = localTS - offset;
  const o2 = calcOffset(new Date(utcGuess), timezoneString);
  if (offset === o2) {
    return offset;
  }
  utcGuess -= o2 - offset;
  const o3 = calcOffset(new Date(utcGuess), timezoneString);
  if (o2 === o3) {
    return o2;
  }
  return Math.max(o2, o3);
}
function validateTimezone(hours, minutes) {
  return -23 <= hours && hours <= 23 && (minutes == null || 0 <= minutes && minutes <= 59);
}
function isValidTimezoneIANAString(timeZoneString) {
  if (validIANATimezoneCache[timeZoneString])
    return true;
  try {
    new Intl.DateTimeFormat(void 0, { timeZone: timeZoneString });
    validIANATimezoneCache[timeZoneString] = true;
    return true;
  } catch (error) {
    return false;
  }
}
var MILLISECONDS_IN_HOUR, MILLISECONDS_IN_MINUTE, patterns, validIANATimezoneCache;
var init_tzParseTimezone = __esm({
  "../node_modules/date-fns-tz/dist/esm/_lib/tzParseTimezone/index.js"() {
    init_tzTokenizeDate();
    init_newDateUTC();
    MILLISECONDS_IN_HOUR = 36e5;
    MILLISECONDS_IN_MINUTE = 6e4;
    patterns = {
      timezone: /([Z+-].*)$/,
      timezoneZ: /^(Z)$/,
      timezoneHH: /^([+-]\d{2})$/,
      timezoneHHMM: /^([+-])(\d{2}):?(\d{2})$/
    };
    validIANATimezoneCache = {};
  }
});

// ../node_modules/date-fns-tz/dist/esm/format/formatters/index.js
function getTimeZoneOffset(timeZone, originalDate) {
  const timeZoneOffset = timeZone ? tzParseTimezone(timeZone, originalDate, true) / MILLISECONDS_IN_MINUTE2 : originalDate?.getTimezoneOffset() ?? 0;
  if (Number.isNaN(timeZoneOffset)) {
    throw new RangeError("Invalid time zone specified: " + timeZone);
  }
  return timeZoneOffset;
}
function addLeadingZeros2(number, targetLength) {
  const sign = number < 0 ? "-" : "";
  let output = Math.abs(number).toString();
  while (output.length < targetLength) {
    output = "0" + output;
  }
  return sign + output;
}
function formatTimezone2(offset, delimiter = "") {
  const sign = offset > 0 ? "-" : "+";
  const absOffset = Math.abs(offset);
  const hours = addLeadingZeros2(Math.floor(absOffset / 60), 2);
  const minutes = addLeadingZeros2(Math.floor(absOffset % 60), 2);
  return sign + hours + delimiter + minutes;
}
function formatTimezoneWithOptionalMinutes2(offset, delimiter) {
  if (offset % 60 === 0) {
    const sign = offset > 0 ? "-" : "+";
    return sign + addLeadingZeros2(Math.abs(offset) / 60, 2);
  }
  return formatTimezone2(offset, delimiter);
}
function formatTimezoneShort2(offset, delimiter = "") {
  const sign = offset > 0 ? "-" : "+";
  const absOffset = Math.abs(offset);
  const hours = Math.floor(absOffset / 60);
  const minutes = absOffset % 60;
  if (minutes === 0) {
    return sign + String(hours);
  }
  return sign + String(hours) + delimiter + addLeadingZeros2(minutes, 2);
}
var MILLISECONDS_IN_MINUTE2, formatters2;
var init_formatters2 = __esm({
  "../node_modules/date-fns-tz/dist/esm/format/formatters/index.js"() {
    init_tzIntlTimeZoneName();
    init_tzParseTimezone();
    MILLISECONDS_IN_MINUTE2 = 60 * 1e3;
    formatters2 = {
      // Timezone (ISO-8601. If offset is 0, output is always `'Z'`)
      X: function(date, token, options) {
        const timezoneOffset = getTimeZoneOffset(options.timeZone, date);
        if (timezoneOffset === 0) {
          return "Z";
        }
        switch (token) {
          // Hours and optional minutes
          case "X":
            return formatTimezoneWithOptionalMinutes2(timezoneOffset);
          // Hours, minutes and optional seconds without `:` delimeter
          // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
          // so this token always has the same output as `XX`
          case "XXXX":
          case "XX":
            return formatTimezone2(timezoneOffset);
          // Hours, minutes and optional seconds with `:` delimeter
          // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
          // so this token always has the same output as `XXX`
          case "XXXXX":
          case "XXX":
          // Hours and minutes with `:` delimeter
          default:
            return formatTimezone2(timezoneOffset, ":");
        }
      },
      // Timezone (ISO-8601. If offset is 0, output is `'+00:00'` or equivalent)
      x: function(date, token, options) {
        const timezoneOffset = getTimeZoneOffset(options.timeZone, date);
        switch (token) {
          // Hours and optional minutes
          case "x":
            return formatTimezoneWithOptionalMinutes2(timezoneOffset);
          // Hours, minutes and optional seconds without `:` delimeter
          // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
          // so this token always has the same output as `xx`
          case "xxxx":
          case "xx":
            return formatTimezone2(timezoneOffset);
          // Hours, minutes and optional seconds with `:` delimeter
          // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
          // so this token always has the same output as `xxx`
          case "xxxxx":
          case "xxx":
          // Hours and minutes with `:` delimeter
          default:
            return formatTimezone2(timezoneOffset, ":");
        }
      },
      // Timezone (GMT)
      O: function(date, token, options) {
        const timezoneOffset = getTimeZoneOffset(options.timeZone, date);
        switch (token) {
          // Short
          case "O":
          case "OO":
          case "OOO":
            return "GMT" + formatTimezoneShort2(timezoneOffset, ":");
          // Long
          case "OOOO":
          default:
            return "GMT" + formatTimezone2(timezoneOffset, ":");
        }
      },
      // Timezone (specific non-location)
      z: function(date, token, options) {
        switch (token) {
          // Short
          case "z":
          case "zz":
          case "zzz":
            return tzIntlTimeZoneName("short", date, options);
          // Long
          case "zzzz":
          default:
            return tzIntlTimeZoneName("long", date, options);
        }
      }
    };
  }
});

// ../node_modules/date-fns-tz/dist/esm/_lib/getTimezoneOffsetInMilliseconds/index.js
function getTimezoneOffsetInMilliseconds2(date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()));
  utcDate.setUTCFullYear(date.getFullYear());
  return +date - +utcDate;
}
var init_getTimezoneOffsetInMilliseconds2 = __esm({
  "../node_modules/date-fns-tz/dist/esm/_lib/getTimezoneOffsetInMilliseconds/index.js"() {
  }
});

// ../node_modules/date-fns-tz/dist/esm/_lib/tzPattern/index.js
var tzPattern;
var init_tzPattern = __esm({
  "../node_modules/date-fns-tz/dist/esm/_lib/tzPattern/index.js"() {
    tzPattern = /(Z|[+-]\d{2}(?::?\d{2})?| UTC| [a-zA-Z]+\/[a-zA-Z_]+(?:\/[a-zA-Z_]+)?)$/;
  }
});

// ../node_modules/date-fns-tz/dist/esm/toDate/index.js
function toDate2(argument, options = {}) {
  if (arguments.length < 1) {
    throw new TypeError("1 argument required, but only " + arguments.length + " present");
  }
  if (argument === null) {
    return /* @__PURE__ */ new Date(NaN);
  }
  const additionalDigits = options.additionalDigits == null ? DEFAULT_ADDITIONAL_DIGITS : Number(options.additionalDigits);
  if (additionalDigits !== 2 && additionalDigits !== 1 && additionalDigits !== 0) {
    throw new RangeError("additionalDigits must be 0, 1 or 2");
  }
  if (argument instanceof Date || typeof argument === "object" && Object.prototype.toString.call(argument) === "[object Date]") {
    return new Date(argument.getTime());
  } else if (typeof argument === "number" || Object.prototype.toString.call(argument) === "[object Number]") {
    return new Date(argument);
  } else if (!(Object.prototype.toString.call(argument) === "[object String]")) {
    return /* @__PURE__ */ new Date(NaN);
  }
  const dateStrings = splitDateString(argument);
  const { year, restDateString } = parseYear(dateStrings.date, additionalDigits);
  const date = parseDate(restDateString, year);
  if (date === null || isNaN(date.getTime())) {
    return /* @__PURE__ */ new Date(NaN);
  }
  if (date) {
    const timestamp = date.getTime();
    let time = 0;
    let offset;
    if (dateStrings.time) {
      time = parseTime(dateStrings.time);
      if (time === null || isNaN(time)) {
        return /* @__PURE__ */ new Date(NaN);
      }
    }
    if (dateStrings.timeZone || options.timeZone) {
      offset = tzParseTimezone(dateStrings.timeZone || options.timeZone, new Date(timestamp + time));
      if (isNaN(offset)) {
        return /* @__PURE__ */ new Date(NaN);
      }
    } else {
      offset = getTimezoneOffsetInMilliseconds2(new Date(timestamp + time));
      offset = getTimezoneOffsetInMilliseconds2(new Date(timestamp + time + offset));
    }
    return new Date(timestamp + time + offset);
  } else {
    return /* @__PURE__ */ new Date(NaN);
  }
}
function splitDateString(dateString) {
  const dateStrings = {};
  let parts = patterns2.dateTimePattern.exec(dateString);
  let timeString;
  if (!parts) {
    parts = patterns2.datePattern.exec(dateString);
    if (parts) {
      dateStrings.date = parts[1];
      timeString = parts[2];
    } else {
      dateStrings.date = null;
      timeString = dateString;
    }
  } else {
    dateStrings.date = parts[1];
    timeString = parts[3];
  }
  if (timeString) {
    const token = patterns2.timeZone.exec(timeString);
    if (token) {
      dateStrings.time = timeString.replace(token[1], "");
      dateStrings.timeZone = token[1].trim();
    } else {
      dateStrings.time = timeString;
    }
  }
  return dateStrings;
}
function parseYear(dateString, additionalDigits) {
  if (dateString) {
    const patternYYY = patterns2.YYY[additionalDigits];
    const patternYYYYY = patterns2.YYYYY[additionalDigits];
    let token = patterns2.YYYY.exec(dateString) || patternYYYYY.exec(dateString);
    if (token) {
      const yearString = token[1];
      return {
        year: parseInt(yearString, 10),
        restDateString: dateString.slice(yearString.length)
      };
    }
    token = patterns2.YY.exec(dateString) || patternYYY.exec(dateString);
    if (token) {
      const centuryString = token[1];
      return {
        year: parseInt(centuryString, 10) * 100,
        restDateString: dateString.slice(centuryString.length)
      };
    }
  }
  return {
    year: null
  };
}
function parseDate(dateString, year) {
  if (year === null) {
    return null;
  }
  let date;
  let month;
  let week;
  if (!dateString || !dateString.length) {
    date = /* @__PURE__ */ new Date(0);
    date.setUTCFullYear(year);
    return date;
  }
  let token = patterns2.MM.exec(dateString);
  if (token) {
    date = /* @__PURE__ */ new Date(0);
    month = parseInt(token[1], 10) - 1;
    if (!validateDate(year, month)) {
      return /* @__PURE__ */ new Date(NaN);
    }
    date.setUTCFullYear(year, month);
    return date;
  }
  token = patterns2.DDD.exec(dateString);
  if (token) {
    date = /* @__PURE__ */ new Date(0);
    const dayOfYear = parseInt(token[1], 10);
    if (!validateDayOfYearDate(year, dayOfYear)) {
      return /* @__PURE__ */ new Date(NaN);
    }
    date.setUTCFullYear(year, 0, dayOfYear);
    return date;
  }
  token = patterns2.MMDD.exec(dateString);
  if (token) {
    date = /* @__PURE__ */ new Date(0);
    month = parseInt(token[1], 10) - 1;
    const day = parseInt(token[2], 10);
    if (!validateDate(year, month, day)) {
      return /* @__PURE__ */ new Date(NaN);
    }
    date.setUTCFullYear(year, month, day);
    return date;
  }
  token = patterns2.Www.exec(dateString);
  if (token) {
    week = parseInt(token[1], 10) - 1;
    if (!validateWeekDate(week)) {
      return /* @__PURE__ */ new Date(NaN);
    }
    return dayOfISOWeekYear(year, week);
  }
  token = patterns2.WwwD.exec(dateString);
  if (token) {
    week = parseInt(token[1], 10) - 1;
    const dayOfWeek = parseInt(token[2], 10) - 1;
    if (!validateWeekDate(week, dayOfWeek)) {
      return /* @__PURE__ */ new Date(NaN);
    }
    return dayOfISOWeekYear(year, week, dayOfWeek);
  }
  return null;
}
function parseTime(timeString) {
  let hours;
  let minutes;
  let token = patterns2.HH.exec(timeString);
  if (token) {
    hours = parseFloat(token[1].replace(",", "."));
    if (!validateTime(hours)) {
      return NaN;
    }
    return hours % 24 * MILLISECONDS_IN_HOUR2;
  }
  token = patterns2.HHMM.exec(timeString);
  if (token) {
    hours = parseInt(token[1], 10);
    minutes = parseFloat(token[2].replace(",", "."));
    if (!validateTime(hours, minutes)) {
      return NaN;
    }
    return hours % 24 * MILLISECONDS_IN_HOUR2 + minutes * MILLISECONDS_IN_MINUTE3;
  }
  token = patterns2.HHMMSS.exec(timeString);
  if (token) {
    hours = parseInt(token[1], 10);
    minutes = parseInt(token[2], 10);
    const seconds = parseFloat(token[3].replace(",", "."));
    if (!validateTime(hours, minutes, seconds)) {
      return NaN;
    }
    return hours % 24 * MILLISECONDS_IN_HOUR2 + minutes * MILLISECONDS_IN_MINUTE3 + seconds * 1e3;
  }
  return null;
}
function dayOfISOWeekYear(isoWeekYear, week, day) {
  week = week || 0;
  day = day || 0;
  const date = /* @__PURE__ */ new Date(0);
  date.setUTCFullYear(isoWeekYear, 0, 4);
  const fourthOfJanuaryDay = date.getUTCDay() || 7;
  const diff = week * 7 + day + 1 - fourthOfJanuaryDay;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}
function isLeapYearIndex(year) {
  return year % 400 === 0 || year % 4 === 0 && year % 100 !== 0;
}
function validateDate(year, month, date) {
  if (month < 0 || month > 11) {
    return false;
  }
  if (date != null) {
    if (date < 1) {
      return false;
    }
    const isLeapYear = isLeapYearIndex(year);
    if (isLeapYear && date > DAYS_IN_MONTH_LEAP_YEAR[month]) {
      return false;
    }
    if (!isLeapYear && date > DAYS_IN_MONTH[month]) {
      return false;
    }
  }
  return true;
}
function validateDayOfYearDate(year, dayOfYear) {
  if (dayOfYear < 1) {
    return false;
  }
  const isLeapYear = isLeapYearIndex(year);
  if (isLeapYear && dayOfYear > 366) {
    return false;
  }
  if (!isLeapYear && dayOfYear > 365) {
    return false;
  }
  return true;
}
function validateWeekDate(week, day) {
  if (week < 0 || week > 52) {
    return false;
  }
  if (day != null && (day < 0 || day > 6)) {
    return false;
  }
  return true;
}
function validateTime(hours, minutes, seconds) {
  if (hours < 0 || hours >= 25) {
    return false;
  }
  if (minutes != null && (minutes < 0 || minutes >= 60)) {
    return false;
  }
  if (seconds != null && (seconds < 0 || seconds >= 60)) {
    return false;
  }
  return true;
}
var MILLISECONDS_IN_HOUR2, MILLISECONDS_IN_MINUTE3, DEFAULT_ADDITIONAL_DIGITS, patterns2, DAYS_IN_MONTH, DAYS_IN_MONTH_LEAP_YEAR;
var init_toDate2 = __esm({
  "../node_modules/date-fns-tz/dist/esm/toDate/index.js"() {
    init_getTimezoneOffsetInMilliseconds2();
    init_tzParseTimezone();
    init_tzPattern();
    MILLISECONDS_IN_HOUR2 = 36e5;
    MILLISECONDS_IN_MINUTE3 = 6e4;
    DEFAULT_ADDITIONAL_DIGITS = 2;
    patterns2 = {
      dateTimePattern: /^([0-9W+-]+)(T| )(.*)/,
      datePattern: /^([0-9W+-]+)(.*)/,
      plainTime: /:/,
      // year tokens
      YY: /^(\d{2})$/,
      YYY: [
        /^([+-]\d{2})$/,
        // 0 additional digits
        /^([+-]\d{3})$/,
        // 1 additional digit
        /^([+-]\d{4})$/
        // 2 additional digits
      ],
      YYYY: /^(\d{4})/,
      YYYYY: [
        /^([+-]\d{4})/,
        // 0 additional digits
        /^([+-]\d{5})/,
        // 1 additional digit
        /^([+-]\d{6})/
        // 2 additional digits
      ],
      // date tokens
      MM: /^-(\d{2})$/,
      DDD: /^-?(\d{3})$/,
      MMDD: /^-?(\d{2})-?(\d{2})$/,
      Www: /^-?W(\d{2})$/,
      WwwD: /^-?W(\d{2})-?(\d{1})$/,
      HH: /^(\d{2}([.,]\d*)?)$/,
      HHMM: /^(\d{2}):?(\d{2}([.,]\d*)?)$/,
      HHMMSS: /^(\d{2}):?(\d{2}):?(\d{2}([.,]\d*)?)$/,
      // time zone tokens (to identify the presence of a tz)
      timeZone: tzPattern
    };
    DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    DAYS_IN_MONTH_LEAP_YEAR = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  }
});

// ../node_modules/date-fns-tz/dist/esm/format/index.js
function format2(date, formatStr, options = {}) {
  formatStr = String(formatStr);
  const matches = formatStr.match(tzFormattingTokensRegExp);
  if (matches) {
    const d = toDate2(options.originalDate || date, options);
    formatStr = matches.reduce(function(result, token) {
      if (token[0] === "'") {
        return result;
      }
      const pos = result.indexOf(token);
      const precededByQuotedSection = result[pos - 1] === "'";
      const replaced = result.replace(token, "'" + formatters2[token[0]](d, token, options) + "'");
      return precededByQuotedSection ? replaced.substring(0, pos - 1) + replaced.substring(pos + 1) : replaced;
    }, formatStr);
  }
  return format(date, formatStr, options);
}
var tzFormattingTokensRegExp;
var init_format2 = __esm({
  "../node_modules/date-fns-tz/dist/esm/format/index.js"() {
    init_format();
    init_formatters2();
    init_toDate2();
    tzFormattingTokensRegExp = /([xXOz]+)|''|'(''|[^'])+('|$)/g;
  }
});

// ../node_modules/date-fns-tz/dist/esm/toZonedTime/index.js
function toZonedTime(date, timeZone, options) {
  date = toDate2(date, options);
  const offsetMilliseconds = tzParseTimezone(timeZone, date, true);
  const d = new Date(date.getTime() - offsetMilliseconds);
  const resultDate = /* @__PURE__ */ new Date(0);
  resultDate.setFullYear(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  resultDate.setHours(d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
  return resultDate;
}
var init_toZonedTime = __esm({
  "../node_modules/date-fns-tz/dist/esm/toZonedTime/index.js"() {
    init_tzParseTimezone();
    init_toDate2();
  }
});

// ../node_modules/date-fns-tz/dist/esm/formatInTimeZone/index.js
function formatInTimeZone(date, timeZone, formatStr, options) {
  options = {
    ...options,
    timeZone,
    originalDate: date
  };
  return format2(toZonedTime(date, timeZone, { timeZone: options.timeZone }), formatStr, options);
}
var init_formatInTimeZone = __esm({
  "../node_modules/date-fns-tz/dist/esm/formatInTimeZone/index.js"() {
    init_format2();
    init_toZonedTime();
  }
});

// ../node_modules/date-fns-tz/dist/esm/fromZonedTime/index.js
function fromZonedTime(date, timeZone, options) {
  if (typeof date === "string" && !date.match(tzPattern)) {
    return toDate2(date, { ...options, timeZone });
  }
  date = toDate2(date, options);
  const utc = newDateUTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()).getTime();
  const offsetMilliseconds = tzParseTimezone(timeZone, new Date(utc));
  return new Date(utc + offsetMilliseconds);
}
var init_fromZonedTime = __esm({
  "../node_modules/date-fns-tz/dist/esm/fromZonedTime/index.js"() {
    init_toDate2();
    init_tzPattern();
    init_tzParseTimezone();
    init_newDateUTC();
  }
});

// ../node_modules/date-fns-tz/dist/esm/getTimezoneOffset/index.js
var init_getTimezoneOffset = __esm({
  "../node_modules/date-fns-tz/dist/esm/getTimezoneOffset/index.js"() {
    init_tzParseTimezone();
  }
});

// ../node_modules/date-fns-tz/dist/esm/index.js
var init_esm = __esm({
  "../node_modules/date-fns-tz/dist/esm/index.js"() {
    init_format2();
    init_formatInTimeZone();
    init_fromZonedTime();
    init_toZonedTime();
    init_getTimezoneOffset();
    init_toDate2();
  }
});

// copied-server-source/lib/stage-execution.core.ts
function stageReminderTarget(exec, lead) {
  const spec = normalizeTrigger(exec?.trigger);
  return spec.kind === "hours-before-field" ? lead.customFields.find(
    (f) => spec.fieldId ? f.id === spec.fieldId : f.name.trim().toLocaleLowerCase() === spec.fieldName?.trim().toLocaleLowerCase()
  )?.displayValue : void 0;
}
function stageActionStamp(value) {
  const canonical = (v) => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(
    Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).filter(([k, value2]) => k !== "applyToExisting" && value2 !== void 0).map(([k, value2]) => [k, canonical(value2)])
  ) : v;
  return JSON.stringify(canonical(value));
}
function stageDate(value, timezone = "America/Sao_Paulo") {
  const raw = String(value ?? "").trim();
  if (!raw) return NaN;
  try {
    return /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw) ? new Date(raw).getTime() : fromZonedTime(raw, timezone).getTime();
  } catch {
    return NaN;
  }
}
function stageDueAt(exec, lead, now = Date.now()) {
  const base = Number(exec?.delayMinutes ?? 0);
  if (!Number.isFinite(base) || base < 0) return null;
  const spec = normalizeTrigger(exec?.trigger), timezone = lead?.timezone || "America/Sao_Paulo";
  let at = now;
  if (spec.kind === "daily") {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(spec.time)) return null;
    const day = formatInTimeZone(now, timezone, "yyyy-MM-dd");
    at = stageDate(`${day}T${spec.time}:00`, timezone);
    if (at <= now) {
      const next = /* @__PURE__ */ new Date(day + "T12:00:00Z");
      next.setUTCDate(next.getUTCDate() + 1);
      at = stageDate(`${next.toISOString().slice(0, 10)}T${spec.time}:00`, timezone);
    }
  } else if (spec.kind === "exact-datetime") {
    at = stageDate(spec.at, timezone);
    if (at < now) return null;
  } else if (spec.kind === "hours-before-field") {
    const field = lead?.customFields.find(
      (f) => spec.fieldId ? f.id === spec.fieldId : f.name.trim().toLowerCase() === spec.fieldName?.trim().toLowerCase()
    );
    const target = stageDate(field?.displayValue ?? "", timezone);
    if (!Number.isFinite(target) || target <= now || !Number.isFinite(spec.hours) || spec.hours < 0)
      return null;
    at = Math.max(now, target - spec.hours * 36e5);
  }
  return Number.isFinite(at) ? at + base * 6e4 : null;
}
function stageTimerKey(actionId, leadId, stageId, exec, lead, at) {
  const spec = normalizeTrigger(exec?.trigger);
  const target = stageReminderTarget(exec, lead);
  return `${actionId}:timer:${leadId}:${stageId}:${spec.kind}:${target || new Date(at).toISOString()}`;
}
function stageInsideWindow(exec, lead, now = Date.now()) {
  if (!exec?.active || exec.active === "always") return true;
  const parts = formatInTimeZone(now, lead?.timezone || "America/Sao_Paulo", "i|HH:mm").split("|");
  const day = Number(parts[0]) % 7, current = hm(parts[1]);
  const windows = exec.active === "business-hours" ? (lead?.businessHours?.days ?? Array.from({ length: 7 }, (_, d) => ({
    enabled: d > 0 && d < 6,
    start: "09:00",
    end: "18:00"
  }))).flatMap((d, i) => d.enabled ? [{ days: [i], from: d.start, to: d.end }] : []) : exec.activeWindows?.length ? exec.activeWindows : exec.activeWindow ? [exec.activeWindow] : [];
  if (!windows.length) return false;
  return windows.some((w) => {
    const start = hm(w.from), end = hm(w.to);
    if (start <= end) return w.days.includes(day) && current >= start && current < end;
    return w.days.includes(day) && current >= start || w.days.includes((day + 6) % 7) && current < end;
  });
}
function stageMatchesCondition(c, lead) {
  if (c.field === "no-tag") return lead.tags.length === 0;
  let raw;
  if (c.field === "tag") raw = lead.tags;
  else if (c.field === "assignee") raw = lead.assigneeId;
  else if (c.field === "custom-field")
    raw = lead.customFields.find(
      (f) => c.customFieldId ? f.id === c.customFieldId : f.name === c.customFieldNome
    )?.displayValue;
  else if (["name", "email", "phone", "value"].includes(c.field)) raw = lead[c.field];
  else if (c.field === "source") raw = lead.sourceId;
  else raw = lead.attributes?.[c.field];
  const expected = String(c.value ?? "").trim().toLocaleLowerCase();
  if (c.field === "value") {
    const a = Number(raw ?? 0), b = Number(c.value);
    return c.op === "gt" ? a > b : c.op === "lt" ? a < b : c.op === "neq" ? a !== b : a === b;
  }
  const values = (Array.isArray(raw) ? raw : [raw]).map((v) => String(v ?? "").toLocaleLowerCase());
  if (c.op === "contains") return values.some((v) => v.includes(expected));
  if (c.op === "in" || c.op === "not-in") {
    const accepted = expected.split(",").map((v) => v.trim());
    const found = values.some((v) => accepted.includes(v));
    return c.op === "in" ? found : !found;
  }
  const equal = values.includes(expected);
  return c.op === "neq" ? !equal : equal;
}
var STAGE_TIMER_KINDS, hm;
var init_stage_execution_core = __esm({
  "copied-server-source/lib/stage-execution.core.ts"() {
    init_esm();
    init_crm_mock();
    STAGE_TIMER_KINDS = ["daily", "exact-datetime", "hours-before-field"];
    hm = (value) => {
      const [h, m] = value.split(":").map(Number);
      return h * 60 + m;
    };
  }
});

// salesbot-email.ts
var salesbot_email_exports = {};
__export(salesbot_email_exports, {
  sendWorkspaceEmail: () => sendWorkspaceEmail
});
import { runtimeEmail } from "./salesbot-context.mjs";
async function sendWorkspaceEmail(_adapter, workspaceId, input) {
  return runtimeEmail(workspaceId, input);
}
var init_salesbot_email = __esm({
  "salesbot-email.ts"() {
  }
});

// copied-server-source/lib/stage-automation-engine.server.ts
var stage_automation_engine_server_exports = {};
__export(stage_automation_engine_server_exports, {
  backfillAutomationAction: () => backfillAutomationAction,
  enqueueLeadAutomationEvent: () => enqueueLeadAutomationEvent,
  leadMatchesSourceFilter: () => leadMatchesSourceFilter,
  parseAutomationDateTime: () => parseAutomationDateTime,
  runJob: () => runJob,
  runJobById: () => runJobById,
  scheduleDelayMinutes: () => scheduleDelayMinutes,
  scheduleStageTimerActions: () => scheduleStageTimerActions,
  shouldRunForEvent: () => shouldRunForEvent,
  tickStageAutomationJobs: () => tickStageAutomationJobs
});
async function loadLeadCtx(admin, leadId, expectedWorkspaceId) {
  let query = admin.from("leads").select("id, workspace_id, pipeline_id, stage_id, crm_source_id, custom_data, responsible_id, name, email, phone, value, tags, workspaces(business_hours)").eq("id", leadId);
  if (expectedWorkspaceId) query = query.eq("workspace_id", expectedWorkspaceId);
  const { data } = await query.maybeSingle();
  const lead = data;
  if (!lead) return null;
  const custom = [];
  try {
    const { data: values } = await admin.from("lead_custom_field_values").select("field_id, value, lead_custom_fields(name)").eq("workspace_id", lead.workspace_id).eq("lead_id", leadId);
    for (const row of values ?? []) {
      const raw = row.value;
      const display = raw && typeof raw === "object" ? String(raw.display ?? "") : String(raw ?? "");
      custom.push({ id: row.field_id, name: row.lead_custom_fields?.name ?? "", displayValue: display });
    }
  } catch {
  }
  const configuredTimezone = lead.workspaces?.business_hours?.timezone;
  const timezone = typeof configuredTimezone === "string" && configuredTimezone.trim() ? configuredTimezone.trim() : "America/Sao_Paulo";
  return {
    id: lead.id,
    workspaceId: lead.workspace_id,
    pipelineId: lead.pipeline_id,
    stageId: lead.stage_id,
    sourceId: lead.crm_source_id,
    whatsappSessionId: typeof lead.custom_data?.whatsapp_session_id === "string" && lead.custom_data.whatsapp_session_id.trim() ? lead.custom_data.whatsapp_session_id.trim() : null,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    value: lead.value,
    tags: Array.isArray(lead.tags) ? lead.tags : [],
    assigneeId: lead.responsible_id,
    attributes: lead.custom_data ?? {},
    businessHours: lead.workspaces?.business_hours ?? void 0,
    timezone,
    customFields: custom
  };
}
async function enqueueLeadAutomationEvent(admin, input) {
  const lead = await loadLeadCtx(admin, input.leadId, input.workspaceId);
  if (!lead) return [];
  const pipelineId = input.pipelineId ?? lead.pipelineId;
  const stageId = input.stageId ?? lead.stageId;
  if (!pipelineId || !stageId) return [];
  const { data: rows } = await admin.from("crm_stage_automations").select("stage_id, action, enabled").eq("workspace_id", lead.workspaceId).eq("pipeline_id", pipelineId).order("position");
  const seen = /* @__PURE__ */ new Set();
  const actions = [];
  for (const row of rows ?? []) {
    const action = row.action;
    if (!action?.id) continue;
    if (row.enabled === false || action.enabled === false) continue;
    if (input.excludeActionIds?.includes(action.id)) continue;
    const covers = action.stageIds && action.stageIds.length > 0 ? action.stageIds : [row.stage_id];
    if (!covers.includes(stageId)) continue;
    if (seen.has(action.id)) continue;
    if (!shouldRunForEvent(action, input.event, input)) continue;
    seen.add(action.id);
    actions.push(action);
  }
  if (actions.length === 0) return [];
  const results = [];
  const immediate = [];
  for (const action of actions) {
    if (!isAutomationConfigured(action) || !action.config) {
      results.push({ actionId: action.id, title: action.title, ok: false, error: "n\xE3o configurada" });
      continue;
    }
    const delay = scheduleDelayMinutes(action.execution, lead);
    if (delay < 0) {
      results.push({ actionId: action.id, title: action.title, ok: true, skipped: true });
      continue;
    }
    const dueAt = new Date(stageDueAt(action.execution, lead)).toISOString();
    const eventId = input.eventId || `evt_${input.event}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const dedupeKey = STAGE_TIMER_KINDS.includes(normalizeTrigger(action.execution?.trigger).kind) ? `${stageTimerKey(action.id, lead.id, stageId, action.execution, lead, Date.parse(dueAt))}:${await sha256Hex(stageActionStamp(action))}` : `${action.id}:${eventId}`;
    const { data: created, error: insertError } = await admin.from("crm_automation_jobs").insert({
      workspace_id: lead.workspaceId,
      lead_id: lead.id,
      pipeline_id: pipelineId,
      stage_id: stageId,
      action_id: action.id,
      action,
      context: {
        event: input.event,
        timer: STAGE_TIMER_KINDS.includes(normalizeTrigger(action.execution?.trigger).kind),
        reminderTarget: stageReminderTarget(action.execution, lead),
        fromStageId: input.fromStageId ?? null,
        tags: input.tags ?? [],
        fieldId: input.fieldId ?? null,
        fieldName: input.fieldName ?? null,
        chained: input.chained ?? false,
        event_id: eventId
      },
      due_at: dueAt,
      status: "pending",
      dedupe_key: dedupeKey
    }).select("id").maybeSingle();
    if (insertError) {
      if (String(insertError.code) === "23505") {
        results.push({ actionId: action.id, title: action.title, ok: true, skipped: true });
        continue;
      }
      results.push({ actionId: action.id, title: action.title, ok: false, error: insertError.message });
      continue;
    }
    const jobId = created?.id;
    if (!jobId) {
      results.push({ actionId: action.id, title: action.title, ok: false, error: "n\xE3o foi poss\xEDvel enfileirar" });
      continue;
    }
    if (delay === 0) immediate.push({ id: jobId, action });
    else results.push({ actionId: action.id, title: action.title, ok: true, skipped: true, queuedFor: dueAt });
  }
  for (const job of immediate) {
    results.push(await runJobById(admin, job.id));
  }
  return results;
}
async function runJobById(admin, jobId) {
  const { data, error } = await admin.from("crm_automation_jobs").update({ status: "running" }).eq("id", jobId).eq("status", "pending").lte("due_at", (/* @__PURE__ */ new Date()).toISOString()).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { actionId: jobId, title: "Automa\xE7\xE3o", ok: true, skipped: true };
  return runJob(admin, data);
}
async function finishJob(admin, jobId, status, error, attempts) {
  await admin.from("crm_automation_jobs").update({
    status,
    last_error: error ?? null,
    executed_at: (/* @__PURE__ */ new Date()).toISOString(),
    attempts: (attempts ?? 0) + 1
  }).eq("id", jobId);
}
async function runJob(admin, job) {
  const action = job.action;
  const title = action?.title ?? "gatilho";
  try {
    const lead = await loadLeadCtx(admin, job.lead_id, job.workspace_id);
    if (!lead) {
      await finishJob(admin, job.id, "skipped", "lead removido", job.attempts ?? 0);
      return { actionId: action?.id ?? job.id, title, ok: true, skipped: true };
    }
    if (job.stage_id && (lead.stageId !== job.stage_id || lead.pipelineId !== job.pipeline_id)) {
      await finishJob(admin, job.id, "skipped", "O cliente saiu da etapa antes da execu\xE7\xE3o.", job.attempts ?? 0);
      return { actionId: action.id, title, ok: true, skipped: true };
    }
    if (job.context?.timer === true || job.context?.backfill === true) {
      const saved = await admin.from("crm_stage_automations").select("action,enabled").eq("workspace_id", job.workspace_id).eq("pipeline_id", job.pipeline_id).eq("action_id", action.id);
      if (saved.error) throw new Error(saved.error.message);
      if (!(saved.data ?? []).some((r) => r.enabled !== false && r.action?.enabled !== false && stageActionStamp(r.action) === stageActionStamp(action))) {
        await finishJob(admin, job.id, "skipped", "Gatilho alterado ou desativado antes da execu\xE7\xE3o.", job.attempts ?? 0);
        return { actionId: action.id, title, ok: true, skipped: true };
      }
    }
    if (job.context?.reminderTarget !== void 0 && job.context.reminderTarget !== stageReminderTarget(action.execution, lead)) {
      await finishJob(admin, job.id, "skipped", "A data do lembrete foi alterada.", job.attempts ?? 0);
      return { actionId: action.id, title, ok: true, skipped: true };
    }
    if (!passesExecutionRules(lead, action.execution)) {
      await finishJob(admin, job.id, "skipped", "condi\xE7\xF5es n\xE3o atendidas", job.attempts ?? 0);
      return { actionId: action.id, title, ok: true, skipped: true };
    }
    await executeAction(admin, lead, action, job.context ?? {});
    await finishJob(admin, job.id, "done", void 0, job.attempts ?? 0);
    return { actionId: action.id, title, ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishJob(admin, job.id, "error", msg, job.attempts ?? 0);
    return { actionId: action?.id ?? job.id, title, ok: false, error: msg };
  }
}
async function tickStageAutomationJobs(admin, limit = 100) {
  await scheduleStageTimerActions(admin);
  const { data } = await admin.from("crm_automation_jobs").select("*").eq("status", "pending").lte("due_at", (/* @__PURE__ */ new Date()).toISOString()).order("due_at").limit(limit);
  const jobs = data ?? [];
  let processed = 0;
  let failed = 0;
  for (const job of jobs) {
    const { data: claimed } = await admin.from("crm_automation_jobs").update({ status: "running" }).eq("id", job.id).eq("status", "pending").select("id");
    if (!claimed || claimed.length === 0) continue;
    const r = await runJob(admin, job);
    processed += 1;
    if (!r.ok) failed += 1;
  }
  return { processed, failed };
}
async function logActivity(admin, lead, type, payload) {
  const receipt = await admin.from("lead_activities").insert({
    workspace_id: lead.workspaceId,
    lead_id: lead.id,
    type,
    payload,
    occurred_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (receipt.error) throw new Error(receipt.error.message);
}
async function executeAction(admin, lead, action, ctx) {
  const config = action.config;
  if (!config) throw new Error("n\xE3o configurada");
  const chained = ctx.chained === true;
  switch (config.kind) {
    case "mudar-etapa": {
      if (!config.stageId) throw new Error("etapa de destino faltando");
      const { data: stage } = await admin.from("pipeline_stages").select("pipeline_id").eq("id", config.stageId).eq("workspace_id", lead.workspaceId).maybeSingle();
      const pipelineId = stage?.pipeline_id;
      if (!pipelineId) throw new Error("etapa de destino inv\xE1lida");
      const { error } = await admin.from("leads").update({ stage_id: config.stageId, pipeline_id: pipelineId, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", lead.id).eq("workspace_id", lead.workspaceId);
      if (error) throw new Error(error.message);
      const { dispatchStageChange: dispatchStageChange2 } = await Promise.resolve().then(() => (init_salesbot_runtime_server(), salesbot_runtime_server_exports));
      await dispatchStageChange2(admin, {
        workspaceId: lead.workspaceId,
        leadId: lead.id,
        newStageId: config.stageId,
        newPipelineId: pipelineId
      }).catch(() => void 0);
      if (!chained) {
        await enqueueLeadAutomationEvent(admin, {
          leadId: lead.id,
          event: "moved",
          workspaceId: lead.workspaceId,
          pipelineId,
          stageId: config.stageId,
          fromStageId: lead.stageId,
          chained: true,
          excludeActionIds: [action.id]
        });
      }
      return;
    }
    case "editar-tags": {
      const mode = config.mode ?? "add";
      let next;
      let added = [];
      if (mode === "replace") {
        next = config.replace ?? [];
        added = next;
      } else {
        const set = new Set(lead.tags);
        for (const t of config.add ?? []) set.add(t);
        for (const t of config.remove ?? []) set.delete(t);
        added = (config.add ?? []).filter((t) => !lead.tags.includes(t));
        next = Array.from(set);
      }
      const { error } = await admin.from("leads").update({ tags: next, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", lead.id).eq("workspace_id", lead.workspaceId);
      if (error) throw new Error(error.message);
      if (added.length > 0) {
        const { dispatchTagAdded: dispatchTagAdded2 } = await Promise.resolve().then(() => (init_salesbot_runtime_server(), salesbot_runtime_server_exports));
        await dispatchTagAdded2(admin, {
          workspaceId: lead.workspaceId,
          leadId: lead.id,
          tags: added
        }).catch(() => void 0);
        if (!chained) {
          await enqueueLeadAutomationEvent(admin, {
            leadId: lead.id,
            event: "tag-added",
            tags: added,
            chained: true,
            excludeActionIds: [action.id]
          });
        }
      }
      return;
    }
    case "alterar-user": {
      if (!config.userId) throw new Error("usu\xE1rio faltando");
      const { data: member } = await admin.from("workspace_members").select("user_id").eq("workspace_id", lead.workspaceId).eq("user_id", config.userId).maybeSingle();
      if (!member) throw new Error("respons\xE1vel n\xE3o pertence a este workspace");
      const { error } = await admin.from("leads").update({ responsible_id: config.userId, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", lead.id).eq("workspace_id", lead.workspaceId);
      if (error) throw new Error(error.message);
      if (!chained) {
        await enqueueLeadAutomationEvent(admin, {
          leadId: lead.id,
          event: "assignee-changed",
          chained: true,
          excludeActionIds: [action.id]
        });
      }
      return;
    }
    case "alterar-campo": {
      const valor = config.valor ?? "";
      const validation = validateFieldValue(config.campo ?? "", valor, config.customFieldType);
      if (!validation.ok) throw new Error(validation.error ?? "valor inv\xE1lido");
      if (config.campo === "custom") {
        if (!config.customFieldId) throw new Error("campo personalizado n\xE3o selecionado");
        const { data: customField } = await admin.from("lead_custom_fields").select("id, name").eq("id", config.customFieldId).eq("workspace_id", lead.workspaceId).maybeSingle();
        if (!customField) throw new Error("campo personalizado n\xE3o pertence a este workspace");
        const value = String(validation.normalized ?? valor);
        const { error: error2 } = await admin.from("lead_custom_field_values").upsert(
          {
            workspace_id: lead.workspaceId,
            lead_id: lead.id,
            field_id: config.customFieldId,
            value: { display: value, raw: [value] },
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          { onConflict: "lead_id,field_id" }
        );
        if (error2) throw new Error(error2.message);
        const { dispatchCustomFieldChanged: dispatchCustomFieldChanged2 } = await Promise.resolve().then(() => (init_salesbot_runtime_server(), salesbot_runtime_server_exports));
        await dispatchCustomFieldChanged2(admin, {
          workspaceId: lead.workspaceId,
          leadId: lead.id,
          fieldId: config.customFieldId,
          value
        }).catch(() => void 0);
        if (!chained) {
          await enqueueLeadAutomationEvent(admin, {
            leadId: lead.id,
            event: "field-updated",
            workspaceId: lead.workspaceId,
            fieldId: config.customFieldId,
            fieldName: customField.name ?? void 0,
            chained: true,
            excludeActionIds: [action.id]
          });
        }
        return;
      }
      const patch = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
      switch (config.campo) {
        case "name":
          patch.name = validation.normalized;
          break;
        case "email":
          patch.email = validation.normalized;
          break;
        case "phone":
          patch.phone = validation.normalized;
          break;
        case "value":
          patch.value = validation.normalized;
          break;
        default:
          throw new Error("campo inv\xE1lido");
      }
      const { error } = await admin.from("leads").update(patch).eq("id", lead.id).eq("workspace_id", lead.workspaceId);
      if (error) throw new Error(error.message);
      if (!chained) {
        await enqueueLeadAutomationEvent(admin, {
          leadId: lead.id,
          event: "field-updated",
          workspaceId: lead.workspaceId,
          fieldName: config.campo,
          chained: true,
          excludeActionIds: [action.id]
        });
      }
      return;
    }
    case "vincular-produto": {
      const pId = config.productId;
      if (!pId) throw new Error("produto n\xE3o selecionado");
      const { data: product } = await admin.from("products").select("id").eq("id", pId).eq("workspace_id", lead.workspaceId).maybeSingle();
      if (!product) throw new Error("produto n\xE3o pertence a este workspace");
      const kind = config.productKind || "interesse";
      const { error } = await admin.from("lead_products").upsert(
        { workspace_id: lead.workspaceId, lead_id: lead.id, product_id: pId, kind },
        { onConflict: "lead_id,product_id,kind" }
      );
      if (error) throw new Error(error.message);
      await logActivity(admin, lead, "produto_vinculado", { product_id: pId, kind, by: "automation" });
      return;
    }
    case "tarefa": {
      const now = /* @__PURE__ */ new Date();
      const unidade = config.prazoUnidade ?? "dias";
      const valor = config.prazoValor ?? config.diasAdiante ?? 1;
      const factor = unidade === "minutos" ? 6e4 : unidade === "horas" ? 36e5 : 864e5;
      const end = new Date(now.getTime() + Math.max(0, valor) * factor);
      const destino = config.destino ?? (config.workflowPipelineId ? "fluxo" : "calendario");
      if (destino !== "calendario" && config.workflowPipelineId) {
        const { error } = await admin.from("workflow_tasks").insert({
          workspace_id: lead.workspaceId,
          pipeline_id: config.workflowPipelineId,
          stage_id: config.workflowStageId || null,
          title: config.titulo ?? "Tarefa",
          description: config.descricao ?? null,
          priority: config.workflowPriority ?? "media",
          due_at: end.toISOString(),
          assignee_id: config.workflowAssigneeId ?? null,
          tags: config.workflowTags ?? [`lead:${lead.id}`]
        });
        if (error) throw new Error(error.message);
      }
      if (destino === "calendario" || destino === "ambos") {
        const { error } = await admin.from("tasks").insert({
          workspace_id: lead.workspaceId,
          lead_id: lead.id,
          title: config.titulo ?? "Tarefa",
          description: config.descricao ?? null,
          kind: "tarefa",
          start_at: now.toISOString(),
          end_at: end.toISOString()
        });
        if (error) throw new Error(error.message);
      }
      return;
    }
    case "tarefa-concluida": {
      let q = admin.from("tasks").update({ status: "concluida", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("workspace_id", lead.workspaceId);
      q = (config.escopo ?? "todas") === "especifica" && config.taskId ? q.eq("id", config.taskId) : q.eq("lead_id", lead.id).neq("status", "concluida");
      const { error } = await q;
      if (error) throw new Error(error.message);
      return;
    }
    case "excluir-tarefas": {
      let q = admin.from("tasks").delete().eq("workspace_id", lead.workspaceId);
      q = (config.escopo ?? "todas") === "especifica" && config.taskId ? q.eq("id", config.taskId) : q.eq("lead_id", lead.id);
      const { error } = await q;
      if (error) throw new Error(error.message);
      return;
    }
    case "excluir-lead": {
      const { error } = await admin.from("leads").delete().eq("id", lead.id).eq("workspace_id", lead.workspaceId);
      if (error) throw new Error(error.message);
      return;
    }
    case "duplicar-lead": {
      const { data: full } = await admin.from("leads").select("*").eq("id", lead.id).maybeSingle();
      const src = full ?? {};
      delete src.id;
      delete src.created_at;
      delete src.updated_at;
      delete src.external_id;
      if (config.manterEtapa === false && config.toStageId) {
        const { data: stage } = await admin.from("pipeline_stages").select("pipeline_id").eq("id", config.toStageId).eq("workspace_id", lead.workspaceId).maybeSingle();
        src.stage_id = config.toStageId;
        src.pipeline_id = stage?.pipeline_id ?? src.pipeline_id;
      }
      src.name = `${String(src.name ?? "Lead")} (c\xF3pia)`;
      const { error } = await admin.from("leads").insert(src);
      if (error) throw new Error(error.message);
      return;
    }
    case "salesbot": {
      if (!config.botId) throw new Error("SalesBot n\xE3o selecionado");
      const { data: selectedBot, error: botError } = await admin.from("salesbots").select("id, is_active").eq("id", config.botId).eq("workspace_id", lead.workspaceId).maybeSingle();
      if (botError) throw new Error(botError.message);
      if (!selectedBot) throw new Error("SalesBot n\xE3o encontrado neste workspace");
      if (selectedBot.is_active !== true) {
        throw new Error("SalesBot inativo \u2014 automa\xE7\xE3o n\xE3o iniciada");
      }
      const { startSalesbotRun: startSalesbotRun2 } = await Promise.resolve().then(() => (init_salesbot_runtime_server(), salesbot_runtime_server_exports));
      const runId = await startSalesbotRun2(admin, {
        workspaceId: lead.workspaceId,
        salesbotId: config.botId,
        leadId: lead.id
      });
      if (!runId) throw new Error("n\xE3o foi poss\xEDvel iniciar o SalesBot");
      return;
    }
    case "executar-ia": {
      if (!config.agentId) throw new Error("Agente IA n\xE3o selecionado");
      const { data: agent } = await admin.from("conversation_ai_agents").select("id, name").eq("id", config.agentId).eq("workspace_id", lead.workspaceId).maybeSingle();
      if (!agent) throw new Error("Agente IA n\xE3o encontrado neste workspace");
      const { error } = await admin.from("leads").update({ active_conversation_agent_id: config.agentId, ai_paused: false, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", lead.id).eq("workspace_id", lead.workspaceId);
      if (error) throw new Error(error.message);
      await logActivity(admin, lead, "ai_agent_activated", {
        agent_id: config.agentId,
        agent_name: agent.name ?? null,
        by: "automation"
      });
      return;
    }
    case "pausar-ia": {
      const { error } = await admin.from("leads").update({ ai_paused: true, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", lead.id).eq("workspace_id", lead.workspaceId);
      if (error) throw new Error(error.message);
      return;
    }
    case "msg-interna": {
      const body = String(config.mensagem ?? "").trim();
      if (!config.toUserId || !body || body.length > 4e3) throw new Error("Escolha o destinat\xE1rio e uma mensagem interna de at\xE9 4000 caracteres.");
      const recipient = await admin.from("workspace_members").select("user_id,access_expires_at").eq("workspace_id", lead.workspaceId).eq("user_id", config.toUserId).maybeSingle();
      if (recipient.error) throw new Error(recipient.error.message);
      if (!recipient.data || recipient.data.access_expires_at && Date.parse(recipient.data.access_expires_at) <= Date.now()) throw new Error("Destinat\xE1rio indispon\xEDvel nesta empresa.");
      const to = config.toUserNome ? `@${config.toUserNome} ` : "";
      await logActivity(admin, lead, "note", { text: `${to}${body}`, by: "automation" });
      const delivery = await admin.from("team_messages").insert({ workspace_id: lead.workspaceId, to_user_id: config.toUserId, body, origin: "salesbot" });
      if (delivery.error) throw new Error("A nota foi gravada, mas o alerta privado n\xE3o foi entregue: " + delivery.error.message);
      return;
    }
    case "webhook": {
      if (!config.url) throw new Error("URL do webhook faltando");
      const payload = { ...webhookPreviewPayload(config), lead_id: lead.id };
      const headers = { "Content-Type": "application/json" };
      if (config.secret) headers["X-MKTOn-Secret"] = config.secret;
      for (const line of String(config.headersExtra ?? "").split("\n")) {
        const idx = line.indexOf(":");
        if (idx <= 0) continue;
        headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
      const method = (config.method ?? "POST").toUpperCase();
      const resp = await fetch(config.url, {
        method,
        headers,
        body: method === "GET" ? void 0 : JSON.stringify(payload)
      });
      await logActivity(admin, lead, "webhook_sent", {
        url: config.url,
        status: resp.status,
        ok: resp.ok
      });
      if (!resp.ok) throw new Error(`webhook ${resp.status}`);
      const { dispatchWebhookSent: dispatchWebhookSent2 } = await Promise.resolve().then(() => (init_salesbot_runtime_server(), salesbot_runtime_server_exports));
      await dispatchWebhookSent2(admin, {
        workspaceId: lead.workspaceId,
        leadId: lead.id,
        url: config.url
      }).catch(() => void 0);
      return;
    }
    case "meta-ads": {
      if (config.modo === "capturar") return;
      if (!config.pixelId) throw new Error("Pixel ID faltando");
      const eventName = config.eventName === "custom" ? config.customEventName ?? "CustomEvent" : config.eventName ?? "Lead";
      const encKey = runtimeEnv("INTEGRATION_ENCRYPTION_KEY");
      if (!encKey) throw new Error("INTEGRATION_ENCRYPTION_KEY ausente");
      const { data: secret } = await admin.rpc("get_integration_secret", {
        _workspace_id: lead.workspaceId,
        _provider: "meta_capi",
        _key: encKey
      });
      const token = secret?.access_token ?? null;
      if (!token) throw new Error("Token da Meta indispon\xEDvel. Configure a Conversions API.");
      const { data: leadRow } = await admin.from("leads").select("email, phone, name, value, fb_fbc, fb_fbp, fb_external_id, fb_event_id, fb_client_ip, fb_client_ua").eq("id", lead.id).maybeSingle();
      const l = leadRow ?? {};
      const user_data = {};
      if (l.email) user_data.em = [await sha256Hex(String(l.email).trim().toLowerCase())];
      if (l.phone) user_data.ph = [await sha256Hex(String(l.phone).replace(/\D/g, ""))];
      user_data.external_id = [await sha256Hex(String(l.fb_external_id ?? lead.id))];
      if (l.fb_fbc) user_data.fbc = l.fb_fbc;
      if (l.fb_fbp) user_data.fbp = l.fb_fbp;
      const valorNum = config.valorPadrao ? Number(config.valorPadrao) : Number(l.value ?? 0);
      const custom_data = {};
      if (valorNum > 0) {
        custom_data.value = valorNum;
        custom_data.currency = config.moeda ?? "BRL";
      }
      const body = {
        data: [{
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1e3),
          event_id: `${lead.id}:${eventName}`,
          action_source: "system_generated",
          user_data,
          custom_data
        }],
        access_token: token
      };
      if (config.testEventCode) body.test_event_code = config.testEventCode;
      const r = await fetch(`https://graph.facebook.com/v23.0/${config.pixelId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const text = await r.text();
      await logActivity(admin, lead, "meta_capi_sent", {
        pixel_id: config.pixelId,
        event_name: eventName,
        status: r.status,
        ok: r.ok,
        response: text.slice(0, 300)
      });
      if (!r.ok) throw new Error(`Meta CAPI ${r.status}`);
      return;
    }
    case "gerar-form": {
      if (!config.formId) throw new Error("formul\xE1rio n\xE3o selecionado");
      const { data: formRow } = await admin.from("crm_forms").select("id, nome, slug").eq("id", config.formId).eq("workspace_id", lead.workspaceId).maybeSingle();
      const form = formRow;
      if (!form?.slug) throw new Error("formul\xE1rio n\xE3o encontrado");
      const link = buildFormShareUrl(form.slug, lead.id);
      const canal = config.canal ?? "link";
      if (canal === "email") {
        if (!lead.email) throw new Error("lead sem e-mail cadastrado");
        const { sendWorkspaceEmail: sendWorkspaceEmail2 } = await Promise.resolve().then(() => (init_salesbot_email(), salesbot_email_exports));
        const corpo = (config.mensagem?.trim() || DEFAULT_FORM_MESSAGE_TEMPLATE).replace(/\{\{\s*link\s*\}\}/g, link).replace(/\{\{\s*nome\s*\}\}/g, lead.name ?? "");
        await sendWorkspaceEmail2(admin, lead.workspaceId, {
          to: lead.email,
          subject: form.nome ? `Formul\xE1rio: ${form.nome}` : "Formul\xE1rio",
          html: `<p>${corpo.replace(/\n/g, "<br/>")}</p><p><a href="${link}">${link}</a></p>`
        });
        await logActivity(admin, lead, "note", { text: `\u{1F4E7} Formul\xE1rio enviado por e-mail para ${lead.email}`, by: "automation" });
        return;
      }
      if (canal !== "whatsapp") {
        await logActivity(admin, lead, "note", {
          text: `\u{1F4DD} Formul\xE1rio "${form.nome ?? ""}": ${link}`,
          by: "automation"
        });
        return;
      }
      if (!lead.phone) throw new Error("lead sem telefone para envio no WhatsApp");
      const customMap = {};
      for (const cf of lead.customFields) customMap[cf.name] = cf.displayValue;
      const text = renderFormMessage(config.mensagem?.trim() || DEFAULT_FORM_MESSAGE_TEMPLATE, {
        link,
        nome: lead.name,
        email: lead.email,
        telefone: lead.phone,
        valor: lead.value,
        etapa: null,
        funil: null,
        customFields: customMap
      });
      const { sendWhatsappText: sendWhatsappText2 } = await Promise.resolve().then(() => (init_salesbot_runtime_server(), salesbot_runtime_server_exports));
      const sent = await sendWhatsappText2(admin, lead.workspaceId, lead.phone, text);
      if (!sent.ok) throw new Error(sent.error ?? "falha no envio pelo WhatsApp");
      return;
    }
    case "deletar-arquivos": {
      if (lead.phone) {
        await admin.from("whatsapp_web_messages").update({ media_url: null }).eq("workspace_id", lead.workspaceId).eq("sender_phone", lead.phone.replace(/\D/g, ""));
      }
      await logActivity(admin, lead, "files_deleted", { escopo: config.escopo ?? "todos", by: "automation" });
      return;
    }
    case "webhook-inbound":
    case "none":
      return;
    default:
      return;
  }
}
async function sha256Hex(value) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function shouldRunForEvent(action, event, input) {
  if (event === "manual") return true;
  const trigger = action.execution?.trigger;
  const spec = normalizeTrigger(trigger);
  switch (spec.kind) {
    case "created-or-moved":
      return event === "created" || event === "moved";
    case "created-only":
      return event === "created";
    case "moved-only":
    case "moved":
      return event === "moved";
    case "created":
      return event === "created";
    case "assignee-changed":
      return event === "assignee-changed";
    case "tag-added": {
      if (event !== "tag-added") return false;
      const configured = Array.isArray(spec.tags) ? (spec.tags ?? []).map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean) : [];
      if (configured.length === 0) return true;
      const added = (input?.tags ?? []).map((tag) => tag.trim().toLocaleLowerCase());
      return configured.some((tag) => added.includes(tag));
    }
    case "field-updated": {
      if (event !== "field-updated") return false;
      const fieldSpec = spec;
      if (fieldSpec.fieldId && fieldSpec.fieldId !== input?.fieldId) return false;
      if (!fieldSpec.fieldId && fieldSpec.fieldName) {
        const expected = fieldSpec.fieldName.trim().toLocaleLowerCase();
        const actual = String(input?.fieldName ?? "").trim().toLocaleLowerCase();
        if (expected && expected !== actual) return false;
      }
      return true;
    }
    case "hours-before-field": {
      if (event !== "field-updated") return false;
      const fieldSpec = spec;
      if (fieldSpec.fieldId && fieldSpec.fieldId !== input?.fieldId) return false;
      if (!fieldSpec.fieldId && fieldSpec.fieldName) {
        const expected = fieldSpec.fieldName.trim().toLocaleLowerCase();
        const actual = String(input?.fieldName ?? "").trim().toLocaleLowerCase();
        if (expected && expected !== actual) return false;
      }
      return true;
    }
    case "daily":
    case "exact-datetime":
      return event === "created" || event === "moved";
    default:
      return false;
  }
}
function parseAutomationDateTime(value, timezone = "America/Sao_Paulo") {
  const raw = String(value ?? "").trim();
  if (!raw) return Number.NaN;
  const hasExplicitZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
  try {
    const date = hasExplicitZone ? new Date(raw) : fromZonedTime(raw, timezone);
    return date.getTime();
  } catch {
    return Number.NaN;
  }
}
function scheduleDelayMinutes(exec, lead) {
  const due = stageDueAt(exec, lead);
  return due === null ? -1 : Math.max(0, (due - Date.now()) / 6e4);
}
function leadMatchesSourceFilter(sourceFilter, lead) {
  if (!sourceFilter?.length) return true;
  const accepted = /* @__PURE__ */ new Set();
  if (lead.sourceId) accepted.add(lead.sourceId);
  if (lead.whatsappSessionId) {
    accepted.add(lead.whatsappSessionId);
    accepted.add(`whatsapp:${lead.whatsappSessionId}`);
  }
  return sourceFilter.some((source) => accepted.has(source));
}
function passesExecutionRules(lead, exec) {
  if (!isInsideActiveWindow(exec, lead)) return false;
  if (!leadMatchesSourceFilter(exec?.sourceFilter, lead)) return false;
  const conditions = exec?.conditions ?? [];
  if (conditions.length === 0) return true;
  return conditions.every((condition) => matchesCondition(condition, lead));
}
function isInsideActiveWindow(exec, lead) {
  return stageInsideWindow(exec, lead);
}
function matchesCondition(condition, lead) {
  return stageMatchesCondition(condition, lead);
}
async function* schedulingPages(admin, workspaceId, pipelineId, stageIds, action) {
  const trigger = normalizeTrigger(action.execution?.trigger);
  for (let offset = 0; ; offset += 500) {
    const page = await admin.from("leads").select("id,stage_id,workspaces(business_hours)").eq("workspace_id", workspaceId).eq("pipeline_id", pipelineId).in("stage_id", stageIds).order("id").range(offset, offset + 499);
    if (page.error) throw new Error(page.error.message);
    const rows = page.data ?? [];
    if (!rows.length) break;
    let values = [];
    if (trigger.kind === "hours-before-field") {
      let q = admin.from("lead_custom_field_values").select("lead_id,field_id,value,lead_custom_fields(name)").eq("workspace_id", workspaceId).in("lead_id", rows.map((r) => r.id));
      if (trigger.fieldId) q = q.eq("field_id", trigger.fieldId);
      const result = await q;
      if (result.error) throw new Error(result.error.message);
      values = result.data ?? [];
    }
    yield rows.map((row) => ({ row, lead: {
      timezone: row.workspaces?.business_hours?.timezone || "America/Sao_Paulo",
      tags: [],
      customFields: values.filter((v) => v.lead_id === row.id).map((v) => ({ id: v.field_id, name: v.lead_custom_fields?.name ?? "", displayValue: typeof v.value === "object" ? String(v.value?.display ?? "") : String(v.value ?? "") }))
    } }));
    if (rows.length < 500) break;
  }
}
async function backfillAutomationAction(admin, input) {
  if (!input.stageIds.length || !isAutomationConfigured(input.action) || !input.action.config) return { queued: 0 };
  const batch = input.requestId || await sha256Hex(stageActionStamp(input.action));
  const stamp = await sha256Hex(stageActionStamp(input.action));
  const timed = STAGE_TIMER_KINDS.includes(normalizeTrigger(input.action.execution?.trigger).kind);
  let queued = 0;
  for await (const page of schedulingPages(admin, input.workspaceId, input.pipelineId, input.stageIds, input.action)) {
    const jobs = page.flatMap(({ row, lead }) => {
      const due = stageDueAt(input.action.execution, lead);
      if (due === null) return [];
      return [{
        workspace_id: input.workspaceId,
        lead_id: row.id,
        pipeline_id: input.pipelineId,
        stage_id: row.stage_id,
        action_id: input.action.id,
        action: input.action,
        context: { event: "manual", backfill: true, timer: timed, reminderTarget: stageReminderTarget(input.action.execution, lead) },
        due_at: new Date(due).toISOString(),
        status: "pending",
        dedupe_key: timed ? `${stageTimerKey(input.action.id, row.id, row.stage_id, input.action.execution, lead, due)}:${stamp}` : `${input.action.id}:apply:${batch}:${stamp}:${row.id}`
      }];
    });
    if (!jobs.length) continue;
    const saved = await admin.from("crm_automation_jobs").upsert(jobs, { onConflict: "workspace_id,dedupe_key", ignoreDuplicates: true }).select("id");
    if (saved.error) throw new Error(saved.error.message);
    queued += (saved.data ?? []).length;
  }
  return { queued };
}
async function scheduleStageTimerActions(admin, force = false, scope) {
  const sweepKey = scope?.workspaceId || admin.ws || "all";
  if (!force && Date.now() - (lastTimerSweep.get(sweepKey) || 0) < 6e4) return 0;
  let queued = 0;
  const seen = /* @__PURE__ */ new Set();
  for (let offset = 0; ; offset += 250) {
    let query = admin.from("crm_stage_automations").select("workspace_id,pipeline_id,stage_id,action,enabled").eq("enabled", true).in("action->execution->trigger->>kind", STAGE_TIMER_KINDS);
    if (scope) query = query.eq("workspace_id", scope.workspaceId).eq("pipeline_id", scope.pipelineId);
    const page = await query.order("id").range(offset, offset + 249);
    if (page.error) throw new Error(page.error.message);
    const rows = page.data ?? [];
    for (const row of rows) {
      const action = row.action, key = `${row.workspace_id}:${row.pipeline_id}:${action?.id}`;
      if (!action?.id || action.enabled === false || seen.has(key) || !isAutomationConfigured(action)) continue;
      seen.add(key);
      const stamp = await sha256Hex(stageActionStamp(action));
      for await (const leads of schedulingPages(admin, row.workspace_id, row.pipeline_id, action.stageIds?.length ? action.stageIds : [row.stage_id], action)) {
        const jobs = leads.flatMap(({ row: leadRow, lead }) => {
          const due = stageDueAt(action.execution, lead);
          if (due === null) return [];
          return [{
            workspace_id: row.workspace_id,
            pipeline_id: row.pipeline_id,
            stage_id: leadRow.stage_id,
            lead_id: leadRow.id,
            action_id: action.id,
            action,
            context: { event: "scheduled", timer: true, reminderTarget: stageReminderTarget(action.execution, lead) },
            status: "pending",
            due_at: new Date(due).toISOString(),
            dedupe_key: `${stageTimerKey(action.id, leadRow.id, leadRow.stage_id, action.execution, lead, due)}:${stamp}`
          }];
        });
        if (!jobs.length) continue;
        const saved = await admin.from("crm_automation_jobs").upsert(jobs, { onConflict: "workspace_id,dedupe_key", ignoreDuplicates: true }).select("id");
        if (saved.error) throw new Error(saved.error.message);
        queued += (saved.data ?? []).length;
      }
    }
    if (rows.length < 250) break;
  }
  if (!scope) lastTimerSweep.set(sweepKey, Date.now());
  return queued;
}
var lastTimerSweep;
var init_stage_automation_engine_server = __esm({
  "copied-server-source/lib/stage-automation-engine.server.ts"() {
    init_crm_mock();
    init_forms_functions();
    init_esm();
    init_stage_execution_core();
    lastTimerSweep = /* @__PURE__ */ new Map();
  }
});

// copied-server-source/lib/crm-event-dispatch.server.ts
var crm_event_dispatch_server_exports = {};
__export(crm_event_dispatch_server_exports, {
  dispatchCrmFieldUpdated: () => dispatchCrmFieldUpdated,
  dispatchCrmLeadCreated: () => dispatchCrmLeadCreated,
  dispatchCrmStageMoved: () => dispatchCrmStageMoved,
  dispatchCrmTagAdded: () => dispatchCrmTagAdded
});
async function dispatchCrmLeadCreated(admin, input) {
  try {
    const { dispatchLeadCreated: dispatchLeadCreated2 } = await Promise.resolve().then(() => (init_salesbot_runtime_server(), salesbot_runtime_server_exports));
    await dispatchLeadCreated2(admin, {
      workspaceId: input.workspaceId,
      leadId: input.leadId
    });
  } catch (error) {
  }
  const { enqueueLeadAutomationEvent: enqueueLeadAutomationEvent2 } = await Promise.resolve().then(() => (init_stage_automation_engine_server(), stage_automation_engine_server_exports));
  return enqueueLeadAutomationEvent2(admin, {
    leadId: input.leadId,
    event: "created",
    workspaceId: input.workspaceId,
    pipelineId: input.pipelineId ?? null,
    stageId: input.stageId ?? null
  });
}
async function dispatchCrmStageMoved(admin, input) {
  try {
    const { dispatchStageChange: dispatchStageChange2 } = await Promise.resolve().then(() => (init_salesbot_runtime_server(), salesbot_runtime_server_exports));
    await dispatchStageChange2(admin, {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      newStageId: input.newStageId,
      newPipelineId: input.newPipelineId
    });
  } catch (error) {
  }
  const { enqueueLeadAutomationEvent: enqueueLeadAutomationEvent2 } = await Promise.resolve().then(() => (init_stage_automation_engine_server(), stage_automation_engine_server_exports));
  return enqueueLeadAutomationEvent2(admin, {
    leadId: input.leadId,
    event: "moved",
    workspaceId: input.workspaceId,
    pipelineId: input.newPipelineId,
    stageId: input.newStageId,
    fromStageId: input.fromStageId ?? null
  });
}
async function dispatchCrmTagAdded(admin, input) {
  if (input.tags.length === 0) return [];
  try {
    const { dispatchTagAdded: dispatchTagAdded2 } = await Promise.resolve().then(() => (init_salesbot_runtime_server(), salesbot_runtime_server_exports));
    await dispatchTagAdded2(admin, input);
  } catch (error) {
  }
  const { enqueueLeadAutomationEvent: enqueueLeadAutomationEvent2 } = await Promise.resolve().then(() => (init_stage_automation_engine_server(), stage_automation_engine_server_exports));
  return enqueueLeadAutomationEvent2(admin, {
    leadId: input.leadId,
    event: "tag-added",
    workspaceId: input.workspaceId,
    tags: input.tags
  });
}
async function dispatchCrmFieldUpdated(admin, input) {
  const { enqueueLeadAutomationEvent: enqueueLeadAutomationEvent2 } = await Promise.resolve().then(() => (init_stage_automation_engine_server(), stage_automation_engine_server_exports));
  return enqueueLeadAutomationEvent2(admin, {
    leadId: input.leadId,
    event: "field-updated",
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    fieldName: input.fieldName
  });
}
var init_crm_event_dispatch_server = __esm({
  "copied-server-source/lib/crm-event-dispatch.server.ts"() {
  }
});

// salesbot-context.ts
var salesbot_context_exports = {};
__export(salesbot_context_exports, {
  resolveWorkspaceAiKey: () => resolveWorkspaceAiKey,
  supabaseAdmin: () => supabaseAdmin
});
import { currentRuntime } from "./salesbot-context.mjs";
async function resolveWorkspaceAiKey(_adapter, workspaceId) {
  const context = currentRuntime();
  if (context.workspaceId !== workspaceId) throw Error("Workspace da IA divergente.");
  return { provider: "openai", apiKey: "workspace-internal-transport", baseUrl: "cc://ai", defaultModel: context.model() };
}
var supabaseAdmin;
var init_salesbot_context = __esm({
  "salesbot-context.ts"() {
    supabaseAdmin = new Proxy({}, { get(_target, key) {
      const adapter = currentRuntime().adapter;
      const value = adapter[key];
      return typeof value === "function" ? value.bind(adapter) : value;
    } });
  }
});

// copied-server-source/lib/workflow-task-create.server.ts
var workflow_task_create_server_exports = {};
__export(workflow_task_create_server_exports, {
  createWorkflowTaskAdmin: () => createWorkflowTaskAdmin
});
async function createWorkflowTaskAdmin(input) {
  try {
    let stageId;
    if (input.stageId) {
      const { data: chosen } = await supabaseAdmin.from("workflow_stages").select("id").eq("id", input.stageId).eq("pipeline_id", input.pipelineId).maybeSingle();
      stageId = chosen?.id;
    }
    const { data: stage } = await supabaseAdmin.from("workflow_stages").select("id").eq("pipeline_id", input.pipelineId).eq("is_done_stage", false).eq("is_incomplete_stage", false).order("position", { ascending: true }).limit(1).maybeSingle();
    stageId = stageId ?? stage?.id;
    if (!stageId) return { ok: false, error: "Fluxo sem etapas configuradas." };
    const { data: max } = await supabaseAdmin.from("workflow_tasks").select("position").eq("stage_id", stageId).order("position", { ascending: false }).limit(1).maybeSingle();
    const nextPos = (max?.position ?? -1) + 1;
    const desc = input.leadId ? `${input.description ?? ""}${input.description ? "\n\n" : ""}[Lead: ${input.leadId}]` : input.description ?? null;
    const { data: row, error } = await supabaseAdmin.from("workflow_tasks").insert({
      workspace_id: input.workspaceId,
      pipeline_id: input.pipelineId,
      stage_id: stageId,
      title: input.title,
      description: desc,
      priority: input.priority ?? "media",
      due_at: input.dueAt ?? null,
      assignee_id: input.assigneeId ?? null,
      tags: input.tags ?? [],
      created_by: input.createdBy ?? null,
      position: nextPos
    }).select("id").single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e?.message ?? "error" };
  }
}
var init_workflow_task_create_server = __esm({
  "copied-server-source/lib/workflow-task-create.server.ts"() {
    init_salesbot_context();
  }
});

// copied-server-source/lib/audio-transcription.server.ts
var audio_transcription_server_exports = {};
__export(audio_transcription_server_exports, {
  transcribeAudioUrl: () => transcribeAudioUrl,
  transcribeWhatsappAudioMessage: () => transcribeWhatsappAudioMessage
});
function extFromType(mime) {
  const m = mime.split(";")[0].trim().toLowerCase();
  return {
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm"
  }[m] ?? "ogg";
}
async function transcribeAudioUrl(sb, workspaceId, audioUrl) {
  if (!audioUrl) return null;
  try {
    const { resolveWorkspaceAiKey: resolveWorkspaceAiKey2 } = await Promise.resolve().then(() => (init_salesbot_context(), salesbot_context_exports));
    const key = await resolveWorkspaceAiKey2(sb, workspaceId);
    if (key.provider !== "openai") return null;
    const dl = await fetch(audioUrl);
    if (!dl.ok) return null;
    const blob = await dl.blob();
    if (!blob.size || blob.size > MAX_BYTES) return null;
    const form = new FormData();
    form.append("file", blob, `audio.${extFromType(blob.type || "audio/ogg")}`);
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("response_format", "json");
    const res = await fetch(`${key.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key.apiKey}` },
      body: form
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    const text = (json.text ?? "").trim();
    return text || null;
  } catch {
    return null;
  }
}
async function transcribeWhatsappAudioMessage(sb, workspaceId, row) {
  const cached = row.raw?.transcription;
  if (typeof cached === "string" && cached.trim()) return cached.trim();
  if (!row.media_url) return null;
  const text = await transcribeAudioUrl(sb, workspaceId, row.media_url);
  if (!text) return null;
  if (row.id) {
    try {
      await sb.from("whatsapp_web_messages").update({ raw: { ...row.raw ?? {}, transcription: text } }).eq("id", row.id).eq("workspace_id", workspaceId);
    } catch {
    }
  }
  return text;
}
var MAX_BYTES;
var init_audio_transcription_server = __esm({
  "copied-server-source/lib/audio-transcription.server.ts"() {
    MAX_BYTES = 24 * 1024 * 1024;
  }
});

// copied-server-source/lib/agent-knowledge.server.ts
var agent_knowledge_server_exports = {};
__export(agent_knowledge_server_exports, {
  buildAgentKnowledgeBlock: () => buildAgentKnowledgeBlock
});
function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim();
}
function extractText(bytes, mime, fileName) {
  const name = (fileName || "").toLowerCase();
  const isPdf = mime.includes("pdf") || name.endsWith(".pdf");
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (!isPdf) {
    const printable = decoded.replace(/[^\P{C}\n\t]/gu, "");
    const ratio = printable.length / Math.max(1, decoded.length);
    if (ratio > 0.85) return printable.trim();
    const xml = decoded.match(/<w:t[^>]*>([^<]{2,})<\/w:t>/g);
    if (xml?.length) return stripHtml(xml.join(" "));
    return "";
  }
  const chunks = Array.from(decoded.matchAll(/\((?:\\.|[^\\()])*\)/g)).map((m) => m[0].slice(1, -1).replace(/\\([()\\])/g, "$1")).filter((s) => /[A-Za-zÀ-ÿ0-9]/.test(s));
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}
async function resolveOne(source, download) {
  const kind = String(source.type ?? source.kind ?? "text").toLowerCase();
  const title = source.title || source.label || source.fileName || source.url || "fonte";
  if (source.content?.trim()) return { title, text: source.content.trim() };
  if (kind === "url" && source.url) {
    try {
      const res = await fetch(source.url, {
        headers: { "User-Agent": "MKTOn-Agent/1.0", Accept: "text/html,text/plain,*/*" },
        signal: AbortSignal.timeout(12e3)
      });
      if (!res.ok) return { title, text: `(n\xE3o foi poss\xEDvel ler ${source.url}: HTTP ${res.status})` };
      const body = await res.text();
      const text = body.trimStart().startsWith("<") ? stripHtml(body) : body.trim();
      return text ? { title: `${title} (${source.url})`, text } : null;
    } catch {
      return { title, text: `(n\xE3o foi poss\xEDvel acessar ${source.url})` };
    }
  }
  if (kind === "document" && source.storagePath && download) {
    try {
      const bytes = await download(source.storagePath);
      if (!bytes) return null;
      const text = extractText(bytes, source.mime ?? "", source.fileName ?? "");
      return text ? { title, text } : null;
    } catch {
      return null;
    }
  }
  return null;
}
async function buildAgentKnowledgeBlock(sources, supabase, bucket = "salesbot-media") {
  const list = (sources ?? []).filter(Boolean);
  if (!list.length) return "";
  const download = supabase ? async (path) => {
    const { data } = await supabase.storage.from(bucket).download(path);
    if (!data) return null;
    return new Uint8Array(await data.arrayBuffer());
  } : null;
  const resolved = (await Promise.all(list.map((s) => resolveOne(s, download)))).filter(
    (r) => Boolean(r?.text?.trim())
  );
  if (!resolved.length) return "";
  const parts = [
    "=== FONTES DE CONHECIMENTO (use SOMENTE estas informa\xE7\xF5es para responder d\xFAvidas factuais sobre a empresa, produtos, pre\xE7os e pol\xEDticas; se a resposta n\xE3o estiver aqui, diga que vai verificar) ==="
  ];
  let total = 0;
  for (const r of resolved) {
    const text = r.text.slice(0, MAX_PER_SOURCE);
    if (total + text.length > MAX_TOTAL) break;
    total += text.length;
    parts.push(`--- ${r.title} ---
${text}`);
  }
  return parts.join("\n\n");
}
var MAX_PER_SOURCE, MAX_TOTAL;
var init_agent_knowledge_server = __esm({
  "copied-server-source/lib/agent-knowledge.server.ts"() {
    MAX_PER_SOURCE = 6e3;
    MAX_TOTAL = 24e3;
  }
});

// copied-server-source/lib/agent-system-data.server.ts
var agent_system_data_server_exports = {};
__export(agent_system_data_server_exports, {
  buildAgentSystemDataBlock: () => buildAgentSystemDataBlock,
  loadSocialSummary: () => loadSocialSummary,
  loadSystemMetrics: () => loadSystemMetrics,
  loadTrackingSummary: () => loadTrackingSummary,
  loadTrafficSummary: () => loadTrafficSummary,
  loadWorkflowSummary: () => loadWorkflowSummary
});
function periodToPreset(period) {
  switch (period) {
    case "hoje":
      return { preset: "today", days: 1, label: "hoje" };
    case "ontem":
      return { preset: "yesterday", days: 1, label: "ontem" };
    case "30d":
      return { preset: "last_30d", days: 30, label: "\xFAltimos 30 dias" };
    default:
      return { preset: "last_7d", days: 7, label: "\xFAltimos 7 dias" };
  }
}
function brl(n) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
async function loadMetaToken(sb, workspaceId) {
  const encKey = process.env["INTEGRATION_ENCRYPTION_KEY"];
  if (!encKey) return null;
  try {
    const { data } = await sb.rpc("get_integration_secret_service", {
      _workspace_id: workspaceId,
      _provider: "meta",
      _key: encKey
    });
    const token = data?.access_token;
    return token ?? null;
  } catch {
    return null;
  }
}
async function loadTrafficSummary(sb, workspaceId, cfg) {
  const token = await loadMetaToken(sb, workspaceId);
  if (!token) return "TR\xC1FEGO (Meta Ads): a conta de an\xFAncios n\xE3o est\xE1 conectada neste workspace \u2014 n\xE3o afirme n\xFAmeros de tr\xE1fego.";
  let accountId = cfg.accountId?.trim();
  if (!accountId) {
    const { data } = await sb.from("meta_ad_accounts").select("account_id").eq("workspace_id", workspaceId).limit(1);
    accountId = data?.[0]?.account_id;
  }
  if (!accountId) return "TR\xC1FEGO (Meta Ads): nenhuma conta de an\xFAncio sincronizada.";
  const { preset, label } = periodToPreset(cfg.period);
  try {
    const url = new URL(`https://graph.facebook.com/${GRAPH}/${accountId}/insights`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("date_preset", preset);
    url.searchParams.set("fields", "spend,impressions,clicks,ctr,cpc,actions,action_values");
    const r = await fetch(url.toString());
    if (!r.ok) return `TR\xC1FEGO (Meta Ads): n\xE3o consegui ler os dados agora (${r.status}). N\xE3o invente n\xFAmeros.`;
    const j = await r.json();
    const row = j.data?.[0];
    if (!row) return `TR\xC1FEGO (Meta Ads, ${label}): sem veicula\xE7\xE3o registrada no per\xEDodo.`;
    const spend = Number(row["spend"] ?? 0);
    const clicks = Number(row["clicks"] ?? 0);
    const impressions = Number(row["impressions"] ?? 0);
    const ctr = Number(row["ctr"] ?? 0);
    const actions = row["actions"] ?? [];
    const values = row["action_values"] ?? [];
    const leads = Number(actions.find((a) => a.action_type === "lead")?.value ?? 0);
    const compras = Number(actions.find((a) => a.action_type.includes("purchase"))?.value ?? 0);
    const receita = Number(values.find((a) => a.action_type.includes("purchase"))?.value ?? 0);
    const cpl = leads > 0 ? spend / leads : 0;
    const roas = spend > 0 ? receita / spend : 0;
    return [
      `TR\xC1FEGO REAL (Meta Ads, conta ${accountId}, ${label}):`,
      `- Investimento: ${brl(spend)}`,
      `- Impress\xF5es: ${impressions} | Cliques: ${clicks} | CTR: ${ctr.toFixed(2)}%`,
      `- Leads: ${leads}${leads > 0 ? ` | CPL: ${brl(cpl)}` : ""}`,
      `- Compras: ${compras} | Receita: ${brl(receita)} | ROAS: ${roas.toFixed(2)}`
    ].join("\n");
  } catch (e) {
    return `TR\xC1FEGO (Meta Ads): falha ao consultar (${e.message}). N\xE3o invente n\xFAmeros.`;
  }
}
async function loadSocialSummary(sb, workspaceId, cfg) {
  const dias = cfg.dias ?? 14;
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  const ate = new Date(Date.now() + dias * 864e5).toISOString();
  let q = sb.from("social_posts").select("title,status,scheduled_at,published_at,campaign_id").eq("workspace_id", workspaceId).order("scheduled_at", { ascending: true }).limit(40);
  if (cfg.campaignId) q = q.eq("campaign_id", cfg.campaignId);
  if (cfg.escopo === "publicados") q = q.eq("status", "published").gte("published_at", desde);
  else q = q.in("status", ["scheduled", "approved", "publishing"]).lte("scheduled_at", ate);
  const { data } = await q;
  const rows = data ?? [];
  if (!rows.length) return `SOCIAL MEDIA: nenhum post ${cfg.escopo === "publicados" ? "publicado" : "agendado"} nesse intervalo.`;
  const linhas = rows.slice(0, 12).map((p) => {
    const quando = p.published_at ?? p.scheduled_at;
    const data2 = quando ? new Date(quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "sem data";
    return `- ${p.title?.trim() || "Post sem t\xEDtulo"} \u2014 ${p.status} \u2014 ${data2}`;
  });
  return `SOCIAL MEDIA REAL (${rows.length} post(s)):
${linhas.join("\n")}`;
}
async function loadTrackingSummary(sb, workspaceId, leadId, cfg) {
  const dias = cfg.dias ?? 30;
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  const qTracking = sb.from("tracking_events").select("event_name,created_at,page_url,site_id,lead_id").eq("workspace_id", workspaceId).gte("created_at", desde).order("created_at", { ascending: false }).limit(20);
  if (cfg.siteId && !cfg.siteId.startsWith("crm-") && !cfg.siteId.startsWith("meta-")) {
    qTracking.eq("site_id", cfg.siteId);
  }
  if (cfg.event && !cfg.event.startsWith("meta-")) qTracking.eq("event_name", cfg.event);
  if (leadId) qTracking.eq("lead_id", leadId);
  const qCapi = sb.from("lead_tracking_events").select("event_name,created_at,value,currency").eq("workspace_id", workspaceId).gte("created_at", desde).order("created_at", { ascending: false }).limit(20);
  if (leadId) qCapi.eq("lead_id", leadId);
  if (cfg.event && !cfg.event.startsWith("meta-")) qCapi.eq("event_name", cfg.event);
  const [resTracking, resCapi] = await Promise.all([qTracking, qCapi]);
  const rowsTracking = resTracking.data ?? [];
  const rowsCapi = resCapi.data ?? [];
  const linhas = [];
  if (!leadId || cfg.siteId && cfg.siteId.startsWith("meta-")) {
    const accId = cfg.siteId?.startsWith("meta-") ? cfg.siteId.replace("meta-", "") : void 0;
    const traffic = await loadTrafficSummary(sb, workspaceId, { accountId: accId, period: `${dias}d` });
    if (!traffic.includes("n\xE3o est\xE1 conectada") && !traffic.includes("nenhuma conta")) {
      linhas.push("M\xC9TRICAS DE PERFORMANCE (ADS) DO M\xD3DULO:");
      linhas.push(traffic);
      linhas.push("");
    }
  }
  if (rowsTracking.length) {
    linhas.push("EVENTOS DE SITE / PIXEL:");
    rowsTracking.slice(0, 10).forEach(
      (e) => linhas.push(`- ${e.event_name} em ${new Date(e.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}${e.page_url ? ` (${e.page_url})` : ""}`)
    );
  }
  if (rowsCapi.length) {
    if (linhas.length) linhas.push("");
    linhas.push("EVENTOS DE CONVERS\xC3O / CRM / CAPI:");
    rowsCapi.slice(0, 10).forEach(
      (e) => linhas.push(`- ${e.event_name} em ${new Date(e.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}${e.value ? ` (Valor: ${e.value} ${e.currency ?? "BRL"})` : ""}`)
    );
  }
  if (!linhas.length) {
    return `M\xD3DULO DE TRACKING: nenhum evento (site, CRM ou tr\xE1fego) registrado nos \xFAltimos ${dias} dias.`;
  }
  return `M\xD3DULO DE TRACKING CONSOLIDADO (${rowsTracking.length + rowsCapi.length} eventos + m\xE9tricas Ads):
${linhas.join("\n")}`;
}
async function loadWorkflowSummary(sb, workspaceId, leadId) {
  void leadId;
  const { data } = await sb.from("workflow_tasks").select("title,status,priority,due_at").eq("workspace_id", workspaceId).neq("status", "concluida").order("created_at", { ascending: false }).limit(20);
  const rows = data ?? [];
  if (!rows.length) return "FLUXO DE TRABALHO: nenhuma tarefa aberta no momento.";
  const linhas = rows.slice(0, 10).map(
    (t) => `- ${t.title?.trim() || "Tarefa"} \u2014 ${t.status ?? "aberta"}${t.priority ? ` (${t.priority})` : ""}${t.due_at ? ` \u2014 prazo ${new Date(t.due_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}`
  );
  return `FLUXO DE TRABALHO REAL (${rows.length} tarefa(s)):
${linhas.join("\n")}`;
}
function parseJsonTarget(target) {
  if (typeof target !== "string") return {};
  const raw = target.trim();
  if (!raw.startsWith("{")) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
async function buildAgentSystemDataBlock(sb, workspaceId, leadId, meta) {
  let serialized = "";
  try {
    serialized = JSON.stringify(meta ?? {});
  } catch {
    serialized = "";
  }
  if (!serialized) return "";
  const wantsTrafego = serialized.includes("consultar-trafego") || serialized.includes("trafego-");
  const wantsSocial = serialized.includes("consultar-social") || serialized.includes("social-");
  const wantsTracking = serialized.includes("consultar-tracking") || serialized.includes("tracking-evento") || serialized.includes('"kind":"tracking"');
  const wantsWorkflow = serialized.includes("criar-tarefa-workflow") || serialized.includes("consultar-workflow") || serialized.includes("workflow-");
  if (!wantsTrafego && !wantsSocial && !wantsTracking && !wantsWorkflow) return "";
  const cfgs = {};
  const scan = (node) => {
    if (!node || typeof node !== "object") return;
    const obj = node;
    const action = obj["action"] ?? obj["do"]?.["action"];
    if (action && /^consultar-(trafego|social|tracking|workflow)$/.test(action)) {
      const target = obj["target"] ?? obj["do"]?.["target"];
      cfgs[action] = { ...parseJsonTarget(target), ...cfgs[action] ?? {} };
    }
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) v.forEach(scan);
      else if (v && typeof v === "object") scan(v);
    }
  };
  scan(meta);
  const parts = [];
  const jobs = [];
  if (wantsTrafego) jobs.push(loadTrafficSummary(sb, workspaceId, cfgs["consultar-trafego"] ?? {}));
  if (wantsSocial) jobs.push(loadSocialSummary(sb, workspaceId, cfgs["consultar-social"] ?? {}));
  if (wantsTracking) jobs.push(loadTrackingSummary(sb, workspaceId, leadId, cfgs["consultar-tracking"] ?? {}));
  if (wantsWorkflow) jobs.push(loadWorkflowSummary(sb, workspaceId, leadId));
  for (const r of await Promise.allSettled(jobs)) {
    if (r.status === "fulfilled" && r.value) parts.push(r.value);
  }
  if (!parts.length) return "";
  return [
    "DADOS REAIS DO SISTEMA MKTOn (medidos agora; use estes n\xFAmeros nas condi\xE7\xF5es e nunca invente outros):",
    ...parts
  ].join("\n\n");
}
async function loadSystemMetrics(sb, workspaceId, leadId, fields) {
  const wanted = new Set(fields.filter((f) => /^(trafego|social|workflow|tracking)-/.test(f)));
  if (!wanted.size) return {};
  const out = {};
  const precisaTrafego = [...wanted].some((f) => f.startsWith("trafego-"));
  if (precisaTrafego) {
    const token = await loadMetaToken(sb, workspaceId);
    const { data } = await sb.from("meta_ad_accounts").select("account_id").eq("workspace_id", workspaceId).limit(1);
    const accountId = data?.[0]?.account_id;
    if (token && accountId) {
      try {
        const url = new URL(`https://graph.facebook.com/${GRAPH}/${accountId}/insights`);
        url.searchParams.set("access_token", token);
        url.searchParams.set("date_preset", "last_7d");
        url.searchParams.set("fields", "spend,actions,action_values");
        const r = await fetch(url.toString());
        if (r.ok) {
          const j = await r.json();
          const row = j.data?.[0] ?? {};
          const spend = Number(row["spend"] ?? 0);
          const actions = row["actions"] ?? [];
          const values = row["action_values"] ?? [];
          const leads = Number(actions.find((a) => a.action_type === "lead")?.value ?? 0);
          const receita = Number(values.find((a) => a.action_type.includes("purchase"))?.value ?? 0);
          out["trafego-investimento"] = spend;
          out["trafego-leads"] = leads;
          out["trafego-cpl"] = leads > 0 ? spend / leads : 0;
          out["trafego-roas"] = spend > 0 ? receita / spend : 0;
        }
      } catch {
      }
    }
  }
  if (wanted.has("social-agendados") || wanted.has("social-publicados")) {
    const [ag, pub] = await Promise.all([
      sb.from("social_posts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).in("status", ["scheduled", "approved"]),
      sb.from("social_posts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "published")
    ]);
    out["social-agendados"] = Number(ag.count ?? 0);
    out["social-publicados"] = Number(pub.count ?? 0);
  }
  if (wanted.has("workflow-tarefas-abertas")) {
    const res = await sb.from("workflow_tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).neq("status", "concluida");
    out["workflow-tarefas-abertas"] = Number(res.count ?? 0);
  }
  if (wanted.has("tracking-eventos")) {
    let q = sb.from("tracking_events").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString());
    if (leadId) q = q.eq("lead_id", leadId);
    const res = await q;
    out["tracking-eventos"] = Number(res.count ?? 0);
  }
  return out;
}
var GRAPH;
var init_agent_system_data_server = __esm({
  "copied-server-source/lib/agent-system-data.server.ts"() {
    GRAPH = "v21.0";
  }
});

// copied-server-source/lib/agent-sentiment-reaction.ts
var agent_sentiment_reaction_exports = {};
__export(agent_sentiment_reaction_exports, {
  pickReactionEmoji: () => pickReactionEmoji,
  shouldListenToAudio: () => shouldListenToAudio,
  shouldReactToSentiment: () => shouldReactToSentiment
});
function pickReactionEmoji(message2, sentimento) {
  const texto = String(message2 ?? "");
  for (const s of SINAIS) if (s.re.test(texto)) return s.emoji;
  return EMOJI_PADRAO[sentimento] ?? "\u{1F44D}";
}
function shouldReactToSentiment(allowedActions) {
  return Array.isArray(allowedActions) && allowedActions.includes("reagir-sentimento");
}
function shouldListenToAudio(allowedActions) {
  if (!Array.isArray(allowedActions)) return true;
  if (allowedActions.includes("ouvir-audio")) return true;
  return allowedActions.length === 0;
}
var EMOJI_PADRAO, SINAIS;
var init_agent_sentiment_reaction = __esm({
  "copied-server-source/lib/agent-sentiment-reaction.ts"() {
    EMOJI_PADRAO = {
      positivo: "\u2764\uFE0F",
      negativo: "\u{1F614}",
      neutro: "\u{1F44D}"
    };
    SINAIS = [
      { re: /\b(obrigad|valeu|agradeç|gratid)/i, emoji: "\u{1F64F}" },
      { re: /\b(kkk+|haha+|rsrs+|😂|🤣)/i, emoji: "\u{1F602}" },
      { re: /\b(fechado|fechou|bora|vamos que vamos|top demais|perfeito)\b/i, emoji: "\u{1F525}" },
      { re: /\b(parab[ée]ns|comemor|consegui)\b/i, emoji: "\u{1F389}" },
      { re: /\b(caro|car[íi]ssimo|sem dinheiro|apertad)/i, emoji: "\u{1F615}" },
      { re: /\b(urgente|agora mesmo|correndo)\b/i, emoji: "\u26A1" }
    ];
  }
});

// copied-server-source/lib/external-automations-events.ts
function normalizeOptions(raw, provider) {
  const o = raw ?? {};
  const supportsSig = PROVIDER_META[provider].supportsSignature;
  return {
    signOutbound: typeof o.signOutbound === "boolean" ? o.signOutbound : supportsSig,
    authHeaderName: typeof o.authHeaderName === "string" ? o.authHeaderName : "",
    authHeaderValue: typeof o.authHeaderValue === "string" ? o.authHeaderValue : "",
    extraHeaders: Array.isArray(o.extraHeaders) ? o.extraHeaders.filter((h) => !!h && typeof h.key === "string").slice(0, 10) : [],
    retries: typeof o.retries === "number" ? Math.min(Math.max(o.retries, 0), 3) : 1,
    requireInboundSignature: typeof o.requireInboundSignature === "boolean" ? o.requireInboundSignature : supportsSig
  };
}
var PROVIDER_META;
var init_external_automations_events = __esm({
  "copied-server-source/lib/external-automations-events.ts"() {
    PROVIDER_META = {
      n8n: {
        label: "n8n",
        docHint: "Use o n\xF3 Webhook do n8n como gatilho do workflow.",
        docUrl: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/",
        outboundPlaceholder: "https://n8n.suaempresa.com/webhook/mkton",
        supportsSignature: true,
        steps: [
          "Abra sua inst\xE2ncia n8n e crie um workflow novo.",
          "Adicione o n\xF3 Webhook como gatilho e escolha o m\xE9todo POST.",
          "Copie a Production URL do n\xF3 e cole no campo de URL aqui embaixo.",
          "Marque os eventos que o MKTOn deve enviar e ative o disparo.",
          "Clique em Enviar teste e confira o log logo abaixo.",
          "Para o n8n mandar a\xE7\xF5es de volta, use um n\xF3 HTTP Request apontando para a URL inbound."
        ],
        tips: [
          "A assinatura HMAC vem no header X-MKTOn-Signature. No n8n voc\xEA pode validar com um n\xF3 Code.",
          "Se o workflow estiver inativo, o n8n s\xF3 aceita a Test URL. Ative o workflow para usar a Production URL."
        ]
      },
      make: {
        label: "Make",
        docHint: "Use o m\xF3dulo Webhooks (Custom Webhook) como gatilho do cen\xE1rio.",
        docUrl: "https://www.make.com/en/help/tools/webhooks",
        outboundPlaceholder: "https://hook.eu2.make.com/xxxxxxxxxxxxxxxx",
        supportsSignature: true,
        steps: [
          "Acesse make.com e crie um cen\xE1rio novo.",
          "Adicione o m\xF3dulo Webhooks, op\xE7\xE3o Custom webhook, e clique em Add.",
          "Copie a URL gerada e cole no campo de URL aqui embaixo.",
          "Marque os eventos, ative o disparo e clique em Enviar teste.",
          "No Make, clique em Redetermine data structure antes do teste para ele aprender o formato.",
          "Para o Make agir de volta no MKTOn, use o m\xF3dulo HTTP apontando para a URL inbound."
        ],
        tips: [
          "O Make s\xF3 grava a estrutura do payload no primeiro teste recebido.",
          "Deixe o cen\xE1rio ligado (scheduling ON) para receber eventos em produ\xE7\xE3o."
        ]
      },
      zapier: {
        label: "Zapier",
        docHint: "Use o trigger Webhooks by Zapier, op\xE7\xE3o Catch Hook.",
        docUrl: "https://help.zapier.com/hc/en-us/articles/8496288690317",
        outboundPlaceholder: "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
        supportsSignature: false,
        steps: [
          "Acesse zapier.com e crie um Zap novo.",
          "Escolha o trigger Webhooks by Zapier e o evento Catch Hook.",
          "Copie a Custom Webhook URL e cole no campo de URL aqui embaixo.",
          "Marque os eventos, ative o disparo e clique em Enviar teste.",
          "Volte no Zapier e clique em Test trigger para ele capturar o payload.",
          "Monte as a\xE7\xF5es do Zap normalmente usando os campos recebidos."
        ],
        tips: [
          "O Zapier n\xE3o valida assinatura HMAC. Ela continua sendo enviada no header, mas voc\xEA pode desligar.",
          "Para o Zapier agir de volta no MKTOn, use a a\xE7\xE3o Webhooks by Zapier, POST, apontando para a URL inbound."
        ]
      },
      custom: {
        label: "Webhook personalizado",
        docHint: "Conecte qualquer plataforma que fale HTTP: sistemas pr\xF3prios, ERPs, Pipedream, Retool e afins.",
        outboundPlaceholder: "https://api.suaempresa.com/hooks/mkton",
        supportsSignature: true,
        steps: [
          "Crie um endpoint HTTP POST na plataforma ou sistema de destino.",
          "Cole a URL desse endpoint no campo de URL aqui embaixo.",
          "Se o destino exigir autentica\xE7\xE3o, preencha o header de autentica\xE7\xE3o (ex.: Authorization: Bearer ...).",
          "Adicione headers extras se a plataforma precisar (ex.: X-Api-Key, Content-Language).",
          "Marque os eventos, ative o disparo e envie um teste.",
          "Para receber comandos de volta, use a URL inbound com as a\xE7\xF5es suportadas."
        ],
        tips: [
          "Payload sempre em JSON: { event, workspace_id, occurred_at, data }.",
          "Assinatura HMAC-SHA256 do corpo vai no header X-MKTOn-Signature (pode ser desligada).",
          "Voc\xEA pode configurar novas tentativas autom\xE1ticas em caso de erro do destino."
        ]
      }
    };
  }
});

// copied-server-source/lib/salesbot-webhook.server.ts
var salesbot_webhook_server_exports = {};
__export(salesbot_webhook_server_exports, {
  executeSalesbotWebhook: () => executeSalesbotWebhook,
  parseSalesbotWebhookResponse: () => parseSalesbotWebhookResponse,
  validateSalesbotWebhookUrl: () => validateSalesbotWebhookUrl
});
import { createHmac } from "crypto";
function validateSalesbotWebhookUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL inv\xE1lida. Use o endere\xE7o completo com https://");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("A URL precisa come\xE7ar com https://");
  }
  const host = parsed.hostname.toLowerCase();
  const isPrivate = host === "localhost" || host === "0.0.0.0" || host === "::1" || host.endsWith(".local") || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (isPrivate) throw new Error("Endere\xE7os internos n\xE3o s\xE3o permitidos.");
  return parsed;
}
function parseSalesbotWebhookResponse(text) {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
async function executeSalesbotWebhook(input) {
  const url = validateSalesbotWebhookUrl(input.url);
  const method = input.method ?? "POST";
  const timeoutMs = Math.max(1e3, Math.min(3e4, input.timeoutMs ?? 15e3));
  const retries = Math.max(0, Math.min(3, input.retries ?? 0));
  const body = JSON.stringify(input.body);
  const headers = {
    "Content-Type": "application/json",
    ...input.headers ?? {}
  };
  if (input.secret) {
    const signature = "sha256=" + createHmac("sha256", input.secret).update(body).digest("hex");
    headers["X-MKTOn-Signature"] = signature;
    headers["X-MktOn-Signature"] = signature;
  }
  let status = null;
  let responseText = "";
  let error = null;
  let attempts = 0;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    attempts = attempt + 1;
    status = null;
    responseText = "";
    error = null;
    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs)
      });
      status = response.status;
      responseText = (await response.text().catch(() => "")).slice(0, 2e4);
      if (response.ok) {
        return {
          ok: true,
          status,
          responseText,
          responseJson: parseSalesbotWebhookResponse(responseText),
          error: null,
          attempts
        };
      }
      error = `HTTP ${response.status}`;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable) break;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  return {
    ok: false,
    status,
    responseText,
    responseJson: parseSalesbotWebhookResponse(responseText),
    error,
    attempts
  };
}
var init_salesbot_webhook_server = __esm({
  "copied-server-source/lib/salesbot-webhook.server.ts"() {
  }
});

// copied-server-source/lib/salesbot-external-automation.server.ts
var salesbot_external_automation_server_exports = {};
__export(salesbot_external_automation_server_exports, {
  executeConnectedSalesbotAutomation: () => executeConnectedSalesbotAutomation
});
async function executeConnectedSalesbotAutomation(args) {
  const { data: row, error: loadError } = await args.supabaseAdmin.from("external_automations").select("id, provider, outbound_url, inbound_secret, metadata, status").eq("id", args.automationId).eq("workspace_id", args.workspaceId).eq("status", "connected").maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (!row) throw new Error("Integra\xE7\xE3o externa n\xE3o encontrada neste workspace ou est\xE1 desconectada.");
  const provider = row.provider;
  if (args.provider && provider !== args.provider) {
    throw new Error("A integra\xE7\xE3o selecionada n\xE3o corresponde ao provedor configurado no bloco.");
  }
  if (!row.outbound_url) throw new Error("A integra\xE7\xE3o selecionada n\xE3o possui URL de sa\xEDda configurada.");
  const options = normalizeOptions(
    (row.metadata ?? {}).options,
    provider
  );
  const headers = {
    "X-MktOn-Event": args.event?.trim() || "salesbot.external_action",
    "X-MktOn-Workspace": args.workspaceId
  };
  if (options.authHeaderName.trim() && options.authHeaderValue.trim()) {
    headers[options.authHeaderName.trim()] = options.authHeaderValue.trim();
  }
  for (const header of options.extraHeaders) {
    if (header.key.trim() && header.value.trim()) headers[header.key.trim()] = header.value.trim();
  }
  let result;
  try {
    result = await executeSalesbotWebhook({
      url: row.outbound_url,
      method: "POST",
      secret: options.signOutbound ? row.inbound_secret : null,
      headers,
      body: args.payload,
      timeoutMs: args.timeoutMs ?? 15e3,
      retries: options.retries
    });
  } catch (caught) {
    result = {
      ok: false,
      status: null,
      responseText: "",
      responseJson: null,
      error: caught instanceof Error ? caught.message : String(caught),
      attempts: 0
    };
  }
  await args.supabaseAdmin.from("external_automation_logs").insert({
    workspace_id: args.workspaceId,
    automation_id: row.id,
    provider,
    direction: "outbound",
    event: args.event?.trim() || "salesbot.external_action",
    payload: args.payload,
    response: result.responseJson ?? (result.responseText ? { body: result.responseText } : null),
    http_status: result.status,
    status: result.ok ? "ok" : "failed",
    error: result.error
  });
  if (result.ok) {
    await args.supabaseAdmin.from("external_automations").update({ last_success_at: (/* @__PURE__ */ new Date()).toISOString(), last_error: null }).eq("id", row.id).eq("workspace_id", args.workspaceId);
  } else {
    await args.supabaseAdmin.from("external_automations").update({ last_error: result.error ?? (result.status ? `HTTP ${result.status}` : "Falha na execu\xE7\xE3o") }).eq("id", row.id).eq("workspace_id", args.workspaceId);
  }
  return {
    ...result,
    automationId: row.id,
    provider
  };
}
var init_salesbot_external_automation_server = __esm({
  "copied-server-source/lib/salesbot-external-automation.server.ts"() {
    init_external_automations_events();
    init_salesbot_webhook_server();
  }
});

// copied-server-source/lib/evolution-groups.server.ts
var evolution_groups_server_exports = {};
__export(evolution_groups_server_exports, {
  deleteGroupMessage: () => deleteGroupMessage,
  fetchGroupInfo: () => fetchGroupInfo,
  leaveGroup: () => leaveGroup,
  mentionEveryone: () => mentionEveryone,
  sendGroupPoll: () => sendGroupPoll,
  toggleEphemeral: () => toggleEphemeral,
  updateGroupDescription: () => updateGroupDescription,
  updateGroupParticipants: () => updateGroupParticipants,
  updateGroupPicture: () => updateGroupPicture,
  updateGroupSetting: () => updateGroupSetting,
  updateGroupSubject: () => updateGroupSubject
});
async function call(ctx, method, path, body) {
  const base = ctx.baseUrl.replace(/\/+$/, "");
  const url = `${base}${path}`;
  try {
    const resp = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", apikey: ctx.apiKey },
      body: body ? JSON.stringify(body) : void 0
    });
    const text = await resp.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 400) };
    }
    if (!resp.ok) {
      const j = json;
      const msg = Array.isArray(j?.message) ? j.message.join(", ") : j?.message ?? j?.error ?? j?.response?.message ?? `HTTP ${resp.status}`;
      return { ok: false, status: resp.status, error: String(msg) };
    }
    return { ok: true, status: resp.status, data: json };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}
function normalizeParticipants(list, groupJid) {
  return list.map((raw) => {
    const t = String(raw ?? "").trim();
    if (!t) return "";
    if (t.includes("@")) return t;
    const digits = t.replace(/\D/g, "");
    return `${digits}@s.whatsapp.net`;
  }).filter(Boolean).filter((v) => v !== groupJid);
}
function deleteGroupMessage(ctx, args) {
  return call(ctx, "DELETE", `/chat/deleteMessageForEveryone/${encodeURIComponent(ctx.instance)}`, {
    id: args.messageId,
    remoteJid: args.groupJid,
    participant: args.participant,
    fromMe: args.fromMe
  });
}
function updateGroupParticipants(ctx, args) {
  const parts = normalizeParticipants(args.participants, args.groupJid);
  if (!parts.length) return Promise.resolve({ ok: false, status: 400, error: "Nenhum participante v\xE1lido" });
  return call(
    ctx,
    "POST",
    `/group/updateParticipant/${encodeURIComponent(ctx.instance)}?groupJid=${encodeURIComponent(args.groupJid)}`,
    { action: args.action, participants: parts }
  );
}
function updateGroupSubject(ctx, args) {
  return call(
    ctx,
    "POST",
    `/group/updateGroupSubject/${encodeURIComponent(ctx.instance)}?groupJid=${encodeURIComponent(args.groupJid)}`,
    { subject: args.subject }
  );
}
function updateGroupDescription(ctx, args) {
  return call(
    ctx,
    "POST",
    `/group/updateGroupDescription/${encodeURIComponent(ctx.instance)}?groupJid=${encodeURIComponent(args.groupJid)}`,
    { description: args.description }
  );
}
function updateGroupPicture(ctx, args) {
  return call(
    ctx,
    "POST",
    `/group/updateGroupPicture/${encodeURIComponent(ctx.instance)}?groupJid=${encodeURIComponent(args.groupJid)}`,
    { image: args.image }
  );
}
function updateGroupSetting(ctx, args) {
  return call(
    ctx,
    "POST",
    `/group/updateSetting/${encodeURIComponent(ctx.instance)}?groupJid=${encodeURIComponent(args.groupJid)}`,
    { action: args.action }
  );
}
function toggleEphemeral(ctx, args) {
  return call(
    ctx,
    "POST",
    `/group/toggleEphemeral/${encodeURIComponent(ctx.instance)}?groupJid=${encodeURIComponent(args.groupJid)}`,
    { expiration: args.expiration }
  );
}
function leaveGroup(ctx, args) {
  return call(
    ctx,
    "DELETE",
    `/group/leaveGroup/${encodeURIComponent(ctx.instance)}?groupJid=${encodeURIComponent(args.groupJid)}`
  );
}
function sendGroupPoll(ctx, args) {
  const values = args.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 12);
  if (values.length < 2) return Promise.resolve({ ok: false, status: 400, error: "Enquete precisa de 2+ op\xE7\xF5es" });
  return call(ctx, "POST", `/message/sendPoll/${encodeURIComponent(ctx.instance)}`, {
    number: args.groupJid,
    name: args.name.slice(0, 255),
    selectableCount: Math.max(1, Math.min(values.length, args.selectableCount ?? 1)),
    values
  });
}
function mentionEveryone(ctx, args) {
  return call(ctx, "POST", `/message/sendText/${encodeURIComponent(ctx.instance)}`, {
    number: args.groupJid,
    text: args.text,
    mentionsEveryOne: true
  });
}
function fetchGroupInfo(ctx, args) {
  return call(
    ctx,
    "GET",
    `/group/findGroupInfos/${encodeURIComponent(ctx.instance)}?groupJid=${encodeURIComponent(args.groupJid)}`
  );
}
var init_evolution_groups_server = __esm({
  "copied-server-source/lib/evolution-groups.server.ts"() {
  }
});

// copied-server-source/lib/salesbot-runtime.server.ts
var salesbot_runtime_server_exports = {};
__export(salesbot_runtime_server_exports, {
  classifyWhatsappRemoteJid: () => classifyWhatsappRemoteJid,
  computePausaCronometroMs: () => computePausaCronometroMs,
  dispatchCustomFieldChanged: () => dispatchCustomFieldChanged,
  dispatchFormSubmitted: () => dispatchFormSubmitted,
  dispatchGroupParticipantEvent: () => dispatchGroupParticipantEvent,
  dispatchInboundMessage: () => dispatchInboundMessage,
  dispatchLeadCreated: () => dispatchLeadCreated,
  dispatchMetaLeadAd: () => dispatchMetaLeadAd,
  dispatchSocialInteraction: () => dispatchSocialInteraction,
  dispatchStageChange: () => dispatchStageChange,
  dispatchTagAdded: () => dispatchTagAdded,
  dispatchTrackingEvent: () => dispatchTrackingEvent,
  dispatchWebhookSent: () => dispatchWebhookSent,
  executeRun: () => executeRun,
  resumeRunsOnFormSubmission: () => resumeRunsOnFormSubmission,
  resumeRunsOnInboundMessage: () => resumeRunsOnInboundMessage,
  resumeRunsOnMediaEvent: () => resumeRunsOnMediaEvent,
  sendWhatsappText: () => sendWhatsappText,
  startSalesbotRun: () => startSalesbotRun,
  tickAiAgentInactivity: () => tickAiAgentInactivity,
  tickAiAgentTracking: () => tickAiAgentTracking,
  tickWaitingTimers: () => tickWaitingTimers
});
function classifyWhatsappRemoteJid(remoteJid) {
  if (!remoteJid) return "unknown";
  if (remoteJid.endsWith("@g.us")) return "group";
  if (remoteJid.endsWith("@s.whatsapp.net")) return "x1";
  if (remoteJid.endsWith("@broadcast")) return "broadcast";
  if (remoteJid === "status@broadcast") return "status";
  return "unknown";
}
function normalizeButtonText(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function findLatestSentMedia(value, kind) {
  if (!Array.isArray(value)) return void 0;
  for (let index = value.length - 1; index >= 0; index--) {
    const item = value[index];
    if (item?.kind === kind && typeof item.messageId === "string") return item;
  }
  return void 0;
}
async function resolveSalesbotId(supabaseAdmin2, workspaceId, candidate) {
  const id = candidate.trim();
  if (!id) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (isUuid) {
    const { data } = await supabaseAdmin2.from("salesbots").select("id").eq("workspace_id", workspaceId).eq("id", id).maybeSingle();
    if (data?.id) return data.id;
  }
  const { data: byLocal } = await supabaseAdmin2.from("salesbots").select("id").eq("workspace_id", workspaceId).eq("local_id", id).maybeSingle();
  return byLocal?.id ?? null;
}
async function log(supabaseAdmin2, run, block, status, message2, payload) {
  return supabaseAdmin2.from("salesbot_run_logs").insert({
    workspace_id: run.workspace_id,
    salesbot_run_id: run.id,
    block_id: block?.id ?? null,
    status,
    message: message2 ?? null,
    payload: payload ?? {}
  });
}
async function loadBlocks(supabaseAdmin2, salesbotId) {
  const { data } = await supabaseAdmin2.from("salesbot_blocks").select("id, type, config, next_block_id").eq("salesbot_id", salesbotId);
  return (data ?? []).map((b) => ({
    ...b,
    config: b.config ?? {}
  }));
}
async function loadLead(supabaseAdmin2, leadId, workspaceId) {
  const { data } = await supabaseAdmin2.from("leads").select("id, name, email, phone, phone_normalized, responsible_id, stage_id, pipeline_id, tags, workspace_id, source, crm_source_id, custom_data, instagram_igsid, messenger_psid, status, crm_sources(provider)").eq("id", leadId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data) return null;
  const d = data;
  return { ...d, source_provider: d.crm_sources?.provider ?? null };
}
async function leadMatchesOrigin(supabaseAdmin2, lead, value) {
  if (!value) return false;
  const l = lead;
  const [kind, ...rest] = value.split(":");
  const ref = rest.join(":");
  const custom = l.custom_data ?? {};
  if (!ref) return String(l.source ?? "") === value || String(l.crm_source_id ?? "") === value;
  switch (kind) {
    case "whatsapp": {
      if (String(custom["whatsapp_session_id"] ?? "") === ref) return true;
      const phone = l.phone_normalized ?? (l.phone ? l.phone.replace(/\D/g, "") : null);
      if (!phone) return false;
      const directJid = `${phone}@s.whatsapp.net`;
      const { data } = await supabaseAdmin2.from("whatsapp_web_messages").select("id").eq("workspace_id", l.workspace_id).eq("session_id", ref).or(
        `sender_phone.eq.${phone},remote_jid.eq.${directJid},to_jid.eq.${directJid}`
      ).limit(1);
      return Array.isArray(data) && data.length > 0;
    }
    case "instagram":
      return String(custom["ig_account_id"] ?? custom["page_id"] ?? "") === ref || !!l.instagram_igsid && String(custom["page_id"] ?? "") === ref;
    case "messenger":
      return !!l.messenger_psid && String(custom["page_id"] ?? "") === ref;
    case "form":
      return String(custom["form_id"] ?? "") === ref;
    case "crm":
      return String(l.crm_source_id ?? "") === ref;
    case "channel":
      return String(l.source ?? "") === ref;
    default:
      return String(l.source ?? "") === value;
  }
}
function findStartBlock(blocks) {
  if (!blocks.length) return null;
  const markedStart = blocks.find((b) => b.config.isStartBlock === true || b.is_start === true);
  if (markedStart) return markedStart;
  const referenced = new Set(blocks.map((b) => b.next_block_id).filter(Boolean));
  const roots = blocks.filter((b) => !referenced.has(b.id));
  return roots[0] ?? blocks[0];
}
function findBlockById(blocks, id) {
  if (!id) return null;
  return blocks.find((b) => b.id === id) ?? null;
}
function computeCronometroMs(cfg) {
  return computePausaCronometroMs(cfg);
}
function computePausaCronometroMs(pausa, nowOverride) {
  const n = (k) => {
    const v = Number(pausa[k] ?? 0);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const seg = n("seg") || n("pausaSeg");
  const min = n("min") || n("pausaMin");
  const hor = n("horas") || n("pausaHoras");
  const dias = n("dias") || n("pausaDias");
  const semanas = n("semanas") || n("pausaSemanas");
  const mesesRaw = n("meses") || n("pausaMeses");
  const anosRaw = n("anos") || n("pausaAnos");
  const totalMonths = Math.min(mesesRaw + anosRaw * 12, 48);
  const addCalendarMonths = (date, m) => {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + m);
    if (d.getDate() !== day) d.setDate(0);
    return d;
  };
  const now = nowOverride || /* @__PURE__ */ new Date();
  const maxDate = addCalendarMonths(now, 48);
  const maxAllowedMs = maxDate.getTime() - now.getTime();
  const targetDate = addCalendarMonths(now, totalMonths);
  const S = 1e3, M = 60 * S, H = 60 * M, D = 24 * H;
  const baseMs = targetDate.getTime() - now.getTime();
  const extraMs = seg * S + min * M + hor * H + dias * D + semanas * 7 * D;
  const totalMs = baseMs + extraMs;
  return Math.min(totalMs, maxAllowedMs);
}
function evalValidationRule(tipo, ref, val) {
  const raw = val.trim();
  const wanted = ref.trim();
  switch (tipo) {
    case "contem":
      return !!wanted && val.toLowerCase().includes(ref.toLowerCase());
    case "nao-contem":
      return !!wanted && !val.toLowerCase().includes(ref.toLowerCase());
    case "desigual":
      return !!wanted && val !== ref;
    case "comprimento":
      return !!wanted && val.length === Number(ref || 0);
    case "regex": {
      if (!wanted) return false;
      try {
        return new RegExp(ref).test(val);
      } catch {
        return false;
      }
    }
    case "numero":
      return !!wanted && /^-?\d+(\.\d+)?$/.test(raw) && Number(raw) === Number(wanted);
    case "letra":
      return !!wanted && /^[\p{L}\s]+$/u.test(raw) && raw.toLowerCase() === wanted.toLowerCase();
    case "palavra":
      return !!wanted && new RegExp("^\\p{L}+$", "u").test(raw) && raw.toLowerCase() === wanted.toLowerCase();
    case "telefone": {
      const digits = val.replace(/\D/g, "");
      const refDigits = ref.replace(/\D/g, "");
      return !!refDigits && digits.length >= 8 && digits.includes(refDigits);
    }
    case "email":
      return !!wanted && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) && raw.toLowerCase().includes(wanted.toLowerCase());
    case "gama": {
      const [a, b] = ref.split("-").map((n2) => Number(n2.trim()));
      const n = Number(val);
      return Number.isFinite(n) && n >= a && n <= b;
    }
    default:
      return false;
  }
}
async function checkTrackingEvent(supabaseAdmin2, workspaceId, leadId, eventName, minutes = 10080) {
  const since = new Date(Date.now() - minutes * 6e4).toISOString();
  const { data } = await supabaseAdmin2.from("tracking_events").select("id").eq("workspace_id", workspaceId).eq("lead_id", leadId).eq("event_name", eventName).gte("created_at", since).limit(1);
  return Array.isArray(data) && data.length > 0;
}
async function evalValidacaoRegra(supabaseAdmin2, run, lead, r) {
  const alvo = r.alvo ?? "mensagem";
  const tipo = r.tipo ?? "contem";
  const valorRef = r.valor ?? "";
  let valorReal = "";
  switch (alvo) {
    case "mensagem":
      valorReal = String(run.variables.last_message ?? "");
      break;
    case "nome":
      valorReal = lead.name ?? "";
      break;
    case "email":
      valorReal = lead.email ?? "";
      break;
    case "telefone":
      valorReal = lead.phone ?? "";
      break;
    case "empresa":
      valorReal = lead.empresa ?? "";
      break;
    case "responsavel":
      valorReal = lead.responsible_id ?? "";
      break;
    case "etapa":
      valorReal = lead.stage_id ?? "";
      break;
    case "tag": {
      const tags = Array.isArray(lead.tags) ? lead.tags : [];
      return tags.some((t) => String(t).toLowerCase() === valorRef.toLowerCase());
    }
    case "campo": {
      if (!r.campoId) return false;
      const { data } = await supabaseAdmin2.from("lead_custom_field_values").select("value").eq("lead_id", lead.id).eq("field_id", r.campoId).maybeSingle();
      valorReal = customValueToText(data?.value);
      break;
    }
    case "tracking-evento": {
      if (!valorRef) return false;
      const parts = valorRef.split(":");
      const evt = parts[0].trim();
      const mins = parts[1] ? Number(parts[1]) : 10080;
      return checkTrackingEvent(supabaseAdmin2, run.workspace_id, lead.id, evt, mins);
    }
    case "tracking-pageview": {
      if (!valorRef) return false;
      const parts = valorRef.split(":");
      const urlPart = parts[0].trim();
      const mins = parts[1] ? Number(parts[1]) : 10080;
      const since = new Date(Date.now() - mins * 6e4).toISOString();
      const { data } = await supabaseAdmin2.from("tracking_events").select("id").eq("workspace_id", run.workspace_id).eq("lead_id", lead.id).eq("event_name", "pageview").ilike("url", `%${urlPart}%`).gte("created_at", since).limit(1);
      return Array.isArray(data) && data.length > 0;
    }
    case "tracking-tempo": {
      if (!valorRef) return false;
      const parts = valorRef.split(":");
      const minTotal = Number(parts[0]);
      const urlPart = parts[1] ? parts[1].trim() : null;
      if (isNaN(minTotal)) return false;
      let q = supabaseAdmin2.from("tracking_events").select("payload").eq("workspace_id", run.workspace_id).eq("lead_id", lead.id).eq("event_name", "pageview");
      if (urlPart) q = q.ilike("url", `%${urlPart}%`);
      const { data } = await q;
      const totalSeconds = (data ?? []).reduce((acc, row) => {
        const dur = Number(row.payload?.duration_seconds ?? 0);
        return acc + dur;
      }, 0);
      return totalSeconds >= minTotal * 60;
    }
    case "tracking-produto": {
      if (!valorRef) return false;
      const parts = valorRef.split(":");
      const productId = parts[0].trim();
      const type = (parts[1] || "compra").trim().toLowerCase();
      const eventName = type === "interesse" ? "view_item" : "purchase";
      const { data } = await supabaseAdmin2.from("tracking_events").select("id").eq("workspace_id", run.workspace_id).eq("lead_id", lead.id).eq("event_name", eventName).filter("payload->>product_id", "eq", productId).limit(1);
      return Array.isArray(data) && data.length > 0;
    }
    case "social-ativo": {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString();
      const { count } = await supabaseAdmin2.from("channel_messages").select("id", { count: "exact", head: true }).eq("workspace_id", run.workspace_id).eq("lead_id", lead.id).in("channel", ["instagram", "messenger"]).gte("created_at", since);
      return (count ?? 0) > 0;
    }
    case "social-segue": {
      const custom = lead.custom_data ?? {};
      return !!lead.instagram_igsid && (custom.is_follower === true || custom.followed_at != null);
    }
    case "lead-produto": {
      if (!valorRef) return false;
      const parts = valorRef.split(":");
      const productId = parts[0].trim();
      const kind = (parts[1] || "interesse").trim().toLowerCase();
      const { data } = await supabaseAdmin2.from("lead_products").select("id").eq("workspace_id", run.workspace_id).eq("lead_id", lead.id).eq("product_id", productId).eq("kind", kind).limit(1);
      return Array.isArray(data) && data.length > 0;
    }
    default:
      return false;
  }
  return evalValidationRule(tipo, valorRef, valorReal);
}
function slugVar(input) {
  return (input ?? "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function resolveMentionTokens(text, lead, vars) {
  return text.replace(/\{@\s*([\w.\-]+)\s*\}/g, (_m, rawKey) => {
    const key = String(rawKey).trim().toLowerCase().replace(/-/g, "_");
    if (key === "todos" || key === "everyone" || key === "all") return "{@todos}";
    if (key === "admins" || key === "administradores" || key === "adm") return "{@admins}";
    const pick = (v) => String(v ?? "").replace(/\D/g, "");
    let digits = "";
    if (/^\d{8,}$/.test(key)) digits = key;
    else if (key === "participante" || key === "remetente" || key === "autor")
      digits = pick(vars.participante_telefone ?? vars.remetente_telefone ?? vars.ultimo_remetente ?? lead.phone);
    else if (key === "membro" || key === "novo_membro" || key === "bemvindo" || key === "bem_vindo" || key === "novo")
      digits = pick(vars.participante_telefone ?? vars.membro_telefone);
    else if (key === "lead") digits = pick(lead.phone);
    return digits ? `{@${digits}}` : "";
  });
}
function interpolate(text, lead, vars) {
  const withMentions = resolveMentionTokens(text, lead, vars);
  return withMentions.replace(/\{\{\s*([\w.:\- ]+)\s*\}\}/g, (_m, rawKey) => {
    const key = String(rawKey).trim();
    if (key.startsWith("campo:")) {
      const slug = slugVar(key.slice("campo:".length));
      const v2 = vars[`campo:${slug}`];
      return v2 == null ? "" : String(v2);
    }
    const map = {
      nome: lead.name ?? "",
      name: lead.name ?? "",
      email: lead.email ?? "",
      telefone: lead.phone ?? "",
      phone: lead.phone ?? "",
      ...vars
    };
    const v = map[key];
    return v == null ? "" : String(v);
  });
}
function customValueToText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const v = value;
    if (typeof v.display === "string") return v.display;
    if (Array.isArray(v.raw)) return v.raw.map(String).join(", ");
  }
  return String(value);
}
async function loadLeadCustomFieldById(supabaseAdmin2, workspaceId, leadId) {
  const { data } = await supabaseAdmin2.from("lead_custom_field_values").select("field_id, value, lead_custom_fields(name, field_type)").eq("workspace_id", workspaceId).eq("lead_id", leadId);
  const rows = data ?? [];
  const out = {};
  for (const r of rows) {
    if (!r.field_id) continue;
    out[r.field_id] = {
      name: r.lead_custom_fields?.name ?? "Campo personalizado",
      value: customValueToText(r.value),
      field_type: r.lead_custom_fields?.field_type ?? "texto"
    };
  }
  return out;
}
async function loadLeadCustomFieldMap(supabaseAdmin2, workspaceId, leadId) {
  const { data } = await supabaseAdmin2.from("lead_custom_field_values").select("value, lead_custom_fields(name)").eq("workspace_id", workspaceId).eq("lead_id", leadId);
  const rows = data ?? [];
  const out = {};
  for (const r of rows) {
    const nm = r.lead_custom_fields?.name;
    if (!nm) continue;
    out[`campo:${slugVar(nm)}`] = customValueToText(r.value);
  }
  return out;
}
async function resolveRuntimeWhatsappTarget(supabaseAdmin2, workspaceId, leadId, fallbackPhone) {
  const { data: leadRouteRow } = await supabaseAdmin2.from("leads").select("custom_data").eq("workspace_id", workspaceId).eq("id", leadId).maybeSingle();
  const customData = leadRouteRow?.custom_data ?? {};
  const preferredSessionId = typeof customData.whatsapp_session_id === "string" && customData.whatsapp_session_id.trim() ? customData.whatsapp_session_id.trim() : null;
  const conversation = await findLatestLeadWhatsappIdentity(supabaseAdmin2, { workspaceId, leadId });
  if (conversation) {
    const sessionId2 = await resolveLeadEvolutionSession(supabaseAdmin2, {
      workspaceId,
      preferredSessionId: conversation.sessionId ?? preferredSessionId
    });
    return {
      phone: conversation.kind === "group" ? conversation.remoteJid : conversation.number,
      remoteJid: conversation.remoteJid,
      sessionId: sessionId2,
      conversationKey: `${sessionId2}:${conversation.remoteJid.trim().toLowerCase()}`,
      source: conversation.kind === "group" ? "group_jid" : "conversation_jid"
    };
  }
  const jidIdentity = whatsappIdentityFromJid(fallbackPhone);
  if (jidIdentity) {
    let lastMessageQuery = supabaseAdmin2.from("whatsapp_web_messages").select("session_id").eq("workspace_id", workspaceId);
    lastMessageQuery = jidIdentity.kind === "group" ? lastMessageQuery.eq("remote_jid", jidIdentity.remoteJid) : lastMessageQuery.or(
      `sender_phone.eq.${jidIdentity.digits},remote_jid.eq.${jidIdentity.remoteJid},to_jid.eq.${jidIdentity.remoteJid}`
    );
    const { data: lastMessage } = await lastMessageQuery.order("received_at", { ascending: false }).limit(1).maybeSingle();
    const messageSessionId = lastMessage?.session_id?.trim() || null;
    const sessionId2 = await resolveLeadEvolutionSession(supabaseAdmin2, {
      workspaceId,
      preferredSessionId: messageSessionId ?? preferredSessionId
    });
    return {
      phone: jidIdentity.kind === "group" ? jidIdentity.remoteJid : jidIdentity.number,
      remoteJid: jidIdentity.remoteJid,
      sessionId: sessionId2,
      conversationKey: `${sessionId2}:${jidIdentity.remoteJid.trim().toLowerCase()}`,
      source: jidIdentity.kind === "group" ? "group_jid" : "conversation_jid"
    };
  }
  const normalized = normalizeInternationalPhone(fallbackPhone);
  if (!normalized.ok) return null;
  const remoteJid = `${normalized.digits}@s.whatsapp.net`;
  const sessionId = await resolveLeadEvolutionSession(supabaseAdmin2, {
    workspaceId,
    preferredSessionId
  });
  return {
    phone: normalized.digits,
    remoteJid,
    sessionId,
    conversationKey: `${sessionId}:${remoteJid.toLowerCase()}`,
    source: "explicit_phone"
  };
}
async function sendLeadWhatsappText(supabaseAdmin2, workspaceId, leadId, fallbackPhone, text) {
  const route = await resolveRuntimeWhatsappTarget(
    supabaseAdmin2,
    workspaceId,
    leadId,
    fallbackPhone
  );
  if (!route) {
    return {
      ok: false,
      error: "Identidade WhatsApp amb\xEDgua: informe DDI expl\xEDcito ou use uma conversa com JID real."
    };
  }
  return sendWhatsappText(
    supabaseAdmin2,
    workspaceId,
    route.phone,
    text,
    route.sessionId
  );
}
async function sendWhatsappText(supabaseAdmin2, workspaceId, phone, text, sessionId) {
  const encKey = runtimeEnv("INTEGRATION_ENCRYPTION_KEY");
  if (!encKey) return { ok: false, error: "INTEGRATION_ENCRYPTION_KEY ausente" };
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 8 && !phone?.includes("@g.us")) return { ok: false, error: "Telefone inv\xE1lido" };
  let sessionQuery = supabaseAdmin2.from("whatsapp_web_sessions").select("id").eq("workspace_id", workspaceId).eq("provider", "evolution").eq("status", "conectado");
  if (sessionId) sessionQuery = sessionQuery.eq("id", sessionId);
  else sessionQuery = sessionQuery.order("last_connected_at", { ascending: false }).limit(1);
  const { data: sess } = await sessionQuery.maybeSingle();
  const sessId = sess?.id;
  if (!sessId) {
    return {
      ok: false,
      error: sessionId ? "Sess\xE3o Evolution informada n\xE3o est\xE1 conectada neste workspace" : "Nenhuma sess\xE3o Evolution conectada"
    };
  }
  const { data: creds } = await supabaseAdmin2.rpc("get_evolution_credentials_service", {
    _session_id: sessId,
    _key: encKey
  });
  const c = creds;
  if (!c?.instance_name || !c.api_key) return { ok: false, error: "Credenciais Evolution indispon\xEDveis" };
  const base = (runtimeEnv("EVOLUTION_URL") ?? "").replace(/\/+$/, "");
  if (!base) return { ok: false, error: "EVOLUTION_BASE_URL n\xE3o configurado" };
  const isGroupTarget = String(phone ?? "").includes("@g.us");
  let finalText = text;
  const mentioned = [];
  let mentionsEveryOne = false;
  if (isGroupTarget && /\{@\s*admins\s*\}/i.test(finalText)) {
    let adminDigits = [];
    try {
      const r = await fetch(
        `${base}/group/participants/${encodeURIComponent(c.instance_name)}?groupJid=${encodeURIComponent(String(phone).trim())}`,
        { headers: { apikey: c.api_key } }
      );
      const j = await r.json().catch(() => null);
      adminDigits = getAdminPhonesFromEvolutionPayload(j);
    } catch {
      adminDigits = [];
    }
    finalText = finalText.replace(
      /\{@\s*admins\s*\}/gi,
      adminDigits.length ? adminDigits.map((d) => `{@${d}}`).join(" ") : ""
    );
  }
  finalText = finalText.replace(/\{@\s*([\w]+)\s*\}/g, (_m, raw) => {
    const key = String(raw).toLowerCase();
    if (!isGroupTarget) return "";
    if (key === "todos") {
      mentionsEveryOne = true;
      return "@todos";
    }
    const d = key.replace(/\D/g, "");
    if (d.length < 8) return "";
    const jid = `${d}@s.whatsapp.net`;
    if (!mentioned.includes(jid)) mentioned.push(jid);
    return `@${d}`;
  }).replace(/[ \t]{2,}/g, " ");
  const target = isGroupTarget ? String(phone).trim() : digits;
  const isDirectEvolution = isGroupTarget || digits.length >= 8;
  if (!isDirectEvolution) return { ok: false, error: "Alvo inv\xE1lido para WhatsApp" };
  try {
    const resp = await fetch(`${base}/message/sendText/${encodeURIComponent(c.instance_name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: c.api_key },
      body: JSON.stringify({
        number: target,
        text: finalText,
        ...mentionsEveryOne ? { mentionsEveryOne: true } : {},
        ...mentioned.length > 0 ? { mentioned } : {}
      })
    });
    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => "");
      return { ok: false, error: `Evolution ${resp.status}: ${bodyText.slice(0, 200)}` };
    }
    const j = await resp.json().catch(() => null);
    return { ok: true, messageId: j?.key?.id ?? null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
async function sendWhatsappButtons(supabaseAdmin2, workspaceId, phone, text, buttons, footer, sessionId) {
  const encKey = runtimeEnv("INTEGRATION_ENCRYPTION_KEY");
  if (!encKey) return { ok: false, error: "INTEGRATION_ENCRYPTION_KEY ausente" };
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return { ok: false, error: "Telefone inv\xE1lido" };
  const btns = buttons.map((b) => {
    if (b.url) return { type: "url", display: String(b.label ?? "").slice(0, 20), url: b.url };
    return { type: "reply", display: String(b.label ?? "").slice(0, 20), id: String(b.id || b.label || "").slice(0, 64) };
  }).filter((b) => b.display.trim().length > 0).slice(0, 3);
  if (btns.length === 0) return { ok: false, error: "Nenhum bot\xE3o v\xE1lido" };
  let sessionQuery = supabaseAdmin2.from("whatsapp_web_sessions").select("id").eq("workspace_id", workspaceId).eq("provider", "evolution").eq("status", "conectado");
  if (sessionId) sessionQuery = sessionQuery.eq("id", sessionId);
  else sessionQuery = sessionQuery.order("last_connected_at", { ascending: false }).limit(1);
  const { data: sess } = await sessionQuery.maybeSingle();
  const sessId = sess?.id;
  if (!sessId) return { ok: false, error: "Nenhuma sess\xE3o Evolution conectada" };
  const { data: creds } = await supabaseAdmin2.rpc("get_evolution_credentials_service", {
    _session_id: sessId,
    _key: encKey
  });
  const c = creds;
  if (!c?.instance_name || !c.api_key) return { ok: false, error: "Credenciais Evolution indispon\xEDveis" };
  const base = (runtimeEnv("EVOLUTION_URL") ?? "").replace(/\/+$/, "");
  if (!base) return { ok: false, error: "EVOLUTION_BASE_URL n\xE3o configurado" };
  try {
    const resp = await fetch(`${base}/message/sendButtons/${encodeURIComponent(c.instance_name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: c.api_key },
      body: JSON.stringify({
        number: digits,
        title: "",
        description: text,
        footer: footer ?? "",
        buttons: btns
      })
    });
    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => "");
      return { ok: false, error: `Evolution ${resp.status}: ${bodyText.slice(0, 200)}` };
    }
    const j = await resp.json().catch(() => null);
    return { ok: true, messageId: j?.key?.id ?? null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
async function loadConversationHistoryForAI(supabaseAdmin2, workspaceId, leadId, limit = 20) {
  const { data } = await supabaseAdmin2.from("lead_activities").select("type, payload, occurred_at").eq("workspace_id", workspaceId).eq("lead_id", leadId).in("type", ["message_in", "message_out"]).order("occurred_at", { ascending: false }).limit(limit);
  return leadActivitiesToAiHistory(data ?? []);
}
function inheritedRunVariables(vars) {
  const out = { ...vars ?? {} };
  for (const k of ["ia_agent_id", "ia_agent_nome", "ia_max_turnos", "ia_turns_used", "ia_block_id", "salesbot_waiting_branch"]) {
    delete out[k];
  }
  return out;
}
async function getLastConversationTurn(supabaseAdmin2, workspaceId, leadId) {
  const history = await loadConversationHistoryForAI(supabaseAdmin2, workspaceId, leadId, 5);
  const last = history[history.length - 1];
  if (!last) return { direction: null, text: "" };
  return {
    direction: last.role === "user" ? "in" : "out",
    text: last.content.trim()
  };
}
async function handoffToConversationAgent(supabaseAdmin2, params) {
  const last = await getLastConversationTurn(supabaseAdmin2, params.workspaceId, params.leadId);
  if (last.direction !== "in") {
    return {
      replied: false,
      reason: last.direction === "out" ? "\xFAltima mensagem foi nossa \u2014 agente aguarda o cliente responder" : "sem hist\xF3rico de mensagens \u2014 agente aguarda o cliente iniciar"
    };
  }
  const r = await runAiAgentTurn(
    supabaseAdmin2,
    params.workspaceId,
    params.leadId,
    params.phone,
    params.agentId,
    last.text
  );
  return { replied: !r.error, reason: "respondeu a \xFAltima mensagem do cliente", error: r.error };
}
async function loadConversationAgent(supabaseAdmin2, workspaceId, agentId) {
  const { data } = await supabaseAdmin2.from("conversation_ai_agents").select("id, name, persona, system_prompt, model, metadata").eq("workspace_id", workspaceId).eq("id", agentId).maybeSingle();
  return data ?? null;
}
async function assignConversationAgent(supabaseAdmin2, workspaceId, leadId, agentId) {
  await supabaseAdmin2.from("leads").update({ active_conversation_agent_id: agentId, ai_paused: false, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", leadId).eq("workspace_id", workspaceId);
}
function describeObjectiveTree(tree, customFieldsById = {}) {
  if (!tree || !tree.root) return "";
  const lines = [];
  const objectiveFinal = tree.root.expected?.trim() || "";
  const generalContext = tree.context?.trim() || "";
  if (generalContext || objectiveFinal) {
    lines.push(`CONTEXTO ESTRAT\xC9GICO:
${generalContext}${objectiveFinal ? `

OBJETIVO FINAL DO AGENTE: ${objectiveFinal}` : ""}`);
  }
  const pitchMin = Number(tree.pitch?.minTurns) || 0;
  const pitchMax = Number(tree.pitch?.maxTurns) || 0;
  const pitchWhat = tree.pitch?.what?.trim();
  if (pitchMin > 0 || pitchMax > 0 || pitchWhat) {
    const what = pitchWhat || "enviar o link / fazer a proposta";
    const rules = [];
    if (pitchMin > 0)
      rules.push(`s\xF3 fa\xE7a isso a partir da ${pitchMin}\xAA intera\xE7\xE3o com o lead \u2014 antes disso, construa contexto e valor`);
    if (pitchMax > 0)
      rules.push(`n\xE3o passe da ${pitchMax}\xAA intera\xE7\xE3o sem chegar nesse ponto \u2014 conduza a conversa at\xE9 l\xE1`);
    lines.push(
      `\xC1PICE DA CONVERSA (${what}):
- ${rules.join("\n- ") || "conduza naturalmente at\xE9 este ponto"}
- Conte como intera\xE7\xE3o cada mensagem enviada pelo lead nesta conversa.`
    );
  }
  const discounts = (tree.discounts ?? []).filter((d) => d && (d.value || d.min || d.max));
  if (discounts.length) {
    const linhas = discounts.map((d) => {
      const un = d.unit === "percent" ? "%" : "R$";
      const valor = d.kind === "faixa" ? `negocie entre ${un} ${Number(d.min) || 0} e ${un} ${Number(d.max) || 0} (comece sempre pelo menor)` : `${un} ${Number(d.value) || 0} fixo`;
      return `- ${d.label?.trim() || "Desconto"}: ${valor}${d.when?.trim() ? ` \u2014 usar s\xF3 quando: ${d.when.trim()}` : ""}`;
    });
    lines.push(
      `DESCONTOS AUTORIZADOS (nunca ofere\xE7a nada al\xE9m disso, nunca invente condi\xE7\xE3o):
${linhas.join("\n")}`
    );
  }
  const walk = (node, prefix) => {
    const kind = node.block ?? "objetivo";
    if (kind === "acao" || kind === "condicao" || kind === "tracking") {
      const nome = node.say?.trim() || "(sem nome)";
      const acts0 = (node.actions ?? []).filter((a) => a?.action);
      const linhaAcoes = acts0.length ? ` O sistema executa: ${acts0.map((a) => `${a.action}${a.targetLabel ? ` \u2192 ${a.targetLabel}` : ""}`).join("; ")}.` : "";
      if (kind === "acao") {
        const contextoAcao = node.expected?.trim() ? ` Motivo/Contexto: ${node.expected.trim()}.` : "";
        lines.push(`${prefix} [BLOCO DE A\xC7\xC3O] ${nome} \u2014 o sistema executa sozinho, n\xE3o fale nada sobre isso.${contextoAcao}${linhaAcoes}`);
      } else if (kind === "condicao") {
        const rows = (node.conditions ?? []).filter((c) => c?.field);
        const desc = rows.map((c) => {
          if (c.field === "campo") {
            const def = customFieldsById[String(c.fieldId ?? "")];
            const nomeCampo = def?.name ?? "campo personalizado";
            const atual = def?.value?.trim() ? `"${def.value}"` : "(vazio)";
            return `campo personalizado "${nomeCampo}" (valor atual do lead: ${atual}) ${c.op ?? "contem"} "${c.value ?? ""}"`;
          }
          return `${c.field} ${c.op ?? "contem"} "${c.value ?? ""}"`;
        }).join((node.conditionLogic ?? "e") === "ou" ? " OU " : " E ");
        lines.push(
          `${prefix} [BLOCO DE CONDI\xC7\xC3O] ${nome} \u2014 o sistema verifica: ${desc || "(sem condi\xE7\xF5es)"}. Se bater, segue pelo 1\xBA caminho; se n\xE3o, pelo 2\xBA.`
        );
      } else {
        const t = node.tracking ?? {};
        const ev = t.event === "custom" ? t.customEvent || "evento personalizado" : t.event || "lead";
        const sourceLabel = t.siteId === "crm-capi" ? "M\xF3dulo CRM/CAPI" : t.siteId?.startsWith("meta-") ? "M\xF3dulo Meta Ads" : "Pixel do Site";
        lines.push(
          `${prefix} [BLOCO DE TRACKING] ${nome} \u2014 o sistema fica conferindo via ${sourceLabel}, a cada ${Number(t.everyMinutes) || 5} min, se ocorreu o evento "${ev}"${t.match?.trim() ? ` na p\xE1gina "${t.match.trim()}"` : ""}. N\xE3o pergunte ao lead se ele fez isso: voc\xEA \xE9 avisado pelo sistema.${t.onFoundMessage?.trim() ? ` Quando confirmar, diga algo como: "${t.onFoundMessage.trim()}".` : ""}${linhaAcoes}`
        );
      }
      for (const c of node.children ?? []) walk(c, `${prefix}  `);
      return;
    }
    const parts = [`${prefix} Objetivo: ${node.say?.trim() || "(n\xE3o definido)"}`];
    if (node.when?.trim()) parts.push(`${prefix}   S\xF3 siga por este caminho se: ${node.when.trim()}`);
    if (node.returnAfter)
      parts.push(
        `${prefix}   DESVIO: resolva s\xF3 este assunto, sem alongar, e volte imediatamente ao objetivo de onde saiu, retomando dali pro pr\xF3ximo passo.`
      );
    if (node.expected?.trim()) parts.push(`${prefix}   Conclui quando: ${node.expected.trim()}`);
    if ((node.mode ?? "free") === "strict" && node.questions?.length) {
      parts.push(`${prefix}   Perguntas OBRIGAT\xD3RIAS, fa\xE7a na ordem, uma por vez:`);
      node.questions.filter(Boolean).forEach((q, i) => parts.push(`${prefix}     ${i + 1}. ${q}`));
    }
    const lks = (node.links ?? []).filter((l) => l?.url?.trim());
    if (lks.length) {
      parts.push(`${prefix}   Links que voc\xEA pode enviar neste objetivo (envie o URL exatamente como est\xE1):`);
      lks.forEach(
        (l) => parts.push(
          `${prefix}     - ${l.label?.trim() || "Link"}: ${l.url.trim()}${l.when?.trim() ? ` (enviar quando: ${l.when.trim()})` : ""}`
        )
      );
    }
    const maxTurns = Number(node.maxTurns) || 0;
    const minTurns = Number(node.minTurns) || 0;
    if (minTurns > 0) {
      parts.push(
        `${prefix}   Troque no M\xCDNIMO ${minTurns} mensagens com o lead dentro deste objetivo antes de avan\xE7ar, mesmo que ele j\xE1 tenha dado a resposta esperada.`
      );
    }
    parts.push(
      maxTurns > 0 ? `${prefix}   Voc\xEA pode trocar at\xE9 ${maxTurns} mensagens com o lead dentro deste objetivo; depois disso avance mesmo com o que tiver.` : `${prefix}   Sem limite m\xE1ximo de intera\xE7\xF5es: fa\xE7a quantas perguntas forem necess\xE1rias at\xE9 cumprir o crit\xE9rio.`
    );
    if (node.keepOnTrack !== false) {
      parts.push(
        `${prefix}   ANCORAGEM: se o lead mudar de assunto, responda com educa\xE7\xE3o e em seguida retome este objetivo at\xE9 conclu\xED-lo.`
      );
    }
    const acts = (node.actions ?? []).filter((a) => a?.action);
    if (acts.length) {
      parts.push(
        `${prefix}   Ao concluir, o sistema executa: ${acts.map((a) => `${a.action}${a.targetLabel ? ` \u2192 ${a.targetLabel}` : ""}`).join("; ")}`
      );
    }
    const fbs = (node.fallbacks ?? []).filter((f) => f?.kind);
    if (fbs.length) {
      parts.push(`${prefix}   CONTING\xCANCIAS (o objetivo n\xE3o avan\xE7ou):`);
      for (const f of fbs) {
        const dest = f.goTo === "proximo" ? "depois disso, avance para o pr\xF3ximo objetivo mesmo sem concluir este" : f.goTo === "encerrar" ? "depois disso, encerre e finalize com [[HANDOFF]]" : "continue tentando concluir este objetivo";
        let cond = "";
        if (f.kind === "inatividade")
          cond = `o lead ficar ${Number(f.minutes) || 30} min sem responder (o sistema cobra at\xE9 ${Number(f.attempts) || 2}x)`;
        else if (f.kind === "negativa")
          cond = "o lead recusar, dizer que n\xE3o tem interesse, que est\xE1 caro ou que n\xE3o quer";
        else if (f.kind === "palavra-chave")
          cond = `o lead escrever algo como: ${(f.keywords ?? []).join(", ") || "(termos n\xE3o definidos)"}`;
        else if (f.kind === "limite-interacoes")
          cond = `passar de ${Number(f.times) || 6} mensagens sem concluir este objetivo`;
        else if (f.kind === "desvio-repetido")
          cond = `o lead fugir do assunto ${Number(f.times) || 3} vezes seguidas`;
        const acts2 = (f.actions ?? []).filter((a) => a?.action);
        parts.push(
          `${prefix}     - Se ${cond}: ${f.message?.trim() ? `diga algo como "${f.message.trim()}" e ` : ""}${dest}.` + (acts2.length ? ` O sistema executa: ${acts2.map((a) => `${a.action}${a.targetLabel ? ` \u2192 ${a.targetLabel}` : ""}`).join("; ")}.` : "")
        );
      }
    }
    lines.push(parts.join("\n"));
    const kids = node.children ?? [];
    if (kids.length > 1) {
      const desvios = kids.filter((c) => c.returnAfter);
      const caminhos = kids.filter((c) => !c.returnAfter);
      if (caminhos.length) {
        const opts = caminhos.map(
          (c, i) => `${prefix}${i + 1}. ${c.when?.trim() ? `se ${c.when.trim()}` : "caminho alternativo"} \u2192 ${c.say?.trim() || "(objetivo n\xE3o definido)"}`
        );
        lines.push(
          `${prefix}   CAMINHOS POSS\xCDVEIS depois deste objetivo (escolha UM, pelo que o lead responder, e siga por ele at\xE9 o objetivo final):
${opts.join("\n")}`
        );
      }
      if (desvios.length) {
        const opts = desvios.map(
          (c) => `${prefix}- ${c.when?.trim() ? `se ${c.when.trim()}` : "se o lead puxar esse assunto"} \u2192 resolva "${c.say?.trim() || "(objetivo n\xE3o definido)"}" e volte para este objetivo`
        );
        lines.push(
          `${prefix}   DESVIOS PERMITIDOS aqui (parada r\xE1pida, n\xE3o trocam o caminho principal):
${opts.join("\n")}`
        );
      }
    }
    kids.forEach((c, i) => walk(c, `${prefix}${i + 1}.`));
    kids.forEach((c, i) => walk(c, `${prefix}${i + 1}.`));
  };
  walk(tree.root, "1.");
  const outcome = Array.isArray(tree.outcome) ? tree.outcome.filter((o) => o?.action && o.action !== "proximo-objetivo") : [];
  if (outcome.length) {
    lines.push(
      `ENCERRAMENTO: quando o fluxo terminar, o sistema executa: ${outcome.map((o) => `${o.action}${o.targetLabel ? ` \u2192 ${o.targetLabel}` : ""}`).join("; ")}. Sinalize o fim com [[HANDOFF]].`
    );
  }
  return [
    "FLUXO DE OBJETIVOS (siga na ordem, um objetivo por vez, s\xF3 avance quando o crit\xE9rio for cumprido).",
    [
      "COMO USAR OS CAMINHOS E DESVIOS:",
      "- O fluxo existe para chegar no OBJETIVO FINAL. Tudo o que voc\xEA fizer tem que empurrar a conversa pra l\xE1.",
      "- Se o lead puxar um assunto que tem DESVIO configurado (pre\xE7o, prazo, compara\xE7\xE3o, obje\xE7\xE3o...), atenda esse desvio: explique, qualifique, resolva r\xE1pido e, sem anunciar que est\xE1 voltando, retome exatamente o objetivo de onde saiu.",
      "- Se o assunto do lead corresponde a um CAMINHO, mude de trilho e siga por esse caminho at\xE9 o final \u2014 n\xE3o volte pro anterior.",
      "- Se o lead fugir para algo que n\xE3o tem desvio nem caminho, responda em 1 frase e volte imediatamente \xE0 pergunta pendente do objetivo atual.",
      "- Nunca abandone o objetivo atual, nunca fique preso num desvio e nunca invente etapas que n\xE3o est\xE3o no fluxo."
    ].join("\n"),
    ...lines
  ].join("\n\n");
}
function parseAppointmentTarget(raw) {
  const base = { titulo: "", duracaoMin: 30, antecedenciaMin: 60, responsavelId: "", googleAgendaLead: true };
  if (!raw) return base;
  try {
    const p = JSON.parse(raw);
    return { ...base, ...p, titulo: String(p.titulo ?? "") };
  } catch {
    return { ...base, titulo: String(raw) };
  }
}
function googleCalendarLink(titulo, start, end) {
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: titulo,
    dates: `${fmt(start)}/${fmt(end)}`
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
async function executeAgentActions(supabaseAdmin2, workspaceId, leadId, phone, actions, sessionId) {
  let resolvedActionRoute;
  const getActionRoute = async () => {
    if (sessionId) {
      const jidIdentity = whatsappIdentityFromJid(phone);
      if (jidIdentity) {
        return {
          phone: jidIdentity.kind === "group" ? jidIdentity.remoteJid : jidIdentity.number,
          remoteJid: jidIdentity.remoteJid,
          sessionId,
          conversationKey: `${sessionId}:${jidIdentity.remoteJid.toLowerCase()}`,
          source: jidIdentity.kind === "group" ? "group_jid" : "conversation_jid"
        };
      }
      const normalized = normalizeInternationalPhone(phone, { allowTrustedBare: true });
      if (normalized.ok === false) return null;
      const remoteJid = `${normalized.digits}@s.whatsapp.net`;
      return {
        phone: normalized.digits,
        remoteJid,
        sessionId,
        conversationKey: `${sessionId}:${remoteJid.toLowerCase()}`,
        source: "explicit_phone"
      };
    }
    if (resolvedActionRoute !== void 0) return resolvedActionRoute;
    resolvedActionRoute = await resolveRuntimeWhatsappTarget(
      supabaseAdmin2,
      workspaceId,
      leadId,
      phone
    );
    return resolvedActionRoute;
  };
  for (const a of actions ?? []) {
    const kind = String(a?.action ?? "");
    const target = String(a?.target ?? "").trim();
    if (!kind) continue;
    try {
      switch (kind) {
        case "proximo-objetivo": {
          break;
        }
        case "mudar-etapa":
        case "trocar-etapa": {
          if (!target) break;
          const { data: stageRow } = await supabaseAdmin2.from("pipeline_stages").select("id, name, pipeline_id").eq("id", target).eq("workspace_id", workspaceId).maybeSingle();
          const st = stageRow;
          if (!st || !st.pipeline_id) break;
          const { data: currentLead } = await supabaseAdmin2.from("leads").select("stage_id").eq("id", leadId).eq("workspace_id", workspaceId).maybeSingle();
          if (!currentLead) break;
          const fromStageId = currentLead.stage_id ?? null;
          await supabaseAdmin2.from("leads").update({ stage_id: st.id, pipeline_id: st.pipeline_id, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", leadId).eq("workspace_id", workspaceId);
          await supabaseAdmin2.from("lead_activities").insert({
            workspace_id: workspaceId,
            lead_id: leadId,
            type: "stage_change",
            payload: { from_stage_id: fromStageId, to_stage_id: st.id, to_stage_nome: st.name ?? "", by: null, source: "ai_agent" }
          });
          const { dispatchCrmStageMoved: dispatchCrmStageMoved2 } = await Promise.resolve().then(() => (init_crm_event_dispatch_server(), crm_event_dispatch_server_exports));
          await dispatchCrmStageMoved2(supabaseAdmin2, {
            workspaceId,
            leadId,
            newStageId: st.id,
            newPipelineId: st.pipeline_id,
            fromStageId
          });
          break;
        }
        case "adicionar-tag": {
          const incoming = target.split(",").map((t) => t.trim()).filter(Boolean);
          if (!incoming.length) break;
          const { data: leadRow } = await supabaseAdmin2.from("leads").select("tags").eq("id", leadId).eq("workspace_id", workspaceId).maybeSingle();
          const cur = Array.isArray(leadRow?.tags) ? leadRow.tags : [];
          const existing = new Set(cur.map((tag) => String(tag).toLocaleLowerCase()));
          const added = incoming.filter((tag) => !existing.has(tag.toLocaleLowerCase()));
          if (!added.length) break;
          await supabaseAdmin2.from("leads").update({ tags: [...cur, ...added], updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", leadId).eq("workspace_id", workspaceId);
          const { dispatchCrmTagAdded: dispatchCrmTagAdded2 } = await Promise.resolve().then(() => (init_crm_event_dispatch_server(), crm_event_dispatch_server_exports));
          await dispatchCrmTagAdded2(supabaseAdmin2, { workspaceId, leadId, tags: added });
          break;
        }
        case "ler-historico": {
          break;
        }
        case "transferir-humano": {
          if (target) {
            const { data: member } = await supabaseAdmin2.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).eq("user_id", target).maybeSingle();
            if (!member) break;
            await supabaseAdmin2.from("leads").update({ responsible_id: target, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", leadId).eq("workspace_id", workspaceId);
            const { enqueueLeadAutomationEvent: enqueueLeadAutomationEvent2 } = await Promise.resolve().then(() => (init_stage_automation_engine_server(), stage_automation_engine_server_exports));
            await enqueueLeadAutomationEvent2(supabaseAdmin2, {
              leadId,
              event: "assignee-changed",
              workspaceId
            });
          }
          await supabaseAdmin2.from("lead_activities").insert({
            workspace_id: workspaceId,
            lead_id: leadId,
            type: "note",
            payload: { text: `Agente IA transferiu o atendimento${a?.targetLabel ? ` para ${a.targetLabel}` : ""}.`, source: "ai_agent" }
          });
          break;
        }
        case "criar-tarefa": {
          await supabaseAdmin2.from("tasks").insert({
            workspace_id: workspaceId,
            lead_id: leadId,
            title: (a?.message?.trim() || a?.targetLabel?.trim() || target || "Tarefa criada pelo agente IA").slice(0, 200),
            status: "pendente",
            kind: "tarefa",
            due_at: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
          });
          break;
        }
        case "alterar-responsavel":
        case "mudar-responsavel":
        case "transferir-usuario": {
          if (!target) break;
          const { data: member } = await supabaseAdmin2.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).eq("user_id", target).maybeSingle();
          if (!member) break;
          await supabaseAdmin2.from("leads").update({ responsible_id: target, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", leadId).eq("workspace_id", workspaceId);
          const { enqueueLeadAutomationEvent: enqueueLeadAutomationEvent2 } = await Promise.resolve().then(() => (init_stage_automation_engine_server(), stage_automation_engine_server_exports));
          await enqueueLeadAutomationEvent2(supabaseAdmin2, {
            leadId,
            event: "assignee-changed",
            workspaceId
          });
          await supabaseAdmin2.from("lead_activities").insert({
            workspace_id: workspaceId,
            lead_id: leadId,
            type: "note",
            payload: { text: `Agente IA definiu ${a?.targetLabel || "um novo respons\xE1vel"} como respons\xE1vel.`, source: "ai_agent" }
          });
          break;
        }
        case "mudar-etapa-lead": {
          await executeAgentActions(
            supabaseAdmin2,
            workspaceId,
            leadId,
            phone,
            [{ action: "mudar-etapa", target, targetLabel: a?.targetLabel }],
            sessionId
          );
          break;
        }
        case "iniciar-salesbot":
        case "iniciar-bot": {
          if (!target) break;
          await startSalesbotRun(supabaseAdmin2, { workspaceId, salesbotId: target, leadId });
          break;
        }
        case "enviar-formulario": {
          if (!target) break;
          const url = /^https?:\/\//i.test(target) ? target : `${resolvePublicAppUrl()}/f/${target}`;
          const texto = `${a?.message?.trim() ? `${a.message.trim()} ` : ""}${url}`;
          const route = await getActionRoute();
          if (!route) break;
          await sendWhatsappText(supabaseAdmin2, workspaceId, route.phone, texto, route.sessionId);
          break;
        }
        case "enviar-arquivo": {
          if (!target) break;
          if (/^https?:\/\//i.test(target)) {
            const route = await getActionRoute();
            if (!route) break;
            await sendWhatsappText(
              supabaseAdmin2,
              workspaceId,
              route.phone,
              `${a?.message?.trim() ? `${a.message.trim()} ` : ""}${target}`,
              route.sessionId
            );
          } else {
            const route = await getActionRoute();
            if (!route) break;
            await sendWhatsappMedia(
              supabaseAdmin2,
              workspaceId,
              route.phone,
              target,
              "document",
              "application/octet-stream",
              a?.targetLabel || "arquivo",
              a?.message?.trim() ?? "",
              false,
              route.sessionId
            );
          }
          break;
        }
        case "enviar-mensagem": {
          const texto = (a?.message ?? a?.targetLabel ?? target).trim();
          if (texto) {
            const route = await getActionRoute();
            if (!route) break;
            await sendWhatsappText(supabaseAdmin2, workspaceId, route.phone, texto, route.sessionId);
          }
          break;
        }
        case "remover-tag": {
          const remover = target.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
          if (!remover.length) break;
          const { data: leadRow } = await supabaseAdmin2.from("leads").select("tags").eq("id", leadId).eq("workspace_id", workspaceId).maybeSingle();
          const cur = Array.isArray(leadRow?.tags) ? leadRow.tags : [];
          await supabaseAdmin2.from("leads").update({ tags: cur.filter((t) => !remover.includes(String(t).toLowerCase())), updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", leadId).eq("workspace_id", workspaceId);
          break;
        }
        // Campo personalizado: alvo no formato `fieldId=valor`.
        case "definir-campo":
        case "atualizar-campo": {
          const sep = target.indexOf("=");
          const fieldId = sep === -1 ? target : target.slice(0, sep).trim();
          let valor = sep === -1 ? (a?.message ?? "").trim() : target.slice(sep + 1).trim();
          if (/\{\{\s*agora\s*\}\}/i.test(valor)) valor = valor.replace(/\{\{\s*agora\s*\}\}/gi, (/* @__PURE__ */ new Date()).toISOString());
          if (!fieldId) break;
          const { data: field } = await supabaseAdmin2.from("lead_custom_fields").select("id, name").eq("id", fieldId).eq("workspace_id", workspaceId).maybeSingle();
          if (!field) break;
          await supabaseAdmin2.from("lead_custom_field_values").upsert({
            workspace_id: workspaceId,
            lead_id: leadId,
            field_id: fieldId,
            value: { display: valor, raw: [valor] },
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }, { onConflict: "lead_id,field_id" });
          const { dispatchCrmFieldUpdated: dispatchCrmFieldUpdated2 } = await Promise.resolve().then(() => (init_crm_event_dispatch_server(), crm_event_dispatch_server_exports));
          await dispatchCrmFieldUpdated2(supabaseAdmin2, {
            workspaceId,
            leadId,
            fieldId,
            fieldName: field.name
          });
          break;
        }
        case "vincular-produto": {
          let cfg = {};
          try {
            cfg = target.startsWith("{") ? JSON.parse(target) : {};
          } catch {
            cfg = {};
          }
          const pId = String(cfg["productId"] ?? "").trim();
          if (!pId) break;
          const { data: product } = await supabaseAdmin2.from("products").select("id").eq("id", pId).eq("workspace_id", workspaceId).maybeSingle();
          if (!product) break;
          const kind2 = cfg["kind"] || "interesse";
          await supabaseAdmin2.from("lead_products").upsert(
            { workspace_id: workspaceId, lead_id: leadId, product_id: pId, kind: kind2 },
            { onConflict: "lead_id,product_id,kind" }
          );
          await supabaseAdmin2.from("lead_activities").insert({
            workspace_id: workspaceId,
            lead_id: leadId,
            type: "produto_vinculado",
            payload: { product_id: pId, kind: kind2, source: "ai_agent" }
          });
          break;
        }
        // Tarefa no Fluxo de Trabalho (pipeline/etapa/responsável reais).
        case "criar-tarefa-workflow": {
          let cfg = {};
          try {
            cfg = target.startsWith("{") ? JSON.parse(target) : {};
          } catch {
            cfg = {};
          }
          const pipelineId = String(cfg["pipelineId"] ?? "").trim();
          if (!pipelineId) break;
          const minutos = Number(cfg["dueInMinutes"] ?? 1440);
          const { createWorkflowTaskAdmin: createWorkflowTaskAdmin2 } = await Promise.resolve().then(() => (init_workflow_task_create_server(), workflow_task_create_server_exports));
          await createWorkflowTaskAdmin2({
            workspaceId,
            pipelineId,
            stageId: cfg["stageId"] || null,
            title: String(cfg["title"] ?? a?.message ?? "Tarefa criada pelo agente IA").slice(0, 160),
            description: cfg["description"] ?? null,
            priority: cfg["priority"] ?? "media",
            dueAt: new Date(Date.now() + Math.max(0, minutos) * 6e4).toISOString(),
            assigneeId: cfg["assigneeId"] || null,
            leadId
          });
          break;
        }
        // Leituras de contexto: o dado real entra no prompt (buildAgentSystemDataBlock).
        case "consultar-trafego":
        case "consultar-social":
        case "consultar-tracking":
        case "consultar-workflow":
          break;
        case "encerrar-conversa": {
          await supabaseAdmin2.from("leads").update({ active_conversation_agent_id: null, ai_paused: true, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", leadId).eq("workspace_id", workspaceId);
          break;
        }
        default:
          break;
      }
    } catch {
    }
  }
}
async function buildTriggerContext(supabaseAdmin2, workspaceId, phone, message2, history, lead) {
  let messageFormat = "texto";
  let minutesSinceCustomerMessage = null;
  let finalMessage = message2;
  try {
    const jidIdentity = whatsappIdentityFromJid(phone);
    const isGroup = jidIdentity?.kind === "group";
    const digits = isGroup ? "" : jidIdentity?.kind === "direct" ? jidIdentity.digits : String(phone ?? "").replace(/\D/g, "");
    const expectedJid = isGroup ? jidIdentity.remoteJid : digits.length >= 8 ? `${digits}@s.whatsapp.net` : "";
    if (expectedJid) {
      let messageQuery = supabaseAdmin2.from("whatsapp_web_messages").select("id, message_type, from_me, received_at, body, media_url, raw").eq("workspace_id", workspaceId);
      messageQuery = isGroup ? messageQuery.eq("remote_jid", expectedJid) : messageQuery.or(
        `sender_phone.eq.${digits},remote_jid.eq.${expectedJid},to_jid.eq.${expectedJid}`
      );
      const { data } = await messageQuery.order("received_at", { ascending: false }).limit(20);
      const rows = data ?? [];
      const ultima = rows.find((r) => r.from_me === false);
      if (ultima) {
        messageFormat = FORMAT_MAP[String(ultima.message_type ?? "").toLowerCase()] ?? "texto";
        if (ultima.received_at) {
          minutesSinceCustomerMessage = (Date.now() - new Date(ultima.received_at).getTime()) / 6e4;
        }
        if (messageFormat === "\xE1udio") {
          const { transcribeWhatsappAudioMessage: transcribeWhatsappAudioMessage2 } = await Promise.resolve().then(() => (init_audio_transcription_server(), audio_transcription_server_exports));
          const texto = await transcribeWhatsappAudioMessage2(supabaseAdmin2, workspaceId, ultima);
          if (texto) {
            finalMessage = `[\xE1udio transcrito] ${texto}`;
          } else if (!String(message2 ?? "").trim()) {
            finalMessage = "[\xE1udio recebido \u2014 n\xE3o foi poss\xEDvel transcrever]";
          }
        }
      }
    }
  } catch {
  }
  const now = new Date((/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return { message: finalMessage, messageFormat, history, minutesSinceCustomerMessage, now, lead };
}
function wantsFullConversationHistory(meta) {
  try {
    return JSON.stringify(meta ?? {}).includes("ler-historico");
  } catch {
    return false;
  }
}
async function runAiAgentTurn(supabaseAdmin2, workspaceId, leadId, phone, agentId, extraUserMessage) {
  const agent = await loadConversationAgent(supabaseAdmin2, workspaceId, agentId);
  if (!agent) return { reply: "", handoff: true, error: "Agente IA n\xE3o encontrado" };
  const meta = agent.metadata ?? {};
  const idioma = meta.settings?.language ?? "pt-BR";
  const persona = agent.persona ?? "";
  const customFieldValues = await loadLeadCustomFieldMap(supabaseAdmin2, workspaceId, leadId);
  const customFieldBlock = Object.entries(customFieldValues).map(([key, value]) => `- ${key.replace(/^campo:/, "")}: ${value}`).join("\n");
  const customFieldsById = await loadLeadCustomFieldById(supabaseAdmin2, workspaceId, leadId);
  const objetivoBlock = describeObjectiveTree(meta.objective_tree, customFieldsById);
  const lerHistoricoCompleto = wantsFullConversationHistory(meta);
  const history = await loadConversationHistoryForAI(
    supabaseAdmin2,
    workspaceId,
    leadId,
    lerHistoricoCompleto ? 300 : 24
  );
  const historicoBlock = lerHistoricoCompleto ? `LEITURA DE HIST\xD3RICO ATIVA: voc\xEA est\xE1 recebendo a conversa COMPLETA com este lead (at\xE9 300 mensagens). Antes de responder, releia o hist\xF3rico, identifique o que j\xE1 foi combinado, o que j\xE1 foi respondido, as obje\xE7\xF5es que apareceram e onde a conversa travou. Nunca repita perguntas j\xE1 respondidas e retome exatamente do ponto onde parou para destravar o objetivo atual.` : "";
  const ultimaDoCliente = extraUserMessage ?? [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const historicoAnterior = extraUserMessage ? history : history.slice(0, history.map((m) => m.role).lastIndexOf("user"));
  const { data: leadRow } = await supabaseAdmin2.from("leads").select("name, email, phone, tags, stage_id").eq("id", leadId).maybeSingle();
  const routeTarget = await resolveRuntimeWhatsappTarget(
    supabaseAdmin2,
    workspaceId,
    leadId,
    phone || leadRow?.phone || null
  );
  if (!routeTarget) {
    return {
      reply: "",
      handoff: true,
      error: "Identidade WhatsApp amb\xEDgua: DDI expl\xEDcito ou conversa real obrigat\xF3rios."
    };
  }
  const routedPhone = routeTarget.phone;
  const routedSessionId = routeTarget.sessionId;
  const triggerCtx = await buildTriggerContext(
    supabaseAdmin2,
    workspaceId,
    routedPhone,
    ultimaDoCliente,
    historicoAnterior,
    leadRow ?? void 0
  );
  const acoes = meta.settings?.actions ?? [];
  const verdicts = {};
  for (const a of acoes) {
    if (a?.id) verdicts[a.id] = evaluateTrigger(a.when, triggerCtx);
  }
  const acoesBlock = describePromptAgentActions(acoes, verdicts);
  const fatosBlock = acoes.length || triggerCtx.messageFormat !== "texto" ? describeConversationFacts(triggerCtx) : "";
  let conhecimentoBlock = "";
  try {
    const { buildAgentKnowledgeBlock: buildAgentKnowledgeBlock2 } = await Promise.resolve().then(() => (init_agent_knowledge_server(), agent_knowledge_server_exports));
    const todas = [
      ...Array.isArray(meta.settings?.sources) ? meta.settings.sources : [],
      ...Array.isArray(meta.objective_tree?.sources) ? meta.objective_tree.sources : []
    ];
    conhecimentoBlock = await buildAgentKnowledgeBlock2(todas, supabaseAdmin2);
  } catch {
    conhecimentoBlock = "";
  }
  const linksCadastrados = (meta.settings?.links ?? []).filter((l) => (l?.url ?? "").trim());
  const linksBlock = linksCadastrados.length ? `LINKS QUE VOC\xCA PODE ENVIAR (copie a URL exatamente como est\xE1, nunca invente nem encurte):
${linksCadastrados.map(
    (l) => `- ${l.label?.trim() || "Link"}: ${l.url.trim()}${l.when?.trim() ? ` (enviar quando: ${l.when.trim()})` : ""}`
  ).join("\n")}` : "Voc\xEA n\xE3o tem links cadastrados: nunca envie URLs nem invente endere\xE7os de site.";
  const isGrupoConversa = String(routedPhone ?? "").includes("@g.us");
  const mencaoBlock = isGrupoConversa ? [
    "Voc\xEA est\xE1 falando dentro de um GRUPO de WhatsApp.",
    "Para marcar (mencionar) algu\xE9m use exatamente estes tokens no texto:",
    "- {@participante} marca quem acabou de falar;",
    "- {@membro} marca quem entrou, saiu ou foi promovido (quando esse foi o gatilho);",
    "- {@admins} marca todos os administradores do grupo;",
    "- {@todos} marca todo mundo \u2014 use s\xF3 quando for realmente necess\xE1rio;",
    "- {@<numero com DDI e DDD>} marca uma pessoa espec\xEDfica.",
    "Nunca escreva o n\xFAmero solto no texto e nunca invente participantes.",
    "Neste grupo n\xE3o existem bot\xF5es: ofere\xE7a as op\xE7\xF5es escritas na pr\xF3pria mensagem."
  ].join("\n") : "";
  let sistemaBlock = "";
  try {
    const { buildAgentSystemDataBlock: buildAgentSystemDataBlock2 } = await Promise.resolve().then(() => (init_agent_system_data_server(), agent_system_data_server_exports));
    sistemaBlock = await buildAgentSystemDataBlock2(supabaseAdmin2, workspaceId, leadId, meta);
  } catch {
    sistemaBlock = "";
  }
  const sys = [
    agent.system_prompt ?? "",
    mencaoBlock,
    persona ? `Persona: ${persona}` : "",
    `Idioma padr\xE3o: ${idioma}.`,
    objetivoBlock,
    historicoBlock,
    conhecimentoBlock,
    linksBlock,
    fatosBlock,
    acoesBlock,
    sistemaBlock,
    customFieldBlock ? `Campos personalizados ATUAIS deste lead:
${customFieldBlock}` : "Este lead ainda n\xE3o possui valores em campos personalizados.",
    `CAMPOS DISPON\xCDVEIS NO CRM para voc\xEA preencher (ID: Nome [tipo]):
` + Object.entries(customFieldsById).map(([id, f]) => `- ${id}: ${f.name} [${f.field_type}]`).join("\n"),
    `Voc\xEA est\xE1 atendendo pelo WhatsApp como um humano, mensagens curtas, tom natural, sem markdown pesado.`,
    `Se identificar que j\xE1 cumpriu o objetivo, que o lead pediu falar com humano, ou que a conversa deve ser encerrada, finalize sua \xDALTIMA resposta com uma nova linha contendo apenas [[HANDOFF]].`
  ].filter(Boolean).join("\n\n");
  const { shouldListenToAudio: shouldListenToAudio2, shouldReactToSentiment: shouldReactToSentiment2, pickReactionEmoji: pickReactionEmoji2 } = await Promise.resolve().then(() => (init_agent_sentiment_reaction(), agent_sentiment_reaction_exports));
  const ouveAudio = shouldListenToAudio2(meta.settings?.allowed_actions);
  const transcrito = ouveAudio && triggerCtx.messageFormat === "\xE1udio" && triggerCtx.message.startsWith("[\xE1udio transcrito]") ? triggerCtx.message : "";
  const mensagemDoTurno = transcrito || extraUserMessage;
  const msgs = [{ role: "system", content: sys }, ...history];
  if (transcrito) {
    const idx = msgs.map((m) => m.role).lastIndexOf("user");
    if (idx > 0) msgs[idx] = { role: "user", content: transcrito };
    else msgs.push({ role: "user", content: transcrito });
  }
  const last = history[history.length - 1];
  if (mensagemDoTurno && !transcrito && (!last || last.content !== mensagemDoTurno || last.role !== "user")) {
    msgs.push({ role: "user", content: mensagemDoTurno });
  }
  if (transcrito) {
    msgs.splice(1, 0, {
      role: "system",
      content: "O lead enviou um \xC1UDIO. O texto entre colchetes \xE9 a transcri\xE7\xE3o desse \xE1udio. Responda ao conte\xFAdo do \xE1udio normalmente, sem dizer que leu uma transcri\xE7\xE3o."
    });
  }
  let aiKey;
  try {
    const mod = await Promise.resolve().then(() => (init_salesbot_context(), salesbot_context_exports));
    aiKey = await mod.resolveWorkspaceAiKey(supabaseAdmin2, workspaceId);
  } catch (e) {
    return { reply: "", handoff: true, error: e.message };
  }
  const model = aiKey.provider === "lovable" ? agent.model && agent.model.startsWith("openai/") ? agent.model : aiKey.defaultModel : aiKey.provider === "gemini" ? agent.model && agent.model.startsWith("gemini") ? agent.model : aiKey.defaultModel : agent.model && !agent.model.startsWith("openai/") ? aiKey.defaultModel : agent.model.replace(/^openai\//, "");
  try {
    const resp = await fetch(`${aiKey.baseUrl}/chat/completions`, {
      method: "POST",
      headers: aiKey.provider === "lovable" ? { "Content-Type": "application/json", "Lovable-API-Key": aiKey.apiKey, "X-Lovable-AIG-SDK": "salesbot-runtime" } : { "Content-Type": "application/json", Authorization: `Bearer ${aiKey.apiKey}` },
      body: JSON.stringify({ model, messages: msgs, temperature: 0.7 })
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      return { reply: "", handoff: true, error: `AI HTTP ${resp.status}: ${txt.slice(0, 200)}` };
    }
    const json = await resp.json();
    const raw = json.choices?.[0]?.message?.content ?? "";
    const extractionMatches = Array.from(raw.matchAll(/\[\[EXTRACT_DATA:([^\]=]+)=([^\]]+)\]\]/gi));
    for (const match2 of extractionMatches) {
      const fieldId = match2[1].trim();
      let valor = match2[2].trim();
      if (fieldId) {
        if (/\{\{\s*agora\s*\}\}/i.test(valor)) valor = valor.replace(/\{\{\s*agora\s*\}\}/gi, (/* @__PURE__ */ new Date()).toISOString());
        await supabaseAdmin2.from("lead_custom_field_values").upsert({
          workspace_id: workspaceId,
          lead_id: leadId,
          field_id: fieldId,
          value: { display: valor, raw: [valor] },
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }, { onConflict: "lead_id,field_id" });
      }
    }
    const actionIds = Array.from(raw.matchAll(/\[\[AGENT_ACTION:([^\]]+)\]\]/gi)).map((match2) => match2[1]);
    let handoff = /\[\[HANDOFF\]\]/i.test(raw);
    const reply = raw.replace(/\[\[HANDOFF\]\]/gi, "").replace(/\[\[AGENT_ACTION:[^\]]+\]\]/gi, "").replace(/\[\[EXTRACT_DATA:[^\]]+\]\]/gi, "").trim();
    if (shouldReactToSentiment2(meta.settings?.allowed_actions)) {
      try {
        const alvo = String(mensagemDoTurno || triggerCtx.message || "");
        if (alvo.trim()) {
          const emoji = pickReactionEmoji2(alvo, detectSentiment(alvo));
          await sendWhatsappReaction(supabaseAdmin2, workspaceId, routedPhone, emoji);
        }
      } catch {
      }
    }
    if (reply) {
      let replyOut = reply;
      if (isGrupoConversa) {
        const { data: lastRun } = await supabaseAdmin2.from("salesbot_runs").select("variables").eq("workspace_id", workspaceId).eq("lead_id", leadId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        const runVars = lastRun?.variables ?? {};
        replyOut = resolveMentionTokens(
          replyOut,
          { ...leadRow ?? {}, phone: routedPhone },
          runVars
        );
      }
      const s = await sendWhatsappText(supabaseAdmin2, workspaceId, routedPhone, replyOut, routedSessionId);
      if (!s.ok) return { reply, handoff, error: s.error };
      await supabaseAdmin2.from("lead_activities").insert({
        workspace_id: workspaceId,
        lead_id: leadId,
        type: "message_out",
        payload: {
          text: replyOut,
          channel: "whatsapp_web",
          whatsapp_message_id: s.messageId ?? null,
          whatsapp_session_id: routedSessionId,
          whatsapp_remote_jid: routeTarget.remoteJid,
          whatsapp_conversation_key: routeTarget.conversationKey,
          source: "ai_agent"
        },
        occurred_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    try {
      const leadInfo = leadRow ?? {};
      const camposRegras = (meta.settings?.rules ?? []).flatMap((r) => (r?.conditions ?? []).map((c) => String(c?.field ?? ""))).filter(Boolean);
      let systemMetrics = {};
      if (camposRegras.some((f) => /^(trafego|social|workflow|tracking)-/.test(f))) {
        try {
          const { loadSystemMetrics: loadSystemMetrics2 } = await Promise.resolve().then(() => (init_agent_system_data_server(), agent_system_data_server_exports));
          systemMetrics = await loadSystemMetrics2(supabaseAdmin2, workspaceId, leadId, camposRegras);
        } catch {
          systemMetrics = {};
        }
      }
      let customFieldValues2 = {};
      if (camposRegras.some((f) => f === "campo-personalizado" || f === "campo")) {
        try {
          const { data: cfv } = await supabaseAdmin2.from("lead_custom_field_values").select("field_id, value").eq("workspace_id", workspaceId).eq("lead_id", leadId);
          for (const row of cfv ?? []) {
            customFieldValues2[row.field_id] = String(row.value ?? "");
          }
        } catch {
          customFieldValues2 = {};
        }
      }
      const disparadas = matchAgentRules(meta.settings?.rules, {
        message: triggerCtx.message,
        interactions: history.filter((m) => m.role === "user").length + (extraUserMessage ? 1 : 0),
        minutesSinceCustomerMessage: triggerCtx.minutesSinceCustomerMessage,
        tags: Array.isArray(leadInfo.tags) ? leadInfo.tags : [],
        stageId: leadInfo.stage_id ?? null,
        objectiveReached: handoff,
        systemMetrics,
        customFieldValues: customFieldValues2
      });
      for (const regra of disparadas) {
        if (ruleEndsConversation(regra)) {
          handoff = true;
          continue;
        }
        const acao = ruleActionToRuntime(regra);
        if (!acao) continue;
        await executeAgentActions(supabaseAdmin2, workspaceId, leadId, routedPhone, [acao], routedSessionId);
      }
      if (disparadas.length) {
        await supabaseAdmin2.from("lead_activities").insert({
          workspace_id: workspaceId,
          lead_id: leadId,
          type: "note",
          payload: {
            text: `Agente IA aplicou ${disparadas.length} regra(s) condicional(is): ${disparadas.map((r) => r.action?.targetLabel || r.action?.type || "a\xE7\xE3o").join(", ")}.`,
            source: "ai_agent"
          }
        });
      }
    } catch {
    }
    if (handoff) {
      const outcome = Array.isArray(meta.objective_tree?.outcome) ? meta.objective_tree.outcome : [];
      await executeAgentActions(supabaseAdmin2, workspaceId, leadId, routedPhone, outcome, routedSessionId);
      const transferencias = (meta.settings?.actions ?? []).filter((a) => a?.do?.action === "transferir-usuario" && String(a.do?.target ?? "").trim()).map((a) => ({ action: "transferir-humano", target: a.do.target, targetLabel: a.do.targetLabel }));
      if (transferencias.length) {
        await executeAgentActions(supabaseAdmin2, workspaceId, leadId, routedPhone, transferencias.slice(0, 1), routedSessionId);
      }
    }
    for (const actionId of actionIds) {
      const acao = (meta.settings?.actions ?? []).find((item) => item.id === actionId);
      if (acao?.id && verdicts[acao.id]?.status === "inativo") continue;
      if (acao?.do?.action === "definir-campo") {
        const raw2 = String(acao.do?.target ?? "");
        const sep = raw2.indexOf("=");
        const fieldId = sep === -1 ? raw2.trim() : raw2.slice(0, sep).trim();
        let valor = sep === -1 ? "" : raw2.slice(sep + 1).trim();
        if (/\{\{\s*agora\s*\}\}/i.test(valor)) valor = valor.replace(/\{\{\s*agora\s*\}\}/gi, (/* @__PURE__ */ new Date()).toISOString());
        if (fieldId) {
          await supabaseAdmin2.from("lead_custom_field_values").upsert({
            workspace_id: workspaceId,
            lead_id: leadId,
            field_id: fieldId,
            value: { display: valor, raw: [valor] },
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }, { onConflict: "lead_id,field_id" });
        }
        continue;
      }
      if (acao?.do?.action === "gerenciar-tags") {
        const tag = String(acao.do?.target ?? "").trim();
        if (tag) {
          await executeAgentActions(supabaseAdmin2, workspaceId, leadId, routedPhone, [{ action: "adicionar-tag", target: tag }], routedSessionId);
        }
        continue;
      }
      const alvoDireto = /* @__PURE__ */ new Set(["iniciar-salesbot", "mudar-etapa-lead", "alterar-responsavel", "transferir-usuario", "enviar-arquivo"]);
      if (acao?.do?.action && alvoDireto.has(acao.do.action) && String(acao.do?.target ?? "").trim()) {
        await executeAgentActions(supabaseAdmin2, workspaceId, leadId, routedPhone, [{
          action: acao.do.action,
          target: acao.do.target,
          targetLabel: acao.do.targetLabel,
          message: acao.do.message
        }], routedSessionId);
        continue;
      }
      if (acao?.do?.action === "criar-compromisso") {
        const cfg = parseAppointmentTarget(acao.do?.target);
        if (cfg.titulo) {
          const start2 = new Date(Date.now() + Math.max(0, cfg.antecedenciaMin) * 6e4);
          const end2 = new Date(start2.getTime() + Math.max(5, cfg.duracaoMin) * 6e4);
          await supabaseAdmin2.from("tasks").insert({
            workspace_id: workspaceId,
            lead_id: leadId,
            title: cfg.titulo.slice(0, 200),
            status: "pendente",
            kind: "reuniao",
            due_at: start2.toISOString(),
            assignee_id: cfg.responsavelId || null
          });
          await supabaseAdmin2.from("lead_activities").insert({
            workspace_id: workspaceId,
            lead_id: leadId,
            type: "note",
            payload: { text: `Compromisso "${cfg.titulo}" agendado pelo agente IA para ${start2.toLocaleString("pt-BR")}.`, source: "ai_agent" }
          });
          if (cfg.googleAgendaLead) {
            const link = googleCalendarLink(cfg.titulo, start2, end2);
            await sendWhatsappText(
              supabaseAdmin2,
              workspaceId,
              routedPhone,
              `Agendei "${cfg.titulo}". Para salvar no seu Google Agenda: ${link}`,
              routedSessionId
            );
          }
        }
        continue;
      }
      const configured = acao?.do?.action === "adicionar-tarefa" ? acao : void 0;
      const task = configured?.do?.task;
      if (!task?.title?.trim()) continue;
      const start = new Date(Date.now() + Math.max(0, Number(task.dueInMinutes ?? 60)) * 6e4);
      const end = new Date(start.getTime() + Math.max(5, Number(task.durationMinutes ?? 30)) * 6e4);
      const dueAt = start.toISOString();
      if (task.workflowPipelineId) {
        const { createWorkflowTaskAdmin: createWorkflowTaskAdmin2 } = await Promise.resolve().then(() => (init_workflow_task_create_server(), workflow_task_create_server_exports));
        await createWorkflowTaskAdmin2({
          workspaceId,
          pipelineId: task.workflowPipelineId,
          stageId: task.workflowStageId ?? null,
          title: task.title.trim().slice(0, 160),
          description: task.description?.trim() || null,
          priority: task.priority ?? "media",
          dueAt,
          assigneeId: task.assigneeId ?? null,
          leadId
        });
      }
      if (!task.workflowPipelineId || task.addToCalendar) {
        await supabaseAdmin2.from("tasks").insert({
          workspace_id: workspaceId,
          lead_id: leadId,
          title: task.title.trim().slice(0, 200),
          status: "pendente",
          kind: "tarefa",
          start_at: start.toISOString(),
          end_at: end.toISOString()
        });
      }
    }
    return { reply, handoff };
  } catch (e) {
    return { reply: "", handoff: true, error: e.message };
  }
}
async function sendWhatsappMedia(supabaseAdmin2, workspaceId, phone, mediaPath, mediaKind, mimeType, fileName, caption, asVoice = false, sessionId) {
  const encKey = runtimeEnv("INTEGRATION_ENCRYPTION_KEY");
  if (!encKey) return { ok: false, error: "INTEGRATION_ENCRYPTION_KEY ausente" };
  const jidIdentity = whatsappIdentityFromJid(phone);
  const isGroupTarget = jidIdentity?.kind === "group";
  const digits = isGroupTarget ? "" : jidIdentity?.kind === "direct" ? jidIdentity.digits : (phone ?? "").replace(/\D/g, "");
  if (!isGroupTarget && digits.length < 8) return { ok: false, error: "Telefone inv\xE1lido" };
  const target = isGroupTarget ? jidIdentity.remoteJid : digits;
  let sessionQuery = supabaseAdmin2.from("whatsapp_web_sessions").select("id").eq("workspace_id", workspaceId).eq("provider", "evolution").eq("status", "conectado");
  if (sessionId) sessionQuery = sessionQuery.eq("id", sessionId);
  else sessionQuery = sessionQuery.order("last_connected_at", { ascending: false }).limit(1);
  const { data: sess } = await sessionQuery.maybeSingle();
  const sessId = sess?.id;
  if (!sessId) return { ok: false, error: "Nenhuma sess\xE3o Evolution conectada" };
  const { data: creds } = await supabaseAdmin2.rpc("get_evolution_credentials_service", {
    _session_id: sessId,
    _key: encKey
  });
  const c = creds;
  if (!c?.instance_name || !c.api_key) return { ok: false, error: "Credenciais Evolution indispon\xEDveis" };
  const base = (runtimeEnv("EVOLUTION_URL") ?? "").replace(/\/+$/, "");
  if (!base) return { ok: false, error: "EVOLUTION_BASE_URL n\xE3o configurado" };
  const signed = await supabaseAdmin2.storage.from("salesbot-media").createSignedUrl(mediaPath, 60 * 60);
  const mediaUrl = signed?.data?.signedUrl;
  if (!mediaUrl) return { ok: false, error: "Falha ao gerar URL da m\xEDdia" };
  try {
    const sendAsVoice = mediaKind === "audio" && asVoice === true;
    const url = sendAsVoice ? `${base}/message/sendWhatsAppAudio/${encodeURIComponent(c.instance_name)}` : `${base}/message/sendMedia/${encodeURIComponent(c.instance_name)}`;
    const body = sendAsVoice ? { number: target, audio: mediaUrl, encoding: true } : {
      number: target,
      mediatype: mediaKind === "audio" ? "document" : mediaKind,
      // image | video | document
      mimetype: mimeType,
      media: mediaUrl,
      fileName,
      caption: caption ?? ""
    };
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: c.api_key },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => "");
      return { ok: false, error: `Evolution ${resp.status}: ${bodyText.slice(0, 200)}` };
    }
    const j = await resp.json().catch(() => null);
    return { ok: true, messageId: j?.key?.id ?? null, mediaUrl };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
async function sendWhatsappPresence(supabaseAdmin2, workspaceId, phone, presence, durationMs, sessionId) {
  try {
    const encKey = runtimeEnv("INTEGRATION_ENCRYPTION_KEY");
    if (!encKey) return;
    const jidIdentity = whatsappIdentityFromJid(phone);
    const isGroupTarget = jidIdentity?.kind === "group";
    const digits = isGroupTarget ? "" : jidIdentity?.kind === "direct" ? jidIdentity.digits : (phone ?? "").replace(/\D/g, "");
    if (!isGroupTarget && digits.length < 8) return;
    const target = isGroupTarget ? jidIdentity.remoteJid : digits;
    let sessionQuery = supabaseAdmin2.from("whatsapp_web_sessions").select("id").eq("workspace_id", workspaceId).eq("provider", "evolution").eq("status", "conectado");
    if (sessionId) sessionQuery = sessionQuery.eq("id", sessionId);
    else sessionQuery = sessionQuery.order("last_connected_at", { ascending: false }).limit(1);
    const { data: sess } = await sessionQuery.maybeSingle();
    const sessId = sess?.id;
    if (!sessId) return;
    const { data: creds } = await supabaseAdmin2.rpc("get_evolution_credentials_service", {
      _session_id: sessId,
      _key: encKey
    });
    const c = creds;
    if (!c?.instance_name || !c.api_key) return;
    const base = (runtimeEnv("EVOLUTION_URL") ?? "").replace(/\/+$/, "");
    if (!base) return;
    await fetch(`${base}/chat/sendPresence/${encodeURIComponent(c.instance_name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: c.api_key },
      body: JSON.stringify({ number: target, presence, delay: Math.max(500, Math.min(2e4, durationMs)) })
    }).catch(() => {
    });
  } catch {
  }
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, Math.max(0, ms)));
}
async function sendWhatsappReaction(supabaseAdmin2, workspaceId, phone, emoji) {
  const encKey = runtimeEnv("INTEGRATION_ENCRYPTION_KEY");
  if (!encKey) return { ok: false, error: "INTEGRATION_ENCRYPTION_KEY ausente" };
  if (!emoji.trim()) return { ok: false, error: "Emoji vazio" };
  const jidIdentity = whatsappIdentityFromJid(phone);
  const isGroup = jidIdentity?.kind === "group";
  const digits = isGroup ? "" : jidIdentity?.kind === "direct" ? jidIdentity.digits : (phone ?? "").replace(/\D/g, "");
  if (!isGroup && digits.length < 8) return { ok: false, error: "Telefone inv\xE1lido" };
  const expectedJid = isGroup ? jidIdentity.remoteJid : `${digits}@s.whatsapp.net`;
  let messageQuery = supabaseAdmin2.from("whatsapp_web_messages").select("message_id, remote_jid, to_jid, from_me, sender_phone, received_at, session_id").eq("workspace_id", workspaceId);
  messageQuery = isGroup ? messageQuery.eq("remote_jid", expectedJid) : messageQuery.or(
    `sender_phone.eq.${digits},remote_jid.eq.${expectedJid},to_jid.eq.${expectedJid}`
  );
  const { data: rows } = await messageQuery.order("received_at", { ascending: false }).limit(30);
  const list = (rows ?? []).filter((m) => m.message_id);
  const target = list.find((m) => m.from_me === false) ?? list[0] ?? null;
  if (!target?.message_id) {
    return {
      ok: false,
      error: "Nenhuma mensagem nessa conversa para reagir (o lead precisa ter trocado ao menos 1 mensagem no WhatsApp Web)"
    };
  }
  if (!target.session_id) return { ok: false, error: "Mensagem WhatsApp sem sess\xE3o de origem." };
  const { data: sess } = await supabaseAdmin2.from("whatsapp_web_sessions").select("id").eq("workspace_id", workspaceId).eq("provider", "evolution").eq("status", "conectado").eq("id", target.session_id).maybeSingle();
  const sessId = sess?.id;
  if (!sessId) {
    return { ok: false, error: "A sess\xE3o WhatsApp desta conversa n\xE3o est\xE1 conectada." };
  }
  const remoteJid = target.remote_jid || target.to_jid || expectedJid;
  const fromMe = target.from_me === true;
  const { data: creds } = await supabaseAdmin2.rpc("get_evolution_credentials_service", {
    _session_id: sessId,
    _key: encKey
  });
  const credentials = creds;
  if (!credentials?.instance_name || !credentials.api_key) {
    return { ok: false, error: "Credenciais Evolution indispon\xEDveis" };
  }
  const base = (runtimeEnv("EVOLUTION_URL") ?? "").replace(/\/+$/, "");
  if (!base) return { ok: false, error: "EVOLUTION_BASE_URL n\xE3o configurado" };
  const key = { remoteJid, fromMe, id: target.message_id };
  const payloads = [
    { key, reaction: emoji },
    { reactionMessage: { key, text: emoji } }
  ];
  let lastError = "";
  for (const body of payloads) {
    try {
      const resp = await fetch(
        `${base}/message/sendReaction/${encodeURIComponent(credentials.instance_name)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: credentials.api_key },
          body: JSON.stringify(body)
        }
      );
      if (resp.ok) {
        const json = await resp.json().catch(() => null);
        return { ok: true, messageId: json?.key?.id ?? null };
      }
      const bodyText = await resp.text().catch(() => "");
      lastError = `Evolution ${resp.status}: ${bodyText.slice(0, 200)}`;
      if (resp.status >= 500) break;
    } catch (error) {
      lastError = error.message;
      break;
    }
  }
  return { ok: false, error: lastError || "Falha ao enviar rea\xE7\xE3o" };
}
async function runAction(supabaseAdmin2, run, lead, block) {
  const cfg = block.config;
  const tipo = String(cfg.acaoTipo ?? "");
  const val = String(cfg.acaoConfig ?? "");
  switch (tipo) {
    case "enviar-privado": {
      const mensagem = interpolate(String(cfg.acaoConfig ?? ""), lead, run.variables).trim();
      if (!mensagem) return { ok: false, message: "mensagem privada vazia" };
      const phone = getSalesbotGroupParticipantPhone(run.variables);
      if (!phone) return { ok: false, message: "participante do grupo n\xE3o identificado" };
      const groupRoute = await resolveRuntimeWhatsappTarget(
        supabaseAdmin2,
        run.workspace_id,
        run.lead_id,
        lead.phone ?? ""
      );
      if (!groupRoute?.sessionId) {
        return { ok: false, message: "sess\xE3o WhatsApp do grupo n\xE3o identificada" };
      }
      const result = await sendWhatsappText(
        supabaseAdmin2,
        run.workspace_id,
        phone,
        mensagem,
        groupRoute.sessionId
      );
      return result.ok ? { ok: true, message: "mensagem privada enviada" } : { ok: false, message: result.error ?? "falha ao enviar mensagem privada" };
    }
    case "notificar-admins": {
      const mensagem = interpolate(String(cfg.acaoConfig ?? ""), lead, run.variables).trim();
      if (!mensagem) return { ok: false, message: "mensagem para admins vazia" };
      const groupJid = getSalesbotGroupJid(lead.phone, run.variables);
      if (!groupJid) return { ok: false, message: "grupo n\xE3o identificado" };
      const resolved = await resolveSalesbotGroupAdminPhones(
        supabaseAdmin2,
        run.workspace_id,
        groupJid
      );
      if (!resolved.ok) {
        return { ok: false, message: resolved.error ?? "nenhum admin identificado no grupo" };
      }
      let sent = 0;
      let failed = 0;
      let lastError = "";
      for (const phone of resolved.phones) {
        const result = await sendWhatsappText(
          supabaseAdmin2,
          run.workspace_id,
          phone,
          mensagem,
          resolved.sessionId
        );
        if (result.ok) sent += 1;
        else {
          failed += 1;
          lastError = result.error ?? lastError;
        }
      }
      if (!sent) return { ok: false, message: lastError || "falha ao notificar admins" };
      return {
        ok: true,
        message: `${sent} admin(s) notificado(s)${failed ? `; ${failed} falha(s)` : ""}`
      };
    }
    case "enviar-email": {
      const to = String(lead.email ?? "").trim();
      if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return { ok: true, message: "email_missing: lead sem e-mail v\xE1lido" };
      }
      const subject = interpolate(String(cfg.emailSubject ?? ""), lead, run.variables).trim();
      const body = interpolate(String(cfg.acaoConfig ?? ""), lead, run.variables).trim();
      if (!subject) return { ok: false, message: "email_failed: assunto vazio" };
      if (!body) return { ok: false, message: "email_failed: corpo vazio" };
      const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      const html = escapeHtml(body).replace(/\r?\n/g, "<br>");
      try {
        const email = await Promise.resolve().then(() => (init_salesbot_email(), salesbot_email_exports));
        const sent = await email.sendWorkspaceEmail(supabaseAdmin2, run.workspace_id, {
          to,
          subject,
          html,
          text: body,
          idempotencyKey: run.id + ":" + block.id
        });
        return {
          ok: true,
          message: `email_sent: ${to} via ${sent.mode}${sent.id ? ` (${sent.id})` : ""}`
        };
      } catch (e) {
        return {
          ok: false,
          message: `email_failed: ${e instanceof Error ? e.message : "falha desconhecida no envio"}`
        };
      }
    }
    case "nota": {
      await supabaseAdmin2.from("lead_activities").insert({
        workspace_id: run.workspace_id,
        lead_id: lead.id,
        type: "note",
        payload: { text: val || "(nota via salesbot)", by: null, salesbot_run_id: run.id }
      });
      return { ok: true };
    }
    case "tags": {
      const incoming = val.split(",").map((s) => s.trim()).filter(Boolean);
      if (!incoming.length) return { ok: true, message: "sem tags" };
      const cur = Array.isArray(lead.tags) ? lead.tags : [];
      const mode = String(cfg.tagsModo ?? "adicionar") === "remover" ? "remover" : "adicionar";
      const incomingKeys = new Set(incoming.map((tag) => tag.toLocaleLowerCase()));
      let next;
      let changed = 0;
      const addedTags = [];
      if (mode === "remover") {
        next = cur.filter((tag) => !incomingKeys.has(String(tag).toLocaleLowerCase()));
        changed = cur.length - next.length;
      } else {
        next = [...cur];
        const existing = new Set(cur.map((tag) => String(tag).toLocaleLowerCase()));
        for (const tag of incoming) {
          const key = tag.toLocaleLowerCase();
          if (existing.has(key)) continue;
          existing.add(key);
          next.push(tag);
          addedTags.push(tag);
          changed += 1;
        }
      }
      if (!changed) return { ok: true, message: mode === "remover" ? "nenhuma tag removida" : "tags j\xE1 vinculadas" };
      const { error } = await supabaseAdmin2.from("leads").update({ tags: next, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", lead.id).eq("workspace_id", run.workspace_id);
      if (error) return { ok: false, message: error.message };
      lead.tags = next;
      if (addedTags.length) {
        const { enqueueLeadAutomationEvent: enqueueLeadAutomationEvent2 } = await Promise.resolve().then(() => (init_stage_automation_engine_server(), stage_automation_engine_server_exports));
        await enqueueLeadAutomationEvent2(supabaseAdmin2, {
          leadId: lead.id,
          event: "tag-added",
          workspaceId: run.workspace_id,
          tags: addedTags
        });
      }
      return { ok: true, message: `${mode === "remover" ? "-" : "+"}${changed} tag(s)` };
    }
    case "mudar-status-lead": {
      const stageId = String(cfg.destinoStageId ?? val ?? "");
      if (!stageId) return { ok: false, message: "stage vazio" };
      const { data: stageRow } = await supabaseAdmin2.from("pipeline_stages").select("id, name, pipeline_id").eq("id", stageId).eq("workspace_id", run.workspace_id).maybeSingle();
      const st = stageRow;
      if (!st || !st.pipeline_id) return { ok: false, message: `etapa ${stageId} n\xE3o existe neste workspace` };
      const requestedPipelineId = cfg.destinoPipelineId ? String(cfg.destinoPipelineId) : null;
      if (requestedPipelineId && requestedPipelineId !== st.pipeline_id) {
        return { ok: false, message: "etapa n\xE3o pertence ao funil configurado" };
      }
      const pipelineId = st.pipeline_id;
      const patch = { stage_id: stageId, pipeline_id: pipelineId, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
      const { error } = await supabaseAdmin2.from("leads").update(patch).eq("id", lead.id).eq("workspace_id", run.workspace_id);
      if (error) return { ok: false, message: error.message };
      await supabaseAdmin2.from("lead_activities").insert({
        workspace_id: run.workspace_id,
        lead_id: lead.id,
        type: "stage_change",
        payload: {
          from_stage_id: lead.stage_id ?? null,
          to_stage_id: stageId,
          to_stage_nome: String(cfg.destinoEtapa ?? st.name ?? ""),
          by: null,
          salesbot_run_id: run.id
        }
      });
      const fromStageId = lead.stage_id ?? null;
      lead.stage_id = stageId;
      lead.pipeline_id = pipelineId;
      const { enqueueLeadAutomationEvent: enqueueLeadAutomationEvent2 } = await Promise.resolve().then(() => (init_stage_automation_engine_server(), stage_automation_engine_server_exports));
      await enqueueLeadAutomationEvent2(supabaseAdmin2, {
        leadId: lead.id,
        event: "moved",
        workspaceId: run.workspace_id,
        pipelineId,
        stageId,
        fromStageId
      });
      return { ok: true, message: `lead movido para ${String(cfg.destinoEtapa ?? st.name ?? stageId)}` };
    }
    case "mudar-responsavel": {
      const userId = String(cfg.destinoResponsavelId ?? val ?? "");
      if (!userId) return { ok: false, message: "respons\xE1vel vazio" };
      const { data: member } = await supabaseAdmin2.from("workspace_members").select("user_id").eq("workspace_id", run.workspace_id).eq("user_id", userId).maybeSingle();
      if (!member) return { ok: false, message: "respons\xE1vel pertence a outro workspace" };
      const { error } = await supabaseAdmin2.from("leads").update({ responsible_id: userId, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", lead.id).eq("workspace_id", run.workspace_id);
      if (error) return { ok: false, message: error.message };
      const { enqueueLeadAutomationEvent: enqueueLeadAutomationEvent2 } = await Promise.resolve().then(() => (init_stage_automation_engine_server(), stage_automation_engine_server_exports));
      await enqueueLeadAutomationEvent2(supabaseAdmin2, {
        leadId: lead.id,
        event: "assignee-changed",
        workspaceId: run.workspace_id
      });
      return { ok: true };
    }
    case "definir-campo": {
      const fieldRef = String(cfg.campoId ?? "");
      if (!fieldRef) return { ok: false, message: "campo vazio" };
      const isBuiltin = (r) => r.startsWith("lead:") || r.startsWith("empresa:");
      const companyIdOf = async () => {
        const { data } = await supabaseAdmin2.from("leads").select("company_id").eq("id", lead.id).eq("workspace_id", run.workspace_id).maybeSingle();
        return data?.company_id ?? null;
      };
      const readRef = async (ref) => {
        if (ref.startsWith("lead:")) {
          const col = ref.slice(5);
          const { data: data2 } = await supabaseAdmin2.from("leads").select(col).eq("id", lead.id).eq("workspace_id", run.workspace_id).maybeSingle();
          const v = data2?.[col];
          return v == null ? "" : String(v);
        }
        if (ref.startsWith("empresa:")) {
          const col = ref.slice(8);
          const cid = await companyIdOf();
          if (!cid) return "";
          const { data: data2 } = await supabaseAdmin2.from("companies").select(col).eq("id", cid).eq("workspace_id", run.workspace_id).maybeSingle();
          const v = data2?.[col];
          return v == null ? "" : String(v);
        }
        const { data } = await supabaseAdmin2.from("lead_custom_field_values").select("value").eq("workspace_id", run.workspace_id).eq("lead_id", lead.id).eq("field_id", ref).maybeSingle();
        const raw = data?.value;
        return raw?.display ?? "";
      };
      const origem = String(cfg.campoOrigem ?? "manual");
      let value;
      if (origem === "mensagem") {
        value = String(run.variables.last_message ?? "");
      } else if (origem === "copiar" && cfg.campoOrigemRef) {
        value = await readRef(String(cfg.campoOrigemRef));
      } else {
        value = String(cfg.campoValor ?? val ?? "");
      }
      if (/\{\{\s*agora\s*\}\}/i.test(value)) {
        value = value.replace(/\{\{\s*agora\s*\}\}/gi, (/* @__PURE__ */ new Date()).toISOString());
      }
      if (isBuiltin(fieldRef)) {
        const nowIso = (/* @__PURE__ */ new Date()).toISOString();
        if (fieldRef.startsWith("lead:")) {
          const col2 = fieldRef.slice(5);
          const parsed = col2 === "value" ? Number(String(value).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")) || 0 : value;
          const { error: error3 } = await supabaseAdmin2.from("leads").update({ [col2]: parsed, updated_at: nowIso }).eq("id", lead.id).eq("workspace_id", run.workspace_id);
          if (error3) return { ok: false, message: error3.message };
          const { enqueueLeadAutomationEvent: enqueueLeadAutomationEvent3 } = await Promise.resolve().then(() => (init_stage_automation_engine_server(), stage_automation_engine_server_exports));
          await enqueueLeadAutomationEvent3(supabaseAdmin2, {
            leadId: lead.id,
            event: "field-updated",
            workspaceId: run.workspace_id,
            fieldName: col2
          });
          return { ok: true };
        }
        const col = fieldRef.slice(8);
        const cid = await companyIdOf();
        if (!cid) return { ok: false, message: "lead sem empresa vinculada" };
        const { error: error2 } = await supabaseAdmin2.from("companies").update({ [col]: value, updated_at: nowIso }).eq("id", cid).eq("workspace_id", run.workspace_id);
        if (error2) return { ok: false, message: error2.message };
        return { ok: true };
      }
      const { data: field } = await supabaseAdmin2.from("lead_custom_fields").select("id, name").eq("id", fieldRef).eq("workspace_id", run.workspace_id).maybeSingle();
      if (!field) return { ok: false, message: "campo pertence a outro workspace" };
      const { error } = await supabaseAdmin2.from("lead_custom_field_values").upsert({
        workspace_id: run.workspace_id,
        lead_id: lead.id,
        field_id: fieldRef,
        value: { display: value, raw: [value] },
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }, { onConflict: "lead_id,field_id" });
      if (error) return { ok: false, message: error.message };
      const { enqueueLeadAutomationEvent: enqueueLeadAutomationEvent2 } = await Promise.resolve().then(() => (init_stage_automation_engine_server(), stage_automation_engine_server_exports));
      await enqueueLeadAutomationEvent2(supabaseAdmin2, {
        leadId: lead.id,
        event: "field-updated",
        workspaceId: run.workspace_id,
        fieldId: fieldRef,
        fieldName: field.name
      });
      return { ok: true };
    }
    case "webhook": {
      const automationId = String(cfg.webhookAutomationId ?? "").trim();
      const payload = {
        lead_id: lead.id,
        workspace_id: run.workspace_id,
        salesbot_id: run.salesbot_id,
        run_id: run.id,
        block_id: block.id,
        variables: run.variables
      };
      let result;
      try {
        if (automationId) {
          const mod = await Promise.resolve().then(() => (init_salesbot_external_automation_server(), salesbot_external_automation_server_exports));
          result = await mod.executeConnectedSalesbotAutomation({
            supabaseAdmin: supabaseAdmin2,
            workspaceId: run.workspace_id,
            automationId,
            event: "salesbot.external_action",
            payload,
            timeoutMs: Number(cfg.webhookTimeoutMs ?? 15e3)
          });
        } else {
          const url = String(cfg.webhookUrl ?? val ?? "").trim();
          if (!url) return { ok: false, message: "webhook sem integra\xE7\xE3o conectada e sem URL" };
          const mod = await Promise.resolve().then(() => (init_salesbot_webhook_server(), salesbot_webhook_server_exports));
          result = await mod.executeSalesbotWebhook({
            url,
            method: String(cfg.webhookMethod ?? "POST").toUpperCase(),
            secret: cfg.webhookSecret ? String(cfg.webhookSecret) : null,
            body: payload,
            timeoutMs: Number(cfg.webhookTimeoutMs ?? 15e3),
            retries: Number(cfg.webhookRetries ?? 0)
          });
        }
      } catch (error) {
        result = {
          ok: false,
          status: null,
          responseText: "",
          responseJson: null,
          error: error instanceof Error ? error.message : String(error),
          attempts: 0
        };
      }
      const responseKeyRaw = String(cfg.webhookResponseVariable ?? "webhook_response").trim();
      const responseKey = /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(responseKeyRaw) ? responseKeyRaw : "webhook_response";
      const responseValue = result.responseJson ?? result.responseText;
      const nextVariables = {
        ...run.variables ?? {},
        webhook_ok: result.ok,
        webhook_status: result.status ?? 0,
        webhook_error: result.error ?? "",
        [responseKey]: responseValue
      };
      run.variables = nextVariables;
      await supabaseAdmin2.from("salesbot_runs").update({ variables: nextVariables }).eq("id", run.id).eq("workspace_id", run.workspace_id);
      const detail = result.ok ? `HTTP ${result.status ?? 0}; resposta \u2192 {{${responseKey}}}` : result.error ?? `HTTP ${result.status ?? 0}`;
      return { ok: result.ok, message: detail };
    }
    case "tarefa": {
      const title = String(cfg.tarefaTitulo ?? val ?? "Tarefa via Salesbot").slice(0, 160);
      const kind = String(cfg.tarefaKind ?? "tarefa");
      const offsetMin = Math.max(0, Number(cfg.tarefaOffsetMin ?? 60));
      const durMin = Math.max(5, Number(cfg.tarefaDuracaoMin ?? 30));
      const start = new Date(Date.now() + offsetMin * 6e4);
      const end = new Date(start.getTime() + durMin * 6e4);
      const wfPipeline = cfg.tarefaWorkflowPipelineId ? String(cfg.tarefaWorkflowPipelineId) : "";
      const alsoCalendar = wfPipeline ? cfg.tarefaTambemCalendario === true : true;
      let wfMsg = "";
      if (wfPipeline) {
        const { createWorkflowTaskAdmin: createWorkflowTaskAdmin2 } = await Promise.resolve().then(() => (init_workflow_task_create_server(), workflow_task_create_server_exports));
        const res = await createWorkflowTaskAdmin2({
          workspaceId: run.workspace_id,
          pipelineId: wfPipeline,
          stageId: cfg.tarefaWorkflowStageId ? String(cfg.tarefaWorkflowStageId) : null,
          title,
          description: `Criada via Salesbot para o lead ${lead.id}`,
          priority: cfg.tarefaWorkflowPriority ?? "media",
          dueAt: end.toISOString(),
          assigneeId: cfg.tarefaWorkflowAssigneeId ?? lead.responsible_id ?? null,
          tags: [`lead:${lead.id}`],
          createdBy: lead.responsible_id ?? null,
          leadId: lead.id
        });
        if (!res.ok) return { ok: false, message: res.error };
        wfMsg = `tarefa no fluxo criada (${res.id})`;
        if (!alsoCalendar) return { ok: true, message: wfMsg };
      }
      const { error } = await supabaseAdmin2.from("tasks").insert({
        workspace_id: run.workspace_id,
        created_by: lead.responsible_id ?? null,
        title,
        kind,
        status: "pendente",
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        lead_id: lead.id
      });
      if (error) return { ok: false, message: wfMsg ? `${wfMsg}; calend\xE1rio falhou: ${error.message}` : error.message };
      const calMsg = `tarefa criada p/ ${start.toISOString()}`;
      return { ok: true, message: wfMsg ? `${wfMsg} + ${calMsg}` : calMsg };
    }
    case "completar-tarefa": {
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      let calDone = 0;
      let wfDone = 0;
      const { data: pending, error: qErr } = await supabaseAdmin2.from("tasks").select("id").eq("workspace_id", run.workspace_id).eq("lead_id", lead.id).eq("status", "pendente");
      if (qErr) return { ok: false, message: qErr.message };
      const ids = pending?.map((t) => t.id) ?? [];
      if (ids.length) {
        const { error } = await supabaseAdmin2.from("tasks").update({ status: "concluida", updated_at: nowIso }).in("id", ids);
        if (error) return { ok: false, message: error.message };
        calDone = ids.length;
      }
      const { data: wfRows } = await supabaseAdmin2.from("workflow_tasks").select("id, pipeline_id").eq("workspace_id", run.workspace_id).eq("status", "ativa").eq("is_review_copy", false).ilike("description", `%[Lead: ${lead.id}]%`);
      const wfList = wfRows ?? [];
      if (wfList.length) {
        const pipeIds = [...new Set(wfList.map((t) => t.pipeline_id))];
        const { data: doneStages } = await supabaseAdmin2.from("workflow_stages").select("id, pipeline_id").in("pipeline_id", pipeIds).eq("is_done_stage", true);
        const doneByPipe = /* @__PURE__ */ new Map();
        for (const s of doneStages ?? []) {
          if (!doneByPipe.has(s.pipeline_id)) doneByPipe.set(s.pipeline_id, s.id);
        }
        for (const t of wfList) {
          const patch = {
            status: "concluida",
            completed_at: nowIso,
            updated_at: nowIso
          };
          const stageId = doneByPipe.get(t.pipeline_id);
          if (stageId) patch.stage_id = stageId;
          const { error } = await supabaseAdmin2.from("workflow_tasks").update(patch).eq("id", t.id);
          if (!error) wfDone += 1;
        }
      }
      if (!calDone && !wfDone) return { ok: true, message: "nenhuma tarefa pendente" };
      const parts = [];
      if (calDone) parts.push(`${calDone} no calend\xE1rio`);
      if (wfDone) parts.push(`${wfDone} no fluxo`);
      return { ok: true, message: `tarefas conclu\xEDdas: ${parts.join(" + ")}` };
    }
    case "status-conversa": {
      const raw = String(cfg.acaoConfig ?? val ?? "").toLowerCase().trim();
      const allowed = ["aberta", "lida", "fechada"];
      if (!allowed.includes(raw)) {
        return { ok: false, message: "status inv\xE1lido (use aberta/lida/fechada)" };
      }
      const { error } = await supabaseAdmin2.from("leads").update({ conversation_status: raw, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", lead.id).eq("workspace_id", run.workspace_id);
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: `status da conversa: ${raw}` };
    }
    case "formulario": {
      const listRaw = Array.isArray(cfg.formularios) ? cfg.formularios : [];
      const ids = listRaw.map((x) => String(x?.id ?? "")).filter(Boolean).length ? listRaw.map((x) => String(x?.id ?? "")).filter(Boolean) : [String(cfg.formularioId ?? "")].filter(Boolean);
      if (!ids.length) return { ok: false, message: "formul\xE1rio vazio" };
      const { data: formsData } = await supabaseAdmin2.from("crm_forms").select("id, slug, nome").in("id", ids).eq("workspace_id", run.workspace_id);
      const rows = formsData ?? [];
      const origin = resolvePublicAppUrl();
      const found = ids.map((id) => rows.find((r2) => r2.id === id)).filter((r2) => Boolean(r2?.slug));
      if (!found.length) return { ok: false, message: "formul\xE1rio n\xE3o encontrado" };
      const urls = found.map((f) => `${origin}/f/${encodeURIComponent(String(f.slug))}?leadId=${encodeURIComponent(lead.id)}`);
      const template = String(cfg.formularioMensagem ?? "Ol\xE1! Preencha por favor:").trim();
      const base = template.replace(/\{\{\s*url\s*\}\}/g, urls[0] ?? "");
      const missing = urls.filter((u) => !base.includes(u));
      const text = [base, ...missing].filter(Boolean).join("\n\n");
      const r = await sendLeadWhatsappText(
        supabaseAdmin2,
        run.workspace_id,
        run.lead_id,
        lead.phone ?? "",
        text
      );
      const nomes = found.map((f) => f.nome ?? f.slug).join(", ");
      return r.ok ? { ok: true, message: `form ${nomes} enviado` } : { ok: false, message: r.error };
    }
    case "vincular-produto": {
      const config = block.config || {};
      const productId = config.productId || config.acaoConfig;
      const kind = config.productKind || "interesse";
      const prodNome = config.productNome || "produto";
      if (!productId) {
        return { ok: false, message: "produto n\xE3o selecionado" };
      }
      const { data: product } = await supabaseAdmin2.from("products").select("id").eq("id", productId).eq("workspace_id", run.workspace_id).maybeSingle();
      if (!product) {
        return { ok: false, message: "produto n\xE3o encontrado ou pertence a outro workspace" };
      }
      const linkData = {
        workspace_id: run.workspace_id,
        lead_id: lead.id,
        product_id: productId,
        kind
      };
      const { error } = await supabaseAdmin2.from("lead_products").upsert(linkData, { onConflict: "lead_id,product_id,kind" });
      if (error) {
        return { ok: false, message: error.message };
      }
      await supabaseAdmin2.from("lead_activities").insert({
        workspace_id: run.workspace_id,
        lead_id: lead.id,
        type: "produto_vinculado",
        payload: {
          product_id: productId,
          product_nome: prodNome,
          kind,
          salesbot_run_id: run.id
        }
      });
      return { ok: true, message: `vinculado: ${prodNome} (${kind})` };
    }
    default:
      return { ok: false, message: `a\xE7\xE3o "${tipo}" ainda n\xE3o implementada` };
  }
}
async function evalCondition(supabaseAdmin2, run, lead, block) {
  const conds = Array.isArray(block.config.condicoes) ? block.config.condicoes : [];
  if (!conds.length) return true;
  const modo = String(block.config.condicaoModo ?? "e");
  const results = [];
  for (const c of conds) {
    const sujeito = String(c.sujeito ?? "cliente");
    const operador = String(c.operador ?? "igual");
    const valor = String(c.valor ?? "");
    let atual = "";
    if (sujeito === "cliente" || sujeito === "comentario") {
      atual = String(run.variables.last_message ?? "");
    } else if (sujeito === "fonte-leads") {
      const found = await leadMatchesOrigin(supabaseAdmin2, lead, valor);
      results.push(operador === "desigual" ? !found : found);
      continue;
    } else if (sujeito === "etapa") {
      atual = String(lead.stage_id ?? "");
    } else if (sujeito === "tag") {
      const tags = Array.isArray(lead.tags) ? lead.tags : [];
      const found = tags.some((t) => t.toLowerCase() === valor.toLowerCase());
      results.push(operador === "desigual" ? !found : found);
      continue;
    } else if (sujeito === "campo-personalizado") {
      const fieldId = String(c.campo ?? "");
      if (fieldId) {
        const { data } = await supabaseAdmin2.from("lead_custom_field_values").select("value").eq("lead_id", lead.id).eq("field_id", fieldId).maybeSingle();
        atual = customValueToText(data?.value);
      }
    }
    const match2 = operador === "igual" ? atual === valor : operador === "desigual" ? atual !== valor : operador === "contem" ? atual.toLowerCase().includes(valor.toLowerCase()) : false;
    results.push(match2);
  }
  return modo === "ou" ? results.some(Boolean) : results.every(Boolean);
}
async function runValidation(supabaseAdmin2, run, lead, block) {
  return evalValidacaoRegra(supabaseAdmin2, run, lead, {
    alvo: String(block.config.validacaoAlvo ?? "mensagem"),
    campoId: String(block.config.validacaoCampoId ?? ""),
    tipo: String(block.config.validacaoTipo ?? ""),
    valor: String(block.config.validacaoValor ?? "")
  });
}
function parseHM(s) {
  const [h, m] = String(s || "0:0").split(":").map((n) => Number(n) || 0);
  return h * 60 + m;
}
function nowInTz(tz) {
  const d = /* @__PURE__ */ new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(d);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { day: map[wd] ?? 1, minutes: hh * 60 + mm, date: d };
}
function isBusinessHoursNow(cfg = DEFAULT_BH_CFG) {
  const { day, minutes } = nowInTz(cfg.timezone);
  const d = cfg.days[day];
  if (!d || !d.enabled) return false;
  return minutes >= parseHM(d.start) && minutes < parseHM(d.end);
}
function nextBusinessHoursStart(cfg = DEFAULT_BH_CFG) {
  const now = nowInTz(cfg.timezone);
  for (let i = 0; i < 8; i++) {
    const dayIdx = (now.day + i) % 7;
    const d = cfg.days[dayIdx];
    if (d?.enabled) {
      const startMin = parseHM(d.start);
      if (i === 0 && now.minutes < startMin) {
        return new Date(Date.now() + (startMin - now.minutes) * 6e4);
      }
      if (i > 0) {
        const minsUntilMidnight = 24 * 60 - now.minutes;
        const extraDays = i - 1;
        return new Date(Date.now() + (minsUntilMidnight + extraDays * 24 * 60 + startMin) * 6e4);
      }
    }
  }
  return new Date(Date.now() + 60 * 6e4);
}
function nextBusinessHoursEnd(cfg = DEFAULT_BH_CFG) {
  const now = nowInTz(cfg.timezone);
  for (let i = 0; i < 8; i++) {
    const dayIdx = (now.day + i) % 7;
    const d = cfg.days[dayIdx];
    if (d?.enabled) {
      const endMin = parseHM(d.end);
      if (i === 0 && now.minutes < endMin) {
        return new Date(Date.now() + (endMin - now.minutes) * 6e4);
      }
      if (i > 0) {
        const minsUntilMidnight = 24 * 60 - now.minutes;
        const extraDays = i - 1;
        return new Date(Date.now() + (minsUntilMidnight + extraDays * 24 * 60 + endMin) * 6e4);
      }
    }
  }
  return new Date(Date.now() + 60 * 6e4);
}
function normalizeBusinessHours(input) {
  const src = input && typeof input === "object" ? input : {};
  const days = Array.isArray(src.days) && src.days.length === 7 ? src.days : DEFAULT_BH_CFG.days;
  return {
    timezone: typeof src.timezone === "string" && src.timezone ? src.timezone : DEFAULT_BH_CFG.timezone,
    days: days.map((d, i) => ({
      enabled: !!(d?.enabled ?? DEFAULT_BH_CFG.days[i].enabled),
      start: typeof d?.start === "string" ? d.start : DEFAULT_BH_CFG.days[i].start,
      end: typeof d?.end === "string" ? d.end : DEFAULT_BH_CFG.days[i].end
    }))
  };
}
async function executeRun(supabaseAdmin2, runInput) {
  let run = null;
  if (typeof runInput === "string") {
    const { data: runData } = await supabaseAdmin2.from("salesbot_runs").select("id, workspace_id, salesbot_id, lead_id, current_block_id, status, variables").eq("id", runInput).maybeSingle();
    run = runData;
  } else {
    run = runInput;
  }
  if (!run) return;
  if (run.status === "finished" || run.status === "error") return;
  const blocks = await loadBlocks(supabaseAdmin2, run.salesbot_id);
  const lead = await loadLead(supabaseAdmin2, run.lead_id, run.workspace_id);
  if (!lead) {
    await supabaseAdmin2.from("salesbot_runs").update({ status: "error", last_error: "Lead n\xE3o encontrado", finished_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", run.id);
    return;
  }
  const cfMap = await loadLeadCustomFieldMap(supabaseAdmin2, run.workspace_id, lead.id);
  run.variables = { ...run.variables ?? {}, ...cfMap };
  const { data: wsRow } = await supabaseAdmin2.from("workspaces").select("business_hours").eq("id", run.workspace_id).maybeSingle();
  const bhCfg = normalizeBusinessHours(wsRow?.business_hours);
  const { data: botMetaRow } = await supabaseAdmin2.from("salesbots").select("scope, settings").eq("id", run.salesbot_id).maybeSingle();
  const botMeta = botMetaRow;
  const isGrupoBot = botMeta?.scope === "grupo";
  const maxInteracoesGrupo = isGrupoBot ? Math.max(0, Number(botMeta?.settings?.["maxInteracoes"] ?? 5) || 5) : 0;
  let current = run.current_block_id ? findBlockById(blocks, run.current_block_id) : findStartBlock(blocks);
  if (!current) {
    await supabaseAdmin2.from("salesbot_runs").update({ status: "finished", finished_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", run.id);
    return;
  }
  let steps = 0;
  while (current && steps < MAX_STEPS_PER_TICK) {
    steps++;
    const b = current;
    await supabaseAdmin2.from("salesbot_runs").update({ current_block_id: b.id, status: "running" }).eq("id", run.id);
    let nextId = b.next_block_id;
    let advance = true;
    if (isGrupoBot && maxInteracoesGrupo > 0 && b.type === "enviar-mensagem") {
      const usadas = Number(run.variables?.grupo_interacoes ?? 0);
      if (usadas >= maxInteracoesGrupo) {
        await log(supabaseAdmin2, run, b, "ok", `limite de ${maxInteracoesGrupo} intera\xE7\xF5es no grupo atingido`);
        await supabaseAdmin2.from("salesbot_runs").update({ status: "finished", current_block_id: null, finished_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", run.id);
        return;
      }
      run.variables = { ...run.variables ?? {}, grupo_interacoes: usadas + 1 };
      await supabaseAdmin2.from("salesbot_runs").update({ variables: run.variables }).eq("id", run.id);
    }
    try {
      switch (b.type) {
        case "enviar-mensagem": {
          const texto = interpolate(String(b.config.texto ?? ""), lead, run.variables);
          const textoDelayMs = Math.max(0, Math.min(2e4, Number(b.config.textoDelayMs ?? 0)));
          const legacy = String(b.config.mediaPath ?? "").trim();
          const legacyKind = String(b.config.mediaKind ?? "").trim();
          const rawItems = Array.isArray(b.config.mediaItems) ? b.config.mediaItems : [];
          const items = rawItems.length > 0 ? rawItems.filter((it) => it && typeof it.path === "string" && it.kind) : legacy && legacyKind ? [{
            path: legacy,
            kind: legacyKind,
            mime: String(b.config.mediaMime ?? "application/octet-stream"),
            filename: String(b.config.mediaFilename ?? "arquivo"),
            caption: texto
            // legado usava texto como legenda
          }] : [];
          const leadPhone = lead.phone ?? "";
          const destinoPrivado = String(b.config.destino ?? "grupo") === "privado" && leadPhone.includes("@g.us");
          const privadoDigits = String(
            run.variables?.participante_telefone ?? run.variables?.membro_telefone ?? ""
          ).replace(/\D/g, "");
          const routeTarget = await resolveRuntimeWhatsappTarget(
            supabaseAdmin2,
            run.workspace_id,
            run.lead_id,
            leadPhone
          );
          if (!routeTarget) {
            await log(
              supabaseAdmin2,
              run,
              b,
              "error",
              "Identidade WhatsApp amb\xEDgua: informe DDI expl\xEDcito ou inicie a conversa por um JID real."
            );
            break;
          }
          const phone = destinoPrivado && privadoDigits.length >= 8 ? privadoDigits : routeTarget.phone;
          const routeSessionId = routeTarget.sessionId;
          const sentMsgIds = [];
          const sentMedia = [];
          const useBotoes = Boolean(b.config.useBotoes) && !phone.includes("@g.us");
          const botoesCfg = Array.isArray(b.config.botoes) ? b.config.botoes : [];
          const botoes = botoesCfg.map((x) => ({
            id: String(x.id ?? "").trim(),
            label: interpolate(String(x.label ?? ""), lead, run.variables).trim(),
            nextBlockId: typeof x.nextBlockId === "string" && x.nextBlockId ? x.nextBlockId : null,
            url: typeof x.url === "string" && x.url.trim() ? x.url.trim() : void 0
          })).filter((x) => x.label.length > 0).slice(0, 3);
          if (texto.trim() && !(rawItems.length === 0 && legacy && legacyKind)) {
            if (textoDelayMs > 0) {
              await sendWhatsappPresence(supabaseAdmin2, run.workspace_id, phone, "composing", textoDelayMs, routeSessionId);
              await sleep(textoDelayMs);
            }
            const r = useBotoes && botoes.length > 0 ? await sendWhatsappButtons(supabaseAdmin2, run.workspace_id, phone, texto, botoes, void 0, routeSessionId) : await sendWhatsappText(supabaseAdmin2, run.workspace_id, phone, texto, routeSessionId);
            if (r.ok) sentMsgIds.push(r.messageId ?? null);
            else await log(supabaseAdmin2, run, b, "error", r.error);
          }
          for (const it of items) {
            const delay = Math.max(0, Math.min(2e4, Number(it.delayMs ?? 0)));
            const isVoice = it.kind === "audio" && it.asVoice === true;
            if (delay > 0) {
              const presence = isVoice ? "recording" : "composing";
              await sendWhatsappPresence(supabaseAdmin2, run.workspace_id, phone, presence, delay, routeSessionId);
              await sleep(delay);
            }
            const captionInterp = it.caption ? interpolate(String(it.caption), lead, run.variables) : "";
            const r = await sendWhatsappMedia(
              supabaseAdmin2,
              run.workspace_id,
              phone,
              it.path,
              it.kind,
              it.mime || "application/octet-stream",
              it.filename || "arquivo",
              captionInterp,
              isVoice,
              routeSessionId
            );
            if (r.ok) {
              sentMsgIds.push(r.messageId ?? null);
              if (r.messageId && (it.kind === "video" || it.kind === "audio")) {
                sentMedia.push({ messageId: r.messageId, kind: it.kind });
              }
            } else await log(supabaseAdmin2, run, b, "error", r.error);
          }
          if (sentMsgIds.length > 0) {
            if (sentMedia.length > 0) {
              const nextVars = { ...run.variables, salesbot_last_sent_media: sentMedia };
              run.variables = nextVars;
              await supabaseAdmin2.from("salesbot_runs").update({ variables: nextVars }).eq("id", run.id);
            }
            await log(
              supabaseAdmin2,
              run,
              b,
              "ok",
              `${sentMsgIds.length} mensagem(ns) enviada(s)`,
              { messageIds: sentMsgIds }
            );
          } else if (!texto.trim() && items.length === 0) {
            await log(supabaseAdmin2, run, b, "skipped", "bloco vazio");
          }
          if (useBotoes && botoes.some((x) => !x.url && x.nextBlockId)) {
            const waitBranch = {
              blockId: b.id,
              waitingEvents: [{
                type: "botao-clicado",
                nextBlockId: b.next_block_id,
                options: botoes.map((x) => ({ id: x.id, label: x.label, nextBlockId: x.nextBlockId }))
              }]
            };
            await supabaseAdmin2.from("salesbot_runs").update({
              status: "waiting_message",
              waiting_until: null,
              current_block_id: b.id,
              variables: { ...run.variables, salesbot_waiting_branch: waitBranch }
            }).eq("id", run.id);
            await log(supabaseAdmin2, run, b, "wait", "aguardando o lead escolher um bot\xE3o");
            return;
          }
          break;
        }
        case "reacao": {
          const emoji = String(b.config.texto ?? "").trim();
          if (!emoji) {
            await log(supabaseAdmin2, run, b, "skipped", "emoji n\xE3o definido");
            break;
          }
          const reactionTarget = await resolveRuntimeWhatsappTarget(
            supabaseAdmin2,
            run.workspace_id,
            run.lead_id,
            lead.phone ?? ""
          );
          if (!reactionTarget) {
            await log(supabaseAdmin2, run, b, "error", "Identidade WhatsApp amb\xEDgua para rea\xE7\xE3o.");
            break;
          }
          const r = await sendWhatsappReaction(supabaseAdmin2, run.workspace_id, reactionTarget.phone, emoji);
          if (r.ok) {
            await log(supabaseAdmin2, run, b, "ok", "rea\xE7\xE3o enviada", { messageId: r.messageId, emoji });
          } else {
            await log(supabaseAdmin2, run, b, "error", r.error);
          }
          break;
        }
        case "comentario": {
          const variants = Array.isArray(b.config.comentarios) ? b.config.comentarios.map((x) => String(x).trim()).filter(Boolean) : [String(b.config.texto ?? "").trim()].filter(Boolean);
          const commentId = String(run.variables?.comment_id ?? "").trim();
          const pageId = String(run.variables?.page_id ?? "").trim();
          if (!variants.length) {
            await log(supabaseAdmin2, run, b, "skipped", "nenhum texto de resposta configurado");
            break;
          }
          if (!commentId || !pageId) {
            await log(supabaseAdmin2, run, b, "skipped", "sem comment_id/page_id (fora de gatilho social)");
            break;
          }
          const roundKey = `_rr_comment_${b.id}`;
          const idx = Number(run.variables?.[roundKey] ?? 0) % variants.length;
          const message2 = interpolate(variants[idx], lead, run.variables);
          const encKey = runtimeEnv("INTEGRATION_ENCRYPTION_KEY") ?? "";
          try {
            const { data: tok } = await supabaseAdmin2.rpc("get_meta_page_token", {
              _workspace_id: run.workspace_id,
              _page_id: pageId,
              _key: encKey
            });
            const pageToken = tok;
            if (!pageToken) throw new Error("token da p\xE1gina indispon\xEDvel");
            const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(commentId)}/comments`;
            const r = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ message: message2, access_token: pageToken }).toString()
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.error) throw new Error(j.error?.message ?? `HTTP ${r.status}`);
            await supabaseAdmin2.from("salesbot_runs").update({
              variables: { ...run.variables ?? {}, [roundKey]: idx + 1 }
            }).eq("id", run.id);
            await log(supabaseAdmin2, run, b, "ok", "resposta ao coment\xE1rio enviada", { comment_id: commentId, reply_id: j.id ?? null, variant: idx });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await log(supabaseAdmin2, run, b, "error", `falha ao responder coment\xE1rio: ${msg}`);
          }
          break;
        }
        case "enviar-dm": {
          const texto = interpolate(String(b.config.texto ?? ""), lead, run.variables).trim();
          const commentId = String(run.variables?.comment_id ?? "").trim();
          const pageId = String(run.variables?.page_id ?? "").trim();
          const igUserId = String(run.variables?.ig_user_id ?? "").trim();
          if (!texto) {
            await log(supabaseAdmin2, run, b, "skipped", "texto da DM n\xE3o configurado");
            break;
          }
          if (!commentId || !pageId) {
            await log(supabaseAdmin2, run, b, "skipped", "sem comment_id/page_id (fora de gatilho social)");
            break;
          }
          try {
            const encKey = runtimeEnv("INTEGRATION_ENCRYPTION_KEY") ?? "";
            const { data: tok } = await supabaseAdmin2.rpc("get_meta_page_token", {
              _workspace_id: run.workspace_id,
              _page_id: pageId,
              _key: encKey
            });
            const pageToken = tok;
            if (!pageToken) throw new Error("token da p\xE1gina indispon\xEDvel");
            let url;
            let body;
            let headers;
            if (igUserId) {
              url = `https://graph.facebook.com/v21.0/${encodeURIComponent(igUserId)}/messages`;
              headers = { "Content-Type": "application/json" };
              body = JSON.stringify({
                recipient: { comment_id: commentId },
                message: { text: texto },
                access_token: pageToken
              });
            } else {
              url = `https://graph.facebook.com/v21.0/${encodeURIComponent(commentId)}/private_replies`;
              headers = { "Content-Type": "application/x-www-form-urlencoded" };
              body = new URLSearchParams({ message: texto, access_token: pageToken }).toString();
            }
            const r = await fetch(url, { method: "POST", headers, body });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.error) throw new Error(j.error?.message ?? `HTTP ${r.status}`);
            await log(supabaseAdmin2, run, b, "ok", "DM enviada", { comment_id: commentId, message_id: j.message_id ?? j.id ?? null });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await log(supabaseAdmin2, run, b, "error", `falha ao enviar DM: ${msg}`);
          }
          break;
        }
        case "msg-interna": {
          const texto = interpolate(String(b.config.texto ?? ""), lead, run.variables);
          const corpo = texto || "(mensagem interna)";
          const { error: noteError } = await supabaseAdmin2.from("lead_activities").insert({
            workspace_id: run.workspace_id,
            lead_id: lead.id,
            type: "note",
            payload: { text: corpo, by: null, salesbot_run_id: run.id, internal: true }
          });
          if (noteError) throw new Error(`Nota interna n\xE3o gravada: ${noteError.message}`);
          try {
            const destinoTipo = String(b.config.msgInternaDestinoTipo ?? "usuario");
            const destinoId = b.config.msgInternaDestinoId ? String(b.config.msgInternaDestinoId) : null;
            const rows = [];
            const base = {
              workspace_id: run.workspace_id,
              from_user_id: null,
              body: corpo,
              origin: "salesbot"
            };
            if (destinoTipo === "setor" && destinoId) {
              rows.push({ ...base, sector_id: destinoId, to_user_id: null });
              const { data: membros } = await supabaseAdmin2.from("workflow_sector_members").select("user_id").eq("sector_id", destinoId);
              for (const m of membros ?? []) {
                rows.push({ ...base, sector_id: null, to_user_id: m.user_id });
              }
            } else if (destinoTipo === "admins") {
              const { data: ws } = await supabaseAdmin2.from("workspaces").select("owner_id").eq("id", run.workspace_id).maybeSingle();
              const { data: admins } = await supabaseAdmin2.from("workspace_members").select("user_id, role, role_type").eq("workspace_id", run.workspace_id);
              const ids = /* @__PURE__ */ new Set();
              const ownerId = ws?.owner_id;
              if (ownerId) ids.add(ownerId);
              for (const m of admins ?? []) {
                if (m.role === "admin" || m.role === "owner" || m.role_type === "admin" || m.role_type === "owner") {
                  ids.add(m.user_id);
                }
              }
              for (const id of ids) rows.push({ ...base, sector_id: null, to_user_id: id });
            } else if (destinoId) {
              rows.push({ ...base, sector_id: null, to_user_id: destinoId });
            }
            if (rows.length > 0) {
              const { error: deliveryError } = await supabaseAdmin2.from("team_messages").insert(rows);
              if (deliveryError) throw new Error(deliveryError.message);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await log(supabaseAdmin2, run, b, "error", `alerta interno n\xE3o entregue: ${msg}`);
            break;
          }
          await log(supabaseAdmin2, run, b, "ok");
          break;
        }
        case "pausar": {
          const pausas = Array.isArray(b.config.pausas) ? b.config.pausas : [];
          if (pausas.length > 0) {
            let timerUntil = null;
            let timerAtMs = null;
            let timerNextBlockId = null;
            const waitingEvents = [];
            let resolvedByPausa = false;
            const setTimerCandidate = (date, branchNext) => {
              const at = date.getTime();
              if (timerAtMs === null || at < timerAtMs) {
                timerAtMs = at;
                timerUntil = date.toISOString();
                timerNextBlockId = branchNext ?? null;
              }
            };
            for (const p of pausas) {
              const tipo2 = String(p.tipo ?? "cronometro");
              const branchNext = typeof p.nextBlockId === "string" ? p.nextBlockId : b.next_block_id;
              if (tipo2 === "cronometro") {
                const ms = computePausaCronometroMs(p);
                setTimerCandidate(new Date(Date.now() + Math.max(ms, 1e3)), branchNext);
                continue;
              }
              if (tipo2 === "lote-msgs") {
                const qtd = Math.max(2, Math.min(200, Number(p.qtdMensagens ?? 3) || 3));
                waitingEvents.push({ type: "lote-msgs", nextBlockId: branchNext ?? null, remaining: qtd });
                continue;
              }
              if (tipo2 === "msg-recebida" || tipo2 === "video-aberto" || tipo2 === "video-fechado" || tipo2 === "audio-aberto" || tipo2 === "audio-fechado") {
                const mediaKind = tipo2.startsWith("video") ? "video" : tipo2.startsWith("audio") ? "audio" : null;
                const lastMedia = mediaKind === null ? void 0 : findLatestSentMedia(run.variables.salesbot_last_sent_media, mediaKind);
                if (mediaKind && !lastMedia?.messageId) throw new Error("Envie a m\xEDdia neste fluxo antes de aguardar a confirma\xE7\xE3o do WhatsApp.");
                waitingEvents.push({
                  type: tipo2,
                  nextBlockId: branchNext ?? null,
                  messageId: typeof lastMedia?.messageId === "string" ? lastMedia.messageId : null
                });
                continue;
              }
              if (tipo2 === "exceto-expediente" || tipo2 === "exceto-fora-expediente") {
                const inHours = isBusinessHoursNow(bhCfg);
                const mayRunNow = tipo2 === "exceto-expediente" && !inHours || tipo2 === "exceto-fora-expediente" && inHours;
                if (mayRunNow) {
                  nextId = branchNext;
                  resolvedByPausa = true;
                  await log(supabaseAdmin2, run, b, "ok", `pausa resolveu (${tipo2})`, { branchNextBlockId: branchNext });
                  break;
                }
                setTimerCandidate(
                  tipo2 === "exceto-expediente" ? nextBusinessHoursEnd(bhCfg) : nextBusinessHoursStart(bhCfg),
                  branchNext
                );
                continue;
              }
              if (tipo2 === "ate-expediente") {
                if (isBusinessHoursNow(bhCfg)) {
                  nextId = branchNext;
                  resolvedByPausa = true;
                  await log(supabaseAdmin2, run, b, "ok", "pausa resolveu (j\xE1 est\xE1 no expediente)", { branchNextBlockId: branchNext });
                  break;
                }
                setTimerCandidate(nextBusinessHoursStart(bhCfg), branchNext);
                continue;
              }
              if (tipo2 === "ate-fora-expediente") {
                if (!isBusinessHoursNow(bhCfg)) {
                  nextId = branchNext;
                  resolvedByPausa = true;
                  await log(supabaseAdmin2, run, b, "ok", "pausa resolveu (j\xE1 est\xE1 fora do expediente)", { branchNextBlockId: branchNext });
                  break;
                }
                setTimerCandidate(nextBusinessHoursEnd(bhCfg), branchNext);
                continue;
              }
              if (tipo2 === "formulario-enviado") {
                waitingEvents.push({
                  type: "formulario-enviado",
                  nextBlockId: branchNext ?? null,
                  formularioId: typeof p.formularioId === "string" ? p.formularioId : void 0
                });
                continue;
              }
            }
            if (resolvedByPausa) break;
            const waitBranch = { blockId: b.id, timerNextBlockId, waitingEvents };
            if (waitingEvents.length > 0 && timerUntil) {
              await supabaseAdmin2.from("salesbot_runs").update({ status: "waiting_message", waiting_until: timerUntil, current_block_id: b.id, variables: { ...run.variables, salesbot_waiting_branch: waitBranch } }).eq("id", run.id);
              await log(supabaseAdmin2, run, b, "wait", `aguardando resposta ou cron\xF4metro (${timerUntil})`, waitBranch);
              return;
            }
            if (waitingEvents.length > 0) {
              await supabaseAdmin2.from("salesbot_runs").update({ status: "waiting_message", waiting_until: null, current_block_id: b.id, variables: { ...run.variables, salesbot_waiting_branch: waitBranch } }).eq("id", run.id);
              await log(supabaseAdmin2, run, b, "wait", `aguardando ${waitingEvents.map((event) => event.type).join(" ou ")}`, waitBranch);
              return;
            }
            if (timerUntil) {
              const remaining = (timerAtMs ?? 0) - Date.now();
              if (remaining <= SHORT_PAUSE_MAX_MS) {
                const nextAfterTimer = timerNextBlockId ?? b.next_block_id;
                const waitingVariables = { ...run.variables, salesbot_waiting_branch: waitBranch };
                const resumeVariables = { ...run.variables };
                delete resumeVariables.salesbot_waiting_branch;
                const resumedInline = await waitForDurableSalesbotTimer(supabaseAdmin2, {
                  runId: run.id,
                  workspaceId: run.workspace_id,
                  currentBlockId: b.id,
                  nextBlockId: nextAfterTimer,
                  waitingUntil: timerUntil,
                  waitMs: Math.max(0, remaining),
                  waitingVariables,
                  resumeVariables
                });
                if (!resumedInline) return;
                nextId = nextAfterTimer;
                await log(supabaseAdmin2, run, b, "ok", `pausa curta conclu\xEDda (${Math.round(Math.max(0, remaining) / 1e3)}s)`, waitBranch);
                break;
              }
              await supabaseAdmin2.from("salesbot_runs").update({ status: "waiting_timer", waiting_until: timerUntil, current_block_id: b.id, variables: { ...run.variables, salesbot_waiting_branch: waitBranch } }).eq("id", run.id);
              await log(supabaseAdmin2, run, b, "wait", `aguardando at\xE9 ${timerUntil}`, waitBranch);
              return;
            }
          }
          const tipo = String(b.config.pausaTipo ?? "cronometro");
          if (tipo === "cronometro") {
            const ms = Math.max(computeCronometroMs(b.config), 1e3);
            if (ms <= SHORT_PAUSE_MAX_MS) {
              const until2 = new Date(Date.now() + ms).toISOString();
              const resumedInline = await waitForDurableSalesbotTimer(supabaseAdmin2, {
                runId: run.id,
                workspaceId: run.workspace_id,
                currentBlockId: b.id,
                nextBlockId: b.next_block_id,
                waitingUntil: until2,
                waitMs: ms,
                waitingVariables: { ...run.variables },
                resumeVariables: { ...run.variables }
              });
              if (!resumedInline) return;
              await log(supabaseAdmin2, run, b, "ok", `pausa curta conclu\xEDda (${Math.round(ms / 1e3)}s)`);
              break;
            }
            const until = new Date(Date.now() + ms).toISOString();
            await supabaseAdmin2.from("salesbot_runs").update({ status: "waiting_timer", waiting_until: until, current_block_id: b.id }).eq("id", run.id);
            await log(supabaseAdmin2, run, b, "wait", `aguardando at\xE9 ${until}`);
            return;
          }
          if (tipo === "lote-msgs") {
            const qtd = Math.max(2, Math.min(200, Number(b.config.pausaQtdMensagens ?? 3) || 3));
            const waitBranch = {
              blockId: b.id,
              waitingEvents: [{ type: "lote-msgs", nextBlockId: b.next_block_id, remaining: qtd }]
            };
            await supabaseAdmin2.from("salesbot_runs").update({ status: "waiting_message", waiting_until: null, current_block_id: b.id, variables: { ...run.variables, salesbot_waiting_branch: waitBranch } }).eq("id", run.id);
            await log(supabaseAdmin2, run, b, "wait", `aguardando lote de ${qtd} mensagens do grupo`);
            return;
          }
          if (tipo === "msg-recebida") {
            const waitBranch = {
              blockId: b.id,
              waitingEvents: [{ type: "msg-recebida", nextBlockId: b.next_block_id }]
            };
            await supabaseAdmin2.from("salesbot_runs").update({ status: "waiting_message", waiting_until: null, current_block_id: b.id, variables: { ...run.variables, salesbot_waiting_branch: waitBranch } }).eq("id", run.id);
            await log(supabaseAdmin2, run, b, "wait", "aguardando resposta do lead");
            return;
          }
          if (tipo === "exceto-expediente" || tipo === "exceto-fora-expediente") {
            const inHours = isBusinessHoursNow(bhCfg);
            const mayRunNow = tipo === "exceto-expediente" && !inHours || tipo === "exceto-fora-expediente" && inHours;
            if (mayRunNow) {
              await log(supabaseAdmin2, run, b, "ok", `fora da exce\xE7\xE3o (${tipo})`);
              break;
            }
            const until = (tipo === "exceto-expediente" ? nextBusinessHoursEnd(bhCfg) : nextBusinessHoursStart(bhCfg)).toISOString();
            await supabaseAdmin2.from("salesbot_runs").update({ status: "waiting_timer", waiting_until: until, current_block_id: b.id }).eq("id", run.id);
            await log(supabaseAdmin2, run, b, "wait", `aguardando fim da exce\xE7\xE3o (${until})`);
            return;
          }
          if (tipo === "ate-expediente") {
            if (isBusinessHoursNow(bhCfg)) {
              await log(supabaseAdmin2, run, b, "ok", "j\xE1 est\xE1 no expediente");
              break;
            }
            const until = nextBusinessHoursStart(bhCfg).toISOString();
            await supabaseAdmin2.from("salesbot_runs").update({ status: "waiting_timer", waiting_until: until, current_block_id: b.id }).eq("id", run.id);
            await log(supabaseAdmin2, run, b, "wait", `aguardando in\xEDcio do expediente (${until})`);
            return;
          }
          if (tipo === "formulario-enviado") {
            const waitBranch = {
              blockId: b.id,
              waitingEvents: [{
                type: "formulario-enviado",
                nextBlockId: b.next_block_id,
                formularioId: typeof b.config.pausaFormularioId === "string" ? b.config.pausaFormularioId : void 0
              }]
            };
            await supabaseAdmin2.from("salesbot_runs").update({ status: "waiting_message", waiting_until: null, current_block_id: b.id, variables: { ...run.variables, salesbot_waiting_branch: waitBranch } }).eq("id", run.id);
            await log(supabaseAdmin2, run, b, "wait", `aguardando envio do formul\xE1rio ${b.config.pausaFormularioNome ?? b.config.pausaFormularioId ?? ""}`);
            return;
          }
          if (tipo === "ate-fora-expediente") {
            if (!isBusinessHoursNow(bhCfg)) {
              await log(supabaseAdmin2, run, b, "ok", "j\xE1 est\xE1 fora do expediente");
              break;
            }
            const until = nextBusinessHoursEnd(bhCfg).toISOString();
            await supabaseAdmin2.from("salesbot_runs").update({ status: "waiting_timer", waiting_until: until, current_block_id: b.id }).eq("id", run.id);
            await log(supabaseAdmin2, run, b, "wait", `aguardando fim do expediente (${until})`);
            return;
          }
          if (tipo === "video-aberto" || tipo === "video-fechado" || tipo === "audio-aberto" || tipo === "audio-fechado") {
            const mediaKind = tipo.startsWith("video") ? "video" : "audio";
            const lastMedia = findLatestSentMedia(run.variables.salesbot_last_sent_media, mediaKind);
            if (!lastMedia?.messageId) throw new Error("Envie a m\xEDdia neste fluxo antes de aguardar a confirma\xE7\xE3o do WhatsApp.");
            const waitBranch = {
              blockId: b.id,
              waitingEvents: [{
                type: tipo,
                nextBlockId: b.next_block_id,
                messageId: typeof lastMedia?.messageId === "string" ? lastMedia.messageId : null
              }]
            };
            await supabaseAdmin2.from("salesbot_runs").update({ status: "waiting_message", waiting_until: null, current_block_id: b.id, variables: { ...run.variables, salesbot_waiting_branch: waitBranch } }).eq("id", run.id);
            await log(supabaseAdmin2, run, b, "wait", `aguardando evento de m\xEDdia (${tipo})`, waitBranch);
            return;
          }
          await log(supabaseAdmin2, run, b, "skipped", `pausa "${tipo}" ainda n\xE3o implementada`);
          break;
        }
        case "condicao": {
          const conds = Array.isArray(b.config.condicoes) ? b.config.condicoes : [];
          const modoOu = String(b.config.condicaoModo ?? "e") === "ou";
          const falseNext = b.config.falseNextBlockId ?? null;
          if (modoOu) {
            let matched = null;
            for (const c of conds) {
              const single = { ...b, config: { ...b.config, condicoes: [c], condicaoModo: "e" } };
              if (await evalCondition(supabaseAdmin2, run, lead, single)) {
                matched = c;
                break;
              }
            }
            if (matched) {
              nextId = matched.nextBlockId ?? nextId ?? null;
              await log(supabaseAdmin2, run, b, "ok", "condi\xE7\xE3o bateu", { branch: String(matched.id ?? "") });
            } else {
              nextId = falseNext;
              await log(supabaseAdmin2, run, b, "ok", "nenhuma condi\xE7\xE3o bateu", { branch: "false" });
            }
            break;
          }
          const passed = await evalCondition(supabaseAdmin2, run, lead, b);
          if (!passed) {
            nextId = falseNext;
            await log(supabaseAdmin2, run, b, "ok", "condi\xE7\xE3o falhou", { branch: "false" });
          } else {
            await log(supabaseAdmin2, run, b, "ok", "condi\xE7\xE3o bateu", { branch: "true" });
          }
          break;
        }
        case "validacao": {
          const regras = Array.isArray(b.config.roleta) ? b.config.roleta : [];
          if (regras.length > 0) {
            let matched = null;
            for (const r of regras) {
              if (await evalValidacaoRegra(supabaseAdmin2, run, lead, r)) {
                matched = r;
                break;
              }
            }
            if (matched) {
              nextId = matched.nextBlockId ?? null;
              await log(supabaseAdmin2, run, b, "ok", `valida\xE7\xE3o bateu em "${matched.label ?? matched.id}"`, { matchedRuleId: matched.id });
            } else {
              await log(supabaseAdmin2, run, b, "ok", "nenhuma regra bateu, sa\xEDda 'sen\xE3o'");
            }
          } else {
            const passed = await runValidation(supabaseAdmin2, run, lead, b);
            if (!passed) {
              const falseNext = b.config.falseNextBlockId ?? null;
              nextId = falseNext;
              await log(supabaseAdmin2, run, b, "ok", "valida\xE7\xE3o falhou (legado)", { branch: "false" });
            } else {
              await log(supabaseAdmin2, run, b, "ok", "valida\xE7\xE3o ok (legado)", { branch: "true" });
            }
          }
          break;
        }
        case "ir-etapa": {
          if (b.next_block_id) {
            await log(supabaseAdmin2, run, b, "ok", `\u2192 salto para bloco ${b.next_block_id}`);
          } else {
            await log(supabaseAdmin2, run, b, "skipped", "sem bloco de destino");
          }
          break;
        }
        case "iniciar-salesbot": {
          const rawDestId = String(b.config.destinoBotId ?? "");
          if (!rawDestId) {
            await log(supabaseAdmin2, run, b, "skipped", "destinoBotId vazio");
            break;
          }
          const destBotId = await resolveSalesbotId(supabaseAdmin2, run.workspace_id, rawDestId);
          if (!destBotId) {
            await log(supabaseAdmin2, run, b, "error", "salesbot de destino n\xE3o encontrado neste workspace");
            break;
          }
          if (destBotId === run.salesbot_id) {
            await log(supabaseAdmin2, run, b, "skipped", "loop: n\xE3o inicia o pr\xF3prio bot");
            break;
          }
          const currentExec = run.variables._execution;
          let nextExec;
          try {
            if (currentExec) {
              nextExec = createChildContext(currentExec, run.id, "salesbot", run.salesbot_id);
            } else {
              const root = createRootContext(run.id, "salesbot", run.salesbot_id);
              nextExec = createChildContext(root, run.id, "salesbot", run.salesbot_id);
            }
          } catch (e) {
            await log(supabaseAdmin2, run, b, "error", `Bloqueado: ${e.message}`);
            break;
          }
          try {
            await startSalesbotRun(supabaseAdmin2, {
              workspaceId: run.workspace_id,
              salesbotId: destBotId,
              leadId: lead.id,
              initialVariables: {
                ...inheritedRunVariables(run.variables),
                started_by_bot: run.salesbot_id,
                _execution: nextExec
              }
            });
            await log(supabaseAdmin2, run, b, "ok", `iniciou bot ${destBotId}`);
          } catch (e) {
            await log(supabaseAdmin2, run, b, "error", e.message);
          }
          break;
        }
        case "encerrar-bot": {
          const encerrarAcoes = Array.isArray(b.config.encerrarAcoes) ? b.config.encerrarAcoes : [];
          let handoffAgentId = "";
          for (const acao of encerrarAcoes) {
            try {
              if (acao.tipo === "status-conversa") {
                const st = String(acao.status ?? "").toLowerCase();
                if (!["aberta", "lida", "fechada"].includes(st)) {
                  await log(supabaseAdmin2, run, b, "skipped", "status da conversa inv\xE1lido");
                  continue;
                }
                const { error } = await supabaseAdmin2.from("leads").update({ conversation_status: st, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", run.lead_id).eq("workspace_id", run.workspace_id);
                await log(
                  supabaseAdmin2,
                  run,
                  b,
                  error ? "error" : "ok",
                  error ? error.message : `status da conversa: ${st}`
                );
              } else if (acao.tipo === "iniciar-salesbot") {
                const destId = await resolveSalesbotId(
                  supabaseAdmin2,
                  run.workspace_id,
                  String(acao.botId ?? "")
                );
                if (!destId || destId === run.salesbot_id) {
                  await log(supabaseAdmin2, run, b, "skipped", "salesbot de destino inv\xE1lido");
                  continue;
                }
                const currentExec = run.variables._execution;
                let nextExec;
                try {
                  if (currentExec) {
                    nextExec = createChildContext(currentExec, run.id, "salesbot", run.salesbot_id);
                  } else {
                    const root = createRootContext(run.id, "salesbot", run.salesbot_id);
                    nextExec = createChildContext(root, run.id, "salesbot", run.salesbot_id);
                  }
                } catch (e) {
                  await log(supabaseAdmin2, run, b, "error", `Bloqueado: ${e.message}`);
                  continue;
                }
                await startSalesbotRun(supabaseAdmin2, {
                  workspaceId: run.workspace_id,
                  salesbotId: destId,
                  leadId: lead.id,
                  initialVariables: {
                    ...inheritedRunVariables(run.variables),
                    started_by_bot: run.salesbot_id,
                    _execution: nextExec
                  }
                });
                await log(supabaseAdmin2, run, b, "ok", `iniciou bot ${acao.botNome ?? destId}`);
              } else if (acao.tipo === "iniciar-ia") {
                const agId = String(acao.agentId ?? "");
                if (!agId) {
                  await log(supabaseAdmin2, run, b, "skipped", "agente IA n\xE3o configurado");
                  continue;
                }
                await assignConversationAgent(supabaseAdmin2, run.workspace_id, run.lead_id, agId);
                handoffAgentId = agId;
                await log(supabaseAdmin2, run, b, "ok", `Agente IA "${acao.agentNome ?? agId}" assumiu a conversa`);
              }
            } catch (e) {
              await log(supabaseAdmin2, run, b, "error", e.message);
            }
          }
          const iaIdOnEnd = handoffAgentId || (typeof run.variables?.ia_agent_id === "string" ? String(run.variables.ia_agent_id) : "");
          if (iaIdOnEnd) {
            if (iaIdOnEnd !== handoffAgentId) {
              await assignConversationAgent(supabaseAdmin2, run.workspace_id, run.lead_id, iaIdOnEnd);
            }
            const h = await handoffToConversationAgent(supabaseAdmin2, {
              workspaceId: run.workspace_id,
              leadId: run.lead_id,
              phone: lead.phone ?? "",
              agentId: iaIdOnEnd
            });
            await log(
              supabaseAdmin2,
              run,
              b,
              h.error ? "error" : "ok",
              h.error ?? `bot encerrado \u2014 Agente IA segue ativo (${h.reason})`
            );
          } else {
            await log(supabaseAdmin2, run, b, "ok", "bot encerrado");
          }
          await supabaseAdmin2.from("salesbot_runs").update({ status: "finished", finished_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", run.id);
          return;
        }
        case "round-robin": {
          const opts = Array.isArray(b.config.roleta) ? b.config.roleta : [];
          const valid = opts.filter((o) => !!o.nextBlockId);
          if (!valid.length) {
            await log(supabaseAdmin2, run, b, "skipped", "distribui\xE7\xE3o sem destinos conectados");
            break;
          }
          let pickIdx = 0;
          const { data: rr, error: rrErr } = await supabaseAdmin2.rpc("salesbot_rr_next", {
            _block_id: b.id,
            _size: valid.length
          });
          if (rrErr || rr === null || rr === void 0) {
            const fallback = Math.max(0, Number(b.config.rrCounter ?? 0));
            pickIdx = fallback % valid.length;
            await supabaseAdmin2.from("salesbot_blocks").update({
              config: { ...b.config, rrCounter: (fallback + 1) % 1e6 },
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("id", b.id);
          } else {
            pickIdx = Number(rr) % valid.length;
          }
          const chosen = valid[pickIdx];
          nextId = chosen.nextBlockId ?? null;
          await log(supabaseAdmin2, run, b, "ok", `distribui\xE7\xE3o \u2192 ${chosen.label ?? `op\xE7\xE3o ${pickIdx + 1}`}`, { pickIdx, chosenId: chosen.id });
          break;
        }
        case "acao": {
          const res = await runAction(supabaseAdmin2, run, lead, b);
          if (res.ok) {
            await log(supabaseAdmin2, run, b, "ok", res.message);
          } else {
            await log(supabaseAdmin2, run, b, "error", res.message);
          }
          const webhookErrorNext = String(b.config.acaoTipo ?? "") === "webhook" && !res.ok && typeof b.config.webhookErrorNextBlockId === "string" ? b.config.webhookErrorNextBlockId : null;
          nextId = webhookErrorNext || b.next_block_id;
          advance = true;
          break;
        }
        case "iniciar-ia": {
          const agentId = String(b.config.iaAgentId ?? "");
          if (!agentId) {
            await log(supabaseAdmin2, run, b, "skipped", "iniciar-ia sem agente configurado");
            break;
          }
          const maxTurnos = Math.max(0, Number(b.config.iaMaxTurnos ?? 0));
          const mensagemInicial = String(b.config.iaMensagemInicial ?? "").trim();
          const phone = lead.phone ?? "";
          if (mensagemInicial) {
            const t = interpolate(mensagemInicial, lead, run.variables);
            const s = await sendLeadWhatsappText(
              supabaseAdmin2,
              run.workspace_id,
              run.lead_id,
              phone,
              t
            );
            if (!s.ok) await log(supabaseAdmin2, run, b, "error", s.error);
          } else {
            const h = await handoffToConversationAgent(supabaseAdmin2, {
              workspaceId: run.workspace_id,
              leadId: run.lead_id,
              phone,
              agentId
            });
            await log(supabaseAdmin2, run, b, h.error ? "error" : "ok", h.error ?? h.reason);
          }
          const vars = {
            ...run.variables ?? {},
            ia_agent_id: agentId,
            ia_agent_nome: String(b.config.iaAgentNome ?? ""),
            ia_max_turnos: maxTurnos,
            ia_turns_used: 0,
            ia_block_id: b.id
          };
          const nextAfterIa = b.next_block_id ? findBlockById(blocks, b.next_block_id) : null;
          const encerrarTemAcoes = !!nextAfterIa && Array.isArray(nextAfterIa.config?.encerrarAcoes) && (nextAfterIa.config.encerrarAcoes?.length ?? 0) > 0;
          if (nextAfterIa && nextAfterIa.type === "encerrar-bot" && !encerrarTemAcoes) {
            await assignConversationAgent(supabaseAdmin2, run.workspace_id, run.lead_id, agentId);
            await supabaseAdmin2.from("salesbot_runs").update({ status: "finished", variables: vars, current_block_id: null, waiting_until: null, finished_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", run.id);
            await log(supabaseAdmin2, run, b, "ok", `Agente IA "${b.config.iaAgentNome ?? agentId}" assumiu a conversa e o Salesbot foi encerrado`);
            return;
          }
          await supabaseAdmin2.from("salesbot_runs").update({ status: "waiting_message", variables: vars, waiting_until: null }).eq("id", run.id);
          await log(supabaseAdmin2, run, b, "wait", `Agente IA "${b.config.iaAgentNome ?? agentId}" assumiu`);
          return;
        }
        case "enquete": {
          const pergunta = interpolate(String(b.config.enquetePergunta ?? "").trim(), lead, run.variables);
          const opcoesRaw = Array.isArray(b.config.enqueteOpcoes) ? b.config.enqueteOpcoes : [];
          const opcoes = opcoesRaw.map((o) => interpolate(String(o ?? "").trim(), lead, run.variables)).filter(Boolean);
          if (!pergunta || opcoes.length < 2) {
            await log(supabaseAdmin2, run, b, "skipped", "enquete precisa de pergunta e ao menos 2 op\xE7\xF5es");
            break;
          }
          const groupJid = getSalesbotGroupJid(lead.phone, run.variables);
          if (!groupJid) {
            await log(supabaseAdmin2, run, b, "error", "bloco enquete s\xF3 funciona em bots de grupo (JID real do grupo ausente)");
            break;
          }
          try {
            const encKey = runtimeEnv("INTEGRATION_ENCRYPTION_KEY");
            const base = (runtimeEnv("EVOLUTION_URL") ?? "").replace(/\/+$/, "");
            if (!encKey || !base) throw new Error("Ambiente Evolution n\xE3o configurado");
            const groupRoute = await resolveRuntimeWhatsappTarget(
              supabaseAdmin2,
              run.workspace_id,
              run.lead_id,
              groupJid
            );
            if (!groupRoute || groupRoute.remoteJid !== groupJid || !groupRoute.remoteJid.endsWith("@g.us")) {
              throw new Error("Sess\xE3o/JID real do grupo n\xE3o p\xF4de ser resolvido");
            }
            const sid = groupRoute.sessionId;
            const { data: creds } = await supabaseAdmin2.rpc("get_evolution_credentials_service", { _session_id: sid, _key: encKey });
            const c = creds;
            if (!c?.instance_name || !c.api_key) throw new Error("Credenciais Evolution indispon\xEDveis");
            const g = await Promise.resolve().then(() => (init_evolution_groups_server(), evolution_groups_server_exports));
            const selectable = b.config.enqueteMultipla ? opcoes.length : 1;
            const r = await g.sendGroupPoll(
              { baseUrl: base, apiKey: c.api_key, instance: c.instance_name },
              { groupJid, name: pergunta, options: opcoes, selectableCount: selectable }
            );
            if (r.ok) {
              await log(supabaseAdmin2, run, b, "ok", "enquete enviada", { groupJid, opcoes: opcoes.length });
            } else {
              await log(supabaseAdmin2, run, b, "error", r.error ?? "falha ao enviar enquete");
            }
          } catch (e) {
            await log(supabaseAdmin2, run, b, "error", e.message);
          }
          break;
        }
        default:
          await log(supabaseAdmin2, run, b, "skipped", `bloco "${b.type}" ainda n\xE3o implementado`);
      }
    } catch (e) {
      await log(supabaseAdmin2, run, b, "error", e.message);
      await supabaseAdmin2.from("salesbot_runs").update({ status: "error", last_error: e.message, finished_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", run.id);
      return;
    }
    if (!advance) break;
    current = nextId ? findBlockById(blocks, nextId) : null;
  }
  if (!current) {
    await supabaseAdmin2.from("salesbot_runs").update({ status: "finished", finished_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", run.id);
  }
}
function computeDelaySecondsFromGatilho(g) {
  const d = Math.max(0, Math.floor(Number(g.atrasoDias ?? 0)));
  const h = Math.max(0, Math.floor(Number(g.atrasoHoras ?? 0)));
  const m = Math.max(0, Math.floor(Number(g.atrasoMin ?? 0)));
  const s = Math.max(0, Math.floor(Number(g.atrasoSeg ?? 0)));
  return d * 86400 + h * 3600 + m * 60 + s;
}
function scopeMatchesLead(g, lead) {
  const isGlobalTrigger = !g.stageId && !g.pipelineId;
  const isCrmStatusTrigger = g.kind === "crm-lead-ganho" || g.kind === "crm-lead-perdido";
  if (isGlobalTrigger && !isCrmStatusTrigger) {
    if (lead.status && lead.status !== "active") return false;
  }
  if (g.stageId && g.stageId !== lead.stage_id) return false;
  if (g.pipelineId && g.pipelineId !== lead.pipeline_id) return false;
  return true;
}
async function startSalesbotRun(supabaseAdmin2, params) {
  const singleEntryRunId = await findPriorSingleEntrySalesbotRunId(supabaseAdmin2, {
    workspaceId: params.workspaceId,
    salesbotId: params.salesbotId,
    leadId: params.leadId,
    trigger: typeof params.initialVariables?.trigger === "string" ? params.initialVariables.trigger : null
  });
  if (singleEntryRunId) return singleEntryRunId;
  const existingRunId = await findActiveSalesbotRunId(supabaseAdmin2, {
    workspaceId: params.workspaceId,
    salesbotId: params.salesbotId,
    leadId: params.leadId
  });
  if (existingRunId) return existingRunId;
  const initialVars = { ...params.initialVariables ?? {} };
  const delay = Math.max(0, Math.floor(params.delaySeconds ?? 0));
  let runId;
  if (!initialVars._execution) {
    runId = crypto.randomUUID();
    initialVars._execution = createRootContext(runId, "salesbot", params.salesbotId);
  } else {
    runId = crypto.randomUUID();
  }
  if (delay > 0) {
    const until = new Date(Date.now() + delay * 1e3).toISOString();
    const { data: created2, error: error2 } = await supabaseAdmin2.from("salesbot_runs").insert({
      id: runId,
      workspace_id: params.workspaceId,
      salesbot_id: params.salesbotId,
      lead_id: params.leadId,
      status: "waiting_timer",
      waiting_until: until,
      current_block_id: null,
      variables: initialVars
    }).select("id").single();
    if (error2) return null;
    return created2.id;
  }
  const { data: created, error } = await supabaseAdmin2.from("salesbot_runs").insert({
    id: runId,
    workspace_id: params.workspaceId,
    salesbot_id: params.salesbotId,
    lead_id: params.leadId,
    status: "running",
    variables: initialVars
  }).select("id, workspace_id, salesbot_id, lead_id, status, variables").single();
  if (error) {
    return null;
  }
  const actualRun = created;
  try {
    await executeRun(supabaseAdmin2, actualRun);
  } catch (e) {
    await supabaseAdmin2.from("salesbot_run_logs").update({ status: "error", last_error: e.message, finished_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", actualRun.id);
  }
  return actualRun.id;
}
async function resumeRunsOnFormSubmission(supabaseAdmin2, params) {
  const { data: runs } = await supabaseAdmin2.from("salesbot_runs").select("id, variables").eq("workspace_id", params.workspaceId).eq("lead_id", params.leadId).eq("status", "waiting_message");
  const list = runs ?? [];
  for (const r of list) {
    const waitingBranch = r.variables?.salesbot_waiting_branch ?? {};
    const waitingEvents = Array.isArray(waitingBranch.waitingEvents) ? waitingBranch.waitingEvents : [];
    const matched = waitingEvents.find(
      (event) => event.type === "formulario-enviado" && (!event.formularioId || event.formularioId === params.formId)
    );
    if (!matched) continue;
    const vars = { ...r.variables ?? {}, last_form_id: params.formId };
    delete vars.salesbot_waiting_branch;
    const { data: cur } = await supabaseAdmin2.from("salesbot_runs").select("current_block_id").eq("id", r.id).maybeSingle();
    const c = cur;
    const nextId = matched.nextBlockId ?? (c?.current_block_id ? await (async () => {
      const { data: block } = await supabaseAdmin2.from("salesbot_blocks").select("next_block_id").eq("id", c.current_block_id).maybeSingle();
      return block?.next_block_id ?? null;
    })() : null);
    if (!nextId) {
      await supabaseAdmin2.from("salesbot_runs").update({ status: "finished", variables: vars, current_block_id: null, finished_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", r.id).eq("status", "waiting_message");
      continue;
    }
    const { data: claimed } = await supabaseAdmin2.from("salesbot_runs").update({ status: "running", waiting_until: null, variables: vars, current_block_id: nextId }).eq("id", r.id).eq("status", "waiting_message").select("id");
    if (claimed && claimed.length > 0) {
      try {
        const { data: runRow } = await supabaseAdmin2.from("salesbot_runs").select("*").eq("id", r.id).single();
        if (runRow) await executeRun(supabaseAdmin2, runRow);
      } catch {
      }
    }
  }
}
async function resumeRunsOnInboundMessage(supabaseAdmin2, params) {
  const { data: runs } = await supabaseAdmin2.from("salesbot_runs").select("id, variables").eq("workspace_id", params.workspaceId).eq("lead_id", params.leadId).eq("status", "waiting_message");
  const list = runs ?? [];
  for (const r of list) {
    if (params.resumableRunIds && !params.resumableRunIds.includes(r.id)) continue;
    if (params.messageId && r.variables?.salesbot_last_inbound_message_id === params.messageId) continue;
    if (params.messageId) r.variables = { ...r.variables, salesbot_last_inbound_message_id: params.messageId };
    if (params.senderPhone) {
      r.variables = {
        ...r.variables ?? {},
        participante_telefone: String(params.senderPhone).replace(/\D/g, ""),
        participante_nome: params.senderName ?? ""
      };
    }
    const configuredEvents = Array.isArray(r.variables?.salesbot_waiting_branch) ? [] : r.variables?.salesbot_waiting_branch?.waitingEvents;
    if (Array.isArray(configuredEvents)) {
      const acceptsInbound = configuredEvents.some(
        (event) => event && typeof event === "object" && (event.type === "msg-recebida" || event.type === "lote-msgs")
      );
      if (!acceptsInbound) continue;
    }
    const vars0 = r.variables ?? {};
    const iaAgentId = typeof vars0.ia_agent_id === "string" ? vars0.ia_agent_id : "";
    if (iaAgentId) {
      const claimedIa = await claimSalesbotAiTurn(supabaseAdmin2, {
        runId: r.id,
        workspaceId: params.workspaceId
      });
      if (!claimedIa) continue;
      const { data: leadRow } = await supabaseAdmin2.from("leads").select("phone").eq("id", params.leadId).maybeSingle();
      const phone = leadRow?.phone ?? "";
      const maxTurnos = Number(vars0.ia_max_turnos ?? 0);
      const usedNow = Number(vars0.ia_turns_used ?? 0) + 1;
      const turn = await runAiAgentTurn(supabaseAdmin2, params.workspaceId, params.leadId, phone, iaAgentId, params.text);
      const shouldHandoff = turn.handoff || maxTurnos > 0 && usedNow >= maxTurnos;
      if (shouldHandoff) {
        const { data: cur2 } = await supabaseAdmin2.from("salesbot_runs").select("current_block_id").eq("id", r.id).maybeSingle();
        const curBlockId = cur2?.current_block_id ?? null;
        let nextIdIa = null;
        if (curBlockId) {
          const { data: block } = await supabaseAdmin2.from("salesbot_blocks").select("next_block_id").eq("id", curBlockId).maybeSingle();
          nextIdIa = block?.next_block_id ?? null;
        }
        const cleaned = { ...vars0, last_message: params.text };
        delete cleaned.ia_agent_id;
        delete cleaned.ia_agent_nome;
        delete cleaned.ia_max_turnos;
        delete cleaned.ia_turns_used;
        delete cleaned.ia_block_id;
        if (!nextIdIa) {
          await supabaseAdmin2.from("salesbot_runs").update({ status: "finished", variables: cleaned, current_block_id: null, finished_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", r.id).eq("status", "running");
        } else {
          const { data: advanced } = await supabaseAdmin2.from("salesbot_runs").update({ variables: cleaned, current_block_id: nextIdIa, waiting_until: null }).eq("id", r.id).eq("status", "running").select("id");
          if (advanced && advanced.length > 0) {
            try {
              const { data: runRow } = await supabaseAdmin2.from("salesbot_runs").select("*").eq("id", r.id).single();
              if (runRow) await executeRun(supabaseAdmin2, runRow);
            } catch {
            }
          }
        }
      } else {
        const kept = { ...vars0, last_message: params.text, ia_turns_used: usedNow };
        await supabaseAdmin2.from("salesbot_runs").update({ variables: kept, status: "waiting_message" }).eq("id", r.id).eq("status", "running");
      }
      continue;
    }
    const waitingBranch = r.variables?.salesbot_waiting_branch ?? {};
    const vars = { ...r.variables ?? {}, last_message: params.text };
    delete vars.salesbot_waiting_branch;
    const { data: cur } = await supabaseAdmin2.from("salesbot_runs").select("current_block_id, salesbot_id").eq("id", r.id).maybeSingle();
    const c = cur;
    const waitingEvents = Array.isArray(waitingBranch.waitingEvents) ? waitingBranch.waitingEvents : [];
    const batchEvent = waitingEvents.find((event) => event.type === "lote-msgs");
    if (batchEvent) {
      let nextIdLote = batchEvent.nextBlockId ?? null;
      if (!nextIdLote && c?.current_block_id) {
        const { data: block } = await supabaseAdmin2.from("salesbot_blocks").select("next_block_id").eq("id", c.current_block_id).maybeSingle();
        nextIdLote = block?.next_block_id ?? null;
      }
      const { data: rpcRes, error: rpcErr } = await supabaseAdmin2.rpc("salesbot_batch_decrement", {
        p_run_id: r.id,
        p_text: params.text,
        p_sender_phone: params.senderPhone ?? null,
        p_sender_name: params.senderName ?? null,
        p_next_block_id: nextIdLote,
        p_message_id: params.messageId ?? null
      });
      if (rpcErr) {
        continue;
      }
      if (rpcRes?.success && rpcRes?.completed) {
        try {
          const { data: runRow } = await supabaseAdmin2.from("salesbot_runs").select("*").eq("id", r.id).single();
          if (runRow) await executeRun(supabaseAdmin2, runRow);
        } catch {
        }
      }
      continue;
    }
    const buttonEvent = waitingEvents.find((event) => event.type === "botao-clicado");
    if (buttonEvent) {
      const answer = normalizeButtonText(params.text ?? "");
      const options = Array.isArray(buttonEvent.options) ? buttonEvent.options : [];
      const chosen = options.find((o) => {
        const label = normalizeButtonText(o.label ?? "");
        return label.length > 0 && (answer === label || answer.includes(label));
      });
      vars.salesbot_botao_clicado = chosen?.label ?? params.text ?? "";
      let btnNext = chosen?.nextBlockId ?? buttonEvent.nextBlockId ?? null;
      if (!btnNext && c?.current_block_id) {
        const { data: block } = await supabaseAdmin2.from("salesbot_blocks").select("next_block_id").eq("id", c.current_block_id).maybeSingle();
        btnNext = block?.next_block_id ?? null;
      }
      if (!btnNext) {
        await supabaseAdmin2.from("salesbot_runs").update({ status: "finished", variables: vars, current_block_id: null, finished_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", r.id).eq("status", "waiting_message");
        continue;
      }
      const { data: claimed2 } = await supabaseAdmin2.from("salesbot_runs").update({ status: "running", waiting_until: null, variables: vars, current_block_id: btnNext }).eq("id", r.id).eq("status", "waiting_message").select("id");
      if (claimed2 && claimed2.length > 0) {
        try {
          const { data: runRow } = await supabaseAdmin2.from("salesbot_runs").select("*").eq("id", r.id).single();
          if (runRow) await executeRun(supabaseAdmin2, runRow);
        } catch {
        }
      }
      continue;
    }
    const inboundEvent = waitingEvents.find(
      (event) => event.type === "msg-recebida" || event.type === "lote-msgs"
    );
    let nextId = typeof inboundEvent?.nextBlockId === "string" ? inboundEvent.nextBlockId : typeof waitingBranch.messageNextBlockId === "string" ? waitingBranch.messageNextBlockId : null;
    if (c?.current_block_id) {
      const { data: block } = await supabaseAdmin2.from("salesbot_blocks").select("next_block_id").eq("id", c.current_block_id).maybeSingle();
      nextId = nextId ?? (block?.next_block_id ?? null);
    }
    if (c?.current_block_id && !nextId) {
      await supabaseAdmin2.from("salesbot_runs").update({ status: "finished", variables: vars, current_block_id: null, finished_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", r.id).eq("status", "waiting_message");
      continue;
    }
    const { data: claimed } = await supabaseAdmin2.from("salesbot_runs").update({ status: "running", waiting_until: null, variables: vars, current_block_id: nextId }).eq("id", r.id).eq("status", "waiting_message").select("id");
    if (claimed && claimed.length > 0) {
      try {
        const { data: runRow } = await supabaseAdmin2.from("salesbot_runs").select("*").eq("id", r.id).single();
        if (runRow) await executeRun(supabaseAdmin2, runRow);
      } catch {
      }
    }
  }
}
async function resumeRunsOnMediaEvent(supabaseAdmin2, params) {
  const status = params.status.toLowerCase();
  const acceptedTypes = /* @__PURE__ */ new Set();
  if (status === "read") {
    acceptedTypes.add("video-aberto");
    acceptedTypes.add("audio-aberto");
  } else if (status === "played") {
    acceptedTypes.add("audio-fechado");
  }
  if (acceptedTypes.size === 0) return;
  const { data: runs } = await supabaseAdmin2.from("salesbot_runs").select("id, current_block_id, variables").eq("workspace_id", params.workspaceId).eq("lead_id", params.leadId).eq("status", "waiting_message");
  const list = runs ?? [];
  for (const run of list) {
    const waitingBranch = run.variables?.salesbot_waiting_branch ?? {};
    const waitingEvents = Array.isArray(waitingBranch.waitingEvents) ? waitingBranch.waitingEvents : [];
    const matched = waitingEvents.find(
      (event) => acceptedTypes.has(event.type) && typeof event.messageId === "string" && !!event.messageId && event.messageId === params.messageId
    );
    if (!matched) continue;
    const variables = { ...run.variables ?? {} };
    delete variables.salesbot_waiting_branch;
    let nextId = matched.nextBlockId;
    if (!nextId && run.current_block_id) {
      const { data: block } = await supabaseAdmin2.from("salesbot_blocks").select("next_block_id").eq("id", run.current_block_id).maybeSingle();
      nextId = block?.next_block_id ?? null;
    }
    if (!nextId) {
      await supabaseAdmin2.from("salesbot_runs").update({
        status: "finished",
        waiting_until: null,
        variables,
        current_block_id: null,
        finished_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", run.id).eq("status", "waiting_message");
      continue;
    }
    const { data: claimed } = await supabaseAdmin2.from("salesbot_runs").update({
      status: "running",
      waiting_until: null,
      variables,
      current_block_id: nextId
    }).eq("id", run.id).eq("status", "waiting_message").select("id");
    if (claimed && claimed.length > 0) {
      try {
        await executeRun(supabaseAdmin2, run.id);
      } catch {
      }
    }
  }
}
async function tickWaitingTimers(supabaseAdmin2) {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const { data: claimed, error: claimErr } = await supabaseAdmin2.from("salesbot_runs").update({ status: "running", updated_at: nowIso }).in("status", ["waiting_timer", "waiting_message"]).lte("waiting_until", nowIso).select("id, workspace_id, salesbot_id, lead_id, current_block_id, variables").limit(100);
  if (claimErr) {
    return { processed: 0 };
  }
  const list = claimed ?? [];
  for (const r of list) {
    try {
      const waitingBranch = r.variables?.salesbot_waiting_branch ?? {};
      const vars = { ...r.variables ?? {} };
      delete vars.salesbot_waiting_branch;
      let nextId = typeof waitingBranch.timerNextBlockId === "string" ? waitingBranch.timerNextBlockId : null;
      if (r.current_block_id) {
        const { data: block } = await supabaseAdmin2.from("salesbot_blocks").select("next_block_id").eq("id", r.current_block_id).maybeSingle();
        nextId = nextId ?? (block?.next_block_id ?? null);
      }
      await supabaseAdmin2.from("salesbot_runs").update({ waiting_until: null, variables: vars, current_block_id: nextId }).eq("id", r.id);
      await executeRun(supabaseAdmin2, r.id);
    } catch (e) {
      await supabaseAdmin2.from("salesbot_runs").update({
        status: "error",
        last_error: e instanceof Error ? e.message : String(e),
        finished_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", r.id);
    }
  }
  return { processed: list.length };
}
function collectInactivityFallbacks(tree) {
  const out = [];
  const walk = (n) => {
    if (!n) return;
    (n.fallbacks ?? []).forEach((f) => {
      if (f?.kind === "inatividade") out.push(f);
    });
    (n.children ?? []).forEach(walk);
  };
  walk(tree?.root);
  return out;
}
function collectTrackingNodes(tree) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (node.block === "tracking" && node.id && node.tracking?.siteId && node.tracking.event) {
      out.push(node);
    }
    (node.children ?? []).forEach(walk);
  };
  walk(tree?.root);
  return out;
}
async function tickAiAgentTracking(supabaseAdmin2) {
  const { data: leadsData } = await supabaseAdmin2.from("leads").select("id,workspace_id,phone,custom_data,active_conversation_agent_id").not("active_conversation_agent_id", "is", null).eq("ai_paused", false).limit(200);
  const leads = leadsData ?? [];
  const agentCache = /* @__PURE__ */ new Map();
  let processed = 0;
  for (const lead of leads) {
    const cacheKey = `${lead.workspace_id}:${lead.active_conversation_agent_id}`;
    if (!agentCache.has(cacheKey)) {
      const agent = await loadConversationAgent(supabaseAdmin2, lead.workspace_id, lead.active_conversation_agent_id);
      const metadata = agent?.metadata ?? {};
      agentCache.set(cacheKey, metadata.objective_tree ?? null);
    }
    const nodes = collectTrackingNodes(agentCache.get(cacheKey));
    if (!nodes.length) continue;
    const customData = { ...lead.custom_data ?? {} };
    const trackingState = {
      ...customData["_ia_tracking"] ?? {}
    };
    let changed = false;
    for (const node of nodes) {
      const tracking = node.tracking;
      const state = trackingState[node.id] ?? {};
      if (state.eventId) continue;
      const now = /* @__PURE__ */ new Date();
      const startedAt = state.startedAt ?? now.toISOString();
      const everyMinutes = Math.max(1, Number(tracking.everyMinutes) || 5);
      if (state.lastCheckedAt && now.getTime() - new Date(state.lastCheckedAt).getTime() < everyMinutes * 6e4) continue;
      const eventName = tracking.event === "custom" ? tracking.customEvent : tracking.event;
      let query = supabaseAdmin2.from("tracking_events").select("id,event_name,page_url,page_path,created_at").eq("workspace_id", lead.workspace_id).eq("lead_id", lead.id).eq("site_id", tracking.siteId).eq("event_name", eventName).gte("created_at", startedAt).order("created_at", { ascending: false }).limit(1);
      if (tracking.match?.trim()) query = query.or(`page_url.ilike.%${tracking.match.trim()}%,page_path.ilike.%${tracking.match.trim()}%`);
      const { data: eventRows } = await query;
      const event = (eventRows ?? [])[0];
      if (event) {
        trackingState[node.id] = { startedAt, lastCheckedAt: now.toISOString(), eventId: event.id };
        await executeAgentActions(supabaseAdmin2, lead.workspace_id, lead.id, lead.phone ?? "", node.actions);
        if (lead.phone && tracking.onFoundMessage?.trim()) {
          await sendLeadWhatsappText(
            supabaseAdmin2,
            lead.workspace_id,
            lead.id,
            lead.phone,
            tracking.onFoundMessage.trim()
          );
        } else if (lead.phone) {
          await runAiAgentTurn(
            supabaseAdmin2,
            lead.workspace_id,
            lead.id,
            lead.phone,
            lead.active_conversation_agent_id,
            `(sistema) O evento real "${event.event_name}" foi confirmado no site configurado. Continue para o pr\xF3ximo objetivo sem perguntar se o lead concluiu.`
          );
        }
        await supabaseAdmin2.from("lead_activities").insert({
          workspace_id: lead.workspace_id,
          lead_id: lead.id,
          type: "tracking_confirmed",
          payload: { agent_id: lead.active_conversation_agent_id, node_id: node.id, site_id: tracking.siteId, event_id: event.id, event_name: event.event_name }
        });
        processed++;
        changed = true;
        continue;
      }
      const limitMinutes = Math.max(0, Number(tracking.forMinutes) || 0);
      const expired = limitMinutes > 0 && now.getTime() - new Date(startedAt).getTime() >= limitMinutes * 6e4;
      trackingState[node.id] = { startedAt, lastCheckedAt: now.toISOString() };
      if (expired && tracking.onTimeout === "encerrar") {
        await supabaseAdmin2.from("leads").update({ active_conversation_agent_id: null, ai_paused: true }).eq("id", lead.id).eq("workspace_id", lead.workspace_id);
      }
      changed = true;
    }
    if (changed) {
      customData["_ia_tracking"] = trackingState;
      await supabaseAdmin2.from("leads").update({ custom_data: customData, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", lead.id).eq("workspace_id", lead.workspace_id);
    }
  }
  return { processed };
}
async function tickAiAgentInactivity(supabaseAdmin2) {
  const { data: leadsData } = await supabaseAdmin2.from("leads").select("id, workspace_id, phone, custom_data, active_conversation_agent_id").not("active_conversation_agent_id", "is", null).eq("ai_paused", false).limit(200);
  const leads = leadsData ?? [];
  let processed = 0;
  const agentCache = /* @__PURE__ */ new Map();
  for (const lead of leads) {
    if (!lead.phone) continue;
    const cacheKey = `${lead.workspace_id}:${lead.active_conversation_agent_id}`;
    if (!agentCache.has(cacheKey)) {
      const agent = await loadConversationAgent(supabaseAdmin2, lead.workspace_id, lead.active_conversation_agent_id);
      const meta = agent?.metadata ?? {};
      agentCache.set(cacheKey, meta.objective_tree ?? null);
    }
    const tree = agentCache.get(cacheKey) ?? null;
    const fb = collectInactivityFallbacks(tree)[0];
    if (!fb) continue;
    const minutes = Math.max(1, Number(fb.minutes) || 30);
    const maxAttempts = Math.max(1, Number(fb.attempts) || 2);
    const { data: lastMsg } = await supabaseAdmin2.from("lead_activities").select("type, occurred_at").eq("workspace_id", lead.workspace_id).eq("lead_id", lead.id).in("type", ["message_in", "message_out"]).order("occurred_at", { ascending: false }).limit(1);
    const lastActivity = (lastMsg ?? [])[0];
    const last = lastActivity ? { direction: lastActivity.type === "message_in" ? "in" : "out", received_at: lastActivity.occurred_at } : null;
    if (!last) continue;
    const state = (lead.custom_data ?? {})["_ia_followup"];
    const sameAgent = state?.agentId === lead.active_conversation_agent_id;
    const attempts = sameAgent ? Number(state?.attempts) || 0 : 0;
    if (last.direction === "in") {
      if (attempts > 0) {
        const cd2 = { ...lead.custom_data ?? {} };
        delete cd2["_ia_followup"];
        await supabaseAdmin2.from("leads").update({ custom_data: cd2 }).eq("id", lead.id);
      }
      continue;
    }
    const baseIso = sameAgent && state?.lastAt ? state.lastAt : last.received_at;
    const elapsedMin = (Date.now() - new Date(baseIso).getTime()) / 6e4;
    if (elapsedMin < minutes) continue;
    if (attempts < maxAttempts) {
      const msg = fb.message?.trim();
      if (msg) {
        await sendLeadWhatsappText(
          supabaseAdmin2,
          lead.workspace_id,
          lead.id,
          lead.phone,
          msg
        );
      } else await runAiAgentTurn(
        supabaseAdmin2,
        lead.workspace_id,
        lead.id,
        lead.phone,
        lead.active_conversation_agent_id,
        "(sistema) O lead est\xE1 sem responder. Fa\xE7a uma cobran\xE7a curta e educada retomando o objetivo atual."
      );
      await supabaseAdmin2.from("leads").update({
        custom_data: {
          ...lead.custom_data ?? {},
          _ia_followup: {
            agentId: lead.active_conversation_agent_id,
            attempts: attempts + 1,
            lastAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        }
      }).eq("id", lead.id);
      processed++;
      continue;
    }
    const cd = { ...lead.custom_data ?? {} };
    delete cd["_ia_followup"];
    const patch = { custom_data: cd, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    if (fb.goTo === "encerrar") {
      patch["active_conversation_agent_id"] = null;
      patch["ai_paused"] = true;
    }
    await supabaseAdmin2.from("leads").update(patch).eq("id", lead.id);
    await supabaseAdmin2.from("lead_activities").insert({
      workspace_id: lead.workspace_id,
      lead_id: lead.id,
      type: "ai_agent_fallback",
      payload: { kind: "inatividade", minutes, attempts: maxAttempts, goTo: fb.goTo ?? "ficar" }
    }).then(() => void 0, () => void 0);
    processed++;
  }
  return { processed };
}
async function loadActiveBotsWithGatilhos(supabaseAdmin2, workspaceId) {
  const { data: bots } = await supabaseAdmin2.from("salesbots").select("id, trigger, gatilhos").eq("workspace_id", workspaceId).eq("is_active", true);
  return (bots ?? []).map((b) => ({
    id: b.id,
    trigger: b.trigger,
    gatilhos: Array.isArray(b.gatilhos) ? b.gatilhos : []
  }));
}
async function dispatchInboundMessage(supabaseAdmin2, params) {
  await resumeRunsOnInboundMessage(supabaseAdmin2, params);
  const { data: assignedLead } = await supabaseAdmin2.from("leads").select("phone, ai_paused, active_conversation_agent_id").eq("id", params.leadId).eq("workspace_id", params.workspaceId).maybeSingle();
  const assigned = assignedLead;
  if (assigned?.active_conversation_agent_id && !assigned.ai_paused) {
    const activeRuns = await supabaseAdmin2.from("salesbot_runs").select("id,variables").eq("workspace_id", params.workspaceId).eq("lead_id", params.leadId).eq("status", "waiting_message");
    const alreadyHandled = (activeRuns.data ?? []).some(
      (run) => run.variables?.ia_agent_id === assigned.active_conversation_agent_id
    );
    if (!alreadyHandled) {
      const turn = await runAiAgentTurn(
        supabaseAdmin2,
        params.workspaceId,
        params.leadId,
        assigned.phone ?? "",
        assigned.active_conversation_agent_id,
        params.text
      );
      if (turn.handoff) {
        await supabaseAdmin2.from("leads").update({ active_conversation_agent_id: null, ai_paused: true, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", params.leadId).eq("workspace_id", params.workspaceId);
        await supabaseAdmin2.from("lead_activities").insert({
          workspace_id: params.workspaceId,
          lead_id: params.leadId,
          type: "ai_agent_handoff",
          payload: { agent_id: assigned.active_conversation_agent_id },
          occurred_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
    return;
  }
  const bots = await loadActiveBotsWithGatilhos(supabaseAdmin2, params.workspaceId);
  if (!bots.length) return;
  const lead = await loadLead(supabaseAdmin2, params.leadId, params.workspaceId);
  if (!lead) return;
  const canal = (params.canal ?? "whatsapp").toLowerCase();
  const text = params.text ?? "";
  const matchesChannel = (g) => {
    if (g.canal && g.canal !== "qualquer" && g.canal !== canal) return false;
    if (g.canalId && params.canalId && g.canalId !== params.canalId) return false;
    return true;
  };
  const matchesKeyword = (g) => {
    const kw = (g.palavraChave ?? "").trim();
    if (!kw) return false;
    const mode = g.palavraChaveModo ?? "contem";
    const t = text.toLowerCase();
    const k = kw.toLowerCase();
    try {
      switch (mode) {
        case "igual":
          return t.trim() === k;
        case "comeca":
          return t.startsWith(k);
        case "regex":
          return new RegExp(kw, "i").test(text);
        case "contem":
        default:
          return t.includes(k);
      }
    } catch {
      return false;
    }
  };
  const matchesMedia = (g) => {
    if (!params.mediaType) return false;
    const wanted = g.midiaTipo ?? "qualquer";
    return wanted === "qualquer" || wanted === params.mediaType;
  };
  for (const bot of bots) {
    let matched = null;
    if (bot.gatilhos.length > 0) {
      for (const g of bot.gatilhos) {
        if (!scopeMatchesLead(g, lead)) continue;
        if (!matchesChannel(g)) continue;
        if (g.kind === "palavra-chave") {
          if (matchesKeyword(g)) {
            matched = g;
            break;
          }
          continue;
        }
        if (g.kind === "midia-recebida") {
          if (matchesMedia(g)) {
            matched = g;
            break;
          }
          continue;
        }
        if (g.kind === "primeira-mensagem") {
          if (params.isFirstMessage) {
            matched = g;
            break;
          }
          continue;
        }
        if (g.kind === "social-dm-messenger") {
          if (canal === "messenger") {
            matched = g;
            break;
          }
          continue;
        }
        if (g.kind === "social-dm-instagram") {
          if (canal === "instagram") {
            matched = g;
            break;
          }
          continue;
        }
        if (g.kind === "mensagem-recebida") {
          const kw = (g.palavraChave ?? "").trim();
          if (!kw) {
            matched = g;
            break;
          }
          continue;
        }
        if (g.kind === "qualquer-conversa") {
          if (params.isFirstMessage) {
            matched = g;
            break;
          }
          continue;
        }
      }
    } else {
      const t = (bot.trigger ?? "").trim().toLowerCase();
      if (t === "mensagem-recebida" || t === "qualquer-conversa") {
        if (lead.status === "active") {
          matched = { kind: t };
        }
      }
    }
    if (!matched) continue;
    await startSalesbotRun(supabaseAdmin2, {
      workspaceId: params.workspaceId,
      salesbotId: bot.id,
      leadId: params.leadId,
      initialVariables: { last_message: text, trigger: matched.kind, canal },
      delaySeconds: computeDelaySecondsFromGatilho(matched)
    });
  }
}
async function dispatchStageChange(supabaseAdmin2, params) {
  const bots = await loadActiveBotsWithGatilhos(supabaseAdmin2, params.workspaceId);
  if (!bots.length) return;
  let stageName = "";
  try {
    const { data } = await supabaseAdmin2.from("pipeline_stages").select("name").eq("id", params.newStageId).eq("workspace_id", params.workspaceId).maybeSingle();
    stageName = (data?.name ?? "").toLowerCase();
  } catch {
  }
  const isWin = false;
  const isLoss = false;
  for (const bot of bots) {
    for (const g of bot.gatilhos) {
      let shouldFire = false;
      if (g.kind === "movido-etapa") {
        if (g.stageId && g.stageId !== params.newStageId) continue;
        if (g.pipelineId && params.newPipelineId && g.pipelineId !== params.newPipelineId) continue;
        if (!g.stageId) continue;
        shouldFire = true;
      } else if (g.kind === "crm-lead-ganho" && isWin) {
        if (g.pipelineId && params.newPipelineId && g.pipelineId !== params.newPipelineId) continue;
        shouldFire = true;
      } else if (g.kind === "crm-lead-perdido" && isLoss) {
        if (g.pipelineId && params.newPipelineId && g.pipelineId !== params.newPipelineId) continue;
        shouldFire = true;
      }
      if (!shouldFire) continue;
      const runId = await startSalesbotRun(supabaseAdmin2, {
        workspaceId: params.workspaceId,
        salesbotId: bot.id,
        leadId: params.leadId,
        initialVariables: { trigger: g.kind, stage_id: params.newStageId, stage_name: stageName },
        delaySeconds: computeDelaySecondsFromGatilho(g)
      });
      if (!runId) throw new Error(`N\xE3o foi poss\xEDvel iniciar o Salesbot ${bot.id} para a mudan\xE7a de etapa.`);
      break;
    }
  }
}
async function dispatchGroupParticipantEvent(supabaseAdmin2, params) {
  const kind = params.action === "add" ? "grupo-novo-membro" : params.action === "leave" ? "grupo-membro-saiu" : params.action === "remove" ? "grupo-membro-removido" : params.action === "promote" ? "grupo-membro-promovido" : null;
  if (!kind) return;
  const bots = await loadActiveBotsWithGatilhos(supabaseAdmin2, params.workspaceId);
  const matching = bots.filter((bot) => bot.gatilhos.some((g) => g.kind === kind));
  if (matching.length === 0) return;
  if (!params.groupJid.endsWith("@g.us")) return;
  const { data: leadRow } = await supabaseAdmin2.from("leads").select("id").eq("workspace_id", params.workspaceId).eq("phone", params.groupJid).limit(1).maybeSingle();
  const leadId = leadRow?.id ?? null;
  if (!leadId) return;
  for (const bot of matching) {
    const g = bot.gatilhos.find((x) => x.kind === kind);
    await startSalesbotRun(supabaseAdmin2, {
      workspaceId: params.workspaceId,
      salesbotId: bot.id,
      leadId,
      initialVariables: {
        trigger: kind,
        grupo_jid: params.groupJid,
        participante_telefone: params.participantPhone,
        participante_nome: params.participantName ?? ""
      },
      delaySeconds: computeDelaySecondsFromGatilho(g)
    });
  }
}
async function dispatchFormSubmitted(supabaseAdmin2, params) {
  if (!params.leadId) return;
  const bots = await loadActiveBotsWithGatilhos(supabaseAdmin2, params.workspaceId);
  if (!bots.length) return;
  const lead = await loadLead(supabaseAdmin2, params.leadId, params.workspaceId);
  if (!lead) return;
  for (const bot of bots) {
    for (const g of bot.gatilhos) {
      if (g.kind !== "formulario-enviado") continue;
      if (g.formularioId && g.formularioId !== params.formId) continue;
      if (g.formularioOrigem && g.formularioOrigem !== "qualquer" && params.origem && g.formularioOrigem !== params.origem) continue;
      if (!scopeMatchesLead(g, lead)) continue;
      await startSalesbotRun(supabaseAdmin2, {
        workspaceId: params.workspaceId,
        salesbotId: bot.id,
        leadId: params.leadId,
        initialVariables: { trigger: "formulario-enviado", form_id: params.formId, form_origem: params.origem ?? "mkton" },
        delaySeconds: computeDelaySecondsFromGatilho(g)
      });
      break;
    }
  }
}
async function dispatchCustomFieldChanged(supabaseAdmin2, params) {
  const bots = await loadActiveBotsWithGatilhos(supabaseAdmin2, params.workspaceId);
  if (!bots.length) return;
  const lead = await loadLead(supabaseAdmin2, params.leadId, params.workspaceId);
  if (!lead) return;
  const fname = (params.fieldName ?? "").toLowerCase();
  for (const bot of bots) {
    for (const g of bot.gatilhos) {
      if (g.kind !== "campo-alterado") continue;
      const wanted = (g.campoNome ?? "").toLowerCase().trim();
      const wantedId = (g.campoId ?? "").trim();
      if (wantedId && wantedId !== params.fieldId) continue;
      if (!wantedId && wanted && wanted !== fname) continue;
      if (g.campoValor && params.value && g.campoValor !== params.value) continue;
      if (!scopeMatchesLead(g, lead)) continue;
      await startSalesbotRun(supabaseAdmin2, {
        workspaceId: params.workspaceId,
        salesbotId: bot.id,
        leadId: params.leadId,
        initialVariables: { trigger: "campo-alterado", field_id: params.fieldId, field_name: params.fieldName ?? "", value: params.value ?? "" },
        delaySeconds: computeDelaySecondsFromGatilho(g)
      });
      break;
    }
  }
}
async function dispatchMetaLeadAd(supabaseAdmin2, params) {
  const bots = await loadActiveBotsWithGatilhos(supabaseAdmin2, params.workspaceId);
  if (!bots.length) return;
  const lead = await loadLead(supabaseAdmin2, params.leadId, params.workspaceId);
  if (!lead) return;
  for (const bot of bots) {
    for (const g of bot.gatilhos) {
      if (g.kind !== "trafego-lead-anuncio") continue;
      if (g.campanhaId && params.campaignId && g.campanhaId !== params.campaignId) continue;
      if (!scopeMatchesLead(g, lead)) continue;
      await startSalesbotRun(supabaseAdmin2, {
        workspaceId: params.workspaceId,
        salesbotId: bot.id,
        leadId: params.leadId,
        initialVariables: {
          trigger: "trafego-lead-anuncio",
          campaign_id: params.campaignId ?? "",
          ad_id: params.adId ?? ""
        },
        delaySeconds: computeDelaySecondsFromGatilho(g)
      });
      break;
    }
  }
}
async function dispatchWebhookSent(supabaseAdmin2, params) {
  const bots = await loadActiveBotsWithGatilhos(supabaseAdmin2, params.workspaceId);
  if (!bots.length) return;
  const leadId = params.leadId ?? null;
  if (!leadId) return;
  for (const bot of bots) {
    for (const g of bot.gatilhos) {
      if (g.kind !== "webhook-enviado") continue;
      if (g.webhookUrl && g.webhookUrl.trim() && g.webhookUrl.trim() !== params.url) continue;
      await startSalesbotRun(supabaseAdmin2, {
        workspaceId: params.workspaceId,
        salesbotId: bot.id,
        leadId,
        initialVariables: { trigger: "webhook-enviado", url: params.url, status: String(params.status ?? "") },
        delaySeconds: computeDelaySecondsFromGatilho(g)
      });
      break;
    }
  }
}
async function dispatchTagAdded(supabaseAdmin2, params) {
  if (!params.tags.length) return;
  const bots = await loadActiveBotsWithGatilhos(supabaseAdmin2, params.workspaceId);
  if (!bots.length) return;
  const lead = await loadLead(supabaseAdmin2, params.leadId, params.workspaceId);
  if (!lead) return;
  const normalized = params.tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  for (const bot of bots) {
    for (const g of bot.gatilhos) {
      if (g.kind !== "tag-adicionada") continue;
      const wanted = (g.tag ?? "").trim().toLowerCase();
      if (!wanted || !normalized.includes(wanted)) continue;
      if (!scopeMatchesLead(g, lead)) continue;
      await startSalesbotRun(supabaseAdmin2, {
        workspaceId: params.workspaceId,
        salesbotId: bot.id,
        leadId: params.leadId,
        initialVariables: { trigger: "tag-adicionada", tag: wanted },
        delaySeconds: computeDelaySecondsFromGatilho(g)
      });
      break;
    }
  }
}
async function dispatchLeadCreated(supabaseAdmin2, params) {
  const bots = await loadActiveBotsWithGatilhos(supabaseAdmin2, params.workspaceId);
  if (!bots.length) return;
  const lead = await loadLead(supabaseAdmin2, params.leadId, params.workspaceId);
  if (!lead) return;
  for (const bot of bots) {
    for (const g of bot.gatilhos) {
      if (g.kind !== "crm-lead-criado") continue;
      if (!scopeMatchesLead(g, lead)) continue;
      await startSalesbotRun(supabaseAdmin2, {
        workspaceId: params.workspaceId,
        salesbotId: bot.id,
        leadId: params.leadId,
        initialVariables: { trigger: "crm-lead-criado" },
        delaySeconds: computeDelaySecondsFromGatilho(g)
      });
      break;
    }
  }
}
async function dispatchSocialInteraction(supabaseAdmin2, params) {
  const bots = await loadActiveBotsWithGatilhos(supabaseAdmin2, params.workspaceId);
  if (!bots.length) return;
  const lead = await loadLead(supabaseAdmin2, params.leadId, params.workspaceId);
  if (!lead) return;
  const wanted = params.kind === "comentario" ? params.network === "facebook" ? "social-comentario-facebook" : "social-comentario-instagram" : params.network === "facebook" ? "social-mencao-facebook" : "social-mencao-instagram";
  for (const bot of bots) {
    for (const g of bot.gatilhos) {
      if (g.kind !== wanted) continue;
      if (!scopeMatchesLead(g, lead)) continue;
      await startSalesbotRun(supabaseAdmin2, {
        workspaceId: params.workspaceId,
        salesbotId: bot.id,
        leadId: params.leadId,
        initialVariables: {
          trigger: wanted,
          canal: params.network,
          comment_id: params.commentId ?? "",
          media_id: params.mediaId ?? "",
          page_id: params.pageId ?? "",
          from_id: params.fromId ?? "",
          from_name: params.fromName ?? "",
          permalink: params.permalink ?? "",
          text: params.text ?? ""
        },
        delaySeconds: computeDelaySecondsFromGatilho(g)
      });
      break;
    }
  }
}
async function dispatchTrackingEvent(supabaseAdmin2, params) {
  const bots = await loadActiveBotsWithGatilhos(supabaseAdmin2, params.workspaceId);
  if (!bots.length) return;
  const lead = await loadLead(supabaseAdmin2, params.leadId, params.workspaceId);
  if (!lead) return;
  const evt = (params.eventName ?? "").trim().toLowerCase();
  const url = `${params.pageUrl ?? ""} ${params.pagePath ?? ""}`.toLowerCase();
  for (const bot of bots) {
    for (const g of bot.gatilhos) {
      if (g.kind !== "tracking-conversao" && g.kind !== "tracking-visita-quente" && g.kind !== "tracking-primeiro-acesso" && g.kind !== "tracking-abandono-formulario") continue;
      if (g.kind === "tracking-primeiro-acesso" && !params.isFirstVisit) continue;
      if (g.kind === "tracking-visita-quente" && !params.isHotVisit) continue;
      if (g.kind === "tracking-abandono-formulario" && evt !== "form_abandon" && evt !== "abandono_formulario") continue;
      if (g.trackingSiteId && params.siteId && g.trackingSiteId !== params.siteId) continue;
      const wantedEvt = (g.trackingEvento ?? g.conversaoTipo ?? "").trim().toLowerCase();
      if (g.kind === "tracking-conversao") {
        if (!wantedEvt) continue;
        if (wantedEvt !== "qualquer" && wantedEvt !== evt) continue;
      } else if (wantedEvt && wantedEvt !== "qualquer" && wantedEvt !== evt) {
        continue;
      }
      const min = typeof g.trackingValorMin === "number" ? g.trackingValorMin : null;
      if (min !== null && min > 0 && (params.value ?? 0) < min) continue;
      const urlContem = (g.trackingUrlContem ?? "").trim().toLowerCase();
      if (urlContem && !url.includes(urlContem)) continue;
      if (!scopeMatchesLead(g, lead)) continue;
      await startSalesbotRun(supabaseAdmin2, {
        workspaceId: params.workspaceId,
        salesbotId: bot.id,
        leadId: params.leadId,
        initialVariables: {
          trigger: g.kind,
          tracking_evento: params.eventName ?? "",
          tracking_valor: String(params.value ?? ""),
          tracking_url: params.pageUrl ?? "",
          tracking_pagina: params.pagePath ?? ""
        },
        delaySeconds: computeDelaySecondsFromGatilho(g)
      });
      break;
    }
  }
}
var MAX_STEPS_PER_TICK, SHORT_PAUSE_MAX_MS, FORMAT_MAP, DEFAULT_BH_CFG;
var init_salesbot_runtime_server = __esm({
  "copied-server-source/lib/salesbot-runtime.server.ts"() {
    init_execution_context();
    init_salesbot_group_actions_server();
    init_salesbot_ai_claim_server();
    init_salesbot_run_guards_server();
    init_ai_agent_x1_guards_server();
    init_whatsapp_identity();
    init_whatsapp_session_routing_server();
    init_salesbot_environment();
    init_agent_action_rules();
    init_agent_trigger_eval();
    init_agent_conditional_rules();
    MAX_STEPS_PER_TICK = 40;
    SHORT_PAUSE_MAX_MS = 25e3;
    FORMAT_MAP = {
      text: "texto",
      chat: "texto",
      conversation: "texto",
      extendedtextmessage: "texto",
      audio: "\xE1udio",
      ptt: "\xE1udio",
      audiomessage: "\xE1udio",
      image: "imagem",
      imagemessage: "imagem",
      sticker: "imagem",
      video: "v\xEDdeo",
      videomessage: "v\xEDdeo",
      document: "documento",
      documentmessage: "documento",
      location: "localiza\xE7\xE3o",
      locationmessage: "localiza\xE7\xE3o"
    };
    DEFAULT_BH_CFG = {
      timezone: "America/Sao_Paulo",
      days: [
        { enabled: false, start: "09:00", end: "18:00" },
        { enabled: true, start: "09:00", end: "18:00" },
        { enabled: true, start: "09:00", end: "18:00" },
        { enabled: true, start: "09:00", end: "18:00" },
        { enabled: true, start: "09:00", end: "18:00" },
        { enabled: true, start: "09:00", end: "18:00" },
        { enabled: false, start: "09:00", end: "13:00" }
      ]
    };
  }
});

// salesbot-server-entry.ts
init_salesbot_runtime_server();
init_stage_automation_engine_server();
export {
  backfillAutomationAction,
  classifyWhatsappRemoteJid,
  computePausaCronometroMs,
  dispatchCustomFieldChanged,
  dispatchFormSubmitted,
  dispatchGroupParticipantEvent,
  dispatchInboundMessage,
  dispatchLeadCreated,
  dispatchMetaLeadAd,
  dispatchSocialInteraction,
  dispatchStageChange,
  dispatchTagAdded,
  dispatchTrackingEvent,
  dispatchWebhookSent,
  enqueueLeadAutomationEvent,
  executeRun,
  resumeRunsOnFormSubmission,
  resumeRunsOnInboundMessage,
  resumeRunsOnMediaEvent,
  runJobById,
  scheduleStageTimerActions,
  sendWhatsappText,
  shouldRunForEvent,
  startSalesbotRun,
  tickAiAgentInactivity,
  tickAiAgentTracking,
  tickStageAutomationJobs,
  tickWaitingTimers
};
