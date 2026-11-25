// Separa os dados por agência no Appwrite.
//
// 1. Cria um time por agência (mesmo id da agência) e põe nele quem está ativo
//    na equipe e tem conta. Liga contas migradas pelo e-mail confirmado.
// 2. Cada registro passa a ser lido, alterado e apagado só pelo time da agência
//    dona. Configurações, financeiro e linhas sem agência ficam só para o servidor.
// 3. Liga a segurança por documento nas coleções e por arquivo no bucket, e tira
//    a leitura de "qualquer conta logada".
//
// Uso:  APPWRITE_ENDPOINT=... APPWRITE_PROJECT_ID=... APPWRITE_API_KEY=... \
//       APPWRITE_DATABASE_ID=... node scripts/appwrite/isolar-agencias.mjs [--aplicar] [--backup arquivo.json]
// Sem --aplicar só mostra o que faria. Pode rodar de novo: acerta o que faltar
// (por exemplo, registros criados por uma versão antiga do app).
import { writeFileSync } from 'node:fs';

const E = (process.env.APPWRITE_ENDPOINT || 'https://appwrite.agenc-ia.net/v1').replace(/\/$/, '');
const P = process.env.APPWRITE_PROJECT_ID || '6abdb8190017d98565f5';
const DB = process.env.APPWRITE_DATABASE_ID || '6abdb82f002c563b2ad3';
const KEY = process.env.APPWRITE_API_KEY || '';
const BUCKET = process.env.APPWRITE_BUCKET_ID || 'trip-attachments';
const APLICAR = process.argv.includes('--aplicar');
const BACKUP = process.argv.includes('--backup') ? process.argv[process.argv.indexOf('--backup') + 1] : null;

// Coleções que o navegador cria (create para contas logadas; o resto vem do documento).
const NAVEGADOR_CRIA = ['crm_clients', 'crm_leads', 'crm_lead_activities', 'crm_itineraries', 'crm_itinerary_days', 'crm_itinerary_activities', 'crm_vouchers', 'crm_trip_expenses', 'crm_tasks', 'crm_notifications', 'crm_library_destinations', 'crm_library_items', 'crm_lead_documents'];
// Só o servidor: configurações com segredos, financeiro, agência e equipe (criadas pelo servidor).
const SO_SERVIDOR_DOCS = new Set(['system_settings', 'crm_transactions', 'agency_payment_settings']);

async function api(method, path, body) {
  const res = await fetch(E + path, { method, headers: { 'Content-Type': 'application/json', 'X-Appwrite-Project': P, 'X-Appwrite-Key': KEY || 'chave-via-proxy' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await res.text();
  let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  return { status: res.status, data };
}
const q = (method, values, attribute) => 'queries[]=' + encodeURIComponent(JSON.stringify(attribute ? { method, attribute, values } : { method, values }));
async function todos(col) {
  const out = []; let cur = null;
  for (;;) {
    const r = await api('GET', `/databases/${DB}/collections/${col}/documents?${[q('limit', [100]), ...(cur ? [q('cursorAfter', [cur])] : [])].join('&')}`);
    if (r.status === 404) return null;
    if (r.status !== 200) throw new Error(`${col}: ${r.status} ${r.data?.message}`);
    out.push(...r.data.documents);
    if (r.data.documents.length < 100) return out;
    cur = r.data.documents.at(-1).$id;
  }
}
const time = (id) => [`read("team:${id}")`, `update("team:${id}")`, `delete("team:${id}")`];
const igual = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const log = (...a) => console.log(APLICAR ? '•' : '(simulação)', ...a);
async function fazer(desc, fn) { log(desc); if (APLICAR) { const r = await fn(); if (r && r.status >= 300) throw new Error(`${desc}: ${r.status} ${r.data?.message}`); } }

const colecoes = (await api('GET', `/databases/${DB}/collections?${q('limit', [100])}`)).data.collections;
const backup = { quando: new Date().toISOString(), colecoes: colecoes.map((c) => ({ id: c.$id, permissions: c.$permissions, documentSecurity: c.documentSecurity })), documentos: {}, arquivos: [], bucket: null };

// ── 1. Times ──────────────────────────────────────────────────────
const usuarios = (await api('GET', `/users?${q('limit', [100])}`)).data.users;
const userIds = new Set(usuarios.map((u) => u.$id));
const verificadoPorEmail = new Map(usuarios.filter((u) => u.emailVerification).map((u) => [u.email.toLowerCase(), u.$id]));
const agencias = await todos('agencies');
const membros = await todos('agency_members');
const idsAgencia = new Set(agencias.map((a) => a.$id));

for (const m of membros) {
  if (!m.is_active || userIds.has(m.user_id)) continue;
  const uid = verificadoPorEmail.get((m.email || '').toLowerCase());
  if (uid) await fazer(`ligar ${m.name} à conta do mesmo e-mail (confirmado)`, () => api('PATCH', `/databases/${DB}/collections/agency_members/documents/${m.$id}`, { data: { user_id: uid } }).then((r) => { m.user_id = uid; return r; }));
}

for (const a of agencias) {
  const existe = (await api('GET', `/teams/${a.$id}`)).status === 200;
  if (!existe) await fazer(`criar time da agência "${a.name}"`, () => api('POST', '/teams', { teamId: a.$id, name: a.name }));
  const atuais = existe ? (await api('GET', `/teams/${a.$id}/memberships?${q('limit', [100])}`)).data.memberships : [];
  for (const m of membros.filter((x) => x.agency_id === a.$id && x.is_active && userIds.has(x.user_id))) {
    if (atuais.some((ms) => ms.userId === m.user_id)) continue;
    await fazer(`  pôr ${m.name} no time`, () => api('POST', `/teams/${a.$id}/memberships`, { userId: m.user_id, roles: ['member'] }));
  }
}

// ── 2. Permissões dos registros ───────────────────────────────────
const cache = {};
const docs = async (col) => (cache[col] ??= (await todos(col)) ?? []);
const roteiroAgencia = new Map((await docs('crm_itineraries')).map((r) => [r.$id, r.agency_id]));
const diaAgencia = new Map((await docs('crm_itinerary_days')).map((d) => [d.$id, roteiroAgencia.get(d.itinerary_id)]));
function dono(col, d) {
  if (SO_SERVIDOR_DOCS.has(col)) return null;
  if (col === 'agencies') return d.$id;
  if (col === 'crm_itinerary_days' || col === 'crm_vouchers') return roteiroAgencia.get(d.itinerary_id) ?? null;
  if (col === 'crm_itinerary_activities') return diaAgencia.get(d.day_id) ?? null;
  return d.agency_id ?? null;
}
for (const c of colecoes) {
  const lista = await docs(c.$id);
  backup.documentos[c.$id] = lista.map((d) => ({ id: d.$id, permissions: d.$permissions }));
  let mudou = 0, semDono = 0;
  for (const d of lista) {
    const ag = dono(c.$id, d);
    // Linhas da equipe: o time só lê; cargo, bloqueio e preferências mudam pelo servidor.
    const alvo = ag && idsAgencia.has(ag) ? (c.$id === 'agency_members' ? time(ag).slice(0, 1) : time(ag)) : [];
    if (!alvo.length && !SO_SERVIDOR_DOCS.has(c.$id)) semDono++;
    if (igual(d.$permissions, alvo)) continue;
    mudou++;
    if (APLICAR) {
      const r = await api('PATCH', `/databases/${DB}/collections/${c.$id}/documents/${d.$id}`, { data: {}, permissions: alvo });
      if (r.status !== 200) throw new Error(`${c.$id}/${d.$id}: ${r.status} ${r.data?.message}`);
    }
  }
  log(`${c.$id}: ${lista.length} registros, ${mudou} com permissão acertada${semDono ? `, ${semDono} sem agência (ficam só para o servidor)` : ''}`);
}

// Arquivos: o dono é a agência de quem enviou (permissão "user:" antiga) ou o prefixo do id.
const membroAgencia = new Map(membros.filter((m) => m.user_id).map((m) => [m.user_id, m.agency_id]));
const bucket = (await api('GET', `/storage/buckets/${BUCKET}`)).data;
backup.bucket = { permissions: bucket.$permissions, fileSecurity: bucket.fileSecurity };
const arquivos = (await api('GET', `/storage/buckets/${BUCKET}/files?${q('limit', [100])}`)).data.files ?? [];
for (const f of arquivos) {
  backup.arquivos.push({ id: f.$id, permissions: f.$permissions });
  const uid = /user:([^")]+)/.exec(f.$permissions.join(' '))?.[1];
  const ag = (uid && membroAgencia.get(uid)) || [...idsAgencia].find((id) => f.$id.startsWith(id));
  const alvo = ag ? time(ag) : [];
  if (igual(f.$permissions, alvo)) continue;
  await fazer(`arquivo ${f.$id}: só para o time da agência`, () => api('PUT', `/storage/buckets/${BUCKET}/files/${f.$id}`, { name: f.name, permissions: alvo }));
}

if (BACKUP) { writeFileSync(BACKUP, JSON.stringify(backup, null, 2)); console.log('backup das permissões em', BACKUP); }

// ── 3. Segurança por documento ────────────────────────────────────
for (const c of colecoes) {
  const perms = NAVEGADOR_CRIA.includes(c.$id) ? ['create("users")'] : [];
  if (c.documentSecurity && igual(c.$permissions, perms)) continue;
  await fazer(`coleção ${c.$id}: segurança por documento, coleção ${perms.length ? 'só cria' : 'fechada'}`, () =>
    api('PUT', `/databases/${DB}/collections/${c.$id}`, { name: c.name, permissions: perms, documentSecurity: true, enabled: c.enabled }));
}
if (!(bucket.fileSecurity && igual(bucket.$permissions, ['create("users")']))) {
  await fazer(`bucket ${BUCKET}: segurança por arquivo, só cria`, () =>
    api('PUT', `/storage/buckets/${BUCKET}`, { name: bucket.name, permissions: ['create("users")'], fileSecurity: true, enabled: bucket.enabled, maximumFileSize: bucket.maximumFileSize, allowedFileExtensions: bucket.allowedFileExtensions, compression: bucket.compression, encryption: bucket.encryption, antivirus: bucket.antivirus }));
}
console.log(APLICAR ? 'pronto.' : 'simulação: nada foi alterado. Rode com --aplicar.');
