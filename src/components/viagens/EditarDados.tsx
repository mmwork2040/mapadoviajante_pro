// Edição dos dados da viagem e do viajante a partir da ficha, em qualquer etapa
// (inclusive fechada ou perdida). Mudanças na viagem também vão para o roteiro.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Field, HighlightCard, TextField } from "@/components/ds";
import { campoDoPerfil, valorDe } from "@/data/viagens";
import { createClient, updateClient, updateItinerary, updateLead } from "@/lib/services";
import { ClientFormDrawer } from "@/routes/_app.clientes.index";
import type { Client, Itinerary, Lead } from "@/lib/types";

const DATAS = /^(\d{4}-\d{2}-\d{2})(?:\s*a\s*(\d{4}-\d{2}-\d{2}))?$/;

export function EditarViagem({
  viagem: v,
  roteiros,
  onPronto,
  onCancelar,
}: {
  viagem: Lead;
  roteiros: Pick<Itinerary, "id">[];
  onPronto: () => void;
  onCancelar: () => void;
}) {
  const p = (v.profile ?? {}) as Record<string, unknown>;
  const datas = DATAS.exec(campoDoPerfil(v, "travel_dates"));
  const [destino, setDestino] = useState(v.destination ?? "");
  const [saida, setSaida] = useState(campoDoPerfil(v, "departure"));
  const [ida, setIda] = useState(datas?.[1] ?? "");
  const [volta, setVolta] = useState(datas?.[2] ?? "");
  const [periodo, setPeriodo] = useState(datas ? "" : campoDoPerfil(v, "travel_dates"));
  const total = Number(p.passengers) || 0;
  const [criancas, setCriancas] = useState(String(Number(p.children) || 0));
  const [adultos, setAdultos] = useState(
    String(Math.max(0, total - (Number(p.children) || 0)) || ""),
  );
  const [valor, setValor] = useState(valorDe(v) ? String(valorDe(v)) : "");
  const [tipo, setTipo] = useState(campoDoPerfil(v, "trip_type"));
  const [obs, setObs] = useState(campoDoPerfil(v, "trip_notes"));

  const salvar = useMutation({
    mutationFn: async () => {
      const a = Math.max(0, Number(adultos) || 0);
      const c = Math.max(0, Number(criancas) || 0);
      const travel_dates = ida ? (volta ? `${ida} a ${volta}` : ida) : periodo.trim();
      const r = await updateLead(v.id, {
        destination: destino.trim(),
        value: Number(String(valor).replace(",", ".")) || 0,
        profile: {
          departure: saida.trim(),
          travel_dates,
          passengers: a + c || null,
          children: c,
          trip_type: tipo.trim(),
          trip_notes: obs.trim(),
        },
      });
      if (!r) throw new Error("falhou");
      // O roteiro guarda uma cópia desses dados: mantém igual.
      await Promise.all(
        roteiros.map((it) =>
          updateItinerary(it.id, {
            destination: destino.trim(),
            start_date: ida || null,
            end_date: volta || null,
            passengers: a + c || 1,
          }),
        ),
      );
    },
    onSuccess: () => {
      toast("Dados da viagem atualizados");
      onPronto();
    },
    onError: () => toast.error("Não foi possível salvar. Tente de novo."),
  });

  return (
    <HighlightCard className="ds-stack" style={{ gap: 12 }}>
      <span className="ds-mono" style={{ color: "var(--accent-foreground)" }}>
        Editar viagem
      </span>
      <Field label="Destino" value={destino} onChange={(e) => setDestino(e.target.value)} />
      <Field label="Saída de" value={saida} onChange={(e) => setSaida(e.target.value)} />
      <div className="ds-row" style={{ alignItems: "flex-end" }}>
        <Field label="Ida" type="date" value={ida} onChange={(e) => setIda(e.target.value)} />
        <Field label="Volta" type="date" value={volta} onChange={(e) => setVolta(e.target.value)} />
      </div>
      {!ida && (
        <Field
          label="Ou período aproximado"
          placeholder="Ex.: julho, férias de janeiro"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
        />
      )}
      <div className="ds-row" style={{ alignItems: "flex-end" }}>
        <Field
          label="Adultos"
          type="number"
          min={0}
          value={adultos}
          onChange={(e) => setAdultos(e.target.value)}
        />
        <Field
          label="Crianças"
          type="number"
          min={0}
          value={criancas}
          onChange={(e) => setCriancas(e.target.value)}
        />
      </div>
      <Field
        label="Orçamento que o cliente trouxe (R$)"
        inputMode="decimal"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
      <Field
        label="Tipo de viagem"
        placeholder="Ex.: lua de mel, família, aventura"
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
      />
      <TextField
        label="Observações"
        rows={2}
        value={obs}
        onChange={(e) => setObs(e.target.value)}
      />
      {roteiros.length > 0 && (
        <span className="ds-muted" style={{ fontSize: 12.5 }}>
          Destino, datas e passageiros também são atualizados no roteiro.
        </span>
      )}
      <div className="ds-row">
        <Button variant="primary" loading={salvar.isPending} onClick={() => salvar.mutate()}>
          Salvar
        </Button>
        <Button variant="link" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </HighlightCard>
  );
}

/** Abre o cadastro completo do viajante. Sem cadastro, cria um a partir da viagem e já vincula. */
export function EditarViajante({
  viagem: v,
  viajante,
  abaInicial,
  onPronto,
  onFechar,
}: {
  viagem: Lead;
  viajante: Client | null;
  abaInicial?: "contato" | "documentos" | "endereco";
  onPronto: () => void;
  onFechar: () => void;
}) {
  const salvar = useMutation({
    mutationFn: async (payload: Partial<Client>) => {
      if (viajante) {
        const r = await updateClient(viajante.id, payload);
        if (!r) throw new Error("falhou");
        return;
      }
      const c = await createClient(payload);
      if (!c) throw new Error("falhou");
      const r = await updateLead(v.id, {
        client_id: c.id,
        name: c.name,
        email: c.email ?? null,
        phone: c.whatsapp || c.phone || null,
      });
      if (!r) throw new Error("falhou");
    },
    onSuccess: () => {
      toast("Dados do viajante atualizados");
      onPronto();
      onFechar();
    },
    onError: () => toast.error("Não foi possível salvar o viajante. Tente de novo."),
  });

  const inicial: Partial<Client> = viajante ?? {
    name: v.name,
    email: v.email ?? "",
    whatsapp: v.phone ?? "",
    phone: v.phone ?? "",
  };
  return (
    <ClientFormDrawer
      initial={inicial}
      isEdit={!!viajante}
      saving={salvar.isPending}
      initialTab={abaInicial}
      onClose={onFechar}
      onSubmit={(payload) => salvar.mutate(payload)}
    />
  );
}
