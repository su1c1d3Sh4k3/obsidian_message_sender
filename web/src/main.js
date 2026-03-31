import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/AuthContext";
import App from "./App";
import "./styles/globals.css";
const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: 1, refetchOnWindowFocus: false },
    },
});
createRoot(document.getElementById("root")).render(_jsx(StrictMode, { children: _jsx(BrowserRouter, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsxs(AuthProvider, { children: [_jsx(App, {}), _jsx(Toaster, { position: "top-right", toastOptions: {
                            style: {
                                background: "#121215",
                                color: "#fafafa",
                                border: "1px solid #27272a",
                            },
                        } })] }) }) }) }));
//# sourceMappingURL=main.js.map