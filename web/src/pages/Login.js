import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        try {
            await signIn(email, password);
            navigate("/");
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Erro ao fazer login");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "min-h-screen bg-background flex items-center justify-center px-4", children: _jsxs("div", { className: "w-full max-w-sm space-y-8", children: [_jsxs("div", { className: "text-center", children: [_jsx("h1", { className: "text-3xl font-bold text-on-surface", children: "Obsidian" }), _jsx("p", { className: "text-xs text-secondary font-medium uppercase tracking-widest mt-1", children: "Precision MSGR" })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6 bg-surface-container border border-outline-variant rounded-xl p-8", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Email" }), _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all outline-none text-on-surface", placeholder: "seu@email.com", required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Senha" }), _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), className: "w-full bg-background border border-outline-variant rounded px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all outline-none text-on-surface", placeholder: "********", required: true })] }), _jsx("button", { type: "submit", disabled: loading, className: "w-full px-8 py-3 bg-primary text-on-primary font-bold rounded hover:opacity-90 transition-all disabled:opacity-50", children: loading ? "Entrando..." : "Entrar" }), _jsx("p", { className: "text-center text-[10px] text-secondary/50 mt-4", children: "Obsidian MSGR" })] })] }) }));
}
//# sourceMappingURL=Login.js.map