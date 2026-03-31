import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      navigate("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-on-surface">Obsidian</h1>
          <p className="text-xs text-secondary font-medium uppercase tracking-widest mt-1">
            Precision MSGR
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-surface-container border border-outline-variant rounded-xl p-8">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all outline-none text-on-surface"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all outline-none text-on-surface"
              placeholder="********"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-8 py-3 bg-primary text-on-primary font-bold rounded hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <p className="text-center text-[10px] text-secondary/50 mt-4">
            Obsidian MSGR
          </p>
        </form>
      </div>
    </div>
  );
}
