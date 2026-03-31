import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
}

export default function CreateGroupModal({ open, onClose, selectedIds }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      // 1. Create list
      const list = await api.post<{ id: string }>("/lists", { name, description });
      // 2. Add contacts to list
      await api.post("/contacts/bulk-action", {
        contact_ids: selectedIds,
        action: "add_to_list",
        list_id: list.id,
      });
      return list;
    },
    onSuccess: () => {
      toast.success(`Grupo "${name}" criado com ${selectedIds.length} contatos!`);
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setName("");
      setDescription("");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container border border-outline-variant rounded-xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-tertiary/10 rounded-lg">
              <span className="material-symbols-outlined text-tertiary">group_add</span>
            </div>
            <div>
              <h3 className="font-bold text-lg">Criar Grupo</h3>
              <p className="text-[10px] text-secondary">{selectedIds.length} contatos selecionados</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="p-6 space-y-4"
        >
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Nome do Grupo</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface"
              placeholder="Ex: Leads BH - Março"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Descrição (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none resize-none text-on-surface"
              placeholder="Descrição do grupo..."
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending} className="px-6 py-2.5 bg-tertiary text-on-tertiary rounded font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">group_add</span>
              {mutation.isPending ? "Criando..." : "Criar Grupo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
