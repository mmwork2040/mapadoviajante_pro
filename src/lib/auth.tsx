import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { appwriteAuthService } from "@/services/appwriteAuthService";
import { loadAgencyContext, setAgencyContext } from "@/lib/services";
import { acceptInvite, getMyPendingInvite, type PendingInvite } from "@/lib/invites";
import { captureDeviceTokenOnLogin } from "@/lib/notifications";
import type { AgencyMember } from "@/lib/types";

/**
 * Situação de acesso quando não há agência liberada:
 * pending = sem liberação (compra na Hotmart ou liberação manual);
 * verify_email = tem liberação, mas precisa confirmar o e-mail;
 * blocked = membro bloqueado pela agência; suspended = agência suspensa.
 */
export type AccessStatus = "ok" | "pending" | "verify_email" | "blocked" | "suspended" | "invite" | "error";

interface AuthContextValue {
  session: Session | null;
  member: AgencyMember | null;
  pendingInvite: PendingInvite | null;
  accessStatus: AccessStatus | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (name: string, email: string, password: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signInWithGoogle: () => void;
  signOut: () => Promise<void>;
  refreshMember: () => Promise<void>;
  acceptPendingInvite: () => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Apenas estes e-mails têm acesso irrestrito à área de Administração.
export const SUPER_ADMIN_EMAILS = [
  "celiogomesalves@gmail.com",
  "lukasgabriel1036@gmail.com",
];

export function isSuperAdminEmail(email?: string | null) {
  return !!email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

/** Verdadeiro se o membro é administrador (cargo admin) ou super admin do sistema. */
export function isAdminUser(member?: AgencyMember | null, email?: string | null) {
  return member?.role === "admin" || isSuperAdminEmail(email);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<AgencyMember | null>(null);
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrateMember = useCallback(async (sess: Session | null) => {
    if (!sess) {
      setAgencyContext(null);
      setMember(null);
      setPendingInvite(null);
      setAccessStatus(null);
      return;
    }
    let m = await loadAgencyContext();

    // 1) Convite via link (token guardado pela página /aceitar-convite)
    if (!m && typeof window !== "undefined") {
      const token = sessionStorage.getItem("invite_token");
      if (token) {
        await acceptInvite(token);
        sessionStorage.removeItem("invite_token");
        m = await loadAgencyContext();
      }
    }

    // 2) Existe convite pendente para este e-mail? Não provisiona nova agência.
    if (!m) {
      const invite = await getMyPendingInvite();
      if (invite) {
        setPendingInvite(invite);
        setMember(null);
        return;
      }
    }

    const access = await import("@/lib/access.functions");

    // 3) Usuário sem agência: o servidor só cria a agência se o e-mail tiver
    //    liberação (Hotmart ou super admin).
    if (!m && sess?.user) {
      try {
        const res = await access.provisionMyAgency();
        if (res.status === "ok") {
          m = await loadAgencyContext();
        } else if (res.status === "invite") {
          const invite = await getMyPendingInvite();
          setPendingInvite(invite);
          setMember(null);
          setAccessStatus(invite ? null : "invite");
          return;
        } else {
          setPendingInvite(null);
          setMember(null);
          setAccessStatus(res.status);
          return;
        }
      } catch (err) {
        console.error("provisionMyAgency:", err);
        setMember(null);
        setAccessStatus("error");
        return;
      }
    }

    // 4) Agência suspensa (reembolso, cancelamento ou decisão do super admin).
    if (m) {
      const st = await access.getMyAccessStatus().catch(() => ({ status: "ok" as const }));
      if (st.status === "suspended") {
        setPendingInvite(null);
        setMember(null);
        setAccessStatus("suspended");
        return;
      }
    }
    setAccessStatus(m ? "ok" : "error");
    setPendingInvite(null);
    setMember(m);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }: any) => {
      setSession(data.session);
      await hydrateMember(data.session);
      setLoading(false);
      if (data.session) void captureDeviceTokenOnLogin();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event: string, sess: any) => {
      setSession(sess);
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        hydrateMember(sess);
        if (sess) void captureDeviceTokenOnLogin();
      } else if (event === "SIGNED_OUT") {
        setAgencyContext(null);
        setMember(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [hydrateMember]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    const { data } = await supabase.auth.getSession();
    await hydrateMember(data.session);
    return {};
  }, [hydrateMember]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: window.location.origin },
    });
    if (error) {
      if (error.message.includes("already registered"))
        return { error: "Este e-mail já está cadastrado. Faça login normalmente." };
      return { error: error.message };
    }
    if (data.user && data.session) {
      await hydrateMember(data.session);
      return {};
    }
    return { needsConfirmation: true };
  }, [hydrateMember]);

  const signInWithGoogle = useCallback(() => {
    appwriteAuthService.loginWithGoogle();
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("SignOut error:", e);
    }
    setSession(null);
    setAgencyContext(null);
    setMember(null);
    setPendingInvite(null);
    window.location.href = "/auth";
  }, []);

  const refreshMember = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await hydrateMember(data.session);
  }, [hydrateMember]);

  const acceptPendingInvite = useCallback(async () => {
    if (!pendingInvite) return { ok: false, error: "Nenhum convite pendente." };
    const res = await acceptInvite("");
    if (!res.ok) return res;
    const { data } = await supabase.auth.getSession();
    await hydrateMember(data.session);
    return { ok: true };
  }, [pendingInvite, hydrateMember]);

  return (
    <AuthContext.Provider
      value={{
        session,
        member,
        pendingInvite,
        accessStatus,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshMember,
        acceptPendingInvite,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
