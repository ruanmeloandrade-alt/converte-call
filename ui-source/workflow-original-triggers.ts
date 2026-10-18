// Original Saúde Slim time trigger evaluator; only export visibility adapted.
type Params = Record<string, string | number | boolean | null | undefined>;
type Trigger = { event: string; params?: Params };
type Action = { type: string; params?: Params };
type Automation = {
  id: string;
  workspace_id: string;
  pipeline_id: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  actions: Action[];
};
type Task = {
  id: string;
  workspace_id: string;
  pipeline_id: string;
  stage_id: string;
  assignee_id: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  tags: string[] | null;
  time_spent_seconds: number;
  estimated_seconds: number | null;
  updated_at: string;
  automation_state: Record<string, string> | null;
  created_by?: string | null;

};

const now = () => new Date();
const iso = (d: Date) => d.toISOString();

/** Comentários/ações automáticas precisam de um autor real (author_id é NOT NULL). */
export function matchesTimeTrigger(t: Task, a: Automation, stageCount?: Map<string, number>): boolean {
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
      return due > nowMs && due - nowMs <= hours * 3600 * 1000;
    }
    case "task_timer_exceeded": {
      const thresholdSec = p.seconds
        ? Number(p.seconds)
        : t.estimated_seconds
        ? Number(t.estimated_seconds)
        : 0;
      if (!thresholdSec) return false;
      return Number(t.time_spent_seconds) >= thresholdSec;
    }
    case "task_stalled_in_stage": {
      const hours = Number(p.hours ?? 24);
      const last = new Date(t.updated_at).getTime();
      return nowMs - last >= hours * 3600 * 1000;
    }
    case "high_priority_untouched": {
      // Prioridade alta/urgente sem trabalho iniciado por N horas
      const priorities = ["alta", "urgente"];
      if (!priorities.includes(t.priority)) return false;
      if (Number(t.time_spent_seconds) > 0) return false;
      const hours = Number(p.hours ?? 2);
      const created = new Date(t.updated_at).getTime();
      return nowMs - created >= hours * 3600 * 1000;
    }
    case "task_no_progress": {
      // Sem update algum por N horas (mesmo que time_spent > 0)
      const hours = Number(p.hours ?? 8);
      const last = new Date(t.updated_at).getTime();
      return nowMs - last >= hours * 3600 * 1000;
    }
    case "task_over_estimate_percent": {
      // time_spent passou X% do estimated
      if (!t.estimated_seconds) return false;
      const pct = Number(p.percent ?? 100);
      return Number(t.time_spent_seconds) >= (Number(t.estimated_seconds) * pct) / 100;
    }
    case "stage_wip_exceeded": {
      // Etapa tem mais que N tarefas ativas
      if (!stageCount) return false;
      const limit = Number(p.limit ?? 5);
      const stageId = String(p.stageId ?? t.stage_id);
      if (stageId !== t.stage_id) return false;
      return (stageCount.get(t.stage_id) ?? 0) > limit;
    }
  }
  return false;
}
