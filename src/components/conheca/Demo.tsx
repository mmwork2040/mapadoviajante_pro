import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Play, Sparkle, X } from "@phosphor-icons/react";
import { CascaApp, Escala, type TelaId } from "./molduras";
import {
  TelaAgenda,
  TelaBiblioteca,
  TelaFinanceiro,
  TelaHoje,
  TelaViagens,
  TelaViajantes,
} from "./telas";

const DICAS: Record<TelaId, string> = {
  hoje: "Tudo o que pede atenção hoje. Clique nos círculos para concluir os compromissos.",
  viagens: "Arraste as viagens entre as etapas ou use Avançar. Troque para Lista ou Preparação.",
  viajantes: "O perfil guarda família, documentos, preferências e todo o histórico do viajante.",
  agenda: "Retornos, prazos e embarques entram sozinhos. Alterne entre Semana e Lista.",
  biblioteca: "Seus passeios e hotéis salvos para reaproveitar. Filtre por tipo.",
  financeiro: "Vendas, comissões e parcelas do mês, só para quem você liberar.",
};
const ORDEM: TelaId[] = ["hoje", "viagens", "viajantes", "agenda", "biblioteca", "financeiro"];

/** Agência de exemplo navegável. Roda só no navegador; nada é salvo. */
export function Demo({ onClose }: { onClose: () => void }) {
  const [tela, setTela] = useState<TelaId>("hoje");
  const prox = ORDEM[(ORDEM.indexOf(tela) + 1) % ORDEM.length];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="dark fixed inset-0 z-50 flex flex-col bg-[rgba(8,6,5,0.92)] text-foreground backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Demonstração do sistema"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-[var(--sidebar)] px-4 py-2.5 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-accent-foreground">
          <Play weight="fill" /> Modo demonstração
        </span>
        <span className="hidden text-muted-foreground md:inline">
          Agência de exemplo · dados fictícios · nada é salvo
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            Criar minha conta
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar demonstração"
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
      </div>

      {/* No celular o menu lateral do print some; estas abas fazem o papel dele. */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 lg:hidden">
        {ORDEM.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTela(t)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium capitalize ${tela === t ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex items-start gap-2.5 px-5 py-3 text-sm text-[var(--foreground-soft)]">
        <Sparkle weight="fill" className="mt-0.5 shrink-0 text-primary" />
        <span className="flex-1">{DICAS[tela]}</span>
        <button
          type="button"
          onClick={() => setTela(prox)}
          className="hidden shrink-0 items-center gap-1 font-semibold text-accent-foreground hover:underline sm:inline-flex"
        >
          Próxima tela <ArrowRight weight="bold" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 sm:px-6">
        <div className="mx-auto max-w-[1280px] overflow-hidden rounded-[18px] border border-border">
          <Escala altura={860} largura={1240}>
            {(compacta) => (
              <CascaApp ativa={tela} onNavegar={setTela} compacta={compacta}>
                {tela === "hoje" && <TelaHoje compacta={compacta} />}
                {tela === "viagens" && <TelaViagens compacta={compacta} />}
                {tela === "viajantes" && <TelaViajantes compacta={compacta} />}
                {tela === "agenda" && <TelaAgenda compacta={compacta} />}
                {tela === "biblioteca" && <TelaBiblioteca compacta={compacta} />}
                {tela === "financeiro" && <TelaFinanceiro compacta={compacta} />}
              </CascaApp>
            )}
          </Escala>
        </div>
        <div className="mx-auto mt-6 flex max-w-xl flex-col items-center gap-3 text-center">
          <p className="font-display text-xl font-bold">Gostou? Comece com as suas viagens.</p>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
          >
            Criar minha conta <ArrowRight weight="bold" />
          </Link>
        </div>
      </div>
    </div>
  );
}
