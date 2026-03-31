import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

interface Sender {
  id: string;
  name: string;
  phone: string;
  status: string;
}

interface NotificationSettings {
  notify_enabled: boolean;
  notify_phone: string;
  notify_sender_id: string | null;
}

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  /* ── Change Password ── */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  const passwordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post("/settings/change-password", data),
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleChangePassword() {
    if (!currentPassword) return toast.error("Informe a senha atual");
    if (newPassword.length < 6) return toast.error("Nova senha deve ter no mínimo 6 caracteres");
    if (newPassword !== confirmPassword) return toast.error("As senhas não coincidem");
    passwordMutation.mutate({ currentPassword, newPassword });
  }

  /* ── Notifications ── */
  const { data: senders } = useQuery({
    queryKey: ["senders"],
    queryFn: () => api.get<Sender[]>("/senders"),
  });

  const { data: notifSettings } = useQuery({
    queryKey: ["notification-settings"],
    queryFn: () => api.get<NotificationSettings>("/settings/notifications"),
  });

  const connectedSenders = (senders ?? []).filter((s) => s.status === "connected");

  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyPhone, setNotifyPhone] = useState("");
  const [notifySenderId, setNotifySenderId] = useState<string | null>(null);
  const [notifLoaded, setNotifLoaded] = useState(false);

  useEffect(() => {
    if (!notifSettings || notifLoaded) return;
    setNotifyEnabled(notifSettings.notify_enabled);
    setNotifyPhone(notifSettings.notify_phone);
    setNotifySenderId(notifSettings.notify_sender_id);
    setNotifLoaded(true);
  }, [notifSettings, notifLoaded]);

  const notifMutation = useMutation({
    mutationFn: (data: NotificationSettings) =>
      api.put("/settings/notifications", data),
    onSuccess: () => {
      toast.success("Configurações de notificação salvas!");
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSaveNotifications() {
    if (notifyEnabled && !notifyPhone) return toast.error("Informe o número para notificação");
    if (notifyEnabled && !notifySenderId) return toast.error("Selecione um remetente");
    notifMutation.mutate({
      notify_enabled: notifyEnabled,
      notify_phone: notifyPhone,
      notify_sender_id: notifySenderId,
    });
  }

  function formatPhoneInput(value: string) {
    // Keep only digits
    const digits = value.replace(/\D/g, "");
    // Limit to 13 digits (55 + DDD + number)
    return digits.slice(0, 13);
  }

  function displayPhone(raw: string) {
    if (!raw) return "";
    const d = raw.replace(/\D/g, "");
    if (d.length <= 2) return `+${d}`;
    if (d.length <= 4) return `+${d.slice(0, 2)} (${d.slice(2)}`;
    if (d.length <= 9) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4)}`;
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9, 13)}`;
  }

  /* ── Render ── */
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
        <p className="text-secondary mt-1">Gerencie sua conta e preferências.</p>
      </div>

      {/* Profile (read-only) */}
      <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <span className="material-symbols-outlined text-primary">person</span>
          </div>
          <h3 className="font-bold text-lg">Perfil</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Nome</label>
            <input className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface" defaultValue={user?.name} readOnly />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Email</label>
            <input className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface" defaultValue={user?.email} readOnly />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Cargo</label>
            <input className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface capitalize" defaultValue={user?.role} readOnly />
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <span className="material-symbols-outlined text-primary">lock</span>
          </div>
          <h3 className="font-bold text-lg">Alterar Senha</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Senha Atual</label>
            <div className="relative">
              <input
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent pr-10"
                placeholder="••••••"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Nova Senha</label>
            <input
              type={showPasswords ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Confirmar Nova Senha</label>
            <input
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Repita a nova senha"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-secondary">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
              className="rounded border-outline-variant"
            />
            Mostrar senhas
          </label>
          <button
            onClick={handleChangePassword}
            disabled={passwordMutation.isPending}
            className="px-6 py-2.5 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {passwordMutation.isPending ? (
              <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-lg">lock_reset</span>
            )}
            Alterar Senha
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-tertiary/10 rounded-lg">
              <span className="material-symbols-outlined text-tertiary">notifications</span>
            </div>
            <div>
              <h3 className="font-bold text-lg">Notifique-me</h3>
              <p className="text-xs text-secondary mt-0.5">Receba um relatório via WhatsApp ao finalizar uma campanha.</p>
            </div>
          </div>

          {/* Switch */}
          <button
            onClick={() => setNotifyEnabled(!notifyEnabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${notifyEnabled ? "bg-tertiary" : "bg-outline-variant"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notifyEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>

        {notifyEnabled && (
          <div className="space-y-4 pt-2 border-t border-outline-variant">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                  Número para Notificação
                </label>
                <div className="relative">
                  <input
                    value={displayPhone(notifyPhone)}
                    onChange={(e) => setNotifyPhone(formatPhoneInput(e.target.value))}
                    className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent font-mono tracking-wider"
                    placeholder="+55 (31) 99999-9999"
                  />
                </div>
                <p className="text-[10px] text-secondary">Formato: +55 + DDD + número</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                  Enviar via (Remetente)
                </label>
                <select
                  value={notifySenderId ?? ""}
                  onChange={(e) => setNotifySenderId(e.target.value || null)}
                  className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 text-sm outline-none text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Selecione um remetente</option>
                  {connectedSenders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(+${s.phone})` : ""}
                    </option>
                  ))}
                </select>
                {connectedSenders.length === 0 && (
                  <p className="text-[10px] text-error">Nenhum remetente conectado. Conecte um número na página de Remetentes.</p>
                )}
              </div>
            </div>

            {/* Preview */}
            <div className="bg-surface-container-high/50 border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-bold text-secondary mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">preview</span>
                Preview da notificação:
              </p>
              <div className="bg-[#005c4b] rounded-lg px-3 py-2 text-[12px] text-white/90 leading-relaxed whitespace-pre-line max-w-sm font-mono">
{`📊 *Relatório de Campanha*

*Campanha:* Nome da campanha
*Status:* Finalizada ✅

📈 *Resultados:*
• Total de contatos: 150
• Enviadas com sucesso: 145 ✅
• Erros no envio: 5 ❌
• Taxa de sucesso: 96.7%

⏱️ *Duração:* 38min 22s`}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveNotifications}
                disabled={notifMutation.isPending}
                className="px-6 py-2.5 bg-tertiary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {notifMutation.isPending ? (
                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-lg">save</span>
                )}
                Salvar Notificações
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
