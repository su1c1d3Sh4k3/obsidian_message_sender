import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, uploadFile } from "@/lib/api";
import toast from "react-hot-toast";
/* ───────────────────────── Variables ───────────────────────── */
const VARIABLES = [
    { label: "Primeiro Nome", value: "{{primeiro_nome}}" },
    { label: "Nome Completo", value: "{{nome_completo}}" },
    { label: "Cidade", value: "{{cidade}}" },
    { label: "Empresa", value: "{{empresa}}" },
    { label: "Telefone", value: "{{telefone}}" },
];
const VARIABLE_EXAMPLES = {
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
function formatWhatsApp(text) {
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
function replaceVariables(text) {
    let result = text;
    for (const [key, val] of Object.entries(VARIABLE_EXAMPLES)) {
        result = result.replaceAll(key, val);
    }
    return result;
}
function currentTime() {
    return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
const statusLabels = {
    draft: "Aguardando Envio",
    scheduled: "Aguardando Envio",
    running: "Enviando",
    paused: "Pausada",
    completed: "Enviada",
    cancelled: "Cancelada",
    failed: "Falhou",
};
const statusColors = {
    draft: "bg-secondary-container text-secondary",
    scheduled: "bg-primary/10 text-primary border border-primary/20",
    running: "bg-tertiary/10 text-tertiary border border-tertiary/20",
    paused: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
    completed: "bg-tertiary/10 text-tertiary border border-tertiary/20",
    cancelled: "bg-error-container text-on-error-container",
    failed: "bg-error-container text-on-error-container",
};
const msgStatusLabels = {
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
    const [view, setView] = useState("list");
    const [editingId, setEditingId] = useState(null);
    if (view === "create") {
        return _jsx(CampaignCreate, { editId: editingId, onBack: () => { setView("list"); setEditingId(null); } });
    }
    return _jsx(CampaignListView, { onNew: () => setView("create"), onEdit: (id) => { setEditingId(id); setView("create"); } });
}
/* ═══════════════════════ Campaign List ═══════════════════════ */
function CampaignListView({ onNew, onEdit }) {
    const queryClient = useQueryClient();
    const [expandedId, setExpandedId] = useState(null);
    const { data, isLoading } = useQuery({
        queryKey: ["campaigns"],
        queryFn: () => api.get("/campaigns?limit=50"),
        refetchInterval: 5000,
    });
    const campaigns = data?.data ?? [];
    // Fetch logs for expanded campaign
    const { data: logsData } = useQuery({
        queryKey: ["campaign-messages", expandedId],
        queryFn: () => api.get(`/campaigns/${expandedId}/messages?limit=50`),
        enabled: !!expandedId,
        refetchInterval: expandedId ? 3000 : false,
    });
    const actionMutation = useMutation({
        mutationFn: ({ id, action }) => api.post(`/campaigns/${id}/action`, { action }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        },
        onError: (err) => toast.error(err.message),
    });
    function handlePlayPause(campaign) {
        if (campaign.status === "running") {
            actionMutation.mutate({ id: campaign.id, action: "pause" });
        }
        else if (campaign.status === "paused") {
            actionMutation.mutate({ id: campaign.id, action: "resume" });
            setExpandedId(campaign.id);
        }
        else if (campaign.status === "draft" || campaign.status === "scheduled") {
            actionMutation.mutate({ id: campaign.id, action: "start" });
            setExpandedId(campaign.id);
        }
    }
    function toggleExpand(id) {
        setExpandedId((prev) => (prev === id ? null : id));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold tracking-tight", children: "Campanhas" }), _jsx("p", { className: "text-secondary mt-1", children: "Gerencie suas campanhas de envio." })] }), _jsxs("button", { onClick: onNew, className: "px-4 py-2 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "add" }), "Nova Campanha"] })] }), _jsx("div", { className: "space-y-3", children: isLoading ? (_jsx("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-12 text-center text-secondary", children: "Carregando..." })) : campaigns.length === 0 ? (_jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-12 text-center", children: [_jsx("span", { className: "material-symbols-outlined text-4xl text-secondary mb-3 block", children: "campaign" }), _jsx("p", { className: "text-secondary", children: "Nenhuma campanha criada" }), _jsx("p", { className: "text-xs text-secondary mt-1", children: "Clique em \"Nova Campanha\" para come\u00E7ar." })] })) : (campaigns.map((campaign) => {
                    const pct = campaign.total_contacts > 0 ? Math.round((campaign.sent_count / campaign.total_contacts) * 100) : 0;
                    const isExpanded = expandedId === campaign.id;
                    const canPlay = ["draft", "scheduled", "paused"].includes(campaign.status);
                    const canPause = campaign.status === "running";
                    const isFinished = ["completed", "cancelled", "failed"].includes(campaign.status);
                    return (_jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-surface-bright/30 transition-colors", onClick: () => toggleExpand(campaign.id), children: [_jsx("button", { onClick: (e) => {
                                            e.stopPropagation();
                                            if (!isFinished)
                                                handlePlayPause(campaign);
                                        }, disabled: isFinished, className: `w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${canPause
                                            ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                                            : canPlay
                                                ? "bg-tertiary/20 text-tertiary hover:bg-tertiary/30"
                                                : "bg-surface-container-highest text-secondary"}`, children: _jsx("span", { className: "material-symbols-outlined text-xl", children: canPause ? "pause" : isFinished ? "check_circle" : "play_arrow" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("p", { className: "text-sm font-bold truncate", children: campaign.name }), _jsx("span", { className: `text-[9px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${statusColors[campaign.status] ?? ""}`, children: statusLabels[campaign.status] ?? campaign.status.toUpperCase() })] }), _jsxs("div", { className: "flex items-center gap-4 mt-1.5 text-[11px] text-secondary", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-[14px]", children: "calendar_today" }), "Criada: ", new Date(campaign.created_at).toLocaleDateString("pt-BR")] }), campaign.completed_at && (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-[14px]", children: "check_circle" }), "Enviada: ", new Date(campaign.completed_at).toLocaleDateString("pt-BR")] })), campaign.started_at && !campaign.completed_at && (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-[14px]", children: "schedule" }), "In\u00EDcio: ", new Date(campaign.started_at).toLocaleString("pt-BR")] }))] })] }), _jsxs("div", { className: "hidden sm:flex items-center gap-3 w-48 shrink-0", children: [_jsx("div", { className: "flex-1", children: _jsx("div", { className: "h-2 w-full bg-outline-variant rounded-full overflow-hidden flex", children: campaign.total_contacts > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "h-full bg-tertiary transition-all duration-500", style: { width: `${((campaign.delivered_count || campaign.sent_count) / campaign.total_contacts) * 100}%` } }), campaign.failed_count > 0 && (_jsx("div", { className: "h-full bg-error transition-all duration-500", style: { width: `${(campaign.failed_count / campaign.total_contacts) * 100}%` } }))] })) }) }), _jsxs("span", { className: "text-xs font-mono text-secondary w-10 text-right", children: [pct, "%"] })] }), _jsx("span", { className: `material-symbols-outlined text-secondary transition-transform ${isExpanded ? "rotate-180" : ""}`, children: "expand_more" })] }), isExpanded && (_jsxs("div", { className: "border-t border-outline-variant", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-3 bg-surface-container-high/30 text-xs", children: [_jsxs("div", { className: "flex items-center gap-6", children: [_jsxs("span", { className: "text-secondary", children: ["Total: ", _jsx("span", { className: "font-mono font-bold text-on-surface", children: campaign.total_contacts })] }), _jsxs("span", { className: "text-secondary", children: ["Enviadas: ", _jsx("span", { className: "font-mono font-bold text-tertiary", children: campaign.sent_count })] }), _jsxs("span", { className: "text-secondary", children: ["Falhas: ", _jsx("span", { className: "font-mono font-bold text-error", children: campaign.failed_count })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [campaign.status === "draft" && (_jsxs("button", { onClick: (e) => { e.stopPropagation(); onEdit(campaign.id); }, className: "px-3 py-1.5 text-xs font-medium bg-primary/10 border border-primary/20 text-primary rounded hover:bg-primary/20 transition-all flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-sm", children: "edit" }), "Editar"] })), isFinished && (_jsxs("button", { onClick: (e) => {
                                                            e.stopPropagation();
                                                            if (confirm("Reativar esta campanha? Os logs anteriores serão apagados.")) {
                                                                actionMutation.mutate({ id: campaign.id, action: "reactivate" });
                                                            }
                                                        }, className: "px-3 py-1.5 text-xs font-medium bg-primary/10 border border-primary/20 text-primary rounded hover:bg-primary/20 transition-all flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-sm", children: "restart_alt" }), "Reativar"] })), canPlay && campaign.status !== "draft" && (_jsxs("button", { onClick: (e) => {
                                                            e.stopPropagation();
                                                            if (confirm("Cancelar esta campanha?")) {
                                                                actionMutation.mutate({ id: campaign.id, action: "cancel" });
                                                            }
                                                        }, className: "px-3 py-1.5 text-xs font-medium bg-error/10 border border-error/20 text-error rounded hover:bg-error/20 transition-all flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-sm", children: "stop" }), "Cancelar"] })), canPause && (_jsxs("button", { onClick: (e) => {
                                                            e.stopPropagation();
                                                            if (confirm("Cancelar esta campanha?")) {
                                                                actionMutation.mutate({ id: campaign.id, action: "cancel" });
                                                            }
                                                        }, className: "px-3 py-1.5 text-xs font-medium bg-error/10 border border-error/20 text-error rounded hover:bg-error/20 transition-all flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-sm", children: "stop" }), "Cancelar"] }))] })] }), _jsx("div", { className: "max-h-[420px] overflow-y-auto", children: _jsxs("table", { className: "w-full text-left border-collapse", children: [_jsx("thead", { className: "sticky top-0 z-10", children: _jsxs("tr", { className: "bg-surface-container-high", children: [_jsx("th", { className: "px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-secondary", children: "Contato" }), _jsx("th", { className: "px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-secondary", children: "Telefone" }), _jsx("th", { className: "px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-secondary hidden md:table-cell", children: "Mensagem" }), _jsx("th", { className: "px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-secondary", children: "Status" }), _jsx("th", { className: "px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-secondary hidden sm:table-cell", children: "Hor\u00E1rio" })] }) }), _jsx("tbody", { className: "divide-y divide-outline-variant", children: !logsData?.data?.length ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-5 py-8 text-center text-secondary text-xs", children: campaign.status === "draft" ? "Inicie a campanha para ver os logs." : "Nenhum log disponível." }) })) : (logsData.data.map((msg) => (_jsxs("tr", { className: "hover:bg-surface-bright/20 transition-colors", children: [_jsx("td", { className: "px-5 py-2.5", children: _jsx("span", { className: "text-xs font-medium", children: msg.contact_name || "-" }) }), _jsx("td", { className: "px-5 py-2.5", children: _jsxs("span", { className: "text-xs font-mono text-on-surface-variant", children: ["+", msg.phone] }) }), _jsx("td", { className: "px-5 py-2.5 hidden md:table-cell", children: _jsx("span", { className: "text-[11px] text-secondary truncate block max-w-[200px]", children: msg.message_rendered || "-" }) }), _jsxs("td", { className: "px-5 py-2.5", children: [_jsx("span", { className: `text-[9px] font-bold px-2 py-0.5 rounded ${msg.status === "sent" || msg.status === "delivered" || msg.status === "read"
                                                                            ? "bg-tertiary/10 text-tertiary border border-tertiary/20"
                                                                            : msg.status === "failed"
                                                                                ? "bg-error/10 text-error border border-error/20"
                                                                                : msg.status === "sending" || msg.status === "queued"
                                                                                    ? "bg-primary/10 text-primary border border-primary/20"
                                                                                    : "bg-secondary-container text-secondary"}`, children: msgStatusLabels[msg.status] ?? msg.status.toUpperCase() }), msg.error_message && (_jsx("p", { className: "text-[9px] text-error mt-0.5 truncate max-w-[120px]", children: msg.error_message }))] }), _jsx("td", { className: "px-5 py-2.5 hidden sm:table-cell", children: _jsx("span", { className: "text-[10px] text-secondary font-mono", children: msg.sent_at
                                                                        ? new Date(msg.sent_at).toLocaleTimeString("pt-BR")
                                                                        : msg.failed_at
                                                                            ? new Date(msg.failed_at).toLocaleTimeString("pt-BR")
                                                                            : "-" }) })] }, msg.id)))) })] }) })] }))] }, campaign.id));
                })) })] }));
}
/* ═══════════════════════ Campaign Create ═══════════════════════ */
function CampaignCreate({ onBack, editId }) {
    const queryClient = useQueryClient();
    const isEditing = !!editId;
    /* ── Data Fetching ── */
    const { data: senders } = useQuery({
        queryKey: ["senders"],
        queryFn: () => api.get("/senders"),
    });
    const { data: lists } = useQuery({
        queryKey: ["lists"],
        queryFn: () => api.get("/lists"),
    });
    const { data: editData } = useQuery({
        queryKey: ["campaign-edit", editId],
        queryFn: () => api.get(`/campaigns/${editId}`),
        enabled: !!editId,
    });
    const connectedSenders = useMemo(() => (senders ?? []).filter((s) => s.status === "connected"), [senders]);
    /* ── Form State ── */
    const [title, setTitle] = useState("");
    const [selectedSenders, setSelectedSenders] = useState([]);
    const [senderDropdownOpen, setSenderDropdownOpen] = useState(false);
    const [messageBlocks, setMessageBlocks] = useState([]);
    const [addTypeOpen, setAddTypeOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState("");
    const [delayMessages, setDelayMessages] = useState(15);
    const [delayContacts, setDelayContacts] = useState(15);
    const [useSpintax, setUseSpintax] = useState(false);
    const [editLoaded, setEditLoaded] = useState(false);
    // Load edit data into form (wait for both editData and senders)
    useEffect(() => {
        if (!editData || !senders || editLoaded)
            return;
        setTitle(editData.name);
        setDelayMessages(editData.delay_min);
        setDelayContacts(editData.delay_max);
        setUseSpintax(editData.use_spintax);
        if (editData.target_list_id)
            setSelectedGroupId(editData.target_list_id);
        // Load senders
        const senderIds = editData.sender_ids?.length ? editData.sender_ids : editData.sender_id ? [editData.sender_id] : [];
        setSelectedSenders(senders.filter((s) => senderIds.includes(s.id)));
        // Load message blocks
        if (editData.message_type === "multi") {
            try {
                const parsed = JSON.parse(editData.message_body);
                setMessageBlocks(parsed.map((b) => ({
                    id: uid(),
                    type: b.type,
                    content: b.content || "",
                    file: null,
                    audioBlob: null,
                    audioUrl: b.type === "audio" && b.url ? b.url : null,
                    caption: b.caption || "",
                    existingUrl: b.url || null,
                })));
            }
            catch {
                setMessageBlocks([{ id: uid(), type: "text", content: editData.message_body, file: null, audioBlob: null, audioUrl: null, caption: "" }]);
            }
        }
        else {
            setMessageBlocks([{ id: uid(), type: "text", content: editData.message_body, file: null, audioBlob: null, audioUrl: null, caption: "" }]);
        }
        setEditLoaded(true);
    }, [editData, senders, editLoaded]);
    /* ── Audio recording state ── */
    const [recordingBlockId, setRecordingBlockId] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    /* ── Variable dropdown state ── */
    const [varDropdownBlockId, setVarDropdownBlockId] = useState(null);
    const textareaRefs = useRef({});
    /* ── Preview scroll ── */
    const previewEndRef = useRef(null);
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
    const addSender = (sender) => {
        if (!selectedSenders.find((s) => s.id === sender.id)) {
            setSelectedSenders((prev) => [...prev, sender]);
        }
        setSenderDropdownOpen(false);
    };
    const removeSender = (id) => {
        setSelectedSenders((prev) => prev.filter((s) => s.id !== id));
    };
    const addMessageBlock = (type) => {
        setMessageBlocks((prev) => [
            ...prev,
            { id: uid(), type, content: "", file: null, audioBlob: null, audioUrl: null, caption: "" },
        ]);
        setAddTypeOpen(false);
    };
    const updateBlock = (id, updates) => {
        setMessageBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
    };
    const removeBlock = (id) => {
        setMessageBlocks((prev) => {
            const block = prev.find((b) => b.id === id);
            if (block?.audioUrl)
                URL.revokeObjectURL(block.audioUrl);
            return prev.filter((b) => b.id !== id);
        });
    };
    const moveBlock = (id, dir) => {
        setMessageBlocks((prev) => {
            const idx = prev.findIndex((b) => b.id === id);
            if (idx < 0)
                return prev;
            const newIdx = idx + dir;
            if (newIdx < 0 || newIdx >= prev.length)
                return prev;
            const arr = [...prev];
            [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
            return arr;
        });
    };
    const insertVariable = (blockId, variable) => {
        const textarea = textareaRefs.current[blockId];
        if (!textarea)
            return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const block = messageBlocks.find((b) => b.id === blockId);
        if (!block)
            return;
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
    const handleFileChange = (blockId, e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        updateBlock(blockId, { file });
    };
    /* ── Audio Recording ── */
    const startRecording = useCallback(async (blockId) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Prefer mp4/aac (WhatsApp compatible), fallback to webm
            const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
                ? "audio/mp4"
                : "audio/webm;codecs=opus";
            const recorder = new MediaRecorder(stream, { mimeType });
            audioChunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0)
                    audioChunksRef.current.push(e.data);
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
        }
        catch {
            toast.error("Erro ao acessar microfone. Verifique as permissões.");
        }
    }, []);
    const stopRecording = useCallback(() => {
        mediaRecorderRef.current?.stop();
    }, []);
    const handleAudioUpload = (blockId, e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const url = URL.createObjectURL(file);
        updateBlock(blockId, { file, audioUrl: url, audioBlob: null });
    };
    /* ── Submit ── */
    const createMutation = useMutation({
        mutationFn: (payload) => isEditing ? api.put(`/campaigns/${editId}`, payload) : api.post("/campaigns", payload),
        onSuccess: () => {
            toast.success(isEditing ? "Campanha atualizada!" : "Campanha salva com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["campaigns"] });
            onBack();
        },
        onError: (err) => toast.error(err.message || "Erro ao salvar campanha"),
    });
    const [isSaving, setIsSaving] = useState(false);
    const handleSave = async () => {
        if (!title.trim())
            return toast.error("Informe o título da campanha");
        if (messageBlocks.length === 0)
            return toast.error("Adicione pelo menos uma mensagem");
        if (!selectedGroupId)
            return toast.error("Selecione um grupo de envio");
        setIsSaving(true);
        try {
            // Upload media files to Supabase Storage and build blocks array
            const blocks = [];
            for (const block of messageBlocks) {
                if (block.type === "text") {
                    blocks.push({ type: "text", content: block.content });
                }
                else if (block.type === "image") {
                    if (block.file) {
                        const uploaded = await uploadFile(block.file);
                        blocks.push({ type: "image", url: uploaded.url, caption: block.caption || "", mimetype: uploaded.mimetype });
                    }
                    else if (block.existingUrl) {
                        blocks.push({ type: "image", url: block.existingUrl, caption: block.caption || "" });
                    }
                }
                else if (block.type === "audio") {
                    if (block.file || block.audioBlob) {
                        let audioFile = block.file || null;
                        if (!audioFile && block.audioBlob) {
                            const ext = block.audioBlob.type.includes("mp4") ? "mp4" : "webm";
                            audioFile = new File([block.audioBlob], `audio.${ext}`, { type: block.audioBlob.type });
                        }
                        if (audioFile) {
                            const uploaded = await uploadFile(audioFile, audioFile.name);
                            blocks.push({ type: "audio", url: uploaded.url, mimetype: uploaded.mimetype });
                        }
                    }
                    else if (block.existingUrl) {
                        blocks.push({ type: "audio", url: block.existingUrl });
                    }
                }
                else if (block.type === "document") {
                    if (block.file) {
                        const uploaded = await uploadFile(block.file);
                        blocks.push({ type: "document", url: uploaded.url, caption: block.caption || "", mimetype: uploaded.mimetype });
                    }
                    else if (block.existingUrl) {
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
            const payload = {
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
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Erro ao salvar");
        }
        finally {
            setIsSaving(false);
        }
    };
    /* ────────────────────── Render ────────────────────── */
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("button", { onClick: onBack, className: "p-2 rounded hover:bg-surface-bright transition-colors", children: _jsx("span", { className: "material-symbols-outlined text-xl", children: "arrow_back" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold tracking-tight", children: "Nova Campanha" }), _jsx("p", { className: "text-secondary mt-0.5 text-sm", children: "Configure sua campanha de mensagens." })] })] }), _jsxs("div", { className: "flex flex-col xl:flex-row gap-6", children: [_jsxs("div", { className: "flex-1 min-w-0 space-y-5", children: [_jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-6 space-y-3", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "T\u00EDtulo da Campanha" }), _jsx("input", { type: "text", placeholder: "Ex: Promo\u00E7\u00E3o de P\u00E1scoa 2026", value: title, onChange: (e) => setTitle(e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface" })] }), _jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-6 space-y-3", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Canal de Envio (Round-Robin)" }), selectedSenders.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-2", children: selectedSenders.map((s) => (_jsxs("span", { className: "inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs font-medium", children: [_jsx("span", { className: "material-symbols-outlined text-sm", children: "phone_android" }), s.name, " \u00B7 +", s.phone, _jsx("button", { onClick: () => removeSender(s.id), className: "ml-1 hover:text-error transition-colors", children: _jsx("span", { className: "material-symbols-outlined text-sm", children: "close" }) })] }, s.id))) })), _jsxs("div", { className: "relative", children: [_jsxs("button", { onClick: () => setSenderDropdownOpen((p) => !p), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm text-left text-secondary hover:border-primary/50 transition-colors flex items-center justify-between", children: [_jsx("span", { children: "Adicionar remetente..." }), _jsx("span", { className: "material-symbols-outlined text-sm", children: senderDropdownOpen ? "expand_less" : "expand_more" })] }), senderDropdownOpen && (_jsx("div", { className: "absolute z-20 mt-1 w-full bg-surface-container-high border border-outline-variant rounded-lg shadow-xl max-h-48 overflow-y-auto", children: connectedSenders.length === 0 ? (_jsx("p", { className: "px-4 py-3 text-xs text-secondary", children: "Nenhum remetente conectado" })) : (connectedSenders.filter((s) => !selectedSenders.find((ss) => ss.id === s.id)).map((sender) => (_jsxs("button", { onClick: () => addSender(sender), className: "w-full text-left px-4 py-2.5 hover:bg-surface-bright transition-colors flex items-center gap-3", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-tertiary" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: sender.name }), _jsxs("p", { className: "text-[10px] text-secondary font-mono", children: ["+", sender.phone] })] })] }, sender.id)))) }))] })] }), _jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Mensagens" }), messageBlocks.map((block, idx) => (_jsxs("div", { className: "bg-background border border-outline-variant rounded-lg p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-sm text-primary", children: block.type === "text" ? "chat" : block.type === "audio" ? "mic" : block.type === "image" ? "image" : "description" }), _jsx("span", { className: "text-xs font-bold uppercase text-secondary", children: block.type === "text" ? "Texto" : block.type === "audio" ? "Áudio" : block.type === "image" ? "Imagem" : "Documento" })] }), _jsxs("div", { className: "flex items-center gap-1", children: [idx > 0 && (_jsx("button", { onClick: () => moveBlock(block.id, -1), className: "p-1 text-secondary hover:text-on-surface", children: _jsx("span", { className: "material-symbols-outlined text-sm", children: "arrow_upward" }) })), idx < messageBlocks.length - 1 && (_jsx("button", { onClick: () => moveBlock(block.id, 1), className: "p-1 text-secondary hover:text-on-surface", children: _jsx("span", { className: "material-symbols-outlined text-sm", children: "arrow_downward" }) })), _jsx("button", { onClick: () => removeBlock(block.id), className: "p-1 text-secondary hover:text-error", children: _jsx("span", { className: "material-symbols-outlined text-sm", children: "delete" }) })] })] }), block.type === "text" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "relative", children: [_jsx("textarea", { ref: (el) => { textareaRefs.current[block.id] = el; }, value: block.content, onChange: (e) => updateBlock(block.id, { content: e.target.value }), placeholder: "Digite sua mensagem... Use *negrito*, _it\u00E1lico_, ~tachado~, ```mono```", rows: 4, className: "w-full bg-surface-container border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface resize-none" }), _jsxs("div", { className: "absolute top-2 right-2", children: [_jsxs("button", { onClick: () => setVarDropdownBlockId(varDropdownBlockId === block.id ? null : block.id), className: "px-2 py-1 bg-surface-container-highest border border-outline-variant rounded text-[10px] font-bold text-primary hover:bg-primary/10 transition-colors", children: ["{x}", " Vari\u00E1veis"] }), varDropdownBlockId === block.id && (_jsx("div", { className: "absolute right-0 mt-1 w-48 bg-surface-container-high border border-outline-variant rounded-lg shadow-xl z-10", children: VARIABLES.map((v) => (_jsxs("button", { onClick: () => insertVariable(block.id, v.value), className: "w-full text-left px-3 py-2 text-xs hover:bg-surface-bright transition-colors", children: [_jsx("span", { className: "font-mono text-primary", children: v.value }), _jsxs("span", { className: "text-secondary ml-2", children: ["\u2014 ", v.label] })] }, v.value))) }))] })] }), _jsxs("div", { className: "flex flex-wrap gap-3 text-[10px] text-secondary", children: [_jsx("span", { children: _jsx("b", { children: "*negrito*" }) }), _jsx("span", { children: _jsx("i", { children: "_it\u00E1lico_" }) }), _jsx("span", { children: _jsx("s", { children: "~tachado~" }) }), _jsx("span", { children: _jsx("code", { children: "```mono```" }) })] })] })), block.type === "audio" && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex gap-2", children: [_jsxs("label", { className: "flex-1 cursor-pointer", children: [_jsx("input", { type: "file", accept: ".ogg,audio/ogg", className: "hidden", onChange: (e) => handleAudioUpload(block.id, e) }), _jsxs("div", { className: "bg-surface-container border border-outline-variant rounded px-4 py-2.5 text-sm text-secondary hover:border-primary/50 transition-colors flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "upload_file" }), "Enviar .ogg"] })] }), recordingBlockId === block.id ? (_jsxs("button", { onClick: stopRecording, className: "px-4 py-2.5 bg-error text-white rounded font-medium text-sm flex items-center gap-2 animate-pulse", children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "stop" }), "Parar"] })) : (_jsxs("button", { onClick: () => startRecording(block.id), className: "px-4 py-2.5 bg-surface-container border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-lg text-error", children: "mic" }), "Gravar"] }))] }), block.audioUrl && (_jsx("audio", { controls: true, src: block.audioUrl, className: "w-full h-10" }))] })), block.type === "image" && (_jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "cursor-pointer block", children: [_jsx("input", { type: "file", accept: "image/jpeg,image/png", className: "hidden", onChange: (e) => handleFileChange(block.id, e) }), block.file ? (_jsx("img", { src: URL.createObjectURL(block.file), alt: "", className: "max-h-40 rounded-lg border border-outline-variant" })) : block.existingUrl ? (_jsxs("div", { className: "relative", children: [_jsx("img", { src: block.existingUrl, alt: "", className: "max-h-40 rounded-lg border border-outline-variant" }), _jsx("div", { className: "absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity", children: _jsx("span", { className: "text-xs text-white font-medium", children: "Clique para trocar" }) })] })) : (_jsxs("div", { className: "bg-surface-container border-2 border-dashed border-outline-variant rounded-lg p-6 text-center hover:border-primary/50 transition-colors", children: [_jsx("span", { className: "material-symbols-outlined text-3xl text-secondary mb-2", children: "add_photo_alternate" }), _jsx("p", { className: "text-xs text-secondary", children: "Clique para selecionar imagem (JPG, PNG)" })] }))] }), _jsx("textarea", { value: block.caption, onChange: (e) => updateBlock(block.id, { caption: e.target.value }), placeholder: "Legenda da imagem...", rows: 2, className: "w-full bg-surface-container border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface resize-none" })] })), block.type === "document" && (_jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "cursor-pointer block", children: [_jsx("input", { type: "file", accept: ".pdf,.docx,.xlsx,.doc,.xls", className: "hidden", onChange: (e) => handleFileChange(block.id, e) }), block.file ? (_jsxs("div", { className: "flex items-center gap-3 bg-surface-container border border-outline-variant rounded-lg px-4 py-3", children: [_jsx("span", { className: "material-symbols-outlined text-primary text-2xl", children: "description" }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-sm font-medium truncate", children: block.file.name }), _jsxs("p", { className: "text-[10px] text-secondary", children: [(block.file.size / 1024).toFixed(0), " KB"] })] }), _jsx("span", { className: "material-symbols-outlined text-tertiary", children: "check_circle" })] })) : block.existingUrl ? (_jsxs("div", { className: "flex items-center gap-3 bg-surface-container border border-outline-variant rounded-lg px-4 py-3 hover:bg-surface-bright/30 transition-colors", children: [_jsx("span", { className: "material-symbols-outlined text-primary text-2xl", children: "description" }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-sm font-medium truncate", children: "Documento anexado" }), _jsx("p", { className: "text-[10px] text-secondary", children: "Clique para trocar" })] }), _jsx("span", { className: "material-symbols-outlined text-tertiary", children: "check_circle" })] })) : (_jsxs("div", { className: "bg-surface-container border-2 border-dashed border-outline-variant rounded-lg p-6 text-center hover:border-primary/50 transition-colors", children: [_jsx("span", { className: "material-symbols-outlined text-3xl text-secondary mb-2", children: "upload_file" }), _jsx("p", { className: "text-xs text-secondary", children: "Clique para selecionar documento (PDF, DOCX, XLSX)" })] }))] }), _jsx("textarea", { value: block.caption, onChange: (e) => updateBlock(block.id, { caption: e.target.value }), placeholder: "Legenda do documento...", rows: 2, className: "w-full bg-surface-container border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface resize-none" })] }))] }, block.id))), _jsxs("div", { className: "relative", children: [_jsxs("button", { onClick: () => setAddTypeOpen((p) => !p), className: "w-full bg-background border border-dashed border-outline-variant rounded-lg px-4 py-3 text-sm text-secondary hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "add" }), "Adicionar Mensagem"] }), addTypeOpen && (_jsx("div", { className: "absolute z-20 mt-1 w-full bg-surface-container-high border border-outline-variant rounded-lg shadow-xl grid grid-cols-2 gap-1 p-2", children: [["text", "chat", "Texto"], ["audio", "mic", "Áudio"], ["image", "image", "Imagem"], ["document", "description", "Documento"]].map(([type, icon, label]) => (_jsxs("button", { onClick: () => addMessageBlock(type), className: "flex items-center gap-2 px-3 py-2.5 rounded hover:bg-surface-bright transition-colors text-left", children: [_jsx("span", { className: "material-symbols-outlined text-primary text-lg", children: icon }), _jsx("span", { className: "text-sm font-medium", children: label })] }, type))) }))] })] }), _jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-6 space-y-3", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Grupo de Envio" }), _jsxs("select", { value: selectedGroupId, onChange: (e) => setSelectedGroupId(e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface", children: [_jsx("option", { value: "", children: "Selecione um grupo..." }), (lists ?? []).map((list) => (_jsxs("option", { value: list.id, children: [list.name, " (", list.contact_count, " contatos)"] }, list.id)))] }), selectedGroup && (_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 bg-tertiary/10 border border-tertiary/20 rounded-lg", children: [_jsx("span", { className: "material-symbols-outlined text-tertiary text-lg", children: "group" }), _jsxs("span", { className: "text-sm text-tertiary font-medium", children: [selectedGroup.contact_count, " contatos no grupo \"", selectedGroup.name, "\""] })] }))] }), _jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Configura\u00E7\u00F5es" }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-xs text-secondary", children: "Delay entre mensagens (seg)" }), _jsx("input", { type: "number", min: 15, value: delayMessages, onChange: (e) => setDelayMessages(Math.max(15, Number(e.target.value))), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-xs text-secondary", children: "Delay entre contatos (seg)" }), _jsx("input", { type: "number", min: 15, value: delayContacts, onChange: (e) => setDelayContacts(Math.max(15, Number(e.target.value))), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface" })] })] }), _jsxs("label", { className: "flex items-center gap-3 cursor-pointer", children: [_jsx("button", { type: "button", role: "switch", "aria-checked": useSpintax, onClick: () => setUseSpintax((p) => !p), className: `relative w-10 h-5 rounded-full transition-colors ${useSpintax ? "bg-primary" : "bg-outline-variant"}`, children: _jsx("span", { className: `absolute top-0.5 left-0.5 w-4 h-4 bg-on-surface rounded-full transition-transform ${useSpintax ? "translate-x-5" : ""}` }) }), _jsx("span", { className: "text-sm text-on-surface", children: "Usar Spintax" })] })] }), _jsxs("button", { onClick: handleSave, disabled: createMutation.isPending, className: "w-full px-6 py-3.5 bg-primary text-on-primary rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20", children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "save" }), createMutation.isPending ? "Salvando..." : "Salvar Campanha"] })] }), _jsx("div", { className: "xl:w-[380px] flex-shrink-0", children: _jsxs("div", { className: "sticky top-6", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary mb-3 block", children: "Pr\u00E9-visualiza\u00E7\u00E3o" }), _jsxs("div", { className: "bg-[#0a0a0a] rounded-[2.5rem] p-3 shadow-2xl border border-outline-variant/50 mx-auto max-w-[340px]", children: [_jsx("div", { className: "bg-[#0a0a0a] rounded-t-[2rem] relative", children: _jsx("div", { className: "absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-[#0a0a0a] rounded-b-2xl z-10" }) }), _jsxs("div", { className: "bg-[#0b141a] rounded-[2rem] overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-6 pt-3 pb-1 text-[10px] text-white/70", children: [_jsx("span", { children: "09:41" }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-[12px]", children: "signal_cellular_alt" }), _jsx("span", { className: "material-symbols-outlined text-[12px]", children: "wifi" }), _jsx("span", { className: "material-symbols-outlined text-[12px]", children: "battery_full" })] })] }), _jsxs("div", { className: "bg-[#1f2c34] px-3 py-2 flex items-center gap-3", children: [_jsx("span", { className: "material-symbols-outlined text-white/70 text-lg", children: "arrow_back" }), _jsx("div", { className: "w-8 h-8 rounded-full bg-[#2a3942] flex items-center justify-center", children: _jsx("span", { className: "material-symbols-outlined text-white/50 text-sm", children: "person" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-white text-sm font-medium truncate", children: title || "Campanha" }), _jsx("p", { className: "text-[10px] text-white/50", children: "online" })] }), _jsx("span", { className: "material-symbols-outlined text-white/70 text-lg", children: "videocam" }), _jsx("span", { className: "material-symbols-outlined text-white/70 text-lg", children: "call" })] }), _jsxs("div", { className: "h-[460px] overflow-y-auto px-3 py-3 space-y-2", style: { backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`, backgroundColor: "#0b141a" }, children: [messageBlocks.length === 0 ? (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsxs("div", { className: "text-center text-white/20 text-xs", children: [_jsx("span", { className: "material-symbols-outlined text-4xl mb-2 block", children: "chat_bubble_outline" }), "As mensagens aparecer\u00E3o aqui"] }) })) : (messageBlocks.map((block) => (_jsx("div", { className: "flex justify-end", children: _jsxs("div", { className: "max-w-[85%] bg-[#005c4b] rounded-lg rounded-tr-none px-3 py-1.5 shadow-sm relative", children: [_jsx("div", { className: "absolute -right-2 top-0 w-0 h-0", style: { borderLeft: "8px solid #005c4b", borderBottom: "8px solid transparent" } }), block.type === "text" && block.content && (_jsx("p", { className: "text-[13px] text-white leading-[1.4] break-words whitespace-pre-wrap", dangerouslySetInnerHTML: { __html: formatWhatsApp(replaceVariables(block.content)) } })), block.type === "text" && !block.content && (_jsx("p", { className: "text-[13px] text-white/40 italic", children: "Mensagem vazia..." })), block.type === "image" && (_jsxs("div", { className: "space-y-1", children: [block.file ? (_jsx("img", { src: URL.createObjectURL(block.file), alt: "", className: "rounded-md max-h-36 w-full object-cover" })) : block.existingUrl ? (_jsx("img", { src: block.existingUrl, alt: "", className: "rounded-md max-h-36 w-full object-cover" })) : (_jsx("div", { className: "w-full h-28 bg-[#0a2e26] rounded-md flex items-center justify-center", children: _jsx("span", { className: "material-symbols-outlined text-white/20 text-3xl", children: "image" }) })), block.caption && (_jsx("p", { className: "text-[13px] text-white leading-[1.4] break-words", dangerouslySetInnerHTML: { __html: formatWhatsApp(replaceVariables(block.caption)) } }))] })), block.type === "audio" && (_jsxs("div", { className: "flex items-center gap-2 py-1 min-w-[180px]", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center flex-shrink-0", children: _jsx("span", { className: "material-symbols-outlined text-white text-sm", children: "play_arrow" }) }), _jsxs("div", { className: "flex-1 space-y-1", children: [_jsx("div", { className: "flex items-center gap-[2px]", children: Array.from({ length: 28 }).map((_, i) => (_jsx("div", { className: "w-[3px] bg-white/40 rounded-full", style: { height: `${4 + Math.sin(i * 0.8) * 6 + Math.random() * 5}px` } }, i))) }), _jsx("p", { className: "text-[10px] text-white/50", children: "0:00" })] }), _jsx("div", { className: "w-7 h-7 rounded-full bg-[#2a3942] flex items-center justify-center flex-shrink-0", children: _jsx("span", { className: "material-symbols-outlined text-white/50 text-[10px]", children: "person" }) })] })), block.type === "document" && (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center gap-3 bg-[#0a2e26] rounded-md px-3 py-3", children: [_jsx("span", { className: "material-symbols-outlined text-[#8696a0] text-2xl", children: "description" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm text-white truncate", children: block.file?.name ?? "documento.pdf" }), _jsx("p", { className: "text-[10px] text-white/40", children: block.file ? `${(block.file.size / 1024).toFixed(0)} KB` : "PDF" })] }), _jsx("span", { className: "material-symbols-outlined text-[#8696a0] text-lg", children: "download" })] }), block.caption && (_jsx("p", { className: "text-[13px] text-white leading-[1.4] break-words", dangerouslySetInnerHTML: { __html: formatWhatsApp(replaceVariables(block.caption)) } }))] })), _jsxs("div", { className: "flex items-center justify-end gap-1 mt-0.5", children: [_jsx("span", { className: "text-[10px] text-white/40", children: currentTime() }), _jsx("span", { className: "material-symbols-outlined text-[#53bdeb] text-[13px]", children: "done_all" })] })] }) }, block.id)))), _jsx("div", { ref: previewEndRef })] }), _jsxs("div", { className: "bg-[#1f2c34] px-3 py-2 flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-white/50 text-xl", children: "mood" }), _jsx("div", { className: "flex-1 bg-[#2a3942] rounded-full px-4 py-1.5 text-[13px] text-white/30", children: "Mensagem" }), _jsx("div", { className: "w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center", children: _jsx("span", { className: "material-symbols-outlined text-white text-lg", children: "mic" }) })] }), _jsx("div", { className: "flex justify-center py-2", children: _jsx("div", { className: "w-28 h-1 bg-white/20 rounded-full" }) })] })] })] }) })] })] }));
}
//# sourceMappingURL=Campaigns.js.map