// Documento de uma viagem pronto para salvar em PDF: orçamento ou contrato.
// Abre em outra aba a partir da ficha; o botão "Salvar PDF" usa a impressão
// do navegador. Precisa de login (lê a viagem com a sessão da equipe).
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { fetchClientById, fetchLeadById } from "@/lib/services";
import { useBrand } from "@/hooks/useBrand";
import { useAuth } from "@/lib/auth";
import { getContratoConfig } from "@/lib/contrato-config";
import { getAgencyInfo } from "@/lib/agency";
import {
  dadosDoContrato,
  lerOrcamento,
  preencherContrato,
  totalOrcamento,
} from "@/data/documentos";
import { dinheiro, passageirosTexto, quandoTexto } from "@/data/viagens";

export const Route = createFileRoute("/documento/$tipo/$id")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Documento da viagem" }, { name: "robots", content: "noindex" }],
  }),
  component: DocumentoViagem,
});

const dataExtenso = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
};

function DocumentoViagem() {
  const { tipo, id } = useParams({ from: "/documento/$tipo/$id" });
  const { loading: carregandoSessao } = useAuth();
  const brand = useBrand();
  const lead = useQuery({
    queryKey: ["lead", id],
    queryFn: () => fetchLeadById(id),
    enabled: !carregandoSessao,
    retry: false,
  });
  const clientId = lead.data?.client_id ?? null;
  const cliente = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => fetchClientById(clientId!),
    enabled: !!clientId,
  });
  const modelo = useQuery({
    queryKey: ["contrato-config"],
    queryFn: getContratoConfig,
    enabled: tipo === "contrato",
  });
  const infoAgencia = useQuery({
    queryKey: ["agency-info"],
    queryFn: getAgencyInfo,
    enabled: tipo === "contrato" && !carregandoSessao,
  });

  if (tipo !== "orcamento" && tipo !== "contrato")
    return <div className="doc-estado">Documento não encontrado.</div>;
  if (
    carregandoSessao ||
    lead.isLoading ||
    (clientId && cliente.isLoading) ||
    (tipo === "contrato" && (modelo.isLoading || infoAgencia.isLoading))
  ) {
    return <div className="doc-estado">Preparando o documento…</div>;
  }
  if (!lead.data)
    return (
      <div className="doc-estado">
        Não foi possível abrir esta viagem. Entre no sistema e tente de novo.
      </div>
    );

  const v = lead.data;
  const c = cliente.data ?? null;
  const info = infoAgencia.data;
  const agencia = info?.name || brand?.name || "";
  const endAgencia = info
    ? [
        [info.address.street, info.address.number].filter(Boolean).join(", "),
        info.address.complement,
        info.address.district,
        [info.address.city, info.address.state].filter(Boolean).join(" - "),
        info.address.cep ? `CEP ${info.address.cep}` : "",
      ]
        .map((x) => (x ?? "").trim())
        .filter(Boolean)
        .join(", ")
    : "";
  const orc = lerOrcamento(v);
  const itens = orc.itens.filter((i) => i.descricao.trim());
  const titulo = tipo === "orcamento" ? "Orçamento de viagem" : "Contrato";

  return (
    <div className="doc">
      <style>{CSS}</style>
      <header className="doc-barra">
        <span>
          {titulo} · {v.name}
        </span>
        <button type="button" onClick={() => window.print()}>
          <Download size={16} /> Salvar PDF
        </button>
      </header>

      <main className="doc-folha">
        <div className="doc-topo">
          {brand?.logoUrl ? (
            <img src={brand.logoUrl} alt={agencia} />
          ) : (
            <b className="doc-agencia">{agencia}</b>
          )}
          <div className="doc-topo-txt">
            <span>{titulo}</span>
            <small>{dataExtenso(new Date().toISOString())}</small>
          </div>
        </div>

        {tipo === "orcamento" ? (
          <>
            <h1>{v.destination || "Sua viagem"}</h1>
            <dl className="doc-dados">
              <div>
                <dt>Cliente</dt>
                <dd>{c?.name || v.name}</dd>
              </div>
              <div>
                <dt>Quando</dt>
                <dd>{quandoTexto(v) || "A definir"}</dd>
              </div>
              <div>
                <dt>Viajantes</dt>
                <dd>{passageirosTexto(v) || "A definir"}</dd>
              </div>
              {orc.validade && (
                <div>
                  <dt>Válido até</dt>
                  <dd>{dataExtenso(orc.validade)}</dd>
                </div>
              )}
            </dl>

            <table className="doc-itens">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {itens.length ? (
                  itens.map((i) => (
                    <tr key={i.id}>
                      <td>{i.descricao}</td>
                      <td>{dinheiro(i.valor)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2}>Nenhum item no orçamento.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th>{dinheiro(totalOrcamento(orc))}</th>
                </tr>
              </tfoot>
            </table>

            {orc.condicoes.trim() && (
              <section>
                <h2>Condições de pagamento</h2>
                <p>{orc.condicoes}</p>
              </section>
            )}
            {orc.observacoes.trim() && (
              <section>
                <h2>Observações</h2>
                <p>{orc.observacoes}</p>
              </section>
            )}
            <p className="doc-nota">
              Valores sujeitos à disponibilidade dos fornecedores até a confirmação da reserva
              {orc.validade ? `. Proposta válida até ${dataExtenso(orc.validade)}.` : "."}
            </p>
          </>
        ) : (
          <>
            <pre className="doc-contrato">
              {preencherContrato(
                modelo.data?.modelo ?? "",
                dadosDoContrato(v, c, {
                  nome: agencia,
                  cnpj: info?.cnpj,
                  endereco: endAgencia,
                  email: info?.email,
                  telefone: info?.phone,
                }),
              )}
            </pre>
            <div className="doc-assinaturas">
              <div>
                <span />
                {c?.name || v.name}
                <small>CONTRATANTE</small>
              </div>
              <div>
                <span />
                {agencia || "Agência"}
                <small>CONTRATADA</small>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const CSS = `
.doc { min-height: 100vh; background: #e9e6e2; color: #17130f; font-family: var(--font-sans, Inter, sans-serif); }
.doc-estado { padding: 48px; text-align: center; font-family: Inter, sans-serif; }
.doc-barra { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px; background: #17130f; color: #fafaf9; font-size: 14px; }
.doc-barra button { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border: 0; border-radius: 999px; background: #f58e26; color: #1a0f05; font-weight: 600; cursor: pointer; }
.doc-folha { box-sizing: border-box; width: min(210mm, 100%); min-height: 297mm; margin: 24px auto; padding: 18mm 16mm; background: #fff; box-shadow: 0 10px 40px rgba(0,0,0,.12); }
.doc-topo { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 16px; border-bottom: 2px solid #17130f; }
.doc-topo img { max-height: 52px; max-width: 200px; object-fit: contain; }
.doc-agencia { font: 700 22px/1.1 var(--font-display, sans-serif); }
.doc-topo-txt { display: flex; flex-direction: column; align-items: flex-end; text-align: right; }
.doc-topo-txt span { font: 600 11px var(--font-sans, sans-serif); letter-spacing: .12em; text-transform: uppercase; }
.doc-topo-txt small { color: #6b645d; font-size: 12px; }
.doc h1 { margin: 28px 0 16px; font: 700 30px/1.1 var(--font-display, sans-serif); }
.doc h2 { margin: 0 0 6px; font: 600 11px var(--font-sans, sans-serif); letter-spacing: .1em; text-transform: uppercase; color: #6b645d; }
.doc section { margin-top: 20px; }
.doc section p { margin: 0; white-space: pre-wrap; line-height: 1.6; }
.doc-dados { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 24px; margin: 0 0 24px; padding: 16px; border-radius: 10px; background: #f6f4f1; }
.doc-dados dt { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #6b645d; }
.doc-dados dd { margin: 2px 0 0; font-weight: 600; }
.doc-itens { width: 100%; border-collapse: collapse; font-size: 14px; }
.doc-itens th, .doc-itens td { padding: 10px 8px; border-bottom: 1px solid #e5e1dc; text-align: left; }
.doc-itens th:last-child, .doc-itens td:last-child { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.doc-itens thead th { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #6b645d; }
.doc-itens tfoot th { border-bottom: 0; border-top: 2px solid #17130f; font-size: 17px; }
.doc-nota { margin-top: 28px; font-size: 12px; color: #6b645d; }
.doc-contrato { margin: 24px 0 0; white-space: pre-wrap; font: 13.5px/1.65 var(--font-sans, Inter, sans-serif); }
.doc-assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 64px; font-size: 13px; text-align: center; }
.doc-assinaturas span { display: block; margin-bottom: 8px; border-top: 1px solid #17130f; }
.doc-assinaturas small { display: block; margin-top: 2px; font-size: 11px; letter-spacing: .1em; color: #6b645d; }
@media print {
  @page { size: A4; margin: 0; }
  .doc { background: #fff; }
  .doc-barra { display: none; }
  .doc-folha { margin: 0; box-shadow: none; width: auto; min-height: 0; }
}
`;
