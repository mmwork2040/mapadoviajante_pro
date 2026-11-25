// Nova pessoa: cadastra na base e, se for o caso, liga a uma família ou grupo
// (existente ou nova). Também completa o cadastro de quem só tinha o nome.
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Field, Janela, SelectField } from "@/components/ds";
import { RELACOES, comFamilia, comMembro, membrosDe, type Familia, type Pessoa, type TipoFamilia } from "@/data/viajantes";
import { createClient, updateClient } from "@/lib/services";
import { maskPhone } from "@/lib/ui";
import type { Client } from "@/lib/types";

const NOVA = "__nova__";

export function NovaPessoa({ aberta, familiaId, completar, clientes, familias, onFechar, onSalva }: {
  aberta: boolean;
  familiaId?: string;
  completar?: Pessoa;
  clientes: Client[];
  familias: Familia[];
  onFechar: () => void;
  onSalva: (id: string) => void;
}) {
  return (
    <Janela open={aberta} onOpenChange={(o) => !o && onFechar()} eyebrow="Viajantes" title={completar ? `Completar cadastro de ${completar.nome.split(" ")[0]}` : "Nova pessoa"}>
      {aberta && <Form familiaId={familiaId} completar={completar} clientes={clientes} familias={familias} onFechar={onFechar} onSalva={onSalva} />}
    </Janela>
  );
}

function Form({ familiaId, completar, clientes, familias, onFechar, onSalva }: Omit<Parameters<typeof NovaPessoa>[0], "aberta">) {
  const qc = useQueryClient();
  const familiaInicial = familiaId && familias.some((f) => f.id === familiaId) ? familiaId : familiaId ? `tit:${familiaId}` : "";
  const [nome, setNome] = useState(completar?.nome ?? "");
  const [nasc, setNasc] = useState("");
  const [familia, setFamilia] = useState(familiaInicial);
  const [nomeFamilia, setNomeFamilia] = useState("");
  const [tipoFamilia, setTipoFamilia] = useState<TipoFamilia>("Família");
  const [rel, setRel] = useState(completar?.rel ?? (familiaInicial ? "Cônjuge" : "Titular"));
  const [whats, setWhats] = useState("");
  const [passNum, setPassNum] = useState("");
  const [passVal, setPassVal] = useState("");
  const [tentou, setTentou] = useState(false);

  useEffect(() => {
    if (!familia) setRel("Titular");
  }, [familia]);

  const menor = (() => {
    if (!nasc) return false;
    const d = new Date(`${nasc}T12:00:00`);
    return Date.now() - d.getTime() < 18 * 365.25 * 86_400_000;
  })();

  const erros = {
    nome: nome.trim().split(/\s+/).length < 2 ? "Escreva o nome completo, como está no documento." : undefined,
    nomeFamilia: familia === NOVA && !nomeFamilia.trim() ? "Dê um nome à família ou grupo." : undefined,
  };

  const salvar = useMutation({
    mutationFn: async () => {
      const telefone = whats.trim() || null;
      const novo = await createClient({
        name: nome.trim(),
        birth_date: nasc || null,
        phone: telefone,
        whatsapp: telefone,
        passport_number: passNum.trim() || null,
        passport_expiry: passVal || null,
        preferences: familia === NOVA ? comFamilia({ preferences: {} } as Client, nomeFamilia.trim(), tipoFamilia) : {},
      });
      if (!novo) throw new Error("falhou");

      // Liga a pessoa à família: o titular guarda a lista de quem viaja com ele.
      const titularId = familia.startsWith("tit:") ? familia.slice(4) : familia && familia !== NOVA ? familia : null;
      const titular = titularId ? clientes.find((c) => c.id === titularId) : null;
      if (titular) {
        const existente = completar ? membrosDe(titular).find((m) => `m:${titular.id}:${m.id}` === completar.id) : undefined;
        const membro = { id: existente?.id ?? globalThis.crypto?.randomUUID?.() ?? String(Date.now()), name: nome.trim(), relationship: rel, client_id: novo.id };
        const ok = await updateClient(titular.id, { preferences: comMembro(titular, membro) });
        if (!ok) throw new Error("vínculo");
      }
      return novo;
    },
    onSuccess: (novo) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast(completar ? `Cadastro de ${novo.name} completo` : `${novo.name} cadastrada na base`);
      onSalva(novo.id);
    },
    onError: (e) => toast.error(e instanceof Error && e.message === "vínculo" ? "A pessoa foi cadastrada, mas não deu para ligar à família. Tente pelo Editar." : "Não foi possível salvar. Tente de novo."),
  });

  const e = (k: keyof typeof erros) => (tentou ? erros[k] : undefined);
  const titularSemFamilia = familia.startsWith("tit:") ? clientes.find((c) => c.id === familia.slice(4)) : null;

  return (
    <form
      className="ds-form"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        setTentou(true);
        if (!Object.values(erros).some(Boolean)) salvar.mutate();
      }}
    >
      <div className="ds-linha">
        <Field label="Nome completo" placeholder="Como está no documento" value={nome} onChange={(ev) => setNome(ev.target.value)} error={e("nome")} autoFocus />
        <Field label="Nascimento" type="date" value={nasc} onChange={(ev) => setNasc(ev.target.value)} />
      </div>
      <div className="ds-linha">
        <SelectField label="Família ou grupo" value={familia} onChange={(ev) => setFamilia(ev.target.value)}>
          <option value="">Nenhum (viaja sozinho)</option>
          {titularSemFamilia && <option value={familia}>Junto com {titularSemFamilia.name}</option>}
          {familias.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          <option value={NOVA}>Criar nova família ou grupo</option>
        </SelectField>
        {familia && familia !== NOVA ? (
          <SelectField label="Relação" value={rel} onChange={(ev) => setRel(ev.target.value)}>
            {RELACOES.filter((r) => r !== "Titular").map((r) => <option key={r}>{r}</option>)}
          </SelectField>
        ) : (
          <Field label="Relação" value="Titular" readOnly hint={familia === NOVA ? "Quem você está cadastrando é o titular." : undefined} />
        )}
      </div>
      {familia === NOVA && (
        <div className="ds-linha">
          <Field label="Nome da família ou grupo" placeholder="Ex.: Família Souza" value={nomeFamilia} onChange={(ev) => setNomeFamilia(ev.target.value)} error={e("nomeFamilia")} />
          <SelectField label="Tipo" value={tipoFamilia} onChange={(ev) => setTipoFamilia(ev.target.value as TipoFamilia)}>
            <option>Família</option><option>Casal</option><option>Grupo</option>
          </SelectField>
        </div>
      )}
      <div className="ds-linha">
        <Field label={menor ? "WhatsApp (opcional para menores)" : "WhatsApp"} type="tel" inputMode="tel" placeholder="(11) 90000-0000" value={whats} onChange={(ev) => setWhats(maskPhone(ev.target.value))} />
        <Field label="Passaporte" placeholder="Número" value={passNum} onChange={(ev) => setPassNum(ev.target.value.toUpperCase())} />
      </div>
      <div className="ds-linha">
        <Field label="Validade do passaporte" type="date" value={passVal} onChange={(ev) => setPassVal(ev.target.value)} />
        <span />
      </div>
      <div className="ds-row" style={{ justifyContent: "flex-end" }}>
        <Button type="button" onClick={onFechar}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={salvar.isPending}>Salvar pessoa</Button>
      </div>
    </form>
  );
}
