import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

/* ── Types ── */
interface Sender {
  id: string;
  name: string;
  phone: string;
  status: string;
  uzapi_instance_id: string;
  last_seen_at: string | null;
  created_at: string;
  settings: { pin_code?: string; instance_name?: string } | null;
}

const statusConfig: Record<string, { class: string; label: string; icon: string }> = {
  connected: { class: "text-tertiary bg-tertiary/10 border-tertiary/20", label: "Conectado", icon: "check_circle" },
  connecting: { class: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", label: "Conectando...", icon: "sync" },
  disconnected: { class: "text-secondary bg-secondary-container border-outline", label: "Desconectado", icon: "cancel" },
  banned: { class: "text-on-error-container bg-error-container border-error/20", label: "Banido", icon: "block" },
};

/* ── Component ── */
export default function Senders() {
  const queryClient = useQueryClient();

  // State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [connectingSenderId, setConnectingSenderId] = useState<string | null>(null);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [newName, setNewName] = useState("");
  const [pollingId, setPollingId] = useState<string | null>(null);

  // Queries
  const { data: senders = [], isLoading } = useQuery({
    queryKey: ["senders"],
    queryFn: () => api.get<Sender[]>("/senders"),
    refetchInterval: pollingId ? 3000 : 15000,
  });

  // Polling: check status on the connecting instance every 3s
  useEffect(() => {
    if (!pollingId) return;

    const interval = setInterval(async () => {
      try {
        const result = await api.post<{ status: string }>(`/senders/${pollingId}/check-status`);
        queryClient.invalidateQueries({ queryKey: ["senders"] });

        if (result.status === "connected") {
          clearInterval(interval);
          setPollingId(null);
          setConnectingSenderId(null);
          setPairCode(null);
          setPhoneInput("");
          toast.success("WhatsApp conectado!");
        }
      } catch {
        // ignora erros de polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pollingId, queryClient]);

  // Create instance
  const createMutation = useMutation({
    mutationFn: (name: string) => api.post<Sender>("/senders/create-instance", { name }),
    onSuccess: (data) => {
      toast.success("Instância criada!");
      queryClient.invalidateQueries({ queryKey: ["senders"] });
      setShowCreateModal(false);
      setNewName("");
      // Open connect dialog automatically
      setConnectingSenderId(data.id);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Connect (pair code)
  const connectMutation = useMutation({
    mutationFn: ({ id, phone }: { id: string; phone: string }) =>
      api.post<{ pairCode: string }>(`/senders/${id}/connect`, { phone }),
    onSuccess: (data) => {
      setPairCode(data.pairCode);
      if (connectingSenderId) setPollingId(connectingSenderId);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Disconnect
  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/senders/${id}/disconnect`),
    onSuccess: () => {
      toast.success("WhatsApp desconectado");
      queryClient.invalidateQueries({ queryKey: ["senders"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/senders/${id}`),
    onSuccess: () => {
      toast.success("Remetente excluído");
      queryClient.invalidateQueries({ queryKey: ["senders"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Manual check status
  const checkMutation = useMutation({
    mutationFn: (id: string) => api.post<{ status: string }>(`/senders/${id}/check-status`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["senders"] });
      toast.success(`Status: ${statusConfig[data.status]?.label ?? data.status}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function formatPairCode(code: string) {
    if (code.length === 8) return `${code.slice(0, 4)}-${code.slice(4)}`;
    return code;
  }

  const connectingSender = senders.find((s) => s.id === connectingSenderId);

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Remetentes</h2>
          <p className="text-secondary mt-1">Conecte números WhatsApp via Uazapi para envio de campanhas.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Nova Instância
        </button>
      </div>

      {/* Senders list */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="text-secondary col-span-full text-center py-12">Carregando...</p>
        ) : senders.length === 0 ? (
          <div className="col-span-full bg-surface-container border border-outline-variant rounded-xl p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-secondary mb-3 block">phone_android</span>
            <p className="text-secondary">Nenhum remetente cadastrado</p>
            <p className="text-xs text-secondary mt-1">Clique em "Nova Instância" para conectar um número WhatsApp.</p>
          </div>
        ) : (
          senders.map((sender) => {
            const badge = statusConfig[sender.status] ?? statusConfig.disconnected;
            const isConnected = sender.status === "connected";
            const isConnecting = sender.status === "connecting";

            return (
              <div key={sender.id} className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
                {/* Card header */}
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isConnected ? "bg-tertiary/20" : "bg-surface-container-highest"}`}>
                        <span className={`material-symbols-outlined ${isConnected ? "text-tertiary" : "text-secondary"}`}>
                          phone_android
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-sm">{sender.name}</p>
                        {sender.phone && (
                          <p className="text-[11px] text-secondary font-mono">+{sender.phone}</p>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full border flex items-center gap-1 ${badge.class}`}>
                      <span className={`material-symbols-outlined text-[12px] ${isConnecting ? "animate-spin" : ""}`}>{badge.icon}</span>
                      {badge.label}
                    </span>
                  </div>

                  {/* Connection indicator */}
                  {isConnected && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-tertiary/5 border border-tertiary/10 rounded-lg">
                      <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                      <span className="text-[11px] text-tertiary font-medium">WhatsApp ativo</span>
                      {sender.last_seen_at && (
                        <span className="text-[10px] text-secondary ml-auto">
                          {new Date(sender.last_seen_at).toLocaleString("pt-BR")}
                        </span>
                      )}
                    </div>
                  )}

                  {isConnecting && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/5 border border-yellow-500/10 rounded-lg">
                      <span className="material-symbols-outlined text-yellow-400 text-sm animate-spin">sync</span>
                      <span className="text-[11px] text-yellow-400 font-medium">Aguardando pareamento...</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-5 pb-4 flex flex-wrap gap-2">
                  {!isConnected && (
                    <button
                      onClick={() => {
                        setConnectingSenderId(sender.id);
                        setPairCode((sender.settings as { pin_code?: string })?.pin_code ?? null);
                        setPhoneInput(sender.phone || "");
                      }}
                      className="flex-1 px-3 py-2 text-xs font-medium bg-primary/10 border border-primary/20 text-primary rounded hover:bg-primary/20 transition-all flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">link</span>
                      Conectar
                    </button>
                  )}

                  <button
                    onClick={() => checkMutation.mutate(sender.id)}
                    disabled={checkMutation.isPending}
                    className="px-3 py-2 text-xs font-medium bg-surface-container-high border border-outline-variant text-on-surface rounded hover:bg-surface-bright transition-all flex items-center gap-1 disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-sm ${checkMutation.isPending ? "animate-spin" : ""}`}>sync</span>
                    Verificar
                  </button>

                  {isConnected && (
                    <button
                      onClick={() => { if (confirm("Desconectar este WhatsApp?")) disconnectMutation.mutate(sender.id); }}
                      className="px-3 py-2 text-xs font-medium bg-surface-container-high border border-outline-variant text-secondary rounded hover:bg-surface-bright hover:text-yellow-400 transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">link_off</span>
                      Desconectar
                    </button>
                  )}

                  <button
                    onClick={() => { if (confirm(`Excluir "${sender.name}"? Esta ação é irreversível.`)) deleteMutation.mutate(sender.id); }}
                    className="px-3 py-2 text-xs font-medium bg-surface-container-high border border-outline-variant text-secondary rounded hover:bg-error/10 hover:text-error hover:border-error/20 transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ═══════ Create Instance Modal ═══════ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-surface-container border border-outline-variant rounded-xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <span className="material-symbols-outlined text-primary">add_circle</span>
                </div>
                <h3 className="font-bold text-lg">Nova Instância WhatsApp</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createMutation.mutate(newName.trim()); }}
              className="p-6 space-y-4"
            >
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Nome da Instância</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface"
                  placeholder="Ex: Comercial 1, Marketing, Suporte"
                  autoFocus
                  required
                />
                <p className="text-[10px] text-secondary">Este nome identifica o número na plataforma.</p>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={createMutation.isPending} className="px-6 py-2.5 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">add</span>
                  {createMutation.isPending ? "Criando..." : "Criar Instância"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ Connect Dialog (Pair Code) ═══════ */}
      {connectingSenderId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setConnectingSenderId(null);
              setPairCode(null);
              setPhoneInput("");
              setPollingId(null);
            }}
          />
          <div className="relative bg-surface-container border border-outline-variant rounded-xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-tertiary/10 rounded-lg">
                  <span className="material-symbols-outlined text-tertiary">smartphone</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg">Conectar WhatsApp</h3>
                  {connectingSender && (
                    <p className="text-[11px] text-secondary">{connectingSender.name}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setConnectingSenderId(null);
                  setPairCode(null);
                  setPhoneInput("");
                  setPollingId(null);
                }}
                className="p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {!pairCode ? (
                <>
                  {/* Step 1: Enter phone */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                      Número de telefone (com DDI)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary text-sm font-mono">+</span>
                      <input
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ""))}
                        className="w-full bg-background border border-outline-variant rounded pl-8 pr-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none font-mono text-on-surface text-lg tracking-wider"
                        placeholder="5531999999999"
                        autoFocus
                      />
                    </div>
                    <p className="text-[10px] text-secondary">Formato: DDI + DDD + número, sem espaços. Ex: 5531999999999</p>
                  </div>

                  <button
                    onClick={() => {
                      if (phoneInput.length < 10) return toast.error("Número inválido");
                      connectMutation.mutate({ id: connectingSenderId, phone: phoneInput });
                    }}
                    disabled={connectMutation.isPending}
                    className="w-full px-6 py-3 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {connectMutation.isPending ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                        Gerando código...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">qr_code_2</span>
                        Gerar Código de Pareamento
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  {/* Step 2: Show pair code */}
                  <div className="text-center space-y-4">
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                      <p className="text-xs text-secondary uppercase tracking-widest mb-3">Código de Pareamento</p>
                      <p className="text-4xl font-black font-mono tracking-[.3em] text-primary">
                        {formatPairCode(pairCode)}
                      </p>
                    </div>

                    {/* Instructions */}
                    <div className="bg-surface-container-high/50 border border-outline-variant rounded-xl p-4 text-left space-y-3">
                      <p className="text-xs font-bold text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-lg">info</span>
                        Como conectar:
                      </p>
                      <ol className="text-xs text-secondary space-y-2 pl-6 list-decimal">
                        <li>Abra o <span className="font-bold text-on-surface">WhatsApp</span> no celular</li>
                        <li>Vá em <span className="font-bold text-on-surface">Configurações → Aparelhos Vinculados</span></li>
                        <li>Toque em <span className="font-bold text-on-surface">"Vincular um Aparelho"</span></li>
                        <li>Selecione <span className="font-bold text-on-surface">"Vincular com número de telefone"</span></li>
                        <li>Digite o código: <span className="font-mono font-bold text-primary">{formatPairCode(pairCode)}</span></li>
                      </ol>
                    </div>

                    {/* Polling indicator */}
                    {pollingId && (
                      <div className="flex items-center justify-center gap-2 text-yellow-400">
                        <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                        <span className="text-xs font-medium">Aguardando conexão...</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setPairCode(null);
                        setPollingId(null);
                      }}
                      className="flex-1 px-4 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all"
                    >
                      Gerar Novo Código
                    </button>
                    <button
                      onClick={() => {
                        setConnectingSenderId(null);
                        setPairCode(null);
                        setPhoneInput("");
                        setPollingId(null);
                      }}
                      className="flex-1 px-4 py-2.5 bg-surface-container-high border border-outline-variant text-secondary rounded font-medium text-sm hover:bg-surface-bright transition-all"
                    >
                      Fechar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
