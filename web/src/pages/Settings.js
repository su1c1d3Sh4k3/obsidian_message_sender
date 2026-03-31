import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
export default function Settings() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    /* ── Change Password ── */
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPasswords, setShowPasswords] = useState(false);
    const passwordMutation = useMutation({
        mutationFn: (data) => api.post("/settings/change-password", data),
        onSuccess: () => {
            toast.success("Senha alterada com sucesso!");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        },
        onError: (err) => toast.error(err.message),
    });
    function handleChangePassword() {
        if (!currentPassword)
            return toast.error("Informe a senha atual");
        if (newPassword.length < 6)
            return toast.error("Nova senha deve ter no mínimo 6 caracteres");
        if (newPassword !== confirmPassword)
            return toast.error("As senhas não coincidem");
        passwordMutation.mutate({ currentPassword, newPassword });
    }
    /* ── Notifications ── */
    const { data: senders } = useQuery({
        queryKey: ["senders"],
        queryFn: () => api.get("/senders"),
    });
    const { data: notifSettings } = useQuery({
        queryKey: ["notification-settings"],
        queryFn: () => api.get("/settings/notifications"),
    });
    const connectedSenders = (senders ?? []).filter((s) => s.status === "connected");
    const [notifyEnabled, setNotifyEnabled] = useState(false);
    const [notifyPhone, setNotifyPhone] = useState("");
    const [notifySenderId, setNotifySenderId] = useState(null);
    const [notifLoaded, setNotifLoaded] = useState(false);
    useEffect(() => {
        if (!notifSettings || notifLoaded)
            return;
        setNotifyEnabled(notifSettings.notify_enabled);
        setNotifyPhone(notifSettings.notify_phone);
        setNotifySenderId(notifSettings.notify_sender_id);
        setNotifLoaded(true);
    }, [notifSettings, notifLoaded]);
    const notifMutation = useMutation({
        mutationFn: (data) => api.put("/settings/notifications", data),
        onSuccess: () => {
            toast.success("Configurações de notificação salvas!");
            queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
        },
        onError: (err) => toast.error(err.message),
    });
    function handleSaveNotifications() {
        if (notifyEnabled && !notifyPhone)
            return toast.error("Informe o número para notificação");
        if (notifyEnabled && !notifySenderId)
            return toast.error("Selecione um remetente");
        notifMutation.mutate({
            notify_enabled: notifyEnabled,
            notify_phone: notifyPhone,
            notify_sender_id: notifySenderId,
        });
    }
    function formatPhoneInput(value) {
        // Keep only digits
        const digits = value.replace(/\D/g, "");
        // Limit to 13 digits (55 + DDD + number)
        return digits.slice(0, 13);
    }
    function displayPhone(raw) {
        if (!raw)
            return "";
        const d = raw.replace(/\D/g, "");
        if (d.length <= 2)
            return `+${d}`;
        if (d.length <= 4)
            return `+${d.slice(0, 2)} (${d.slice(2)}`;
        if (d.length <= 9)
            return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4)}`;
        return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9, 13)}`;
    }
    /* ── Render ── */
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold tracking-tight", children: "Configura\u00E7\u00F5es" }), _jsx("p", { className: "text-secondary mt-1", children: "Gerencie sua conta e prefer\u00EAncias." })] }), _jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 bg-primary/10 rounded-lg", children: _jsx("span", { className: "material-symbols-outlined text-primary", children: "person" }) }), _jsx("h3", { className: "font-bold text-lg", children: "Perfil" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Nome" }), _jsx("input", { className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface", defaultValue: user?.name, readOnly: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Email" }), _jsx("input", { className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface", defaultValue: user?.email, readOnly: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Cargo" }), _jsx("input", { className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface capitalize", defaultValue: user?.role, readOnly: true })] })] })] }), _jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 bg-primary/10 rounded-lg", children: _jsx("span", { className: "material-symbols-outlined text-primary", children: "lock" }) }), _jsx("h3", { className: "font-bold text-lg", children: "Alterar Senha" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Senha Atual" }), _jsx("div", { className: "relative", children: _jsx("input", { type: showPasswords ? "text" : "password", value: currentPassword, onChange: (e) => setCurrentPassword(e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent pr-10", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022" }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Nova Senha" }), _jsx("input", { type: showPasswords ? "text" : "password", value: newPassword, onChange: (e) => setNewPassword(e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent", placeholder: "M\u00EDnimo 6 caracteres" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Confirmar Nova Senha" }), _jsx("input", { type: showPasswords ? "text" : "password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent", placeholder: "Repita a nova senha" })] })] }), _jsxs("div", { className: "flex items-center justify-between pt-2", children: [_jsxs("label", { className: "flex items-center gap-2 cursor-pointer text-xs text-secondary", children: [_jsx("input", { type: "checkbox", checked: showPasswords, onChange: (e) => setShowPasswords(e.target.checked), className: "rounded border-outline-variant" }), "Mostrar senhas"] }), _jsxs("button", { onClick: handleChangePassword, disabled: passwordMutation.isPending, className: "px-6 py-2.5 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2", children: [passwordMutation.isPending ? (_jsx("span", { className: "material-symbols-outlined text-lg animate-spin", children: "progress_activity" })) : (_jsx("span", { className: "material-symbols-outlined text-lg", children: "lock_reset" })), "Alterar Senha"] })] })] }), _jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-6 space-y-5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 bg-tertiary/10 rounded-lg", children: _jsx("span", { className: "material-symbols-outlined text-tertiary", children: "notifications" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-lg", children: "Notifique-me" }), _jsx("p", { className: "text-xs text-secondary mt-0.5", children: "Receba um relat\u00F3rio via WhatsApp ao finalizar uma campanha." })] })] }), _jsx("button", { onClick: () => setNotifyEnabled(!notifyEnabled), className: `relative w-12 h-6 rounded-full transition-colors ${notifyEnabled ? "bg-tertiary" : "bg-outline-variant"}`, children: _jsx("div", { className: `absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notifyEnabled ? "translate-x-6" : "translate-x-0.5"}` }) })] }), notifyEnabled && (_jsxs("div", { className: "space-y-4 pt-2 border-t border-outline-variant", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "N\u00FAmero para Notifica\u00E7\u00E3o" }), _jsx("div", { className: "relative", children: _jsx("input", { value: displayPhone(notifyPhone), onChange: (e) => setNotifyPhone(formatPhoneInput(e.target.value)), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent font-mono tracking-wider", placeholder: "+55 (31) 99999-9999" }) }), _jsx("p", { className: "text-[10px] text-secondary", children: "Formato: +55 + DDD + n\u00FAmero" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Enviar via (Remetente)" }), _jsxs("select", { value: notifySenderId ?? "", onChange: (e) => setNotifySenderId(e.target.value || null), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent", children: [_jsx("option", { value: "", children: "Selecione um remetente" }), connectedSenders.map((s) => (_jsxs("option", { value: s.id, children: [s.name, " ", s.phone ? `(+${s.phone})` : ""] }, s.id)))] }), connectedSenders.length === 0 && (_jsx("p", { className: "text-[10px] text-error", children: "Nenhum remetente conectado. Conecte um n\u00FAmero na p\u00E1gina de Remetentes." }))] })] }), _jsxs("div", { className: "bg-surface-container-high/50 border border-outline-variant rounded-xl p-4", children: [_jsxs("p", { className: "text-xs font-bold text-secondary mb-2 flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-sm", children: "preview" }), "Preview da notifica\u00E7\u00E3o:"] }), _jsx("div", { className: "bg-[#005c4b] rounded-lg px-3 py-2 text-[12px] text-white/90 leading-relaxed whitespace-pre-line max-w-sm font-mono", children: `📊 *Relatório de Campanha*

*Campanha:* Nome da campanha
*Status:* Finalizada ✅

📈 *Resultados:*
• Total de contatos: 150
• Enviadas com sucesso: 145 ✅
• Erros no envio: 5 ❌
• Taxa de sucesso: 96.7%

⏱️ *Duração:* 38min 22s` })] }), _jsx("div", { className: "flex justify-end", children: _jsxs("button", { onClick: handleSaveNotifications, disabled: notifMutation.isPending, className: "px-6 py-2.5 bg-tertiary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2", children: [notifMutation.isPending ? (_jsx("span", { className: "material-symbols-outlined text-lg animate-spin", children: "progress_activity" })) : (_jsx("span", { className: "material-symbols-outlined text-lg", children: "save" })), "Salvar Notifica\u00E7\u00F5es"] }) })] }))] })] }));
}
//# sourceMappingURL=Settings.js.map