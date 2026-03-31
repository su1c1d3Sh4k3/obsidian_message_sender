import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
export default function CreateGroupModal({ open, onClose, selectedIds }) {
    const queryClient = useQueryClient();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const mutation = useMutation({
        mutationFn: async () => {
            // 1. Create list
            const list = await api.post("/lists", { name, description });
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
        onError: (err) => toast.error(err.message),
    });
    if (!open)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-[60] flex items-center justify-center", children: [_jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-sm", onClick: onClose }), _jsxs("div", { className: "relative bg-surface-container border border-outline-variant rounded-xl w-full max-w-md mx-4 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b border-outline-variant", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 bg-tertiary/10 rounded-lg", children: _jsx("span", { className: "material-symbols-outlined text-tertiary", children: "group_add" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-lg", children: "Criar Grupo" }), _jsxs("p", { className: "text-[10px] text-secondary", children: [selectedIds.length, " contatos selecionados"] })] })] }), _jsx("button", { onClick: onClose, className: "p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-on-surface", children: _jsx("span", { className: "material-symbols-outlined", children: "close" }) })] }), _jsxs("form", { onSubmit: (e) => { e.preventDefault(); mutation.mutate(); }, className: "p-6 space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Nome do Grupo" }), _jsx("input", { value: name, onChange: (e) => setName(e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface", placeholder: "Ex: Leads BH - Mar\u00E7o", required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Descri\u00E7\u00E3o (opcional)" }), _jsx("textarea", { value: description, onChange: (e) => setDescription(e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none resize-none text-on-surface", placeholder: "Descri\u00E7\u00E3o do grupo...", rows: 2 })] }), _jsxs("div", { className: "flex justify-end gap-3 pt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all", children: "Cancelar" }), _jsxs("button", { type: "submit", disabled: mutation.isPending, className: "px-6 py-2.5 bg-tertiary text-on-tertiary rounded font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "group_add" }), mutation.isPending ? "Criando..." : "Criar Grupo"] })] })] })] })] }));
}
//# sourceMappingURL=CreateGroupModal.js.map