import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
const statusConfig = {
    connected: { class: "text-tertiary bg-tertiary/10 border-tertiary/20", label: "Conectado", icon: "check_circle" },
    connecting: { class: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", label: "Conectando...", icon: "sync" },
    disconnected: { class: "text-secondary bg-secondary-container border-outline", label: "Desconectado", icon: "cancel" },
    banned: { class: "text-on-error-container bg-error-container border-error/20", label: "Banido", icon: "block" },
};
/* ── Component ── */
export default function Senders() {
    const queryClient = useQueryClient();
    // State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [connectingSenderId, setConnectingSenderId] = useState(null);
    const [pairCode, setPairCode] = useState(null);
    const [phoneInput, setPhoneInput] = useState("");
    const [newName, setNewName] = useState("");
    const [pollingId, setPollingId] = useState(null);
    // Queries
    const { data: senders = [], isLoading } = useQuery({
        queryKey: ["senders"],
        queryFn: () => api.get("/senders"),
        refetchInterval: pollingId ? 3000 : 15000,
    });
    // Polling: check status on the connecting instance every 3s
    useEffect(() => {
        if (!pollingId)
            return;
        const interval = setInterval(async () => {
            try {
                const result = await api.post(`/senders/${pollingId}/check-status`);
                queryClient.invalidateQueries({ queryKey: ["senders"] });
                if (result.status === "connected") {
                    clearInterval(interval);
                    setPollingId(null);
                    setConnectingSenderId(null);
                    setPairCode(null);
                    setPhoneInput("");
                    toast.success("WhatsApp conectado!");
                }
            }
            catch {
                // ignora erros de polling
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [pollingId, queryClient]);
    // Create instance
    const createMutation = useMutation({
        mutationFn: (name) => api.post("/senders/create-instance", { name }),
        onSuccess: (data) => {
            toast.success("Instância criada!");
            queryClient.invalidateQueries({ queryKey: ["senders"] });
            setShowCreateModal(false);
            setNewName("");
            // Open connect dialog automatically
            setConnectingSenderId(data.id);
        },
        onError: (err) => toast.error(err.message),
    });
    // Connect (pair code)
    const connectMutation = useMutation({
        mutationFn: ({ id, phone }) => api.post(`/senders/${id}/connect`, { phone }),
        onSuccess: (data) => {
            setPairCode(data.pairCode);
            if (connectingSenderId)
                setPollingId(connectingSenderId);
        },
        onError: (err) => toast.error(err.message),
    });
    // Disconnect
    const disconnectMutation = useMutation({
        mutationFn: (id) => api.post(`/senders/${id}/disconnect`),
        onSuccess: () => {
            toast.success("WhatsApp desconectado");
            queryClient.invalidateQueries({ queryKey: ["senders"] });
        },
        onError: (err) => toast.error(err.message),
    });
    // Delete
    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/senders/${id}`),
        onSuccess: () => {
            toast.success("Remetente excluído");
            queryClient.invalidateQueries({ queryKey: ["senders"] });
        },
        onError: (err) => toast.error(err.message),
    });
    // Manual check status
    const checkMutation = useMutation({
        mutationFn: (id) => api.post(`/senders/${id}/check-status`),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["senders"] });
            toast.success(`Status: ${statusConfig[data.status]?.label ?? data.status}`);
        },
        onError: (err) => toast.error(err.message),
    });
    function formatPairCode(code) {
        if (code.length === 8)
            return `${code.slice(0, 4)}-${code.slice(4)}`;
        return code;
    }
    const connectingSender = senders.find((s) => s.id === connectingSenderId);
    /* ── Render ── */
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold tracking-tight", children: "Remetentes" }), _jsx("p", { className: "text-secondary mt-1", children: "Conecte n\u00FAmeros WhatsApp via Uazapi para envio de campanhas." })] }), _jsxs("button", { onClick: () => setShowCreateModal(true), className: "px-4 py-2 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "add" }), "Nova Inst\u00E2ncia"] })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4", children: isLoading ? (_jsx("p", { className: "text-secondary col-span-full text-center py-12", children: "Carregando..." })) : senders.length === 0 ? (_jsxs("div", { className: "col-span-full bg-surface-container border border-outline-variant rounded-xl p-12 text-center", children: [_jsx("span", { className: "material-symbols-outlined text-4xl text-secondary mb-3 block", children: "phone_android" }), _jsx("p", { className: "text-secondary", children: "Nenhum remetente cadastrado" }), _jsx("p", { className: "text-xs text-secondary mt-1", children: "Clique em \"Nova Inst\u00E2ncia\" para conectar um n\u00FAmero WhatsApp." })] })) : (senders.map((sender) => {
                    const badge = statusConfig[sender.status] ?? statusConfig.disconnected;
                    const isConnected = sender.status === "connected";
                    const isConnecting = sender.status === "connecting";
                    return (_jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl overflow-hidden", children: [_jsxs("div", { className: "p-5 space-y-4", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `w-10 h-10 rounded-full flex items-center justify-center ${isConnected ? "bg-tertiary/20" : "bg-surface-container-highest"}`, children: _jsx("span", { className: `material-symbols-outlined ${isConnected ? "text-tertiary" : "text-secondary"}`, children: "phone_android" }) }), _jsxs("div", { children: [_jsx("p", { className: "font-bold text-sm", children: sender.name }), sender.phone && (_jsxs("p", { className: "text-[11px] text-secondary font-mono", children: ["+", sender.phone] }))] })] }), _jsxs("span", { className: `text-[9px] font-bold px-2 py-1 rounded-full border flex items-center gap-1 ${badge.class}`, children: [_jsx("span", { className: `material-symbols-outlined text-[12px] ${isConnecting ? "animate-spin" : ""}`, children: badge.icon }), badge.label] })] }), isConnected && (_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 bg-tertiary/5 border border-tertiary/10 rounded-lg", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-tertiary animate-pulse" }), _jsx("span", { className: "text-[11px] text-tertiary font-medium", children: "WhatsApp ativo" }), sender.last_seen_at && (_jsx("span", { className: "text-[10px] text-secondary ml-auto", children: new Date(sender.last_seen_at).toLocaleString("pt-BR") }))] })), isConnecting && (_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 bg-yellow-500/5 border border-yellow-500/10 rounded-lg", children: [_jsx("span", { className: "material-symbols-outlined text-yellow-400 text-sm animate-spin", children: "sync" }), _jsx("span", { className: "text-[11px] text-yellow-400 font-medium", children: "Aguardando pareamento..." })] }))] }), _jsxs("div", { className: "px-5 pb-4 flex flex-wrap gap-2", children: [!isConnected && (_jsxs("button", { onClick: () => {
                                            setConnectingSenderId(sender.id);
                                            setPairCode(sender.settings?.pin_code ?? null);
                                            setPhoneInput(sender.phone || "");
                                        }, className: "flex-1 px-3 py-2 text-xs font-medium bg-primary/10 border border-primary/20 text-primary rounded hover:bg-primary/20 transition-all flex items-center justify-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-sm", children: "link" }), "Conectar"] })), _jsxs("button", { onClick: () => checkMutation.mutate(sender.id), disabled: checkMutation.isPending, className: "px-3 py-2 text-xs font-medium bg-surface-container-high border border-outline-variant text-on-surface rounded hover:bg-surface-bright transition-all flex items-center gap-1 disabled:opacity-50", children: [_jsx("span", { className: `material-symbols-outlined text-sm ${checkMutation.isPending ? "animate-spin" : ""}`, children: "sync" }), "Verificar"] }), isConnected && (_jsxs("button", { onClick: () => { if (confirm("Desconectar este WhatsApp?"))
                                            disconnectMutation.mutate(sender.id); }, className: "px-3 py-2 text-xs font-medium bg-surface-container-high border border-outline-variant text-secondary rounded hover:bg-surface-bright hover:text-yellow-400 transition-all flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-sm", children: "link_off" }), "Desconectar"] })), _jsx("button", { onClick: () => { if (confirm(`Excluir "${sender.name}"? Esta ação é irreversível.`))
                                            deleteMutation.mutate(sender.id); }, className: "px-3 py-2 text-xs font-medium bg-surface-container-high border border-outline-variant text-secondary rounded hover:bg-error/10 hover:text-error hover:border-error/20 transition-all flex items-center gap-1", children: _jsx("span", { className: "material-symbols-outlined text-sm", children: "delete" }) })] })] }, sender.id));
                })) }), showCreateModal && (_jsxs("div", { className: "fixed inset-0 z-[60] flex items-center justify-center", children: [_jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-sm", onClick: () => setShowCreateModal(false) }), _jsxs("div", { className: "relative bg-surface-container border border-outline-variant rounded-xl w-full max-w-md mx-4 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b border-outline-variant", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 bg-primary/10 rounded-lg", children: _jsx("span", { className: "material-symbols-outlined text-primary", children: "add_circle" }) }), _jsx("h3", { className: "font-bold text-lg", children: "Nova Inst\u00E2ncia WhatsApp" })] }), _jsx("button", { onClick: () => setShowCreateModal(false), className: "p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-on-surface", children: _jsx("span", { className: "material-symbols-outlined", children: "close" }) })] }), _jsxs("form", { onSubmit: (e) => { e.preventDefault(); if (newName.trim())
                                    createMutation.mutate(newName.trim()); }, className: "p-6 space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Nome da Inst\u00E2ncia" }), _jsx("input", { value: newName, onChange: (e) => setNewName(e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface", placeholder: "Ex: Comercial 1, Marketing, Suporte", autoFocus: true, required: true }), _jsx("p", { className: "text-[10px] text-secondary", children: "Este nome identifica o n\u00FAmero na plataforma." })] }), _jsxs("div", { className: "flex justify-end gap-3", children: [_jsx("button", { type: "button", onClick: () => setShowCreateModal(false), className: "px-4 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all", children: "Cancelar" }), _jsxs("button", { type: "submit", disabled: createMutation.isPending, className: "px-6 py-2.5 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "add" }), createMutation.isPending ? "Criando..." : "Criar Instância"] })] })] })] })] })), connectingSenderId && (_jsxs("div", { className: "fixed inset-0 z-[60] flex items-center justify-center", children: [_jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-sm", onClick: () => {
                            setConnectingSenderId(null);
                            setPairCode(null);
                            setPhoneInput("");
                            setPollingId(null);
                        } }), _jsxs("div", { className: "relative bg-surface-container border border-outline-variant rounded-xl w-full max-w-md mx-4 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b border-outline-variant", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 bg-tertiary/10 rounded-lg", children: _jsx("span", { className: "material-symbols-outlined text-tertiary", children: "smartphone" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-lg", children: "Conectar WhatsApp" }), connectingSender && (_jsx("p", { className: "text-[11px] text-secondary", children: connectingSender.name }))] })] }), _jsx("button", { onClick: () => {
                                            setConnectingSenderId(null);
                                            setPairCode(null);
                                            setPhoneInput("");
                                            setPollingId(null);
                                        }, className: "p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-on-surface", children: _jsx("span", { className: "material-symbols-outlined", children: "close" }) })] }), _jsx("div", { className: "p-6 space-y-5", children: !pairCode ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "N\u00FAmero de telefone (com DDI)" }), _jsxs("div", { className: "relative", children: [_jsx("span", { className: "absolute left-4 top-1/2 -translate-y-1/2 text-secondary text-sm font-mono", children: "+" }), _jsx("input", { value: phoneInput, onChange: (e) => setPhoneInput(e.target.value.replace(/\D/g, "")), className: "w-full bg-background border border-outline-variant rounded pl-8 pr-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none font-mono text-on-surface text-lg tracking-wider", placeholder: "5531999999999", autoFocus: true })] }), _jsx("p", { className: "text-[10px] text-secondary", children: "Formato: DDI + DDD + n\u00FAmero, sem espa\u00E7os. Ex: 5531999999999" })] }), _jsx("button", { onClick: () => {
                                                if (phoneInput.length < 10)
                                                    return toast.error("Número inválido");
                                                connectMutation.mutate({ id: connectingSenderId, phone: phoneInput });
                                            }, disabled: connectMutation.isPending, className: "w-full px-6 py-3 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2", children: connectMutation.isPending ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "material-symbols-outlined animate-spin text-lg", children: "progress_activity" }), "Gerando c\u00F3digo..."] })) : (_jsxs(_Fragment, { children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "qr_code_2" }), "Gerar C\u00F3digo de Pareamento"] })) })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "text-center space-y-4", children: [_jsxs("div", { className: "p-4 bg-primary/5 border border-primary/20 rounded-xl", children: [_jsx("p", { className: "text-xs text-secondary uppercase tracking-widest mb-3", children: "C\u00F3digo de Pareamento" }), _jsx("p", { className: "text-4xl font-black font-mono tracking-[.3em] text-primary", children: formatPairCode(pairCode) })] }), _jsxs("div", { className: "bg-surface-container-high/50 border border-outline-variant rounded-xl p-4 text-left space-y-3", children: [_jsxs("p", { className: "text-xs font-bold text-on-surface flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-primary text-lg", children: "info" }), "Como conectar:"] }), _jsxs("ol", { className: "text-xs text-secondary space-y-2 pl-6 list-decimal", children: [_jsxs("li", { children: ["Abra o ", _jsx("span", { className: "font-bold text-on-surface", children: "WhatsApp" }), " no celular"] }), _jsxs("li", { children: ["V\u00E1 em ", _jsx("span", { className: "font-bold text-on-surface", children: "Configura\u00E7\u00F5es \u2192 Aparelhos Vinculados" })] }), _jsxs("li", { children: ["Toque em ", _jsx("span", { className: "font-bold text-on-surface", children: "\"Vincular um Aparelho\"" })] }), _jsxs("li", { children: ["Selecione ", _jsx("span", { className: "font-bold text-on-surface", children: "\"Vincular com n\u00FAmero de telefone\"" })] }), _jsxs("li", { children: ["Digite o c\u00F3digo: ", _jsx("span", { className: "font-mono font-bold text-primary", children: formatPairCode(pairCode) })] })] })] }), pollingId && (_jsxs("div", { className: "flex items-center justify-center gap-2 text-yellow-400", children: [_jsx("span", { className: "material-symbols-outlined animate-spin text-lg", children: "sync" }), _jsx("span", { className: "text-xs font-medium", children: "Aguardando conex\u00E3o..." })] }))] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: () => {
                                                        setPairCode(null);
                                                        setPollingId(null);
                                                    }, className: "flex-1 px-4 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all", children: "Gerar Novo C\u00F3digo" }), _jsx("button", { onClick: () => {
                                                        setConnectingSenderId(null);
                                                        setPairCode(null);
                                                        setPhoneInput("");
                                                        setPollingId(null);
                                                    }, className: "flex-1 px-4 py-2.5 bg-surface-container-high border border-outline-variant text-secondary rounded font-medium text-sm hover:bg-surface-bright transition-all", children: "Fechar" })] })] })) })] })] }))] }));
}
//# sourceMappingURL=Senders.js.map