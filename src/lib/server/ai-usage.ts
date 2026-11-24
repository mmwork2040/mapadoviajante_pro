// Controle de consumo de IA por agência (só para a chave da PLATAFORMA).
//
// - Cada chamada à IA soma os tokens usados em `system_settings`, na chave
//   `ai_usage:<agencyId>:<AAAA-MM>` (mês no fuso de São Paulo).
// - A cota mensal fica em `platform_cfg:ai_quota`:
//     { defaultMonthlyTokens: number, agencies: { [agencyId]: number } }
//   0 = sem limite. Agência sem valor próprio usa o padrão.
// - Quando a agência usa a própria chave (cadastrada na Administração), não há
//   cota: o custo é dela.
import { AsyncLocalStorage } from "node:async_hooks";
import { getServerBridge } from "@/integrations/appwrite/server";

export type AiScope = { agencyId: string | null; userId: string; platform: boolean };

const scopeStorage = new AsyncLocalStorage<AiScope>();

/**
 * Marca, para o restante da requisição atual, de quem é o consumo de IA.
 * Precisa ser chamada de forma síncrona (antes de qualquer await) dentro da
 * função que vai chamar a IA.
 */
export function enterAiScope(scope: AiScope) {
  scopeStorage.enterWith(scope);
}

export function currentAiScope(): AiScope | undefined {
  return scopeStorage.getStore();
}

export const QUOTA_KEY = "platform_cfg:ai_quota";
const FALLBACK_DEFAULT_TOKENS = 2_000_000;

export type AiQuotaConfig = { defaultMonthlyTokens: number; agencies: Record<string, number> };
export type AiUsage = { inputTokens: number; outputTokens: number; totalTokens: number; requests: number };

const EMPTY_USAGE: AiUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 };

/** Mês atual no fuso de São Paulo, no formato AAAA-MM. */
export function currentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

export function usageKey(agencyId: string, month = currentMonth()) {
  return `ai_usage:${agencyId}:${month}`;
}

function parse(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    const v = JSON.parse(String(raw));
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

async function readSetting(key: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await getServerBridge()
    .from("system_settings")
    .select("key, value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error("Não foi possível ler o consumo de IA.");
  return parse((data as { value?: unknown } | null)?.value);
}

async function writeSetting(key: string, value: Record<string, unknown>) {
  const { error } = await getServerBridge()
    .from("system_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error("Não foi possível salvar o consumo de IA.");
}

function toUsage(v: Record<string, unknown> | null): AiUsage {
  if (!v) return { ...EMPTY_USAGE };
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
  return {
    inputTokens: n(v.inputTokens),
    outputTokens: n(v.outputTokens),
    totalTokens: n(v.totalTokens),
    requests: n(v.requests),
  };
}

export async function readUsage(agencyId: string, month = currentMonth()): Promise<AiUsage> {
  return toUsage(await readSetting(usageKey(agencyId, month)));
}

export function parseUsage(raw: unknown): AiUsage {
  return toUsage(parse(raw));
}

export async function readQuotaConfig(): Promise<AiQuotaConfig> {
  const v = await readSetting(QUOTA_KEY);
  const envDefault = Number(process.env.AI_DEFAULT_MONTHLY_TOKENS);
  const fallback = Number.isFinite(envDefault) && envDefault >= 0 ? envDefault : FALLBACK_DEFAULT_TOKENS;
  const def = typeof v?.defaultMonthlyTokens === "number" ? v.defaultMonthlyTokens : fallback;
  const agencies: Record<string, number> = {};
  if (v?.agencies && typeof v.agencies === "object") {
    for (const [id, val] of Object.entries(v.agencies as Record<string, unknown>)) {
      if (typeof val === "number" && Number.isFinite(val) && val >= 0) agencies[id] = val;
    }
  }
  return { defaultMonthlyTokens: def, agencies };
}

export async function writeQuotaConfig(cfg: AiQuotaConfig) {
  await writeSetting(QUOTA_KEY, cfg);
}

/** Limite mensal da agência em tokens (0 = sem limite). */
export async function agencyLimit(agencyId: string): Promise<number> {
  const cfg = await readQuotaConfig();
  return cfg.agencies[agencyId] ?? cfg.defaultMonthlyTokens;
}

/** Recusa a chamada se a agência já passou do limite do mês. */
export async function assertWithinQuota(agencyId: string) {
  const limit = await agencyLimit(agencyId);
  if (!limit) return;
  const usage = await readUsage(agencyId);
  if (usage.totalTokens >= limit) {
    throw new Error(
      "A agência atingiu o limite mensal de uso da IA. O limite é renovado no próximo mês; para ampliar, fale com o suporte.",
    );
  }
}

/** Soma o consumo de uma chamada à agência da requisição atual. */
export async function recordAiUsage(inputTokens?: number, outputTokens?: number) {
  const scope = currentAiScope();
  if (!scope?.platform || !scope.agencyId) return;
  const input = Math.max(0, Math.round(Number(inputTokens) || 0));
  const output = Math.max(0, Math.round(Number(outputTokens) || 0));
  try {
    const key = usageKey(scope.agencyId);
    const current = toUsage(await readSetting(key));
    await writeSetting(key, {
      inputTokens: current.inputTokens + input,
      outputTokens: current.outputTokens + output,
      totalTokens: current.totalTokens + input + output,
      requests: current.requests + 1,
    });
  } catch (err) {
    // Falha ao registrar não pode derrubar a resposta da IA.
    console.error("[IA] não foi possível registrar o consumo:", err);
  }
}
