import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
    function update(field, value) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }
    async function handleSubmit(e) {
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
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Erro ao criar conta");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "min-h-screen bg-background flex items-center justify-center px-4", children: _jsxs("div", { className: "w-full max-w-md space-y-8", children: [_jsxs("div", { className: "text-center", children: [_jsx("h1", { className: "text-3xl font-bold text-on-surface", children: "Obsidian" }), _jsx("p", { className: "text-xs text-secondary font-medium uppercase tracking-widest mt-1", children: "Precision MSGR" })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-5 bg-surface-container border border-outline-variant rounded-xl p-8", children: [_jsx("h2", { className: "text-lg font-bold text-center", children: "Criar Conta" }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Nome da Empresa" }), _jsxs("div", { className: "relative", children: [_jsx("span", { className: "material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg", children: "business" }), _jsx("input", { type: "text", value: form.companyName, onChange: (e) => update("companyName", e.target.value), className: "w-full bg-background border border-outline-variant rounded pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all outline-none text-on-surface", placeholder: "Minha Empresa Ltda", required: true })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Seu Nome" }), _jsxs("div", { className: "relative", children: [_jsx("span", { className: "material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg", children: "person" }), _jsx("input", { type: "text", value: form.name, onChange: (e) => update("name", e.target.value), className: "w-full bg-background border border-outline-variant rounded pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all outline-none text-on-surface", placeholder: "Jo\u00E3o Silva", required: true })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Email" }), _jsxs("div", { className: "relative", children: [_jsx("span", { className: "material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg", children: "mail" }), _jsx("input", { type: "email", value: form.email, onChange: (e) => update("email", e.target.value), className: "w-full bg-background border border-outline-variant rounded pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all outline-none text-on-surface", placeholder: "seu@email.com", required: true })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Senha" }), _jsxs("div", { className: "relative", children: [_jsx("span", { className: "material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg", children: "lock" }), _jsx("input", { type: "password", value: form.password, onChange: (e) => update("password", e.target.value), className: "w-full bg-background border border-outline-variant rounded pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all outline-none text-on-surface", placeholder: "Min. 6 caracteres", minLength: 6, required: true })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-secondary", children: "Confirmar Senha" }), _jsxs("div", { className: "relative", children: [_jsx("span", { className: "material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg", children: "lock" }), _jsx("input", { type: "password", value: form.confirmPassword, onChange: (e) => update("confirmPassword", e.target.value), className: `w-full bg-background border rounded pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all outline-none text-on-surface ${form.confirmPassword && form.confirmPassword !== form.password
                                                        ? "border-error"
                                                        : "border-outline-variant"}`, placeholder: "Repetir senha", minLength: 6, required: true })] })] })] }), form.confirmPassword && form.confirmPassword !== form.password && (_jsxs("p", { className: "text-xs text-error flex items-center gap-1", children: [_jsx("span", { className: "material-symbols-outlined text-sm", children: "error" }), "As senhas n\u00E3o coincidem"] })), _jsx("button", { type: "submit", disabled: loading || (!!form.confirmPassword && form.confirmPassword !== form.password), className: "w-full px-8 py-3 bg-primary text-on-primary font-bold rounded hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2", children: loading ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "material-symbols-outlined animate-spin text-lg", children: "progress_activity" }), "Criando conta..."] })) : (_jsxs(_Fragment, { children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "person_add" }), "Criar Conta"] })) }), _jsxs("p", { className: "text-center text-xs text-secondary", children: ["J\u00E1 tem uma conta?", " ", _jsx(Link, { to: "/login", className: "text-primary hover:underline font-medium", children: "Fazer login" })] })] })] }) }));
}
//# sourceMappingURL=Register.js.map