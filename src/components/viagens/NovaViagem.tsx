// Nova viagem: janela curta. Só o essencial e um próximo passo obrigatório,
// para que toda viagem nova já entre na agenda de alguém.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CaretRight, CheckCircle, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, Field, Janela, Seg, SelectField, TextField } from "@/components/ds";
import { CamposPasso } from "./Ficha";
import { ORIGENS, TIPOS_VIAGEM, dataDoPasso, quandoPasso } from "@/data/viagens";
import { createClient, createLead, createTask, fetchClients, getMemberId } from "@/lib/services";
import { dispatchWebhook } from "@/lib/webhook";
import { maskPhone } from "@/lib/ui";
import type { Client, Lead } from "@/lib/types";

const reais = (s: string) => Number(s.replace(/\D/g, "")) || 0;
const mascaraReais = (s: string) => (reais(s) ? reais(s).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "");
const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function NovaViagem({ open, onClose, onCriada }: { open: boolean; onClose: () => void; onCriada?: (v: Lead) => void }) {
  return (
    <Janela open={open} onOpenChange={(o) => !o && onClose()} eyebrow="Viagens · comercial" title="Nova viagem">
      {open && <Formulario onClose={onClose} onCriada={onCriada} />}
    </Janela>
  );
}

function Formulario({ onClose, onCriada }: { onClose: () => void; onCriada?: (v: Lead) => void }) {
  const qc = useQueryClient();
  const { data: base = [] } = useQuery({ queryKey: ["clients", ""], queryFn: () => fetchClients() });

  const [nome, setNome] = useState("");
  const [pessoa, setPessoa] = useState<Client | null>(null);
  const [sugerir, setSugerir] = useState(false);
  const [whats, setWhats] = useState("");
  const [origem, setOrigem] = useState<string>("Instagram");
  const [destino, setDestino] = useState("");
  const [modoData, setModoData] = useState<"datas" | "periodo">("datas");
  const [ida, setIda] = useState("");
  const [volta, setVolta] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [adultos, setAdultos] = useState("2");
  const [criancas, setCriancas] = useState("0");
  const [orcamento, setOrcamento] = useState("");
  const [passo, setPasso] = useState("Primeiro contato");
  const [quando, setQuando] = useState<string>("hoje");
  const [dataPasso, setDataPasso] = useState("");
  const [tipo, setTipo] = useState("");
  const [saida, setSaida] = useState("");
  const [milhas, setMilhas] = useState("");
  const [obs, setObs] = useState("");
  const [tentou, setTentou] = useState(false);

  const sugestoes = useMemo(() => {
    const q = normal(nome);
    if (q.length < 2 || pessoa) return [];
    return base.filter((c) => normal(c.name).includes(q)).slice(0, 5);
  }, [base, nome, pessoa]);
  const nomeExato = base.some((c) => normal(c.name) === normal(nome));

  const erros = {
    nome: !nome.trim() ? "Diga quem vai viajar." : undefined,
    destino: !destino.trim() ? "Escreva o destino, mesmo que aproximado." : undefined,
    volta: modoData === "datas" && ida && volta && volta < ida ? "A volta é antes da ida." : undefined,
    passo: !passo.trim() ? "Toda viagem nova precisa de um próximo passo." : undefined,
    dataPasso: quando === "data" && !dataPasso ? "Escolha a data." : undefined,
  };
  const valido = !Object.values(erros).some(Boolean);

  const criar = useMutation({
    mutationFn: async () => {
      let clientId = pessoa?.id ?? null;
      const telefone = whats.trim() || pessoa?.whatsapp || pessoa?.phone || null;
      if (!clientId) {
        const c = await createClient({ name: nome.trim(), phone: telefone, whatsapp: telefone });
        clientId = c?.id ?? null;
      }
      const total = (Number(adultos) || 0) + (Number(criancas) || 0);
      const travel_dates = modoData === "datas" ? (ida && volta ? `${ida} a ${volta}` : ida || "") : periodo.trim();
      const profile: Record<string, unknown> = {
        travel_dates: travel_dates || null,
        passengers: total || null,
        children: Number(criancas) || 0,
        trip_type: tipo || null,
        departure: saida.trim() || null,
        points_miles: milhas.trim() || null,
        trip_notes: obs.trim() || null,
      };
      const lead = await createLead({
        name: nome.trim(),
        phone: telefone,
        email: pessoa?.email ?? null,
        destination: destino.trim(),
        value: reais(orcamento),
        origin: origem,
        status: "new",
        client_id: clientId,
        profile,
      });
      if (!lead) throw new Error("falhou");
      await createTask({ lead_id: lead.id, title: passo.trim(), due_date: dataDoPasso(quando, dataPasso), assigned_to: lead.assigned_to || getMemberId() });
      return lead;
    },
    onSuccess: (lead) => {
      dispatchWebhook("lead.created", lead);
      for (const k of [["leads"], ["tasks"], ["clients"], ["dashboard"]]) qc.invalidateQueries({ queryKey: k });
      toast(`Viagem criada para ${lead.name}. Próximo passo: ${passo.trim().toLowerCase()}, ${quandoPasso(dataDoPasso(quando, dataPasso)).toLowerCase()}`);
      onCriada?.(lead);
      onClose();
    },
    onError: () => toast.error("Não foi possível criar a viagem. Confira a conexão e tente de novo."),
  });

  const e = (k: keyof typeof erros) => (tentou ? erros[k] : undefined);

  return (
    <form
      className="ds-form"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        setTentou(true);
        if (valido) criar.mutate();
      }}
    >
      <div>
        <Field
          label="Quem vai viajar"
          placeholder="Busque na base de viajantes ou digite um nome novo"
          autoComplete="off"
          value={nome}
          error={e("nome")}
          hint={pessoa ? undefined : nome.trim().length >= 2 && !nomeExato && sugestoes.length === 0 ? "Pessoa nova: entra também na base de viajantes." : undefined}
          onFocus={() => setSugerir(true)}
          onBlur={() => setTimeout(() => setSugerir(false), 150)}
          onChange={(ev) => { setNome(ev.target.value); setPessoa(null); }}
        />
        {pessoa && (
          <div className="ds-row" style={{ gap: 8, marginTop: 6, fontSize: 13 }}>
            <CheckCircle weight="fill" style={{ color: "var(--success)" }} aria-hidden />
            <span>Da base de viajantes</span>
            <button type="button" className="ds-link" onClick={() => setPessoa(null)}><X aria-hidden /> Trocar</button>
          </div>
        )}
        {sugerir && sugestoes.length > 0 && (
          <div className="ds-sugestoes" role="listbox" aria-label="Viajantes da base">
            {sugestoes.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => {
                  setPessoa(c);
                  setNome(c.name);
                  if (!whats) setWhats(c.whatsapp || c.phone || "");
                  setSugerir(false);
                }}
              >
                <span>{c.name}</span>
                <small>{c.whatsapp || c.phone || c.email || ""}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ds-linha">
        <Field label="WhatsApp" type="tel" inputMode="tel" placeholder="(11) 90000-0000" value={whats} onChange={(ev) => setWhats(maskPhone(ev.target.value))} />
        <SelectField label="Como chegou" value={origem} onChange={(ev) => setOrigem(ev.target.value)}>
          {ORIGENS.map((o) => <option key={o}>{o}</option>)}
        </SelectField>
      </div>

      <Field label="Destino" placeholder="Ex.: Lisboa e Porto" value={destino} onChange={(ev) => setDestino(ev.target.value)} error={e("destino")} />

      <div className="ds-stack" style={{ gap: 10 }}>
        <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <span className="ds-mono">Quando</span>
          <Seg label="Como informar a data" value={modoData} onChange={setModoData} options={[{ value: "datas", label: "Datas certas" }, { value: "periodo", label: "Só o período" }]} />
        </div>
        {modoData === "datas" ? (
          <div className="ds-linha">
            <Field label="Ida" type="date" value={ida} onChange={(ev) => setIda(ev.target.value)} />
            <Field label="Volta" type="date" value={volta} min={ida || undefined} onChange={(ev) => setVolta(ev.target.value)} error={e("volta")} />
          </div>
        ) : (
          <Field label="Período" placeholder="Ex.: julho, ou férias de janeiro" value={periodo} onChange={(ev) => setPeriodo(ev.target.value)} />
        )}
      </div>

      <div className="ds-linha">
        <div className="ds-linha" style={{ gap: 8 }}>
          <Field label="Adultos" type="number" min={1} inputMode="numeric" value={adultos} onChange={(ev) => setAdultos(ev.target.value)} />
          <Field label="Crianças" type="number" min={0} inputMode="numeric" value={criancas} onChange={(ev) => setCriancas(ev.target.value)} />
        </div>
        <Field label="Orçamento estimado" inputMode="numeric" placeholder="R$ 0" value={orcamento} onChange={(ev) => setOrcamento(mascaraReais(ev.target.value))} />
      </div>

      <CamposPasso titulo={passo} setTitulo={setPasso} quando={quando} setQuando={setQuando} data={dataPasso} setData={setDataPasso} erro={e("passo") ?? e("dataPasso")} />

      <details className="ds-mais">
        <summary><CaretRight weight="bold" aria-hidden /> Mais detalhes (opcional)</summary>
        <div className="ds-form">
          <div className="ds-stack" style={{ gap: 8 }}>
            <span className="ds-mono">Tipo de viagem</span>
            <div className="ds-chips" role="radiogroup" aria-label="Tipo de viagem">
              {TIPOS_VIAGEM.map((t) => (
                <label key={t} className="ds-opcao ds-opcao-chip">
                  <input type="radio" name="nv-tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} onClick={() => tipo === t && setTipo("")} />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="ds-linha">
            <Field label="Saída de" placeholder="Ex.: São Paulo (GRU)" value={saida} onChange={(ev) => setSaida(ev.target.value)} />
            <Field label="Milhas e pontos" placeholder="Ex.: Smiles 80 mil" value={milhas} onChange={(ev) => setMilhas(ev.target.value)} />
          </div>
          <TextField label="Observações" rows={3} placeholder="Preferências de voo, hotel, restrições" value={obs} onChange={(ev) => setObs(ev.target.value)} />
        </div>
      </details>

      <div className="ds-row" style={{ justifyContent: "flex-end" }}>
        <Button type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={criar.isPending}>Criar viagem</Button>
      </div>
    </form>
  );
}
