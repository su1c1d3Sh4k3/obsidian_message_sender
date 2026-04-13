import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

interface List {
  id: string;
  name: string;
  contact_count: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
}

export default function AddToGroupModal({ open, onClose, selectedIds }: Props) {
  const queryClient = useQueryClient();
  const [selectedListId, setSelectedListId] = useState("");

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["lists"],
    queryFn: () => api.get<List[]>("/lists"),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/contacts/bulk-action", {
        contact_ids: selectedIds,
        action: "add_to_list",
        list_id: selectedListId,
      }),
    onSuccess: () => {
      const listName = lists.find((l) => l.id === selectedListId)?.name ?? "";
      toast.success(`${selectedIds.length} contatos adicionados ao grupo "${listName}"`);
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setSelectedListId("");
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
            <div className="p-2 bg-primary/10 rounded-lg">
              <span className="material-symbols-outlined text-primary">playlist_add</span>
            </div>
            <div>
              <h3 className="font-bold text-lg">Adicionar ao Grupo</h3>
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
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Selecione o Grupo</label>
            {isLoading ? (
              <p className="text-sm text-secondary py-2">Carregando grupos...</p>
            ) : lists.length === 0 ? (
              <p className="text-sm text-secondary py-2">Nenhum grupo criado ainda.</p>
            ) : (
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface"
                required
              >
                <option value="">Selecione...</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.contact_count} contatos)
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="text-[10px] text-secondary">Contatos já existentes no grupo serão ignorados.</p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !selectedListId}
              className="px-6 py-2.5 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">playlist_add</span>
              {mutation.isPending ? "Adicionando..." : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
