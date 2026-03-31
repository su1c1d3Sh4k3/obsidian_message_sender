import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";

const ADMIN_EMAIL = "suicideshake@gmail.com";

interface DashboardData {
  totalTenants: number;
  totalContacts: number;
  totalCampaigns: number;
  totalSent: number;
  totalFailed: number;
  totalSenders: number;
  connectedSenders: number;
}

interface ClientSender {
  id: string;
  name: string;
  phone: string;
  status: string;
}

interface ClientUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Client {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
  users: ClientUser[];
  contactCount: number;
  campaignCount: number;
  campaignsByStatus: Record<string, number>;
  totalSent: number;
  totalFailed: number;
  senders: ClientSender[];
}

const senderStatusColors: Record<string, string> = {
  connected: "text-tertiary bg-tertiary/10",
  connecting: "text-yellow-400 bg-yellow-500/10",
  disconnected: "text-secondary bg-secondary-container",
};

export default function Admin() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  // Wait for auth to load
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-primary text-lg">Carregando...</div>
      </div>
    );
  }

  // Gate: only admin
  if (user?.email !== ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return <AdminContent queryClient={queryClient} />;
}

function AdminContent({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const { data: dashboard } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.get<DashboardData>("/admin/dashboard"),
    refetchInterval: 30000,
  });

  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => api.get<Client[]>("/admin/clients"),
    refetchInterval: 30000,
  });

  const stats = [
    { label: "Clientes", value: dashboard?.totalTenants ?? 0, icon: "groups", color: "text-primary" },
    { label: "Contatos", value: dashboard?.totalContacts ?? 0, icon: "contacts", color: "text-tertiary" },
    { label: "Campanhas", value: dashboard?.totalCampaigns ?? 0, icon: "campaign", color: "text-yellow-400" },
    { label: "Enviadas", value: dashboard?.totalSent ?? 0, icon: "check_circle", color: "text-tertiary" },
    { label: "Falhas", value: dashboard?.totalFailed ?? 0, icon: "error", color: "text-error" },
    { label: "Instâncias", value: `${dashboard?.connectedSenders ?? 0}/${dashboard?.totalSenders ?? 0}`, icon: "phone_android", color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">admin_panel_settings</span>
            <h2 className="text-2xl font-bold tracking-tight">Painel Admin</h2>
          </div>
          <p className="text-secondary mt-1">Gerenciamento de clientes e visão geral do sistema.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          Cadastrar Cliente
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface-container border border-outline-variant rounded-xl p-4 text-center">
            <span className={`material-symbols-outlined text-2xl ${s.color}`}>{s.icon}</span>
            <p className="text-xl font-black mt-1">{s.value}</p>
            <p className="text-[10px] text-secondary uppercase tracking-wider font-semibold">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Clients List */}
      <div className="space-y-3">
        <h3 className="font-bold text-lg">Clientes Cadastrados</h3>

        {isLoading ? (
          <div className="bg-surface-container border border-outline-variant rounded-xl p-12 text-center text-secondary">Carregando...</div>
        ) : !clients?.length ? (
          <div className="bg-surface-container border border-outline-variant rounded-xl p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-secondary mb-3 block">groups</span>
            <p className="text-secondary">Nenhum cliente cadastrado</p>
          </div>
        ) : (
          clients.map((client) => {
            const isExpanded = expandedClient === client.id;
            const connectedCount = client.senders.filter((s) => s.status === "connected").length;

            return (
              <div key={client.id} className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-surface-bright/30 transition-colors"
                  onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary">business</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold truncate">{client.name}</p>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {client.plan}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-[11px] text-secondary">
                      <span>{client.users[0]?.email ?? "—"}</span>
                      <span>Desde {new Date(client.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="hidden md:flex items-center gap-5 text-xs text-secondary">
                    <div className="text-center">
                      <p className="font-black text-on-surface">{client.contactCount}</p>
                      <p className="text-[9px]">Contatos</p>
                    </div>
                    <div className="text-center">
                      <p className="font-black text-on-surface">{client.campaignCount}</p>
                      <p className="text-[9px]">Campanhas</p>
                    </div>
                    <div className="text-center">
                      <p className="font-black text-tertiary">{client.totalSent}</p>
                      <p className="text-[9px]">Enviadas</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-black ${connectedCount > 0 ? "text-tertiary" : "text-secondary"}`}>
                        {connectedCount}/{client.senders.length}
                      </p>
                      <p className="text-[9px]">Instâncias</p>
                    </div>
                  </div>

                  <span className={`material-symbols-outlined text-secondary transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                    expand_more
                  </span>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-outline-variant px-5 py-4 space-y-4">
                    {/* Users */}
                    <div>
                      <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">Usuários</p>
                      <div className="flex flex-wrap gap-2">
                        {client.users.map((u) => (
                          <div key={u.id} className="flex items-center gap-2 bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2">
                            <span className="material-symbols-outlined text-sm text-primary">person</span>
                            <div>
                              <p className="text-xs font-medium">{u.name}</p>
                              <p className="text-[10px] text-secondary">{u.email} · {u.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Senders/Instances */}
                    <div>
                      <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">Instâncias WhatsApp</p>
                      {client.senders.length === 0 ? (
                        <p className="text-xs text-secondary">Nenhuma instância cadastrada</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {client.senders.map((s) => (
                            <div key={s.id} className="flex items-center gap-2 bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2">
                              <span className="material-symbols-outlined text-sm text-primary">phone_android</span>
                              <div>
                                <p className="text-xs font-medium">{s.name}</p>
                                <p className="text-[10px] text-secondary">{s.phone ? `+${s.phone}` : "Sem número"}</p>
                              </div>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${senderStatusColors[s.status] ?? "text-secondary bg-secondary-container"}`}>
                                {s.status === "connected" ? "ON" : s.status === "connecting" ? "..." : "OFF"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Campaign Stats */}
                    <div>
                      <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">Campanhas</p>
                      <div className="flex flex-wrap gap-3 text-xs">
                        {Object.entries(client.campaignsByStatus).map(([status, count]) => (
                          <span key={status} className="bg-surface-container-high border border-outline-variant rounded px-2 py-1">
                            <span className="text-secondary">{status}:</span> <span className="font-bold">{count}</span>
                          </span>
                        ))}
                        <span className="bg-tertiary/10 border border-tertiary/20 text-tertiary rounded px-2 py-1">
                          Enviadas: <span className="font-bold">{client.totalSent}</span>
                        </span>
                        {client.totalFailed > 0 && (
                          <span className="bg-error/10 border border-error/20 text-error rounded px-2 py-1">
                            Falhas: <span className="font-bold">{client.totalFailed}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Client Modal */}
      {showCreateModal && (
        <CreateClientModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
            queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ Create Client Modal ═══════════════════════ */

function CreateClientModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    companyName: "",
    name: "",
    email: "",
    password: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post("/auth/register", data),
    onSuccess: () => {
      toast.success("Cliente cadastrado com sucesso!");
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 6) return toast.error("Senha deve ter no mínimo 6 caracteres");
    createMutation.mutate(form);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container border border-outline-variant rounded-xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <span className="material-symbols-outlined text-primary">person_add</span>
            </div>
            <h3 className="font-bold text-lg">Cadastrar Cliente</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Nome da Empresa</label>
            <input
              value={form.companyName}
              onChange={(e) => update("companyName", e.target.value)}
              className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface"
              placeholder="Empresa do Cliente"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Nome do Usuário</label>
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface"
              placeholder="João Silva"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface"
              placeholder="cliente@email.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Senha</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm outline-none text-on-surface"
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={createMutation.isPending} className="px-6 py-2.5 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2">
              {createMutation.isPending ? (
                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-lg">person_add</span>
              )}
              {createMutation.isPending ? "Criando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
