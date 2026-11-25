// Times do Appwrite = agências. Só o servidor (com a chave de API) cria times,
// adiciona e tira pessoas, e acerta as permissões dos registros da equipe.
import { appwriteServerConfig } from '@/integrations/appwrite/server';
import { agencyPermissions } from '@/integrations/appwrite/permissions';

const DB = process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || '6abdb82f002c563b2ad3';

async function api<T = any>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const cfg = appwriteServerConfig();
  if (!cfg.key) throw new Error('APPWRITE_API_KEY ausente no servidor.');
  const res = await fetch(`${cfg.endpoint}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Appwrite-Project': cfg.project, 'X-Appwrite-Key': cfg.key },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

const q = (method: string, values: unknown[], attribute?: string) =>
  `queries[]=${encodeURIComponent(JSON.stringify(attribute ? { method, attribute, values } : { method, values }))}`;

export async function listDocs(collection: string, queries: string[] = []): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | null = null;
  for (;;) {
    const qs: string = [...queries, q('limit', [100]), ...(cursor ? [q('cursorAfter', [cursor])] : [])].join('&');
    const { status, data }: { status: number; data: any } = await api("GET", `/databases/${DB}/collections/${collection}/documents?${qs}`);
    if (status !== 200) throw new Error(`listDocs ${collection}: ${status}`);
    out.push(...data.documents);
    if (data.documents.length < 100) return out;
    cursor = data.documents[data.documents.length - 1].$id;
  }
}

export async function updateDoc(collection: string, id: string, data: Record<string, unknown>, permissions?: string[]) {
  const { status, data: res } = await api('PATCH', `/databases/${DB}/collections/${collection}/documents/${id}`, { data, ...(permissions ? { permissions } : {}) });
  if (status !== 200) throw new Error(`updateDoc ${collection}/${id}: ${status} ${res?.message ?? ''}`);
  return res;
}

export async function createDoc(collection: string, data: Record<string, unknown>, permissions: string[] | undefined) {
  const { status, data: res } = await api('POST', `/databases/${DB}/collections/${collection}/documents`, { documentId: 'unique()', data, permissions: permissions ?? [] });
  if (status !== 201) throw new Error(`createDoc ${collection}: ${status} ${res?.message ?? ''}`);
  return res;
}

export async function apagarDoc(collection: string, id: string) {
  const { status } = await api('DELETE', `/databases/${DB}/collections/${collection}/documents/${id}`);
  if (status !== 204 && status !== 404) throw new Error(`apagarDoc ${collection}/${id}: ${status}`);
}

/** Quantos registros têm `campo = valor` (para decidir entre bloquear e excluir). */
export async function contar(collection: string, campo: string, valor: string): Promise<number> {
  const { status, data } = await api('GET', `/databases/${DB}/collections/${collection}/documents?${q('equal', [valor], campo)}&${q('limit', [1])}`);
  return status === 200 ? Number(data?.total) || 0 : 0;
}

export async function userExists(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { status } = await api('GET', `/users/${encodeURIComponent(userId)}`);
  return status === 200;
}

async function ensureTeam(agencyId: string, name: string) {
  const got = await api('GET', `/teams/${agencyId}`);
  if (got.status === 200) return;
  const made = await api('POST', '/teams', { teamId: agencyId, name: name || 'Agência' });
  if (made.status !== 201 && made.status !== 409) throw new Error(`Não foi possível criar o time da agência (${made.status}).`);
}

/**
 * Deixa o time da agência igual à equipe: quem está ativo e tem conta entra,
 * quem foi bloqueado ou removido sai. Também garante que a agência e as linhas
 * da equipe só sejam visíveis para o time.
 */
export async function syncAgencyTeam(agencyId: string) {
  const perms = agencyPermissions(agencyId);
  if (!perms) throw new Error('Agência inválida.');
  const agency = (await listDocs('agencies', [q('equal', [agencyId], '$id')]))[0];
  if (!agency) throw new Error('Agência não encontrada.');
  await ensureTeam(agencyId, agency.name);

  const members = await listDocs('agency_members', [q('equal', [agencyId], 'agency_id')]);
  const ativos = new Set<string>();
  for (const m of members) if (m.is_active && m.user_id && (await userExists(m.user_id))) ativos.add(m.user_id);

  const { data } = await api('GET', `/teams/${agencyId}/memberships?${q('limit', [100])}`);
  const atuais: { $id: string; userId: string }[] = data?.memberships ?? [];
  for (const ms of atuais) if (!ativos.has(ms.userId)) await api('DELETE', `/teams/${agencyId}/memberships/${ms.$id}`);
  for (const userId of ativos) {
    if (atuais.some((ms) => ms.userId === userId)) continue;
    const r = await api('POST', `/teams/${agencyId}/memberships`, { userId, roles: ['member'] });
    if (r.status !== 201 && r.status !== 409) throw new Error(`Não foi possível pôr a pessoa no time (${r.status}).`);
  }

  const mesmo = (a: string[], b: string[]) => a.length === b.length && b.every((p) => a.includes(p));
  if (!mesmo(agency.$permissions, perms)) await updateDoc('agencies', agencyId, {}, perms);
  // Linhas da equipe: o time só lê. Cargo, bloqueio e preferências mudam pelo servidor.
  const leitura = [perms[0]];
  for (const m of members) if (!mesmo(m.$permissions, leitura)) await updateDoc('agency_members', m.$id, {}, leitura);
}

export { q as query };
