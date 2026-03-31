import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatPhone, extractDDD } from "@/utils/phone";
import { downloadTemplate } from "@/utils/download-template";
import AddContactModal from "@/components/contacts/AddContactModal";
import EditContactModal from "@/components/contacts/EditContactModal";
import ImportModal from "@/components/contacts/ImportModal";
import CreateGroupModal from "@/components/contacts/CreateGroupModal";
import toast from "react-hot-toast";
// ── Component ──────────────────────────────────────────
export default function Contacts() {
    // State
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(true);
    // Filters
    const [filterTag, setFilterTag] = useState("");
    const [filterCity, setFilterCity] = useState("");
    const [filterDDD, setFilterDDD] = useState("");
    const [filterOrg, setFilterOrg] = useState("");
    const queryClient = useQueryClient();
    // Fetch contacts from API (server-side pagination + search + city filter)
    const { data: apiData, isLoading } = useQuery({
        queryKey: ["contacts", page, perPage, search, filterCity],
        queryFn: () => {
            const params = new URLSearchParams({ page: String(page), limit: String(perPage) });
            if (search)
                params.set("search", search);
            if (filterCity) {
                const [city] = filterCity.split("/");
                if (city)
                    params.set("city", city);
            }
            return api.get(`/contacts?${params}`);
        },
    });
    // Fetch tags from API
    const { data: apiTags = [] } = useQuery({
        queryKey: ["tags"],
        queryFn: () => api.get("/tags"),
    });
    const contacts = apiData?.data ?? [];
    // Client-side filters (tag, DDD, org are not handled server-side)
    const filteredContacts = useMemo(() => {
        let list = contacts;
        if (filterTag) {
            list = list.filter((c) => c.contact_tags?.some((ct) => ct.tags.name === filterTag));
        }
        if (filterDDD) {
            list = list.filter((c) => extractDDD(c.phone) === filterDDD);
        }
        if (filterOrg) {
            list = list.filter((c) => c.organization === filterOrg);
        }
        return list;
    }, [contacts, filterTag, filterDDD, filterOrg]);
    // If client-side filters are active, we paginate locally; otherwise use API pagination
    const hasClientFilters = !!(filterTag || filterDDD || filterOrg);
    const paginatedContacts = hasClientFilters
        ? filteredContacts.slice((page - 1) * perPage, page * perPage)
        : contacts;
    const totalPages = hasClientFilters
        ? Math.ceil(filteredContacts.length / perPage)
        : (apiData?.pagination?.totalPages ?? 1);
    const displayTotal = hasClientFilters
        ? filteredContacts.length
        : (apiData?.pagination?.total ?? 0);
    // Filter dropdown options
    const allTags = apiTags;
    const allCities = useMemo(() => [...new Set(contacts.map((c) => [c.city, c.state].filter(Boolean).join("/")).filter(Boolean))].sort(), [contacts]);
    const allDDDs = useMemo(() => [...new Set(contacts.map((c) => extractDDD(c.phone)).filter(Boolean))].sort(), [contacts]);
    const allOrgs = useMemo(() => [...new Set(contacts.map((c) => c.organization).filter(Boolean))].sort(), [contacts]);
    // Selection
    const allVisibleSelected = paginatedContacts.length > 0 && paginatedContacts.every((c) => selectedIds.has(c.id));
    function toggleSelect(id) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    }
    function toggleSelectAll() {
        if (allVisibleSelected) {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                paginatedContacts.forEach((c) => next.delete(c.id));
                return next;
            });
        }
        else {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                paginatedContacts.forEach((c) => next.add(c.id));
                return next;
            });
        }
    }
    function selectAllFiltered() {
        setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
        toast.success(`${filteredContacts.length} contatos selecionados`);
    }
    // Bulk delete
    const bulkDelete = useMutation({
        mutationFn: () => api.post("/contacts/bulk-action", {
            contact_ids: Array.from(selectedIds),
            action: "delete",
        }),
        onSuccess: () => {
            toast.success(`${selectedIds.size} contatos removidos`);
            setSelectedIds(new Set());
            queryClient.invalidateQueries({ queryKey: ["contacts"] });
        },
        onError: (err) => toast.error(err.message),
    });
    // Single delete
    const singleDelete = useMutation({
        mutationFn: (id) => api.delete(`/contacts/${id}`),
        onSuccess: () => {
            toast.success("Contato removido");
            queryClient.invalidateQueries({ queryKey: ["contacts"] });
        },
        onError: (err) => toast.error(err.message),
    });
    function clearFilters() {
        setFilterTag("");
        setFilterCity("");
        setFilterDDD("");
        setFilterOrg("");
        setPage(1);
    }
    const hasActiveFilters = filterTag || filterCity || filterDDD || filterOrg;
    // ── Render ──────────────────────────────────────────
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold tracking-tight", children: "Contatos" }), _jsxs("p", { className: "text-secondary mt-1", children: [displayTotal, " contatos cadastrados"] })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("button", { onClick: downloadTemplate, className: "px-4 py-2 bg-surface-container border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all active:scale-95 flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "download" }), "Baixar Modelo"] }), _jsxs("button", { onClick: () => setShowImportModal(true), className: "px-4 py-2 bg-surface-container border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all active:scale-95 flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "upload_file" }), "Importar Tabela"] }), _jsxs("button", { onClick: () => setShowAddModal(true), className: "px-4 py-2 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20 flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "person_add" }), "Adicionar Contato"] })] })] }), selectedIds.size > 0 && (_jsxs("div", { className: "flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-lg", children: [_jsxs("span", { className: "text-sm font-bold text-primary", children: [selectedIds.size, " selecionado(s)"] }), _jsx("div", { className: "flex-1" }), _jsxs("button", { onClick: selectAllFiltered, className: "px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-all", children: ["Selecionar todos (", filteredContacts.length, ")"] }), _jsxs("button", { onClick: () => setShowGroupModal(true), className: "px-3 py-1.5 text-xs font-bold bg-tertiary text-on-tertiary rounded hover:opacity-90 transition-all flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-sm", children: "group_add" }), "Criar Grupo"] }), _jsxs("button", { onClick: () => {
                            if (confirm(`Excluir ${selectedIds.size} contatos?`))
                                bulkDelete.mutate();
                        }, className: "px-3 py-1.5 text-xs font-bold bg-error text-white rounded hover:opacity-90 transition-all flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-sm", children: "delete" }), "Excluir"] }), _jsx("button", { onClick: () => setSelectedIds(new Set()), className: "p-1.5 text-secondary hover:text-on-surface transition-colors", children: _jsx("span", { className: "material-symbols-outlined text-lg", children: "close" }) })] })), _jsxs("div", { className: "flex gap-6", children: [_jsx("aside", { className: `${filtersOpen ? "w-56 min-w-[14rem]" : "w-0 min-w-0 overflow-hidden"} transition-all duration-200 hidden lg:block`, children: _jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-4 space-y-5 sticky top-20", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h4", { className: "text-xs font-bold uppercase tracking-widest text-secondary", children: "Filtros" }), hasActiveFilters && (_jsx("button", { onClick: clearFilters, className: "text-[10px] text-primary hover:underline", children: "Limpar" }))] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-semibold uppercase tracking-wider text-secondary", children: "Tag" }), _jsxs("select", { value: filterTag, onChange: (e) => { setFilterTag(e.target.value); setPage(1); }, className: "w-full bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary", children: [_jsx("option", { value: "", children: "Todas" }), allTags.map((t) => (_jsx("option", { value: t.name, children: t.name }, t.name)))] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-semibold uppercase tracking-wider text-secondary", children: "Cidade/Estado" }), _jsxs("select", { value: filterCity, onChange: (e) => { setFilterCity(e.target.value); setPage(1); }, className: "w-full bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary", children: [_jsx("option", { value: "", children: "Todas" }), allCities.map((c) => (_jsx("option", { value: c, children: c }, c)))] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-semibold uppercase tracking-wider text-secondary", children: "DDD" }), _jsxs("select", { value: filterDDD, onChange: (e) => { setFilterDDD(e.target.value); setPage(1); }, className: "w-full bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary", children: [_jsx("option", { value: "", children: "Todos" }), allDDDs.map((d) => (_jsx("option", { value: d, children: d }, d)))] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-semibold uppercase tracking-wider text-secondary", children: "Empresa" }), _jsxs("select", { value: filterOrg, onChange: (e) => { setFilterOrg(e.target.value); setPage(1); }, className: "w-full bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary", children: [_jsx("option", { value: "", children: "Todas" }), allOrgs.map((o) => (_jsx("option", { value: o, children: o }, o)))] })] })] }) }), _jsxs("div", { className: "flex-1 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => setFiltersOpen((o) => !o), className: `hidden lg:flex p-2.5 border rounded transition-all ${filtersOpen ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface-container border-outline-variant text-secondary hover:text-on-surface"}`, title: "Filtros", children: _jsx("span", { className: "material-symbols-outlined text-lg", children: "filter_list" }) }), _jsxs("div", { className: "flex-1 flex items-center bg-surface-container rounded-lg border border-outline-variant px-4 py-2.5", children: [_jsx("span", { className: "material-symbols-outlined text-secondary", children: "search" }), _jsx("input", { className: "bg-transparent border-none text-sm focus:ring-0 focus:outline-none text-on-surface w-full placeholder:text-secondary ml-3", placeholder: "Buscar por nome, telefone ou empresa...", value: search, onChange: (e) => { setSearch(e.target.value); setPage(1); } }), search && (_jsx("button", { onClick: () => setSearch(""), className: "text-secondary hover:text-on-surface", children: _jsx("span", { className: "material-symbols-outlined text-lg", children: "close" }) }))] })] }), _jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-surface-container-high/50", children: [_jsx("th", { className: "px-4 py-4 w-10", children: _jsx("input", { type: "checkbox", checked: allVisibleSelected && paginatedContacts.length > 0, onChange: toggleSelectAll, className: "rounded border-outline bg-background text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer" }) }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary", children: "Contato" }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary", children: "WhatsApp" }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary hidden xl:table-cell", children: "Cidade/UF" }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary hidden lg:table-cell", children: "Empresa" }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary hidden md:table-cell", children: "Tags" }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary hidden xl:table-cell", children: "\u00DAltima Msg" }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary", children: "Status" }), _jsx("th", { className: "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary text-right", children: "A\u00E7\u00F5es" })] }) }), _jsx("tbody", { className: "divide-y divide-outline-variant", children: isLoading ? (_jsx("tr", { children: _jsx("td", { colSpan: 9, className: "px-6 py-16 text-center text-secondary", children: "Carregando..." }) })) : paginatedContacts.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 9, className: "px-6 py-16 text-center text-secondary", children: "Nenhum contato encontrado" }) })) : (paginatedContacts.map((contact) => {
                                                        const isSelected = selectedIds.has(contact.id);
                                                        return (_jsxs("tr", { className: `transition-colors group ${isSelected ? "bg-primary/5" : "hover:bg-surface-bright/30"}`, children: [_jsx("td", { className: "px-4 py-3", children: _jsx("input", { type: "checkbox", checked: isSelected, onChange: () => toggleSelect(contact.id), className: "rounded border-outline bg-background text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer" }) }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-surface-container-highest border border-outline-variant flex items-center justify-center text-[10px] font-bold shrink-0", children: contact.display_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-bold truncate", children: contact.display_name }), _jsxs("p", { className: "text-[10px] text-secondary", children: ["DDD ", extractDDD(contact.phone)] })] })] }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "text-sm font-mono text-on-surface-variant", children: formatPhone(contact.phone) }) }), _jsx("td", { className: "px-4 py-3 hidden xl:table-cell", children: _jsx("span", { className: "text-xs text-secondary", children: [contact.city, contact.state].filter(Boolean).join("/") || "-" }) }), _jsx("td", { className: "px-4 py-3 hidden lg:table-cell", children: _jsx("span", { className: "text-xs text-secondary truncate block max-w-[120px]", children: contact.organization || "-" }) }), _jsx("td", { className: "px-4 py-3 hidden md:table-cell", children: _jsxs("div", { className: "flex gap-1 flex-wrap max-w-[160px]", children: [contact.contact_tags?.slice(0, 2).map((ct) => (_jsx("span", { className: "text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap", style: { backgroundColor: `${ct.tags.color}15`, color: ct.tags.color, borderColor: `${ct.tags.color}30` }, children: ct.tags.name.toUpperCase() }, ct.tags.id))), (contact.contact_tags?.length ?? 0) > 2 && (_jsxs("span", { className: "text-[9px] text-secondary", children: ["+", (contact.contact_tags?.length ?? 0) - 2] }))] }) }), _jsx("td", { className: "px-4 py-3 hidden xl:table-cell", children: _jsx("span", { className: "text-[11px] text-secondary font-mono", children: "-" }) }), _jsx("td", { className: "px-4 py-3", children: contact.is_blacklisted ? (_jsx("span", { className: "text-[9px] font-bold px-2 py-0.5 rounded bg-error-container text-on-error-container border border-error/20", children: "BLOQUEADO" })) : !contact.is_valid ? (_jsx("span", { className: "text-[9px] font-bold px-2 py-0.5 rounded bg-secondary-container text-secondary border border-outline", children: "INV\u00C1LIDO" })) : (_jsxs("span", { className: "text-[9px] font-bold px-2 py-0.5 rounded bg-tertiary/10 text-tertiary border border-tertiary/20 flex items-center gap-1 w-fit", children: [_jsx("span", { className: "material-symbols-outlined text-[12px]", children: "done" }), " V\u00C1LIDO"] })) }), _jsx("td", { className: "px-4 py-3 text-right", children: _jsxs("div", { className: "flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity", children: [_jsx("button", { onClick: () => { setEditingContact(contact); setShowEditModal(true); }, className: "p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-primary", title: "Editar", children: _jsx("span", { className: "material-symbols-outlined text-lg", children: "edit" }) }), _jsx("button", { onClick: () => { if (confirm(`Excluir ${contact.display_name}?`))
                                                                                    singleDelete.mutate(contact.id); }, className: "p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-error", title: "Excluir", children: _jsx("span", { className: "material-symbols-outlined text-lg", children: "delete" }) })] }) })] }, contact.id));
                                                    })) })] }) }), _jsxs("div", { className: "flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-outline-variant gap-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("p", { className: "text-xs text-secondary", children: ["P\u00E1gina ", page, " de ", totalPages || 1, " (", displayTotal, " resultados)"] }), _jsxs("select", { value: perPage, onChange: (e) => { setPerPage(Number(e.target.value)); setPage(1); }, className: "bg-background border border-outline-variant rounded px-2 py-1 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary", children: [_jsx("option", { value: 10, children: "10 / p\u00E1gina" }), _jsx("option", { value: 50, children: "50 / p\u00E1gina" }), _jsx("option", { value: 100, children: "100 / p\u00E1gina" })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { disabled: page === 1, onClick: () => setPage((p) => p - 1), className: "px-3 py-1.5 text-xs bg-surface-container-high border border-outline-variant rounded hover:bg-surface-bright disabled:opacity-30 transition-all", children: "Anterior" }), Array.from({ length: Math.min(5, totalPages || 1) }, (_, i) => {
                                                        let pageNum;
                                                        if (totalPages <= 5) {
                                                            pageNum = i + 1;
                                                        }
                                                        else if (page <= 3) {
                                                            pageNum = i + 1;
                                                        }
                                                        else if (page >= totalPages - 2) {
                                                            pageNum = totalPages - 4 + i;
                                                        }
                                                        else {
                                                            pageNum = page - 2 + i;
                                                        }
                                                        return (_jsx("button", { onClick: () => setPage(pageNum), className: `w-8 h-8 text-xs rounded transition-all ${pageNum === page ? "bg-primary text-on-primary font-bold" : "bg-surface-container-high border border-outline-variant hover:bg-surface-bright"}`, children: pageNum }, pageNum));
                                                    }), _jsx("button", { disabled: page >= (totalPages || 1), onClick: () => setPage((p) => p + 1), className: "px-3 py-1.5 text-xs bg-surface-container-high border border-outline-variant rounded hover:bg-surface-bright disabled:opacity-30 transition-all", children: "Pr\u00F3xima" })] })] })] })] })] }), _jsx(AddContactModal, { open: showAddModal, onClose: () => setShowAddModal(false) }), _jsx(EditContactModal, { open: showEditModal, onClose: () => { setShowEditModal(false); setEditingContact(null); }, contact: editingContact }), _jsx(ImportModal, { open: showImportModal, onClose: () => setShowImportModal(false) }), _jsx(CreateGroupModal, { open: showGroupModal, onClose: () => setShowGroupModal(false), selectedIds: Array.from(selectedIds) })] }));
}
//# sourceMappingURL=Contacts.js.map