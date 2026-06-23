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
import {
  autoProvisionAgency,
  loadAgencyContext,
  setAgencyContext,
} from "@/lib/services";
import { acceptInvite, getMyPendingInvite, type PendingInvite } from "@/lib/invites";
import type { AgencyMember } from "@/lib/types";

interface AuthContextValue {
  session: Session | null;
  member: AgencyMember | null;
  pendingInvite: PendingInvite | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (name: string, email: string, password: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
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

    // 3) Usuário novo, sem convite → provisiona a própria agência.
    if (!m) {
      const meta = sess.user.user_metadata as { name?: string } | undefined;
      m = await autoProvisionAgency(sess.user.id, meta?.name || sess.user.email || "Novo Usuário", sess.user.email || "");
    }
    setPendingInvite(null);
    setMember(m);
  }, []);


  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await hydrateMember(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        hydrateMember(sess);
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
      const m = await autoProvisionAgency(data.user.id, name, email);
      if (!m) return { error: "Erro ao configurar sua agência. Tente novamente." };
      setMember(m);
      return {};
    }
    return { needsConfirmation: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAgencyContext(null);
    setMember(null);
  }, []);

  const refreshMember = useCallback(async () => {
    const m = await loadAgencyContext();
    setMember(m);
  }, []);

  return (
    <AuthContext.Provider value={{ session, member, loading, signIn, signUp, signOut, refreshMember }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
