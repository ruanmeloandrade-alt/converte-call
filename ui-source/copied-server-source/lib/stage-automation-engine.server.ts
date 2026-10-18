// Motor de automações de etapa do CRM — 100% servidor.
//
// Nada aqui depende do navegador: os gatilhos são enfileirados na tabela
// `crm_automation_jobs` e executados pelo servidor (na hora ou pelo cron
// `/api/public/hooks/crm-automations-tick`), com o app aberto ou fechado.

import type { AutomationAction, ExecutionConfig, ExecutionCondition, AutomationConfig } from "@/lib/crm-mock";
import {
  isAutomationConfigured,
  normalizeTrigger,
  validateFieldValue,
  webhookPreviewPayload,
} from "@/lib/crm-mock";
import { buildFormShareUrl, renderFormMessage, DEFAULT_FORM_MESSAGE_TEMPLATE } from "@/lib/forms.functions";
import { fromZonedTime } from "date-fns-tz";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnySb = {
  from: (t: string) => any;
  rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export type AutomationEventType =
  | "created"
  | "moved"
  | "manual"
  | "assignee-changed"
  | "tag-added"
  | "field-updated";

export interface EmitInput {
  leadId: string;
  event: AutomationEventType;
  workspaceId?: string;
  pipelineId?: string | null;
  stageId?: string | null;
  fromStageId?: string | null;
  tags?: string[];
  fieldId?: string;
  fieldName?: string;
  chained?: boolean;
  excludeActionIds?: string[];
  eventId?: string | null;
}

export interface JobResult {
  actionId: string;
  title: string;
  ok: boolean;
  error?: string;
  skipped?: boolean;
  queuedFor?: string;
}

type LeadCtx = {
  id: string;
  workspaceId: string;
  pipelineId: string | null;
  stageId: string | null;
  sourceId: string | null;
  whatsappSessionId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  value: number | null;
  tags: string[];
  timezone: string;
  customFields: Array<{ id: string; name: string; displayValue: string }>;
};

/* -------------------------------------------------- contexto do lead ----- */

async function loadLeadCtx(admin: AnySb, leadId: string, expectedWorkspaceId?: string): Promise<LeadCtx | null> {
  let query = admin
    .from("leads")
    .select("id, workspace_id, pipeline_id, stage_id, crm_source_id, custom_data, name, email, phone, value, tags, workspaces(business_hours)")
    .eq("id", leadId);
  if (expectedWorkspaceId) query = query.eq("workspace_id", expectedWorkspaceId);
  const { data } = await query.maybeSingle();
  const lead = data as
    | {
        id: string;
        workspace_id: string;
        pipeline_id: string | null;
        stage_id: string | null;
        crm_source_id: string | null;
        custom_data: Record<string, unknown> | null;
        name: string | null;
        email: string | null;
        phone: string | null;
        value: number | null;
        tags: unknown;
        workspaces?: { business_hours?: { timezone?: unknown } | null } | null;
      }
    | null;
  if (!lead) return null;

  const custom: LeadCtx["customFields"] = [];
  try {
    const { data: values } = await admin
      .from("lead_custom_field_values")
      .select("field_id, value, lead_custom_fields(name)")
      .eq("workspace_id", lead.workspace_id)
      .eq("lead_id", leadId);
    for (const row of (values ?? []) as Array<{ field_id: string; value: unknown; lead_custom_fields?: { name?: string } | null }>) {
      const raw = row.value as { display?: string } | string | null;
      const display = raw && typeof raw === "object" ? String(raw.display ?? "") : String(raw ?? "");
      custom.push({ id: row.field_id, name: row.lead_custom_fields?.name ?? "", displayValue: display });
    }
  } catch {
    /* campos personalizados são opcionais */
  }

  const configuredTimezone = lead.workspaces?.business_hours?.timezone;
  const timezone =
    typeof configuredTimezone === "string" && configuredTimezone.trim()
      ? configuredTimezone.trim()
      : "America/Sao_Paulo";

  return {
    id: lead.id,
    workspaceId: lead.workspace_id,
    pipelineId: lead.pipeline_id,
    stageId: lead.stage_id,
    sourceId: lead.crm_source_id,
    whatsappSessionId:
      typeof lead.custom_data?.whatsapp_session_id === "string" &&
      lead.custom_data.whatsapp_session_id.trim()
        ? lead.custom_data.whatsapp_session_id.trim()
        : null,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    value: lead.value,
    tags: Array.isArray(lead.tags) ? (lead.tags as string[]) : [],
    timezone,
    customFields: custom,
  };
}

/* --------------------------------------------------------- enfileirar ---- */

/**
 * Carrega as automações do funil do lead, seleciona as que casam com o evento
 * e grava um job por ação. Jobs sem atraso são executados na mesma requisição.
 */
export async function enqueueLeadAutomationEvent(admin: AnySb, input: EmitInput): Promise<JobResult[]> {
  const lead = await loadLeadCtx(admin, input.leadId, input.workspaceId);
  if (!lead) return [];
  const pipelineId = input.pipelineId ?? lead.pipelineId;
  const stageId = input.stageId ?? lead.stageId;
  if (!pipelineId || !stageId) return [];

  const { data: rows } = await admin
    .from("crm_stage_automations")
    .select("stage_id, action, enabled")
    .eq("workspace_id", lead.workspaceId)
    .eq("pipeline_id", pipelineId)
    .order("position");

  const seen = new Set<string>();
  const actions: AutomationAction[] = [];
  for (const row of (rows ?? []) as Array<{ stage_id: string; action: AutomationAction; enabled: boolean | null }>) {
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

  const results: JobResult[] = [];
  const immediate: Array<{ id: string; action: AutomationAction }> = [];

  for (const action of actions) {
    if (!isAutomationConfigured(action) || !action.config) {
      results.push({ actionId: action.id, title: action.title, ok: false, error: "não configurada" });
      continue;
    }
    const delay = scheduleDelayMinutes(action.execution, lead);
    if (delay < 0) {
      results.push({ actionId: action.id, title: action.title, ok: true, skipped: true });
      continue;
    }
    const dueAt = new Date(Date.now() + delay * 60_000).toISOString();
    const eventId = input.eventId || `evt_${input.event}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const dedupeKey = `${action.id}:${eventId}`;

    const { data: created, error: insertError } = await admin
      .from("crm_automation_jobs")
      .insert({
        workspace_id: lead.workspaceId,
        lead_id: lead.id,
        pipeline_id: pipelineId,
        stage_id: stageId,
        action_id: action.id,
        action: action as unknown,
        context: {
          event: input.event,
          fromStageId: input.fromStageId ?? null,
          tags: input.tags ?? [],
          fieldId: input.fieldId ?? null,
          fieldName: input.fieldName ?? null,
          chained: input.chained ?? false,
          event_id: eventId,
        },
        due_at: dueAt,
        status: "pending",
        dedupe_key: dedupeKey,
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      if (String((insertError as any).code) === "23505") {
        results.push({ actionId: action.id, title: action.title, ok: true, skipped: true });
        continue;
      }
      results.push({ actionId: action.id, title: action.title, ok: false, error: insertError.message });
      continue;
    }

    const jobId = (created as { id?: string } | null)?.id;
    if (!jobId) {
      results.push({ actionId: action.id, title: action.title, ok: false, error: "não foi possível enfileirar" });
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

/* ------------------------------------------------------------- execução -- */

type JobRow = {
  id: string;
  workspace_id: string;
  lead_id: string;
  pipeline_id: string | null;
  stage_id: string | null;
  action: AutomationAction;
  context: Record<string, unknown> | null;
  attempts: number | null;
};

export async function runJobById(admin: AnySb, jobId: string): Promise<JobResult> {
  const { data } = await admin.from("crm_automation_jobs").select("*").eq("id", jobId).maybeSingle();
  const job = data as JobRow | null;
  if (!job) return { actionId: jobId, title: "job", ok: false, error: "job não encontrado" };
  return runJob(admin, job);
}

async function finishJob(
  admin: AnySb,
  jobId: string,
  status: "done" | "skipped" | "error",
  error?: string,
  attempts?: number,
) {
  await admin
    .from("crm_automation_jobs")
    .update({
      status,
      last_error: error ?? null,
      executed_at: new Date().toISOString(),
      attempts: (attempts ?? 0) + 1,
    })
    .eq("id", jobId);
}

export async function runJob(admin: AnySb, job: JobRow): Promise<JobResult> {
  const action = job.action;
  const title = action?.title ?? "gatilho";
  try {
    const lead = await loadLeadCtx(admin, job.lead_id, job.workspace_id);
    if (!lead) {
      await finishJob(admin, job.id, "skipped", "lead removido", job.attempts ?? 0);
      return { actionId: action?.id ?? job.id, title, ok: true, skipped: true };
    }
    if (!passesExecutionRules(lead, action.execution)) {
      await finishJob(admin, job.id, "skipped", "condições não atendidas", job.attempts ?? 0);
      return { actionId: action.id, title, ok: true, skipped: true };
    }
    await executeAction(admin, lead, action, (job.context ?? {}) as Record<string, unknown>);
    await finishJob(admin, job.id, "done", undefined, job.attempts ?? 0);
    return { actionId: action.id, title, ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishJob(admin, job.id, "error", msg, job.attempts ?? 0);
    return { actionId: action?.id ?? job.id, title, ok: false, error: msg };
  }
}

/** Processa jobs vencidos. Chamado pelo cron a cada minuto. */
export async function tickStageAutomationJobs(admin: AnySb, limit = 100): Promise<{ processed: number; failed: number }> {
  const { data } = await admin
    .from("crm_automation_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("due_at", new Date().toISOString())
    .order("due_at")
    .limit(limit);
  const jobs = (data ?? []) as JobRow[];
  let processed = 0;
  let failed = 0;
  for (const job of jobs) {
    // Claim: evita execução dupla se dois ticks se cruzarem.
    const { data: claimed } = await admin
      .from("crm_automation_jobs")
      .update({ status: "running" })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed || (claimed as unknown[]).length === 0) continue;
    const r = await runJob(admin, job);
    processed += 1;
    if (!r.ok) failed += 1;
  }
  return { processed, failed };
}

/* ----------------------------------------------------------- ações ------- */

async function logActivity(admin: AnySb, lead: LeadCtx, type: string, payload: Record<string, unknown>) {
  await admin.from("lead_activities").insert({
    workspace_id: lead.workspaceId,
    lead_id: lead.id,
    type,
    payload,
    occurred_at: new Date().toISOString(),
  });
}

async function executeAction(
  admin: AnySb,
  lead: LeadCtx,
  action: AutomationAction,
  ctx: Record<string, unknown>,
): Promise<void> {
  const config = action.config;
  if (!config) throw new Error("não configurada");
  const chained = ctx.chained === true;

  switch (config.kind) {
    case "mudar-etapa": {
      if (!config.stageId) throw new Error("etapa de destino faltando");
      const { data: stage } = await admin
        .from("pipeline_stages")
        .select("pipeline_id")
        .eq("id", config.stageId)
        .eq("workspace_id", lead.workspaceId)
        .maybeSingle();
      const pipelineId = (stage as { pipeline_id?: string } | null)?.pipeline_id;
      if (!pipelineId) throw new Error("etapa de destino inválida");
      const { error } = await admin
        .from("leads")
        .update({ stage_id: config.stageId, pipeline_id: pipelineId, updated_at: new Date().toISOString() })
        .eq("id", lead.id)
        .eq("workspace_id", lead.workspaceId);
      if (error) throw new Error(error.message);
      const { dispatchStageChange } = await import("@/lib/salesbot-runtime.server");
      await dispatchStageChange(admin as never, {
        workspaceId: lead.workspaceId,
        leadId: lead.id,
        newStageId: config.stageId,
        newPipelineId: pipelineId,
      }).catch(() => undefined);
      if (!chained) {
        await enqueueLeadAutomationEvent(admin, {
          leadId: lead.id,
          event: "moved",
          workspaceId: lead.workspaceId,
          pipelineId,
          stageId: config.stageId,
          fromStageId: lead.stageId,
          chained: true,
          excludeActionIds: [action.id],
        });
      }
      return;
    }

    case "editar-tags": {
      const mode = config.mode ?? "add";
      let next: string[];
      let added: string[] = [];
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
      const { error } = await admin
        .from("leads")
        .update({ tags: next, updated_at: new Date().toISOString() })
        .eq("id", lead.id)
        .eq("workspace_id", lead.workspaceId);
      if (error) throw new Error(error.message);
      if (added.length > 0) {
        const { dispatchTagAdded } = await import("@/lib/salesbot-runtime.server");
        await dispatchTagAdded(admin as never, {
          workspaceId: lead.workspaceId,
          leadId: lead.id,
          tags: added,
        }).catch(() => undefined);
        if (!chained) {
          await enqueueLeadAutomationEvent(admin, {
            leadId: lead.id,
            event: "tag-added",
            tags: added,
            chained: true,
            excludeActionIds: [action.id],
          });
        }
      }
      return;
    }

    case "alterar-user": {
      if (!config.userId) throw new Error("usuário faltando");
      const { data: member } = await admin
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", lead.workspaceId)
        .eq("user_id", config.userId)
        .maybeSingle();
      if (!member) throw new Error("responsável não pertence a este workspace");
      const { error } = await admin
        .from("leads")
        .update({ responsible_id: config.userId, updated_at: new Date().toISOString() })
        .eq("id", lead.id)
        .eq("workspace_id", lead.workspaceId);
      if (error) throw new Error(error.message);
      if (!chained) {
        await enqueueLeadAutomationEvent(admin, {
          leadId: lead.id,
          event: "assignee-changed",
          chained: true,
          excludeActionIds: [action.id],
        });
      }
      return;
    }

    case "alterar-campo": {
      const valor = config.valor ?? "";
      const validation = validateFieldValue(config.campo ?? "", valor, config.customFieldType);
      if (!validation.ok) throw new Error(validation.error ?? "valor inválido");
      if (config.campo === "custom") {
        if (!config.customFieldId) throw new Error("campo personalizado não selecionado");
        const { data: customField } = await admin
          .from("lead_custom_fields")
          .select("id, name")
          .eq("id", config.customFieldId)
          .eq("workspace_id", lead.workspaceId)
          .maybeSingle();
        if (!customField) throw new Error("campo personalizado não pertence a este workspace");
        const value = String(validation.normalized ?? valor);
        const { error } = await admin.from("lead_custom_field_values").upsert(
          {
            workspace_id: lead.workspaceId,
            lead_id: lead.id,
            field_id: config.customFieldId,
            value: { display: value, raw: [value] },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "lead_id,field_id" },
        );
        if (error) throw new Error(error.message);
        const { dispatchCustomFieldChanged } = await import("@/lib/salesbot-runtime.server");
        await dispatchCustomFieldChanged(admin as never, {
          workspaceId: lead.workspaceId,
          leadId: lead.id,
          fieldId: config.customFieldId,
          value,
        }).catch(() => undefined);
        if (!chained) {
          await enqueueLeadAutomationEvent(admin, {
            leadId: lead.id,
            event: "field-updated",
            workspaceId: lead.workspaceId,
            fieldId: config.customFieldId,
            fieldName: (customField as { name?: string }).name ?? undefined,
            chained: true,
            excludeActionIds: [action.id],
          });
        }
        return;
      }
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      switch (config.campo) {
        case "name": patch.name = validation.normalized as string; break;
        case "email": patch.email = validation.normalized as string; break;
        case "phone": patch.phone = validation.normalized as string; break;
        case "value": patch.value = validation.normalized as number; break;
        default: throw new Error("campo inválido");
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
          excludeActionIds: [action.id],
        });
      }
      return;
    }

    case "vincular-produto": {
      const pId = config.productId;
      if (!pId) throw new Error("produto não selecionado");
      const { data: product } = await admin
        .from("products")
        .select("id")
        .eq("id", pId)
        .eq("workspace_id", lead.workspaceId)
        .maybeSingle();
      if (!product) throw new Error("produto não pertence a este workspace");
      const kind = (config.productKind as "interesse" | "comprou") || "interesse";
      const { error } = await admin.from("lead_products").upsert(
        { workspace_id: lead.workspaceId, lead_id: lead.id, product_id: pId, kind },
        { onConflict: "lead_id,product_id,kind" },
      );
      if (error) throw new Error(error.message);
      await logActivity(admin, lead, "produto_vinculado", { product_id: pId, kind, by: "automation" });
      return;
    }

    case "tarefa": {
      const now = new Date();
      const unidade = config.prazoUnidade ?? "dias";
      const valor = config.prazoValor ?? config.diasAdiante ?? 1;
      const factor = unidade === "minutos" ? 60_000 : unidade === "horas" ? 3_600_000 : 86_400_000;
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
          tags: config.workflowTags ?? [`lead:${lead.id}`],
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
          end_at: end.toISOString(),
        });
        if (error) throw new Error(error.message);
      }
      return;
    }

    case "tarefa-concluida": {
      let q = admin
        .from("tasks")
        .update({ status: "concluida", updated_at: new Date().toISOString() })
        .eq("workspace_id", lead.workspaceId);
      q = (config.escopo ?? "todas") === "especifica" && config.taskId
        ? q.eq("id", config.taskId)
        : q.eq("lead_id", lead.id).neq("status", "concluida");
      const { error } = await q;
      if (error) throw new Error(error.message);
      return;
    }

    case "excluir-tarefas": {
      let q = admin.from("tasks").delete().eq("workspace_id", lead.workspaceId);
      q = (config.escopo ?? "todas") === "especifica" && config.taskId
        ? q.eq("id", config.taskId)
        : q.eq("lead_id", lead.id);
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
      const src = (full ?? {}) as Record<string, unknown>;
      delete src.id;
      delete src.created_at;
      delete src.updated_at;
      delete src.external_id;
      if (config.manterEtapa === false && config.toStageId) {
        const { data: stage } = await admin
          .from("pipeline_stages")
          .select("pipeline_id")
          .eq("id", config.toStageId)
          .eq("workspace_id", lead.workspaceId)
          .maybeSingle();
        src.stage_id = config.toStageId;
        src.pipeline_id = (stage as { pipeline_id?: string } | null)?.pipeline_id ?? src.pipeline_id;
      }
      src.name = `${String(src.name ?? "Lead")} (cópia)`;
      const { error } = await admin.from("leads").insert(src);
      if (error) throw new Error(error.message);
      return;
    }

    case "salesbot": {
      if (!config.botId) throw new Error("SalesBot não selecionado");
      const { data: selectedBot, error: botError } = await admin
        .from("salesbots")
        .select("id, is_active")
        .eq("id", config.botId)
        .eq("workspace_id", lead.workspaceId)
        .maybeSingle();
      if (botError) throw new Error(botError.message);
      if (!selectedBot) throw new Error("SalesBot não encontrado neste workspace");
      if ((selectedBot as { is_active?: boolean }).is_active !== true) {
        throw new Error("SalesBot inativo — automação não iniciada");
      }
      const { startSalesbotRun } = await import("@/lib/salesbot-runtime.server");
      const runId = await startSalesbotRun(admin as never, {
        workspaceId: lead.workspaceId,
        salesbotId: config.botId,
        leadId: lead.id,
      });
      if (!runId) throw new Error("não foi possível iniciar o SalesBot");
      return;
    }

    case "executar-ia": {
      if (!config.agentId) throw new Error("Agente IA não selecionado");
      const { data: agent } = await admin
        .from("conversation_ai_agents")
        .select("id, name")
        .eq("id", config.agentId)
        .eq("workspace_id", lead.workspaceId)
        .maybeSingle();
      if (!agent) throw new Error("Agente IA não encontrado neste workspace");
      const { error } = await admin
        .from("leads")
        .update({ active_conversation_agent_id: config.agentId, ai_paused: false, updated_at: new Date().toISOString() })
        .eq("id", lead.id)
        .eq("workspace_id", lead.workspaceId);
      if (error) throw new Error(error.message);
      await logActivity(admin, lead, "ai_agent_activated", {
        agent_id: config.agentId,
        agent_name: (agent as { name?: string }).name ?? null,
        by: "automation",
      });
      return;
    }

    case "pausar-ia": {
      const { error } = await admin
        .from("leads")
        .update({ ai_paused: true, updated_at: new Date().toISOString() })
        .eq("id", lead.id)
        .eq("workspace_id", lead.workspaceId);
      if (error) throw new Error(error.message);
      return;
    }

    case "msg-interna": {
      const to = config.toUserNome ? `@${config.toUserNome} ` : "";
      await logActivity(admin, lead, "note", { text: `${to}${config.mensagem ?? ""}`.trim(), by: "automation" });
      return;
    }

    case "webhook": {
      if (!config.url) throw new Error("URL do webhook faltando");
      const payload = { ...webhookPreviewPayload(config), lead_id: lead.id };
      const headers: Record<string, string> = { "Content-Type": "application/json" };
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
        body: method === "GET" ? undefined : JSON.stringify(payload),
      });
      await logActivity(admin, lead, "webhook_sent", {
        url: config.url,
        status: resp.status,
        ok: resp.ok,
      });
      if (!resp.ok) throw new Error(`webhook ${resp.status}`);
      const { dispatchWebhookSent } = await import("@/lib/salesbot-runtime.server");
      await dispatchWebhookSent(admin as never, {
        workspaceId: lead.workspaceId,
        leadId: lead.id,
        url: config.url,
      }).catch(() => undefined);
      return;
    }

    case "meta-ads": {
      if (config.modo === "capturar") return;
      if (!config.pixelId) throw new Error("Pixel ID faltando");
      const eventName = config.eventName === "custom"
        ? (config.customEventName ?? "CustomEvent")
        : (config.eventName ?? "Lead");
      const encKey = process.env.INTEGRATION_ENCRYPTION_KEY;
      if (!encKey) throw new Error("INTEGRATION_ENCRYPTION_KEY ausente");
      const { data: secret } = await admin.rpc("get_integration_secret", {
        _workspace_id: lead.workspaceId,
        _provider: "meta_capi",
        _key: encKey,
      });
      const token = (secret as { access_token?: string } | null)?.access_token ?? null;
      if (!token) throw new Error("Token da Meta indisponível. Configure a Conversions API.");
      const { data: leadRow } = await admin
        .from("leads")
        .select("email, phone, name, value, fb_fbc, fb_fbp, fb_external_id, fb_event_id, fb_client_ip, fb_client_ua")
        .eq("id", lead.id)
        .maybeSingle();
      const l = (leadRow ?? {}) as Record<string, string | number | null>;
      const user_data: Record<string, unknown> = {};
      if (l.email) user_data.em = [await sha256Hex(String(l.email).trim().toLowerCase())];
      if (l.phone) user_data.ph = [await sha256Hex(String(l.phone).replace(/\D/g, ""))];
      user_data.external_id = [await sha256Hex(String(l.fb_external_id ?? lead.id))];
      if (l.fb_fbc) user_data.fbc = l.fb_fbc;
      if (l.fb_fbp) user_data.fbp = l.fb_fbp;
      const valorNum = config.valorPadrao ? Number(config.valorPadrao) : Number(l.value ?? 0);
      const custom_data: Record<string, unknown> = {};
      if (valorNum > 0) {
        custom_data.value = valorNum;
        custom_data.currency = config.moeda ?? "BRL";
      }
      const body: Record<string, unknown> = {
        data: [{
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: `${lead.id}:${eventName}`,
          action_source: "system_generated",
          user_data,
          custom_data,
        }],
        access_token: token,
      };
      if (config.testEventCode) body.test_event_code = config.testEventCode;
      const r = await fetch(`https://graph.facebook.com/v23.0/${config.pixelId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      await logActivity(admin, lead, "meta_capi_sent", {
        pixel_id: config.pixelId,
        event_name: eventName,
        status: r.status,
        ok: r.ok,
        response: text.slice(0, 300),
      });
      if (!r.ok) throw new Error(`Meta CAPI ${r.status}`);
      return;
    }

    case "gerar-form": {
      if (!config.formId) throw new Error("formulário não selecionado");
      const { data: formRow } = await admin
        .from("crm_forms")
        .select("id, nome, slug")
        .eq("id", config.formId)
        .eq("workspace_id", lead.workspaceId)
        .maybeSingle();
      const form = formRow as { nome?: string; slug?: string } | null;
      if (!form?.slug) throw new Error("formulário não encontrado");
      const link = buildFormShareUrl(form.slug, lead.id);
      const canal = config.canal ?? "link";
      if (canal === "email") {
        if (!lead.email) throw new Error("lead sem e-mail cadastrado");
        const { sendWorkspaceEmail } = await import("@/lib/email-sender.server");
        const corpo = (config.mensagem?.trim() || DEFAULT_FORM_MESSAGE_TEMPLATE)
          .replace(/\{\{\s*link\s*\}\}/g, link)
          .replace(/\{\{\s*nome\s*\}\}/g, lead.name ?? "");
        await sendWorkspaceEmail(admin as never, lead.workspaceId, {
          to: lead.email,
          subject: form.nome ? `Formulário: ${form.nome}` : "Formulário",
          html: `<p>${corpo.replace(/\n/g, "<br/>")}</p><p><a href="${link}">${link}</a></p>`,
        } as never);
        await logActivity(admin, lead, "note", { text: `📧 Formulário enviado por e-mail para ${lead.email}`, by: "automation" });
        return;
      }
      if (canal !== "whatsapp") {
        await logActivity(admin, lead, "note", {
          text: `📝 Formulário "${form.nome ?? ""}": ${link}`,
          by: "automation",
        });
        return;
      }
      if (!lead.phone) throw new Error("lead sem telefone para envio no WhatsApp");
      const customMap: Record<string, string> = {};
      for (const cf of lead.customFields) customMap[cf.name] = cf.displayValue;
      const text = renderFormMessage(config.mensagem?.trim() || DEFAULT_FORM_MESSAGE_TEMPLATE, {
        link,
        nome: lead.name,
        email: lead.email,
        telefone: lead.phone,
        valor: lead.value,
        etapa: null,
        funil: null,
        customFields: customMap,
      });
      const { sendWhatsappText } = await import("@/lib/salesbot-runtime.server");
      const sent = await sendWhatsappText(admin as never, lead.workspaceId, lead.phone, text);
      if (!sent.ok) throw new Error(sent.error ?? "falha no envio pelo WhatsApp");
      return;
    }

    case "deletar-arquivos": {
      // Mantém o comportamento conservador: registra a solicitação e limpa
      // as mídias das mensagens do lead.
      if (lead.phone) {
        await admin
          .from("whatsapp_web_messages")
          .update({ media_url: null })
          .eq("workspace_id", lead.workspaceId)
          .eq("sender_phone", lead.phone.replace(/\D/g, ""));
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

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------- regras ---- */

export function shouldRunForEvent(
  action: AutomationAction,
  event: AutomationEventType,
  input?: Pick<EmitInput, "tags" | "fieldId" | "fieldName">,
): boolean {
  if (event === "manual") return true;
  const trigger = action.execution?.trigger;
  const spec = normalizeTrigger(trigger);
  switch (spec.kind as string) {
    case "created-or-moved": return event === "created" || event === "moved";
    case "created-only": return event === "created";
    case "moved-only":
    case "moved": return event === "moved";
    case "created": return event === "created";
    case "assignee-changed": return event === "assignee-changed";
    case "tag-added": {
      if (event !== "tag-added") return false;
      const configured = Array.isArray((spec as { tags?: string[] }).tags)
        ? ((spec as { tags?: string[] }).tags ?? []).map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean)
        : [];
      if (configured.length === 0) return true;
      const added = (input?.tags ?? []).map((tag) => tag.trim().toLocaleLowerCase());
      return configured.some((tag) => added.includes(tag));
    }
    case "field-updated": {
      if (event !== "field-updated") return false;
      const fieldSpec = spec as { fieldId?: string; fieldName?: string };
      if (fieldSpec.fieldId && fieldSpec.fieldId !== input?.fieldId) return false;
      if (fieldSpec.fieldName) {
        const expected = fieldSpec.fieldName.trim().toLocaleLowerCase();
        const actual = String(input?.fieldName ?? "").trim().toLocaleLowerCase();
        if (expected && expected !== actual) return false;
      }
      return true;
    }
    case "hours-before-field": {
      if (event !== "field-updated") return false;
      const fieldSpec = spec as { fieldId?: string; fieldName?: string };
      if (fieldSpec.fieldId && fieldSpec.fieldId !== input?.fieldId) return false;
      if (fieldSpec.fieldName) {
        const expected = fieldSpec.fieldName.trim().toLocaleLowerCase();
        const actual = String(input?.fieldName ?? "").trim().toLocaleLowerCase();
        if (expected && expected !== actual) return false;
      }
      return true;
    }
    case "daily":
    case "exact-datetime": return event === "created" || event === "moved";
    default: return false;
  }
}

export function parseAutomationDateTime(
  value: string,
  timezone = "America/Sao_Paulo",
): number {
  const raw = String(value ?? "").trim();
  if (!raw) return Number.NaN;

  // Valores com offset/Z já representam um instante absoluto. Valores vindos
  // de input datetime-local não têm offset e devem ser interpretados no fuso
  // persistido do workspace, nunca no fuso do servidor.
  const hasExplicitZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
  try {
    const date = hasExplicitZone ? new Date(raw) : fromZonedTime(raw, timezone);
    return date.getTime();
  } catch {
    return Number.NaN;
  }
}

/** Minutos até a execução. -1 = não deve executar. */
export function scheduleDelayMinutes(exec: ExecutionConfig | undefined, lead?: LeadCtx): number {
  const base = Math.max(0, Number(exec?.delayMinutes ?? 0));
  const spec = normalizeTrigger(exec?.trigger);
  if (spec.kind === "hours-before-field") {
    const fieldSpec = spec as { hours?: number; fieldId?: string; fieldName?: string };
    const target = lead?.customFields.find(
      (field) => (fieldSpec.fieldId && field.id === fieldSpec.fieldId)
        || (fieldSpec.fieldName && field.name.trim().toLocaleLowerCase() === fieldSpec.fieldName.trim().toLocaleLowerCase()),
    );
    const raw = target?.displayValue ?? "";
    const callAt = parseAutomationDateTime(raw, lead?.timezone);
    if (!Number.isFinite(callAt)) return -1;
    if (callAt <= Date.now()) return -1;
    const hours = Math.max(0, Number(fieldSpec.hours ?? 0));
    const dueAt = callAt - hours * 3_600_000;
    const diff = Math.round((dueAt - Date.now()) / 60_000);
    return Math.max(0, diff) + base;
  }
  if (spec.kind === "daily") {
    const [h, m] = String(spec.time ?? "09:00").split(":").map((n) => Number(n) || 0);
    const now = brNow();
    const next = new Date(now);
    next.setHours(h, m, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    return Math.round((next.getTime() - now.getTime()) / 60_000) + base;
  }
  if (spec.kind === "exact-datetime") {
    const at = parseAutomationDateTime(spec.at ?? "", lead?.timezone);
    if (!Number.isFinite(at)) return -1;
    const diff = Math.round((at - Date.now()) / 60_000);
    if (diff < 0) return -1;
    return diff + base;
  }
  return base;
}

/** Agora no fuso de Brasília (-03:00), independente do fuso do servidor. */
function brNow(): Date {
  return new Date(Date.now() - 3 * 3_600_000);
}

export function leadMatchesSourceFilter(
  sourceFilter: string[] | undefined,
  lead: { sourceId: string | null; whatsappSessionId: string | null },
): boolean {
  if (!sourceFilter?.length) return true;
  const accepted = new Set<string>();
  if (lead.sourceId) accepted.add(lead.sourceId);
  if (lead.whatsappSessionId) {
    accepted.add(lead.whatsappSessionId);
    accepted.add(`whatsapp:${lead.whatsappSessionId}`);
  }
  return sourceFilter.some((source) => accepted.has(source));
}

function passesExecutionRules(lead: LeadCtx, exec?: ExecutionConfig): boolean {
  if (!isInsideActiveWindow(exec)) return false;
  if (!leadMatchesSourceFilter(exec?.sourceFilter, lead)) return false;
  const conditions = exec?.conditions ?? [];
  if (conditions.length === 0) return true;
  return conditions.every((condition) => matchesCondition(condition, lead));
}

function isInsideActiveWindow(exec?: ExecutionConfig): boolean {
  const active = exec?.active ?? "always";
  if (active === "always") return true;
  const now = brNow();
  const day = now.getUTCDay();
  const current = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (active === "business-hours") return day >= 1 && day <= 5 && current >= 9 * 60 && current <= 18 * 60;
  const wins = exec?.activeWindows?.length ? exec.activeWindows : exec?.activeWindow ? [exec.activeWindow] : [];
  if (!wins.length) return true;
  return wins.some((win) => {
    if (!(win.days ?? []).includes(day)) return false;
    return current >= parseHm(win.from ?? "00:00") && current <= parseHm(win.to ?? "23:59");
  });
}

function parseHm(value: string): number {
  const [h, m] = value.split(":").map((part) => Number(part));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function matchesCondition(condition: ExecutionCondition, lead: LeadCtx): boolean {
  if (condition.field === "no-tag") return lead.tags.length === 0;
  let actual = "";
  if (condition.field === "tag") actual = lead.tags.join(", ");
  else if (condition.field === "value") actual = String(lead.value ?? 0);
  else if (condition.field === "name") actual = lead.name ?? "";
  else if (condition.field === "email") actual = lead.email ?? "";
  else if (condition.field === "phone") actual = lead.phone ?? "";
  else if (condition.field === "custom-field") {
    actual = lead.customFields.find(
      (f) => f.id === condition.customFieldId || f.name === condition.customFieldNome,
    )?.displayValue ?? "";
  }
  const expected = condition.value ?? "";
  if (condition.field === "value") {
    const a = Number(actual);
    const b = Number(expected);
    if (condition.op === "gt") return a > b;
    if (condition.op === "lt") return a < b;
    if (condition.op === "neq") return a !== b;
    return a === b;
  }
  const a = actual.toLowerCase();
  const b = expected.toLowerCase();
  if (condition.op === "neq") return a !== b;
  if (condition.op === "contains") return a.includes(b);
  if (condition.op === "not-in") return !a.includes(b);
  return a === b;
}

/* --------------------------------------------------------------- backfill --
 * "Aplicar o gatilho a todos os leads já nesta etapa": enfileira a ação
 * escolhida para cada lead que já está nas etapas cobertas. Roda no servidor.
 */
export async function backfillAutomationAction(
  admin: AnySb,
  input: { workspaceId: string; pipelineId: string; action: AutomationAction; stageIds: string[] },
): Promise<{ queued: number }> {
  if (!input.stageIds.length || !isAutomationConfigured(input.action) || !input.action.config) {
    return { queued: 0 };
  }
  const { data: leadRows } = await admin
    .from("leads")
    .select("id, stage_id")
    .eq("workspace_id", input.workspaceId)
    .eq("pipeline_id", input.pipelineId)
    .in("stage_id", input.stageIds)
    .limit(2000);

  const leads = (leadRows ?? []) as Array<{ id: string; stage_id: string }>;
  if (!leads.length) return { queued: 0 };

  const trigger = normalizeTrigger(input.action.execution?.trigger);
  const jobs: Array<Record<string, unknown>> = [];

  for (const row of leads) {
    let delay = Math.max(0, Number(input.action.execution?.delayMinutes ?? 0));

    // Gatilhos baseados em um campo de data precisam do valor individual de
    // cada lead; nunca podem cair em "0 min" só porque o backfill não tinha
    // carregado o contexto do lead.
    if (trigger.kind === "hours-before-field") {
      const lead = await loadLeadCtx(admin, row.id, input.workspaceId);
      if (!lead) continue;
      delay = scheduleDelayMinutes(input.action.execution, lead);
      if (delay < 0) continue;
    }

    jobs.push({
      workspace_id: input.workspaceId,
      lead_id: row.id,
      pipeline_id: input.pipelineId,
      stage_id: row.stage_id,
      action_id: input.action.id,
      action: input.action as unknown,
      context: { event: "manual", backfill: true },
      due_at: new Date(Date.now() + delay * 60_000).toISOString(),
      status: "pending",
    });
  }

  if (jobs.length === 0) return { queued: 0 };
  const { data: created } = await admin.from("crm_automation_jobs").insert(jobs).select("id");
  return { queued: ((created ?? []) as unknown[]).length };
}
