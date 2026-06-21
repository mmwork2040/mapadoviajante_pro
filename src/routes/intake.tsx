import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Route as RouteIcon, CheckCircle2 } from "lucide-react";
import { createPublicLead } from "@/lib/services";

export const Route = createFileRoute("/intake")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ a: typeof s.a === "string" ? s.a : "" }),
  head: () => ({
    meta: [
      { title: "Solicite seu orçamento — Mapa do Viajante PRO" },
      { name: "description", content: "Conte sobre a viagem dos seus sonhos e receba uma proposta." },
    ],
  }),
  component: IntakePage,
});

function IntakePage() {
  const { a: agencyId } = useSearch({ from: "/intake" });
  const [form, setForm] = useState({ name: "", email: "", phone: "", destination: "", notes: "" });
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!agencyId) {
      setError("Link inválido: agência não identificada.");
      return;
    }
    setSaving(true);
    const ok = await createPublicLead(agencyId, form);
    setSaving(false);
    if (ok) setSent(true);
    else setError("Não foi possível enviar. Tente novamente.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--accent)] px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <RouteIcon className="h-5 w-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">
            Mapa<span className="text-primary">PRO</span>
          </span>
        </div>

        {sent ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-[var(--success)]" />
            <h1 className="mt-4 text-2xl font-bold">Recebemos seu pedido!</h1>
            <p className="mt-2 text-muted-foreground">Em breve um consultor entrará em contato.</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Vamos planejar sua viagem ✈️</h1>
            <p className="mt-1 text-sm text-muted-foreground">Preencha e receba uma proposta personalizada.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <PF label="Nome" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <PF label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <PF label="Telefone / WhatsApp" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <PF label="Destino desejado" value={form.destination} onChange={(v) => setForm({ ...form, destination: v })} />
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Conte mais sobre a viagem</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Enviando…" : "Enviar pedido"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function PF({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
