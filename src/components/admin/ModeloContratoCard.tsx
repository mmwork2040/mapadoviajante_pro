import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { CAMPOS_CONTRATO, MODELO_CONTRATO_PADRAO } from "@/data/documentos";
import { getContratoConfig, saveContratoConfig } from "@/lib/contrato-config";

/** Editor do modelo de contrato da agência (Configurações). */
export function ModeloContratoCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["contrato-config"], queryFn: getContratoConfig });
  const [texto, setTexto] = useState("");
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (q.data) setTexto(q.data.modelo);
  }, [q.data]);

  const salvar = useMutation({
    mutationFn: () => saveContratoConfig({ modelo: texto }),
    onSuccess: () => {
      toast.success("Modelo de contrato salvo.");
      qc.invalidateQueries({ queryKey: ["contrato-config"] });
    },
    onError: () => toast.error("Não foi possível salvar o modelo."),
  });

  // Coloca o campo onde está o cursor.
  const inserir = (chave: string) => {
    const el = campo.current;
    const tag = `{{${chave}}}`;
    if (!el) return setTexto((t) => t + tag);
    const ini = el.selectionStart ?? texto.length;
    const fim = el.selectionEnd ?? texto.length;
    const novo = texto.slice(0, ini) + tag + texto.slice(fim);
    setTexto(novo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + tag.length, ini + tag.length);
    });
  };

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando o modelo…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Na ficha da viagem, aba <b>Contrato</b>, este texto sai preenchido com os dados do cliente,
        da viagem, do orçamento e da agência (Dados da Agência). Clique num campo para inseri-lo
        onde está o cursor.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {CAMPOS_CONTRATO.map((c) => (
          <button
            key={c.chave}
            type="button"
            title={c.descricao}
            onClick={() => inserir(c.chave)}
            className="rounded-full border border-input px-2.5 py-1 font-mono text-[11px] hover:bg-muted"
          >
            {`{{${c.chave}}}`}
          </button>
        ))}
      </div>
      <textarea
        ref={campo}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={18}
        className="w-full rounded-xl border border-input bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:border-primary"
      />
      <p className="text-xs text-muted-foreground">
        O modelo padrão é uma referência. Revise o texto com o advogado da agência antes de usar com
        clientes.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => salvar.mutate()}
          disabled={salvar.isPending || !texto.trim()}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {salvar.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar modelo
        </button>
        <button
          type="button"
          onClick={() => setTexto(MODELO_CONTRATO_PADRAO)}
          className="flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <RotateCcw className="h-4 w-4" /> Voltar ao modelo padrão
        </button>
      </div>
    </div>
  );
}
