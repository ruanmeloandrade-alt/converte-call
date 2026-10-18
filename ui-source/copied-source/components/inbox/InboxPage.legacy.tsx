import { useMemo, useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  Plus,
  Smile,
  SmilePlus,
  Paperclip,
  Mic,
  Phone,
  User,
  MoreVertical,
  ArrowLeft,
  CheckCheck,
  Send,
  Users as UsersIcon,
  MessageCircle,
  LifeBuoy,
  ExternalLink,
  CheckCircle2,
  Tag,
  UserPlus,
  Tags,
  PanelLeftClose,
  PanelLeftOpen,
  Image as ImageIcon,
  Bot,
  Code2,
  Play,
  Pause,
  Download,
  X,
  FileText,
  Trash2,
  Pencil,
  Check,
  Languages,
  Loader2,
  AlertCircle,
  Sparkles,
  Wand2,
  Zap,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listLeadConversations,
  getInboxBootstrap,
  checkInboxHealth,
  sendLeadMessage,
  sendLeadMedia,
  getLeadDetail,
  listLeadActivities,
  markLeadConversationRead,
  syncWhatsAppInbox,
  sendLeadReaction,
  resolveLeadMessageMedia,
  deleteLeadMessage,
  transcribeLeadAudio,
  type LeadDetailResponse,
} from "@/lib/leads.functions";
import { refinePostBriefing } from "@/lib/social-wave4.functions";
import { streamImage } from "@/lib/social-stream";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CreateGroupFromLeadDialog } from "@/components/inbox/CreateGroupFromLeadDialog";
import {
  listInboxGroupConversations,
  listInboxGroupMessages,
  sendGroupMessage,
  sendGroupMedia,
} from "@/lib/whatsapp-groups.functions";
import { listCompanies } from "@/lib/companies.functions";
import {
  INBOX_HOT_RETENTION_MS,
  cleanupInboxCacheScope,
  clearInboxCacheScope,
  clearInboxCacheUser,
  deltaCursorWithOverlap,
  readInboxColdPage,
  readInboxConversationSnapshot,
  readInboxHotSnapshot,
  writeInboxColdPage,
  writeInboxConversationSnapshot,
  writeInboxHotSnapshot,
  mergeInboxHotItems,
  latestInboxCheckpoint,
  type InboxCacheScope,
} from "@/lib/inbox-cache";
import {
  listInboxLabels,
  upsertInboxLabel,
  deleteInboxLabel,
  toggleLabelAssignment,
} from "@/lib/inbox-labels.functions";
import {
  type ChatChannel,
  type ChatConversation,
  type ChatMessage,
  chatDayLabel,
  chatPreviewTime,
  chatTime,
  getChannelConversations,
  getConversation,
  initials,
} from "@/lib/inbox-mock";
import { LeadProfilePanel } from "./LeadProfilePanel";
import {
  listForms,
  buildFormShareUrl,
  renderFormMessage,
  DEFAULT_FORM_MESSAGE_TEMPLATE,
  type FormRecord,
} from "@/lib/forms.functions";


/* ---------- Papel de parede do chat ---------- */
type ChatWallpaper = "dots" | "plain" | "grid" | "lines" | "waves";
const WALLPAPER_STORAGE_KEY = "Saúde Slim:chat-wallpaper";
const WALLPAPER_OPTIONS: { value: ChatWallpaper; label: string }[] = [
  { value: "dots", label: "Pontinhos" },
  { value: "plain", label: "Liso" },
  { value: "grid", label: "Grade" },
  { value: "lines", label: "Linhas" },
  { value: "waves", label: "Ondas" },
];
function useChatWallpaper() {
  const [wallpaper, setWallpaperState] = useState<ChatWallpaper>("dots");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WALLPAPER_STORAGE_KEY) as ChatWallpaper | null;
      if (saved && WALLPAPER_OPTIONS.some((o) => o.value === saved)) setWallpaperState(saved);
    } catch {
      /* ignore */
    }
    const onChange = () => {
      try {
        const saved = localStorage.getItem(WALLPAPER_STORAGE_KEY) as ChatWallpaper | null;
        if (saved && WALLPAPER_OPTIONS.some((o) => o.value === saved)) setWallpaperState(saved);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("Saúde Slim:chat-wallpaper-changed", onChange);
    return () => window.removeEventListener("Saúde Slim:chat-wallpaper-changed", onChange);
  }, []);
  const setWallpaper = (w: ChatWallpaper) => {
    setWallpaperState(w);
    try {
      localStorage.setItem(WALLPAPER_STORAGE_KEY, w);
      window.dispatchEvent(new Event("Saúde Slim:chat-wallpaper-changed"));
    } catch {
      /* ignore */
    }
  };
  return { wallpaper, setWallpaper };
}

interface InboxPageProps {
  channel: ChatChannel;
  selectedId?: string;
}

const CHANNEL_META: Record<
  ChatChannel,
  {
    title: string;
    subtitle: string;
    tabs: string[];
    icon: typeof MessageCircle;
  }
> = {
  leads: {
    title: "Inbox dos leads",
    subtitle: "Atendimento, vendas e follow-up",
    tabs: [
      "Todas",
      "Não lidas",
      "Aguardando",
      "Fechadas",
      "Favoritas",
      "Grupos",
      "Etiquetas",
      "Empresa",
      "Produtos",
    ],
    icon: MessageCircle,
  },
  equipe: {
    title: "Chat da equipe",
    subtitle: "Conversas internas do time Saúde Slim",
    tabs: ["Todas", "Não lidas", "Canais", "Diretas"],
    icon: UsersIcon,
  },
  suporte: {
    title: "Chat suporte",
    subtitle: "Tickets dos clientes do Saúde Slim",
    tabs: ["Abertos", "Aguardando", "Resolvidos", "Todos"],
    icon: LifeBuoy,
  },
};

interface InboxLabel {
  id: string;
  name: string;
  color: string;
}

interface InboxLabelGroup {
  id: string;
  name: string;
  labels: InboxLabel[];
}



const inboxBackfillScheduledByWorkspace = new Set<string>();

function realtimeMessagePreview(payload: Record<string, unknown> | null, type: string): string {
  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  if (text) return text;
  const mediaType = String(payload?.media_type ?? "").toLowerCase();
  if (mediaType.includes("image")) return "Imagem";
  if (mediaType.includes("video")) return "Vídeo";
  if (mediaType.includes("audio")) return "Áudio";
  if (mediaType.includes("document")) return "Documento";
  if (mediaType.includes("sticker")) return "Figurinha";
  return type === "note" ? "Nota" : "Mensagem";
}

export function InboxPage({ channel, selectedId }: InboxPageProps) {
  const queryClientTop = useQueryClient();
  const [cacheScope, setCacheScope] = useState<InboxCacheScope | null>(null);
  const [cachedConversations, setCachedConversations] = useState<ChatConversation[]>([]);
  const [conversationCacheReady, setConversationCacheReady] = useState(channel !== "leads");
  const [workspaceResolutionError, setWorkspaceResolutionError] = useState<string | null>(null);
  const [selfRecoveryActive, setSelfRecoveryActive] = useState(false);
  const autoRecoveryAttemptedRef = useRef<Set<string>>(new Set());
  const workspaceId = cacheScope?.workspaceId ?? null;
  const loadInboxBootstrap = useServerFn(getInboxBootstrap);
  const loadInboxHealth = useServerFn(checkInboxHealth);
  const inboxBootstrapQuery = useQuery({
    queryKey: ["inbox", "bootstrap"],
    queryFn: () => loadInboxBootstrap({ data: { limit: 40 } }),
    enabled: channel === "leads",
    staleTime: 30_000,
    gcTime: 15 * 60_000,
    retry: 2,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });

  useEffect(() => {
    if (channel !== "leads") return;
    const bootstrap = inboxBootstrapQuery.data;
    if (!bootstrap) return;

    const nextScope: InboxCacheScope = {
      userId: bootstrap.userId,
      workspaceId: bootstrap.workspaceId,
    };
    const scopeChanged =
      cacheScope?.userId !== nextScope.userId || cacheScope?.workspaceId !== nextScope.workspaceId;
    const bootstrapLeadQueryKey = [
      "inbox",
      "lead-conversations",
      nextScope.userId,
      nextScope.workspaceId,
    ] as const;

    queryClientTop.setQueryData(bootstrapLeadQueryKey, (current: any) => {
      const fresh = bootstrap.leadPage;
      if (!current?.pages?.length) {
        return { pages: [fresh], pageParams: [null] };
      }
      const freshIds = new Set(fresh.conversations.map((conversation) => conversation.id));
      const pages = current.pages.map((page: any) => ({
        ...page,
        conversations: (page.conversations ?? []).filter(
          (conversation: { id: string }) => !freshIds.has(conversation.id),
        ),
      }));
      pages[0] = {
        ...pages[0],
        ...fresh,
        conversations: [...fresh.conversations, ...(pages[0]?.conversations ?? [])],
      };
      return { ...current, pages };
    });

    setWorkspaceResolutionError(null);
    if (scopeChanged) {
      setCachedConversations([]);
      setConversationCacheReady(false);
    }
    setCacheScope(nextScope);
  }, [
    channel,
    inboxBootstrapQuery.data,
    cacheScope?.userId,
    cacheScope?.workspaceId,
    queryClientTop,
  ]);

  useEffect(() => {
    if (channel !== "leads" || !inboxBootstrapQuery.isError) return;
    console.error("[Inbox] Falha no bootstrap canônico", inboxBootstrapQuery.error);
    setConversationCacheReady(true);
    setWorkspaceResolutionError("Não foi possível carregar o Inbox desta conta.");
  }, [channel, inboxBootstrapQuery.isError, inboxBootstrapQuery.error]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if ((event === "TOKEN_REFRESHED" || event === "SIGNED_IN") && channel === "leads") {
        void inboxBootstrapQuery.refetch();
      }
      if (event !== "SIGNED_OUT") return;
      const previousScope = cacheScope;
      setCacheScope(null);
      setCachedConversations([]);
      setConversationCacheReady(true);
      setWorkspaceResolutionError(null);
      queryClientTop.removeQueries({ queryKey: ["inbox"] });
      queryClientTop.removeQueries({ queryKey: ["companies-list"] });
      if (previousScope) void clearInboxCacheUser(previousScope.userId);
    });
    return () => subscription.unsubscribe();
  }, [cacheScope, channel, inboxBootstrapQuery.refetch, queryClientTop]);

  useEffect(() => {
    if (channel !== "leads") {
      setCachedConversations([]);
      setConversationCacheReady(true);
      return;
    }
    if (!cacheScope) return;

    let cancelled = false;
    setConversationCacheReady(false);
    Promise.all([
      readInboxConversationSnapshot<ChatConversation>(cacheScope, "leads"),
      cleanupInboxCacheScope(cacheScope),
    ])
      .then(([snapshot]) => {
        if (cancelled) return;
        setCachedConversations(snapshot ?? []);
        setConversationCacheReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setCachedConversations([]);
        setConversationCacheReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [channel, cacheScope?.userId, cacheScope?.workspaceId]);

  const meta = CHANNEL_META[channel];
  const loadLeadConvs = useServerFn(listLeadConversations);
  const loadGroupConvs = useServerFn(listInboxGroupConversations);
  const syncWaInbox = useServerFn(syncWhatsAppInbox);
  const leadConversationQueryKey = [
    "inbox",
    "lead-conversations",
    cacheScope?.userId,
    cacheScope?.workspaceId,
  ] as const;
  const groupConversationQueryKey = [
    "inbox",
    "group-conversations",
    cacheScope?.userId,
    cacheScope?.workspaceId,
  ] as const;

  const leadConvsQuery = useInfiniteQuery({
    queryKey: leadConversationQueryKey,
    queryFn: ({ pageParam }) =>
      loadLeadConvs({
        data: {
          cursor: pageParam ?? undefined,
          limit: 40,
        },
      }),
    initialPageParam: null as { updatedAt: string; id: string } | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: channel === "leads" && conversationCacheReady && Boolean(cacheScope),
    staleTime: 2 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });

  const groupConvsQuery = useInfiniteQuery({
    queryKey: groupConversationQueryKey,
    queryFn: ({ pageParam }) =>
      loadGroupConvs({
        data: {
          cursor: pageParam ?? undefined,
          limit: 40,
        },
      }),
    initialPageParam: null as { lastMessageAt: string; key: string } | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: channel === "leads" && conversationCacheReady && Boolean(cacheScope),
    staleTime: 2 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });

  const mergeLeadHead = (fresh: Awaited<ReturnType<typeof loadLeadConvs>>) => {
    queryClientTop.setQueryData(leadConversationQueryKey, (current: any) => {
      if (!current?.pages?.length) {
        return { pages: [fresh], pageParams: [null] };
      }
      const freshIds = new Set(fresh.conversations.map((conversation) => conversation.id));
      const pages = current.pages.map((page: any) => ({
        ...page,
        conversations: (page.conversations ?? []).filter(
          (conversation: { id: string }) => !freshIds.has(conversation.id),
        ),
      }));
      pages[0] = {
        ...pages[0],
        conversations: [...fresh.conversations, ...(pages[0]?.conversations ?? [])],
      };
      return { ...current, pages };
    });
  };

  const mergeGroupHead = (fresh: Awaited<ReturnType<typeof loadGroupConvs>>) => {
    queryClientTop.setQueryData(groupConversationQueryKey, (current: any) => {
      if (!current?.pages?.length) {
        return { pages: [fresh], pageParams: [null] };
      }
      const freshIds = new Set(fresh.conversations.map((conversation) => conversation.id));
      const pages = current.pages.map((page: any) => ({
        ...page,
        conversations: (page.conversations ?? []).filter(
          (conversation: { id: string }) => !freshIds.has(conversation.id),
        ),
      }));
      pages[0] = {
        ...pages[0],
        conversations: [...fresh.conversations, ...(pages[0]?.conversations ?? [])],
      };
      return { ...current, pages };
    });
  };

  // Realtime é o caminho principal, mas uma aba pode ficar aberta por horas e o
  // websocket pode cair sem remontar a tela. Mantemos um refresh barato apenas
  // do topo para que novos leads nunca dependam exclusivamente do Realtime.
  useEffect(() => {
    if (channel !== "leads" || !workspaceId || !conversationCacheReady) return;

    let cancelled = false;
    let refreshing = false;
    const refreshLeadHead = () => {
      if (refreshing) return;
      refreshing = true;
      loadLeadConvs({ data: { limit: 10 } })
        .then((fresh) => {
          if (!cancelled) mergeLeadHead(fresh);
        })
        .catch(() => undefined)
        .finally(() => {
          refreshing = false;
        });
    };
    const onFocus = () => refreshLeadHead();
    const onOnline = () => refreshLeadHead();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshLeadHead();
    };
    const timer = window.setInterval(refreshLeadHead, 30_000);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [channel, workspaceId, conversationCacheReady, loadLeadConvs]);

  // Backfill é manutenção defensiva. O webhook Evolution já materializa a mensagem viva
  // em whatsapp_web_messages + lead_activities; portanto o backfill nunca participa do
  // primeiro paint nem roda novamente a cada navegação de conversa.
  useEffect(() => {
    if (channel !== "leads" || !workspaceId) return;
    if (inboxBackfillScheduledByWorkspace.has(workspaceId)) return;
    inboxBackfillScheduledByWorkspace.add(workspaceId);

    let started = false;
    const timer = window.setTimeout(() => {
      started = true;
      syncWaInbox({})
        .then(async (result) => {
          if (!result || ((result.leadsCreated ?? 0) === 0 && (result.activitiesInserted ?? 0) === 0)) {
            return;
          }
          const fresh = await loadLeadConvs({ data: { limit: 10 } });
          mergeLeadHead(fresh);
        })
        .catch(() => undefined);
    }, 15_000);

    return () => {
      window.clearTimeout(timer);
      if (!started) inboxBackfillScheduledByWorkspace.delete(workspaceId);
    };
  }, [channel, workspaceId, syncWaInbox, loadLeadConvs]);

  // Realtime incremental e filtrado por workspace. INSERT/UPDATE de atividade não
  // refaz todas as páginas; atualiza apenas a conversa carregada. Para lead/grupo
  // ainda ausente do cache, hidrata somente o topo (10 itens).
  useEffect(() => {
    if (channel !== "leads" || !workspaceId) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    let leadHeadHydrationPending = false;
    let groupHeadHydrationPending = false;
    const seenRealtimeEvents = new Set<string>();
    const acceptRealtimeEvent = (key: string) => {
      if (seenRealtimeEvents.has(key)) return false;
      seenRealtimeEvents.add(key);
      if (seenRealtimeEvents.size > 500) {
        const oldest = seenRealtimeEvents.values().next().value;
        if (typeof oldest === "string") seenRealtimeEvents.delete(oldest);
      }
      return true;
    };

    const hydrateLeadHead = () => {
      if (leadHeadHydrationPending) return;
      leadHeadHydrationPending = true;
      loadLeadConvs({ data: { limit: 10 } })
        .then((fresh) => {
          if (!cancelled) mergeLeadHead(fresh);
        })
        .catch(() => undefined)
        .finally(() => {
          leadHeadHydrationPending = false;
        });
    };

    const hydrateGroupHead = () => {
      if (groupHeadHydrationPending) return;
      groupHeadHydrationPending = true;
      loadGroupConvs({ data: { limit: 10 } })
        .then((fresh) => {
          if (!cancelled) mergeGroupHead(fresh);
        })
        .catch(() => undefined)
        .finally(() => {
          groupHeadHydrationPending = false;
        });
    };

    const patchLeadConversation = (record: Record<string, any>, isInsert: boolean) => {
      const leadId = typeof record.lead_id === "string" ? record.lead_id : null;
      if (!leadId) return;
      const realtimeId = typeof record.id === "string" ? record.id : "";
      const realtimeKey = "lead:" + (isInsert ? "insert:" : "update:") + realtimeId;
      if (realtimeId && !acceptRealtimeEvent(realtimeKey)) return;
      const type = String(record.type ?? "");
      const payload =
        record.payload && typeof record.payload === "object"
          ? (record.payload as Record<string, unknown>)
          : null;
      const occurredAt =
        typeof record.occurred_at === "string" ? record.occurred_at : new Date().toISOString();
      let found = false;

      queryClientTop.setQueryData(leadConversationQueryKey, (current: any) => {
        if (!current?.pages?.length) return current;
        let patched: any = null;
        const pages = current.pages.map((page: any) => {
          const conversations = (page.conversations ?? []).filter((conversation: any) => {
            if (conversation.id !== leadId) return true;
            found = true;
            const isMessage = type === "message_in" || type === "message_out" || type === "note";
            patched = {
              ...conversation,
              ...(isMessage
                ? {
                    lastMessagePreview: realtimeMessagePreview(payload, type),
                    lastMessageAt: occurredAt,
                    lastMessageFrom: type === "message_in" ? "lead" : "us",
                  }
                : {}),
              unreadCount:
                type === "conversation_read" || type === "message_out"
                  ? 0
                  : type === "message_in" && isInsert
                    ? (conversation.unreadCount ?? 0) + 1
                    : conversation.unreadCount ?? 0,
            };
            return false;
          });
          return { ...page, conversations };
        });

        if (!found || !patched) return current;
        if (type === "conversation_read") {
          return {
            ...current,
            pages: pages.map((page: any, index: number) =>
              index === 0
                ? { ...page, conversations: [patched, ...(page.conversations ?? [])] }
                : page,
            ),
          };
        }
        pages[0] = {
          ...pages[0],
          conversations: [patched, ...(pages[0]?.conversations ?? [])],
        };
        return { ...current, pages };
      });

      if (!found) hydrateLeadHead();
    };

    const patchGroupConversation = (record: Record<string, any>, isUpdate = false) => {
      const groupJid = typeof record.remote_jid === "string" ? record.remote_jid : null;
      if (!groupJid || !groupJid.endsWith("@g.us")) return;
      const realtimeId = typeof record.id === "string" ? record.id : "";
      if (
        realtimeId &&
        !acceptRealtimeEvent("group:" + (isUpdate ? "update:" : "insert:") + realtimeId)
      ) return;
      const at =
        typeof record.received_at === "string" ? record.received_at : new Date().toISOString();
      let found = false;

      queryClientTop.setQueryData(groupConversationQueryKey, (current: any) => {
        if (!current?.pages?.length) return current;
        let patched: any = null;
        const pages = current.pages.map((page: any) => {
          const conversations = (page.conversations ?? []).filter((conversation: any) => {
            if (conversation.groupJid !== groupJid) return true;
            found = true;
            patched = {
              ...conversation,
              lastMessageAt: at,
              lastMessageFrom: record.from_me ? "us" : "lead",
              lastMessagePreview:
                typeof record.body === "string" && record.body.trim()
                  ? record.body.trim()
                  : realtimeMessagePreview(
                      { media_type: record.message_type },
                      record.from_me ? "message_out" : "message_in",
                    ),
            };
            return false;
          });
          return { ...page, conversations };
        });
        if (!found || !patched) return current;
        pages[0] = {
          ...pages[0],
          conversations: [patched, ...(pages[0]?.conversations ?? [])],
        };
        return { ...current, pages };
      });

      if (!found) hydrateGroupHead();
    };

    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      if (cancelled) return;
      const workspaceFilter = `workspace_id=eq.${workspaceId}`;
      const realtimeChannel = supabase
        .channel(`inbox-workspace-${workspaceId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "lead_activities",
            filter: workspaceFilter,
          },
          (payload) => patchLeadConversation(payload.new as Record<string, any>, true),
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "lead_activities",
            filter: workspaceFilter,
          },
          (payload) => patchLeadConversation(payload.new as Record<string, any>, false),
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "whatsapp_web_messages",
            filter: workspaceFilter,
          },
          (payload) => patchGroupConversation(payload.new as Record<string, any>, false),
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "whatsapp_web_messages",
            filter: workspaceFilter,
          },
          (payload) => patchGroupConversation(payload.new as Record<string, any>, true),
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            // Não deixa a lista presa no snapshot caso o socket caia.
            hydrateLeadHead();
          }
        });
      cleanup = () => {
        supabase.removeChannel(realtimeChannel);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [channel, workspaceId, loadLeadConvs, loadGroupConvs, queryClientTop]);

  const networkConversations = useMemo<ChatConversation[]>(() => {
    if (channel !== "leads") return getChannelConversations(channel);
    const directLeads = (leadConvsQuery.data?.pages.flatMap((page) => page.conversations) ?? []).map(
      (c) =>
        ({
          id: c.id,
          channel: "leads" as const,
          name: c.name,
          subtitle: c.subtitle,
          lastMessageFrom:
            c.lastMessageFrom === "none" ? "me" : c.lastMessageFrom === "lead" ? "them" : "me",
          lastMessagePreview: c.lastMessagePreview,
          lastMessageAt: c.lastMessageAt,
          unreadCount: c.unreadCount,
          messages: [],
          leadId: c.leadId,
          labels: c.tags,
          companyId: c.companyId ?? undefined,
          productIds: c.productIds ?? [],
          sourceProvider: c.sourceProvider,
          status: c.conversationStatus === "fechada" ? ("resolvido" as const) : ("aberto" as const),
        }) satisfies ChatConversation,
    );
    const groups = (groupConvsQuery.data?.pages.flatMap((page) => page.conversations) ?? []).map(
      (g) =>
        ({
          id: g.id,
          channel: "leads" as const,
          name: g.name,
          subtitle: g.subtitle,
          avatarUrl: g.pictureUrl ?? undefined,
          isGroup: true,
          lastMessageFrom:
            g.lastMessageFrom === "none" ? "me" : g.lastMessageFrom === "lead" ? "them" : "me",
          lastMessagePreview: g.lastMessagePreview,
          lastMessageAt: g.lastMessageAt,
          unreadCount: g.unreadCount,
          status: "aberto" as const,
          messages: [],
          groupJid: g.groupJid,
          groupSessionId: g.sessionId,
        }) satisfies ChatConversation,
    );
    return [...directLeads, ...groups].sort(
      (a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt),
    );
  }, [channel, leadConvsQuery.data, groupConvsQuery.data]);

  const directNetworkConversationCount = networkConversations.filter(
    (conversation) => !conversation.isGroup,
  ).length;
  const inboxHealthQuery = useQuery({
    queryKey: [
      "inbox",
      "health",
      cacheScope?.userId,
      cacheScope?.workspaceId,
    ],
    queryFn: () => loadInboxHealth({}),
    enabled:
      channel === "leads" &&
      Boolean(cacheScope) &&
      conversationCacheReady &&
      leadConvsQuery.isSuccess &&
      !leadConvsQuery.isFetching &&
      directNetworkConversationCount === 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const health = inboxHealthQuery.data;
    if (channel !== "leads" || !cacheScope || !health?.needsRecovery) return;
    const recoveryKey = `${cacheScope.userId}::${cacheScope.workspaceId}`;
    if (autoRecoveryAttemptedRef.current.has(recoveryKey)) return;
    autoRecoveryAttemptedRef.current.add(recoveryKey);
    setSelfRecoveryActive(true);

    void (async () => {
      console.error("[Inbox health] Inconsistência confirmada. Iniciando autorrecuperação.", health);
      await clearInboxCacheScope(cacheScope);
      setCachedConversations([]);
      const bootstrapResult = await inboxBootstrapQuery.refetch();
      if (bootstrapResult.error) throw bootstrapResult.error;
      const conversationsResult = await leadConvsQuery.refetch();
      if (conversationsResult.error) throw conversationsResult.error;
      const validationResult = await inboxHealthQuery.refetch();
      if (validationResult.data?.needsRecovery) {
        setWorkspaceResolutionError(
          "O Inbox detectou uma inconsistência e não conseguiu se recuperar automaticamente.",
        );
      }
    })()
      .catch((error) => {
        console.error("[Inbox health] Falha na autorrecuperação", error);
        setWorkspaceResolutionError("Não foi possível recuperar as conversas automaticamente.");
      })
      .finally(() => setSelfRecoveryActive(false));
  }, [
    channel,
    cacheScope?.userId,
    cacheScope?.workspaceId,
    inboxHealthQuery.data,
    inboxBootstrapQuery.refetch,
    leadConvsQuery.refetch,
    inboxHealthQuery.refetch,
  ]);

  useEffect(() => {
    if (!cacheScope || directNetworkConversationCount === 0) return;
    autoRecoveryAttemptedRef.current.delete(`${cacheScope.userId}::${cacheScope.workspaceId}`);
  }, [cacheScope?.userId, cacheScope?.workspaceId, directNetworkConversationCount]);

  const leadNetworkReady = channel !== "leads" || leadConvsQuery.isSuccess;
  const allNetworkConversationsReady =
    channel !== "leads" ||
    (leadConvsQuery.isSuccess && groupConvsQuery.isSuccess);
  const conversations = useMemo<ChatConversation[]>(() => {
    if (channel !== "leads") return networkConversations;
    if (!leadNetworkReady) return cachedConversations;
    if (groupConvsQuery.isSuccess) return networkConversations;

    // Falha na consulta de grupos não pode congelar todos os leads no snapshot antigo.
    // Mantém grupos do cache enquanto os leads diretos usam imediatamente a rede viva.
    const cachedGroups = cachedConversations.filter((conversation) => conversation.isGroup);
    const liveDirect = networkConversations.filter((conversation) => !conversation.isGroup);
    return [...liveDirect, ...cachedGroups].sort(
      (a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt),
    );
  }, [
    channel,
    leadNetworkReady,
    groupConvsQuery.isSuccess,
    networkConversations,
    cachedConversations,
  ]);

  useEffect(() => {
    if (channel !== "leads" || !cacheScope || !allNetworkConversationsReady) return;
    setCachedConversations(networkConversations);
    void writeInboxConversationSnapshot(cacheScope, "leads", networkConversations);
  }, [
    channel,
    cacheScope?.userId,
    cacheScope?.workspaceId,
    allNetworkConversationsReady,
    networkConversations,
  ]);

  const selectedFromLoaded = selectedId
    ? conversations.find((conversation) => conversation.id === selectedId)
    : undefined;
  const loadSelectedLeadDetail = useServerFn(getLeadDetail);
  const selectedLeadRouteQuery = useQuery({
    queryKey: [
      "inbox",
      "route-selected-lead",
      selectedId,
      cacheScope?.userId,
      cacheScope?.workspaceId,
    ],
    queryFn: () =>
      loadSelectedLeadDetail({
        data: { leadId: selectedId as string, includeActivities: false },
      }),
    enabled:
      channel === "leads" &&
      Boolean(selectedId) &&
      Boolean(cacheScope) &&
      !selectedFromLoaded,
    staleTime: 30_000,
    retry: 1,
  });
  const selectedFromRoute = useMemo<ChatConversation | undefined>(() => {
    if (channel !== "leads" || selectedFromLoaded) return undefined;
    const detail = selectedLeadRouteQuery.data as LeadDetailResponse | undefined;
    const lead = detail?.lead;
    if (!lead || lead.id !== selectedId) return undefined;
    return {
      id: lead.id,
      leadId: lead.id,
      channel: "leads",
      name: lead.name,
      subtitle:
        [lead.phone, lead.stageName].filter(Boolean).join(" · ") ||
        lead.email ||
        " - ",
      lastMessageFrom: "them",
      lastMessagePreview: "Carregando conversa…",
      lastMessageAt: lead.updatedAt,
      unreadCount: 0,
      messages: [],
      labels: lead.tags,
      sourceProvider: lead.sourceProvider,
      status: "aberto",
      productIds: [],
    };
  }, [channel, selectedId, selectedFromLoaded, selectedLeadRouteQuery.data]);
  const resolvingSelectedLead =
    channel === "leads" &&
    Boolean(selectedId) &&
    !selectedFromLoaded &&
    selectedLeadRouteQuery.isPending;
  const selected = selectedId
    ? (selectedFromLoaded ??
      selectedFromRoute ??
      (channel === "leads" ? undefined : getConversation(channel, selectedId)))
    : undefined;

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState(meta.tabs[0]);
  const [labelGroups, setLabelGroups] = useState<InboxLabelGroup[]>([]);
  const [conversationLabels, setConversationLabels] = useState<Record<string, string[]>>({});
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [activeCompany, setActiveCompany] = useState<string | null>(null);
  const [activeProduct, setActiveProduct] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);

  const leadCacheAvailable = cachedConversations.some((conversation) => !conversation.isGroup);
  const groupCacheAvailable = cachedConversations.some((conversation) => conversation.isGroup);
  const relevantQueryError = tab === "Grupos" ? groupConvsQuery.isError : leadConvsQuery.isError;
  const relevantCacheAvailable = tab === "Grupos" ? groupCacheAvailable : leadCacheAvailable;
  const conversationLoadError =
    channel === "leads"
      ? workspaceResolutionError ??
        (relevantQueryError
          ? relevantCacheAvailable
            ? "Não foi possível atualizar as conversas. Exibindo o último estado salvo."
            : "Não foi possível carregar as conversas."
          : null)
      : null;
  const conversationsLoading =
    channel === "leads" &&
    !conversationLoadError &&
    (selfRecoveryActive ||
      inboxHealthQuery.isFetching ||
      !conversationCacheReady ||
      (tab === "Grupos"
        ? Boolean(cacheScope) && groupConvsQuery.isPending && !groupCacheAvailable
        : Boolean(cacheScope) && leadConvsQuery.isPending && !leadCacheAvailable));
  const retryConversations = () => {
    if (workspaceResolutionError || !cacheScope) {
      void inboxBootstrapQuery.refetch();
      return;
    }
    if (tab === "Grupos") {
      void groupConvsQuery.refetch();
      return;
    }
    void leadConvsQuery.refetch();
    if (tab === "Favoritas") void groupConvsQuery.refetch();
  };

  useEffect(() => {
    if (leadConvsQuery.isError) {
      console.error("[Inbox] Falha ao carregar conversas de leads", {
        workspaceId,
        error: leadConvsQuery.error,
      });
    }
  }, [leadConvsQuery.isError, leadConvsQuery.error, workspaceId]);

  useEffect(() => {
    if (groupConvsQuery.isError) {
      console.error("[Inbox] Falha ao carregar conversas de grupos", {
        workspaceId,
        error: groupConvsQuery.error,
      });
    }
  }, [groupConvsQuery.isError, groupConvsQuery.error, workspaceId]);

  const loadCompanies = useServerFn(listCompanies);
  const companiesQ = useQuery({
    queryKey: ["companies-list", cacheScope?.userId, cacheScope?.workspaceId],
    queryFn: () => loadCompanies({}),
    enabled: channel === "leads" && Boolean(cacheScope),
    staleTime: 60_000,
  });

  const listInboxLabelsFn = useServerFn(listInboxLabels);
  const upsertInboxLabelFn = useServerFn(upsertInboxLabel);
  const deleteInboxLabelFn = useServerFn(deleteInboxLabel);
  const toggleLabelAssignmentFn = useServerFn(toggleLabelAssignment);
  const inboxLabelsQuery = useQuery({
    queryKey: ["inbox", "labels", cacheScope?.userId, cacheScope?.workspaceId],
    queryFn: () => listInboxLabelsFn({}),
    enabled: channel === "leads" && Boolean(cacheScope),
    staleTime: 30_000,
  });

  useEffect(() => {
    const rows = inboxLabelsQuery.data?.labels ?? [];
    const grouped = new Map<string, InboxLabel[]>();
    for (const row of rows) {
      const list = grouped.get(row.group_name) ?? [];
      list.push({ id: row.id, name: row.name, color: row.color });
      grouped.set(row.group_name, list);
    }
    setLabelGroups(Array.from(grouped.entries()).map(([name, labels]) => ({ id: name, name, labels })));
    setConversationLabels(inboxLabelsQuery.data?.assignments ?? {});
  }, [inboxLabelsQuery.data]);

  const refreshInboxLabels = () =>
    queryClientTop.invalidateQueries({ queryKey: ["inbox", "labels"] });

  useEffect(() => {
    setProfileOpen(false);
  }, [selectedId, channel]);

  const enrichedConversations = useMemo(
    () =>
      conversations.map((c) => ({
        ...c,
        labels: Array.from(new Set([...(c.labels ?? []), ...(conversationLabels[c.id] ?? [])])),
      })),
    [conversations, conversationLabels],
  );
  const selectedLabels = enrichedConversations.find((c) => c.id === selectedId)?.labels ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enrichedConversations.filter((c) => {
      if (
        q &&
        !c.name.toLowerCase().includes(q) &&
        !(c.subtitle ?? "").toLowerCase().includes(q) &&
        !c.lastMessagePreview.toLowerCase().includes(q)
      )
        return false;
      // Grupos só aparecem nas abas "Grupos"/"Canais". Nas demais abas mostramos apenas leads/diretas.
      // Em "Favoritas" permitimos grupos favoritados também (usuário pediu grupos favoritados aqui).
      if (tab !== "Grupos" && tab !== "Canais" && tab !== "Favoritas" && c.isGroup) return false;
      if (tab === "Etiquetas" && activeLabel && !(c.labels ?? []).includes(activeLabel))
        return false;
      if (tab === "Não lidas" && !(c.unreadCount && c.unreadCount > 0)) return false;
      if (tab === "Fechadas" && c.status !== "resolvido") return false;
      if (tab !== "Fechadas" && tab !== "Todas" && c.status === "resolvido") return false;
      if (tab === "Favoritas" && !c.favorite) return false;
      if (tab === "Aguardando" && c.status !== "aguardando") return false;
      if (tab === "Etiquetas" && !(c.labels ?? []).length) return false;
      if (tab === "Canais" && !c.isGroup) return false;
      if (tab === "Grupos" && !c.isGroup) return false;
      if (tab === "Diretas" && c.isGroup) return false;
      if (tab === "Abertos" && c.status !== "aberto") return false;
      if (tab === "Aguardando" && channel === "suporte" && c.status !== "aguardando") return false;
      if (tab === "Resolvidos" && c.status !== "resolvido") return false;
      if (tab === "Empresa" && (!activeCompany || c.companyId !== activeCompany)) return false;
      if (tab === "Produtos" && (!activeProduct || !(c.productIds ?? []).includes(activeProduct)))
        return false;
      return true;
    });
  }, [enrichedConversations, query, tab, channel, activeLabel, activeCompany, activeProduct]);

  const hasMoreConversations =
    channel === "leads"
      ? tab === "Grupos"
        ? Boolean(groupConvsQuery.hasNextPage)
        : tab === "Favoritas"
          ? Boolean(leadConvsQuery.hasNextPage || groupConvsQuery.hasNextPage)
          : Boolean(leadConvsQuery.hasNextPage)
      : false;
  const loadingMoreConversations =
    leadConvsQuery.isFetchingNextPage || groupConvsQuery.isFetchingNextPage;
  const loadMoreConversations = () => {
    if (channel !== "leads") return;
    if (tab === "Grupos") {
      if (groupConvsQuery.hasNextPage && !groupConvsQuery.isFetchingNextPage) {
        void groupConvsQuery.fetchNextPage();
      }
      return;
    }
    if (tab === "Favoritas") {
      if (leadConvsQuery.hasNextPage && !leadConvsQuery.isFetchingNextPage) {
        void leadConvsQuery.fetchNextPage();
      }
      if (groupConvsQuery.hasNextPage && !groupConvsQuery.isFetchingNextPage) {
        void groupConvsQuery.fetchNextPage();
      }
      return;
    }
    if (leadConvsQuery.hasNextPage && !leadConvsQuery.isFetchingNextPage) {
      void leadConvsQuery.fetchNextPage();
    }
  };

  // Distinct produtos a partir dos leads carregados
  const distinctProducts = useMemo(() => {
    const ids = new Set<string>();
    enrichedConversations.forEach((c) => (c.productIds ?? []).forEach((id) => ids.add(id)));
    return Array.from(ids);
  }, [enrichedConversations]);

  function createLabel(groupName: string, labelName: string, color?: string) {
    const name = labelName.trim();
    if (!name) return;
    const groupLabel = groupName.trim() || "Geral";
    const finalColor = color || "oklch(0.78 0.14 162)";
    void upsertInboxLabelFn({ data: { group_name: groupLabel, name, color: finalColor } })
      .then(refreshInboxLabels)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Falha ao criar etiqueta."));
  }

  function updateLabel(groupId: string, labelId: string, patch: { name?: string; color?: string }) {
    const group = labelGroups.find((g) => g.id === groupId);
    const label = group?.labels.find((l) => l.id === labelId);
    if (!group || !label) return;
    void upsertInboxLabelFn({ data: {
      id: labelId,
      group_name: group.name,
      name: patch.name?.trim() || label.name,
      color: patch.color || label.color,
    } }).then(refreshInboxLabels)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Falha ao atualizar etiqueta."));
  }

  function deleteLabel(_groupId: string, labelId: string) {
    void deleteInboxLabelFn({ data: { id: labelId } })
      .then(refreshInboxLabels)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Falha ao excluir etiqueta."));
  }

  function renameGroup(groupId: string, name: string) {
    const n = name.trim();
    const group = labelGroups.find((g) => g.id === groupId);
    if (!n || !group) return;
    void Promise.all(group.labels.map((label) => upsertInboxLabelFn({ data: {
      id: label.id, group_name: n, name: label.name, color: label.color,
    } }))).then(refreshInboxLabels)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Falha ao renomear grupo."));
  }

  function deleteGroup(groupId: string) {
    const group = labelGroups.find((g) => g.id === groupId);
    if (!group) return;
    void Promise.all(group.labels.map((label) => deleteInboxLabelFn({ data: { id: label.id } })))
      .then(refreshInboxLabels)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Falha ao excluir grupo."));
  }

  function toggleConversationLabel(conversationId: string, labelId: string) {
    const current = new Set(conversationLabels[conversationId] ?? []);
    const on = !current.has(labelId);
    if (on) current.add(labelId); else current.delete(labelId);
    setConversationLabels((prev) => ({ ...prev, [conversationId]: Array.from(current) }));
    void toggleLabelAssignmentFn({ data: { conversationId, labelId, on } })
      .then(refreshInboxLabels)
      .catch((error) => {
        void refreshInboxLabels();
        toast.error(error instanceof Error ? error.message : "Falha ao atualizar etiqueta da conversa.");
      });
  }

  // Em mobile: mostra apenas uma "view" por vez (lista OU conversa).
  const hasSelection = Boolean(selected) || resolvingSelectedLead;
  return (
    <div
      data-chat-surface
      className="flex-1 flex min-w-0 h-[100dvh] md:h-screen overflow-hidden"
      style={{ backgroundColor: "var(--chat-bg)", color: "var(--chat-text)" }}
    >
      {/* Lista de conversas */}
      <div
        className={cn(
          "relative flex flex-col min-h-0 transition-[width] duration-200 ease-out overflow-hidden",
          hasSelection ? "hidden md:flex" : "flex",
          listCollapsed ? "w-0 md:w-0" : "w-full md:w-[360px] md:shrink-0",
        )}
      >
        <ConversationsPanel
          meta={meta}
          conversations={filtered}
          totalCount={conversations.length}
          channel={channel}
          selectedId={selectedId}
          query={query}
          onQueryChange={setQuery}
          tab={tab}
          onTabChange={setTab}
          labelGroups={labelGroups}
          activeLabel={activeLabel}
          onActiveLabelChange={setActiveLabel}
          companies={companiesQ.data?.companies ?? []}
          activeCompany={activeCompany}
          onActiveCompanyChange={setActiveCompany}
          productIds={distinctProducts}
          activeProduct={activeProduct}
          onActiveProductChange={setActiveProduct}
          selectedConversationId={selectedId}
          selectedConversationLabels={selectedLabels}
          onCreateLabel={createLabel}
          onUpdateLabel={updateLabel}
          onDeleteLabel={deleteLabel}
          onRenameGroup={renameGroup}
          onDeleteGroup={deleteGroup}
          onToggleConversationLabel={toggleConversationLabel}
          hasMore={hasMoreConversations}
          isLoadingMore={loadingMoreConversations}
          onLoadMore={loadMoreConversations}
          isLoading={conversationsLoading}
          loadError={conversationLoadError}
          onRetry={retryConversations}
        />
      </div>

      {/* Painel do perfil, independente do estado da lista, sempre visível quando aberto */}
      {channel === "leads" && selected && !selected.isGroup && profileOpen && (
        <div
          className="hidden md:flex w-[360px] shrink-0 border-l"
          style={{ borderColor: "var(--chat-divider)" }}
        >
          <LeadProfilePanel
            leadId={selected.id}
            leadName={selected.name}
            defaults={{
              name: selected.name,
              company: selected.subtitle?.split(" · ")[0] ?? "",
              stage: selected.subtitle?.split(" · ")[1] ?? "",
            }}
            onLeadMoved={() => {
              queryClientTop.invalidateQueries({ queryKey: ["inbox", "lead-conversations"] });
            }}
            onClose={() => setProfileOpen(false)}
          />
        </div>
      )}

      {/* Thread */}
      <div
        className={cn("flex-1 flex-col min-w-0 min-h-0", hasSelection ? "flex" : "hidden md:flex")}
        style={{ backgroundColor: "var(--chat-bg)" }}
      >
        {selected ? (
          <ChatThread
            conversation={selected}
            channel={channel}
            cacheScope={cacheScope}
            onOpenProfile={
              channel === "leads" && !selected.isGroup ? () => setProfileOpen((v) => !v) : undefined
            }
            profileOpen={profileOpen}
            listCollapsed={listCollapsed}
            onToggleList={() => setListCollapsed((v) => !v)}
            workspaceId={workspaceId}
          />
        ) : resolvingSelectedLead ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-sm" style={{ color: "var(--chat-meta)" }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            Abrindo conversa…
          </div>
        ) : (
          <EmptyState channel={channel} />
        )}
      </div>
    </div>
  );
}

/* =================== Lista de conversas =================== */

function ConversationsPanel({
  meta,
  conversations,
  totalCount,
  channel,
  selectedId,
  query,
  onQueryChange,
  tab,
  onTabChange,
  labelGroups,
  activeLabel,
  onActiveLabelChange,
  companies,
  activeCompany,
  onActiveCompanyChange,
  productIds,
  activeProduct,
  onActiveProductChange,
  selectedConversationId,
  selectedConversationLabels,
  onCreateLabel,
  onUpdateLabel,
  onDeleteLabel,
  onRenameGroup,
  onDeleteGroup,
  onToggleConversationLabel,
  hasMore,
  isLoadingMore,
  onLoadMore,
  isLoading,
  loadError,
  onRetry,
}: {
  meta: (typeof CHANNEL_META)[ChatChannel];
  conversations: ChatConversation[];
  totalCount: number;
  channel: ChatChannel;
  selectedId?: string;
  query: string;
  onQueryChange: (v: string) => void;
  tab: string;
  onTabChange: (t: string) => void;
  labelGroups: InboxLabelGroup[];
  activeLabel: string | null;
  onActiveLabelChange: (id: string | null) => void;
  companies: Array<{ id: string; name: string }>;
  activeCompany: string | null;
  onActiveCompanyChange: (id: string | null) => void;
  productIds: string[];
  activeProduct: string | null;
  onActiveProductChange: (id: string | null) => void;
  selectedConversationId?: string;
  selectedConversationLabels: string[];
  onCreateLabel: (groupName: string, labelName: string, color?: string) => void;
  onUpdateLabel: (
    groupId: string,
    labelId: string,
    patch: { name?: string; color?: string },
  ) => void;
  onDeleteLabel: (groupId: string, labelId: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onToggleConversationLabel: (conversationId: string, labelId: string) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <aside
      className="w-full h-full flex flex-col border-r min-h-0"
      style={{ backgroundColor: "var(--chat-panel)", borderColor: "var(--chat-divider)" }}
    >
      {/* Cabeçalho */}
      <div
        className="pl-14 pr-4 pt-4 pb-3 md:px-4 md:pt-4"
        style={{ borderBottom: "1px solid var(--chat-divider)" }}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-base font-semibold">{meta.title}</div>
            <div className="text-[11px]" style={{ color: "var(--chat-meta)" }}>
              {meta.subtitle}
            </div>
          </div>
          <div className="relative">
            <button
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors"
              aria-label="Ações do inbox"
              style={{ color: "var(--chat-text-muted)" }}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Plus className="w-4 h-4" />
            </button>
            {menuOpen && (
              <InboxActionsMenu
                labelGroups={labelGroups}
                selectedConversationId={selectedConversationId}
                selectedConversationLabels={selectedConversationLabels}
                onCreateLabel={onCreateLabel}
                onUpdateLabel={onUpdateLabel}
                onDeleteLabel={onDeleteLabel}
                onRenameGroup={onRenameGroup}
                onDeleteGroup={onDeleteGroup}
                onToggleConversationLabel={onToggleConversationLabel}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: "var(--chat-meta)" }}
          />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={
              channel === "leads"
                ? "Buscar lead ou conversa"
                : channel === "equipe"
                  ? "Buscar pessoa ou canal"
                  : "Buscar ticket"
            }
            className="w-full h-9 pl-9 pr-3 rounded-lg text-xs outline-none focus:ring-1"
            style={{
              backgroundColor: "var(--chat-bg)",
              color: "var(--chat-text)",
              border: "1px solid var(--chat-divider)",
            }}
          />
        </div>

        {/* Tabs */}
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {meta.tabs.map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => onTabChange(t)}
                className={cn(
                  "shrink-0 h-7 px-3 rounded-full text-[11px] font-medium transition-colors",
                  active ? "" : "hover:bg-white/5",
                )}
                style={
                  active
                    ? { backgroundColor: "var(--chat-accent)", color: "var(--chat-accent-fg)" }
                    : {
                        backgroundColor: "transparent",
                        color: "var(--chat-text-muted)",
                        border: "1px solid var(--chat-divider)",
                      }
                }
              >
                {t}
              </button>
            );
          })}
        </div>
        {channel === "leads" && tab === "Etiquetas" && (
          <LabelFilterRail
            groups={labelGroups}
            activeLabel={activeLabel}
            onChange={onActiveLabelChange}
          />
        )}
        {channel === "leads" && tab === "Empresa" && (
          <SimpleFilterRail
            label="Selecione uma empresa"
            options={companies.map((c) => ({ id: c.id, name: c.name }))}
            active={activeCompany}
            onChange={onActiveCompanyChange}
            emptyText="Nenhuma empresa cadastrada. Crie em CRM › Empresas."
          />
        )}
        {channel === "leads" && tab === "Produtos" && (
          <SimpleFilterRail
            label="Selecione um produto"
            options={productIds.map((id) => ({ id, name: id.slice(0, 8) }))}
            active={activeProduct}
            onChange={onActiveProductChange}
            emptyText="Nenhum produto vinculado aos leads ainda."
          />
        )}
      </div>

      {/* Lista */}
      {loadError && conversations.length > 0 && (
        <div
          className="mx-3 mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[11px]"
          style={{
            border: "1px solid var(--chat-divider)",
            backgroundColor: "var(--chat-panel-hover)",
            color: "var(--chat-text-muted)",
          }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div>{loadError}</div>
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 font-medium underline underline-offset-2"
              style={{ color: "var(--chat-accent)" }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {isLoading && conversations.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-6 text-xs" style={{ color: "var(--chat-meta)" }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando conversas...
          </div>
        ) : loadError && conversations.length === 0 ? (
          <div className="p-6 text-center text-xs" style={{ color: "var(--chat-meta)" }}>
            <AlertCircle className="mx-auto mb-2 h-5 w-5" />
            <div>{loadError}</div>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 h-8 rounded-lg px-3 text-[11px] font-medium"
              style={{
                border: "1px solid var(--chat-divider)",
                color: "var(--chat-text)",
                backgroundColor: "var(--chat-panel-hover)",
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-xs" style={{ color: "var(--chat-meta)" }}>
            Nenhuma conversa nesta visão.
          </div>
        ) : (
          <>
            {conversations.map((c) => (
              <ConversationRow key={c.id} conv={c} channel={channel} active={c.id === selectedId} />
            ))}
            {hasMore && (
              <div className="px-3 py-3 flex justify-center">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="h-8 px-3 rounded-lg text-[11px] font-medium disabled:opacity-50"
                  style={{
                    border: "1px solid var(--chat-divider)",
                    color: "var(--chat-text-muted)",
                    backgroundColor: "var(--chat-panel-hover)",
                  }}
                >
                  {isLoadingMore ? "Carregando…" : "Carregar mais"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* rodapé pequeno */}
      <div
        className="px-4 py-2 text-[10px] flex items-center justify-between"
        style={{ color: "var(--chat-meta)", borderTop: "1px solid var(--chat-divider)" }}
      >
        <span>{totalCount} conversas</span>
        <span className="flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--chat-accent)" }}
          />
          Conectado
        </span>
      </div>
    </aside>
  );
}

const LABEL_COLOR_PALETTE = [
  "oklch(0.58 0.22 27)", // vermelho
  "oklch(0.72 0.16 65)", // laranja
  "oklch(0.82 0.16 95)", // amarelo
  "oklch(0.72 0.17 145)", // verde
  "oklch(0.78 0.14 162)", // teal
  "oklch(0.65 0.15 220)", // azul
  "oklch(0.55 0.15 235)", // azul escuro
  "oklch(0.52 0.18 280)", // roxo
  "oklch(0.58 0.20 320)", // magenta
  "oklch(0.58 0.20 340)", // rosa
  "oklch(0.55 0.02 260)", // cinza
];

function InboxActionsMenu({
  labelGroups,
  selectedConversationId,
  selectedConversationLabels,
  onCreateLabel,
  onUpdateLabel,
  onDeleteLabel,
  onRenameGroup,
  onDeleteGroup,
  onToggleConversationLabel,
  onClose,
}: {
  labelGroups: InboxLabelGroup[];
  selectedConversationId?: string;
  selectedConversationLabels: string[];
  onCreateLabel: (groupName: string, labelName: string, color?: string) => void;
  onUpdateLabel: (
    groupId: string,
    labelId: string,
    patch: { name?: string; color?: string },
  ) => void;
  onDeleteLabel: (groupId: string, labelId: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onToggleConversationLabel: (conversationId: string, labelId: string) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState("Geral");
  const [labelName, setLabelName] = useState("");
  const [newColor, setNewColor] = useState<string>(LABEL_COLOR_PALETTE[4]);
  const [editingLabel, setEditingLabel] = useState<{ groupId: string; labelId: string } | null>(
    null,
  );
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState("");
  const [createGroupOpen, setCreateGroupOpen] = useState(false);

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div
        className="absolute right-0 top-10 z-30 w-80 rounded-lg border shadow-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--chat-panel)",
          borderColor: "var(--chat-divider)",
          color: "var(--chat-text)",
        }}
      >
        <div className="p-2 border-b" style={{ borderColor: "var(--chat-divider)" }}>
          <MenuAction
            icon={UserPlus}
            label="Criar contato"
            onClick={() => {
              onClose();
              navigate({ to: "/crm/leads" });
            }}
          />
          <MenuAction
            icon={UsersIcon}
            label="Criar grupo"
            onClick={() => {
              setCreateGroupOpen(true);
            }}
          />
        </div>
        <div className="p-3 space-y-3">
          <div
            className="flex items-center gap-2 text-[10px] uppercase font-semibold tracking-wider"
            style={{ color: "var(--chat-meta)" }}
          >
            <Tags className="w-3.5 h-3.5" /> Etiquetas
          </div>
          <div className="max-h-56 overflow-y-auto space-y-3 pr-1">
            {labelGroups.map((group) => (
              <div key={group.id} className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  {editingGroup === group.id ? (
                    <>
                      <input
                        autoFocus
                        value={groupDraft}
                        onChange={(e) => setGroupDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onRenameGroup(group.id, groupDraft);
                            setEditingGroup(null);
                          }
                          if (e.key === "Escape") setEditingGroup(null);
                        }}
                        className="flex-1 min-w-0 text-[11px] px-1.5 py-0.5 rounded outline-none"
                        style={{
                          backgroundColor: "var(--chat-bg)",
                          border: "1px solid var(--chat-divider)",
                          color: "var(--chat-text)",
                        }}
                      />
                      <button
                        onClick={() => {
                          onRenameGroup(group.id, groupDraft);
                          setEditingGroup(null);
                        }}
                        className="p-0.5 opacity-70 hover:opacity-100"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div
                        className="text-[10px] font-semibold flex-1"
                        style={{ color: "var(--chat-meta)" }}
                      >
                        {group.name}
                      </div>
                      <button
                        onClick={() => {
                          setEditingGroup(group.id);
                          setGroupDraft(group.name);
                        }}
                        className="p-0.5 opacity-50 hover:opacity-100"
                        aria-label="Renomear grupo"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Excluir grupo "${group.name}" e suas etiquetas?`))
                            onDeleteGroup(group.id);
                        }}
                        className="p-0.5 opacity-50 hover:opacity-100"
                        aria-label="Excluir grupo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.labels.map((label) => {
                    const active = selectedConversationLabels.includes(label.id);
                    const isEditing =
                      editingLabel?.groupId === group.id && editingLabel?.labelId === label.id;
                    return (
                      <div key={label.id} className="relative group">
                        <button
                          disabled={!selectedConversationId}
                          onClick={() =>
                            selectedConversationId &&
                            onToggleConversationLabel(selectedConversationId, label.id)
                          }
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setEditingLabel(
                              isEditing ? null : { groupId: group.id, labelId: label.id },
                            );
                          }}
                          className="inline-flex items-center gap-1 rounded-full border pl-2 pr-1 py-1 text-[11px] disabled:opacity-40"
                          style={{
                            borderColor: active ? label.color : "var(--chat-divider)",
                            backgroundColor: active
                              ? `color-mix(in oklch, ${label.color} 18%, transparent)`
                              : "transparent",
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: label.color }}
                          />
                          {label.name}
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLabel(
                                isEditing ? null : { groupId: group.id, labelId: label.id },
                              );
                            }}
                            className="ml-0.5 opacity-40 hover:opacity-100 cursor-pointer"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </span>
                        </button>
                        {isEditing && (
                          <div
                            className="absolute z-40 top-full left-0 mt-1 w-56 rounded-md border p-2 shadow-xl space-y-2"
                            style={{
                              backgroundColor: "var(--chat-panel)",
                              borderColor: "var(--chat-divider)",
                            }}
                          >
                            <input
                              value={label.name}
                              onChange={(e) =>
                                onUpdateLabel(group.id, label.id, { name: e.target.value })
                              }
                              className="w-full text-[11px] px-2 py-1 rounded outline-none"
                              style={{
                                backgroundColor: "var(--chat-bg)",
                                border: "1px solid var(--chat-divider)",
                                color: "var(--chat-text)",
                              }}
                            />
                            <div className="flex flex-wrap gap-1">
                              {LABEL_COLOR_PALETTE.map((c) => (
                                <button
                                  key={c}
                                  onClick={() => onUpdateLabel(group.id, label.id, { color: c })}
                                  className="w-4 h-4 rounded-full border"
                                  style={{
                                    backgroundColor: c,
                                    borderColor:
                                      label.color === c ? "var(--chat-text)" : "transparent",
                                  }}
                                  aria-label="Escolher cor"
                                />
                              ))}
                            </div>
                            <div
                              className="flex items-center justify-between pt-1 border-t"
                              style={{ borderColor: "var(--chat-divider)" }}
                            >
                              <button
                                onClick={() => {
                                  onDeleteLabel(group.id, label.id);
                                  setEditingLabel(null);
                                }}
                                className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded hover:bg-white/5"
                                style={{ color: "#f87171" }}
                              >
                                <Trash2 className="w-3 h-3" /> Excluir
                              </button>
                              <button
                                onClick={() => setEditingLabel(null)}
                                className="text-[10px] px-1.5 py-1 rounded hover:bg-white/5"
                                style={{ color: "var(--chat-text-muted)" }}
                              >
                                Fechar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {group.labels.length === 0 && (
                    <div className="text-[10px]" style={{ color: "var(--chat-meta)" }}>
                      Sem etiquetas
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: "var(--chat-divider)" }}>
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{ color: "var(--chat-meta)" }}
            >
              Nova etiqueta
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Grupo"
                className="min-w-0 rounded px-2 py-1.5 text-xs outline-none"
                style={{
                  backgroundColor: "var(--chat-bg)",
                  border: "1px solid var(--chat-divider)",
                  color: "var(--chat-text)",
                }}
              />
              <input
                value={labelName}
                onChange={(e) => setLabelName(e.target.value)}
                placeholder="Nome"
                className="min-w-0 rounded px-2 py-1.5 text-xs outline-none"
                style={{
                  backgroundColor: "var(--chat-bg)",
                  border: "1px solid var(--chat-divider)",
                  color: "var(--chat-text)",
                }}
              />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {LABEL_COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className="w-4 h-4 rounded-full border"
                  style={{
                    backgroundColor: c,
                    borderColor: newColor === c ? "var(--chat-text)" : "transparent",
                  }}
                  aria-label="Cor"
                />
              ))}
              <button
                onClick={() => {
                  onCreateLabel(groupName, labelName, newColor);
                  setLabelName("");
                }}
                disabled={!labelName.trim()}
                className="ml-auto rounded px-2 py-1 text-[11px] disabled:opacity-40 flex items-center gap-1"
                style={{ backgroundColor: "var(--chat-accent)", color: "var(--chat-accent-fg)" }}
              >
                <Plus className="w-3 h-3" /> Adicionar
              </button>
            </div>
          </div>
        </div>
      </div>
      <CreateGroupFromLeadDialog
        open={createGroupOpen}
        onClose={() => {
          setCreateGroupOpen(false);
          onClose();
        }}
      />
    </>
  );
}

function MenuAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 rounded px-2 py-2 text-xs hover:bg-white/5"
    >
      <Icon className="w-3.5 h-3.5" style={{ color: "var(--chat-accent)" }} /> {label}
    </button>
  );
}

function SimpleFilterRail({
  label,
  options,
  active,
  onChange,
  emptyText,
}: {
  label: string;
  options: Array<{ id: string; name: string }>;
  active: string | null;
  onChange: (id: string | null) => void;
  emptyText: string;
}) {
  if (options.length === 0) {
    return (
      <div className="mt-3 text-[11px]" style={{ color: "var(--chat-meta)" }}>
        {emptyText}
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-1.5">
      <div className="text-[10px]" style={{ color: "var(--chat-meta)" }}>
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onChange(null)}
          className="text-[11px] rounded-full border px-2 py-1"
          style={{
            borderColor: active ? "var(--chat-divider)" : "var(--chat-accent)",
            color: active ? "var(--chat-text-muted)" : "var(--chat-accent)",
          }}
        >
          Todos
        </button>
        {options.map((o) => {
          const isActive = active === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onChange(isActive ? null : o.id)}
              className="text-[11px] rounded-full border px-2 py-1"
              style={{
                borderColor: isActive ? "var(--chat-accent)" : "var(--chat-divider)",
                color: isActive ? "var(--chat-accent)" : "var(--chat-text-muted)",
                backgroundColor: isActive
                  ? "color-mix(in oklch, var(--chat-accent) 18%, transparent)"
                  : "transparent",
              }}
            >
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LabelFilterRail({
  groups,
  activeLabel,
  onChange,
}: {
  groups: InboxLabelGroup[];
  activeLabel: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      <button
        onClick={() => onChange(null)}
        className="text-[11px] hover:underline"
        style={{ color: activeLabel ? "var(--chat-text-muted)" : "var(--chat-accent)" }}
      >
        Todas as etiquetas
      </button>
      {groups.map((group) => (
        <div key={group.id}>
          <div className="text-[10px] mb-1" style={{ color: "var(--chat-meta)" }}>
            {group.name}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.labels.map((label) => (
              <button
                key={label.id}
                onClick={() => onChange(activeLabel === label.id ? null : label.id)}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px]"
                style={{
                  borderColor: activeLabel === label.id ? label.color : "var(--chat-divider)",
                  backgroundColor:
                    activeLabel === label.id
                      ? `color-mix(in oklch, ${label.color} 18%, transparent)`
                      : "transparent",
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: label.color }} />{" "}
                {label.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConversationRow({
  conv,
  channel,
  active,
}: {
  conv: ChatConversation;
  channel: ChatChannel;
  active: boolean;
}) {
  const unread = conv.unreadCount ?? 0;
  const unanswered = conv.lastMessageFrom === "them"; // última mensagem foi do lead
  const waiting = unanswered && unread > 0;

  const to =
    channel === "leads"
      ? "/inbox/leads/$leadId"
      : channel === "equipe"
        ? "/inbox/equipe/$threadId"
        : "/inbox/suporte/$ticketId";
  const params =
    channel === "leads"
      ? { leadId: conv.id }
      : channel === "equipe"
        ? { threadId: conv.id }
        : { ticketId: conv.id };

  return (
    <Link
      to={to}
      params={params as never}
      className={cn("flex items-start gap-3 px-3 py-3 transition-colors cursor-pointer block")}
      style={{
        backgroundColor: active ? "var(--chat-panel-active)" : "transparent",
        borderBottom: "1px solid var(--chat-divider)",
      }}
    >
      <Avatar name={conv.name} isGroup={conv.isGroup} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-semibold truncate" style={{ color: "var(--chat-text)" }}>
              {conv.name}
            </span>
            {conv.ticketCode && (
              <span className="text-[10px] tabular-nums" style={{ color: "var(--chat-meta)" }}>
                {conv.ticketCode}
              </span>
            )}
          </div>
          <span
            className="text-[10px] tabular-nums shrink-0"
            style={{ color: waiting ? "var(--chat-accent)" : "var(--chat-meta)" }}
          >
            {chatPreviewTime(conv.lastMessageAt)}
          </span>
        </div>
        {conv.subtitle && (
          <div className="text-[10px] truncate mt-0.5" style={{ color: "var(--chat-meta)" }}>
            {conv.subtitle}
          </div>
        )}
        {channel === "leads" && conv.labels && conv.labels.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {conv.labels.slice(0, 3).map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px]"
                style={{
                  backgroundColor: "var(--chat-panel-hover)",
                  color: "var(--chat-text-muted)",
                }}
              >
                <Tag className="w-2.5 h-2.5" /> {label}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div
            className="text-[11px] truncate flex items-center gap-1"
            style={{ color: "var(--chat-text-muted)" }}
          >
            {conv.lastMessageFrom === "me" && (
              <CheckCheck className="w-3 h-3 shrink-0" style={{ color: "var(--chat-accent)" }} />
            )}
            <span className="truncate">{conv.lastMessagePreview}</span>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {unread > 0 && (
              <span
                className="text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center leading-none"
                style={{ backgroundColor: "var(--chat-unread)", color: "var(--chat-unread-fg)" }}
                title={`${unread} mensagem(ns) não lida(s)`}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
            {unanswered && (
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: "#f59e0b",
                  boxShadow: "0 0 0 2px color-mix(in oklab, #f59e0b 35%, transparent)",
                }}
                title="Conversa não respondida, última mensagem foi do lead"
              />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function Avatar({ name, isGroup }: { name: string; isGroup?: boolean }) {
  return (
    <div
      className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
      style={{
        backgroundColor: isGroup ? "var(--chat-group-avatar)" : "var(--chat-panel-hover)",
        color: isGroup ? "var(--chat-accent)" : "var(--chat-text)",
      }}
    >
      {isGroup ? "#" : initials(name)}
    </div>
  );
}

/* =================== Thread =================== */

function mergeThreadCacheRows<T extends { id: string; occurredAt: string }>(
  current: readonly T[],
  incoming: readonly T[],
): T[] {
  const byId = new Map<string, T>();
  for (const item of current) byId.set(item.id, item);
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort(
    (a, b) =>
      Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
      String(a.id).localeCompare(String(b.id)),
  );
}

function ChatThread({
  conversation,
  channel,
  cacheScope,
  onOpenProfile,
  profileOpen,
  listCollapsed,
  onToggleList,
  workspaceId,
}: {
  conversation: ChatConversation;
  channel: ChatChannel;
  cacheScope?: InboxCacheScope | null;
  onOpenProfile?: () => void;
  profileOpen?: boolean;
  listCollapsed?: boolean;
  onToggleList?: () => void;
  workspaceId?: string | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isLead = channel === "leads" && !conversation.isGroup;
  const isGroupThread = channel === "leads" && !!conversation.isGroup;
  const { wallpaper, setWallpaper } = useChatWallpaper();
  const loadActivities = useServerFn(listLeadActivities);
  const loadGroupMessages = useServerFn(listInboxGroupMessages);
  const loadDetail = useServerFn(getLeadDetail);
  const sendFn = useServerFn(sendLeadMessage);
  const markReadFn = useServerFn(markLeadConversationRead);
  type LeadActivityPage = Awaited<ReturnType<typeof loadActivities>>;
  type GroupMessagePage = Awaited<ReturnType<typeof loadGroupMessages>>;

  const activityThreadKey = `lead:${conversation.id}`;
  const groupThreadKey = `group:${conversation.id}`;
  const activityQueryKey = [
    "inbox",
    "activities",
    conversation.id,
    cacheScope?.userId,
    cacheScope?.workspaceId,
  ] as const;
  const groupQueryKey = [
    "inbox",
    "group-messages",
    conversation.id,
    conversation.groupJid,
    cacheScope?.userId,
    cacheScope?.workspaceId,
  ] as const;

  const [cachedActivityPage, setCachedActivityPage] = useState<LeadActivityPage | null>(null);
  const [activityCacheReady, setActivityCacheReady] = useState(!isLead);
  const [cachedGroupPage, setCachedGroupPage] = useState<GroupMessagePage | null>(null);
  const [groupCacheReady, setGroupCacheReady] = useState(!isGroupThread);
  const readMarkedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLead || !cacheScope || readMarkedRef.current === conversation.id) return;
    readMarkedRef.current = conversation.id;
    markReadFn({ data: { leadId: conversation.id } }).catch(() => {
      readMarkedRef.current = null;
    });
  }, [
    isLead,
    cacheScope?.userId,
    cacheScope?.workspaceId,
    conversation.id,
    markReadFn,
  ]);

  useEffect(() => {
    if (!isLead || !cacheScope) {
      setCachedActivityPage(null);
      setActivityCacheReady(true);
      return;
    }
    let cancelled = false;
    setActivityCacheReady(false);
    readInboxHotSnapshot<LeadActivityPage["activities"][number]>(cacheScope, activityThreadKey)
      .then((snapshot) => {
        if (cancelled) return;
        if (!snapshot) {
          setCachedActivityPage(null);
        } else {
          const oldest = snapshot.items[0] ?? null;
          setCachedActivityPage({
            activities: snapshot.items,
            hasMore: snapshot.hasMore,
            earliestAt: oldest?.occurredAt ?? new Date(0).toISOString(),
            nextCursor:
              snapshot.hasMore && oldest
                ? { occurredAt: oldest.occurredAt, id: oldest.id }
                : null,
          });
        }
        setActivityCacheReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setCachedActivityPage(null);
        setActivityCacheReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    isLead,
    activityThreadKey,
    cacheScope?.userId,
    cacheScope?.workspaceId,
  ]);

  useEffect(() => {
    if (!isGroupThread || !cacheScope) {
      setCachedGroupPage(null);
      setGroupCacheReady(true);
      return;
    }
    let cancelled = false;
    setGroupCacheReady(false);
    readInboxHotSnapshot<GroupMessagePage["messages"][number]>(cacheScope, groupThreadKey)
      .then((snapshot) => {
        if (cancelled) return;
        if (!snapshot) {
          setCachedGroupPage(null);
        } else {
          const oldest = snapshot.items[0] ?? null;
          setCachedGroupPage({
            messages: snapshot.items,
            hasMore: snapshot.hasMore,
            earliestAt: oldest?.occurredAt ?? new Date(0).toISOString(),
            nextCursor:
              snapshot.hasMore && oldest
                ? { occurredAt: oldest.occurredAt, id: oldest.id }
                : null,
          });
        }
        setGroupCacheReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setCachedGroupPage(null);
        setGroupCacheReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    isGroupThread,
    groupThreadKey,
    cacheScope?.userId,
    cacheScope?.workspaceId,
  ]);

  const sendingTextRef = useRef(false);

  const activitiesQ = useQuery({
    queryKey: activityQueryKey,
    queryFn: async (): Promise<LeadActivityPage> => {
      const previous =
        queryClient.getQueryData<LeadActivityPage>(activityQueryKey) ?? cachedActivityPage;
      const checkpoint = latestInboxCheckpoint(previous?.activities ?? []);
      if (!checkpoint) {
        return loadActivities({ data: { leadId: conversation.id, limit: 50 } });
      }

      const after = deltaCursorWithOverlap(checkpoint);
      if (!after) {
        return loadActivities({ data: { leadId: conversation.id, limit: 50 } });
      }
      const delta = await loadActivities({
        data: { leadId: conversation.id, after, limit: 200 },
      });
      // Se o delta saturar, não avance o checkpoint por timestamp: uma rajada com
      // empates poderia deixar itens para trás. Reancora na cabeça e deixa o
      // aquecimento por cursor composto recompor a janela quente em background.
      if (delta.hasMore || delta.activities.length >= 200) {
        return loadActivities({ data: { leadId: conversation.id, limit: 50 } });
      }
      const activities = mergeInboxHotItems(previous?.activities ?? [], delta.activities);
      const oldest = activities[0] ?? null;
      return {
        activities,
        hasMore: previous?.hasMore ?? delta.hasMore,
        earliestAt: oldest?.occurredAt ?? previous?.earliestAt ?? delta.earliestAt,
        nextCursor:
          (previous?.hasMore ?? delta.hasMore) && oldest
            ? { occurredAt: oldest.occurredAt, id: oldest.id }
            : null,
      };
    },
    enabled: isLead && activityCacheReady && Boolean(cacheScope),
    staleTime: 10_000,
  });

  const groupMessagesQ = useQuery({
    queryKey: groupQueryKey,
    queryFn: async (): Promise<GroupMessagePage> => {
      const previous =
        queryClient.getQueryData<GroupMessagePage>(groupQueryKey) ?? cachedGroupPage;
      const checkpoint = latestInboxCheckpoint(previous?.messages ?? []);
      if (!checkpoint) {
        return loadGroupMessages({
          data: { groupId: conversation.id, groupJid: conversation.groupJid, limit: 50 },
        });
      }

      const after = deltaCursorWithOverlap(checkpoint);
      if (!after) {
        return loadGroupMessages({
          data: { groupId: conversation.id, groupJid: conversation.groupJid, limit: 50 },
        });
      }
      const delta = await loadGroupMessages({
        data: {
          groupId: conversation.id,
          groupJid: conversation.groupJid,
          after,
          limit: 200,
        },
      });
      if (delta.hasMore || delta.messages.length >= 200) {
        return loadGroupMessages({
          data: { groupId: conversation.id, groupJid: conversation.groupJid, limit: 50 },
        });
      }
      const messages = mergeInboxHotItems(previous?.messages ?? [], delta.messages);
      const oldest = messages[0] ?? null;
      return {
        messages,
        hasMore: previous?.hasMore ?? delta.hasMore,
        earliestAt: oldest?.occurredAt ?? previous?.earliestAt ?? delta.earliestAt,
        nextCursor:
          (previous?.hasMore ?? delta.hasMore) && oldest
            ? { occurredAt: oldest.occurredAt, id: oldest.id }
            : null,
      };
    },
    enabled: isGroupThread && groupCacheReady && Boolean(cacheScope),
    staleTime: 10_000,
  });

  const effectiveActivityPage = activitiesQ.data ?? cachedActivityPage;
  const effectiveGroupPage = groupMessagesQ.data ?? cachedGroupPage;

  useEffect(() => {
    if (!isLead || !cacheScope || !effectiveActivityPage) return;
    const activities = mergeInboxHotItems([], effectiveActivityPage.activities);
    if (activities.length > 0) {
      const oldest = activities[0];
      const next: LeadActivityPage = {
        ...effectiveActivityPage,
        activities,
        earliestAt: oldest.occurredAt,
        nextCursor:
          effectiveActivityPage.hasMore
            ? { occurredAt: oldest.occurredAt, id: oldest.id }
            : null,
      };
      setCachedActivityPage(next);
      void writeInboxHotSnapshot(cacheScope, activityThreadKey, {
        items: activities,
        hasMore: next.hasMore,
        earliestAt: next.earliestAt,
        checkpoint: latestInboxCheckpoint(activities),
      });
    }
  }, [
    isLead,
    cacheScope?.userId,
    cacheScope?.workspaceId,
    activityThreadKey,
    activitiesQ.data,
  ]);

  useEffect(() => {
    if (!isGroupThread || !cacheScope || !effectiveGroupPage) return;
    const messages = mergeInboxHotItems([], effectiveGroupPage.messages);
    if (messages.length > 0) {
      const oldest = messages[0];
      const next: GroupMessagePage = {
        ...effectiveGroupPage,
        messages,
        earliestAt: oldest.occurredAt,
        nextCursor:
          effectiveGroupPage.hasMore
            ? { occurredAt: oldest.occurredAt, id: oldest.id }
            : null,
      };
      setCachedGroupPage(next);
      void writeInboxHotSnapshot(cacheScope, groupThreadKey, {
        items: messages,
        hasMore: next.hasMore,
        earliestAt: next.earliestAt,
        checkpoint: latestInboxCheckpoint(messages),
      });
    }
  }, [
    isGroupThread,
    cacheScope?.userId,
    cacheScope?.workspaceId,
    groupThreadKey,
    groupMessagesQ.data,
  ]);

  // A F2 mantém o primeiro paint paginado. Depois dele, a janela quente de 7 dias
  // é aquecida em background com o mesmo cursor composto, sem reintroduzir uma leitura
  // integral no caminho crítico.
  useEffect(() => {
    if (!isLead || !cacheScope || !effectiveActivityPage?.hasMore) return;
    const cutoff = Date.now() - INBOX_HOT_RETENTION_MS;
    const oldest = effectiveActivityPage.activities[0];
    if (!oldest || Date.parse(oldest.occurredAt) <= cutoff) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        let cursor: { occurredAt: string; id: string } | null =
          effectiveActivityPage.nextCursor ??
          { occurredAt: oldest.occurredAt, id: oldest.id };
        let accumulated = effectiveActivityPage.activities;

        for (let page = 0; page < 50 && cursor && !cancelled; page += 1) {
          const result = await loadActivities({
            data: { leadId: conversation.id, cursor, limit: 200 },
          });
          const warm = result.activities.filter(
            (item) => Date.parse(item.occurredAt) >= cutoff,
          );
          accumulated = mergeInboxHotItems(accumulated, warm);
          const currentOldest = accumulated[0] ?? null;
          const next: LeadActivityPage = {
            activities: accumulated,
            hasMore: result.hasMore || result.activities.some(
              (item) => Date.parse(item.occurredAt) < cutoff,
            ),
            earliestAt: currentOldest?.occurredAt ?? null,
            nextCursor:
              currentOldest
                ? { occurredAt: currentOldest.occurredAt, id: currentOldest.id }
                : null,
          };
          queryClient.setQueryData(activityQueryKey, next);
          setCachedActivityPage(next);
          void writeInboxHotSnapshot(cacheScope, activityThreadKey, {
            items: accumulated,
            hasMore: next.hasMore,
            earliestAt: next.earliestAt,
            checkpoint: latestInboxCheckpoint(accumulated),
          });

          const fetchedOldest = result.activities[0] ?? null;
          if (
            !result.hasMore ||
            !fetchedOldest ||
            Date.parse(fetchedOldest.occurredAt) <= cutoff
          ) {
            break;
          }
          cursor = result.nextCursor ?? null;
        }
      })().catch(() => undefined);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    isLead,
    conversation.id,
    cacheScope?.userId,
    cacheScope?.workspaceId,
    effectiveActivityPage?.earliestAt,
  ]);

  useEffect(() => {
    if (!isGroupThread || !cacheScope || !effectiveGroupPage?.hasMore) return;
    const cutoff = Date.now() - INBOX_HOT_RETENTION_MS;
    const oldest = effectiveGroupPage.messages[0];
    if (!oldest || Date.parse(oldest.occurredAt) <= cutoff) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        let cursor: { occurredAt: string; id: string } | null =
          effectiveGroupPage.nextCursor ??
          { occurredAt: oldest.occurredAt, id: oldest.id };
        let accumulated = effectiveGroupPage.messages;

        for (let page = 0; page < 50 && cursor && !cancelled; page += 1) {
          const result = await loadGroupMessages({
            data: {
              groupId: conversation.id,
              groupJid: conversation.groupJid,
              cursor,
              limit: 200,
            },
          });
          const warm = result.messages.filter(
            (item) => Date.parse(item.occurredAt) >= cutoff,
          );
          accumulated = mergeInboxHotItems(accumulated, warm);
          const currentOldest = accumulated[0] ?? null;
          const next: GroupMessagePage = {
            messages: accumulated,
            hasMore: result.hasMore || result.messages.some(
              (item) => Date.parse(item.occurredAt) < cutoff,
            ),
            earliestAt: currentOldest?.occurredAt ?? null,
            nextCursor:
              currentOldest
                ? { occurredAt: currentOldest.occurredAt, id: currentOldest.id }
                : null,
          };
          queryClient.setQueryData(groupQueryKey, next);
          setCachedGroupPage(next);
          void writeInboxHotSnapshot(cacheScope, groupThreadKey, {
            items: accumulated,
            hasMore: next.hasMore,
            earliestAt: next.earliestAt,
            checkpoint: latestInboxCheckpoint(accumulated),
          });

          const fetchedOldest = result.messages[0] ?? null;
          if (
            !result.hasMore ||
            !fetchedOldest ||
            Date.parse(fetchedOldest.occurredAt) <= cutoff
          ) {
            break;
          }
          cursor = result.nextCursor ?? null;
        }
      })().catch(() => undefined);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    isGroupThread,
    conversation.id,
    conversation.groupJid,
    cacheScope?.userId,
    cacheScope?.workspaceId,
    effectiveGroupPage?.earliestAt,
  ]);

  const [olderActivities, setOlderActivities] = useState<LeadActivityPage["activities"]>([]);
  const [activitiesHasMore, setActivitiesHasMore] = useState(false);
  const [activitiesCursor, setActivitiesCursor] = useState<
    { occurredAt: string; id: string } | null
  >(null);
  const [olderGroupMessages, setOlderGroupMessages] = useState<GroupMessagePage["messages"]>([]);
  const [groupMessagesHasMore, setGroupMessagesHasMore] = useState(false);
  const [groupMessagesCursor, setGroupMessagesCursor] = useState<
    { occurredAt: string; id: string } | null
  >(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const detailQ = useQuery({
    queryKey: [
      "inbox",
      "detail",
      conversation.id,
      cacheScope?.userId,
      cacheScope?.workspaceId,
    ],
    queryFn: () =>
      loadDetail({ data: { leadId: conversation.id, includeActivities: false } }),
    enabled: isLead && Boolean(cacheScope),
    staleTime: 30_000,
  });
  const detail = detailQ.data as LeadDetailResponse | undefined;

  useEffect(() => {
    setOlderActivities([]);
    setActivitiesHasMore(effectiveActivityPage?.hasMore ?? false);
    setActivitiesCursor(effectiveActivityPage?.nextCursor ?? null);
  }, [
    conversation.id,
    effectiveActivityPage?.hasMore,
    effectiveActivityPage?.nextCursor?.occurredAt,
    effectiveActivityPage?.nextCursor?.id,
    cacheScope?.userId,
    cacheScope?.workspaceId,
  ]);

  useEffect(() => {
    setOlderGroupMessages([]);
    setGroupMessagesHasMore(effectiveGroupPage?.hasMore ?? false);
    setGroupMessagesCursor(effectiveGroupPage?.nextCursor ?? null);
  }, [
    conversation.id,
    effectiveGroupPage?.hasMore,
    effectiveGroupPage?.nextCursor?.occurredAt,
    effectiveGroupPage?.nextCursor?.id,
    cacheScope?.userId,
    cacheScope?.workspaceId,
  ]);

  async function loadMoreActivities() {
    const cursor = activitiesCursor ?? effectiveActivityPage?.nextCursor ?? null;
    if (!cursor || (!activitiesHasMore && !(effectiveActivityPage?.hasMore ?? false))) return;
    const anchor = `${cursor.occurredAt}:${cursor.id}`;
    setLoadingOlder(true);
    let cacheHit = false;
    try {
      if (cacheScope) {
        const cached = await readInboxColdPage<LeadActivityPage>(
          cacheScope,
          activityThreadKey,
          anchor,
        );
        if (cached) {
          cacheHit = true;
          setOlderActivities((previous) =>
            mergeThreadCacheRows(previous, cached.activities),
          );
          setActivitiesHasMore(cached.hasMore);
          setActivitiesCursor(cached.nextCursor ?? null);
        }
      }

      try {
        const result = await loadActivities({
          data: { leadId: conversation.id, cursor },
        });
        setOlderActivities((previous) =>
          mergeThreadCacheRows(previous, result.activities),
        );
        setActivitiesHasMore(result.hasMore);
        setActivitiesCursor(result.nextCursor ?? null);
        if (cacheScope) {
          void writeInboxColdPage(cacheScope, activityThreadKey, anchor, result);
        }
      } catch {
        if (!cacheHit) toast.error("Não foi possível carregar mensagens anteriores.");
      }
    } finally {
      setLoadingOlder(false);
    }
  }

  async function loadMoreGroupMessages() {
    const cursor = groupMessagesCursor ?? effectiveGroupPage?.nextCursor ?? null;
    if (!cursor || (!groupMessagesHasMore && !(effectiveGroupPage?.hasMore ?? false))) return;
    const anchor = `${cursor.occurredAt}:${cursor.id}`;
    setLoadingOlder(true);
    let cacheHit = false;
    try {
      if (cacheScope) {
        const cached = await readInboxColdPage<GroupMessagePage>(
          cacheScope,
          groupThreadKey,
          anchor,
        );
        if (cached) {
          cacheHit = true;
          setOlderGroupMessages((previous) =>
            mergeThreadCacheRows(previous, cached.messages),
          );
          setGroupMessagesHasMore(cached.hasMore);
          setGroupMessagesCursor(cached.nextCursor ?? null);
        }
      }

      try {
        const result = await loadGroupMessages({
          data: {
            groupId: conversation.id,
            groupJid: conversation.groupJid,
            cursor,
          },
        });
        setOlderGroupMessages((previous) =>
          mergeThreadCacheRows(previous, result.messages),
        );
        setGroupMessagesHasMore(result.hasMore);
        setGroupMessagesCursor(result.nextCursor ?? null);
        if (cacheScope) {
          void writeInboxColdPage(cacheScope, groupThreadKey, anchor, result);
        }
      } catch {
        if (!cacheHit) toast.error("Não foi possível carregar mensagens anteriores.");
      }
    } finally {
      setLoadingOlder(false);
    }
  }

  const [pickerOpen, setPickerOpen] = useState<string | null>(null);
  const isLoadingOlder = loadingOlder;
  const hasOlder = isLead ? activitiesHasMore : isGroupThread ? groupMessagesHasMore : false;


  // Thread Realtime incremental: aplica INSERT/UPDATE diretamente no cache da
  // conversa aberta. Não invalida a lista nem refaz a primeira página.
  useEffect(() => {
    if (!isLead && !isGroupThread) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const applyLeadActivity = (record: Record<string, any>, isUpdate: boolean) => {
      const payload =
        record.payload && typeof record.payload === "object"
          ? (record.payload as Record<string, unknown>)
          : null;
      const activity = {
        id: String(record.id ?? ""),
        type: String(record.type ?? ""),
        text: typeof payload?.text === "string" ? payload.text : null,
        mediaUrl: typeof payload?.media_url === "string" ? payload.media_url : null,
        mediaType: typeof payload?.media_type === "string" ? payload.media_type : null,
        mimeType: typeof payload?.mime_type === "string" ? payload.mime_type : null,
        fileName: typeof payload?.file_name === "string" ? payload.file_name : null,
        durationSeconds:
          typeof payload?.duration_seconds === "number" ? payload.duration_seconds : null,
        whatsappMessageId:
          typeof payload?.whatsapp_message_id === "string"
            ? payload.whatsapp_message_id
            : null,
        reactions: Array.isArray(payload?.reactions) ? payload.reactions : [],
        deletedForMe: payload?.deleted_for_me === true,
        deletedForAll: payload?.deleted_for_all === true,
        from:
          record.type === "message_out" || record.type === "note"
            ? ("us" as const)
            : ("lead" as const),
        occurredAt:
          typeof record.occurred_at === "string"
            ? record.occurred_at
            : new Date().toISOString(),
        error: typeof payload?.error === "string" ? payload.error : null,
      };
      if (!activity.id) return;

      queryClient.setQueryData(activityQueryKey, (current: any) => {
        if (!current?.activities) return current;
        const existingIndex = current.activities.findIndex(
          (item: any) =>
            item.id === activity.id ||
            (activity.whatsappMessageId &&
              item.whatsappMessageId === activity.whatsappMessageId),
        );
        if (existingIndex >= 0) {
          const activities = current.activities.slice();
          activities[existingIndex] = { ...activities[existingIndex], ...activity };
          return { ...current, activities };
        }
        if (isUpdate) return current;
        const activities = [...current.activities, activity].sort(
          (a: any, b: any) =>
            Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
            String(a.id).localeCompare(String(b.id)),
        );
        return { ...current, activities };
      });

      if (isUpdate) {
        setOlderActivities((previous) =>
          previous.map((item) =>
            item.id === activity.id ||
            (activity.whatsappMessageId &&
              item.whatsappMessageId === activity.whatsappMessageId)
              ? ({ ...item, ...activity } as typeof item)
              : item,
          ),
        );
      }
    };

    const applyGroupMessage = (record: Record<string, any>, isUpdate: boolean) => {
      if (record.remote_jid !== conversation.groupJid) return;
      const message = {
        id: String(record.id ?? ""),
        from: record.from_me ? ("us" as const) : ("lead" as const),
        author: typeof record.sender_name === "string" ? record.sender_name : undefined,
        text:
          typeof record.body === "string" && record.body.trim()
            ? record.body
            : realtimeMessagePreview(
                { media_type: record.message_type },
                record.from_me ? "message_out" : "message_in",
              ),
        mediaUrl: typeof record.media_url === "string" ? record.media_url : null,
        mediaType: typeof record.message_type === "string" ? record.message_type : null,
        mimeType: null,
        fileName: null,
        whatsappMessageId:
          typeof record.message_id === "string" ? record.message_id : null,
        occurredAt:
          typeof record.received_at === "string"
            ? record.received_at
            : new Date().toISOString(),
      };
      if (!message.id) return;

      queryClient.setQueryData(groupQueryKey, (current: any) => {
        if (!current?.messages) return current;
        const existingIndex = current.messages.findIndex(
          (item: any) =>
            item.id === message.id ||
            (message.whatsappMessageId &&
              item.whatsappMessageId === message.whatsappMessageId),
        );
        if (existingIndex >= 0) {
          const messages = current.messages.slice();
          messages[existingIndex] = { ...messages[existingIndex], ...message };
          return { ...current, messages };
        }
        if (isUpdate) return current;
        const messages = [...current.messages, message].sort(
          (a: any, b: any) =>
            Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
            String(a.id).localeCompare(String(b.id)),
        );
        return { ...current, messages };
      });

      if (isUpdate) {
        setOlderGroupMessages((previous) =>
          previous.map((item) =>
            item.id === message.id ||
            (message.whatsappMessageId &&
              item.whatsappMessageId === message.whatsappMessageId)
              ? ({ ...item, ...message } as typeof item)
              : item,
          ),
        );
      }
    };

    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      if (cancelled) return;
      let realtimeChannel = supabase.channel(
        `inbox-thread-${conversation.id}-${conversation.groupJid ?? "lead"}`,
      );

      if (isLead) {
        realtimeChannel = realtimeChannel
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "lead_activities",
              filter: `lead_id=eq.${conversation.id}`,
            },
            (payload) => applyLeadActivity(payload.new as Record<string, any>, false),
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "lead_activities",
              filter: `lead_id=eq.${conversation.id}`,
            },
            (payload) => applyLeadActivity(payload.new as Record<string, any>, true),
          );
      } else if (isGroupThread && conversation.groupJid) {
        realtimeChannel = realtimeChannel
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "whatsapp_web_messages",
              filter: `remote_jid=eq.${conversation.groupJid}`,
            },
            (payload) => applyGroupMessage(payload.new as Record<string, any>, false),
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "whatsapp_web_messages",
              filter: `remote_jid=eq.${conversation.groupJid}`,
            },
            (payload) => applyGroupMessage(payload.new as Record<string, any>, true),
          );
      }

      realtimeChannel.subscribe();
      cleanup = () => {
        supabase.removeChannel(realtimeChannel);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [
    isLead,
    isGroupThread,
    conversation.id,
    conversation.groupJid,
    workspaceId,
    queryClient,
  ]);

  const sendGroupFn = useServerFn(sendGroupMessage);
  const sendGroupMediaFn = useServerFn(sendGroupMedia);

  const sendMut = useMutation({
    mutationFn: (text: string) => {
      if (isGroupThread) {
        return sendGroupFn({
          data: { groupId: conversation.id, groupJid: conversation.groupJid, text },
        });
      }
      return sendFn({
        data: { leadId: conversation.id, text, clientRequestId: crypto.randomUUID() },
      });
    },
    onSuccess: () => {
      // O servidor persiste a mensagem antes de responder e o Realtime acima a
      // aplica incrementalmente. Não roda sync global nem invalida a lista inteira.
    },
    onSettled: () => {
      sendingTextRef.current = false;
    },
  });

  const sendMediaFn = useServerFn(sendLeadMedia);
  const mediaMut = useMutation({
    mutationFn: async (file: File) => {
      const kind: "image" | "video" | "audio" | "document" = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
            ? "audio"
            : "document";
      const buf = await file.arrayBuffer();
      // btoa on large binary, chunk to avoid stack overflow
      let bin = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(bin);
      if (isGroupThread) {
        return sendGroupMediaFn({
          data: {
            groupId: conversation.id,
            groupJid: conversation.groupJid,
            kind,
            mimeType: file.type || "application/octet-stream",
            fileName: file.name || `arquivo-${Date.now()}`,
            base64,
            caption: draft.trim() || undefined,
          },
        });
      }
      return sendMediaFn({
        data: {
          leadId: conversation.id,
          kind,
          mimeType: file.type || "application/octet-stream",
          fileName: file.name || `arquivo-${Date.now()}`,
          base64,
          caption: draft.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      setDraft("");
      if (isGroupThread) {
        queryClient.invalidateQueries({
          queryKey: ["inbox", "group-messages", conversation.id, conversation.groupJid],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["inbox", "activities", conversation.id] });
      }
    },
  });

  const reactionFn = useServerFn(sendLeadReaction);
  const reactionMut = useMutation({
    mutationFn: (v: { activityId: string; emoji: string }) =>
      reactionFn({ data: { leadId: conversation.id, activityId: v.activityId, emoji: v.emoji } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox", "activities", conversation.id] });
    },
    onError: (e) => alert(`Falha ao reagir: ${e instanceof Error ? e.message : "erro"}`),
  });

  const deleteFn = useServerFn(deleteLeadMessage);
  const deleteMut = useMutation({
    mutationFn: (v: { activityId: string; forEveryone: boolean }) =>
      deleteFn({
        data: { leadId: conversation.id, activityId: v.activityId, forEveryone: v.forEveryone },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox", "activities", conversation.id] });
    },
    onError: (e) => alert(`Falha ao excluir: ${e instanceof Error ? e.message : "erro"}`),
  });

  const transcribeFn = useServerFn(transcribeLeadAudio);
  const transcribeMut = useMutation({
    mutationFn: (v: { leadId: string; activityId: string }) => transcribeFn({ data: v }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox", "activities", conversation.id] });
    },
    onError: (e) => alert(`Falha ao transcrever: ${e instanceof Error ? e.message : "erro"}`),
  });

  // Gravação de áudio (Mic)
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  async function toggleRecord() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
        mediaMut.mutate(file);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      alert("Não foi possível acessar o microfone.");
    }
  }

  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [formMenuOpen, setFormMenuOpen] = useState(false);
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  const loadForms = useServerFn(listForms);
  const formsQ = useQuery<FormRecord[]>({
    queryKey: ["inbox", "forms-list"],
    queryFn: () => loadForms({}) as Promise<FormRecord[]>,
    staleTime: 60_000,
    enabled: isLead,
  });
  const availableForms: FormRecord[] = formsQ.data ?? [];

  function handleSendFormByWhatsApp(formId: string) {
    const form = availableForms.find((f) => f.id === formId);
    if (!form) return;
    const link = buildFormShareUrl(form.slug, conversation.id);
    const nome = detail?.lead?.name ?? conversation.name ?? null;
    const text = renderFormMessage(DEFAULT_FORM_MESSAGE_TEMPLATE, { nome, link });
    setFormMenuOpen(false);
    sendingTextRef.current = true;
    sendMut.mutate(text, {
      onSuccess: () => {
        setFormFeedback(`Formulário "${form.nome}" enviado por WhatsApp.`);
        setTimeout(() => setFormFeedback(null), 3500);
      },
    });
  }

  function handleCopyFormLink(formId: string) {
    const form = availableForms.find((f) => f.id === formId);
    if (!form) return;
    const link = buildFormShareUrl(form.slug, conversation.id);
    try {
      navigator.clipboard.writeText(link);
      setFormFeedback(`Link do "${form.nome}" copiado.`);
      setTimeout(() => setFormFeedback(null), 3500);
    } catch {
      setFormFeedback(link);
    }
    setFormMenuOpen(false);
  }
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft("");
  }, [conversation.id]);

  // Construir mensagens a partir de atividades reais (leads) ou do mock (equipe/suporte)
  const allMsgs: ChatMessage[] = useMemo(() => {
    if (isGroupThread) {
      const messages = [...olderGroupMessages, ...(effectiveGroupPage?.messages ?? [])];
      const seen = new Set<string>();
      const unique: typeof messages = [];
      for (const m of messages) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        unique.push(m);
      }
      return unique.map((m) => ({
        id: m.id,
        from: m.from === "us" ? "me" : "them",
        author: m.author,
        text: m.text ?? undefined,
        mediaUrl: m.mediaUrl ?? null,
        mediaType: m.mediaType ?? null,
        mimeType: m.mimeType ?? null,
        fileName: m.fileName ?? null,
        whatsappMessageId: m.whatsappMessageId ?? null,
        sentAt: m.occurredAt,
      }));
    }
    if (!isLead) return conversation.messages;
    const acts = [...olderActivities, ...(effectiveActivityPage?.activities ?? [])];
    const seen = new Set<string>();
    const unique: typeof acts = [];
    for (const a of acts) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      unique.push(a);
    }
    return unique.map((a) => ({
      id: a.id,
      from: a.from === "us" ? "me" : "them",
      text:
        a.type === "note"
          ? `📝 Nota interna${a.text ? ` — ${a.text}` : ""}`
          : (a.text ?? (a.mediaUrl ? undefined : a.error ? `⚠️ ${a.error}` : `(${a.type})`)),

      mediaUrl: a.mediaUrl ?? null,
      mediaType: a.mediaType ?? null,
      mimeType: a.mimeType ?? null,
      fileName: a.fileName ?? null,
      audioSeconds: a.durationSeconds ?? undefined,
      transcription: (a as any).payload?.transcription ?? undefined,
      reactions: a.reactions ?? [],
      whatsappMessageId: a.whatsappMessageId ?? null,
      deletedForMe: a.deletedForMe === true,
      deletedForAll: a.deletedForAll === true,
      sentAt: a.occurredAt,
    }));
  }, [
    isLead,
    isGroupThread,
    conversation.messages,
    effectiveActivityPage,
    effectiveGroupPage,
    olderActivities,
    olderGroupMessages,
  ]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMsgs.length]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    if (sendMut.isPending || sendingTextRef.current) return;
    if (isLead || isGroupThread) {
      sendingTextRef.current = true;
      sendMut.mutate(text);
      setDraft("");
    }
  }
  const canSend = isLead || isGroupThread;

  const grouped: { day: string; items: ChatMessage[] }[] = [];
  for (const m of allMsgs) {
    const label = chatDayLabel(m.sentAt);
    const last = grouped[grouped.length - 1];
    if (!last || last.day !== label) grouped.push({ day: label, items: [m] });
    else last.items.push(m);
  }

  const whatsappUrl = detail?.lead.whatsappUrl ?? null;
  const leadName = detail?.lead.name ?? conversation.name;
  const leadSubtitle = detail?.lead
    ? [detail.lead.phone, detail.lead.stageName].filter(Boolean).join(" · ") ||
      detail.lead.email ||
      conversation.subtitle
    : conversation.subtitle;

  return (
    <>
      {/* Header */}
      <div
        className="h-16 px-5 flex items-center gap-3 shrink-0"
        style={{
          backgroundColor: "var(--chat-panel)",
          borderBottom: "1px solid var(--chat-divider)",
        }}
      >
        <button
          type="button"
          className="md:hidden w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5"
          aria-label="Voltar"
          onClick={() =>
            navigate({
              to:
                channel === "leads"
                  ? "/inbox/leads"
                  : channel === "equipe"
                    ? "/inbox/equipe"
                    : "/inbox/suporte",
            })
          }
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Avatar name={leadName} isGroup={conversation.isGroup} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate flex items-center gap-2">
            {leadName}
            {conversation.ticketCode && (
              <span
                className="text-[10px] tabular-nums px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "var(--chat-bg)", color: "var(--chat-meta)" }}
              >
                {conversation.ticketCode}
              </span>
            )}
          </div>
          <div
            className="text-[11px] flex items-center gap-2"
            style={{ color: "var(--chat-meta)" }}
          >
            <StatusDot status={conversation.status} />
            <StatusLabel status={conversation.status} subtitle={leadSubtitle} />
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1">
          {isLead &&
            (whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 border hover:opacity-90 transition-opacity"
                style={{
                  borderColor: "var(--chat-divider)",
                  color: "var(--chat-text)",
                  backgroundColor: "var(--chat-panel)",
                }}
                title="Abrir conversa no WhatsApp Web/Desktop"
              >
                <MessageCircle className="w-3.5 h-3.5" style={{ color: "var(--chat-accent)" }} />{" "}
                Abrir WhatsApp Web
              </a>
            ) : (
              <span
                className="h-8 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 border opacity-60 cursor-not-allowed"
                style={{
                  borderColor: "var(--chat-divider)",
                  color: "var(--chat-text-muted)",
                  backgroundColor: "var(--chat-panel)",
                }}
                title="Sem número de WhatsApp neste lead. Adicione o número do lead pra abrir o WhatsApp aqui."
              >
                <MessageCircle className="w-3.5 h-3.5" /> Abrir WhatsApp Web
              </span>
            ))}

          {channel === "suporte" && conversation.status !== "resolvido" && (
            <button
              className="h-8 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--chat-accent)", color: "var(--chat-accent-fg)" }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Marcar resolvido
            </button>
          )}
          {channel === "equipe" && (
            <IconBtn label="Chamada">
              <Phone className="w-4 h-4" />
            </IconBtn>
          )}
          <IconBtn label="Buscar na conversa">
            <Search className="w-4 h-4" />
          </IconBtn>
          <ThreadMoreMenu
            onOpenProfile={onOpenProfile}
            profileOpen={profileOpen}
            channel={channel}
            wallpaper={wallpaper}
            onChangeWallpaper={setWallpaper}
          />
        </div>
      </div>




      {/* Mensagens do histórico do WhatsApp / canais nativos */}

      {/* Área de mensagens com botão lateral de perfil */}
      <div className="relative flex-1 min-h-0">
        {/* Mensagens */}
        <div
          ref={scrollRef}
          data-chat-thread-bg
          data-chat-wallpaper={wallpaper}
          className="absolute inset-0 overflow-y-auto px-6 py-5 space-y-4"
        >
          {(hasOlder || isLoadingOlder) && (isLead || isGroupThread) && (
            <div className="flex justify-center pb-2">
              <button
                onClick={() => {
                  if (isLead) void loadMoreActivities();
                  if (isGroupThread) void loadMoreGroupMessages();
                }}
                disabled={isLoadingOlder}
                className="text-[11px] px-3 py-1.5 rounded-full border hover:bg-accent transition-colors disabled:opacity-50"
                style={{
                  borderColor: "var(--chat-divider)",
                  color: "var(--chat-meta)",
                  backgroundColor: "var(--chat-panel)",
                }}
              >
                {isLoadingOlder ? "Carregando…" : "Carregar mais histórico"}
              </button>
            </div>
          )}
          {isLead && activitiesQ.isLoading && (
            <div className="text-center text-[11px]" style={{ color: "var(--chat-meta)" }}>
              Carregando histórico…
            </div>
          )}
          {isGroupThread && groupMessagesQ.isLoading && (
            <div className="text-center text-[11px]" style={{ color: "var(--chat-meta)" }}>
              Carregando mensagens do grupo…
            </div>
          )}
          {isLead && !activitiesQ.isLoading && allMsgs.length === 0 && (
            <div className="text-center text-[11px]" style={{ color: "var(--chat-meta)" }}>
              Nenhuma atividade ainda. Envie a primeira mensagem.
            </div>
          )}
          {isGroupThread && !groupMessagesQ.isLoading && allMsgs.length === 0 && (
            <div className="text-center text-[11px]" style={{ color: "var(--chat-meta)" }}>
              Nenhuma mensagem de grupo encontrada ainda.
            </div>
          )}
          {grouped.map((g) => (
            <div key={g.day} className="space-y-2">
              <div className="flex justify-center">
                <span
                  className="text-[10px] px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: "var(--chat-panel)", color: "var(--chat-meta)" }}
                >
                  {g.day}
                </span>
              </div>
              {g.items.map((m) => (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  isGroup={conversation.isGroup}
                  leadId={isLead ? conversation.id : undefined}
                  onReact={
                    isLead && m.whatsappMessageId
                      ? (emoji) => reactionMut.mutate({ activityId: m.id, emoji })
                      : undefined
                  }
                  onDelete={
                    isLead
                      ? (forEveryone) => deleteMut.mutate({ activityId: m.id, forEveryone })
                      : undefined
                  }
                  onTranscribe={
                    isLead && m.audioSeconds && !(m as any).transcription
                      ? () => transcribeMut.mutate({ leadId: conversation.id, activityId: m.id })
                      : undefined
                  }
                  isTranscribing={transcribeMut.isPending && transcribeMut.variables?.activityId === m.id}
                  pickerOpen={pickerOpen}
                  setPickerOpen={setPickerOpen}
                />

              ))}
            </div>
          ))}
        </div>
      </div>

      {sendMut.error && (
        <div
          className="px-5 py-1.5 text-[11px]"
          style={{ backgroundColor: "oklch(0.42 0.16 27 / 0.18)", color: "var(--chat-text)" }}
        >
          Falha ao enviar:{" "}
          {sendMut.error instanceof Error ? sendMut.error.message : "erro desconhecido"}
        </div>
      )}

      {/* Composer */}
      {false ? null : (
        <div
          className="group relative px-4 py-3 flex items-center gap-2 shrink-0"
          style={{
            backgroundColor: "var(--chat-panel)",
            borderTop: "1px solid var(--chat-divider)",
          }}
        >
          {/* Botões discretos: recolher lista + perfil do lead (aparecem no hover) */}
          {onToggleList && (
            <button
              type="button"
              onClick={onToggleList}
              aria-label={
                listCollapsed ? "Mostrar lista de conversas" : "Ocultar lista de conversas"
              }
              title={listCollapsed ? "Mostrar lista" : "Ocultar lista"}
              className="h-7 w-7 rounded-md flex items-center justify-center opacity-30 group-hover:opacity-100 hover:bg-white/10 transition-opacity"
              style={{ color: "var(--chat-text-muted, var(--chat-meta))" }}
            >
              {listCollapsed ? (
                <PanelLeftOpen className="w-3.5 h-3.5" />
              ) : (
                <PanelLeftClose className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          {isLead && onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              aria-label={profileOpen ? "Ocultar perfil do lead" : "Ver perfil do lead"}
              title={profileOpen ? "Ocultar perfil" : "Ver perfil do lead"}
              className="h-7 w-7 rounded-md flex items-center justify-center opacity-30 group-hover:opacity-100 hover:bg-white/10 transition-opacity"
              style={{
                color: profileOpen
                  ? "var(--chat-accent)"
                  : "var(--chat-text-muted, var(--chat-meta))",
              }}
            >
              <User className="w-3.5 h-3.5" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (fileInputRef.current) fileInputRef.current.value = "";
              if (!file || !canSend) return;
              if (file.size > 16 * 1024 * 1024) {
                alert("Arquivo acima de 16MB. WhatsApp não aceita esse tamanho.");
                return;
              }
              mediaMut.mutate(file);
            }}
          />
          <IconBtn
            label={mediaMut.isPending ? "Enviando arquivo…" : "Anexar arquivo"}
            onClick={() => fileInputRef.current?.click()}
            disabled={!canSend || mediaMut.isPending || recording}
          >
            <Paperclip className="w-4 h-4" />
          </IconBtn>
          <IconBtn label="Emoji" onClick={() => setEmojiOpen((v) => !v)}>
            <Smile className="w-4 h-4" />
          </IconBtn>

          <div className="relative">
            <IconBtn
              label="Enviar formulário"
              onClick={() => setFormMenuOpen((v) => !v)}
              disabled={!isLead || sendMut.isPending}
            >
              <FileText className="w-4 h-4" />
            </IconBtn>
            {formMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFormMenuOpen(false)} />
                <div
                  className="absolute bottom-full left-0 mb-2 z-50 w-72 rounded-lg border shadow-lg overflow-hidden"
                  style={{
                    backgroundColor: "var(--chat-bg)",
                    borderColor: "var(--chat-divider)",
                    color: "var(--chat-text)",
                  }}
                >
                  <div
                    className="px-3 py-2 text-xs font-semibold border-b"
                    style={{ borderColor: "var(--chat-divider)" }}
                  >
                    Enviar formulário ao lead
                  </div>
                  {formsQ.isLoading ? (
                    <div className="px-3 py-4 text-xs opacity-70">Carregando…</div>
                  ) : availableForms.length === 0 ? (
                    <div className="px-3 py-4 text-xs opacity-70">
                      Nenhum formulário cadastrado. Crie um em CRM → Formulários.
                    </div>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto">
                      {availableForms.map((f) => (
                        <li
                          key={f.id}
                          className="px-3 py-2 border-b last:border-b-0"
                          style={{ borderColor: "var(--chat-divider)" }}
                        >
                          <div className="text-xs font-medium truncate">{f.nome}</div>
                          {f.descricao && (
                            <div className="text-[10px] opacity-60 truncate">{f.descricao}</div>
                          )}
                          <div className="mt-1.5 flex gap-1.5">
                            <button
                              type="button"
                              className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                              onClick={() => handleSendFormByWhatsApp(f.id)}
                            >
                              Enviar por WhatsApp
                            </button>
                            <button
                              type="button"
                              className="text-[10px] px-2 py-1 rounded border hover:bg-muted/40"
                              style={{ borderColor: "var(--chat-divider)" }}
                              onClick={() => handleCopyFormLink(f.id)}
                            >
                              Copiar link
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <a
                    href="/crm/formularios"
                    className="block px-3 py-2 text-[10px] text-primary hover:underline border-t"
                    style={{ borderColor: "var(--chat-divider)" }}
                  >
                    Gerenciar formulários →
                  </a>
                </div>
              </>
            )}
          </div>
          {formFeedback && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-md bg-foreground text-background text-[11px] shadow-lg whitespace-nowrap z-40">
              {formFeedback}
            </div>
          )}
          {emojiOpen && (
            <EmojiPicker
              onPick={(e) => {
                setDraft((d) => d + e);
                setEmojiOpen(false);
              }}
              onClose={() => setEmojiOpen(false)}
            />
          )}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={!canSend || sendMut.isPending || recording}
            placeholder={
              !canSend
                ? "Composer disponível em breve"
                : recording
                  ? "🔴 Gravando áudio… clique no microfone para parar"
                  : sendMut.isPending || mediaMut.isPending
                    ? "Enviando…"
                    : isGroupThread
                      ? "Mensagem para o grupo"
                      : "Digite uma mensagem"
            }
            className="flex-1 h-10 px-4 rounded-full text-sm outline-none disabled:opacity-50"
            style={{
              backgroundColor: "var(--chat-bg)",
              color: "var(--chat-text)",
              border: "1px solid var(--chat-divider)",
            }}
          />
          {draft.trim() && !recording ? (
            <IconBtn
              label="Enviar"
              onClick={send}
              accent
              disabled={sendMut.isPending || sendingTextRef.current}
            >
              <Send className="w-4 h-4" />
            </IconBtn>
          ) : (
            <IconBtn
              label={recording ? "Parar gravação" : "Gravar áudio"}
              onClick={toggleRecord}
              accent={recording}
              disabled={!canSend || mediaMut.isPending}
            >
              <Mic className="w-4 h-4" />
            </IconBtn>
          )}
        </div>
      )}
    </>
  );
}

const EMOJI_SET = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "😘",
  "🥰",
  "😎",
  "🤩",
  "🤔",
  "🙃",
  "😅",
  "😉",
  "😋",
  "😜",
  "😬",
  "😏",
  "😴",
  "🤤",
  "👍",
  "👎",
  "👏",
  "🙌",
  "🙏",
  "👌",
  "💪",
  "🤝",
  "👋",
  "✌️",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🖤",
  "🤍",
  "💔",
  "💯",
  "🔥",
  "✨",
  "🎉",
  "🎊",
  "🚀",
  "⭐",
  "⚡",
  "☀️",
  "🌧️",
  "🌈",
  "💰",
  "💸",
  "📈",
  "📉",
  "📊",
  "🛒",
  "🏷️",
  "💳",
  "🧾",
  "🪙",
  "📞",
  "📱",
  "💬",
  "📩",
  "📧",
  "📌",
  "📎",
  "📅",
  "⏰",
  "✅",
];

function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div
        className="absolute bottom-16 left-4 z-30 w-72 rounded-lg border shadow-2xl p-2 grid grid-cols-8 gap-0.5"
        style={{ backgroundColor: "var(--chat-panel)", borderColor: "var(--chat-divider)" }}
      >
        {EMOJI_SET.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className="h-8 w-8 rounded hover:bg-white/10 text-lg leading-none flex items-center justify-center"
          >
            {e}
          </button>
        ))}
      </div>
    </>
  );
}

function ThreadMoreMenu({
  onOpenProfile,
  profileOpen,
  channel,
  wallpaper,
  onChangeWallpaper,
}: {
  onOpenProfile?: () => void;
  profileOpen?: boolean;
  channel: ChatChannel;
  wallpaper?: ChatWallpaper;
  onChangeWallpaper?: (w: ChatWallpaper) => void;
}) {
  const [open, setOpen] = useState(false);
  const [wallOpen, setWallOpen] = useState(false);
  return (
    <div className="relative">
      <IconBtn label="Mais" onClick={() => setOpen((v) => !v)}>
        <MoreVertical className="w-4 h-4" />
      </IconBtn>
      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => {
              setOpen(false);
              setWallOpen(false);
            }}
          />
          <div
            className="absolute right-0 top-10 z-30 w-60 rounded-lg border shadow-2xl overflow-hidden py-1 text-sm"
            style={{
              backgroundColor: "var(--chat-panel)",
              borderColor: "var(--chat-divider)",
              color: "var(--chat-text)",
            }}
          >
            {channel === "leads" && onOpenProfile && (
              <button
                onClick={() => {
                  onOpenProfile();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5"
              >
                <User className="w-3.5 h-3.5" style={{ color: "var(--chat-accent)" }} />
                {profileOpen ? "Ocultar perfil do lead" : "Ver perfil do lead"}
              </button>
            )}
            {onChangeWallpaper && (
              <>
                <button
                  onClick={() => setWallOpen((v) => !v)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5"
                >
                  <ImageIcon className="w-3.5 h-3.5" style={{ color: "var(--chat-accent)" }} />
                  <span className="flex-1 text-left">Papel de parede</span>
                  <span className="text-[10px] opacity-60">
                    {WALLPAPER_OPTIONS.find((o) => o.value === wallpaper)?.label ?? ""}
                  </span>
                </button>
                {wallOpen && (
                  <div className="px-2 pb-2 grid grid-cols-5 gap-1.5">
                    {WALLPAPER_OPTIONS.map((opt) => {
                      const active = opt.value === wallpaper;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            onChangeWallpaper(opt.value);
                            setWallOpen(false);
                            setOpen(false);
                          }}
                          title={opt.label}
                          className={cn(
                            "aspect-square rounded-md border overflow-hidden transition-transform hover:scale-105",
                            active ? "ring-2 ring-offset-1" : "opacity-90",
                          )}
                          style={{
                            borderColor: "var(--chat-divider)",
                            // @ts-ignore ring color via style var not needed
                            outline: active ? "none" : undefined,
                          }}
                        >
                          <div
                            data-chat-thread-bg
                            data-chat-wallpaper={opt.value}
                            className="w-full h-full"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5"
              disabled
            >
              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--chat-meta)" }} />
              Marcar como resolvido
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function MessageBubble({
  msg,
  isGroup,
  leadId,
  onReact,
  onDelete,
  onTranscribe,
  isTranscribing,
  pickerOpen,
  setPickerOpen,
}: {
  msg: ChatMessage;
  isGroup?: boolean;
  leadId?: string;
  onReact?: (emoji: string) => void;
  onDelete?: (forEveryone: boolean) => void;
  onTranscribe?: () => void;
  isTranscribing?: boolean;
  pickerOpen: string | null;
  setPickerOpen: (id: string | null) => void;
}) {

  const mine = msg.from === "me";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);
  const genericLabel = isGenericMediaLabel(msg.text, msg.mediaType);
  const isSticker = String(msg.mediaType ?? "").toLowerCase() === "sticker";
  const reactionEntries = normalizeReactionEntries(msg.reactions);
  const myReaction = reactionEntries.find((r) => r.fromMe === true)?.emoji ?? null;
  const isDeleted = msg.deletedForAll === true || msg.deletedForMe === true;

  if (isDeleted) {
    return (
      <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
        <div
          className="max-w-[70%] rounded-lg px-3 py-2 text-sm italic flex items-center gap-1.5"
          style={{
            backgroundColor: mine ? "var(--chat-bubble-out)" : "var(--chat-bubble-in)",
            color: "var(--chat-meta)",
            borderRadius: mine ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
            opacity: 0.7,
          }}
        >
          <span>🚫</span>
          <span>
            {msg.deletedForAll
              ? mine
                ? "Você apagou esta mensagem"
                : "Esta mensagem foi apagada"
              : "Você apagou esta mensagem para você"}
          </span>
          <span className="text-[10px] not-italic ml-2" style={{ color: "var(--chat-meta)" }}>
            {chatTime(msg.sentAt)}
          </span>
        </div>
      </div>
    );
  }

  const canDeleteForEveryone = Boolean(onDelete && mine && msg.whatsappMessageId);
  return (
    <div
      className={cn(
        "group/msg flex w-full items-center gap-1.5",
        mine ? "justify-end" : "justify-start",
      )}
    >
      {mine && onReact && (
        <div className="relative opacity-0 group-hover/msg:opacity-100 transition-opacity">
          {pickerOpen === msg.id && (

            <ReactionPicker
              onPick={(e) => {
                onReact(e);
                setPickerOpen(null);

              }}
              onRemove={() => {
                onReact("");
                setPickerOpen(null);
              }}
              currentMineEmoji={myReaction}
              onClose={() => setPickerOpen(null)}

              align="right"
            />
          )}
          <button
            type="button"
            onClick={() => setPickerOpen(pickerOpen === msg.id ? null : msg.id)}

            className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-white/10"
            style={{ color: "var(--chat-meta)" }}
            aria-label="Reagir"
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div
        className={cn(
          "max-w-[70%] rounded-lg text-sm",
          isSticker ? "px-1 py-1 shadow-none" : "px-3 py-2 shadow-sm",
          msg.mediaUrl && !isSticker && "w-fit min-w-[220px]",
        )}
        style={{
          backgroundColor: isSticker
            ? "transparent"
            : mine
              ? "var(--chat-bubble-out)"
              : "var(--chat-bubble-in)",
          color: "var(--chat-text)",
          borderRadius: mine ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
        }}
      >
        {!mine && isGroup && msg.author && (
          <div className="text-[11px] font-semibold mb-0.5" style={{ color: "var(--chat-accent)" }}>
            {msg.author}
          </div>
        )}
        {msg.mediaUrl || isSticker ? (
          <MediaAttachment msg={msg} mine={mine} leadId={leadId} />
        ) : msg.audioSeconds ? (
          <div className="space-y-2">
            <AudioMock seconds={msg.audioSeconds} mine={mine} />
            {(msg as any).transcription && (
              <div
                className="mt-2 text-[11px] px-2 py-1.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 italic leading-relaxed"
                style={{ color: "var(--chat-text)" }}
              >
                <div className="font-semibold not-italic mb-1 opacity-60 flex items-center gap-1">
                  <Languages className="w-3 h-3" /> Transcrição
                </div>
                {(msg as any).transcription}
              </div>
            )}
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words leading-snug">{msg.text}</div>
        )}
        {(msg.mediaUrl || isSticker) && msg.text && !genericLabel && (
          <div className="mt-1.5 whitespace-pre-wrap break-words leading-snug">{msg.text}</div>
        )}
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <ReactionStrip
            reactions={reactionEntries}
            onRemoveMine={myReaction && onReact ? () => onReact("") : undefined}
          />
          <span className="text-[10px]" style={{ color: "var(--chat-meta)" }}>
            {chatTime(msg.sentAt)}
          </span>
          {mine && <CheckCheck className="w-3 h-3" style={{ color: "var(--chat-accent)" }} />}
        </div>
      </div>

      {onDelete && (
        <div
          ref={menuRef}
          className="relative opacity-0 group-hover/msg:opacity-100 transition-opacity"
        >
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-white/10"
            style={{ color: "var(--chat-meta)" }}
            aria-label="Mais opções"
            title="Mais opções"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div
              className={cn(
                "absolute z-30 mt-1 min-w-[200px] rounded-md py-1 shadow-lg text-sm",
                mine ? "right-0" : "left-0",
              )}
              style={{
                backgroundColor: "var(--chat-panel)",
                border: "1px solid var(--chat-divider)",
                color: "var(--chat-text)",
              }}
            >
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-white/10"
                onClick={() => {
                  setMenuOpen(false);
                  if (confirm("Excluir esta mensagem para você?")) onDelete(false);
                }}
              >
                Excluir para mim
              </button>
              {canDeleteForEveryone && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 hover:bg-white/10"
                  style={{ color: "oklch(0.65 0.18 27)" }}
                  onClick={() => {
                    setMenuOpen(false);
                    if (
                      confirm("Excluir esta mensagem para todos? Esta ação não pode ser desfeita.")
                    )
                      onDelete(true);
                  }}
                >
                  Excluir para todos
                </button>
              )}
              {onTranscribe && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 hover:bg-white/10 flex items-center gap-2"
                  onClick={() => {
                    setMenuOpen(false);
                    onTranscribe();
                  }}
                  disabled={isTranscribing}
                >
                  {isTranscribing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Languages className="w-3.5 h-3.5" />
                  )}
                  {isTranscribing ? "Transcrevendo..." : "Transcrever áudio"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {!mine && onReact && (
        <div className="relative opacity-0 group-hover/msg:opacity-100 transition-opacity">
          {pickerOpen === msg.id && (
            <ReactionPicker
              onPick={(e) => {
                onReact(e);
                setPickerOpen(null);
              }}
              onRemove={() => {
                onReact("");
                setPickerOpen(null);
              }}
              currentMineEmoji={myReaction}
              onClose={() => setPickerOpen(null)}
              align="left"
            />
          )}
          <button
            type="button"
            onClick={() => setPickerOpen(pickerOpen === msg.id ? null : msg.id)}
            className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-white/10"
            style={{ color: "var(--chat-meta)" }}
            aria-label="Reagir"
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}


    </div>
  );
}

function ReactionPicker({
  onPick,
  onRemove,
  currentMineEmoji,
  onClose,
  align,
}: {
  onPick: (emoji: string) => void;
  onRemove?: () => void;
  currentMineEmoji?: string | null;
  onClose: () => void;
  align: "left" | "right";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className={cn(
        "absolute bottom-full mb-1 z-20 flex items-center gap-0.5 rounded-full px-1.5 py-1 shadow-lg",
        align === "right" ? "right-0" : "left-0",
      )}
      style={{ backgroundColor: "var(--chat-panel)", border: "1px solid var(--chat-divider)" }}
    >
      {REACTION_EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          className="h-7 w-7 rounded-full flex items-center justify-center text-base hover:bg-white/10"
          style={
            currentMineEmoji === e
              ? { backgroundColor: "var(--chat-accent)", color: "var(--chat-accent-fg)" }
              : undefined
          }
        >
          {e}
        </button>
      ))}
      {currentMineEmoji && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/10"
          style={{ color: "var(--chat-meta)", borderLeft: "1px solid var(--chat-divider)" }}
          aria-label="Remover reação"
          title="Remover reação"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

type RenderedReaction = { emoji: string; fromMe: boolean | null; count: number };

function normalizeReactionEntries(reactions: ChatMessage["reactions"]): RenderedReaction[] {
  const entries = (reactions ?? [])
    .map((item) => {
      if (typeof item === "string" && item.trim())
        return { emoji: item.trim(), fromMe: null as boolean | null };
      if (item && typeof item === "object") {
        const emoji = typeof item.emoji === "string" ? item.emoji.trim() : "";
        if (!emoji) return null;
        return {
          emoji,
          fromMe: typeof item.fromMe === "boolean" ? item.fromMe : (null as boolean | null),
        };
      }
      return null;
    })
    .filter((item): item is { emoji: string; fromMe: boolean | null } => Boolean(item));
  const grouped = new Map<string, RenderedReaction>();
  for (const entry of entries) {
    const key = `${entry.emoji}:${entry.fromMe === true ? "me" : entry.fromMe === false ? "them" : "unknown"}`;
    const current = grouped.get(key);
    grouped.set(key, {
      emoji: entry.emoji,
      fromMe: entry.fromMe,
      count: (current?.count ?? 0) + 1,
    });
  }
  return Array.from(grouped.values());
}

function ReactionStrip({
  reactions,
  onRemoveMine,
}: {
  reactions: RenderedReaction[];
  onRemoveMine?: () => void;
}) {
  if (reactions.length === 0) return null;
  return (
    <span className="mr-1 flex items-center gap-0.5">
      {reactions.map((reaction, index) => {
        const removable = reaction.fromMe === true && onRemoveMine;
        return (
          <button
            key={`${reaction.emoji}-${reaction.fromMe ?? "unknown"}-${index}`}
            type="button"
            onClick={removable ? onRemoveMine : undefined}
            disabled={!removable}
            className="min-w-5 h-5 rounded-full px-1 text-[11px] leading-none flex items-center justify-center disabled:cursor-default"
            style={{
              backgroundColor: "var(--chat-panel)",
              color: "var(--chat-text)",
              border: "1px solid var(--chat-divider)",
            }}
            title={
              reaction.fromMe === true
                ? "Sua reação"
                : reaction.fromMe === false
                  ? "Reação do cliente"
                  : "Reação"
            }
          >
            {reaction.emoji}
            {reaction.count > 1 ? reaction.count : ""}
          </button>
        );
      })}
    </span>
  );
}

function isGenericMediaLabel(text?: string | null, mediaType?: string | null) {
  if (!text || !mediaType) return false;
  const normalized = text.trim().toLowerCase();
  const kind = String(mediaType).toLowerCase();
  return (
    (kind === "image" && normalized === "📷 imagem") ||
    (kind === "video" && normalized === "🎥 vídeo") ||
    (kind === "audio" && normalized === "🎙️ áudio") ||
    (kind === "sticker" && (normalized === "sticker" || normalized === "figurinha")) ||
    (kind === "document" && normalized.startsWith("📎"))
  );
}

function MediaAttachment({
  msg,
  mine,
  leadId,
}: {
  msg: ChatMessage;
  mine: boolean;
  leadId?: string;
}) {
  const kind = String(msg.mediaType ?? "").toLowerCase();
  const source = msg.mediaUrl ?? "";
  const label =
    msg.fileName ||
    (kind === "image"
      ? "Imagem"
      : kind === "video"
        ? "Vídeo"
        : kind === "audio"
          ? "Áudio"
          : kind === "sticker"
            ? "Figurinha"
            : "Documento");
  const [lightbox, setLightbox] = useState(false);
  const resolveMediaFn = useServerFn(resolveLeadMessageMedia);
  const shouldResolveSticker = Boolean(
    leadId && msg.whatsappMessageId && kind === "sticker" && !source.startsWith("data:"),
  );
  const resolvedMediaQ = useQuery({
    queryKey: ["inbox", "resolved-media", msg.id, msg.whatsappMessageId],
    queryFn: () => resolveMediaFn({ data: { leadId: leadId!, activityId: msg.id } }),
    enabled: shouldResolveSticker,
    staleTime: Infinity,
    retry: 1,
  });
  const displaySource = resolvedMediaQ.data?.mediaUrl ?? source;

  const downloadName = msg.fileName || `${kind || "arquivo"}-${msg.whatsappMessageId ?? msg.id}`;

  if (kind === "sticker") {
    return <StickerAttachment src={displaySource} loading={resolvedMediaQ.isLoading} />;
  }

  if (kind === "image") {
    return (
      <>
        <div className="relative group/media overflow-hidden rounded-md">
          <img
            src={displaySource}
            alt={label}
            className="block max-h-80 w-auto max-w-full cursor-zoom-in object-contain"
            loading="lazy"
            onClick={() => setLightbox(true)}
          />
          <a
            href={displaySource}
            download={downloadName}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full flex items-center justify-center opacity-0 group-hover/media:opacity-100 transition-opacity"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "#fff" }}
            aria-label="Baixar imagem"
            title="Baixar imagem"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
        {lightbox && (
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
            onClick={() => setLightbox(false)}
          >
            <button
              type="button"
              className="absolute top-4 right-4 h-9 w-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}
              aria-label="Fechar"
              onClick={() => setLightbox(false)}
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={displaySource}
              alt={label}
              className="max-h-[90vh] max-w-[90vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    );
  }

  if (kind === "video") {
    return (
      <video
        controls
        className="block max-h-80 w-full min-w-[260px] rounded-md"
        preload="metadata"
        src={displaySource}
      >
        <source src={displaySource} type={msg.mimeType ?? undefined} />
      </video>
    );
  }

  if (kind === "audio") {
    return <WhatsAppAudio src={displaySource} mime={msg.mimeType ?? undefined} mine={mine} />;
  }

  return (
    <a
      href={displaySource}
      download={downloadName}
      target="_blank"
      rel="noreferrer"
      className="flex min-w-[220px] items-center gap-2 rounded-md border px-3 py-2 text-xs hover:opacity-90"
      style={{
        borderColor: "var(--chat-divider)",
        backgroundColor: mine ? "var(--chat-audio-control)" : "var(--chat-panel-hover)",
      }}
    >
      <Paperclip className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
    </a>
  );
}

function StickerAttachment({ src, loading }: { src: string; loading?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (loading && !src.startsWith("data:")) {
    return (
      <div
        className="h-32 w-32 rounded-lg border flex items-center justify-center"
        style={{ borderColor: "var(--chat-divider)", color: "var(--chat-meta)" }}
      >
        <ImageIcon className="h-6 w-6 animate-pulse" />
      </div>
    );
  }
  if (!src || failed) {
    return (
      <div
        className="h-32 w-32 rounded-lg border flex flex-col items-center justify-center gap-1 text-[11px]"
        style={{
          borderColor: "var(--chat-divider)",
          color: "var(--chat-meta)",
          backgroundColor: "var(--chat-panel)",
        }}
      >
        <ImageIcon className="h-5 w-5" />
        Figurinha indisponível
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="Figurinha enviada pelo cliente"
      className="block h-32 w-32 object-contain drop-shadow-sm"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function AudioMock({ seconds, mine }: { seconds: number; mine: boolean }) {
  return <WhatsAppAudio mine={mine} fallbackSeconds={seconds} />;
}

function WhatsAppAudio({
  src,
  mime,
  mine,
  fallbackSeconds,
}: {
  src?: string;
  mime?: string;
  mine: boolean;
  fallbackSeconds?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number>(fallbackSeconds ?? 0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime || 0);
    const onLoaded = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) setDuration(a.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("ended", onEnd);
    };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  };

  const fmt = (s: number) => {
    if (!Number.isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  const bars = 28;

  return (
    <div
      className="flex items-center gap-3 min-w-[240px] max-w-full rounded-full px-2 py-1"
      style={{ backgroundColor: mine ? "var(--chat-audio-control)" : "var(--chat-panel-hover)" }}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={!src}
        aria-label={playing ? "Pausar" : "Reproduzir"}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 disabled:opacity-60"
        style={{ backgroundColor: "var(--chat-accent)", color: "#fff" }}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-[1px]" />}
      </button>
      <div
        className="flex-1 h-6 flex items-center gap-[2px] cursor-pointer"
        onClick={(e) => {
          const a = audioRef.current;
          if (!a || !duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          a.currentTime = ratio * duration;
          setCurrent(a.currentTime);
        }}
      >
        {Array.from({ length: bars }).map((_, i) => {
          const active = (i / bars) * 100 <= pct;
          const h = 5 + ((i * 13) % 14);
          return (
            <span
              key={i}
              className="block w-[3px] rounded-full transition-colors"
              style={{
                height: `${h}px`,
                backgroundColor: active ? "var(--chat-accent)" : "var(--chat-meta)",
                opacity: active ? 1 : 0.5,
              }}
            />
          );
        })}
      </div>
      <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--chat-meta)" }}>
        {fmt(playing || current > 0 ? current : duration)}
      </span>
      {src ? (
        <audio ref={audioRef} src={src} preload="metadata" className="hidden">
          <source src={src} type={mime} />
        </audio>
      ) : null}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  accent,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
      style={
        accent
          ? { backgroundColor: "var(--chat-accent)", color: "var(--chat-accent-fg)" }
          : { color: "var(--chat-text-muted)" }
      }
      onMouseEnter={(e) => {
        if (!accent && !disabled)
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "oklch(1 0 0 / 0.06)";
      }}
      onMouseLeave={(e) => {
        if (!accent) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function StatusDot({ status }: { status?: ChatConversation["status"] }) {
  const color =
    status === "online" || status === "aguardando" || status === "aberto"
      ? "var(--chat-accent)"
      : status === "resolvido"
        ? "var(--chat-meta)"
        : "oklch(0.7 0.12 60)";
  return <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />;
}

function StatusLabel({
  status,
  subtitle,
}: {
  status?: ChatConversation["status"];
  subtitle?: string;
}) {
  const text =
    status === "online"
      ? "online"
      : status === "aguardando"
        ? "aguardando resposta"
        : status === "standby"
          ? "standby"
          : status === "aberto"
            ? "ticket aberto"
            : status === "resolvido"
              ? "resolvido"
              : null;
  return (
    <span className="truncate">
      {text}
      {text && subtitle ? " · " : ""}
      {subtitle}
    </span>
  );
}

function EmptyState({ channel }: { channel: ChatChannel }) {
  const meta = CHANNEL_META[channel];
  const Icon = meta.icon;
  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <div className="text-center max-w-sm">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: "var(--chat-panel)", color: "var(--chat-accent)" }}
        >
          <Icon className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-semibold mb-1">{meta.title}</h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--chat-text-muted)" }}>
          Selecione uma conversa à esquerda para começar.
        </p>
      </div>
    </div>
  );
}


