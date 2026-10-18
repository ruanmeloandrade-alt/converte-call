// Original Saúde Slim: queryMatchingLeads. Storage adapter is separate.
export async function queryMatchingLeads(sb: AnySb, wsId: string, f: AudienceFilters, limit = 2000): Promise<LeadRow[]> {
  let q = sb.from("leads")
    .select("id,name,email,phone,value,stage_id,last_message_from,tags,created_at,updated_at,status,pipeline_id,crm_source_id,responsible_id,company_id,conversation_status,custom_data")
    .eq("workspace_id", wsId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  const status = f.status ?? "active";
  if (status !== "any") q = q.eq("status", status);
  if (f.pipelineIds?.length) q = q.in("pipeline_id", f.pipelineIds);
  if (f.stageIds?.length) q = q.in("stage_id", f.stageIds);
  if (f.sourceIds?.length) q = q.in("crm_source_id", f.sourceIds);
  if (f.responsibleIds?.length) q = q.in("responsible_id", f.responsibleIds);
  if (f.companyIds?.length) q = q.in("company_id", f.companyIds);
  if (f.hasCompany === true) q = q.not("company_id", "is", null);
  if (f.hasCompany === false) q = q.is("company_id", null);
  if (typeof f.valueMin === "number") q = q.gte("value", f.valueMin);
  if (typeof f.valueMax === "number") q = q.lte("value", f.valueMax);
  if (f.createdFrom) q = q.gte("created_at", f.createdFrom);
  if (f.createdTo) q = q.lte("created_at", f.createdTo);
  if (f.updatedWithinDays) {
    const iso = new Date(Date.now() - f.updatedWithinDays * 86400_000).toISOString();
    q = q.gte("updated_at", iso);
  }
  if (f.hasEmail) q = q.not("email", "is", null);
  if (f.hasPhone) q = q.not("phone", "is", null);
  if (f.lastMessageFrom && f.lastMessageFrom !== "any") q = q.eq("last_message_from", f.lastMessageFrom);
  if (f.conversationStatus && f.conversationStatus !== "any") q = q.eq("conversation_status", f.conversationStatus);
  if (f.search?.trim()) q = q.ilike("name", `%${f.search.trim()}%`);
  if (f.tagsAny?.length) q = q.overlaps("tags", f.tagsAny);
  if (f.tagsAll?.length) q = q.contains("tags", f.tagsAll);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as LeadRow[];

  if (f.tagsNone?.length) {
    const bad = new Set(f.tagsNone.map((t) => t.toLowerCase()));
    rows = rows.filter((r) => !(Array.isArray(r.tags) && (r.tags as string[]).some((t) => bad.has(String(t).toLowerCase()))));
  }

  // "Sem mensagem há X dias" → updated_at anterior a hoje-X E aguardando resposta
  if (f.noMessageForDays) {
    const cutoff = Date.now() - f.noMessageForDays * 86400_000;
    rows = rows.filter((r) => new Date(r.updated_at).getTime() < cutoff);
  }

  // UTM / motivo perda / campos livres em custom_data
  const utmS = f.utmSource?.trim().toLowerCase();
  const utmM = f.utmMedium?.trim().toLowerCase();
  const utmC = f.utmCampaign?.trim().toLowerCase();
  const lostQ = f.lostReasonContains?.trim().toLowerCase();
  if (utmS || utmM || utmC || lostQ) {
    rows = rows.filter((r) => {
      const cd = (r.custom_data ?? {}) as Record<string, unknown>;
      const get = (k: string) => String(cd[k] ?? "").toLowerCase();
      if (utmS && !get("utm_source").includes(utmS)) return false;
      if (utmM && !get("utm_medium").includes(utmM)) return false;
      if (utmC && !get("utm_campaign").includes(utmC)) return false;
      if (lostQ && !get("lost_reason").includes(lostQ)) return false;
      return true;
    });
  }

  // Canal (crm_sources.provider IN ...)
  if (f.channelProviders?.length && rows.length) {
    const { data: srcs } = await sb.from("crm_sources")
      .select("id,provider").eq("workspace_id", wsId).in("provider", f.channelProviders);
    const allowedSrc = new Set(((srcs ?? []) as Array<{ id: string }>).map((s) => s.id));
    rows = rows.filter((r) => {
      const src = (r as unknown as { crm_source_id: string | null }).crm_source_id;
      return src ? allowedSrc.has(src) : false;
    });
  }

  // Produtos associados
  if (f.hasProducts !== undefined && rows.length) {
    const { data: lp } = await sb.from("lead_products")
      .select("lead_id").in("lead_id", rows.map((r) => r.id));
    const withProd = new Set(((lp ?? []) as Array<{ lead_id: string }>).map((x) => x.lead_id));
    rows = rows.filter((r) => (f.hasProducts ? withProd.has(r.id) : !withProd.has(r.id)));
  }

  // Estado de tarefas
  if (f.taskState && f.taskState !== "any" && rows.length) {
    const { data: tk } = await sb.from("tasks")
      .select("lead_id,status,end_at").in("lead_id", rows.map((r) => r.id));
    const byLead = new Map<string, Array<{ status: string; end_at: string }>>();
    for (const t of ((tk ?? []) as Array<{ lead_id: string; status: string; end_at: string }>)) {
      const arr = byLead.get(t.lead_id) ?? [];
      arr.push({ status: t.status, end_at: t.end_at });
      byLead.set(t.lead_id, arr);
    }
    const now = Date.now();
    rows = rows.filter((r) => {
      const ts = byLead.get(r.id) ?? [];
      switch (f.taskState) {
        case "none": return ts.length === 0;
        case "has_open": return ts.some((t) => t.status === "pendente");
        case "has_overdue": return ts.some((t) => t.status === "pendente" && new Date(t.end_at).getTime() < now);
        case "has_completed": return ts.some((t) => t.status === "concluida");
        default: return true;
      }
    });
  }



  // Custom-field rules (post-filter via lead_custom_field_values)
  if (f.customFields?.length && rows.length) {
    const leadIds = rows.map((r) => r.id);
    const fieldIds = Array.from(new Set(f.customFields.map((r) => r.fieldId)));
    const { data: vals } = await sb.from("lead_custom_field_values")
      .select("lead_id,field_id,value")
      .in("lead_id", leadIds)
      .in("field_id", fieldIds);
    const byLead = new Map<string, Map<string, string>>();
    for (const v of ((vals ?? []) as Array<{ lead_id: string; field_id: string; value: unknown }>)) {
      const disp = (v.value as { display?: string } | null)?.display ?? "";
      const m = byLead.get(v.lead_id) ?? new Map<string, string>();
      m.set(v.field_id, String(disp ?? ""));
      byLead.set(v.lead_id, m);
    }
    const rules = f.customFields;
    rows = rows.filter((r) => {
      const m = byLead.get(r.id);
      return rules.every((rule) => {
        const val = m?.get(rule.fieldId) ?? "";
        const has = val.trim().length > 0;
        const target = (rule.value ?? "").trim().toLowerCase();
        switch (rule.op) {
          case "exists": return has;
          case "empty": return !has;
          case "eq": return has && val.trim().toLowerCase() === target;
          case "neq": return val.trim().toLowerCase() !== target;
          case "contains": return has && val.toLowerCase().includes(target);
          default: return true;
        }
      });
    });
  }

  return rows;
}

