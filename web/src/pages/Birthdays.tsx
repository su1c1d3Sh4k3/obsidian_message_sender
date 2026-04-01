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

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  phone: string;
  organization: string | null;
  city: string | null;
  state: string | null;
  birth_date: string | null;
  is_valid: boolean;
  is_blacklisted: boolean;
  contact_tags?: Array<{ tags: { id: string; name: string; color: string } }>;
}

interface BirthdayCampaign {
  id: string;
  name: string;
  is_active: boolean;
  message_type: string;
  message_body: string;
  media_url: string | null;
  sender_id: string | null;
  sender_ids: string[] | null;
  delay_min: number;
  delay_max: number;
  use_spintax: boolean;
  send_time: string;
  total_sent: number;
  last_run_date: string | null;
  created_at: string;
  updated_at: string;
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

/* ───────────────────────── Variables ───────────────────────── */

const VARIABLES = [
  { label: "Primeiro Nome", value: "{{primeiro_nome}}" },
  { label: "Nome Completo", value: "{{nome_completo}}" },
  { label: "Cidade", value: "{{cidade}}" },
  { label: "Empresa", value: "{{empresa}}" },
  { label: "Telefone", value: "{{telefone}}" },
];

/* ───────────────────────── Helpers ───────────────────────── */

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function formatDateBR(iso: string | null): string {
  if (!iso) return "-";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
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

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/* ═══════════════════════════════════════════════════════════ */
/*                    MAIN PAGE                               */
/* ═══════════════════════════════════════════════════════════ */

export default function Birthdays() {
  const [view, setView] = useState<"list" | "campaign">("list");
  const [editCampaignId, setEditCampaignId] = useState<string | null>(null);

  return view === "campaign" ? (
    <BirthdayCampaignForm
      onBack={() => { setView("list"); setEditCampaignId(null); }}
      editId={editCampaignId}
    />
  ) : (
    <BirthdayList
      onCreateCampaign={() => setView("campaign")}
      onEditCampaign={(id) => { setEditCampaignId(id); setView("campaign"); }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*                    BIRTHDAY LIST VIEW                      */
/* ═══════════════════════════════════════════════════════════ */

function BirthdayList({
  onCreateCampaign,
  onEditCampaign,
}: {
  onCreateCampaign: () => void;
  onEditCampaign: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);

  const { data: contactsData, isLoading } = useQuery({
    queryKey: ["birthday-contacts", selectedDate],
    queryFn: () =>
      api.get<{
        data: Contact[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      }>(`/birthdays/contacts?date=${selectedDate}&limit=200`),
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["birthday-campaigns"],
    queryFn: () => api.get<BirthdayCampaign[]>("/birthdays/campaign"),
  });

  const activeCampaign = campaigns.find((c) => c.is_active);

  const toggleMutation = useMutation({
    mutationFn: (campaign: BirthdayCampaign) =>
      api.put(`/birthdays/campaign/${campaign.id}`, { is_active: !campaign.is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["birthday-campaigns"] });
      toast.success("Status atualizado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/birthdays/campaign/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["birthday-campaigns"] });
      toast.success("Campanha removida!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const contacts = contactsData?.data ?? [];
  const isToday = selectedDate === today;

  // Format selected date for display
  const displayDate = formatDateBR(selectedDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Aniversariantes</h2>
          <p className="text-secondary mt-0.5 text-sm">
            {isToday ? "Aniversariantes de hoje" : `Aniversariantes de ${displayDate}`}
            {contacts.length > 0 && ` — ${contacts.length} contato(s)`}
          </p>
        </div>
        <button
          onClick={onCreateCampaign}
          className="px-5 py-2.5 bg-primary text-on-primary rounded-lg font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">cake</span>
          Nova Campanha de Aniversário
        </button>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-4">
        <div className="bg-surface-container border border-outline-variant rounded-xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">calendar_today</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-sm outline-none text-on-surface"
          />
          {!isToday && (
            <button
              onClick={() => setSelectedDate(today)}
              className="text-xs text-primary hover:underline font-medium"
            >
              Hoje
            </button>
          )}
        </div>
      </div>

      {/* Active campaign card */}
      {campaigns.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-secondary">Campanhas de Aniversário</h3>
          <div className="grid gap-3">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className={`bg-surface-container border rounded-xl p-4 flex items-center justify-between ${
                  campaign.is_active ? "border-tertiary/50" : "border-outline-variant"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${campaign.is_active ? "bg-tertiary/10" : "bg-surface-container-highest"}`}>
                    <span className={`material-symbols-outlined ${campaign.is_active ? "text-tertiary" : "text-secondary"}`}>
                      cake
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">{campaign.name}</p>
                      {campaign.is_active && (
                        <span className="px-2 py-0.5 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded-full uppercase">
                          Ativa
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-secondary mt-0.5">
                      Envio às {campaign.send_time} &middot; {campaign.total_sent} envios realizados
                      {campaign.last_run_date && ` &middot; Último: ${formatDateBR(campaign.last_run_date)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleMutation.mutate(campaign)}
                    className={`p-2 rounded-lg transition-colors ${
                      campaign.is_active
                        ? "text-tertiary hover:bg-tertiary/10"
                        : "text-secondary hover:bg-surface-bright"
                    }`}
                    title={campaign.is_active ? "Desativar" : "Ativar"}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {campaign.is_active ? "toggle_on" : "toggle_off"}
                    </span>
                  </button>
                  <button
                    onClick={() => onEditCampaign(campaign.id)}
                    className="p-2 rounded-lg text-secondary hover:bg-surface-bright transition-colors"
                    title="Editar"
                  >
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Tem certeza que deseja excluir esta campanha?")) {
                        deleteMutation.mutate(campaign.id);
                      }
                    }}
                    className="p-2 rounded-lg text-secondary hover:text-error hover:bg-error/10 transition-colors"
                    title="Excluir"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contacts table */}
      <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
            <p className="text-sm text-secondary mt-3">Carregando aniversariantes...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-secondary mb-3">cake</span>
            <p className="text-sm font-medium text-secondary">
              {isToday ? "Nenhum aniversariante hoje" : `Nenhum aniversariante em ${displayDate}`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-high/50">
                  <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-secondary">Contato</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-secondary">WhatsApp</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-secondary hidden lg:table-cell">Nascimento</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-secondary hidden xl:table-cell">Idade</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-secondary hidden lg:table-cell">Cidade/UF</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-secondary hidden md:table-cell">Tags</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-secondary">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-surface-bright/30 transition-colors">
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium">{contact.display_name}</p>
                      {contact.organization && (
                        <p className="text-[10px] text-secondary">{contact.organization}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-on-surface-variant">
                        +{contact.phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "$1 ($2) $3-$4")}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-on-surface-variant">{formatDateBR(contact.birth_date)}</span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-xs text-on-surface-variant">
                        {contact.birth_date ? `${calculateAge(contact.birth_date)} anos` : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-on-surface-variant">
                        {[contact.city, contact.state].filter(Boolean).join("/") || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(contact.contact_tags ?? []).slice(0, 2).map((ct) => (
                          <span
                            key={ct.tags.id}
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                            style={{ backgroundColor: ct.tags.color + "20", color: ct.tags.color }}
                          >
                            {ct.tags.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {contact.is_blacklisted ? (
                        <span className="text-[9px] font-black uppercase tracking-widest text-error">Bloqueado</span>
                      ) : contact.is_valid ? (
                        <span className="text-[9px] font-black uppercase tracking-widest text-tertiary">Válido</span>
                      ) : (
                        <span className="text-[9px] font-black uppercase tracking-widest text-warning">Inválido</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*              BIRTHDAY CAMPAIGN FORM                        */
/* ═══════════════════════════════════════════════════════════ */

function BirthdayCampaignForm({ onBack, editId }: { onBack: () => void; editId?: string | null }) {
  const queryClient = useQueryClient();
  const isEditing = !!editId;

  /* ── Data ── */
  const { data: senders } = useQuery({
    queryKey: ["senders"],
    queryFn: () => api.get<Sender[]>("/senders"),
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["birthday-campaigns"],
    queryFn: () => api.get<BirthdayCampaign[]>("/birthdays/campaign"),
  });

  const editData = campaigns.find((c) => c.id === editId);

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
  const [delayMessages, setDelayMessages] = useState(15);
  const [delayContacts, setDelayContacts] = useState(45);
  const [useSpintax, setUseSpintax] = useState(false);
  const [sendTime, setSendTime] = useState("09:00");
  const [isActive, setIsActive] = useState(true);
  const [editLoaded, setEditLoaded] = useState(false);

  // Load edit data
  useEffect(() => {
    if (!editData || !senders || editLoaded) return;
    setTitle(editData.name);
    setDelayMessages(editData.delay_min);
    setDelayContacts(editData.delay_max);
    setUseSpintax(editData.use_spintax);
    setSendTime(editData.send_time?.slice(0, 5) || "09:00");
    setIsActive(editData.is_active);

    const senderIds = editData.sender_ids?.length ? editData.sender_ids : editData.sender_id ? [editData.sender_id] : [];
    setSelectedSenders(senders.filter((s) => senderIds.includes(s.id)));

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

  /* ── Audio ── */
  const [recordingBlockId, setRecordingBlockId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  /* ── Variable dropdown ── */
  const [varDropdownBlockId, setVarDropdownBlockId] = useState<string | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  /* ── Preview ── */
  const previewEndRef = useRef<HTMLDivElement>(null);
  const lastBlockCountRef = useRef(0);
  useEffect(() => {
    if (messageBlocks.length > lastBlockCountRef.current) {
      previewEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    lastBlockCountRef.current = messageBlocks.length;
  }, [messageBlocks.length]);

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

  const startRecording = useCallback(async (blockId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm;codecs=opus";
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
      toast.error("Erro ao acessar microfone.");
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
      isEditing ? api.put(`/birthdays/campaign/${editId}`, payload) : api.post("/birthdays/campaign", payload),
    onSuccess: () => {
      toast.success(isEditing ? "Campanha atualizada!" : "Campanha de aniversário criada!");
      queryClient.invalidateQueries({ queryKey: ["birthday-campaigns"] });
      onBack();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return toast.error("Informe o título da campanha");
    if (messageBlocks.length === 0) return toast.error("Adicione pelo menos uma mensagem");
    if (selectedSenders.length === 0) return toast.error("Selecione pelo menos um remetente");
    if (!sendTime) return toast.error("Informe o horário de envio");

    setIsSaving(true);

    try {
      const blocks: { type: string; content?: string; url?: string; caption?: string }[] = [];

      for (const block of messageBlocks) {
        if (block.type === "text") {
          blocks.push({ type: "text", content: block.content });
        } else if (block.type === "image") {
          if (block.file) {
            const uploaded = await uploadFile(block.file);
            blocks.push({ type: "image", url: uploaded.url, caption: block.caption || "" });
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
              blocks.push({ type: "audio", url: uploaded.url });
            }
          } else if (block.existingUrl) {
            blocks.push({ type: "audio", url: block.existingUrl });
          }
        } else if (block.type === "document") {
          if (block.file) {
            const uploaded = await uploadFile(block.file);
            blocks.push({ type: "document", url: uploaded.url, caption: block.caption || "" });
          } else if (block.existingUrl) {
            blocks.push({ type: "document", url: block.existingUrl, caption: block.caption || "" });
          }
        }
      }

      const firstTextBlock = blocks.find((b) => b.type === "text");
      const isMulti = blocks.length > 1 || blocks[0]?.type !== "text";
      const messageBody = isMulti ? JSON.stringify(blocks) : (firstTextBlock?.content || title);

      const payload: Record<string, unknown> = {
        name: title,
        message_type: isMulti ? "multi" : "text",
        message_body: messageBody,
        sender_ids: selectedSenders.map((s) => s.id),
        sender_id: selectedSenders[0]?.id,
        delay_min: delayMessages,
        delay_max: delayContacts,
        use_spintax: useSpintax,
        send_time: sendTime,
        is_active: isActive,
      };

      createMutation.mutate(payload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded hover:bg-surface-bright transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Editar Campanha de Aniversário" : "Nova Campanha de Aniversário"}
          </h2>
          <p className="text-secondary mt-0.5 text-sm">
            Mensagem automática enviada diariamente aos aniversariantes.
          </p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* LEFT: Config */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Title */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Título da Campanha</label>
            <input
              type="text"
              placeholder="Ex: Parabéns pelo seu aniversário!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface"
            />
          </div>

          {/* Send time + Active toggle */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-6">
              <div className="flex-1 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Horário do Envio</label>
                <input
                  type="time"
                  value={sendTime}
                  onChange={(e) => setSendTime(e.target.value)}
                  className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Status</label>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded border text-sm font-medium transition-all ${
                    isActive
                      ? "bg-tertiary/10 border-tertiary/30 text-tertiary"
                      : "bg-background border-outline-variant text-secondary"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">
                    {isActive ? "toggle_on" : "toggle_off"}
                  </span>
                  {isActive ? "Ativa" : "Inativa"}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-secondary">
              A campanha será disparada automaticamente todos os dias no horário definido, para os contatos que fazem aniversário naquele dia.
            </p>
          </div>

          {/* Senders */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Canal de Envio (Round-Robin)</label>

            {selectedSenders.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedSenders.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs font-medium">
                    <span className="material-symbols-outlined text-sm">phone_android</span>
                    {s.name} &middot; +{s.phone}
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

          {/* Message Blocks */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Mensagens</label>

            {messageBlocks.map((block, idx) => (
              <div key={block.id} className="bg-background border border-outline-variant rounded-lg p-4 space-y-3">
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

                {/* Text */}
                {block.type === "text" && (
                  <>
                    <div className="relative">
                      <textarea
                        ref={(el) => { textareaRefs.current[block.id] = el; }}
                        value={block.content}
                        onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                        placeholder="Digite sua mensagem de aniversário... Use *negrito*, _itálico_, ~tachado~, ```mono```"
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

                {/* Audio */}
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
                    {block.audioUrl && <audio controls src={block.audioUrl} className="w-full h-10" />}
                  </div>
                )}

                {/* Image */}
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
                          <p className="text-xs text-secondary">Clique para selecionar imagem</p>
                        </div>
                      )}
                    </label>
                    <textarea
                      value={block.caption}
                      onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                      placeholder="Legenda da imagem (opcional)"
                      rows={2}
                      className="w-full bg-surface-container border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface resize-none"
                    />
                  </div>
                )}

                {/* Document */}
                {block.type === "document" && (
                  <div className="space-y-3">
                    <label className="cursor-pointer block">
                      <input type="file" className="hidden" onChange={(e) => handleFileChange(block.id, e)} />
                      {block.file ? (
                        <div className="bg-surface-container border border-outline-variant rounded-lg p-4 flex items-center gap-3">
                          <span className="material-symbols-outlined text-2xl text-primary">description</span>
                          <div>
                            <p className="text-sm font-medium">{block.file.name}</p>
                            <p className="text-[10px] text-secondary">{(block.file.size / 1024).toFixed(0)} KB</p>
                          </div>
                        </div>
                      ) : block.existingUrl ? (
                        <div className="bg-surface-container border border-outline-variant rounded-lg p-4 flex items-center gap-3 hover:bg-surface-bright transition-colors">
                          <span className="material-symbols-outlined text-2xl text-primary">description</span>
                          <p className="text-sm text-secondary">Documento carregado — clique para trocar</p>
                        </div>
                      ) : (
                        <div className="bg-surface-container border-2 border-dashed border-outline-variant rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                          <span className="material-symbols-outlined text-3xl text-secondary mb-2">upload_file</span>
                          <p className="text-xs text-secondary">Clique para selecionar documento</p>
                        </div>
                      )}
                    </label>
                    <textarea
                      value={block.caption}
                      onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                      placeholder="Legenda do documento (opcional)"
                      rows={2}
                      className="w-full bg-surface-container border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface resize-none"
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Add block */}
            <div className="relative">
              <button
                onClick={() => setAddTypeOpen((p) => !p)}
                className="w-full bg-background border-2 border-dashed border-outline-variant rounded-lg p-4 text-center hover:border-primary/50 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg text-primary">add</span>
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Adicionar bloco</span>
              </button>
              {addTypeOpen && (
                <div className="absolute z-10 mt-1 left-1/2 -translate-x-1/2 bg-surface-container-high border border-outline-variant rounded-lg shadow-xl flex overflow-hidden">
                  {(["text", "audio", "image", "document"] as MessageBlockType[]).map((type) => (
                    <button key={type} onClick={() => addMessageBlock(type)} className="px-4 py-3 hover:bg-surface-bright transition-colors flex flex-col items-center gap-1">
                      <span className="material-symbols-outlined text-primary">
                        {type === "text" ? "chat" : type === "audio" ? "mic" : type === "image" ? "image" : "description"}
                      </span>
                      <span className="text-[9px] font-bold uppercase text-secondary">
                        {type === "text" ? "Texto" : type === "audio" ? "Áudio" : type === "image" ? "Imagem" : "Doc"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Configurações</label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-secondary uppercase">Delay entre mensagens (s)</label>
                <input type="number" min={5} value={delayMessages} onChange={(e) => setDelayMessages(Number(e.target.value))} className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm outline-none text-on-surface" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-secondary uppercase">Delay entre contatos (s)</label>
                <input type="number" min={10} value={delayContacts} onChange={(e) => setDelayContacts(Number(e.target.value))} className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm outline-none text-on-surface" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useSpintax} onChange={(e) => setUseSpintax(e.target.checked)} className="rounded" />
              <span className="text-xs text-on-surface">Usar Spintax {"{opção1|opção2|opção3}"}</span>
            </label>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={isSaving || createMutation.isPending}
            className="w-full px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            {isSaving || createMutation.isPending ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Campanha de Aniversário"}
          </button>
        </div>

        {/* RIGHT: Preview */}
        <div className="xl:w-[380px] xl:sticky xl:top-4 xl:self-start">
          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-[#075e54] text-white flex items-center gap-3">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Preview da Mensagem</p>
                <p className="text-[10px] opacity-70">Visualização aproximada</p>
              </div>
            </div>

            <div className="bg-[#0b141a] p-3 min-h-[300px] max-h-[500px] overflow-y-auto space-y-2"
              style={{ backgroundImage: "url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"200\"><rect fill=\"%230b141a\"/></svg>')" }}>
              {messageBlocks.length === 0 && (
                <p className="text-center text-white/30 text-xs py-8">Adicione blocos de mensagem para ver a preview</p>
              )}
              {messageBlocks.map((block) => (
                <div key={block.id}>
                  {block.type === "text" && block.content && (
                    <div className="bg-[#005c4b] rounded-lg px-3 py-2 max-w-[85%] ml-auto">
                      <p className="text-[13px] text-[#e9edef] leading-relaxed" dangerouslySetInnerHTML={{ __html: formatWhatsApp(block.content) }} />
                    </div>
                  )}
                  {block.type === "image" && (
                    <div className="bg-[#005c4b] rounded-lg p-1 max-w-[85%] ml-auto">
                      {block.file ? (
                        <img src={URL.createObjectURL(block.file)} alt="" className="rounded w-full" />
                      ) : block.existingUrl ? (
                        <img src={block.existingUrl} alt="" className="rounded w-full" />
                      ) : (
                        <div className="h-32 bg-white/5 rounded flex items-center justify-center">
                          <span className="material-symbols-outlined text-white/20 text-3xl">image</span>
                        </div>
                      )}
                      {block.caption && (
                        <p className="text-[13px] text-[#e9edef] px-2 py-1" dangerouslySetInnerHTML={{ __html: formatWhatsApp(block.caption) }} />
                      )}
                    </div>
                  )}
                  {block.type === "audio" && (
                    <div className="bg-[#005c4b] rounded-lg px-3 py-2 max-w-[85%] ml-auto flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#25D366] text-lg">play_arrow</span>
                      <div className="flex-1 h-1.5 bg-white/20 rounded-full" />
                      <span className="text-[10px] text-white/60">0:00</span>
                    </div>
                  )}
                  {block.type === "document" && (
                    <div className="bg-[#005c4b] rounded-lg px-3 py-2 max-w-[85%] ml-auto flex items-center gap-2">
                      <span className="material-symbols-outlined text-white/60">description</span>
                      <span className="text-[13px] text-[#e9edef] truncate">{block.file?.name || "Documento"}</span>
                    </div>
                  )}
                </div>
              ))}
              <div ref={previewEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
