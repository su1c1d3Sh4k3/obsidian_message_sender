import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, uploadFile } from "@/lib/api";
import toast from "react-hot-toast";

/* ───────────────────────── Types ───────────────────────── */

interface Sender {
  id: string;
  name: string;
  phone: string;
  status: string;
}

interface ContactList {
  id: string;
  name: string;
  description: string | null;
  contact_count: number;
}

type MessageBlockType = "text" | "audio" | "image" | "document";

interface MessageBlock {
  id: string;
  type: MessageBlockType;
  content: string;
  file: File | null;
  audioBlob: Blob | null;
  audioUrl: string | null;
  caption: string;
  existingUrl?: string | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  target_type: string;
  message_type: string;
  message_body: string;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface CampaignMessage {
  id: string;
  contact_name: string | null;
  phone: string;
  status: string;
  message_rendered: string | null;
  error_message: string | null;
  sent_at: string | null;
  failed_at: string | null;
  created_at: string;
}

/* ───────────────────────── Variables ───────────────────────── */

const VARIABLES = [
  { label: "Primeiro Nome", value: "{{primeiro_nome}}" },
  { label: "Nome Completo", value: "{{nome_completo}}" },
  { label: "Cidade", value: "{{cidade}}" },
  { label: "Empresa", value: "{{empresa}}" },
  { label: "Telefone", value: "{{telefone}}" },
];

const VARIABLE_EXAMPLES: Record<string, string> = {
  "{{primeiro_nome}}": "João",
  "{{nome_completo}}": "João Silva",
  "{{cidade}}": "São Paulo",
  "{{empresa}}": "TechCorp",
  "{{telefone}}": "(11) 99999-0000",
};

/* ───────────────────────── Helpers ───────────────────────── */

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function formatWhatsApp(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html.replace(/```([\s\S]*?)```/g, '<code class="bg-black/30 px-1 rounded font-mono text-[13px]">$1</code>');
  html = html.replace(/\*(.+?)\*/g, "<b>$1</b>");
  html = html.replace(/_(.+?)_/g, "<i>$1</i>");
  html = html.replace(/~(.+?)~/g, "<s>$1</s>");
  html = html.replace(/\n/g, "<br/>");
  return html;
}

function replaceVariables(text: string): string {
  let result = text;
  for (const [key, val] of Object.entries(VARIABLE_EXAMPLES)) {
    result = result.replaceAll(key, val);
  }
  return result;
}

function currentTime() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const statusLabels: Record<string, string> = {
  draft: "Aguardando Envio",
  scheduled: "Aguardando Envio",
  running: "Enviando",
  paused: "Pausada",
  completed: "Enviada",
  cancelled: "Cancelada",
  failed: "Falhou",
};

const statusColors: Record<string, string> = {
  draft: "bg-secondary-container text-secondary",
  scheduled: "bg-primary/10 text-primary border border-primary/20",
  running: "bg-tertiary/10 text-tertiary border border-tertiary/20",
  paused: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  completed: "bg-tertiary/10 text-tertiary border border-tertiary/20",
  cancelled: "bg-error-container text-on-error-container",
  failed: "bg-error-container text-on-error-container",
};

const msgStatusLabels: Record<string, string> = {
  pending: "Pendente",
  queued: "Na fila",
  sending: "Enviando",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Erro",
  skipped: "Pulada",
};

/* ───────────────────────── Component ───────────────────────── */

export default function Campaigns() {
  const [view, setView] = useState<"list" | "create">("list");
  const [editingId, setEditingId] = useState<string | null>(null);

  if (view === "create") {
    return <CampaignCreate editId={editingId} onBack={() => { setView("list"); setEditingId(null); }} />;
  }

  return <CampaignListView onNew={() => setView("create")} onEdit={(id) => { setEditingId(id); setView("create"); }} />;
}

/* ═══════════════════════ Campaign List ═══════════════════════ */

function CampaignListView({ onNew, onEdit }: { onNew: () => void; onEdit: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api.get<{ data: Campaign[]; pagination: { total: number } }>("/campaigns?limit=50"),
    refetchInterval: 5000,
  });

  const campaigns = data?.data ?? [];

  // Fetch logs for expanded campaign
  const { data: logsData } = useQuery({
    queryKey: ["campaign-messages", expandedId],
    queryFn: () => api.get<{ data: CampaignMessage[] }>(`/campaigns/${expandedId}/messages?limit=50`),
    enabled: !!expandedId,
    refetchInterval: expandedId ? 3000 : false,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.post(`/campaigns/${id}/action`, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handlePlayPause(campaign: Campaign) {
    if (campaign.status === "running") {
      actionMutation.mutate({ id: campaign.id, action: "pause" });
    } else if (campaign.status === "paused") {
      actionMutation.mutate({ id: campaign.id, action: "resume" });
      setExpandedId(campaign.id);
    } else if (campaign.status === "draft" || campaign.status === "scheduled") {
      actionMutation.mutate({ id: campaign.id, action: "start" });
      setExpandedId(campaign.id);
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campanhas</h2>
          <p className="text-secondary mt-1">Gerencie suas campanhas de envio.</p>
        </div>
        <button
          onClick={onNew}
          className="px-4 py-2 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Nova Campanha
        </button>
      </div>

      {/* Campaign cards */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-surface-container border border-outline-variant rounded-xl p-12 text-center text-secondary">Carregando...</div>
        ) : campaigns.length === 0 ? (
          <div className="bg-surface-container border border-outline-variant rounded-xl p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-secondary mb-3 block">campaign</span>
            <p className="text-secondary">Nenhuma campanha criada</p>
            <p className="text-xs text-secondary mt-1">Clique em "Nova Campanha" para começar.</p>
          </div>
        ) : (
          campaigns.map((campaign) => {
            const pct = campaign.total_contacts > 0 ? Math.round((campaign.sent_count / campaign.total_contacts) * 100) : 0;
            const isExpanded = expandedId === campaign.id;
            const canPlay = ["draft", "scheduled", "paused"].includes(campaign.status);
            const canPause = campaign.status === "running";
            const isFinished = ["completed", "cancelled", "failed"].includes(campaign.status);

            return (
              <div key={campaign.id} className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
                {/* Campaign row */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-surface-bright/30 transition-colors"
                  onClick={() => toggleExpand(campaign.id)}
                >
                  {/* Play/Pause button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isFinished) handlePlayPause(campaign);
                    }}
                    disabled={isFinished}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      canPause
                        ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                        : canPlay
                          ? "bg-tertiary/20 text-tertiary hover:bg-tertiary/30"
                          : "bg-surface-container-highest text-secondary"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {canPause ? "pause" : isFinished ? "check_circle" : "play_arrow"}
                    </span>
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold truncate">{campaign.name}</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${statusColors[campaign.status] ?? ""}`}>
                        {statusLabels[campaign.status] ?? campaign.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-[11px] text-secondary">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                        Criada: {new Date(campaign.created_at).toLocaleDateString("pt-BR")}
                      </span>
                      {campaign.completed_at && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Enviada: {new Date(campaign.completed_at).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      {campaign.started_at && !campaign.completed_at && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          Início: {new Date(campaign.started_at).toLocaleString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="hidden sm:flex items-center gap-3 w-48 shrink-0">
                    <div className="flex-1">
                      <div className="h-2 w-full bg-outline-variant rounded-full overflow-hidden flex">
                        {campaign.total_contacts > 0 && (
                          <>
                            <div
                              className="h-full bg-tertiary transition-all duration-500"
                              style={{ width: `${((campaign.delivered_count || campaign.sent_count) / campaign.total_contacts) * 100}%` }}
                            />
                            {campaign.failed_count > 0 && (
                              <div
                                className="h-full bg-error transition-all duration-500"
                                style={{ width: `${(campaign.failed_count / campaign.total_contacts) * 100}%` }}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-mono text-secondary w-10 text-right">{pct}%</span>
                  </div>

                  {/* Expand chevron */}
                  <span className={`material-symbols-outlined text-secondary transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                    expand_more
                  </span>
                </div>

                {/* Expanded: logs table */}
                {isExpanded && (
                  <div className="border-t border-outline-variant">
                    {/* Stats bar + actions */}
                    <div className="flex items-center justify-between px-5 py-3 bg-surface-container-high/30 text-xs">
                      <div className="flex items-center gap-6">
                        <span className="text-secondary">Total: <span className="font-mono font-bold text-on-surface">{campaign.total_contacts}</span></span>
                        <span className="text-secondary">Enviadas: <span className="font-mono font-bold text-tertiary">{campaign.sent_count}</span></span>
                        <span className="text-secondary">Falhas: <span className="font-mono font-bold text-error">{campaign.failed_count}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        {campaign.status === "draft" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onEdit(campaign.id); }}
                            className="px-3 py-1.5 text-xs font-medium bg-primary/10 border border-primary/20 text-primary rounded hover:bg-primary/20 transition-all flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            Editar
                          </button>
                        )}
                        {isFinished && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Reativar esta campanha? Os logs anteriores serão apagados.")) {
                                actionMutation.mutate({ id: campaign.id, action: "reactivate" });
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-primary/10 border border-primary/20 text-primary rounded hover:bg-primary/20 transition-all flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">restart_alt</span>
                            Reativar
                          </button>
                        )}
                        {canPlay && campaign.status !== "draft" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Cancelar esta campanha?")) {
                                actionMutation.mutate({ id: campaign.id, action: "cancel" });
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-error/10 border border-error/20 text-error rounded hover:bg-error/20 transition-all flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">stop</span>
                            Cancelar
                          </button>
                        )}
                        {canPause && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Cancelar esta campanha?")) {
                                actionMutation.mutate({ id: campaign.id, action: "cancel" });
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-error/10 border border-error/20 text-error rounded hover:bg-error/20 transition-all flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">stop</span>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Logs table */}
                    <div className="max-h-[420px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-surface-container-high">
                            <th className="px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-secondary">Contato</th>
                            <th className="px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-secondary">Telefone</th>
                            <th className="px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-secondary hidden md:table-cell">Mensagem</th>
                            <th className="px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-secondary">Status</th>
                            <th className="px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-secondary hidden sm:table-cell">Horário</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                          {!logsData?.data?.length ? (
                            <tr>
                              <td colSpan={5} className="px-5 py-8 text-center text-secondary text-xs">
                                {campaign.status === "draft" ? "Inicie a campanha para ver os logs." : "Nenhum log disponível."}
                              </td>
                            </tr>
                          ) : (
                            logsData.data.map((msg) => (
                              <tr key={msg.id} className="hover:bg-surface-bright/20 transition-colors">
                                <td className="px-5 py-2.5">
                                  <span className="text-xs font-medium">{msg.contact_name || "-"}</span>
                                </td>
                                <td className="px-5 py-2.5">
                                  <span className="text-xs font-mono text-on-surface-variant">+{msg.phone}</span>
                                </td>
                                <td className="px-5 py-2.5 hidden md:table-cell">
                                  <span className="text-[11px] text-secondary truncate block max-w-[200px]">
                                    {msg.message_rendered || "-"}
                                  </span>
                                </td>
                                <td className="px-5 py-2.5">
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                                    msg.status === "sent" || msg.status === "delivered" || msg.status === "read"
                                      ? "bg-tertiary/10 text-tertiary border border-tertiary/20"
                                      : msg.status === "failed"
                                        ? "bg-error/10 text-error border border-error/20"
                                        : msg.status === "sending" || msg.status === "queued"
                                          ? "bg-primary/10 text-primary border border-primary/20"
                                          : "bg-secondary-container text-secondary"
                                  }`}>
                                    {msgStatusLabels[msg.status] ?? msg.status.toUpperCase()}
                                  </span>
                                  {msg.error_message && (
                                    <p className="text-[9px] text-error mt-0.5 truncate max-w-[120px]">{msg.error_message}</p>
                                  )}
                                </td>
                                <td className="px-5 py-2.5 hidden sm:table-cell">
                                  <span className="text-[10px] text-secondary font-mono">
                                    {msg.sent_at
                                      ? new Date(msg.sent_at).toLocaleTimeString("pt-BR")
                                      : msg.failed_at
                                        ? new Date(msg.failed_at).toLocaleTimeString("pt-BR")
                                        : "-"}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ Campaign Create ═══════════════════════ */

function CampaignCreate({ onBack, editId }: { onBack: () => void; editId?: string | null }) {
  const queryClient = useQueryClient();
  const isEditing = !!editId;

  /* ── Data Fetching ── */
  const { data: senders } = useQuery({
    queryKey: ["senders"],
    queryFn: () => api.get<Sender[]>("/senders"),
  });

  const { data: lists } = useQuery({
    queryKey: ["lists"],
    queryFn: () => api.get<ContactList[]>("/lists"),
  });

  const { data: editData } = useQuery({
    queryKey: ["campaign-edit", editId],
    queryFn: () => api.get<Campaign & { message_body: string; message_type: string; target_list_id?: string; target_tag_id?: string; sender_id?: string; sender_ids?: string[]; delay_min: number; delay_max: number; use_spintax: boolean }>(`/campaigns/${editId}`),
    enabled: !!editId,
  });

  const connectedSenders = useMemo(
    () => (senders ?? []).filter((s) => s.status === "connected"),
    [senders],
  );

  /* ── Form State ── */
  const [title, setTitle] = useState("");
  const [selectedSenders, setSelectedSenders] = useState<Sender[]>([]);
  const [senderDropdownOpen, setSenderDropdownOpen] = useState(false);
  const [messageBlocks, setMessageBlocks] = useState<MessageBlock[]>([]);
  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [delayMessages, setDelayMessages] = useState(15);
  const [delayContacts, setDelayContacts] = useState(15);
  const [useSpintax, setUseSpintax] = useState(false);
  const [editLoaded, setEditLoaded] = useState(false);

  // Load edit data into form (wait for both editData and senders)
  useEffect(() => {
    if (!editData || !senders || editLoaded) return;
    setTitle(editData.name);
    setDelayMessages(editData.delay_min);
    setDelayContacts(editData.delay_max);
    setUseSpintax(editData.use_spintax);
    if (editData.target_list_id) setSelectedGroupId(editData.target_list_id);

    // Load senders
    const senderIds = editData.sender_ids?.length ? editData.sender_ids : editData.sender_id ? [editData.sender_id] : [];
    setSelectedSenders(senders.filter((s) => senderIds.includes(s.id)));

    // Load message blocks
    if (editData.message_type === "multi") {
      try {
        const parsed = JSON.parse(editData.message_body) as { type: string; content?: string; url?: string; caption?: string }[];
        setMessageBlocks(parsed.map((b) => ({
          id: uid(),
          type: b.type as MessageBlockType,
          content: b.content || "",
          file: null,
          audioBlob: null,
          audioUrl: b.type === "audio" && b.url ? b.url : null,
          caption: b.caption || "",
          existingUrl: b.url || null,
        })));
      } catch {
        setMessageBlocks([{ id: uid(), type: "text", content: editData.message_body, file: null, audioBlob: null, audioUrl: null, caption: "" }]);
      }
    } else {
      setMessageBlocks([{ id: uid(), type: "text", content: editData.message_body, file: null, audioBlob: null, audioUrl: null, caption: "" }]);
    }

    setEditLoaded(true);
  }, [editData, senders, editLoaded]);

  /* ── Audio recording state ── */
  const [recordingBlockId, setRecordingBlockId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  /* ── Variable dropdown state ── */
  const [varDropdownBlockId, setVarDropdownBlockId] = useState<string | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  /* ── Preview scroll ── */
  const previewEndRef = useRef<HTMLDivElement>(null);
  const lastBlockCountRef = useRef(0);

  // Only auto-scroll when a NEW block is added, not on content changes
  useEffect(() => {
    if (messageBlocks.length > lastBlockCountRef.current) {
      previewEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    lastBlockCountRef.current = messageBlocks.length;
  }, [messageBlocks.length]);

  const selectedGroup = (lists ?? []).find((l) => l.id === selectedGroupId);

  /* ── Handlers ── */
  const addSender = (sender: Sender) => {
    if (!selectedSenders.find((s) => s.id === sender.id)) {
      setSelectedSenders((prev) => [...prev, sender]);
    }
    setSenderDropdownOpen(false);
  };

  const removeSender = (id: string) => {
    setSelectedSenders((prev) => prev.filter((s) => s.id !== id));
  };

  const addMessageBlock = (type: MessageBlockType) => {
    setMessageBlocks((prev) => [
      ...prev,
      { id: uid(), type, content: "", file: null, audioBlob: null, audioUrl: null, caption: "" },
    ]);
    setAddTypeOpen(false);
  };

  const updateBlock = (id: string, updates: Partial<MessageBlock>) => {
    setMessageBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const removeBlock = (id: string) => {
    setMessageBlocks((prev) => {
      const block = prev.find((b) => b.id === id);
      if (block?.audioUrl) URL.revokeObjectURL(block.audioUrl);
      return prev.filter((b) => b.id !== id);
    });
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    setMessageBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const insertVariable = (blockId: string, variable: string) => {
    const textarea = textareaRefs.current[blockId];
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const block = messageBlocks.find((b) => b.id === blockId);
    if (!block) return;
    const before = block.content.slice(0, start);
    const after = block.content.slice(end);
    updateBlock(blockId, { content: before + variable + after });
    setVarDropdownBlockId(null);
    setTimeout(() => {
      textarea.focus();
      const pos = start + variable.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleFileChange = (blockId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    updateBlock(blockId, { file });
  };

  /* ── Audio Recording ── */
  const startRecording = useCallback(async (blockId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer mp4/aac (WhatsApp compatible), fallback to webm
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/webm;codecs=opus";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        updateBlock(blockId, { audioBlob: blob, audioUrl: url });
        stream.getTracks().forEach((t) => t.stop());
        setRecordingBlockId(null);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingBlockId(blockId);
    } catch {
      toast.error("Erro ao acessar microfone. Verifique as permissões.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const handleAudioUpload = (blockId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    updateBlock(blockId, { file, audioUrl: url, audioBlob: null });
  };

  /* ── Submit ── */
  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      isEditing ? api.put(`/campaigns/${editId}`, payload) : api.post("/campaigns", payload),
    onSuccess: () => {
      toast.success(isEditing ? "Campanha atualizada!" : "Campanha salva com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      onBack();
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao salvar campanha"),
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return toast.error("Informe o título da campanha");
    if (messageBlocks.length === 0) return toast.error("Adicione pelo menos uma mensagem");
    if (!selectedGroupId) return toast.error("Selecione um grupo de envio");

    setIsSaving(true);

    try {
      // Upload media files to Supabase Storage and build blocks array
      const blocks: { type: string; content?: string; url?: string; caption?: string; mimetype?: string }[] = [];

      for (const block of messageBlocks) {
        if (block.type === "text") {
          blocks.push({ type: "text", content: block.content });
        } else if (block.type === "image") {
          if (block.file) {
            const uploaded = await uploadFile(block.file);
            blocks.push({ type: "image", url: uploaded.url, caption: block.caption || "", mimetype: uploaded.mimetype });
          } else if (block.existingUrl) {
            blocks.push({ type: "image", url: block.existingUrl, caption: block.caption || "" });
          }
        } else if (block.type === "audio") {
          if (block.file || block.audioBlob) {
            let audioFile: File | null = block.file || null;
            if (!audioFile && block.audioBlob) {
              const ext = block.audioBlob.type.includes("mp4") ? "mp4" : "webm";
              audioFile = new File([block.audioBlob], `audio.${ext}`, { type: block.audioBlob.type });
            }
            if (audioFile) {
              const uploaded = await uploadFile(audioFile, audioFile.name);
              blocks.push({ type: "audio", url: uploaded.url, mimetype: uploaded.mimetype });
            }
          } else if (block.existingUrl) {
            blocks.push({ type: "audio", url: block.existingUrl });
          }
        } else if (block.type === "document") {
          if (block.file) {
            const uploaded = await uploadFile(block.file);
            blocks.push({ type: "document", url: uploaded.url, caption: block.caption || "", mimetype: uploaded.mimetype });
          } else if (block.existingUrl) {
            blocks.push({ type: "document", url: block.existingUrl, caption: block.caption || "" });
          }
        }
      }

      const firstTextBlock = blocks.find((b) => b.type === "text");

      // Store blocks as JSON in message_body when multi-block
      const isMulti = blocks.length > 1 || blocks[0]?.type !== "text";
      const messageBody = isMulti
        ? JSON.stringify(blocks)
        : (firstTextBlock?.content || title);

      const payload: Record<string, unknown> = {
        name: title,
        target_type: "list",
        target_list_id: selectedGroupId,
        message_type: isMulti ? "multi" : "text",
        message_body: messageBody,
        sender_ids: selectedSenders.map((s) => s.id),
        sender_id: selectedSenders[0]?.id,
        delay_min: delayMessages,
        delay_max: delayContacts,
        use_spintax: useSpintax,
      };

      createMutation.mutate(payload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  /* ────────────────────── Render ────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded hover:bg-surface-bright transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nova Campanha</h2>
          <p className="text-secondary mt-0.5 text-sm">Configure sua campanha de mensagens.</p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* ═══════════ LEFT: Configuration ═══════════ */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* ── Title ── */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Título da Campanha</label>
            <input
              type="text"
              placeholder="Ex: Promoção de Páscoa 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface"
            />
          </div>

          {/* ── Senders ── */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Canal de Envio (Round-Robin)</label>

            {selectedSenders.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedSenders.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs font-medium">
                    <span className="material-symbols-outlined text-sm">phone_android</span>
                    {s.name} · +{s.phone}
                    <button onClick={() => removeSender(s.id)} className="ml-1 hover:text-error transition-colors">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <button
                onClick={() => setSenderDropdownOpen((p) => !p)}
                className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm text-left text-secondary hover:border-primary/50 transition-colors flex items-center justify-between"
              >
                <span>Adicionar remetente...</span>
                <span className="material-symbols-outlined text-sm">{senderDropdownOpen ? "expand_less" : "expand_more"}</span>
              </button>

              {senderDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full bg-surface-container-high border border-outline-variant rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {connectedSenders.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-secondary">Nenhum remetente conectado</p>
                  ) : (
                    connectedSenders.filter((s) => !selectedSenders.find((ss) => ss.id === s.id)).map((sender) => (
                      <button key={sender.id} onClick={() => addSender(sender)} className="w-full text-left px-4 py-2.5 hover:bg-surface-bright transition-colors flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-tertiary" />
                        <div>
                          <p className="text-sm font-medium">{sender.name}</p>
                          <p className="text-[10px] text-secondary font-mono">+{sender.phone}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Message Blocks ── */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Mensagens</label>

            {messageBlocks.map((block, idx) => (
              <div key={block.id} className="bg-background border border-outline-variant rounded-lg p-4 space-y-3">
                {/* Block header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-primary">
                      {block.type === "text" ? "chat" : block.type === "audio" ? "mic" : block.type === "image" ? "image" : "description"}
                    </span>
                    <span className="text-xs font-bold uppercase text-secondary">
                      {block.type === "text" ? "Texto" : block.type === "audio" ? "Áudio" : block.type === "image" ? "Imagem" : "Documento"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {idx > 0 && (
                      <button onClick={() => moveBlock(block.id, -1)} className="p-1 text-secondary hover:text-on-surface">
                        <span className="material-symbols-outlined text-sm">arrow_upward</span>
                      </button>
                    )}
                    {idx < messageBlocks.length - 1 && (
                      <button onClick={() => moveBlock(block.id, 1)} className="p-1 text-secondary hover:text-on-surface">
                        <span className="material-symbols-outlined text-sm">arrow_downward</span>
                      </button>
                    )}
                    <button onClick={() => removeBlock(block.id)} className="p-1 text-secondary hover:text-error">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>

                {/* Text block */}
                {block.type === "text" && (
                  <>
                    <div className="relative">
                      <textarea
                        ref={(el) => { textareaRefs.current[block.id] = el; }}
                        value={block.content}
                        onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                        placeholder="Digite sua mensagem... Use *negrito*, _itálico_, ~tachado~, ```mono```"
                        rows={4}
                        className="w-full bg-surface-container border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface resize-none"
                      />
                      <div className="absolute top-2 right-2">
                        <button
                          onClick={() => setVarDropdownBlockId(varDropdownBlockId === block.id ? null : block.id)}
                          className="px-2 py-1 bg-surface-container-highest border border-outline-variant rounded text-[10px] font-bold text-primary hover:bg-primary/10 transition-colors"
                        >
                          {"{x}"} Variáveis
                        </button>
                        {varDropdownBlockId === block.id && (
                          <div className="absolute right-0 mt-1 w-48 bg-surface-container-high border border-outline-variant rounded-lg shadow-xl z-10">
                            {VARIABLES.map((v) => (
                              <button key={v.value} onClick={() => insertVariable(block.id, v.value)} className="w-full text-left px-3 py-2 text-xs hover:bg-surface-bright transition-colors">
                                <span className="font-mono text-primary">{v.value}</span>
                                <span className="text-secondary ml-2">— {v.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-[10px] text-secondary">
                      <span><b>*negrito*</b></span>
                      <span><i>_itálico_</i></span>
                      <span><s>~tachado~</s></span>
                      <span><code>```mono```</code></span>
                    </div>
                  </>
                )}

                {/* Audio block */}
                {block.type === "audio" && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <label className="flex-1 cursor-pointer">
                        <input type="file" accept=".ogg,audio/ogg" className="hidden" onChange={(e) => handleAudioUpload(block.id, e)} />
                        <div className="bg-surface-container border border-outline-variant rounded px-4 py-2.5 text-sm text-secondary hover:border-primary/50 transition-colors flex items-center gap-2">
                          <span className="material-symbols-outlined text-lg">upload_file</span>
                          Enviar .ogg
                        </div>
                      </label>
                      {recordingBlockId === block.id ? (
                        <button onClick={stopRecording} className="px-4 py-2.5 bg-error text-white rounded font-medium text-sm flex items-center gap-2 animate-pulse">
                          <span className="material-symbols-outlined text-lg">stop</span>
                          Parar
                        </button>
                      ) : (
                        <button onClick={() => startRecording(block.id)} className="px-4 py-2.5 bg-surface-container border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all flex items-center gap-2">
                          <span className="material-symbols-outlined text-lg text-error">mic</span>
                          Gravar
                        </button>
                      )}
                    </div>
                    {block.audioUrl && (
                      <audio controls src={block.audioUrl} className="w-full h-10" />
                    )}
                  </div>
                )}

                {/* Image block */}
                {block.type === "image" && (
                  <div className="space-y-3">
                    <label className="cursor-pointer block">
                      <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => handleFileChange(block.id, e)} />
                      {block.file ? (
                        <img src={URL.createObjectURL(block.file)} alt="" className="max-h-40 rounded-lg border border-outline-variant" />
                      ) : block.existingUrl ? (
                        <div className="relative">
                          <img src={block.existingUrl} alt="" className="max-h-40 rounded-lg border border-outline-variant" />
                          <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-xs text-white font-medium">Clique para trocar</span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-surface-container border-2 border-dashed border-outline-variant rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                          <span className="material-symbols-outlined text-3xl text-secondary mb-2">add_photo_alternate</span>
                          <p className="text-xs text-secondary">Clique para selecionar imagem (JPG, PNG)</p>
                        </div>
                      )}
                    </label>
                    <textarea
                      value={block.caption}
                      onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                      placeholder="Legenda da imagem..."
                      rows={2}
                      className="w-full bg-surface-container border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface resize-none"
                    />
                  </div>
                )}

                {/* Document block */}
                {block.type === "document" && (
                  <div className="space-y-3">
                    <label className="cursor-pointer block">
                      <input type="file" accept=".pdf,.docx,.xlsx,.doc,.xls" className="hidden" onChange={(e) => handleFileChange(block.id, e)} />
                      {block.file ? (
                        <div className="flex items-center gap-3 bg-surface-container border border-outline-variant rounded-lg px-4 py-3">
                          <span className="material-symbols-outlined text-primary text-2xl">description</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium truncate">{block.file.name}</p>
                            <p className="text-[10px] text-secondary">{(block.file.size / 1024).toFixed(0)} KB</p>
                          </div>
                          <span className="material-symbols-outlined text-tertiary">check_circle</span>
                        </div>
                      ) : block.existingUrl ? (
                        <div className="flex items-center gap-3 bg-surface-container border border-outline-variant rounded-lg px-4 py-3 hover:bg-surface-bright/30 transition-colors">
                          <span className="material-symbols-outlined text-primary text-2xl">description</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium truncate">Documento anexado</p>
                            <p className="text-[10px] text-secondary">Clique para trocar</p>
                          </div>
                          <span className="material-symbols-outlined text-tertiary">check_circle</span>
                        </div>
                      ) : (
                        <div className="bg-surface-container border-2 border-dashed border-outline-variant rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                          <span className="material-symbols-outlined text-3xl text-secondary mb-2">upload_file</span>
                          <p className="text-xs text-secondary">Clique para selecionar documento (PDF, DOCX, XLSX)</p>
                        </div>
                      )}
                    </label>
                    <textarea
                      value={block.caption}
                      onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                      placeholder="Legenda do documento..."
                      rows={2}
                      className="w-full bg-surface-container border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface resize-none"
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Add message button */}
            <div className="relative">
              <button
                onClick={() => setAddTypeOpen((p) => !p)}
                className="w-full bg-background border border-dashed border-outline-variant rounded-lg px-4 py-3 text-sm text-secondary hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Adicionar Mensagem
              </button>
              {addTypeOpen && (
                <div className="absolute z-20 mt-1 w-full bg-surface-container-high border border-outline-variant rounded-lg shadow-xl grid grid-cols-2 gap-1 p-2">
                  {([["text", "chat", "Texto"], ["audio", "mic", "Áudio"], ["image", "image", "Imagem"], ["document", "description", "Documento"]] as const).map(([type, icon, label]) => (
                    <button key={type} onClick={() => addMessageBlock(type)} className="flex items-center gap-2 px-3 py-2.5 rounded hover:bg-surface-bright transition-colors text-left">
                      <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Group Selection ── */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Grupo de Envio</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface"
            >
              <option value="">Selecione um grupo...</option>
              {(lists ?? []).map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list.contact_count} contatos)
                </option>
              ))}
            </select>
            {selectedGroup && (
              <div className="flex items-center gap-2 px-3 py-2 bg-tertiary/10 border border-tertiary/20 rounded-lg">
                <span className="material-symbols-outlined text-tertiary text-lg">group</span>
                <span className="text-sm text-tertiary font-medium">
                  {selectedGroup.contact_count} contatos no grupo "{selectedGroup.name}"
                </span>
              </div>
            )}
          </div>

          {/* ── Settings ── */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Configurações</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-secondary">Delay entre mensagens (seg)</label>
                <input
                  type="number"
                  min={15}
                  value={delayMessages}
                  onChange={(e) => setDelayMessages(Math.max(15, Number(e.target.value)))}
                  className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-secondary">Delay entre contatos (seg)</label>
                <input
                  type="number"
                  min={15}
                  value={delayContacts}
                  onChange={(e) => setDelayContacts(Math.max(15, Number(e.target.value)))}
                  className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface"
                />
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={useSpintax}
                onClick={() => setUseSpintax((p) => !p)}
                className={`relative w-10 h-5 rounded-full transition-colors ${useSpintax ? "bg-primary" : "bg-outline-variant"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-on-surface rounded-full transition-transform ${useSpintax ? "translate-x-5" : ""}`} />
              </button>
              <span className="text-sm text-on-surface">Usar Spintax</span>
            </label>
          </div>

          {/* ── Save Button ── */}
          <button
            onClick={handleSave}
            disabled={createMutation.isPending}
            className="w-full px-6 py-3.5 bg-primary text-on-primary rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            {createMutation.isPending ? "Salvando..." : "Salvar Campanha"}
          </button>
        </div>

        {/* ═══════════ RIGHT: WhatsApp Preview ═══════════ */}
        <div className="xl:w-[380px] flex-shrink-0">
          <div className="sticky top-6">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary mb-3 block">
              Pré-visualização
            </label>

            {/* Phone Frame */}
            <div className="bg-[#0a0a0a] rounded-[2.5rem] p-3 shadow-2xl border border-outline-variant/50 mx-auto max-w-[340px]">
              {/* Notch */}
              <div className="bg-[#0a0a0a] rounded-t-[2rem] relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-[#0a0a0a] rounded-b-2xl z-10" />
              </div>

              {/* Screen */}
              <div className="bg-[#0b141a] rounded-[2rem] overflow-hidden">
                {/* Status Bar */}
                <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[10px] text-white/70">
                  <span>09:41</span>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">signal_cellular_alt</span>
                    <span className="material-symbols-outlined text-[12px]">wifi</span>
                    <span className="material-symbols-outlined text-[12px]">battery_full</span>
                  </div>
                </div>

                {/* WhatsApp Header */}
                <div className="bg-[#1f2c34] px-3 py-2 flex items-center gap-3">
                  <span className="material-symbols-outlined text-white/70 text-lg">arrow_back</span>
                  <div className="w-8 h-8 rounded-full bg-[#2a3942] flex items-center justify-center">
                    <span className="material-symbols-outlined text-white/50 text-sm">person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{title || "Campanha"}</p>
                    <p className="text-[10px] text-white/50">online</p>
                  </div>
                  <span className="material-symbols-outlined text-white/70 text-lg">videocam</span>
                  <span className="material-symbols-outlined text-white/70 text-lg">call</span>
                </div>

                {/* Chat Area */}
                <div
                  className="h-[460px] overflow-y-auto px-3 py-3 space-y-2"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`, backgroundColor: "#0b141a" }}
                >
                  {messageBlocks.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-white/20 text-xs">
                        <span className="material-symbols-outlined text-4xl mb-2 block">chat_bubble_outline</span>
                        As mensagens aparecerão aqui
                      </div>
                    </div>
                  ) : (
                    messageBlocks.map((block) => (
                      <div key={block.id} className="flex justify-end">
                        <div className="max-w-[85%] bg-[#005c4b] rounded-lg rounded-tr-none px-3 py-1.5 shadow-sm relative">
                          <div className="absolute -right-2 top-0 w-0 h-0" style={{ borderLeft: "8px solid #005c4b", borderBottom: "8px solid transparent" }} />

                          {/* Text */}
                          {block.type === "text" && block.content && (
                            <p className="text-[13px] text-white leading-[1.4] break-words whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatWhatsApp(replaceVariables(block.content)) }} />
                          )}
                          {block.type === "text" && !block.content && (
                            <p className="text-[13px] text-white/40 italic">Mensagem vazia...</p>
                          )}

                          {/* Image */}
                          {block.type === "image" && (
                            <div className="space-y-1">
                              {block.file ? (
                                <img src={URL.createObjectURL(block.file)} alt="" className="rounded-md max-h-36 w-full object-cover" />
                              ) : block.existingUrl ? (
                                <img src={block.existingUrl} alt="" className="rounded-md max-h-36 w-full object-cover" />
                              ) : (
                                <div className="w-full h-28 bg-[#0a2e26] rounded-md flex items-center justify-center">
                                  <span className="material-symbols-outlined text-white/20 text-3xl">image</span>
                                </div>
                              )}
                              {block.caption && (
                                <p className="text-[13px] text-white leading-[1.4] break-words" dangerouslySetInnerHTML={{ __html: formatWhatsApp(replaceVariables(block.caption)) }} />
                              )}
                            </div>
                          )}

                          {/* Audio */}
                          {block.type === "audio" && (
                            <div className="flex items-center gap-2 py-1 min-w-[180px]">
                              <div className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-outlined text-white text-sm">play_arrow</span>
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-[2px]">
                                  {Array.from({ length: 28 }).map((_, i) => (
                                    <div key={i} className="w-[3px] bg-white/40 rounded-full" style={{ height: `${4 + Math.sin(i * 0.8) * 6 + Math.random() * 5}px` }} />
                                  ))}
                                </div>
                                <p className="text-[10px] text-white/50">0:00</p>
                              </div>
                              <div className="w-7 h-7 rounded-full bg-[#2a3942] flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-outlined text-white/50 text-[10px]">person</span>
                              </div>
                            </div>
                          )}

                          {/* Document */}
                          {block.type === "document" && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-3 bg-[#0a2e26] rounded-md px-3 py-3">
                                <span className="material-symbols-outlined text-[#8696a0] text-2xl">description</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white truncate">{block.file?.name ?? "documento.pdf"}</p>
                                  <p className="text-[10px] text-white/40">{block.file ? `${(block.file.size / 1024).toFixed(0)} KB` : "PDF"}</p>
                                </div>
                                <span className="material-symbols-outlined text-[#8696a0] text-lg">download</span>
                              </div>
                              {block.caption && (
                                <p className="text-[13px] text-white leading-[1.4] break-words" dangerouslySetInnerHTML={{ __html: formatWhatsApp(replaceVariables(block.caption)) }} />
                              )}
                            </div>
                          )}

                          {/* Timestamp */}
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            <span className="text-[10px] text-white/40">{currentTime()}</span>
                            <span className="material-symbols-outlined text-[#53bdeb] text-[13px]">done_all</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={previewEndRef} />
                </div>

                {/* Input Bar */}
                <div className="bg-[#1f2c34] px-3 py-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-white/50 text-xl">mood</span>
                  <div className="flex-1 bg-[#2a3942] rounded-full px-4 py-1.5 text-[13px] text-white/30">Mensagem</div>
                  <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-lg">mic</span>
                  </div>
                </div>

                {/* Home Indicator */}
                <div className="flex justify-center py-2">
                  <div className="w-28 h-1 bg-white/20 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
