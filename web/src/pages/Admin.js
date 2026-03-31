import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
const ADMIN_EMAIL = "suicideshake@gmail.com";
const senderStatusColors = {
    connected: "text-tertiary bg-tertiary/10",
    connecting: "text-yellow-400 bg-yellow-500/10",
    disconnected: "text-secondary bg-secondary-container",
};
export default function Admin() {
    const { user, loading } = useAuth();
    const queryClient = useQueryClient();
    // Wait for auth to load
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center py-20", children: _jsx("div", { className: "animate-pulse text-primary text-lg", children: "Carregando..." }) }));
    }
    // Gate: only admin
    if (user?.email !== ADMIN_EMAIL) {
        return _jsx(Navigate, { to: "/", replace: true });
    }
    return _jsx(AdminContent, { queryClient: queryClient });
}
function AdminContent({ queryClient }) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [expandedClient, setExpandedClient] = useState(null);
    const { data: dashboard } = useQuery({
        queryKey: ["admin-dashboard"],
        queryFn: () => api.get("/admin/dashboard"),
        refetchInterval: 30000,
    });
    const { data: clients, isLoading } = useQuery({
        queryKey: ["admin-clients"],
        queryFn: () => api.get("/admin/clients"),
        refetchInterval: 30000,
    });
    const stats = [
        { label: "Clientes", value: dashboard?.totalTenants ?? 0, icon: "groups", color: "text-primary" },
        { label: "Contatos", value: dashboard?.totalContacts ?? 0, icon: "contacts", color: "text-tertiary" },
        { label: "Campanhas", value: dashboard?.totalCampaigns ?? 0, icon: "campaign", color: "text-yellow-400" },
        { label: "Enviadas", value: dashboard?.totalSent ?? 0, icon: "check_circle", color: "text-tertiary" },
        { label: "Falhas", value: dashboard?.totalFailed ?? 0, icon: "error", color: "text-error" },
        { label: "Instâncias", value: `${dashboard?.connectedSenders ?? 0}/${dashboard?.totalSenders ?? 0}`, icon: "phone_android", color: "text-primary" },
    ];
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-primary text-2xl", children: "admin_panel_settings" }), _jsx("h2", { className: "text-2xl font-bold tracking-tight", children: "Painel Admin" })] }), _jsx("p", { className: "text-secondary mt-1", children: "Gerenciamento de clientes e vis\u00E3o geral do sistema." })] }), _jsxs("button", { onClick: () => setShowCreateModal(true), className: "px-4 py-2 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "person_add" }), "Cadastrar Cliente"] })] }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3", children: stats.map((s) => (_jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-4 text-center", children: [_jsx("span", { className: `material-symbols-outlined text-2xl ${s.color}`, children: s.icon }), _jsx("p", { className: "text-xl font-black mt-1", children: s.value }), _jsx("p", { className: "text-[10px] text-secondary uppercase tracking-wider font-semibold", children: s.label })] }, s.label))) }), _jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "font-bold text-lg", children: "Clientes Cadastrados" }), isLoading ? (_jsx("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-12 text-center text-secondary", children: "Carregando..." })) : !clients?.length ? (_jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-12 text-center", children: [_jsx("span", { className: "material-symbols-outlined text-4xl text-secondary mb-3 block", children: "groups" }), _jsx("p", { className: "text-secondary", children: "Nenhum cliente cadastrado" })] })) : (clients.map((client) => {
                        const isExpanded = expandedClient === client.id;
                        const connectedCount = client.senders.filter((s) => s.status === "connected").length;
                        return (_jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-surface-bright/30 transition-colors", onClick: () => setExpandedClient(isExpanded ? null : client.id), children: [_jsx("div", { className: "w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0", children: _jsx("span", { className: "material-symbols-outlined text-primary", children: "business" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("p", { className: "text-sm font-bold truncate", children: client.name }), _jsx("span", { className: "text-[9px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20", children: client.plan })] }), _jsxs("div", { className: "flex items-center gap-4 mt-1 text-[11px] text-secondary", children: [_jsx("span", { children: client.users[0]?.email ?? "—" }), _jsxs("span", { children: ["Desde ", new Date(client.created_at).toLocaleDateString("pt-BR")] })] })] }), _jsxs("div", { className: "hidden md:flex items-center gap-5 text-xs text-secondary", children: [_jsxs("div", { className: "text-center", children: [_jsx("p", { className: "font-black text-on-surface", children: client.contactCount }), _jsx("p", { className: "text-[9px]", children: "Contatos" })] }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "font-black text-on-surface", children: client.campaignCount }), _jsx("p", { className: "text-[9px]", children: "Campanhas" })] }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "font-black text-tertiary", children: client.totalSent }), _jsx("p", { className: "text-[9px]", children: "Enviadas" })] }), _jsxs("div", { className: "text-center", children: [_jsxs("p", { className: `font-black ${connectedCount > 0 ? "text-tertiary" : "text-secondary"}`, children: [connectedCount, "/", client.senders.length] }), _jsx("p", { className: "text-[9px]", children: "Inst\u00E2ncias" })] })] }), _jsx("span", { className: `material-symbols-outlined text-secondary transition-transform ${isExpanded ? "rotate-180" : ""}`, children: "expand_more" })] }), isExpanded && (_jsxs("div", { className: "border-t border-outline-variant px-5 py-4 space-y-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-bold text-secondary uppercase tracking-wider mb-2", children: "Usu\u00E1rios" }), _jsx("div", { className: "flex flex-wrap gap-2", children: client.users.map((u) => (_jsxs("div", { className: "flex items-center gap-2 bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2", children: [_jsx("span", { className: "material-symbols-outlined text-sm text-primary", children: "person" }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium", children: u.name }), _jsxs("p", { className: "text-[10px] text-secondary", children: [u.email, " \u00B7 ", u.role] })] })] }, u.id))) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-bold text-secondary uppercase tracking-wider mb-2", children: "Inst\u00E2ncias WhatsApp" }), client.senders.length === 0 ? (_jsx("p", { className: "text-xs text-secondary", children: "Nenhuma inst\u00E2ncia cadastrada" })) : (_jsx("div", { className: "flex flex-wrap gap-2", children: client.senders.map((s) => (_jsxs("div", { className: "flex items-center gap-2 bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2", children: [_jsx("span", { className: "material-symbols-outlined text-sm text-primary", children: "phone_android" }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium", children: s.name }), _jsx("p", { className: "text-[10px] text-secondary", children: s.phone ? `+${s.phone}` : "Sem número" })] }), _jsx("span", { className: `text-[9px] font-bold px-1.5 py-0.5 rounded ${senderStatusColors[s.status] ?? "text-secondary bg-secondary-container"}`, children: s.status === "connected" ? "ON" : s.status === "connecting" ? "..." : "OFF" })] }, s.id))) }))] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-bold text-secondary uppercase tracking-wider mb-2", children: "Campanhas" }), _jsxs("div", { className: "flex flex-wrap gap-3 text-xs", children: [Object.entries(client.campaignsByStatus).map(([status, count]) => (_jsxs("span", { className: "bg-surface-container-high border border-outline-variant rounded px-2 py-1", children: [_jsxs("span", { className: "text-secondary", children: [status, ":"] }), " ", _jsx("span", { className: "font-bold", children: count })] }, status))), _jsxs("span", { className: "bg-tertiary/10 border border-tertiary/20 text-tertiary rounded px-2 py-1", children: ["Enviadas: ", _jsx("span", { className: "font-bold", children: client.totalSent })] }), client.totalFailed > 0 && (_jsxs("span", { className: "bg-error/10 border border-error/20 text-error rounded px-2 py-1", children: ["Falhas: ", _jsx("span", { className: "font-bold", children: client.totalFailed })] }))] })] })] }))] }, client.id));
                    }))] }), showCreateModal && (_jsx(CreateClientModal, { onClose: () => setShowCreateModal(false), onSuccess: () => {
                    setShowCreateModal(false);
                    queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
                    queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
                } }))] }));
}
/* ═══════════════════════ Create Client Modal ═══════════════════════ */
function CreateClientModal({ onClose, onSuccess }) {
    const [form, setForm] = useState({
        companyName: "",
        name: "",
        email: "",
        password: "",
    });
    function update(field, value) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }
    const createMutation = useMutation({
        mutationFn: (data) => api.post("/auth/register", data),
        onSuccess: () => {
            toast.success("Cliente cadastrado com sucesso!");
            onSuccess();
        },
        onError: (err) => toast.error(err.message),
    });
    function handleSubmit(e) {
        e.preventDefault();
        if (form.password.length < 6)
            return toast.error("Senha deve ter no mínimo 6 caracteres");
        createMutation.mutate(form);
    }
    return (_jsxs("div", { className: "fixed inset-0 z-[60] flex items-center justify-center", children: [_jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-sm", onClick: onClose }), _jsxs("div", { className: "relative bg-surface-container border border-outline-variant rounded-xl w-full max-w-md mx-4 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b border-outline-variant", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 bg-primary/10 rounded-lg", children: _jsx("span", { className: "material-symbols-outlined text-primary", children: "person_add" }) }), _jsx("h3", { className: "font-bold text-lg", children: "Cadastrar Cliente" })] }), _jsx("button", { onClick: onClose, className: "p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-on-surface", children: _jsx("span", { className: "material-symbols-outlined", children: "close" }) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "p-6 space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Nome da Empresa" }), _jsx("input", { value: form.companyName, onChange: (e) => update("companyName", e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface", placeholder: "Empresa do Cliente", required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Nome do Usu\u00E1rio" }), _jsx("input", { value: form.name, onChange: (e) => update("name", e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface", placeholder: "Jo\u00E3o Silva", required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Email" }), _jsx("input", { type: "email", value: form.email, onChange: (e) => update("email", e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface", placeholder: "cliente@email.com", required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Senha" }), _jsx("input", { type: "password", value: form.password, onChange: (e) => update("password", e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface", placeholder: "M\u00EDnimo 6 caracteres", minLength: 6, required: true })] }), _jsxs("div", { className: "flex justify-end gap-3 pt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all", children: "Cancelar" }), _jsxs("button", { type: "submit", disabled: createMutation.isPending, className: "px-6 py-2.5 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2", children: [createMutation.isPending ? (_jsx("span", { className: "material-symbols-outlined text-lg animate-spin", children: "progress_activity" })) : (_jsx("span", { className: "material-symbols-outlined text-lg", children: "person_add" })), createMutation.isPending ? "Criando..." : "Cadastrar"] })] })] })] })] }));
}
//# sourceMappingURL=Admin.js.map