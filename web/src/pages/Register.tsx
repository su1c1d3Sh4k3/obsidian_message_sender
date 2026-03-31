import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getAuthHeaders } from "@/lib/api";
import toast from "react-hot-toast";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (form.password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          companyName: form.companyName,
        }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status}: ${res.statusText}`);
      }

      toast.success("Conta criada com sucesso! Faça login.");
      navigate("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-on-surface">Obsidian</h1>
          <p className="text-xs text-secondary font-medium uppercase tracking-widest mt-1">
            Precision MSGR
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 bg-surface-container border border-outline-variant rounded-xl p-8"
        >
          <h2 className="text-lg font-bold text-center">Criar Conta</h2>

          {/* Nome da Empresa */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Nome da Empresa
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg">
                business
              </span>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                className="w-full bg-background border border-outline-variant rounded pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all outline-none text-on-surface"
                placeholder="Minha Empresa Ltda"
                required
              />
            </div>
          </div>

          {/* Nome do Usuário */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Seu Nome
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg">
                person
              </span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="w-full bg-background border border-outline-variant rounded pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all outline-none text-on-surface"
                placeholder="João Silva"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Email
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg">
                mail
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="w-full bg-background border border-outline-variant rounded pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all outline-none text-on-surface"
                placeholder="seu@email.com"
                required
              />
            </div>
          </div>

          {/* Senha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                Senha
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg">
                  lock
                </span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="w-full bg-background border border-outline-variant rounded pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all outline-none text-on-surface"
                  placeholder="Min. 6 caracteres"
                  minLength={6}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                Confirmar Senha
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg">
                  lock
                </span>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  className={`w-full bg-background border rounded pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all outline-none text-on-surface ${
                    form.confirmPassword && form.confirmPassword !== form.password
                      ? "border-error"
                      : "border-outline-variant"
                  }`}
                  placeholder="Repetir senha"
                  minLength={6}
                  required
                />
              </div>
            </div>
          </div>

          {/* Password mismatch warning */}
          {form.confirmPassword && form.confirmPassword !== form.password && (
            <p className="text-xs text-error flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">error</span>
              As senhas não coincidem
            </p>
          )}

          <button
            type="submit"
            disabled={loading || (!!form.confirmPassword && form.confirmPassword !== form.password)}
            className="w-full px-8 py-3 bg-primary text-on-primary font-bold rounded hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                Criando conta...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">person_add</span>
                Criar Conta
              </>
            )}
          </button>

          <p className="text-center text-xs text-secondary">
            Já tem uma conta?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Fazer login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
