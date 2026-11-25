// Dados extras de um item do roteiro (moeda, valor em reais, sugestões, valores
// por pessoa, fotos, "feito"). A coleção do Appwrite não tem campos próprios
// para eles, então viajam dentro do campo `description`, que comporta 10 mil
// caracteres, junto com o texto da observação.
//
// Antes iam no campo `duration`, que só aceita 50 caracteres: salvar um item
// com moeda ou sugestões era recusado. Registros antigos nesse formato
// continuam sendo lidos.
//
// Este arquivo não fala com o Appwrite. É usado pelo app, pela página pública
// do roteiro e pelas funções de IA, para todos lerem o item do mesmo jeito.

const MARK = "__osv_meta";
const DURATION_LIMIT = 50;

type Envelope = {
  [MARK]?: 1;
  text?: string | null;
  dur?: string | null;
  cur?: string | null;
  brl?: number | null;
  rate?: number | null;
  hotels?: unknown;
  sug?: unknown;
  pax?: unknown;
  imgs?: unknown;
  done?: boolean;
};

/** Campos que as telas usam, além dos que existem na coleção. */
export type ActivityExtras = {
  description?: string | null;
  duration?: string | null;
  currency?: string | null;
  cost_brl?: number | null;
  cost_brl_rate?: number | null;
  hotel_options?: unknown[] | null;
  suggestion_options?: unknown[] | null;
  passenger_costs?: unknown[] | null;
  images?: unknown[] | null;
  done?: boolean | null;
  type?: string | null;
};

export const ACTIVITY_EXTRA_KEYS = [
  "description",
  "duration",
  "currency",
  "cost_brl",
  "cost_brl_rate",
  "hotel_options",
  "suggestion_options",
  "passenger_costs",
  "images",
  "done",
] as const;

function parseEnvelope(raw: unknown): Envelope | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(text) as Envelope;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

const list = (v: unknown): unknown[] | null => (Array.isArray(v) && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Converte o registro gravado no formato que as telas usam. Altera e devolve o
 * mesmo objeto.
 */
export function decodeActivityRow<T extends Record<string, unknown>>(row: T): T & ActivityExtras {
  const out = row as T & ActivityExtras & Record<string, unknown>;
  let meta: Envelope = {};

  // Formato antigo: tudo dentro de `duration`.
  const legacy = parseEnvelope(out.duration);
  if (legacy && ["dur", "cur", "brl", "hotels", "pax", "sug", "imgs"].some((k) => k in legacy)) {
    meta = { ...legacy };
    out.duration = legacy.dur ?? null;
  }

  // Formato atual: dentro de `description`, com o texto em `text`.
  const current = parseEnvelope(out.description);
  if (current && current[MARK]) {
    meta = { ...meta, ...current };
    out.description = current.text ?? null;
    if (current.dur !== undefined) out.duration = current.dur ?? null;
  }

  // Um registro já convertido passa por aqui sem perder nada: o que não veio
  // no envelope fica como estava.
  const has = (k: keyof Envelope) => k in meta;
  out.currency = has("cur") ? (meta.cur ?? null) : (out.currency ?? null);
  out.cost_brl = has("brl") ? num(meta.brl) : num(out.cost_brl);
  out.cost_brl_rate = has("rate") ? num(meta.rate) : num(out.cost_brl_rate);
  out.hotel_options = has("hotels") ? list(meta.hotels) : list(out.hotel_options);
  out.suggestion_options = has("sug") ? list(meta.sug) : list(out.suggestion_options);
  out.passenger_costs = has("pax") ? list(meta.pax) : list(out.passenger_costs);
  out.images = has("imgs") ? list(meta.imgs) : list(out.images);
  out.done = has("done") ? meta.done === true : out.done === true;

  // Antes, "feito" trocava o tipo do item por "done" e o tipo se perdia.
  if (out.type === "done") {
    out.done = true;
    out.type = "activity";
  }
  return out;
}

/**
 * Monta os campos `description` e `duration` a gravar, a partir do item
 * completo (o que já estava gravado somado ao que mudou).
 */
export function encodeActivityColumns(item: ActivityExtras): { description: string | null; duration: string | null } {
  const duration = item.duration ? String(item.duration) : null;
  const envelope: Envelope = {};
  if (item.currency) envelope.cur = item.currency;
  if (num(item.cost_brl) !== null) envelope.brl = item.cost_brl as number;
  if (num(item.cost_brl_rate) !== null) envelope.rate = item.cost_brl_rate as number;
  if (list(item.hotel_options)) envelope.hotels = item.hotel_options;
  if (list(item.suggestion_options)) envelope.sug = item.suggestion_options;
  if (list(item.passenger_costs)) envelope.pax = item.passenger_costs;
  if (list(item.images)) envelope.imgs = item.images;
  if (item.done) envelope.done = true;
  // Duração longa não cabe no campo próprio: vai junto.
  if (duration && duration.length > DURATION_LIMIT) envelope.dur = duration;

  const text = item.description ? String(item.description) : null;
  // Texto que por acaso parece o nosso formato também é embrulhado, para não
  // ser confundido na leitura.
  const looksLikeEnvelope = !!parseEnvelope(text)?.[MARK];
  if (Object.keys(envelope).length === 0 && !looksLikeEnvelope) {
    return { description: text, duration };
  }
  return {
    description: JSON.stringify({ [MARK]: 1, text, ...envelope }),
    duration: duration && duration.length <= DURATION_LIMIT ? duration : null,
  };
}

/**
 * O que o cliente pode ver de um item no roteiro compartilhado. Sugestões,
 * valores por pessoa, fotos internas e a cotação ficam de fora.
 */
export function publicActivityView(row: Record<string, unknown>) {
  const a = decodeActivityRow({ ...row });
  return {
    id: (a.$id ?? a.id) as string,
    day_id: a.day_id as string,
    type: (a.type as string | null) ?? null,
    title: (a.title as string | null) ?? "",
    time: ((a.time ?? a.time_start) as string | null) ?? null,
    description: a.description ?? null,
    location: (a.location as string | null) ?? null,
    maps_url: (a.maps_url as string | null) ?? null,
    cost: (a.cost as number | null) ?? null,
    currency: a.currency ?? null,
    sort_order: (a.sort_order as number | null) ?? 0,
  };
}
