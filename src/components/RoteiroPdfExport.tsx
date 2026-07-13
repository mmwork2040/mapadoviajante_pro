import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Loader2, Hotel, MapPin, Clock, Check, AlertTriangle, Eye, X } from "lucide-react";
import { toast } from "sonner";
import type { Itinerary, ItineraryActivity, ItineraryDay, LibraryItem } from "@/lib/types";
import { fetchLibraryItems, resolveDisplayImageUrl } from "@/lib/services";
import { getAgencyBranding, DEFAULT_BRANDING, type AgencyBranding } from "@/lib/agency";


// ============================================================================
// Paleta / tokens visuais do PDF (fixos — o layout do PDF é independente do tema)
// ============================================================================
const GOLD = "#B8965A";
const GOLD_DARK = "#A07B3B";
const BEIGE = "#F5EFE6";
const INK = "#2C2A27";
const SLATE = "#5B6B78";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function formatDayDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm} - ${WEEKDAYS[d.getDay()]}`;
}

const CHECKLIST: { text: string; alert?: boolean }[] = [
  { text: "Passaporte com pelo menos 6 meses de validade", alert: true },
  { text: "Certificado internacional de vacinação (quando exigido)", alert: true },
  { text: "Apólice de seguro viagem impressa e digital", alert: true },
  { text: "Cartões de crédito e débito habilitados para uso no exterior" },
  { text: "Dinheiro em espécie — pelo menos o valor de vistos + passeios extras", alert: true },
  { text: "Roupas leves e confortáveis" },
  { text: "Peças adequadas ao clima e à cultura local" },
  { text: "Calçados confortáveis para caminhadas e tênis" },
  { text: "Roupas de banho e saída de praia (se aplicável)" },
  { text: "Óculos de sol e chapéu/boné" },
  { text: "Protetor solar e pós-sol" },
  { text: "Adaptador universal de tomada" },
  { text: "Carregador portátil" },
];

const SERVICOS_INCLUSOS = [
  "Entradas em todos os locais citados no roteiro",
  "Traslados privativos conforme itinerário",
  "Guia acompanhante em português durante os passeios",
  "Assistência no aeroporto e suporte local",
];

const SERVICOS_NAO_INCLUSOS = [
  "Voos internacionais",
  "Vistos de entrada",
  "Despesas pessoais",
  "Passeios opcionais",
  "Todas as despesas não descritas neste guia",
];

// Arco decorativo removido: os cantos agora usam apenas a logo "presa" (Brandmark).
function CornerBlobs(_props: { gold?: string }) {
  return null;
}

// Clipe metálico que "prende" a logo no canto.
function PaperClip() {
  return (
    <svg
      width="22"
      height="34"
      viewBox="0 0 22 34"
      fill="none"
      style={{ display: "block", filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,.35))" }}
    >
      <path
        d="M11 3 C6 3 3 6 3 11 L3 24 C3 28 6 31 10 31 C14 31 17 28 17 24 L17 9 C17 6.5 15 5 13 5 C11 5 9 6.5 9 9 L9 23"
        stroke="url(#clipGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <defs>
        <linearGradient id="clipGrad" x1="0" y1="0" x2="22" y2="0">
          <stop offset="0" stopColor="#c9ccd1" />
          <stop offset="0.45" stopColor="#8b8f96" />
          <stop offset="0.55" stopColor="#f0f2f5" />
          <stop offset="1" stopColor="#9aa0a8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Selo nos cantos: um cartãozinho branco levemente girado em 3D, "preso" por um
// clipe metálico. Mostra a logo da agência ou, como padrão, o wordmark.
function Brandmark({
  light,
  logoUrl,
  goldDark = GOLD_DARK,
}: {
  light?: boolean;
  logoUrl?: string | null;
  goldDark?: string;
}) {
  const inner = logoUrl ? (
    <img
      src={logoUrl}
      crossOrigin="anonymous"
      alt=""
      style={{ maxHeight: "15mm", maxWidth: "40mm", objectFit: "contain", display: "block" }}
    />
  ) : (
    <div style={{ lineHeight: 1, textAlign: "right" }}>
      <span style={{ display: "block", fontFamily: "Fredoka, sans-serif", fontWeight: 600, fontSize: "10pt", color: goldDark }}>
        O segredo
      </span>
      <span style={{ display: "block", fontFamily: "'Dancing Script', cursive", fontWeight: 700, fontSize: "14pt", color: goldDark, marginTop: "-2px" }}>
        Viajante
      </span>
    </div>
  );
  return (
    <div style={{ position: "relative", perspective: "300px" }}>
      <div
        style={{
          background: "#fff",
          padding: "5mm 6mm",
          borderRadius: "3px",
          boxShadow: "0 6px 14px rgba(0,0,0,.22), 0 1px 2px rgba(0,0,0,.15)",
          transform: "rotateX(6deg) rotateY(-14deg) rotate(3deg)",
          transformOrigin: "top right",
        }}
      >
        {inner}
      </div>
      <div style={{ position: "absolute", top: "-6mm", right: "6mm", transform: "rotate(10deg)" }}>
        <PaperClip />
      </div>
    </div>
  );
}

// Uma página física A4.
function Page({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: "210mm",
        height: "296mm",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        fontFamily: "Fredoka, sans-serif",
        color: INK,
        ...style,
      }}
      className="pdf-page"
    >
      {children}
    </div>
  );
}

function activityLines(activities: ItineraryActivity[] = []) {
  return activities
    .filter((a) => a.type !== "done")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function findHotel(day: ItineraryDay): string | null {
  const hotel = (day.activities || []).find((a) => a.type === "hotel");
  return hotel?.title || null;
}

function norm(s?: string | null): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokens(s?: string | null): string[] {
  return Array.from(new Set(norm(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3)));
}

// Escolhe, entre as imagens da biblioteca, as fotos mais relacionadas à
// atividade (até `max`), montando um pequeno álbum quando há mais de um ponto
// turístico/local relacionado. Validação rígida: só aceita imagens quando há
// CERTEZA de compatibilidade, confirmando a CIDADE/LOCAL e ao menos um sinal do
// conteúdo base (título, descrição) ou das tags. Em caso de dúvida, ignora.
function pickLibraryImages(
  a: ItineraryActivity,
  images: LibraryItem[],
  used: Set<string>,
  max = 3,
): LibraryItem[] {
  const locTokens = tokens(a.location);
  // Sem local/cidade definidos não há como garantir compatibilidade.
  if (locTokens.length === 0) return [];
  const contentTokens = new Set([...tokens(a.title), ...tokens(a.description)]);

  const scored: { item: LibraryItem; score: number }[] = [];
  for (const img of images) {
    const src = img.image_url || img.file_url;
    if (!src) continue;
    const imgLoc = new Set([...tokens(img.location), ...tokens(img.title)]);
    const imgTags = new Set(tokens((img.tags || []).join(" ")));
    const imgContent = new Set([...tokens(img.title), ...tokens(img.description), ...tokens(img.content)]);

    // 1) A CIDADE precisa bater: algum token do local da atividade tem que
    // aparecer no local/título da imagem OU nas tags dela.
    const cityMatch = locTokens.some((t) => imgLoc.has(t) || imgTags.has(t));
    if (!cityMatch) continue;

    // 2) Além da cidade, precisa de confirmação pelo conteúdo base ou tags.
    let score = locTokens.filter((t) => imgLoc.has(t)).length * 2;
    for (const t of contentTokens) {
      if (imgContent.has(t)) score += 2;
      if (imgTags.has(t)) score += 1;
    }
    // Exige confirmação além da simples coincidência de cidade.
    if (score < 3) continue;
    if (used.has(src)) score -= 2; // penaliza reuso, mas não descarta
    scored.push({ item: img, score });
  }
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, max).map((s) => s.item);
}

// Mescla, de forma resumida, as descrições/conhecimento dos locais encontrados
// na biblioteca, para enriquecer a atividade com um pequeno texto sobre os
// lugares. Mantém o resultado curto para não quebrar o layout do PDF.
function mergeDescriptions(items: LibraryItem[]): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const it of items) {
    const t = (it.description || it.content || "").replace(/\s+/g, " ").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    parts.push(t);
  }
  if (parts.length === 0) return "";
  let joined = parts.join(" ");
  if (joined.length > 320) {
    joined = joined.slice(0, 320);
    const lastDot = joined.lastIndexOf(".");
    joined = lastDot > 160 ? joined.slice(0, lastDot + 1) : joined.trim() + "…";
  }
  return joined;
}

// Estima a altura (mm) que uma atividade ocupará no PDF, para paginar sem quebra.
function estimateActivityHeight(a: ItineraryActivity, imgCount: number, note?: string): number {
  const descLines = a.description ? Math.ceil(a.description.length / 52) : 0;
  const noteLines = note ? Math.ceil(note.length / 58) : 0;
  const textH = 9 + descLines * 5 + noteLines * 4.5 + (a.location ? 6 : 0);
  const imageH = imgCount >= 2 ? 62 : 42; // álbum ocupa mais que uma foto única
  return Math.max(textH, imageH) + 8;
}

// Uma foto no estilo "polaroid" (fundo branco + sombra + leve rotação).
function Polaroid({ src, w, h, rotate }: { src: string; w: string; h: string; rotate: number }) {
  return (
    <div
      style={{
        flexShrink: 0,
        background: "#fff",
        padding: "1mm 1mm 2.5mm",
        boxShadow: "0 3px 9px rgba(0,0,0,.18)",
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <img
        src={src}
        crossOrigin="anonymous"
        alt=""
        style={{ width: w, height: h, objectFit: "cover", display: "block" }}
      />
    </div>
  );
}

// Álbum de fotos da atividade: uma única foto quando há apenas uma; um pequeno
// mosaico (até 3 fotos) quando a atividade reúne vários pontos turísticos.
function ActivityImageBox({ images }: { images: string[] }) {
  const imgs = images.slice(0, 3);
  if (imgs.length === 0) return null;
  if (imgs.length === 1) {
    return (
      <div style={{ flexShrink: 0, transform: "rotate(1.5deg)" }}>
        <Polaroid src={imgs[0]} w="52mm" h="36mm" rotate={0} />
      </div>
    );
  }
  return (
    <div style={{ flexShrink: 0, width: "56mm", display: "flex", flexDirection: "column", gap: "2mm", alignItems: "center" }}>
      <Polaroid src={imgs[0]} w="52mm" h="30mm" rotate={-1.5} />
      <div style={{ display: "flex", gap: "2mm", justifyContent: "center" }}>
        {imgs.slice(1).map((u, i) => (
          <Polaroid key={i} src={u} w="24mm" h="20mm" rotate={i % 2 === 0 ? 2 : -2} />
        ))}
      </div>
    </div>
  );
}

// Placeholder harmonizado usado quando nenhuma imagem da biblioteca passou na
// validação (cidade + conteúdo base + tags). Mantém o mesmo tamanho da caixa de
// imagem para não quebrar o layout do dia no PDF.
function ActivityImagePlaceholder({ label }: { label?: string }) {
  return (
    <div
      style={{
        flexShrink: 0,
        position: "relative",
        background: "#fff",
        padding: "1.5mm 1.5mm 4mm",
        boxShadow: "0 4px 12px rgba(0,0,0,.15)",
        transform: "rotate(1.5deg)",
      }}
    >
      <div
        style={{
          width: "52mm",
          height: "36mm",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "2mm",
          background: `linear-gradient(135deg, ${BEIGE} 0%, #ECE3D4 100%)`,
          border: `1px dashed ${GOLD}`,
          color: GOLD_DARK,
          textAlign: "center",
          padding: "2mm",
        }}
      >
        <MapPin size={22} />
        <span style={{ fontFamily: "Fredoka, sans-serif", fontSize: "8.5pt", fontWeight: 600, lineHeight: 1.2 }}>
          {label || "Imagem em breve"}
        </span>
      </div>
    </div>
  );
}




export function RoteiroPdfExport({ it, coverUrl }: { it: Itinerary; coverUrl: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Imagens resolvidas da biblioteca por atividade (id -> URL exibível).
  const [actImages, setActImages] = useState<Record<string, string[]>>({});
  // Resumo mesclado dos locais (biblioteca) por atividade.
  const [actNotes, setActNotes] = useState<Record<string, string>>({});
  // Personalização da marca (logo, textos de abertura e cores) da agência.
  const [branding, setBranding] = useState<AgencyBranding>({ ...DEFAULT_BRANDING });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const b = await getAgencyBranding();
      if (!active) return;
      setBranding(b);
      if (b.logoPath) {
        const u = await resolveDisplayImageUrl(b.logoPath);
        if (active) setLogoUrl(u);
      } else {
        setLogoUrl(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Cores e textos aplicados (com fallback ao padrão). Estes nomes sombreiam as
  // constantes de módulo, então todas as referências no corpo do PDF usam a marca.
  const GOLD = branding.colorGold || DEFAULT_BRANDING.colorGold!;
  const GOLD_DARK = branding.colorGoldDark || DEFAULT_BRANDING.colorGoldDark!;
  const openingTitle = (branding.openingTitle || "").trim();
  const openingSubtitle = (branding.openingSubtitle || "").trim();
  const openingFooter = (branding.openingFooter || "").trim();

  const destino = it.destination || it.title || "Sua Viagem";
  const cliente = it.client_name || it.lead?.name || "Viajante";
  const days = useMemo(
    () => [...(it.days || [])].sort((a, b) => (a.sort_order ?? a.day_number ?? 0) - (b.sort_order ?? b.day_number ?? 0)),
    [it.days],
  );

  const heroImg = coverUrl || "";

  async function waitForImages(root: HTMLElement) {
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      imgs.map((img) => {
        if (!img.getAttribute("src")) return Promise.resolve();
        const done = () =>
          img.decode?.().catch(() => undefined) ?? Promise.resolve();
        if (img.complete && img.naturalWidth > 0) return done();
        return new Promise<void>((resolve) => {
          const finish = () => {
            img.removeEventListener("load", finish);
            img.removeEventListener("error", finish);
            done().finally(() => resolve());
          };
          img.addEventListener("load", finish);
          img.addEventListener("error", finish);
          // Fallback timeout so a stalled image never blocks export forever.
          setTimeout(finish, 8000);
        });
      }),
    );
  }

  // Para cada atividade: se já tiver imagem própria, usa-a (resolvendo a URL
  // exibível); caso contrário, busca na biblioteca uma foto compatível.
  async function resolveActivityImages(): Promise<{ images: Record<string, string[]>; notes: Record<string, string> }> {
    let images: LibraryItem[] = [];
    try {
      images = await fetchLibraryItems("image");
    } catch {
      images = [];
    }
    const used = new Set<string>();
    const map: Record<string, string[]> = {};
    const notes: Record<string, string> = {};
    for (const day of days) {
      for (const a of activityLines(day.activities)) {
        if (a.type === "hotel") continue;

        // 1) Imagens já adicionadas na atividade têm prioridade.
        const own = (a.images || []).map((i) => i.url).filter(Boolean) as string[];
        if (own.length) {
          const resolved: string[] = [];
          for (const u of own) {
            const url = await resolveDisplayImageUrl(u);
            if (url) resolved.push(url);
          }
          if (resolved.length) {
            map[a.id] = resolved;
            continue;
          }
        }

        // 2) Sem imagem própria: busca até 3 fotos compatíveis na biblioteca,
        // formando um pequeno álbum, e mescla um resumo dos locais.
        if (images.length === 0) continue;
        const hits = pickLibraryImages(a, images, used, 3);
        const urls: string[] = [];
        for (const h of hits) {
          const src = h.image_url || h.file_url;
          if (!src) continue;
          const url = await resolveDisplayImageUrl(src);
          if (url) {
            urls.push(url);
            used.add(src);
          }
        }
        if (urls.length) map[a.id] = urls;
        const note = mergeDescriptions(hits);
        if (note) notes[a.id] = note;
      }
    }
    return { images: map, notes };
  }

  async function handleExport() {
    if (!containerRef.current) return;
    setBusy(true);
    try {
      // 1) Enriquecer atividades sem imagem com fotos da biblioteca.
      const { images: map, notes } = await resolveActivityImages();
      setActImages(map);
      setActNotes(notes);
      // Aguarda o React renderizar as novas imagens no container oculto.
      await new Promise((r) => setTimeout(r, 60));
      // Garante que capa e polaroids estejam totalmente carregadas antes
      // do html2canvas capturar o container (evita áreas em branco no PDF).
      await waitForImages(containerRef.current);

      const html2pdf = (await import("html2pdf.js")).default;
      const opts = {
        margin: 0,
        filename: `Roteiro_${destino}_${cliente}`.replace(/\s+/g, "_") + ".pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["legacy"] },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await html2pdf().set(opts as any).from(containerRef.current).save();
      toast.success("PDF do roteiro gerado.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setBusy(false);
    }
  }

  // Abre a pré-visualização, resolvendo antes as imagens de biblioteca das
  // atividades sem imagem própria (mesma lógica da exportação).
  async function openPreview() {
    setBusy(true);
    try {
      const { images: map, notes } = await resolveActivityImages();
      setActImages(map);
      setActNotes(notes);
      setPreviewOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível montar a pré-visualização.");
    } finally {
      setBusy(false);
    }
  }



  const renderBody = () => (
    <>
      {/* ----------------------------- CAPA ----------------------------- */}

          <Page style={{ color: "#fff" }}>
            {heroImg ? (
              <img src={heroImg} crossOrigin="anonymous" alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, ${GOLD} 0%, ${GOLD_DARK} 100%)` }} />
            )}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,.15) 40%, rgba(0,0,0,.65) 100%)" }} />
            {logoUrl && (
              <div style={{ position: "absolute", top: "16mm", right: "18mm" }}>
                <img src={logoUrl} crossOrigin="anonymous" alt=""
                  style={{ maxHeight: "26mm", maxWidth: "60mm", objectFit: "contain", display: "block", filter: "drop-shadow(0 2px 8px rgba(0,0,0,.4))" }} />
              </div>
            )}
            <div style={{ position: "absolute", top: "18mm", left: 0, background: GOLD, color: "#fff", padding: "6mm 14mm 6mm 16mm", borderTopRightRadius: "40px", borderBottomRightRadius: "40px", fontFamily: "Fredoka, sans-serif", fontWeight: 700, letterSpacing: "2px", fontSize: "16pt" }}>
              {openingTitle || "ROTEIRO COMPLETO"}
            </div>
            <div style={{ position: "absolute", left: "20mm", right: "20mm", bottom: "40mm" }}>
              <div style={{ fontFamily: "Fredoka, sans-serif", fontWeight: 700, fontSize: "34pt", lineHeight: 1.05, textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>
                {destino}
              </div>
              <div style={{ marginTop: "8mm", fontFamily: "'Dancing Script', cursive", fontSize: "22pt", color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,.5)" }}>
                {openingSubtitle || `Preparado para ${cliente}`}
              </div>
              {openingFooter && (
                <div style={{ marginTop: "6mm", fontFamily: "Fredoka, sans-serif", fontSize: "11pt", color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,.5)" }}>
                  {openingFooter}
                </div>
              )}
            </div>

          </Page>

          {/* -------------------------- INTRODUÇÃO -------------------------- */}
          <Page style={{ background: BEIGE, padding: "26mm 20mm" }}>
            <CornerBlobs gold={GOLD} />
            <div style={{ position: "absolute", top: "10mm", right: "14mm" }}><Brandmark logoUrl={logoUrl} goldDark={GOLD_DARK} /></div>
            <div style={{ position: "relative", textAlign: "center", marginBottom: "10mm" }}>
              <span style={{ fontFamily: "'Dancing Script', cursive", fontSize: "40pt", color: SLATE }}>{destino}</span>
            </div>
            {heroImg && (
              <div style={{ position: "relative", display: "flex", justifyContent: "center", marginBottom: "12mm" }}>
                <div style={{ background: "#fff", padding: "4mm 4mm 10mm", boxShadow: "0 10px 24px rgba(0,0,0,.18)", transform: "rotate(-2deg)" }}>
                  <img src={heroImg} crossOrigin="anonymous" alt=""
                    style={{ width: "120mm", height: "78mm", objectFit: "cover", display: "block" }} />
                </div>
              </div>
            )}
            <p style={{ position: "relative", fontSize: "13pt", lineHeight: 1.7, textAlign: "justify", color: INK }}>
              Este guia foi preparado com todo o cuidado para que sua viagem a{" "}
              <strong>{destino}</strong> seja inesquecível. Nas próximas páginas você
              encontra um check-list completo de preparação, orientações sobre dinheiro e
              documentação e, em seguida, o seu roteiro dia a dia com todas as experiências
              reservadas especialmente para você. Boa viagem!
            </p>
          </Page>

          {/* --------------------------- CHECK-LIST ------------------------- */}
          <Page style={{ background: BEIGE, padding: "24mm 20mm" }}>
            <CornerBlobs gold={GOLD} />
            <div style={{ position: "absolute", top: "10mm", right: "14mm" }}><Brandmark logoUrl={logoUrl} goldDark={GOLD_DARK} /></div>
            <h2 style={{ position: "relative", fontFamily: "Fredoka, sans-serif", fontWeight: 700, fontSize: "26pt", color: GOLD_DARK, marginBottom: "8mm" }}>
              O que preciso levar?
            </h2>
            <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "3mm" }}>
              {CHECKLIST.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "3mm", fontSize: "12.5pt" }}>
                  <span style={{ width: "5mm", height: "5mm", border: `1.5px solid ${SLATE}`, borderRadius: "2px", flexShrink: 0, display: "inline-block" }} />
                  <span>{item.text}</span>
                  {item.alert && <AlertTriangle size={16} color={GOLD_DARK} style={{ flexShrink: 0 }} />}
                </div>
              ))}
            </div>
            <div style={{ position: "relative", marginTop: "12mm", background: GOLD, color: "#fff", borderRadius: "14px", padding: "6mm 8mm", fontSize: "12pt", display: "flex", gap: "3mm", alignItems: "center" }}>
              <AlertTriangle size={20} color="#fff" style={{ flexShrink: 0 }} />
              <span>Confira todos os itens com antecedência — alguns são indispensáveis para embarcar.</span>
            </div>
          </Page>

          {/* ---------------------------- DINHEIRO -------------------------- */}
          <Page style={{ background: BEIGE, padding: "24mm 20mm" }}>
            <CornerBlobs gold={GOLD} />
            <div style={{ position: "absolute", top: "10mm", right: "14mm" }}><Brandmark logoUrl={logoUrl} goldDark={GOLD_DARK} /></div>
            <h2 style={{ position: "relative", fontFamily: "Fredoka, sans-serif", fontWeight: 700, fontSize: "26pt", color: GOLD_DARK, marginBottom: "8mm" }}>
              Como levar dinheiro
            </h2>
            <div style={{ position: "relative", fontSize: "13pt", lineHeight: 1.7, display: "flex", flexDirection: "column", gap: "6mm" }}>
              <p>Recomendamos levar parte do valor em espécie (dólar ou euro), pois muitos estabelecimentos locais preferem pagamento em dinheiro.</p>
              <p>Tenha também aplicativos de câmbio como <strong>Wise</strong> ou <strong>Revolut</strong> instalados — eles facilitam conversões e pagamentos com taxas melhores.</p>
              <p>Se pretende fazer passeios extras, leve um valor adicional reservado para isso.</p>
              <p>Por fim, leve um cartão de crédito internacional como reserva e confirme no app do banco a liberação para uso fora do Brasil.</p>
              <div style={{ display: "flex", gap: "6mm", marginTop: "2mm" }}>
                <div style={{ flex: 1, textAlign: "center", background: GOLD, color: "#fff", borderRadius: "30px", padding: "5mm", fontWeight: 600, fontSize: "13pt" }}>Revolut</div>
                <div style={{ flex: 1, textAlign: "center", background: GOLD, color: "#fff", borderRadius: "30px", padding: "5mm", fontWeight: 600, fontSize: "13pt" }}>Wise</div>
              </div>
            </div>
          </Page>

          {/* ----------------------------- VISTO --------------------------- */}
          <Page style={{ background: BEIGE, padding: "24mm 20mm" }}>
            <CornerBlobs gold={GOLD} />
            <div style={{ position: "absolute", top: "10mm", right: "14mm" }}><Brandmark logoUrl={logoUrl} goldDark={GOLD_DARK} /></div>
            <h2 style={{ position: "relative", fontFamily: "Fredoka, sans-serif", fontWeight: 700, fontSize: "26pt", color: GOLD_DARK, marginBottom: "8mm" }}>
              Documentação e Visto
            </h2>
            <p style={{ position: "relative", fontSize: "13pt", lineHeight: 1.7, marginBottom: "6mm" }}>
              Verifique com antecedência as exigências de entrada para <strong>{destino}</strong>.
              Alguns destinos exigem visto emitido previamente, enquanto outros oferecem
              visto na chegada. Confirme se há taxas a serem pagas — em muitos casos, apenas
              em dinheiro.
            </p>
            <div style={{ position: "relative", textAlign: "center", background: GOLD, color: "#fff", borderRadius: "14px", padding: "6mm", fontSize: "13pt", fontWeight: 600 }}>
              Mantenha passaporte, seguro viagem e comprovantes sempre à mão.
            </div>
          </Page>

          {/* ------------------------- ROTEIRO DIÁRIO ---------------------- */}
          {(() => {
            const imagesFor = (a: ItineraryActivity): string[] => {
              // O mapa já contém a imagem própria resolvida ou a da biblioteca.
              if (actImages[a.id]?.length) return actImages[a.id];
              return (a.images || []).map((i) => i.url).filter(Boolean) as string[];
            };

            type Block = {
              key: string;
              height: number;
              keepWithNext?: boolean;
              node: React.ReactNode;
            };

            // Gera um fluxo único de blocos de todos os dias; assim mais de um
            // dia pode compartilhar a mesma página quando houver espaço.
            const blocks: Block[] = [];
            for (const day of days) {
              const hotel = findHotel(day);
              const lines = activityLines(day.activities).filter((a) => a.type !== "hotel");

              blocks.push({
                key: `h-${day.id}`,
                height: 34,
                keepWithNext: true,
                node: (
                  <div style={{ position: "relative" }}>
                    <div style={{ fontFamily: "'Dancing Script', cursive", fontSize: "38pt", color: GOLD_DARK, lineHeight: 1 }}>
                      Dia {day.day_number}
                    </div>
                    <div style={{ display: "inline-block", marginTop: "4mm", background: GOLD, color: "#fff", padding: "3mm 8mm", borderRadius: "30px", fontFamily: "Fredoka, sans-serif", fontWeight: 700, fontSize: "16pt" }}>
                      {formatDayDate(day.date) || day.title || `Dia ${day.day_number}`}
                    </div>
                  </div>
                ),
              });

              if (lines.length === 0) {
                blocks.push({
                  key: `empty-${day.id}`,
                  height: 12,
                  node: <p style={{ fontSize: "13pt", color: SLATE }}>Programação livre.</p>,
                });
              }

              for (const a of lines) {
                const imgs = imagesFor(a);
                const note = actNotes[a.id];
                blocks.push({
                  key: a.id,
                  height: estimateActivityHeight(a, imgs.length, note),
                  node: (
                    <div
                      style={{
                        display: "flex",
                        gap: "5mm",
                        alignItems: "flex-start",
                        background: "#fff",
                        borderRadius: "10px",
                        padding: "4mm",
                        boxShadow: "0 2px 8px rgba(0,0,0,.06)",
                        pageBreakInside: "avoid",
                        breakInside: "avoid",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "3mm", fontWeight: 600, fontSize: "12.5pt", color: INK }}>
                          {a.time && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "1.5mm", color: GOLD_DARK }}>
                              <Clock size={14} /> {a.time}
                            </span>
                          )}
                          <span>{a.title}</span>
                        </div>
                        {a.description && (
                          <p style={{ fontSize: "10.5pt", lineHeight: 1.5, color: "#4a4744", marginTop: "1.5mm" }}>{a.description}</p>
                        )}
                        {note && (
                          <p style={{ fontSize: "9.5pt", lineHeight: 1.5, color: "#6b6864", marginTop: "1.5mm", fontStyle: "italic" }}>
                            {note}
                          </p>
                        )}
                        {a.location && (
                          <p style={{ fontSize: "10pt", color: SLATE, marginTop: "1mm", display: "flex", alignItems: "center", gap: "1.5mm" }}>
                            <MapPin size={12} /> {a.location}
                          </p>
                        )}
                      </div>
                      {imgs.length > 0 ? (
                        <ActivityImageBox images={imgs} />
                      ) : (
                        <ActivityImagePlaceholder label={a.location || destino} />
                      )}
                    </div>
                  ),
                });
              }

              if (hotel) {
                blocks.push({
                  key: `hotel-${day.id}`,
                  height: 16,
                  node: (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "3mm", background: GOLD, color: "#fff", padding: "3.5mm 8mm", borderRadius: "30px", fontWeight: 600, fontSize: "13pt", maxWidth: "120mm" }}>
                      <Hotel size={18} /> {hotel}
                    </div>
                  ),
                });
              }
            }

            // Empacota os blocos em páginas A4 sem quebrar um bloco ao meio e
            // mantendo o cabeçalho do dia junto do seu primeiro item.
            const PAGE_BUDGET = 250; // mm úteis por página de conteúdo
            const GAP = 5; // espaçamento vertical entre blocos (mm)
            const pages: Block[][] = [];
            let cur: Block[] = [];
            let used = 0;
            for (let i = 0; i < blocks.length; i++) {
              const b = blocks[i];
              let need = b.height + (cur.length ? GAP : 0);
              if (b.keepWithNext && blocks[i + 1]) need += blocks[i + 1].height + GAP;
              if (used + need > PAGE_BUDGET && cur.length) {
                pages.push(cur);
                cur = [];
                used = 0;
              }
              cur.push(b);
              used += b.height + (cur.length > 1 ? GAP : 0);
            }
            if (cur.length) pages.push(cur);

            return pages.map((chunk, pi) => (
              <Page key={`roteiro-${pi}`} style={{ background: BEIGE, padding: "24mm 20mm 20mm" }}>
                <CornerBlobs gold={GOLD} />
                <div style={{ position: "absolute", top: "10mm", right: "14mm" }}>
                  <Brandmark logoUrl={logoUrl} goldDark={GOLD_DARK} />
                </div>
                <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "5mm" }}>
                  {chunk.map((b) => (
                    <div key={b.key}>{b.node}</div>
                  ))}
                </div>
              </Page>
            ));
          })()}



          {/* ----------------------- SERVIÇOS INCLUSOS --------------------- */}
          <Page style={{ background: BEIGE, padding: "26mm 20mm" }}>
            <CornerBlobs gold={GOLD} />
            <div style={{ position: "absolute", top: "10mm", right: "14mm" }}><Brandmark logoUrl={logoUrl} goldDark={GOLD_DARK} /></div>
            <div style={{ position: "relative", display: "inline-block", background: GOLD, color: "#fff", padding: "2.5mm 7mm", borderRadius: "30px", fontWeight: 600, fontSize: "15pt", marginBottom: "6mm" }}>
              Serviços inclusos
            </div>
            <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "3mm", marginBottom: "14mm" }}>
              {SERVICOS_INCLUSOS.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "3mm", fontSize: "13pt" }}>
                  <Check size={18} color={GOLD_DARK} /> {s}
                </div>
              ))}
            </div>
            <div style={{ position: "relative", fontFamily: "'Dancing Script', cursive", fontSize: "34pt", color: GOLD_DARK, marginBottom: "5mm" }}>
              Não incluso
            </div>
            <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "3mm" }}>
              {SERVICOS_NAO_INCLUSOS.map((s, i) => (
                <div key={i} style={{ fontSize: "13pt", color: INK }}>– {s}</div>
              ))}
            </div>
          </Page>

          {/* --------------------------- CONTRACAPA ------------------------ */}
          <Page style={{ color: "#fff" }}>
            {heroImg ? (
              <img src={heroImg} crossOrigin="anonymous" alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, ${GOLD} 0%, ${GOLD_DARK} 100%)` }} />
            )}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.25) 0%, rgba(0,0,0,.55) 100%)" }} />
            <div style={{ position: "absolute", top: "22mm", left: 0, background: GOLD, color: "#fff", padding: "6mm 16mm", borderTopRightRadius: "40px", borderBottomRightRadius: "40px", fontFamily: "Fredoka, sans-serif", fontWeight: 700, fontSize: "26pt" }}>
              Aproveite a viagem!
            </div>
            <div style={{ position: "absolute", bottom: "24mm", left: 0, right: 0, textAlign: "center" }}>
              <div style={{ fontFamily: "Fredoka, sans-serif", fontWeight: 700, fontSize: "22pt", textShadow: "0 2px 10px rgba(0,0,0,.6)" }}>O segredo</div>
              <div style={{ fontFamily: "'Dancing Script', cursive", fontSize: "30pt", textShadow: "0 2px 10px rgba(0,0,0,.6)", marginTop: "-4px" }}>Viajante</div>
            </div>
          </Page>
    </>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void openPreview()}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Pré-visualizar
        </button>
        <button
          onClick={handleExport}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Exportar PDF
        </button>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70">
          <div className="flex items-center justify-between gap-2 bg-card px-4 py-3 shadow">
            <div className="text-sm font-semibold">Pré-visualização do roteiro</div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                disabled={busy}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Exportar PDF
              </button>
              <button
                onClick={() => setPreviewOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <style>{`.pdf-preview .pdf-page{margin:0 auto 14px;box-shadow:0 6px 24px rgba(0,0,0,.35);}`}</style>
            <div className="pdf-preview" style={{ width: "210mm", margin: "0 auto" }}>
              {renderBody()}
            </div>
          </div>
        </div>
      )}

      {/* Container renderizado fora da tela; capturado pelo html2pdf. */}
      <div style={{ position: "fixed", left: "-10000px", top: 0, zIndex: -1 }} aria-hidden>
        <div ref={containerRef} id="roteiro-pdf-container" style={{ width: "210mm", background: "#fff" }}>
          {renderBody()}
        </div>
      </div>
    </>
  );
}

