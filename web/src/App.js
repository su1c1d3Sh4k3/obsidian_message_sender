import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Contacts from "@/pages/Contacts";
import Groups from "@/pages/Groups";
import Campaigns from "@/pages/Campaigns";
import Schedule from "@/pages/Schedule";
import Senders from "@/pages/Senders";
import Settings from "@/pages/Settings";
import Admin from "@/pages/Admin";
function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) {
        return (_jsx("div", { className: "min-h-screen bg-background flex items-center justify-center", children: _jsx("div", { className: "animate-pulse text-primary text-lg", children: "Carregando..." }) }));
    }
    if (!user)
        return _jsx(Navigate, { to: "/login", replace: true });
    return _jsx(_Fragment, { children: children });
}
export default function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/*", element: _jsx(ProtectedRoute, { children: _jsx(AppLayout, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/contacts", element: _jsx(Contacts, {}) }), _jsx(Route, { path: "/groups", element: _jsx(Groups, {}) }), _jsx(Route, { path: "/campaigns", element: _jsx(Campaigns, {}) }), _jsx(Route, { path: "/schedule", element: _jsx(Schedule, {}) }), _jsx(Route, { path: "/senders", element: _jsx(Senders, {}) }), _jsx(Route, { path: "/settings", element: _jsx(Settings, {}) }), _jsx(Route, { path: "/admin", element: _jsx(Admin, {}) })] }) }) }) })] }));
}
//# sourceMappingURL=App.js.map