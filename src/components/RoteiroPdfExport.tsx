import { useMemo, useRef, useState } from "react";
import { FileDown, Loader2, Hotel, MapPin, Clock, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Itinerary, ItineraryActivity, ItineraryDay, LibraryItem } from "@/lib/types";
import { fetchLibraryItems, resolveDisplayImageUrl } from "@/lib/services";


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

// Ornamento decorativo dourado nos cantos das páginas de conteúdo.
function CornerBlobs() {
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "42mm",
          height: "34mm",
          background: GOLD,
          borderBottomLeftRadius: "100%",
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "36mm",
          height: "28mm",
          background: GOLD,
          borderTopRightRadius: "100%",
          opacity: 0.9,
        }}
      />
    </>
  );
}

function Wordmark({ light }: { light?: boolean }) {
  return (
    <div style={{ lineHeight: 1, textAlign: "right" }}>
      <span style={{ display: "block", fontFamily: "Fredoka, sans-serif", fontWeight: 600, fontSize: "10pt", color: light ? "#fff" : GOLD_DARK }}>
        O segredo
      </span>
      <span style={{ display: "block", fontFamily: "'Dancing Script', cursive", fontWeight: 700, fontSize: "14pt", color: light ? "#fff" : GOLD_DARK, marginTop: "-2px" }}>
        Viajante
      </span>
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

// Escolhe, entre as imagens da biblioteca, a mais relacionada à atividade
// (por local, tags ou descrição). Evita repetir a mesma imagem quando possível.
function pickLibraryImage(
  a: ItineraryActivity,
  images: LibraryItem[],
  used: Set<string>,
): LibraryItem | null {
  const wantLoc = norm(a.location);
  const need = new Set([...tokens(a.location), ...tokens(a.title), ...tokens(a.description)]);
  if (need.size === 0) return null;
  let best: { item: LibraryItem; score: number } | null = null;
  for (const img of images) {
    const src = img.image_url || img.file_url;
    if (!src) continue;
    const hay = new Set([
      ...tokens(img.title),
      ...tokens(img.location),
      ...tokens((img.tags || []).join(" ")),
      ...tokens(img.description),
      ...tokens(img.content),
    ]);
    let score = 0;
    for (const t of need) if (hay.has(t)) score += 1;
    // Bônus forte quando o local da atividade bate com o local/titulo da imagem.
    if (wantLoc && (norm(img.location).includes(wantLoc) || norm(img.title).includes(wantLoc))) {
      score += 3;
    }
    if (score <= 0) continue;
    if (used.has(src)) score -= 2; // penaliza reuso, mas não descarta
    if (!best || score > best.score) best = { item: img, score };
  }
  return best && best.score > 0 ? best.item : null;
}

// Estima a altura (mm) que uma atividade ocupará no PDF, para paginar sem quebra.
function estimateActivityHeight(a: ItineraryActivity, hasImage: boolean): number {
  const descLines = a.description ? Math.ceil(a.description.length / 52) : 0;
  const textH = 9 + descLines * 5 + (a.location ? 6 : 0);
  const imageH = hasImage ? 42 : 0;
  return Math.max(textH, imageH) + 8;
}


export function RoteiroPdfExport({ it, coverUrl }: { it: Itinerary; coverUrl: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  // Imagens resolvidas da biblioteca por atividade (id -> URL exibível).
  const [actImages, setActImages] = useState<Record<string, string>>({});


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

  async function handleExport() {
    if (!containerRef.current) return;
    setBusy(true);
    try {
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

  return (
    <>
      <button
        onClick={handleExport}
        disabled={busy}
        className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Exportar PDF
      </button>

      {/* Container renderizado fora da tela; capturado pelo html2pdf. */}
      <div style={{ position: "fixed", left: "-10000px", top: 0, zIndex: -1 }} aria-hidden>
        <div ref={containerRef} id="roteiro-pdf-container" style={{ width: "210mm", background: "#fff" }}>
          {/* ----------------------------- CAPA ----------------------------- */}
          <Page style={{ color: "#fff" }}>
            {heroImg ? (
              <img src={heroImg} crossOrigin="anonymous" alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, ${GOLD} 0%, ${GOLD_DARK} 100%)` }} />
            )}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,.15) 40%, rgba(0,0,0,.65) 100%)" }} />
            <div style={{ position: "absolute", top: "18mm", left: 0, background: GOLD, color: "#fff", padding: "6mm 14mm 6mm 16mm", borderTopRightRadius: "40px", borderBottomRightRadius: "40px", fontFamily: "Fredoka, sans-serif", fontWeight: 700, letterSpacing: "2px", fontSize: "16pt" }}>
              ROTEIRO COMPLETO
            </div>
            <div style={{ position: "absolute", left: "20mm", right: "20mm", bottom: "40mm" }}>
              <div style={{ fontFamily: "Fredoka, sans-serif", fontWeight: 700, fontSize: "34pt", lineHeight: 1.05, textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>
                {destino}
              </div>
              <div style={{ marginTop: "8mm", fontFamily: "'Dancing Script', cursive", fontSize: "22pt", color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,.5)" }}>
                Preparado para {cliente}
              </div>
            </div>
          </Page>

          {/* -------------------------- INTRODUÇÃO -------------------------- */}
          <Page style={{ background: BEIGE, padding: "26mm 20mm" }}>
            <CornerBlobs />
            <div style={{ position: "absolute", top: "10mm", right: "14mm" }}><Wordmark /></div>
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
            <CornerBlobs />
            <div style={{ position: "absolute", top: "10mm", right: "14mm" }}><Wordmark /></div>
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
            <CornerBlobs />
            <div style={{ position: "absolute", top: "10mm", right: "14mm" }}><Wordmark /></div>
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
            <CornerBlobs />
            <div style={{ position: "absolute", top: "10mm", right: "14mm" }}><Wordmark /></div>
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
          {days.map((day) => {
            const hotel = findHotel(day);
            const lines = activityLines(day.activities);
            return (
              <Page key={day.id} style={{ background: BEIGE, padding: "24mm 20mm 20mm" }}>
                <CornerBlobs />
                <div style={{ position: "absolute", top: "10mm", right: "14mm" }}><Wordmark /></div>

                <div style={{ position: "relative", fontFamily: "'Dancing Script', cursive", fontSize: "40pt", color: GOLD_DARK, lineHeight: 1 }}>
                  Dia {day.day_number}
                </div>
                <div style={{ position: "relative", display: "inline-block", marginTop: "5mm", background: GOLD, color: "#fff", padding: "3mm 8mm", borderRadius: "30px", fontFamily: "Fredoka, sans-serif", fontWeight: 700, fontSize: "17pt" }}>
                  {formatDayDate(day.date) || day.title || `Dia ${day.day_number}`}
                </div>

                {day.title && (
                  <div style={{ position: "relative", marginTop: "6mm", display: "inline-block", background: "#fff", color: SLATE, padding: "2.5mm 6mm", borderRadius: "30px", fontWeight: 600, fontSize: "13pt", boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
                    {day.title}
                  </div>
                )}

                <div style={{ position: "relative", marginTop: "8mm", display: "flex", flexDirection: "column", gap: "5mm", maxWidth: "115mm" }}>
                  {lines.length === 0 && (
                    <p style={{ fontSize: "13pt", color: SLATE }}>Programação livre.</p>
                  )}
                  {lines.map((a) => (
                    <div key={a.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: "3mm", fontWeight: 600, fontSize: "13.5pt", color: INK }}>
                        {a.time && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "1.5mm", color: GOLD_DARK }}>
                            <Clock size={15} /> {a.time}
                          </span>
                        )}
                        <span>{a.title}</span>
                      </div>
                      {a.description && (
                        <p style={{ fontSize: "12pt", lineHeight: 1.6, color: "#4a4744", marginTop: "1.5mm" }}>{a.description}</p>
                      )}
                      {a.location && (
                        <p style={{ fontSize: "11pt", color: SLATE, marginTop: "1mm", display: "flex", alignItems: "center", gap: "1.5mm" }}>
                          <MapPin size={13} /> {a.location}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Polaroid inferior direita */}
                {heroImg && (
                  <div style={{ position: "absolute", right: "16mm", bottom: "26mm", background: "#fff", padding: "3mm 3mm 8mm", boxShadow: "0 10px 22px rgba(0,0,0,.2)", transform: "rotate(2deg)" }}>
                    <img src={heroImg} crossOrigin="anonymous" alt=""
                      style={{ width: "70mm", height: "50mm", objectFit: "cover", display: "block" }} />
                  </div>
                )}

                {/* Botão de hotel inferior esquerdo */}
                {hotel && (
                  <div style={{ position: "absolute", left: "20mm", bottom: "18mm", display: "inline-flex", alignItems: "center", gap: "3mm", background: GOLD, color: "#fff", padding: "3.5mm 8mm", borderRadius: "30px", fontWeight: 600, fontSize: "13pt", maxWidth: "90mm" }}>
                    <Hotel size={18} /> {hotel}
                  </div>
                )}
              </Page>
            );
          })}

          {/* ----------------------- SERVIÇOS INCLUSOS --------------------- */}
          <Page style={{ background: BEIGE, padding: "26mm 20mm" }}>
            <CornerBlobs />
            <div style={{ position: "absolute", top: "10mm", right: "14mm" }}><Wordmark /></div>
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
        </div>
      </div>
    </>
  );
}
