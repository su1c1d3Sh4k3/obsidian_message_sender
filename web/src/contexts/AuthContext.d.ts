import { type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
interface UserProfile {
    id: string;
    tenant_id: string;
    name: string;
    email: string;
    role: string;
}
interface AuthContextType {
    user: UserProfile | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
}
export declare function AuthProvider({ children }: {
    children: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function useAuth(): AuthContextType;
export {};
//# sourceMappingURL=AuthContext.d.ts.map