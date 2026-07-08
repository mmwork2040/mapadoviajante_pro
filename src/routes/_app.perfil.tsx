import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { UserCog, Lock, Save, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { updateMyPassword, updateMyProfile } from "@/lib/services";
import { initials } from "@/lib/ui";

export const Route = createFileRoute("/_app/perfil")({
  component: ProfilePage,
});

const COLORS = ["#ff7a1a", "#3b82f6", "#16a34a", "#a855f7", "#ef4444", "#0ea5e9", "#f59e0b", "#ec4899"];

function ProfilePage() {
  const { member, session, refreshMember } = useAuth();
  const [name, setName] = useState(member?.name ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [color, setColor] = useState(member?.avatar_color ?? "#ff7a1a");
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe seu nome.");
    setSavingProfile(true);
    const ok = await updateMyProfile({ name: name.trim(), phone: phone.trim() || null, avatar_color: color });
    setSavingProfile(false);
    if (!ok) return toast.error("Não foi possível salvar o perfil.");
    toast.success("Perfil atualizado.");
    await refreshMember();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return toast.error("A senha deve ter ao menos 6 caracteres.");
    if (pw !== pw2) return toast.error("As senhas não coincidem.");
    setSavingPw(true);
    const res = await updateMyPassword(pw);
    setSavingPw(false);
    if (!res.ok) return toast.error(res.error || "Não foi possível alterar a senha.");
    setPw("");
    setPw2("");
    toast.success("Senha alterada com sucesso.");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground">Gerencie suas informações e sua senha.</p>
      </div>

      <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserCog className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold">Informações</h2>
            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
          <span
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {initials(name)}
          </span>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nome</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Telefone</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-sm font-medium">Cor do avatar</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-offset-card ring-foreground" : ""}`}
                style={{ backgroundColor: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Cargo: <strong className="capitalize">{member?.role || "—"}</strong>
          </span>
          <button
            type="submit"
            disabled={savingProfile}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </button>
        </div>
      </form>

      <form onSubmit={savePassword} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold">Alterar senha</h2>
            <p className="text-xs text-muted-foreground">Escolha uma nova senha de acesso.</p>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nova senha</span>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Confirmar nova senha</span>
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>

        <button
          type="submit"
          disabled={savingPw}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Alterar senha
        </button>
      </form>
    </div>
  );
}
