import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    async function fetchProfile(authUser) {
        const { data } = await supabase
            .from("users")
            .select("id, tenant_id, name, email, role")
            .eq("id", authUser.id)
            .single();
        setUser(data);
    }
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) {
                fetchProfile(session.user);
            }
            setLoading(false);
        });
        const { data: { subscription }, } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user) {
                fetchProfile(session.user);
            }
            else {
                setUser(null);
            }
        });
        return () => subscription.unsubscribe();
    }, []);
    async function signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error)
            throw error;
    }
    async function signOut() {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
    }
    return (_jsx(AuthContext.Provider, { value: { user, session, loading, signIn, signOut }, children: children }));
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context)
        throw new Error("useAuth must be used within AuthProvider");
    return context;
}
//# sourceMappingURL=AuthContext.js.map