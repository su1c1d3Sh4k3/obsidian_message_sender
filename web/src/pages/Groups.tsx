import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatPhone, extractDDD } from "@/utils/phone";
import toast from "react-hot-toast";

// ── Types ──────────────────────────────────────────────
interface Group {
  id: string;
  name: string;
  description: string | null;
  contact_count: number;
  created_at: string;
}

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
  created_at: string;
  contact_tags?: Array<{ tags: { id: string; name: string; color: string } }>;
}

// ── Component ──────────────────────────────────────────
export default function Groups() {
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  // Fetch groups from API
  const { data: apiGroups } = useQuery({
    queryKey: ["lists"],
    queryFn: () => api.get<Group[]>("/lists"),
  });

  const groups = apiGroups ?? [];

  // Fetch group contacts from API
  const { data: apiGroupContacts } = useQuery({
    queryKey: ["list-contacts", selectedGroupId, page, perPage],
    queryFn: () => {
      if (!selectedGroupId) return null;
      return api.get<{ data: Contact[]; pagination: { total: number } }>(`/lists/${selectedGroupId}/contacts?page=${page}&limit=${perPage}`);
    },
    enabled: !!selectedGroupId,
  });

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;
  const groupContacts = useMemo(() => {
    return apiGroupContacts?.data ?? [];
  }, [apiGroupContacts]);

  // Client-side search filter
  const filteredContacts = useMemo(() => {
    if (!search) return groupContacts;
    const s = search.toLowerCase();
    return groupContacts.filter((c) =>
      c.display_name.toLowerCase().includes(s) || c.phone.includes(s) || c.organization?.toLowerCase().includes(s)
    );
  }, [groupContacts, search]);

  // Pagination (client-side for mock)
  const paginatedContacts = useMemo(() => {
    if (apiGroupContacts?.data?.length) return filteredContacts;
    const start = (page - 1) * perPage;
    return filteredContacts.slice(start, start + perPage);
  }, [filteredContacts, apiGroupContacts, page, perPage]);

  const totalPages = apiGroupContacts?.pagination
    ? Math.ceil(apiGroupContacts.pagination.total / perPage)
    : Math.ceil(filteredContacts.length / perPage);

  // Selection
  const allVisibleSelected = paginatedContacts.length > 0 && paginatedContacts.every((c) => selectedContactIds.has(c.id));

  function toggleSelect(id: string) {
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
    } else {
      setSelectedContactIds((prev) => {
        const next = new Set(prev);
        paginatedContacts.forEach((c) => next.add(c.id));
        return next;
      });
    }
  }

  // Remove from group
  const removeFromGroup = useMutation({
    mutationFn: (contactIds: string[]) =>
      api.post("/contacts/bulk-action", {
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
    onError: (err: Error) => toast.error(err.message),
  });

  // Delete group
  const deleteGroup = useMutation({
    mutationFn: (id: string) => api.delete(`/lists/${id}`),
    onSuccess: () => {
      toast.success("Grupo excluído");
      setSelectedGroupId(null);
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSelectGroup(id: string) {
    setSelectedGroupId(id);
    setPage(1);
    setSearch("");
    setSelectedContactIds(new Set());
  }

  // ── Render ──────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Grupos</h2>
        <p className="text-secondary mt-1">Gerencie seus grupos de contatos para campanhas.</p>
      </div>

      <div className="flex gap-6">
        {/* ── Sidebar: Lista de Grupos ── */}
        <aside className="w-64 min-w-[16rem] hidden lg:block">
          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden sticky top-20">
            <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-widest text-secondary">Grupos</h4>
              <span className="text-[10px] font-mono text-secondary bg-surface-container-highest px-2 py-0.5 rounded-full">{groups.length}</span>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {groups.length === 0 ? (
                <div className="p-6 text-center">
                  <span className="material-symbols-outlined text-3xl text-secondary mb-2">folder_off</span>
                  <p className="text-xs text-secondary">Nenhum grupo criado</p>
                  <p className="text-[10px] text-secondary mt-1">Selecione contatos e clique em "Criar Grupo"</p>
                </div>
              ) : (
                groups.map((group) => {
                  const isActive = selectedGroupId === group.id;
                  return (
                    <button
                      key={group.id}
                      onClick={() => handleSelectGroup(group.id)}
                      className={`w-full text-left px-4 py-3 border-b border-outline-variant transition-all ${
                        isActive
                          ? "bg-primary/10 border-l-2 border-l-primary"
                          : "hover:bg-surface-bright/50 border-l-2 border-l-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-semibold truncate ${isActive ? "text-primary" : "text-on-surface"}`}>
                          {group.name}
                        </p>
                        <span className="text-[10px] font-mono text-secondary ml-2 shrink-0">{group.contact_count}</span>
                      </div>
                      {group.description && (
                        <p className="text-[10px] text-secondary truncate mt-0.5">{group.description}</p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1">
          {!selectedGroup ? (
            /* Empty state */
            <div className="bg-surface-container border border-outline-variant rounded-xl p-16 flex flex-col items-center justify-center text-center">
              <div className="p-4 bg-primary/5 rounded-full mb-4">
                <span className="material-symbols-outlined text-5xl text-secondary">folder_open</span>
              </div>
              <h3 className="text-lg font-bold text-on-surface">Selecione um grupo</h3>
              <p className="text-sm text-secondary mt-2 max-w-md">
                Escolha um grupo na lista ao lado para visualizar os contatos, estatísticas de campanha e gerenciar os membros.
              </p>

              {/* Mobile: group list */}
              <div className="lg:hidden mt-8 w-full max-w-sm space-y-2">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => handleSelectGroup(group.id)}
                    className="w-full text-left px-4 py-3 bg-surface-container-high border border-outline-variant rounded-lg hover:bg-surface-bright transition-all flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold">{group.name}</p>
                      <p className="text-[10px] text-secondary">{group.contact_count} contatos</p>
                    </div>
                    <span className="material-symbols-outlined text-secondary">chevron_right</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* ── Group Header ── */}
              <div className="bg-surface-container border border-outline-variant rounded-xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl">
                      <span className="material-symbols-outlined text-primary text-2xl">group</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{selectedGroup.name}</h3>
                      {selectedGroup.description && (
                        <p className="text-xs text-secondary mt-0.5">{selectedGroup.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setSelectedGroupId(null); }}
                      className="lg:hidden px-3 py-2 bg-surface-container-high border border-outline-variant text-on-surface rounded text-xs font-medium hover:bg-surface-bright transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_back</span>
                      Voltar
                    </button>
                    <button
                      onClick={() => { if (confirm(`Excluir grupo "${selectedGroup.name}"?`)) deleteGroup.mutate(selectedGroup.id); }}
                      className="px-3 py-2 bg-error/10 border border-error/20 text-error rounded text-xs font-medium hover:bg-error/20 transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      Excluir Grupo
                    </button>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-1 gap-4 mt-6">
                  <div className="bg-surface-container-high/50 rounded-lg p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-secondary">Contatos</p>
                    <p className="text-xl font-bold font-mono mt-1">{selectedGroup.contact_count}</p>
                  </div>
                </div>
              </div>

              {/* ── Bulk actions ── */}
              {selectedContactIds.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <span className="text-sm font-bold text-primary">{selectedContactIds.size} selecionado(s)</span>
                  <div className="flex-1" />
                  <button
                    onClick={() => {
                      if (confirm(`Remover ${selectedContactIds.size} contato(s) do grupo?`))
                        removeFromGroup.mutate(Array.from(selectedContactIds));
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-error text-white rounded hover:opacity-90 transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">person_remove</span>
                    Remover do Grupo
                  </button>
                  <button onClick={() => setSelectedContactIds(new Set())} className="p-1.5 text-secondary hover:text-on-surface">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              )}

              {/* ── Search ── */}
              <div className="flex items-center bg-surface-container rounded-lg border border-outline-variant px-4 py-2.5">
                <span className="material-symbols-outlined text-secondary">search</span>
                <input
                  className="bg-transparent border-none text-sm focus:ring-0 focus:outline-none text-on-surface w-full placeholder:text-secondary ml-3"
                  placeholder="Buscar no grupo..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-secondary hover:text-on-surface">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                )}
              </div>

              {/* ── Table ── */}
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
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary">Status</th>
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {paginatedContacts.length === 0 ? (
                        <tr><td colSpan={9} className="px-6 py-16 text-center text-secondary">Nenhum contato neste grupo</td></tr>
                      ) : (
                        paginatedContacts.map((contact) => {
                          const isSelected = selectedContactIds.has(contact.id);
                          return (
                            <tr key={contact.id} className={`transition-colors group ${isSelected ? "bg-primary/5" : "hover:bg-surface-bright/30"}`}>
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelect(contact.id)}
                                  className="rounded border-outline bg-background text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
                                />
                              </td>
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
                              <td className="px-4 py-3">
                                <span className="text-sm font-mono text-on-surface-variant">{formatPhone(contact.phone)}</span>
                              </td>
                              <td className="px-4 py-3 hidden xl:table-cell">
                                <span className="text-xs text-secondary">{[contact.city, contact.state].filter(Boolean).join("/") || "-"}</span>
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell">
                                <span className="text-xs text-secondary truncate block max-w-[120px]">{contact.organization || "-"}</span>
                              </td>
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
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {contact.is_blacklisted ? (
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-error-container text-on-error-container border border-error/20">BLOQUEADO</span>
                                ) : !contact.is_valid ? (
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-error/10 text-error border border-error/20 flex items-center gap-1 w-fit">
                                    <span className="w-1.5 h-1.5 rounded-full bg-error" /> INVÁLIDO
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-tertiary/10 text-tertiary border border-tertiary/20 flex items-center gap-1 w-fit">
                                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary" /> VÁLIDO
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      if (confirm(`Remover ${contact.display_name} do grupo?`))
                                        removeFromGroup.mutate([contact.id]);
                                    }}
                                    className="p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-error"
                                    title="Remover do grupo"
                                  >
                                    <span className="material-symbols-outlined text-lg">person_remove</span>
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
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-outline-variant gap-3">
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-secondary">
                        Página {page} de {totalPages} ({filteredContacts.length} contatos)
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
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (page <= 3) pageNum = i + 1;
                        else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = page - 2 + i;
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
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-3 py-1.5 text-xs bg-surface-container-high border border-outline-variant rounded hover:bg-surface-bright disabled:opacity-30 transition-all"
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
