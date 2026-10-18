/**
 * Gerenciador de salvamento dos SalesBots.
 *
 * Regras que este módulo garante:
 *  - Debounce: agrupa alterações rápidas (digitação) num único envio.
 *  - Coalescência: envia sempre o estado MAIS RECENTE do bot.
 *  - Fila por bot: nunca há dois envios simultâneos do mesmo bot.
 *  - Nunca fica "salvando" para sempre: toda task tem prazo máximo e todo
 *    fluxo termina em "saved" ou "error" — jamais num limbo.
 *  - Falha não bloqueia a fila: a task vai para "pendências com falha" e pode
 *    ser reenviada com retrySalesbotSave().
 */

export type SalesbotSaveStatus = "idle" | "saving" | "saved" | "error";

type Task<T = unknown> = () => Promise<T>;

const DEBOUNCE_MS = 700;
const MAX_ATTEMPTS = 3;
/** Bots grandes levam vários segundos no servidor: prazo generoso, mas finito. */
const TASK_TIMEOUT_MS = 45_000;
const TASK_TIMEOUT_MESSAGE = "O salvamento demorou demais. Verifique a conexão e tente novamente.";

const pendingSyncs = new Map<string, Promise<unknown>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Última task pendente por bot (coalescida: só a mais nova importa). */
const latestTask = new Map<string, Task>();
/** Tasks que falharam e aguardam nova tentativa (não bloqueiam a fila). */
const failedTasks = new Map<string, Task>();

let status: SalesbotSaveStatus = "idle";
let lastError: string | null = null;
const listeners = new Set<(s: SalesbotSaveStatus, err: string | null) => void>();

function setStatus(next: SalesbotSaveStatus, err: string | null = null) {
  status = next;
  lastError = err;
  for (const l of listeners) l(status, lastError);
}

export function getSalesbotSaveStatus(): { status: SalesbotSaveStatus; error: string | null } {
  return { status, error: lastError };
}

export function subscribeSalesbotSaveStatus(
  listener: (s: SalesbotSaveStatus, err: string | null) => void,
): () => void {
  listeners.add(listener);
  listener(status, lastError);
  return () => listeners.delete(listener);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Uma requisição pode ficar pendente para sempre sem rejeitar; a fila
 * precisa recuperar o controle para informar a falha e liberar a UI. */
async function runWithTimeout<T>(task: Task<T>, ms = TASK_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(TASK_TIMEOUT_MESSAGE)), ms);
  });
  try {
    return await Promise.race([task(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function settleIdle() {
  if (latestTask.size === 0 && timers.size === 0 && pendingSyncs.size === 0) {
    setStatus(failedTasks.size > 0 ? "error" : "saved", failedTasks.size > 0 ? lastError : null);
  }
}

/** Executa a task mais recente do bot com retry; roda serialmente por bot. */
function runQueued(botId: string): Promise<void> {
  const previous = pendingSyncs.get(botId) ?? Promise.resolve();
  const job = previous.catch(() => undefined).then(async () => {
    for (;;) {
      const task = latestTask.get(botId);
      if (!task) return;
      latestTask.delete(botId);
      setStatus("saving");
      let attempt = 0;
      for (;;) {
        attempt += 1;
        try {
          await runWithTimeout(task);
          failedTasks.delete(botId);
          break;
        } catch (err) {
          if (attempt >= MAX_ATTEMPTS) {
            // Guarda para nova tentativa, mas NÃO deixa a fila presa nela.
            if (!latestTask.has(botId)) failedTasks.set(botId, task);
            setStatus("error", err instanceof Error ? err.message : "Falha ao salvar");
            return;
          }
          await sleep(400 * attempt);
        }
      }
    }
  });
  pendingSyncs.set(botId, job);
  const done = () => {
    if (pendingSyncs.get(botId) === job) pendingSyncs.delete(botId);
    settleIdle();
  };
  void job.then(done, done);
  return job;
}

/** Agenda o salvamento (com debounce). Substitui qualquer envio pendente. */
export function scheduleSalesbotSave(botId: string, task: Task): void {
  latestTask.set(botId, task);
  failedTasks.delete(botId);
  setStatus("saving");
  const existing = timers.get(botId);
  if (existing) clearTimeout(existing);
  timers.set(
    botId,
    setTimeout(() => {
      timers.delete(botId);
      void runQueued(botId).catch(() => undefined);
    }, DEBOUNCE_MS),
  );
}

/** Reenfileira imediatamente o que falhou (botão "Tentar novamente"). */
export function retrySalesbotSave(botId?: string): void {
  const ids = botId ? [botId] : [...failedTasks.keys()];
  for (const id of ids) {
    const task = failedTasks.get(id);
    if (!task) continue;
    failedTasks.delete(id);
    latestTask.set(id, task);
    setStatus("saving");
    void runQueued(id).catch(() => undefined);
  }
}

/** Envia imediatamente o que estiver pendente do bot e aguarda concluir. */
export async function flushSalesbotSave(botId: string): Promise<void> {
  const timer = timers.get(botId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(botId);
  }
  const failed = failedTasks.get(botId);
  if (failed && !latestTask.has(botId)) {
    failedTasks.delete(botId);
    latestTask.set(botId, failed);
  }
  if (latestTask.has(botId)) {
    await runQueued(botId).catch(() => undefined);
  }
  // Operações avulsas (duplicar/excluir) também não podem prender a UI.
  const inflight = pendingSyncs.get(botId);
  if (inflight) {
    await runWithTimeout(() => inflight as Promise<unknown>).catch(() => undefined);
  }
}

/** Envia e aguarda TODOS os bots com alterações pendentes. */
export async function flushAllSalesbotSaves(): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    const ids = new Set<string>([
      ...timers.keys(),
      ...latestTask.keys(),
      ...failedTasks.keys(),
      ...pendingSyncs.keys(),
    ]);
    if (ids.size === 0) break;
    await Promise.all([...ids].map((id) => flushSalesbotSave(id)));
    if (!hasPendingSalesbotSaves() && failedTasks.size === 0) break;
    if (failedTasks.size > 0) break; // falha real: não adianta girar em círculo
  }
  settleIdle();
}

export function hasPendingSalesbotSaves(): boolean {
  return timers.size > 0 || latestTask.size > 0 || pendingSyncs.size > 0;
}

export function hasFailedSalesbotSaves(): boolean {
  return failedTasks.size > 0;
}

/** Compat: aguarda o bot terminar de salvar (inclui debounce pendente). */
export async function waitForSalesbotSync(botId: string): Promise<void> {
  await flushSalesbotSave(botId);
}

/** Descarta qualquer trabalho pendente do bot (usado após excluir). */
export function clearSalesbotSync(botId: string): void {
  const timer = timers.get(botId);
  if (timer) clearTimeout(timer);
  timers.delete(botId);
  latestTask.delete(botId);
  failedTasks.delete(botId);
  pendingSyncs.delete(botId);
  if (!hasPendingSalesbotSaves() && status === "saving") setStatus("idle");
}

/** Enfileira uma operação única (ex.: exclusão) respeitando a ordem do bot. */
export function enqueueSalesbotSync<T>(botId: string, task: () => Promise<T>): Promise<T> {
  const previous = pendingSyncs.get(botId) ?? Promise.resolve();
  const job = previous.catch(() => undefined).then(() => runWithTimeout(task));
  pendingSyncs.set(botId, job);
  const done = () => {
    if (pendingSyncs.get(botId) === job) pendingSyncs.delete(botId);
    settleIdle();
  };
  void job.then(done, done);
  return job;
}
