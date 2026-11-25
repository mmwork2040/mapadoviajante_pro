import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageUp, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { ID, storage, APPWRITE_BUCKET_ID } from "@/integrations/appwrite/client";
import { getMyBrandConfig, saveMyBrand } from "@/lib/brand.functions";
import {
  PRODUCT,
  applyBrandColor,
  brandLogoUrl,
  cacheBrand,
  normalizeHex,
  readableOn,
  type BrandConfig,
} from "@/lib/brand";
import { useAuth } from "@/lib/auth";

const MAX_LOGO_BYTES = 1024 * 1024;
const LOGO_TYPES = ["image/png", "image/svg+xml", "image/webp", "image/jpeg"];

type Slot = "logoFileId" | "logoDarkFileId";

/**
 * Marca do sistema para a agência (white-label): logo e cor principal.
 * O nome do produto, as fontes e o tema continuam os do Mapa do Viajante PRO.
 */
export function AppBrandCard() {
  const { member } = useAuth();
  const agencyId = member?.agency_id ?? "";
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<BrandConfig | null>(null);
  const [failed, setFailed] = useState(false);
  const [colorText, setColorText] = useState("");
  const [uploading, setUploading] = useState<Slot | null>(null);
  const [saving, setSaving] = useState(false);
  const saved = useRef<BrandConfig | null>(null);

  useEffect(() => {
    let active = true;
    getMyBrandConfig()
      .then((c) => {
        if (!active) return;
        saved.current = c;
        setCfg(c);
        setColorText(c.primary ?? "");
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      // Saiu sem salvar: a tela volta para a cor que está gravada.
      if (saved.current) applyBrandColor(saved.current.primary);
    };
  }, []);

  if (failed) {
    return <p className="text-sm text-destructive">Não foi possível carregar a marca. Recarregue a página.</p>;
  }
  if (!cfg) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  const color = cfg.primary ?? PRODUCT.primary;
  const colorInvalid = colorText.trim() !== "" && !normalizeHex(colorText);

  function setColor(value: string) {
    setColorText(value);
    const hex = normalizeHex(value);
    if (value.trim() === "") {
      setCfg((c) => (c ? { ...c, primary: null } : c));
      applyBrandColor(null);
    } else if (hex) {
      setCfg((c) => (c ? { ...c, primary: hex } : c));
      applyBrandColor(hex); // prévia ao vivo
    }
  }

  async function upload(slot: Slot, file: File | undefined) {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return toast.error("Use uma imagem PNG, SVG, WebP ou JPG.");
    if (file.size > MAX_LOGO_BYTES) return toast.error("A logo precisa ter até 1 MB.");
    setUploading(slot);
    try {
      const created = await storage.createFile(APPWRITE_BUCKET_ID, ID.unique(), file);
      setCfg((c) => (c ? { ...c, [slot]: created.$id } : c));
      toast.success("Logo enviada. Clique em Salvar marca para aplicar.");
    } catch (err) {
      console.error("upload da logo:", err);
      toast.error("Não foi possível enviar a logo.");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (!cfg || colorInvalid) return;
    setSaving(true);
    try {
      const brand = await saveMyBrand({ data: cfg });
      // Apaga do bucket as logos que deixaram de ser usadas.
      const before = saved.current;
      for (const slot of ["logoFileId", "logoDarkFileId"] as const) {
        const old = before?.[slot];
        if (old && old !== cfg.logoFileId && old !== cfg.logoDarkFileId) {
          storage.deleteFile(APPWRITE_BUCKET_ID, old).catch(() => undefined);
        }
      }
      saved.current = cfg;
      cacheBrand(brand);
      applyBrandColor(brand?.primary);
      qc.setQueryData(["brand", agencyId], brand);
      toast.success("Marca salva.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a marca.");
    } finally {
      setSaving(false);
    }
  }

  const slots: { slot: Slot; title: string; hint: string; dark: boolean }[] = [
    { slot: "logoFileId", title: "Logo para fundo claro", hint: "Versão escura da logo. Aparece no tema claro.", dark: false },
    {
      slot: "logoDarkFileId",
      title: "Logo para fundo escuro",
      hint: "Versão clara da logo. Aparece no tema escuro e no roteiro do cliente.",
      dark: true,
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        A logo e a cor principal da sua agência aparecem no menu, nos botões, na página de captação e no roteiro
        enviado ao cliente. Sem logo, aparece a marca {PRODUCT.name}.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {slots.map(({ slot, title, hint, dark }) => {
          const fileId = cfg[slot];
          const otherId = cfg[slot === "logoFileId" ? "logoDarkFileId" : "logoFileId"];
          const isSaved = Boolean(fileId) && saved.current?.[slot] === fileId;
          return (
            <div key={slot} className="rounded-[18px] border border-border p-4">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
              <div
                className="mt-3 flex h-24 items-center justify-center rounded-xl border border-border px-4"
                style={{ background: dark ? "#0f0c0a" : "#fafaf9" }}
              >
                {fileId && isSaved ? (
                  <img
                    src={brandLogoUrl(agencyId, dark ? "dark" : "light", fileId)}
                    alt={title}
                    className="max-h-16 max-w-full object-contain"
                  />
                ) : fileId ? (
                  <span className="text-xs" style={{ color: dark ? "#cfc7be" : "#6b645d" }}>
                    Logo enviada. Salve para ver aqui.
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: dark ? "#cfc7be" : "#6b645d" }}>
                    {otherId ? "Usa a outra logo" : `Marca ${PRODUCT.name}`}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-input px-3.5 py-2 text-sm font-medium hover:bg-muted">
                  {uploading === slot ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
                  {fileId ? "Trocar" : "Enviar logo"}
                  <input
                    type="file"
                    accept={LOGO_TYPES.join(",")}
                    className="sr-only"
                    disabled={uploading !== null}
                    onChange={(e) => {
                      void upload(slot, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {fileId && (
                  <button
                    type="button"
                    onClick={() => setCfg((c) => (c ? { ...c, [slot]: null } : c))}
                    className="inline-flex items-center gap-2 rounded-full border border-input px-3.5 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" /> Remover
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-[18px] border border-border p-4">
        <p className="text-sm font-semibold">Cor principal</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Usada nos botões de ação, na seleção e no progresso. Os tons de apoio são calculados a partir dela.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="color"
            aria-label="Escolher a cor principal"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-11 w-14 cursor-pointer rounded-xl border border-input bg-transparent p-1"
          />
          <label className="block">
            <span className="sr-only">Código da cor</span>
            <input
              value={colorText}
              onChange={(e) => setColor(e.target.value)}
              placeholder={PRODUCT.primary}
              maxLength={7}
              spellCheck={false}
              aria-invalid={colorInvalid}
              className="h-11 w-32 rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-primary"
            />
          </label>
          <button
            type="button"
            onClick={() => setColor("")}
            className="inline-flex items-center gap-2 rounded-full border border-input px-3.5 py-2 text-sm font-medium hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" /> Cor padrão
          </button>
          <span
            className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold"
            style={{ background: color, color: readableOn(color) }}
          >
            Exemplo de botão
          </span>
        </div>
        {colorInvalid && <p className="mt-2 text-xs text-destructive">Use o formato #rrggbb, por exemplo {PRODUCT.primary}.</p>}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || colorInvalid || uploading !== null}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Salvar marca
      </button>
    </div>
  );
}
