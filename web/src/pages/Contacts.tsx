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

interface Tag {
  id: string;
  name: string;
  color: string;
}

// ── Types ──────────────────────────────────────────────
interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  phone: string;
  city: string | null;
  state: string | null;
  organization: string | null;
  is_valid: boolean;
  is_blacklisted: boolean;
  last_message_at: string | null;
  created_at: string;
  contact_tags?: Array<{ tags: { id: string; name: string; color: string } }>;
}

interface ContactsResponse {
  data: Contact[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ── Component ──────────────────────────────────────────
export default function Contacts() {
  // State
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
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
      if (search) params.set("search", search);
      if (filterCity) {
        const [city] = filterCity.split("/");
        if (city) params.set("city", city);
      }
      return api.get<ContactsResponse>(`/contacts?${params}`);
    },
  });

  // Fetch tags from API
  const { data: apiTags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => api.get<Tag[]>("/tags"),
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
  const allOrgs = useMemo(() => [...new Set(contacts.map((c) => c.organization).filter(Boolean) as string[])].sort(), [contacts]);

  // Selection
  const allVisibleSelected = paginatedContacts.length > 0 && paginatedContacts.every((c) => selectedIds.has(c.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    } else {
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
    mutationFn: () =>
      api.post("/contacts/bulk-action", {
        contact_ids: Array.from(selectedIds),
        action: "delete",
      }),
    onSuccess: () => {
      toast.success(`${selectedIds.size} contatos removidos`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Single delete
  const singleDelete = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      toast.success("Contato removido");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err: Error) => toast.error(err.message),
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
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Contatos</h2>
          <p className="text-secondary mt-1">{displayTotal} contatos cadastrados</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={downloadTemplate}
            className="px-4 py-2 bg-surface-container border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all active:scale-95 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Baixar Modelo
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-surface-container border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all active:scale-95 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">upload_file</span>
            Importar Tabela
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            Adicionar Contato
          </button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-lg">
          <span className="text-sm font-bold text-primary">{selectedIds.size} selecionado(s)</span>
          <div className="flex-1" />
          <button onClick={selectAllFiltered} className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-all">
            Selecionar todos ({filteredContacts.length})
          </button>
          <button
            onClick={() => setShowGroupModal(true)}
            className="px-3 py-1.5 text-xs font-bold bg-tertiary text-on-tertiary rounded hover:opacity-90 transition-all flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">group_add</span>
            Criar Grupo
          </button>
          <button
            onClick={() => {
              if (confirm(`Excluir ${selectedIds.size} contatos?`)) bulkDelete.mutate();
            }}
            className="px-3 py-1.5 text-xs font-bold bg-error text-white rounded hover:opacity-90 transition-all flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
            Excluir
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="p-1.5 text-secondary hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      <div className="flex gap-6">
        {/* ── Sidebar Filters ── */}
        <aside className={`${filtersOpen ? "w-56 min-w-[14rem]" : "w-0 min-w-0 overflow-hidden"} transition-all duration-200 hidden lg:block`}>
          <div className="bg-surface-container border border-outline-variant rounded-xl p-4 space-y-5 sticky top-20">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-widest text-secondary">Filtros</h4>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-[10px] text-primary hover:underline">Limpar</button>
              )}
            </div>

            {/* Tag filter */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Tag</label>
              <select
                value={filterTag}
                onChange={(e) => { setFilterTag(e.target.value); setPage(1); }}
                className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary"
              >
                <option value="">Todas</option>
                {allTags.map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* City/State filter */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Cidade/Estado</label>
              <select
                value={filterCity}
                onChange={(e) => { setFilterCity(e.target.value); setPage(1); }}
                className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary"
              >
                <option value="">Todas</option>
                {allCities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* DDD filter */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">DDD</label>
              <select
                value={filterDDD}
                onChange={(e) => { setFilterDDD(e.target.value); setPage(1); }}
                className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary"
              >
                <option value="">Todos</option>
                {allDDDs.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Organization filter */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Empresa</label>
              <select
                value={filterOrg}
                onChange={(e) => { setFilterOrg(e.target.value); setPage(1); }}
                className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary"
              >
                <option value="">Todas</option>
                {allOrgs.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 space-y-4">
          {/* Search + filter toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className={`hidden lg:flex p-2.5 border rounded transition-all ${filtersOpen ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface-container border-outline-variant text-secondary hover:text-on-surface"}`}
              title="Filtros"
            >
              <span className="material-symbols-outlined text-lg">filter_list</span>
            </button>
            <div className="flex-1 flex items-center bg-surface-container rounded-lg border border-outline-variant px-4 py-2.5">
              <span className="material-symbols-outlined text-secondary">search</span>
              <input
                className="bg-transparent border-none text-sm focus:ring-0 focus:outline-none text-on-surface w-full placeholder:text-secondary ml-3"
                placeholder="Buscar por nome, telefone ou empresa..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-secondary hover:text-on-surface">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-high/50">
                    <th className="px-4 py-4 w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected && paginatedContacts.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-outline bg-background text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary">Contato</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary">WhatsApp</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary hidden xl:table-cell">Cidade/UF</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary hidden lg:table-cell">Empresa</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary hidden md:table-cell">Tags</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary hidden xl:table-cell">Última Msg</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary">Status</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {isLoading ? (
                    <tr><td colSpan={9} className="px-6 py-16 text-center text-secondary">Carregando...</td></tr>
                  ) : paginatedContacts.length === 0 ? (
                    <tr><td colSpan={9} className="px-6 py-16 text-center text-secondary">Nenhum contato encontrado</td></tr>
                  ) : (
                    paginatedContacts.map((contact) => {
                      const isSelected = selectedIds.has(contact.id);
                      return (
                        <tr key={contact.id} className={`transition-colors group ${isSelected ? "bg-primary/5" : "hover:bg-surface-bright/30"}`}>
                          {/* Checkbox */}
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(contact.id)}
                              className="rounded border-outline bg-background text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
                            />
                          </td>

                          {/* Nome */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-surface-container-highest border border-outline-variant flex items-center justify-center text-[10px] font-bold shrink-0">
                                {contact.display_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate">{contact.display_name}</p>
                                <p className="text-[10px] text-secondary">DDD {extractDDD(contact.phone)}</p>
                              </div>
                            </div>
                          </td>

                          {/* Telefone */}
                          <td className="px-4 py-3">
                            <span className="text-sm font-mono text-on-surface-variant">{formatPhone(contact.phone)}</span>
                          </td>

                          {/* Cidade/UF */}
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <span className="text-xs text-secondary">
                              {[contact.city, contact.state].filter(Boolean).join("/") || "-"}
                            </span>
                          </td>

                          {/* Empresa */}
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="text-xs text-secondary truncate block max-w-[120px]">{contact.organization || "-"}</span>
                          </td>

                          {/* Tags */}
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex gap-1 flex-wrap max-w-[160px]">
                              {contact.contact_tags?.slice(0, 2).map((ct) => (
                                <span
                                  key={ct.tags.id}
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap"
                                  style={{ backgroundColor: `${ct.tags.color}15`, color: ct.tags.color, borderColor: `${ct.tags.color}30` }}
                                >
                                  {ct.tags.name.toUpperCase()}
                                </span>
                              ))}
                              {(contact.contact_tags?.length ?? 0) > 2 && (
                                <span className="text-[9px] text-secondary">+{(contact.contact_tags?.length ?? 0) - 2}</span>
                              )}
                            </div>
                          </td>

                          {/* Última Mensagem */}
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <span className="text-[11px] text-secondary font-mono">
                              {contact.last_message_at
                                ? new Date(contact.last_message_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
                                : "-"}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            {contact.is_blacklisted ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-error-container text-on-error-container border border-error/20">BLOQUEADO</span>
                            ) : !contact.is_valid ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-secondary-container text-secondary border border-outline">INVÁLIDO</span>
                            ) : (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-tertiary/10 text-tertiary border border-tertiary/20 flex items-center gap-1 w-fit">
                                <span className="material-symbols-outlined text-[12px]">done</span> VÁLIDO
                              </span>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setEditingContact(contact); setShowEditModal(true); }}
                                className="p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-primary"
                                title="Editar"
                              >
                                <span className="material-symbols-outlined text-lg">edit</span>
                              </button>
                              <button
                                onClick={() => { if (confirm(`Excluir ${contact.display_name}?`)) singleDelete.mutate(contact.id); }}
                                className="p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-error"
                                title="Excluir"
                              >
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-outline-variant gap-3">
              <div className="flex items-center gap-3">
                <p className="text-xs text-secondary">
                  Página {page} de {totalPages || 1} ({displayTotal} resultados)
                </p>
                <select
                  value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                  className="bg-background border border-outline-variant rounded px-2 py-1 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary"
                >
                  <option value={10}>10 / página</option>
                  <option value={50}>50 / página</option>
                  <option value={100}>100 / página</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 text-xs bg-surface-container-high border border-outline-variant rounded hover:bg-surface-bright disabled:opacity-30 transition-all"
                >
                  Anterior
                </button>
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages || 1) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 text-xs rounded transition-all ${pageNum === page ? "bg-primary text-on-primary font-bold" : "bg-surface-container-high border border-outline-variant hover:bg-surface-bright"}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  disabled={page >= (totalPages || 1)}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 text-xs bg-surface-container-high border border-outline-variant rounded hover:bg-surface-bright disabled:opacity-30 transition-all"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddContactModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      <EditContactModal open={showEditModal} onClose={() => { setShowEditModal(false); setEditingContact(null); }} contact={editingContact} />
      <ImportModal open={showImportModal} onClose={() => setShowImportModal(false)} />
      <CreateGroupModal open={showGroupModal} onClose={() => setShowGroupModal(false)} selectedIds={Array.from(selectedIds)} />
    </div>
  );
}
