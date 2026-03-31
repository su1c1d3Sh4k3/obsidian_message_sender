import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
export default function EditContactModal({ open, onClose, contact }) {
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
    const [selectedTagIds, setSelectedTagIds] = useState([]);
    const [newTagName, setNewTagName] = useState("");
    const [creatingTag, setCreatingTag] = useState(false);
    const { data: tags = [] } = useQuery({
        queryKey: ["tags"],
        queryFn: () => api.get("/tags"),
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
    function update(field, value) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }
    function toggleTag(tagId) {
        setSelectedTagIds((prev) => prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]);
    }
    const createTagMutation = useMutation({
        mutationFn: (name) => api.post("/tags", { name, color: "#a78bfa" }),
        onSuccess: (tag) => {
            queryClient.invalidateQueries({ queryKey: ["tags"] });
            setSelectedTagIds((prev) => [...prev, tag.id]);
            setNewTagName("");
            setCreatingTag(false);
            toast.success(`Tag "${tag.name}" criada`);
        },
        onError: (err) => toast.error(err.message),
    });
    const mutation = useMutation({
        mutationFn: async () => {
            if (!contact)
                return;
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
        onError: (err) => toast.error(err.message),
    });
    if (!open || !contact)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-[60] flex items-center justify-center", children: [_jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-sm", onClick: onClose }), _jsxs("div", { className: "relative bg-surface-container border border-outline-variant rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b border-outline-variant sticky top-0 bg-surface-container z-10", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 bg-primary/10 rounded-lg", children: _jsx("span", { className: "material-symbols-outlined text-primary", children: "edit" }) }), _jsx("h3", { className: "font-bold text-lg", children: "Editar Contato" })] }), _jsx("button", { onClick: onClose, className: "p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-on-surface", children: _jsx("span", { className: "material-symbols-outlined", children: "close" }) })] }), _jsxs("form", { onSubmit: (e) => { e.preventDefault(); mutation.mutate(); }, className: "p-6 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Primeiro Nome" }), _jsx("input", { value: form.first_name, onChange: (e) => update("first_name", e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface", placeholder: "Jo\u00E3o" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Sobrenome" }), _jsx("input", { value: form.last_name, onChange: (e) => update("last_name", e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface", placeholder: "Silva" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Telefone (WhatsApp)" }), _jsxs("div", { className: "relative", children: [_jsx("span", { className: "absolute left-4 top-1/2 -translate-y-1/2 text-secondary text-sm font-mono", children: "+55" }), _jsx("input", { value: form.phone, onChange: (e) => update("phone", e.target.value), className: "w-full bg-background border border-outline-variant rounded pl-12 pr-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none font-mono text-on-surface", placeholder: "31 99999-9999" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Tags" }), _jsxs("div", { className: "flex flex-wrap gap-2 p-3 bg-background border border-outline-variant rounded min-h-[46px]", children: [tags.filter((t) => selectedTagIds.includes(t.id)).map((tag) => (_jsxs("span", { className: "bg-primary-container/20 text-primary px-2 py-1 rounded text-xs font-medium border border-primary/30 flex items-center gap-1", children: [tag.name, _jsx("button", { type: "button", onClick: () => toggleTag(tag.id), children: _jsx("span", { className: "material-symbols-outlined text-[14px] cursor-pointer hover:text-error", children: "close" }) })] }, tag.id))), tags.filter((t) => !selectedTagIds.includes(t.id)).length > 0 && (_jsxs("select", { value: "", onChange: (e) => { if (e.target.value)
                                                    toggleTag(e.target.value); }, className: "bg-transparent border-none p-0 text-xs focus:ring-0 text-secondary cursor-pointer outline-none", children: [_jsx("option", { value: "", children: "+ Adicionar tag..." }), tags.filter((t) => !selectedTagIds.includes(t.id)).map((t) => (_jsx("option", { value: t.id, children: t.name }, t.id)))] }))] }), creatingTag ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { value: newTagName, onChange: (e) => setNewTagName(e.target.value), onKeyDown: (e) => { if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    createTagMutation.mutate(newTagName.trim());
                                                } }, className: "flex-1 bg-background border border-outline-variant rounded px-3 py-1.5 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary", placeholder: "Nome da nova tag...", autoFocus: true }), _jsx("button", { type: "button", onClick: () => createTagMutation.mutate(newTagName.trim()), disabled: createTagMutation.isPending || !newTagName.trim(), className: "px-3 py-1.5 bg-primary text-on-primary rounded text-xs font-bold hover:opacity-90 disabled:opacity-50", children: "Criar" }), _jsx("button", { type: "button", onClick: () => { setCreatingTag(false); setNewTagName(""); }, className: "p-1 text-secondary hover:text-on-surface", children: _jsx("span", { className: "material-symbols-outlined text-lg", children: "close" }) })] })) : (_jsxs("button", { type: "button", onClick: () => setCreatingTag(true), className: "text-xs text-primary hover:underline flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-sm", children: "add" }), " Criar nova tag"] }))] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Empresa" }), _jsx("input", { value: form.organization, onChange: (e) => update("organization", e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface", placeholder: "Empresa Ltda" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Email" }), _jsx("input", { type: "email", value: form.email, onChange: (e) => update("email", e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface", placeholder: "email@exemplo.com" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Cidade" }), _jsx("input", { value: form.city, onChange: (e) => update("city", e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface", placeholder: "Belo Horizonte" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Estado" }), _jsx("input", { value: form.state, onChange: (e) => update("state", e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface", placeholder: "MG", maxLength: 2 })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Notas" }), _jsx("textarea", { value: form.notes, onChange: (e) => update("notes", e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none resize-none text-on-surface", placeholder: "Observa\u00E7\u00F5es sobre o contato...", rows: 2 })] }), _jsxs("div", { className: "flex justify-end gap-3 pt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all", children: "Cancelar" }), _jsxs("button", { type: "submit", disabled: mutation.isPending, className: "px-6 py-2.5 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "save" }), mutation.isPending ? "Salvando..." : "Salvar Alterações"] })] })] })] })] }));
}
//# sourceMappingURL=EditContactModal.js.map