import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { db } from "@/integrations/appwrite/db";
import { appwriteAuthService } from "@/services/appwriteAuthService";
import {
  agencyLookupFailed,
  autoProvisionAgency,
  loadAgencyContext,
  setAgencyContext,
} from "@/lib/services";
import { acceptInvite, getMyPendingInvite, type PendingInvite } from "@/lib/invites";
import { captureDeviceTokenOnLogin } from "@/lib/notifications";
import type { AgencyMember } from "@/lib/types";

/** Sessão do usuário logado no Appwrite, no formato que as telas usam. */
export interface Session {
  access_token: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: { name?: string };
  };
}

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

  // Uma carga por vez. A sessão inicial chega por dois caminhos quase juntos;
  // sem esta trava, as duas cargas criavam uma agência cada.
  const hydrating = useRef<{ userId: string; run: Promise<void> } | null>(null);

  const hydrateMember = useCallback(async (sess: Session | null) => {
    if (!sess) {
      hydrating.current = null;
      setAgencyContext(null);
      setMember(null);
      setPendingInvite(null);
      return;
    }
    const userId = sess.user.id;
    if (hydrating.current?.userId === userId) return hydrating.current.run;

    const run = (async () => {
      let m = await loadAgencyContext();

      // 1) Convite via link (token guardado pela página /aceitar-convite)
      if (!m && !agencyLookupFailed() && typeof window !== "undefined") {
        const token = sessionStorage.getItem("invite_token");
        if (token) {
          await acceptInvite(token);
          sessionStorage.removeItem("invite_token");
          m = await loadAgencyContext();
        }
      }

      // 2) Existe convite pendente para este e-mail? Não provisiona nova agência.
      let lookupOk = !agencyLookupFailed();
      if (!m && lookupOk) {
        try {
          const invite = await getMyPendingInvite();
          if (invite) {
            setPendingInvite(invite);
            setMember(null);
            return;
          }
        } catch (err) {
          console.error("[auth] não foi possível conferir convites:", err);
          lookupOk = false;
        }
      }

      // 3) Usuário novo, sem convite → provisiona a própria agência. Só quando as
      //    consultas acima deram certo: uma falha de rede não pode virar agência nova.
      if (!m && lookupOk && sess.user) {
        const meta = sess.user.user_metadata as { name?: string } | undefined;
        m = await autoProvisionAgency(userId, meta?.name || sess.user.email || "Novo Usuário", sess.user.email || "");
      }
      setPendingInvite(null);
      setMember(m);
    })();

    hydrating.current = { userId, run };
    try {
      await run;
    } finally {
      if (hydrating.current?.run === run) hydrating.current = null;
    }
  }, []);

  useEffect(() => {
    db.auth.getSession().then(async ({ data }: any) => {
      setSession(data.session);
      await hydrateMember(data.session);
      setLoading(false);
      if (data.session) void captureDeviceTokenOnLogin();
    });

    const { data: sub } = db.auth.onAuthStateChange((event: string, sess: any) => {
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
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    const { data } = await db.auth.getSession();
    await hydrateMember(data.session);
    return {};
  }, [hydrateMember]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await db.auth.signUp({
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
      await db.auth.signOut();
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
    const { data } = await db.auth.getSession();
    await hydrateMember(data.session);
  }, [hydrateMember]);

  const acceptPendingInvite = useCallback(async () => {
    if (!pendingInvite) return { ok: false, error: "Nenhum convite pendente." };
    const res = await acceptInvite("");
    if (!res.ok) return res;
    const { data } = await db.auth.getSession();
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
