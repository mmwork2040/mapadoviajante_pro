// Liberação de acesso à plataforma (decisão do produto: acesso comprado na
// Hotmart; o super admin também pode liberar à mão).
//
// Guardado em `system_settings` (o navegador não tem acesso a essa tabela):
//   access_grant:<email>     liberação de um e-mail (ver AccessGrant)
//   agency_access:<agência>  { email, suspended } — consulta rápida por agência
//   hotmart_event:<id>       eventos recebidos da Hotmart (sem repetir)
//
// Regra: agência nova só é criada para e-mail com liberação ativa. Agências que
// já existiam antes desta regra (sem liberação registrada) continuam ativas.
import { getServerBridge } from "@/integrations/appwrite/server";

export type GrantStatus = "active" | "suspended";
export type GrantOverride = "none" | "force_active" | "force_suspended";

export type AccessGrant = {
  email: string;
  status: GrantStatus;
  source: "hotmart" | "manual";
  override: GrantOverride;
  productId?: string | null;
  transaction?: string | null;
  subscriberCode?: string | null;
  agencyId?: string | null;
  note?: string | null;
  lastEvent?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HotmartEventLog = {
  id: string;
  event: string;
  email: string | null;
  productId: string | null;
  transaction: string | null;
  result: "applied" | "ignored" | "error";
  detail: string;
  receivedAt: string;
};

export const normEmail = (email: string) => email.trim().toLowerCase();
const grantKey = (email: string) => `access_grant:${normEmail(email)}`;
const agencyKey = (agencyId: string) => `agency_access:${agencyId}`;
const eventKey = (id: string) => `hotmart_event:${id}`;

function parse<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return null;
  }
}

async function readKey<T>(key: string): Promise<T | null> {
  const { data, error } = await getServerBridge()
    .from("system_settings")
    .select("key, value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error("Não foi possível consultar a liberação de acesso.");
  return parse<T>((data as { value?: unknown } | null)?.value);
}

async function writeKey(key: string, value: unknown) {
  const { error } = await getServerBridge()
    .from("system_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error("Não foi possível salvar a liberação de acesso.");
}

async function deleteKey(key: string) {
  await getServerBridge().from("system_settings").delete().eq("key", key);
}

async function listByPrefix<T>(prefix: string): Promise<T[]> {
  const { data, error } = await getServerBridge()
    .from("system_settings")
    .select("key, value")
    .like("key", `${prefix}%`);
  if (error) throw new Error("Não foi possível listar.");
  return ((data as { value?: unknown }[] | null) ?? [])
    .map((r) => parse<T>(r.value))
    .filter((v): v is T => !!v);
}

/** A liberação vale agora? A decisão manual do super admin tem prioridade. */
export function isGrantActive(g: AccessGrant | null | undefined): boolean {
  if (!g) return false;
  if (g.override === "force_active") return true;
  if (g.override === "force_suspended") return false;
  return g.status === "active";
}

export async function getGrant(email: string) {
  return readKey<AccessGrant>(grantKey(email));
}

export async function listGrants() {
  const grants = await listByPrefix<AccessGrant>("access_grant:");
  return grants.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

/** Grava a liberação e mantém o índice por agência atualizado. */
export async function saveGrant(g: AccessGrant) {
  const grant = { ...g, email: normEmail(g.email), updatedAt: new Date().toISOString() };
  await writeKey(grantKey(grant.email), grant);
  if (grant.agencyId) {
    await writeKey(agencyKey(grant.agencyId), { email: grant.email, suspended: !isGrantActive(grant) });
  }
  return grant;
}

export async function deleteGrant(email: string) {
  await deleteKey(grantKey(email));
}

/** A agência está suspensa? Agências sem liberação registrada não são suspensas. */
export async function isAgencySuspended(agencyId: string): Promise<boolean> {
  const v = await readKey<{ suspended?: boolean }>(agencyKey(agencyId));
  return !!v?.suspended;
}

export function newGrant(email: string, source: AccessGrant["source"], extra: Partial<AccessGrant> = {}): AccessGrant {
  const now = new Date().toISOString();
  return {
    email: normEmail(email),
    status: "active",
    source,
    override: "none",
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

// ── Eventos da Hotmart ───────────────────────────────────────────

export async function getHotmartEvent(id: string) {
  return readKey<HotmartEventLog>(eventKey(id));
}

export async function saveHotmartEvent(e: HotmartEventLog) {
  await writeKey(eventKey(e.id), e);
}

export async function listHotmartEvents(limit = 50) {
  const events = await listByPrefix<HotmartEventLog>("hotmart_event:");
  return events.sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || "")).slice(0, limit);
}

/**
 * O que cada evento da Hotmart faz com a liberação.
 * (Conferir os nomes na documentação atual da Hotmart, webhook 2.0.)
 */
export function hotmartEffect(event: string): "activate" | "suspend" | "none" {
  switch (event) {
    case "PURCHASE_APPROVED":
    case "PURCHASE_COMPLETE":
      return "activate";
    case "PURCHASE_REFUNDED":
    case "PURCHASE_CHARGEBACK":
    case "PURCHASE_CANCELED":
    case "SUBSCRIPTION_CANCELLATION":
      return "suspend";
    default:
      return "none";
  }
}
