import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AppSession as Session } from "@/integrations/appwrite/bridge";
import { supabase } from "@/integrations/supabase/client";
import { appwriteAuthService } from "@/services/appwriteAuthService";
import {
  loadAgencyContext,
  setAgencyContext,
} from "@/lib/services";
import { type PendingInvite } from "@/lib/invites";
import { aceitarConviteDoEmail, garantirAcesso } from "@/lib/access.functions";
import { captureDeviceTokenOnLogin } from "@/lib/notifications";
import type { AgencyMember } from "@/lib/types";
import { clearBrand } from "@/lib/brand";

interface AuthContextValue {
  session: Session | null;
  member: AgencyMember | null;
  pendingInvite: PendingInvite | null;
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
  const [loading, setLoading] = useState(true);

  const hydrateMember = useCallback(async (sess: Session | null) => {
    if (!sess) {
      setAgencyContext(null);
      setMember(null);
      setPendingInvite(null);
      return;
    }
    // O servidor vincula a conta, aceita convite pelo link ou cria a agência,
    // e põe a pessoa no time da agência antes de qualquer leitura.
    const token = typeof window !== "undefined" ? sessionStorage.getItem("invite_token") : null;
    let m: AgencyMember | null = null;
    try {
      const meta = sess.user.user_metadata as { name?: string } | undefined;
      const res = await garantirAcesso({ data: { token: token ?? undefined, provisionar: true, nome: meta?.name || sess.user.email || undefined } });
      if (token) sessionStorage.removeItem("invite_token");
      if (res.pendingInvite) {
        setPendingInvite(res.pendingInvite as PendingInvite);
        setMember(null);
        return;
      }
      if (res.member) {
        setAgencyContext(res.member as AgencyMember);
        m = (await loadAgencyContext()) ?? (res.member as AgencyMember);
      }
    } catch (err) {
      console.error("garantirAcesso:", err);
      m = await loadAgencyContext();
    }
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
    // A tela de login é do produto, não da agência que acabou de sair.
    clearBrand();
    window.location.href = "/auth";
  }, []);

  const refreshMember = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await hydrateMember(data.session);
  }, [hydrateMember]);

  const acceptPendingInvite = useCallback(async () => {
    if (!pendingInvite) return { ok: false, error: "Nenhum convite pendente." };
    const res = await aceitarConviteDoEmail();
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
