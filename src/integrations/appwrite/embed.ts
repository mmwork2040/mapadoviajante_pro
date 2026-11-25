// Relações entre coleções. O Appwrite não junta coleções numa consulta, então a
// camada de dados lê o pedido de relação que as telas escrevem no `select`
// (ex.: "*, activities:crm_itinerary_activities(*)") e busca os registros
// relacionados em lote. Este arquivo só interpreta o pedido; não fala com o
// Appwrite, para poder ser testado sozinho.
import { COLLECTION_FIELDS } from "./schema";

export type EmbedSpec = {
  /** Nome com que os registros relacionados aparecem no documento. */
  alias: string;
  /** Coleção relacionada. */
  table: string;
  /** Dica de qual campo liga as duas (ex.: "crm_leads_assigned_to_fkey"). */
  hint: string | null;
  /** Relações pedidas dentro desta. */
  embeds: EmbedSpec[];
};

export type Relation =
  /** O documento guarda o ID do relacionado em `column` (um para um). */
  | { kind: "one"; column: string }
  /** Os relacionados guardam o ID do documento em `column` (um para muitos). */
  | { kind: "many"; column: string };

function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Separa as colunas simples das relações pedidas num `select`. */
export function parseSelect(columns: string): { columns: string[]; embeds: EmbedSpec[] } {
  const out: { columns: string[]; embeds: EmbedSpec[] } = { columns: [], embeds: [] };
  for (const part of splitTopLevel(columns)) {
    const m = /^(?:([A-Za-z_]\w*)\s*:\s*)?([A-Za-z_]\w*)(?:!([A-Za-z_]\w*))?\s*\(([\s\S]*)\)$/.exec(part);
    if (!m) {
      out.columns.push(part);
      continue;
    }
    const [, alias, table, hint, inner] = m;
    out.embeds.push({
      alias: alias || table,
      table,
      hint: hint || null,
      embeds: parseSelect(inner).embeds,
    });
  }
  return out;
}

// Campo que costuma apontar para cada coleção.
const POINTER_FIELD: Record<string, string> = {
  agencies: "agency_id",
  crm_clients: "client_id",
  crm_leads: "lead_id",
  crm_itineraries: "itinerary_id",
  crm_itinerary_days: "day_id",
  crm_itinerary_activities: "activity_id",
};

/** Descobre como `parent` se liga à coleção pedida. */
export function resolveRelation(parent: string, embed: EmbedSpec): Relation | null {
  const parentFields = COLLECTION_FIELDS[parent] ?? {};
  const childFields = COLLECTION_FIELDS[embed.table] ?? {};

  // 1) A dica diz o campo: "<coleção>_<campo>_fkey".
  if (embed.hint) {
    const own = new RegExp(`^${parent}_(.+)_fkey$`).exec(embed.hint);
    if (own && (parentFields[own[1]] || !COLLECTION_FIELDS[parent])) return { kind: "one", column: own[1] };
    const theirs = new RegExp(`^${embed.table}_(.+)_fkey$`).exec(embed.hint);
    if (theirs && (childFields[theirs[1]] || !COLLECTION_FIELDS[embed.table])) {
      return { kind: "many", column: theirs[1] };
    }
  }

  // 2) O documento aponta para a coleção pedida (ex.: tarefa → venda por lead_id).
  const toChild = POINTER_FIELD[embed.table];
  if (toChild && (parentFields[toChild] || !COLLECTION_FIELDS[parent])) return { kind: "one", column: toChild };

  // 3) A coleção pedida aponta para o documento (ex.: dia → itens por day_id).
  const toParent = POINTER_FIELD[parent];
  if (toParent && (childFields[toParent] || !COLLECTION_FIELDS[embed.table])) {
    return { kind: "many", column: toParent };
  }

  return null;
}
