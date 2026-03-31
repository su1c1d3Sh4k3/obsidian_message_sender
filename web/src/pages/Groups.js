import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatPhone, extractDDD } from "@/utils/phone";
import toast from "react-hot-toast";
// ── Mock Data ──────────────────────────────────────────
const MOCK_GROUPS = [
    { id: "g1", name: "Leads BH - Março", description: "Leads qualificados de Belo Horizonte", contact_count: 5, created_at: "2026-03-28T10:00:00Z" },
    { id: "g2", name: "Campanha SP", description: "Base de São Paulo para campanha de abril", contact_count: 3, created_at: "2026-03-25T14:00:00Z" },
    { id: "g3", name: "VIPs Nacional", description: "Clientes VIP de todo o Brasil", contact_count: 4, created_at: "2026-03-20T09:00:00Z" },
    { id: "g4", name: "Recontato - Erros", description: "Contatos que deram erro na última campanha", contact_count: 2, created_at: "2026-03-18T16:00:00Z" },
];
const MOCK_GROUP_CONTACTS = {
    g1: [
        { id: "3", first_name: "Fernando", last_name: "Torres", display_name: "Fernando Torres", phone: "5531999112233", city: "Belo Horizonte", state: "MG", organization: null, is_valid: true, is_blacklisted: false, created_at: "2026-03-30T09:30:00Z", contact_tags: [{ tags: { id: "t4", name: "Follow-up", color: "#71717a" } }] },
        { id: "5", first_name: "Carlos", last_name: "Mendes", display_name: "Carlos Mendes", phone: "5531977665544", city: "Belo Horizonte", state: "MG", organization: "Advocacia Mendes", is_valid: true, is_blacklisted: false, created_at: "2026-03-29T14:00:00Z", contact_tags: [{ tags: { id: "t5", name: "B2B", color: "#34d399" } }] },
        { id: "8", first_name: "Beatriz", last_name: "Almeida", display_name: "Beatriz Almeida", phone: "5531988997766", city: "Contagem", state: "MG", organization: "Studio Bea", is_valid: true, is_blacklisted: false, created_at: "2026-03-28T09:00:00Z", contact_tags: [{ tags: { id: "t3", name: "Qualificado", color: "#34d399" } }] },
        { id: "11", first_name: "Roberto", last_name: "Santos", display_name: "Roberto Santos", phone: "5531944556677", city: "Betim", state: "MG", organization: "RS Imports", is_valid: true, is_blacklisted: false, created_at: "2026-03-27T10:00:00Z", contact_tags: [] },
        { id: "13", first_name: "Luciana", last_name: "Braga", display_name: "Luciana Braga", phone: "5531922334455", city: "Belo Horizonte", state: "MG", organization: "LB Design", is_valid: true, is_blacklisted: false, created_at: "2026-03-26T11:00:00Z", contact_tags: [{ tags: { id: "t1", name: "Lead Quente", color: "#a78bfa" } }] },
    ],
    g2: [
        { id: "1", first_name: "Ricardo", last_name: "Lemos", display_name: "Ricardo Lemos", phone: "5511988776655", city: "São Paulo", state: "SP", organization: "Tech Solutions", is_valid: true, is_blacklisted: false, created_at: "2026-03-30T10:00:00Z", contact_tags: [{ tags: { id: "t1", name: "Lead Quente", color: "#a78bfa" } }] },
        { id: "6", first_name: "Juliana", last_name: "Rocha", display_name: "Juliana Rocha", phone: "5511944332211", city: "São Paulo", state: "SP", organization: null, is_valid: false, is_blacklisted: false, created_at: "2026-03-29T12:00:00Z", contact_tags: [] },
        { id: "12", first_name: "Patrícia", last_name: "Lima", display_name: "Patrícia Lima", phone: "5511933445566", city: "Guarulhos", state: "SP", organization: null, is_valid: true, is_blacklisted: false, created_at: "2026-03-26T14:00:00Z", contact_tags: [{ tags: { id: "t3", name: "Qualificado", color: "#34d399" } }] },
    ],
    g3: [
        { id: "1", first_name: "Ricardo", last_name: "Lemos", display_name: "Ricardo Lemos", phone: "5511988776655", city: "São Paulo", state: "SP", organization: "Tech Solutions", is_valid: true, is_blacklisted: false, created_at: "2026-03-30T10:00:00Z", contact_tags: [{ tags: { id: "t2", name: "VIP", color: "#71717a" } }] },
        { id: "4", first_name: "Ana", last_name: "Costa", display_name: "Ana Costa", phone: "5541988223344", city: "Curitiba", state: "PR", organization: "Construtora ABC", is_valid: true, is_blacklisted: false, created_at: "2026-03-29T15:00:00Z", contact_tags: [{ tags: { id: "t2", name: "VIP", color: "#71717a" } }] },
        { id: "9", first_name: "Lucas", last_name: "Ferreira", display_name: "Lucas Ferreira", phone: "5571999887766", city: "Salvador", state: "BA", organization: null, is_valid: true, is_blacklisted: false, created_at: "2026-03-27T18:00:00Z", contact_tags: [{ tags: { id: "t2", name: "VIP", color: "#71717a" } }] },
        { id: "10", first_name: "Camila", last_name: "Nascimento", display_name: "Camila Nascimento", phone: "5561977665544", city: "Brasília", state: "DF", organization: "Gov Solutions", is_valid: true, is_blacklisted: false, created_at: "2026-03-27T16:00:00Z", contact_tags: [{ tags: { id: "t2", name: "VIP", color: "#71717a" } }] },
    ],
    g4: [
        { id: "3", first_name: "Fernando", last_name: "Torres", display_name: "Fernando Torres", phone: "5531999112233", city: "Belo Horizonte", state: "MG", organization: null, is_valid: true, is_blacklisted: false, created_at: "2026-03-30T09:30:00Z", contact_tags: [] },
        { id: "7", first_name: "Pedro", last_name: "Oliveira", display_name: "Pedro Oliveira", phone: "5521966554433", city: "Niterói", state: "RJ", organization: "PE Consulting", is_valid: true, is_blacklisted: true, created_at: "2026-03-28T10:00:00Z", contact_tags: [] },
    ],
};
const MOCK_CAMPAIGN_STATS = {
    g1: { lastCampaign: "28/03/2026", delivered: 4, failed: 1, total: 5 },
    g2: { lastCampaign: "25/03/2026", delivered: 2, failed: 1, total: 3 },
    g3: { lastCampaign: "22/03/2026", delivered: 4, failed: 0, total: 4 },
    g4: { lastCampaign: "20/03/2026", delivered: 0, failed: 2, total: 2 },
};
const MOCK_LAST_MESSAGES = {
    "1": { date: "30/03/2026 14:32", status: "delivered" },
    "2": { date: "30/03/2026 14:28", status: "read" },
    "3": { date: "29/03/2026 10:15", status: "error" },
    "4": { date: "28/03/2026 16:00", status: "delivered" },
    "5": { date: "28/03/2026 15:45", status: "delivered" },
    "6": { date: null, status: null },
    "7": { date: "27/03/2026 09:00", status: "error" },
    "8": { date: "30/03/2026 11:00", status: "read" },
    "9": { date: "29/03/2026 08:30", status: "delivered" },
    "10": { date: "26/03/2026 17:00", status: "delivered" },
    "11": { date: null, status: null },
    "12": { date: "25/03/2026 10:00", status: "delivered" },
    "13": { date: "28/03/2026 14:00", status: "delivered" },
};
// ── Component ──────────────────────────────────────────
export default function Groups() {
    const queryClient = useQueryClient();
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [search, setSearch] = useState("");
    const [selectedContactIds, setSelectedContactIds] = useState(new Set());
    // Fetch groups from API
    const { data: apiGroups } = useQuery({
        queryKey: ["lists"],
        queryFn: () => api.get("/lists"),
    });
    const groups = apiGroups?.length ? apiGroups : MOCK_GROUPS;
    // Fetch group contacts from API
    const { data: apiGroupContacts } = useQuery({
        queryKey: ["list-contacts", selectedGroupId, page, perPage],
        queryFn: () => {
            if (!selectedGroupId)
                return null;
            return api.get(`/lists/${selectedGroupId}/contacts?page=${page}&limit=${perPage}`);
        },
        enabled: !!selectedGroupId,
    });
    // Use API data or mock
    const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;
    const groupContacts = useMemo(() => {
        if (apiGroupContacts?.data?.length)
            return apiGroupContacts.data;
        if (selectedGroupId && MOCK_GROUP_CONTACTS[selectedGroupId])
            return MOCK_GROUP_CONTACTS[selectedGroupId];
        return [];
    }, [apiGroupContacts, selectedGroupId]);
    const campaignStats = selectedGroupId ? MOCK_CAMPAIGN_STATS[selectedGroupId] : null;
    // Client-side search filter
    const filteredContacts = useMemo(() => {
        if (!search)
            return groupContacts;
        const s = search.toLowerCase();
        return groupContacts.filter((c) => c.display_name.toLowerCase().includes(s) || c.phone.includes(s) || c.organization?.toLowerCase().includes(s));
    }, [groupContacts, search]);
    // Pagination (client-side for mock)
    const paginatedContacts = useMemo(() => {
        if (apiGroupContacts?.data?.length)
            return filteredContacts;
        const start = (page - 1) * perPage;
        return filteredContacts.slice(start, start + perPage);
    }, [filteredContacts, apiGroupContacts, page, perPage]);
    const totalPages = apiGroupContacts?.pagination
        ? Math.ceil(apiGroupContacts.pagination.total / perPage)
        : Math.ceil(filteredContacts.length / perPage);
    // Selection
    const allVisibleSelected = paginatedContacts.length > 0 && paginatedContacts.every((c) => selectedContactIds.has(c.id));
    function toggleSelect(id) {
        setSelectedContactIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }
    function toggleSelectAll() {
        if (allVisibleSelected) {
            setSelectedContactIds((prev) => {
                const next = new Set(prev);
                paginatedContacts.forEach((c) => next.delete(c.id));
                return next;
            });
        }
        else {
            setSelectedContactIds((prev) => {
                const next = new Set(prev);
                paginatedContacts.forEach((c) => next.add(c.id));
                return next;
            });
        }
    }
    // Remove from group
    const removeFromGroup = useMutation({
        mutationFn: (contactIds) => api.post("/contacts/bulk-action", {
            contact_ids: contactIds,
            action: "remove_from_list",
            list_id: selectedGroupId,
        }),
        onSuccess: () => {
            toast.success("Contato(s) removido(s) do grupo");
            setSelectedContactIds(new Set());
            queryClient.invalidateQueries({ queryKey: ["list-contacts", selectedGroupId] });
            queryClient.invalidateQueries({ queryKey: ["lists"] });
        },
        onError: (err) => toast.error(err.message),
    });
    // Delete group
    const deleteGroup = useMutation({
        mutationFn: (id) => api.delete(`/lists/${id}`),
        onSuccess: () => {
            toast.success("Grupo excluído");
            setSelectedGroupId(null);
            queryClient.invalidateQueries({ queryKey: ["lists"] });
        },
        onError: (err) => toast.error(err.message),
    });
    function handleSelectGroup(id) {
        setSelectedGroupId(id);
        setPage(1);
        setSearch("");
        setSelectedContactIds(new Set());
    }
    // ── Render ──────────────────────────────────────────
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold tracking-tight", children: "Grupos" }), _jsx("p", { className: "text-secondary mt-1", children: "Gerencie seus grupos de contatos para campanhas." })] }), _jsxs("div", { className: "flex gap-6", children: [_jsx("aside", { className: "w-64 min-w-[16rem] hidden lg:block", children: _jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl overflow-hidden sticky top-20", children: [_jsxs("div", { className: "px-4 py-3 border-b border-outline-variant flex items-center justify-between", children: [_jsx("h4", { className: "text-xs font-bold uppercase tracking-widest text-secondary", children: "Grupos" }), _jsx("span", { className: "text-[10px] font-mono text-secondary bg-surface-container-highest px-2 py-0.5 rounded-full", children: groups.length })] }), _jsx("div", { className: "max-h-[60vh] overflow-y-auto", children: groups.length === 0 ? (_jsxs("div", { className: "p-6 text-center", children: [_jsx("span", { className: "material-symbols-outlined text-3xl text-secondary mb-2", children: "folder_off" }), _jsx("p", { className: "text-xs text-secondary", children: "Nenhum grupo criado" }), _jsx("p", { className: "text-[10px] text-secondary mt-1", children: "Selecione contatos e clique em \"Criar Grupo\"" })] })) : (groups.map((group) => {
                                        const isActive = selectedGroupId === group.id;
                                        const stats = MOCK_CAMPAIGN_STATS[group.id];
                                        const deliveryPct = stats ? Math.round((stats.delivered / stats.total) * 100) : 0;
                                        return (_jsxs("button", { onClick: () => handleSelectGroup(group.id), className: `w-full text-left px-4 py-3 border-b border-outline-variant transition-all ${isActive
                                                ? "bg-primary/10 border-l-2 border-l-primary"
                                                : "hover:bg-surface-bright/50 border-l-2 border-l-transparent"}`, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: `text-sm font-semibold truncate ${isActive ? "text-primary" : "text-on-surface"}`, children: group.name }), _jsx("span", { className: "text-[10px] font-mono text-secondary ml-2 shrink-0", children: group.contact_count })] }), group.description && (_jsx("p", { className: "text-[10px] text-secondary truncate mt-0.5", children: group.description })), stats && (_jsxs("div", { className: "flex items-center gap-2 mt-2", children: [_jsxs("div", { className: "h-1 flex-1 bg-outline-variant rounded-full overflow-hidden flex", children: [_jsx("div", { className: "h-full bg-tertiary rounded-l-full", style: { width: `${deliveryPct}%` } }), _jsx("div", { className: "h-full bg-error rounded-r-full", style: { width: `${100 - deliveryPct}%` } })] }), _jsxs("span", { className: "text-[9px] text-secondary font-mono", children: [deliveryPct, "%"] })] }))] }, group.id));
                                    })) })] }) }), _jsx("div", { className: "flex-1", children: !selectedGroup ? (
                        /* Empty state */
                        _jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-16 flex flex-col items-center justify-center text-center", children: [_jsx("div", { className: "p-4 bg-primary/5 rounded-full mb-4", children: _jsx("span", { className: "material-symbols-outlined text-5xl text-secondary", children: "folder_open" }) }), _jsx("h3", { className: "text-lg font-bold text-on-surface", children: "Selecione um grupo" }), _jsx("p", { className: "text-sm text-secondary mt-2 max-w-md", children: "Escolha um grupo na lista ao lado para visualizar os contatos, estat\u00EDsticas de campanha e gerenciar os membros." }), _jsx("div", { className: "lg:hidden mt-8 w-full max-w-sm space-y-2", children: groups.map((group) => (_jsxs("button", { onClick: () => handleSelectGroup(group.id), className: "w-full text-left px-4 py-3 bg-surface-container-high border border-outline-variant rounded-lg hover:bg-surface-bright transition-all flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold", children: group.name }), _jsxs("p", { className: "text-[10px] text-secondary", children: [group.contact_count, " contatos"] })] }), _jsx("span", { className: "material-symbols-outlined text-secondary", children: "chevron_right" })] }, group.id))) })] })) : (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "p-3 bg-primary/10 rounded-xl", children: _jsx("span", { className: "material-symbols-outlined text-primary text-2xl", children: "group" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold", children: selectedGroup.name }), selectedGroup.description && (_jsx("p", { className: "text-xs text-secondary mt-0.5", children: selectedGroup.description }))] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: () => { setSelectedGroupId(null); }, className: "lg:hidden px-3 py-2 bg-surface-container-high border border-outline-variant text-on-surface rounded text-xs font-medium hover:bg-surface-bright transition-all flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-sm", children: "arrow_back" }), "Voltar"] }), _jsxs("button", { onClick: () => { if (confirm(`Excluir grupo "${selectedGroup.name}"?`))
                                                                deleteGroup.mutate(selectedGroup.id); }, className: "px-3 py-2 bg-error/10 border border-error/20 text-error rounded text-xs font-medium hover:bg-error/20 transition-all flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-sm", children: "delete" }), "Excluir Grupo"] })] })] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 mt-6", children: [_jsxs("div", { className: "bg-surface-container-high/50 rounded-lg p-3", children: [_jsx("p", { className: "text-[10px] font-semibold uppercase tracking-widest text-secondary", children: "Contatos" }), _jsx("p", { className: "text-xl font-bold font-mono mt-1", children: groupContacts.length })] }), _jsxs("div", { className: "bg-surface-container-high/50 rounded-lg p-3", children: [_jsx("p", { className: "text-[10px] font-semibold uppercase tracking-widest text-secondary", children: "\u00DAltima Campanha" }), _jsx("p", { className: "text-sm font-mono mt-1 text-on-surface-variant", children: campaignStats?.lastCampaign ?? "-" })] }), _jsxs("div", { className: "bg-surface-container-high/50 rounded-lg p-3", children: [_jsx("p", { className: "text-[10px] font-semibold uppercase tracking-widest text-secondary", children: "Entregues" }), _jsx("p", { className: "text-xl font-bold font-mono mt-1 text-tertiary", children: campaignStats?.delivered ?? 0 })] }), _jsxs("div", { className: "bg-surface-container-high/50 rounded-lg p-3", children: [_jsx("p", { className: "text-[10px] font-semibold uppercase tracking-widest text-secondary", children: "Falhas" }), _jsx("p", { className: "text-xl font-bold font-mono mt-1 text-error", children: campaignStats?.failed ?? 0 })] })] }), campaignStats && campaignStats.total > 0 && (_jsxs("div", { className: "mt-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-1.5", children: [_jsx("span", { className: "text-[10px] font-semibold uppercase tracking-widest text-secondary", children: "Taxa de Entrega" }), _jsxs("span", { className: "text-xs font-mono text-on-surface-variant", children: [campaignStats.delivered, "/", campaignStats.total, " (", Math.round((campaignStats.delivered / campaignStats.total) * 100), "%)"] })] }), _jsxs("div", { className: "h-2.5 w-full bg-outline-variant rounded-full overflow-hidden flex", children: [_jsx("div", { className: "h-full bg-tertiary transition-all duration-500 rounded-l-full", style: { width: `${(campaignStats.delivered / campaignStats.total) * 100}%` } }), _jsx("div", { className: "h-full bg-error transition-all duration-500 rounded-r-full", style: { width: `${(campaignStats.failed / campaignStats.total) * 100}%` } })] }), _jsxs("div", { className: "flex items-center gap-4 mt-2", children: [_jsxs("span", { className: "flex items-center gap-1.5 text-[10px] text-secondary", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-tertiary" }), " Entregues"] }), _jsxs("span", { className: "flex items-center gap-1.5 text-[10px] text-secondary", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-error" }), " Falhas"] })] })] }))] }), selectedContactIds.size > 0 && (_jsxs("div", { className: "flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-lg", children: [_jsxs("span", { className: "text-sm font-bold text-primary", children: [selectedContactIds.size, " selecionado(s)"] }), _jsx("div", { className: "flex-1" }), _jsxs("button", { onClick: () => {
                                                if (confirm(`Remover ${selectedContactIds.size} contato(s) do grupo?`))
                                                    removeFromGroup.mutate(Array.from(selectedContactIds));
                                            }, className: "px-3 py-1.5 text-xs font-bold bg-error text-white rounded hover:opacity-90 transition-all flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-sm", children: "person_remove" }), "Remover do Grupo"] }), _jsx("button", { onClick: () => setSelectedContactIds(new Set()), className: "p-1.5 text-secondary hover:text-on-surface", children: _jsx("span", { className: "material-symbols-outlined text-lg", children: "close" }) })] })), _jsxs("div", { className: "flex items-center bg-surface-container rounded-lg border border-outline-variant px-4 py-2.5", children: [_jsx("span", { className: "material-symbols-outlined text-secondary", children: "search" }), _jsx("input", { className: "bg-transparent border-none text-sm focus:ring-0 focus:outline-none text-on-surface w-full placeholder:text-secondary ml-3", placeholder: "Buscar no grupo...", value: search, onChange: (e) => { setSearch(e.target.value); setPage(1); } }), search && (_jsx("button", { onClick: () => setSearch(""), className: "text-secondary hover:text-on-surface", children: _jsx("span", { className: "material-symbols-outlined text-lg", children: "close" }) }))] }), _jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-surface-container-high/50", children: [_jsx("th", { className: "px-4 py-4 w-10", children: _jsx("input", { type: "checkbox", checked: allVisibleSelected && paginatedContacts.length > 0, onChange: toggleSelectAll, className: "rounded border-outline bg-background text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer" }) }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary", children: "Contato" }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary", children: "WhatsApp" }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary hidden xl:table-cell", children: "Cidade/UF" }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary hidden lg:table-cell", children: "Empresa" }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary hidden md:table-cell", children: "Tags" }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary hidden xl:table-cell", children: "\u00DAltima Msg" }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary", children: "Status" }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary text-right", children: "A\u00E7\u00F5es" })] }) }), _jsx("tbody", { className: "divide-y divide-outline-variant", children: paginatedContacts.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 9, className: "px-6 py-16 text-center text-secondary", children: "Nenhum contato neste grupo" }) })) : (paginatedContacts.map((contact) => {
                                                            const lastMsg = MOCK_LAST_MESSAGES[contact.id];
                                                            const isSelected = selectedContactIds.has(contact.id);
                                                            return (_jsxs("tr", { className: `transition-colors group ${isSelected ? "bg-primary/5" : "hover:bg-surface-bright/30"}`, children: [_jsx("td", { className: "px-4 py-3", children: _jsx("input", { type: "checkbox", checked: isSelected, onChange: () => toggleSelect(contact.id), className: "rounded border-outline bg-background text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer" }) }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-surface-container-highest border border-outline-variant flex items-center justify-center text-[10px] font-bold shrink-0", children: contact.display_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-bold truncate", children: contact.display_name }), _jsxs("p", { className: "text-[10px] text-secondary", children: ["DDD ", extractDDD(contact.phone)] })] })] }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "text-sm font-mono text-on-surface-variant", children: formatPhone(contact.phone) }) }), _jsx("td", { className: "px-4 py-3 hidden xl:table-cell", children: _jsx("span", { className: "text-xs text-secondary", children: [contact.city, contact.state].filter(Boolean).join("/") || "-" }) }), _jsx("td", { className: "px-4 py-3 hidden lg:table-cell", children: _jsx("span", { className: "text-xs text-secondary truncate block max-w-[120px]", children: contact.organization || "-" }) }), _jsx("td", { className: "px-4 py-3 hidden md:table-cell", children: _jsx("div", { className: "flex gap-1 flex-wrap max-w-[160px]", children: contact.contact_tags?.slice(0, 2).map((ct) => (_jsx("span", { className: "text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap", style: { backgroundColor: `${ct.tags.color}15`, color: ct.tags.color, borderColor: `${ct.tags.color}30` }, children: ct.tags.name.toUpperCase() }, ct.tags.id))) }) }), _jsx("td", { className: "px-4 py-3 hidden xl:table-cell", children: _jsx("span", { className: "text-[11px] text-secondary font-mono", children: lastMsg?.date || "-" }) }), _jsx("td", { className: "px-4 py-3", children: contact.is_blacklisted ? (_jsx("span", { className: "text-[9px] font-bold px-2 py-0.5 rounded bg-error-container text-on-error-container border border-error/20", children: "BLOQUEADO" })) : lastMsg?.status === "error" ? (_jsxs("span", { className: "text-[9px] font-bold px-2 py-0.5 rounded bg-error/10 text-error border border-error/20 flex items-center gap-1 w-fit", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-error" }), " ERRO"] })) : lastMsg?.status === "read" ? (_jsxs("span", { className: "text-[9px] font-bold px-2 py-0.5 rounded bg-tertiary/10 text-tertiary border border-tertiary/20 flex items-center gap-1 w-fit", children: [_jsx("span", { className: "material-symbols-outlined text-[12px]", children: "done_all" }), " LIDA"] })) : lastMsg?.status === "delivered" ? (_jsxs("span", { className: "text-[9px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 flex items-center gap-1 w-fit", children: [_jsx("span", { className: "material-symbols-outlined text-[12px]", children: "done" }), " ENTREGUE"] })) : (_jsx("span", { className: "text-[9px] font-bold px-2 py-0.5 rounded bg-surface-container-highest text-secondary border border-outline-variant", children: "NOVO" })) }), _jsx("td", { className: "px-4 py-3 text-right", children: _jsx("div", { className: "flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity", children: _jsx("button", { onClick: () => {
                                                                                    if (confirm(`Remover ${contact.display_name} do grupo?`))
                                                                                        removeFromGroup.mutate([contact.id]);
                                                                                }, className: "p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-error", title: "Remover do grupo", children: _jsx("span", { className: "material-symbols-outlined text-lg", children: "person_remove" }) }) }) })] }, contact.id));
                                                        })) })] }) }), totalPages > 1 && (_jsxs("div", { className: "flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-outline-variant gap-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("p", { className: "text-xs text-secondary", children: ["P\u00E1gina ", page, " de ", totalPages, " (", filteredContacts.length, " contatos)"] }), _jsxs("select", { value: perPage, onChange: (e) => { setPerPage(Number(e.target.value)); setPage(1); }, className: "bg-background border border-outline-variant rounded px-2 py-1 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary", children: [_jsx("option", { value: 10, children: "10 / p\u00E1gina" }), _jsx("option", { value: 50, children: "50 / p\u00E1gina" }), _jsx("option", { value: 100, children: "100 / p\u00E1gina" })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { disabled: page === 1, onClick: () => setPage((p) => p - 1), className: "px-3 py-1.5 text-xs bg-surface-container-high border border-outline-variant rounded hover:bg-surface-bright disabled:opacity-30 transition-all", children: "Anterior" }), Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                            let pageNum;
                                                            if (totalPages <= 5)
                                                                pageNum = i + 1;
                                                            else if (page <= 3)
                                                                pageNum = i + 1;
                                                            else if (page >= totalPages - 2)
                                                                pageNum = totalPages - 4 + i;
                                                            else
                                                                pageNum = page - 2 + i;
                                                            return (_jsx("button", { onClick: () => setPage(pageNum), className: `w-8 h-8 text-xs rounded transition-all ${pageNum === page ? "bg-primary text-on-primary font-bold" : "bg-surface-container-high border border-outline-variant hover:bg-surface-bright"}`, children: pageNum }, pageNum));
                                                        }), _jsx("button", { disabled: page >= totalPages, onClick: () => setPage((p) => p + 1), className: "px-3 py-1.5 text-xs bg-surface-container-high border border-outline-variant rounded hover:bg-surface-bright disabled:opacity-30 transition-all", children: "Pr\u00F3xima" })] })] }))] })] })) })] })] }));
}
//# sourceMappingURL=Groups.js.map