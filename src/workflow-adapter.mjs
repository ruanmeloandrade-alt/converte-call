// ui-source/workflow-original-triggers.ts
function matchesTimeTrigger(t, a, stageCount) {
  const p = a.trigger.params ?? {};
  const nowMs = Date.now();
  switch (a.trigger.event) {
    case "task_overdue": {
      if (!t.due_at) return false;
      return new Date(t.due_at).getTime() < nowMs;
    }
    case "task_near_due": {
      if (!t.due_at) return false;
      const hours = Number(p.hoursBefore ?? 2);
      const due = new Date(t.due_at).getTime();
      return due > nowMs && due - nowMs <= hours * 3600 * 1e3;
    }
    case "task_timer_exceeded": {
      const thresholdSec = p.seconds ? Number(p.seconds) : t.estimated_seconds ? Number(t.estimated_seconds) : 0;
      if (!thresholdSec) return false;
      return Number(t.time_spent_seconds) >= thresholdSec;
    }
    case "task_stalled_in_stage": {
      const hours = Number(p.hours ?? 24);
      const last = new Date(t.updated_at).getTime();
      return nowMs - last >= hours * 3600 * 1e3;
    }
    case "high_priority_untouched": {
      const priorities = ["alta", "urgente"];
      if (!priorities.includes(t.priority)) return false;
      if (Number(t.time_spent_seconds) > 0) return false;
      const hours = Number(p.hours ?? 2);
      const created = new Date(t.updated_at).getTime();
      return nowMs - created >= hours * 3600 * 1e3;
    }
    case "task_no_progress": {
      const hours = Number(p.hours ?? 8);
      const last = new Date(t.updated_at).getTime();
      return nowMs - last >= hours * 3600 * 1e3;
    }
    case "task_over_estimate_percent": {
      if (!t.estimated_seconds) return false;
      const pct = Number(p.percent ?? 100);
      return Number(t.time_spent_seconds) >= Number(t.estimated_seconds) * pct / 100;
    }
    case "stage_wip_exceeded": {
      if (!stageCount) return false;
      const limit = Number(p.limit ?? 5);
      const stageId = String(p.stageId ?? t.stage_id);
      if (stageId !== t.stage_id) return false;
      return (stageCount.get(t.stage_id) ?? 0) > limit;
    }
  }
  return false;
}

// ui-source/workflow-repository.ts
var now = () => (/* @__PURE__ */ new Date()).toISOString();
var id = () => crypto.randomUUID();
var ok = { ok: true };
function taskRow(t) {
  return { ...t, stageId: t.column, priority: t.priority || "media", dueAt: t.due || null, assigneeId: t.assigneeId || null, assigneeName: t.assigneeName || null, status: { completed: "concluida", incomplete: "incompleta", review: "em_revisao" }[t.status] || "ativa", timeSpentSeconds: t.timeSpentSeconds || 0, position: t.position || 0, checklistDone: (t.checklist || []).filter((c) => c.done).length, checklistTotal: t.checklist?.length || 0, commentsCount: t.comments?.length || 0, activeSessionSince: t.timerStarted || null, reviewStatus: t.reviewStatus || null, reviewNotes: t.reviewNotes || null, isReviewCopy: false, reviewCopyOf: null, reviewOutcome: t.reviewOutcome || null, reviewRound: t.reviewRound || 0, tags: t.tags || [] };
}
function workflowTick(d, Core, event, targetId, time = Date.now()) {
  d.workflowAutomations ||= [];
  d.workflowAutomationRuns ||= [];
  const notices = [];
  for (const task of [...d.tasks]) for (const rule of d.workflowAutomations.filter((r) => r.enabled && r.pipelineId === task.projectId)) {
    const trigger = rule.trigger?.event, p = rule.trigger?.params || {}, seconds = (task.timeSpentSeconds || 0) + (task.timerStarted ? (time - Date.parse(task.timerStarted)) / 1e3 : 0), due = Date.parse(task.due || ""), age = (time - Date.parse(task.enteredAt || task.createdAt || now())) / 36e5, updated = (time - Date.parse(task.updatedAt || task.createdAt || now())) / 36e5;
    let hit = event ? targetId === task.id && trigger === event : matchesTimeTrigger({ ...task, due_at: task.due, updated_at: task.updatedAt || task.enteredAt || task.createdAt, stage_id: task.column, estimated_seconds: task.estimatedSeconds, time_spent_seconds: seconds }, rule, new Map(d.projects.flatMap((project) => project.columns.map((column) => [column.id, d.tasks.filter((t) => t.column === column.id && t.status !== "completed").length]))));
    if (p.stageId && p.stageId !== task.column) hit = false;
    if (!hit) continue;
    const key = [rule.id, task.id, trigger, task.enteredAt, rule.updatedAt].join(":");
    if (d.workflowAutomationRuns.some((r) => r.key === key)) continue;
    const run = { id: id(), key, automationId: rule.id, taskId: task.id, event: trigger, status: "ok", createdAt: now(), pipelineId: task.projectId };
    try {
      for (const action of rule.actions || []) {
        const a = action.params || {};
        switch (action.type) {
          case "move_to_stage": {
            const project = d.projects.find((p2) => p2.id === task.projectId);
            if (!project?.columns.some((c) => c.id === a.stageId)) throw Error("Etapa removida.");
            task.column = a.stageId;
            task.enteredAt = now();
            break;
          }
          case "set_priority":
            task.priority = a.priority;
            break;
          case "escalate_priority": {
            const ranks = ["baixa", "media", "alta", "urgente"];
            task.priority = ranks[Math.min(3, Math.max(0, ranks.indexOf(task.priority)) + 1)];
            break;
          }
          case "assign_to_user":
            if (!(d.members || []).some((m) => m.id === a.userId)) throw Error("Respons\xE1vel indispon\xEDvel.");
            task.assigneeId = a.userId;
            break;
          case "remove_assignee":
            task.assigneeId = null;
            break;
          case "reassign_round_robin": {
            const members = d.members || [];
            if (!members.length) throw Error("Cadastre usu\xE1rios na equipe.");
            task.assigneeId = members[(members.findIndex((m) => m.id === task.assigneeId) + 1) % members.length].id;
            break;
          }
          case "reassign_to_manager": {
            const project = d.projects.find((p2) => p2.id === task.projectId), sector = (d.workflowSectors || []).find((s) => s.id === project?.sectorId);
            if (!sector?.managerId) throw Error("Configure o gestor do setor.");
            task.assigneeId = sector.managerId;
            break;
          }
          case "add_tag":
            task.tags = [...new Set([...task.tags || [], String(a.tag || a.text || "")].filter(Boolean))];
            break;
          case "extend_due":
            task.due = new Date((due || time) + Number(a.hours || 24) * 36e5).toISOString();
            break;
          case "add_comment":
          case "notify_assignee":
            task.comments ||= [];
            task.comments.push({ id: id(), body: String(a.body || a.message || a.text || rule.name), createdAt: now(), authorName: "Automa\xE7\xE3o" });
            if (action.type === "notify_assignee") notices.push({ title: rule.name, text: task.title, key: "workflow:" + run.id });
            break;
          case "create_child_task":
            d.tasks.push({ id: id(), projectId: task.projectId, column: a.stageId || task.column, title: String(a.title || "Subtarefa de " + task.title), body: String(a.description || ""), lead: task.lead || "", status: "open", priority: task.priority, createdAt: now(), enteredAt: now(), parentId: task.id });
            break;
          default:
            throw Error("A\xE7\xE3o n\xE3o suportada: " + action.type);
        }
      }
    } catch (error) {
      run.status = "error";
      run.error = error.message;
    }
    d.workflowAutomationRuns.push(run);
  }
  d.workflowAutomationRuns = d.workflowAutomationRuns.slice(-2e3);
  return notices;
}
function workflowRPC(d, name, p, Core) {
  d.workflowAutomations ||= [];
  d.workflowSectors ||= [];
  let changed = false, result = ok, event = "", eventId = "";
  const task = () => {
    const t = d.tasks.find((t2) => t2.id === (p.id || p.taskId));
    if (!t) throw Error("Cart\xE3o n\xE3o encontrado.");
    return t;
  }, project = () => {
    const project2 = d.projects.find((x) => x.id === (p.pipelineId || d.activeProjectId)) || d.projects[0];
    if (!project2) throw Error("Crie um projeto primeiro.");
    return project2;
  };
  switch (name) {
    case "getWorkflowBoard": {
      const board = project();
      result = { pipelineId: board.id, pipelineName: board.name, sectorId: board.sectorId || null, sectorName: null, stages: board.columns.map((c, i) => ({ ...c, position: i, isDoneStage: !!c.isDoneStage, isIncompleteStage: !!c.isIncompleteStage, isReviewStage: !!c.isReviewStage })), tasks: d.tasks.filter((t) => t.projectId === board.id).map(taskRow), members: d.members || [], canManage: true, currentUserActiveSession: d.tasks.some((t) => t.timerStarted) ? { taskId: d.tasks.find((t) => t.timerStarted).id, startedAt: d.tasks.find((t) => t.timerStarted).timerStarted } : null, pipelines: d.projects.map((p2) => ({ ...p2, color: p2.color || null, sectorId: p2.sectorId || null, sectorName: null, sectorColor: null, isDefault: p2.id === d.activeProjectId, memberIds: p2.memberIds || [] })) };
      break;
    }
    case "createPipeline": {
      const item = { id: id(), name: p.name, color: p.color || "#7960db", sectorId: p.sectorId || null, columns: Core.defaultProjectColumns ? Core.defaultProjectColumns() : ["A fazer", "Em andamento", "Conclu\xEDdo"].map((name2, i) => ({ id: id(), name: name2, color: ["#a5a0b5", "#9778db", "#56ad98"][i], isDoneStage: i === 2 })), createdAt: now(), status: "active" };
      d.projects.push(item);
      result = { id: item.id };
      changed = true;
      break;
    }
    case "updatePipeline": {
      const found = d.projects.find((x) => x.id === p.id);
      if (!found) throw Error("Projeto n\xE3o encontrado.");
      for (const k of ["name", "color", "sectorId", "memberIds"]) if (p[k] !== void 0) found[k] = p[k];
      changed = true;
      break;
    }
    case "deletePipeline":
      d.projects = d.projects.filter((x) => x.id !== p.id);
      d.tasks = d.tasks.filter((t) => t.projectId !== p.id);
      changed = true;
      break;
    case "createStage": {
      const row = { id: id(), name: p.name, color: p.color || "#9778db", isDoneStage: !!p.isDoneStage, isIncompleteStage: !!p.isIncompleteStage, isReviewStage: !!p.isReviewStage };
      project().columns.push(row);
      result = { id: row.id };
      changed = true;
      break;
    }
    case "updateStage":
    case "deleteStage": {
      const proj = d.projects.find((x) => x.columns.some((c) => c.id === p.id));
      if (!proj) throw Error("Coluna n\xE3o encontrada.");
      if (name === "deleteStage") {
        if (d.tasks.some((t) => t.column === p.id)) throw Error("Mova os cart\xF5es antes de excluir a coluna.");
        proj.columns = proj.columns.filter((c) => c.id !== p.id);
      } else Object.assign(proj.columns.find((c) => c.id === p.id), p);
      changed = true;
      break;
    }
    case "reorderStages":
      for (const proj of d.projects) proj.columns.sort((a, b) => p.order.indexOf(a.id) - p.order.indexOf(b.id));
      changed = true;
      break;
    case "createTask": {
      const proj = project(), row = { ...p, id: id(), projectId: proj.id, column: p.stageId || proj.columns[0]?.id, title: String(p.title || "").trim(), body: p.description || "", due: p.dueAt || null, status: "open", createdAt: now(), enteredAt: now(), updatedAt: now(), checklist: [], comments: [] };
      if (!row.title || !row.column) throw Error("Informe t\xEDtulo e coluna.");
      d.tasks.push(row);
      result = { id: row.id };
      changed = true;
      event = "task_created";
      eventId = row.id;
      break;
    }
    case "updateTask": {
      const t = task();
      Object.assign(t, p);
      if (p.description !== void 0) t.body = p.description;
      if (p.dueAt !== void 0) t.due = p.dueAt;
      t.updatedAt = now();
      changed = true;
      break;
    }
    case "moveTask": {
      const t = task(), proj = d.projects.find((x) => x.id === t.projectId);
      if (!proj?.columns.some((c) => c.id === p.stageId)) throw Error("Coluna n\xE3o encontrada neste projeto.");
      t.column = p.stageId;
      t.position = p.position || 0;
      t.enteredAt = now();
      t.updatedAt = now();
      changed = true;
      event = "task_moved_to_stage";
      eventId = t.id;
      break;
    }
    case "deleteTask":
      d.tasks = d.tasks.filter((t) => t.id !== p.id);
      changed = true;
      break;
    case "startTaskTimer": {
      const t = task();
      if (d.tasks.some((x) => x.timerStarted && x.id !== t.id)) throw Error("Pause o cron\xF4metro atual primeiro.");
      t.timerStarted ||= now();
      t.updatedAt = now();
      changed = true;
      break;
    }
    case "stopTaskTimer": {
      const t = task();
      if (t.timerStarted) {
        t.timeSpentSeconds = (t.timeSpentSeconds || 0) + Math.floor((Date.now() - Date.parse(t.timerStarted)) / 1e3);
        t.sessions ||= [];
        t.sessions.push({ id: id(), startedAt: t.timerStarted, endedAt: now(), durationSeconds: Math.floor((Date.now() - Date.parse(t.timerStarted)) / 1e3), userName: "Usu\xE1rio" });
        t.timerStarted = null;
      }
      changed = true;
      break;
    }
    case "completeTask":
    case "markTaskIncomplete":
    case "reopenTask":
    case "submitTaskForReview":
    case "approveTaskReview":
    case "returnTaskReview": {
      const t = task();
      t.status = name === "completeTask" || name === "approveTaskReview" ? "completed" : name === "markTaskIncomplete" ? "incomplete" : name === "submitTaskForReview" ? "review" : "open";
      t.reviewNotes = p.reason || p.note || p.notes || "";
      t.reviewStatus = name === "approveTaskReview" ? "approved" : name === "returnTaskReview" ? "returned" : name === "submitTaskForReview" ? "pending" : null;
      if (p.stageId) t.column = p.stageId;
      t.updatedAt = now();
      event = { completeTask: "task_completed", markTaskIncomplete: "task_marked_incomplete", approveTaskReview: "task_review_approved", returnTaskReview: "task_review_returned" }[name];
      eventId = t.id;
      changed = true;
      break;
    }
    case "getTaskDetail": {
      const t = task();
      result = { task: { ...t, stage_id: t.column, pipeline_id: t.projectId, description: t.body || "", due_at: t.due || null, assignee_id: t.assigneeId || null, estimated_seconds: t.estimatedSeconds || null, credentials: t.credentials || [], links: t.links || [], tags: t.tags || [] }, checklist: t.checklist || [], comments: t.comments || [], sessions: t.sessions || [] };
      break;
    }
    case "addChecklistItem": {
      const t = task();
      t.checklist ||= [];
      t.checklist.push({ id: id(), text: p.text, done: false, position: t.checklist.length });
      changed = true;
      break;
    }
    case "toggleChecklistItem":
    case "deleteChecklistItem": {
      const t = d.tasks.find((t2) => (t2.checklist || []).some((c) => c.id === p.id));
      if (!t) throw Error("Item n\xE3o encontrado.");
      if (name === "deleteChecklistItem") t.checklist = t.checklist.filter((c) => c.id !== p.id);
      else t.checklist.find((c) => c.id === p.id).done = !!p.done;
      changed = true;
      break;
    }
    case "addComment": {
      const t = task();
      t.comments ||= [];
      t.comments.push({ id: id(), body: p.body, createdAt: now(), authorName: "Usu\xE1rio" });
      t.updatedAt = now();
      changed = true;
      break;
    }
    case "getReviewSettings":
      result = { mode: d.workflowReviewMode || "admin" };
      break;
    case "setReviewSettings":
      d.workflowReviewMode = p.mode;
      changed = true;
      break;
    case "listPendingReviews":
      result = d.tasks.filter((t) => t.status === "review").map(taskRow);
      break;
    case "searchTaskHistory":
      result = d.tasks.filter((t) => t.title.toLowerCase().includes(String(p.search || p.query || "").toLowerCase())).map(taskRow);
      break;
    case "listSectors":
      result = d.workflowSectors;
      break;
    case "saveSector": {
      const row = { ...p, id: p.id || id() };
      const old = d.workflowSectors.find((x) => x.id === row.id);
      if (old) Object.assign(old, row);
      else d.workflowSectors.push(row);
      result = { id: row.id };
      changed = true;
      break;
    }
    case "deleteSector":
      d.workflowSectors = d.workflowSectors.filter((x) => x.id !== p.id);
      changed = true;
      break;
    case "listAutomations":
      result = d.workflowAutomations.filter((r) => r.pipelineId === p.pipelineId);
      break;
    case "saveAutomation": {
      if (!p.name || !p.trigger?.event || !Array.isArray(p.actions) || !p.actions.length) throw Error("Configure o nome, gatilho e a\xE7\xF5es.");
      const row = { ...p, id: p.id || id(), updatedAt: now() }, old = d.workflowAutomations.find((r) => r.id === row.id);
      if (old) Object.assign(old, row);
      else d.workflowAutomations.push(row);
      result = { id: row.id };
      changed = true;
      break;
    }
    case "deleteAutomation":
      d.workflowAutomations = d.workflowAutomations.filter((r) => r.id !== p.id);
      changed = true;
      break;
    case "listAutomationRuns":
      result = (d.workflowAutomationRuns || []).filter((r) => r.pipelineId === p.pipelineId).slice(-30).reverse();
      break;
    case "getWorkflowMetrics":
      result = { periodStart: p.from || "", periodEnd: p.to || now(), byUser: (d.members || []).map((m) => ({ userId: m.id, name: m.name, totalSeconds: d.tasks.filter((t) => t.assigneeId === m.id).reduce((n, t) => n + (t.timeSpentSeconds || 0), 0), done: d.tasks.filter((t) => t.assigneeId === m.id && t.status === "completed").length, incomplete: d.tasks.filter((t) => t.assigneeId === m.id && t.status === "incomplete").length })) };
      break;
    case "listNotifications":
      result = d.notifications || [];
      break;
    case "markNotificationRead": {
      const n = d.notifications?.find((n2) => n2.id === p.id);
      if (n) n.read = true;
      changed = true;
      break;
    }
    default:
      throw Error("Opera\xE7\xE3o de projetos n\xE3o implementada: " + name);
  }
  if (changed && event) for (const notice of workflowTick(d, Core, event, eventId)) d.notifications.push({ id: id(), category: "automation", at: now(), read: false, title: notice.title, message: notice.text, key: notice.key, view: "projects" });
  const active = d.projects.find((x) => x.id === d.activeProjectId);
  if (active) d.projectColumns = active.columns;
  return { result, changed };
}
export {
  workflowRPC,
  workflowTick
};
