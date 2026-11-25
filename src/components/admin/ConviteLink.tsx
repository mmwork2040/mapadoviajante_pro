import { useRef, useState } from "react";
import { Check, Copy, Link2, Mail, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { ScrollLock } from "@/components/ScrollLock";

export type ConviteCriado = {
  inviteUrl: string;
  agencyName: string;
  name: string;
  email: string;
  /** true quando o convite também saiu por e-mail. */
  emailSent?: boolean;
};

/** Mensagem pronta para mandar o convite pelo WhatsApp (ou onde a pessoa preferir). */
function mensagemDoConvite(c: ConviteCriado) {
  const primeiro = c.name.trim().split(/\s+/)[0] || "Oi";
  const agencia = c.agencyName ? `da ${c.agencyName}` : "da nossa agência";
  return (
    `Oi, ${primeiro}! Você foi convidado para a equipe ${agencia} no MapaPRO.\n\n` +
    `Abra o link e crie sua conta com o e-mail ${c.email}:\n${c.inviteUrl}`
  );
}

async function copiar(texto: string, campo: HTMLInputElement | null) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Sem permissão de área de transferência: seleciona o campo para copiar à mão.
    campo?.focus();
    campo?.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    }
  }
}

/** Link do convite com os botões de copiar e de enviar pelo WhatsApp. */
export function ConviteLink({ convite }: { convite: ConviteCriado }) {
  const campo = useRef<HTMLInputElement>(null);
  const [copiado, setCopiado] = useState(false);

  async function copiarLink() {
    const ok = await copiar(convite.inviteUrl, campo.current);
    if (ok) {
      setCopiado(true);
      toast.success("Link do convite copiado.");
      window.setTimeout(() => setCopiado(false), 2000);
    } else {
      toast.error("Não foi possível copiar. Selecione o link e copie.");
    }
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(mensagemDoConvite(convite))}`;

  return (
    <div className="space-y-3">
      {convite.emailSent ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Convite enviado para <strong>{convite.email}</strong>. Se preferir, mande também o link
            abaixo.
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Envie este link para{" "}
          <strong className="text-foreground">{convite.name || convite.email}</strong>. A pessoa
          cria a conta com o e-mail <strong className="text-foreground">{convite.email}</strong> e
          já entra na equipe.
        </p>
      )}

      <label className="block">
        <span className="mb-1 flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="h-4 w-4" /> Link do convite
        </span>
        <input
          ref={campo}
          readOnly
          value={convite.inviteUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-lg border border-input bg-muted px-3 py-2 font-mono text-xs outline-none focus:border-primary"
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={copiarLink}
          className="flex items-center justify-center gap-2 rounded-lg border border-input bg-background py-2.5 text-sm font-semibold hover:bg-muted"
        >
          {copiado ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          {copiado ? "Copiado" : "Copiar link"}
        </button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" /> Enviar pelo WhatsApp
        </a>
      </div>

      <p className="text-xs text-muted-foreground">
        O link só funciona para o e-mail convidado e deixa de valer se o convite for revogado.
      </p>
    </div>
  );
}

/** Janela com o link de um convite já existente (botão "Link" na lista da equipe). */
export function ConviteLinkJanela({
  convite,
  onClose,
}: {
  convite: ConviteCriado;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <ScrollLock />
      <div
        className="w-full max-w-md rounded-2xl bg-card p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Link do convite"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Link do convite</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <ConviteLink convite={convite} />
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90"
        >
          Pronto
        </button>
      </div>
    </div>
  );
}
