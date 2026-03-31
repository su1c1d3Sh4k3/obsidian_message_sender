import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  phone: string;
  email?: string | null;
  city: string | null;
  state: string | null;
  organization: string | null;
  notes?: string | null;
  contact_tags?: Array<{ tags: Tag }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  contact: Contact | null;
}

export default function EditContactModal({ open, onClose, contact }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    organization: "",
    city: "",
    state: "",
    notes: "",
  });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => api.get<Tag[]>("/tags"),
    enabled: open,
  });

  // Populate form when contact changes
  useEffect(() => {
    if (contact) {
      setForm({
        first_name: contact.first_name ?? "",
        last_name: contact.last_name ?? "",
        phone: contact.phone ?? "",
        email: contact.email ?? "",
        organization: contact.organization ?? "",
        city: contact.city ?? "",
        state: contact.state ?? "",
        notes: contact.notes ?? "",
      });
      setSelectedTagIds(contact.contact_tags?.map((ct) => ct.tags.id) ?? []);
    }
  }, [contact]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  const createTagMutation = useMutation({
    mutationFn: (name: string) => api.post<Tag>("/tags", { name, color: "#a78bfa" }),
    onSuccess: (tag) => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setSelectedTagIds((prev) => [...prev, tag.id]);
      setNewTagName("");
      setCreatingTag(false);
      toast.success(`Tag "${tag.name}" criada`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!contact) return;
      // Update contact fields
      await api.put(`/contacts/${contact.id}`, form);

      // Sync tags: remove old, add new
      const oldTagIds = contact.contact_tags?.map((ct) => ct.tags.id) ?? [];
      const toRemove = oldTagIds.filter((id) => !selectedTagIds.includes(id));
      const toAdd = selectedTagIds.filter((id) => !oldTagIds.includes(id));

      if (toRemove.length) {
        for (const tagId of toRemove) {
          await api.post("/contacts/bulk-action", { contact_ids: [contact.id], action: "remove_tag", tag_id: tagId });
        }
      }
      if (toAdd.length) {
        for (const tagId of toAdd) {
          await api.post("/contacts/bulk-action", { contact_ids: [contact.id], action: "add_tag", tag_id: tagId });
        }
      }
    },
    onSuccess: () => {
      toast.success("Contato atualizado!");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!open || !contact) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface-container border border-outline-variant rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant sticky top-0 bg-surface-container z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <span className="material-symbols-outlined text-primary">edit</span>
            </div>
            <h3 className="font-bold text-lg">Editar Contato</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="p-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Primeiro Nome</label>
              <input value={form.first_name} onChange={(e) => update("first_name", e.target.value)} className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface" placeholder="João" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Sobrenome</label>
              <input value={form.last_name} onChange={(e) => update("last_name", e.target.value)} className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface" placeholder="Silva" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Telefone (WhatsApp)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary text-sm font-mono">+55</span>
              <input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="w-full bg-background border border-outline-variant rounded pl-12 pr-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none font-mono text-on-surface" placeholder="31 99999-9999" />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Tags</label>
            <div className="flex flex-wrap gap-2 p-3 bg-background border border-outline-variant rounded min-h-[46px]">
              {tags.filter((t) => selectedTagIds.includes(t.id)).map((tag) => (
                <span key={tag.id} className="bg-primary-container/20 text-primary px-2 py-1 rounded text-xs font-medium border border-primary/30 flex items-center gap-1">
                  {tag.name}
                  <button type="button" onClick={() => toggleTag(tag.id)}>
                    <span className="material-symbols-outlined text-[14px] cursor-pointer hover:text-error">close</span>
                  </button>
                </span>
              ))}
              {tags.filter((t) => !selectedTagIds.includes(t.id)).length > 0 && (
                <select value="" onChange={(e) => { if (e.target.value) toggleTag(e.target.value); }} className="bg-transparent border-none p-0 text-xs focus:ring-0 text-secondary cursor-pointer outline-none">
                  <option value="">+ Adicionar tag...</option>
                  {tags.filter((t) => !selectedTagIds.includes(t.id)).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
            {creatingTag ? (
              <div className="flex items-center gap-2">
                <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createTagMutation.mutate(newTagName.trim()); } }} className="flex-1 bg-background border border-outline-variant rounded px-3 py-1.5 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary" placeholder="Nome da nova tag..." autoFocus />
                <button type="button" onClick={() => createTagMutation.mutate(newTagName.trim())} disabled={createTagMutation.isPending || !newTagName.trim()} className="px-3 py-1.5 bg-primary text-on-primary rounded text-xs font-bold hover:opacity-90 disabled:opacity-50">Criar</button>
                <button type="button" onClick={() => { setCreatingTag(false); setNewTagName(""); }} className="p-1 text-secondary hover:text-on-surface"><span className="material-symbols-outlined text-lg">close</span></button>
              </div>
            ) : (
              <button type="button" onClick={() => setCreatingTag(true)} className="text-xs text-primary hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">add</span> Criar nova tag
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Empresa</label>
              <input value={form.organization} onChange={(e) => update("organization", e.target.value)} className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface" placeholder="Empresa Ltda" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Email</label>
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface" placeholder="email@exemplo.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Cidade</label>
              <input value={form.city} onChange={(e) => update("city", e.target.value)} className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface" placeholder="Belo Horizonte" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Estado</label>
              <input value={form.state} onChange={(e) => update("state", e.target.value)} className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface" placeholder="MG" maxLength={2} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Notas</label>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none resize-none text-on-surface" placeholder="Observações sobre o contato..." rows={2} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="px-6 py-2.5 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">save</span>
              {mutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
