import { client, databases, storage, account, APPWRITE_DATABASE_ID, APPWRITE_BUCKET_ID, Query, ID } from './client';
import { appwriteAuthService } from '@/services/appwriteAuthService';
import type { Databases, Storage } from 'appwrite';
import { COLLECTION_FIELDS } from './schema';
import { parseSelect, resolveRelation, type EmbedSpec } from './embed';

export type BridgeServices = { databases: Databases; storage: Storage };

// Campos guardados como texto no Appwrite que as telas usam como objeto.
const JSON_FIELDS = ['settings', 'preferences', 'profile', 'benefits', 'checklists', 'knowledge_sources', 'value'];

// Nomes que as telas usam para campos que no Appwrite têm outro nome.
const FIELD_ALIASES: Record<string, Record<string, string>> = {
  crm_itinerary_days: { title: 'label' },
  crm_itinerary_activities: { time: 'time_start' },
};

// Normaliza o documento do Appwrite para o formato que as telas esperam (id, created_at, updated_at)
function normalizeDoc(doc: any, collectionId?: string): any {
  if (!doc || typeof doc !== 'object') return doc;
  const normalized = { ...doc };
  const aliases = collectionId ? FIELD_ALIASES[collectionId] : undefined;
  if (aliases) {
    for (const [uiName, column] of Object.entries(aliases)) {
      if (normalized[uiName] == null && normalized[column] != null) normalized[uiName] = normalized[column];
    }
  }
  normalized.id = doc.id || doc.$id;
  normalized.created_at = doc.created_at || doc.$createdAt;
  normalized.updated_at = doc.updated_at || doc.$updatedAt;

  for (const field of JSON_FIELDS) {
    if (typeof normalized[field] === 'string') {
      try {
        normalized[field] = JSON.parse(normalized[field]);
      } catch {
        // mantém string
      }
    }
  }

  return normalized;
}

class PayloadError extends Error {}

// Prepara o payload para gravar no Appwrite. Confere cada campo contra o mapa
// real da coleção (schema.ts): campo que a coleção não tem é descartado com
// aviso (o Appwrite recusaria o registro inteiro), objetos viram texto JSON,
// números e booleanos são convertidos, e texto maior que o limite vira um erro
// claro em vez de uma recusa sem explicação.
function preparePayload(collectionId: string, data: any): any {
  if (!data || typeof data !== 'object') return data;
  const fields = COLLECTION_FIELDS[collectionId];
  const aliases = FIELD_ALIASES[collectionId] ?? {};
  const payload: Record<string, any> = {};

  for (const [key, raw] of Object.entries(data)) {
    if (key.startsWith('$')) continue; // campos de sistema
    if (key === 'id') continue; // o ID vai como documentId
    if (raw === undefined) continue;
    // Nome de tela → nome real do campo (sem sobrescrever o real, se veio junto).
    const k = aliases[key] && (data as any)[aliases[key]] === undefined ? aliases[key] : key;
    if (k === key && aliases[key]) continue;

    const spec = fields?.[k];
    if (fields && !spec) {
      if (raw !== null) console.warn(`[dados] "${collectionId}" não tem o campo "${k}"; valor não gravado.`);
      continue;
    }

    let v: any = raw;
    if (v !== null && spec) {
      if (spec.array) {
        v = (Array.isArray(v) ? v : [v]).filter((x) => x !== null && x !== undefined).map((x) => String(x));
      } else if (spec.type === 's') {
        if (typeof v === 'object') v = JSON.stringify(v);
        else if (typeof v !== 'string') v = String(v);
        if (spec.size && v.length > spec.size) {
          throw new PayloadError(`O campo "${k}" passou do limite de ${spec.size} caracteres (${v.length}).`);
        }
      } else if (spec.type === 'n' || spec.type === 'i') {
        if (v === '') v = null;
        else {
          const n = typeof v === 'number' ? v : Number(v);
          if (!Number.isFinite(n)) throw new PayloadError(`O campo "${k}" precisa ser um número.`);
          v = spec.type === 'i' ? Math.round(n) : n;
        }
      } else if (spec.type === 'b') {
        v = v === true || v === 'true' || v === 1;
      }
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      v = JSON.stringify(v);
    }
    payload[k] = v;
  }

  return payload;
}

// Valida ou gera um ID de documento compatível com Appwrite
function getValidDocId(rawId?: string): string {
  if (!rawId) return ID.unique();
  const clean = rawId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36);
  if (clean.length > 0 && !clean.startsWith('_')) {
    return clean;
  }
  return ID.unique();
}

function matchesLike(value: unknown, pattern: string, caseInsensitive: boolean): boolean {
  if (value === null || value === undefined) return false;
  const expression = pattern
    .split(/([%_])/)
    .map((part) => part === '%' ? '.*' : part === '_' ? '.' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('');
  return new RegExp(`^${expression}$`, caseInsensitive ? 'i' : '').test(String(value));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function listAll(svc: BridgeServices, collectionId: string, queries: string[]): Promise<any[]> {
  const documents: any[] = [];
  let cursor: string | null = null;
  do {
    const page: { documents: any[]; total: number } = await svc.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      collectionId,
      [...queries, Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
    );
    documents.push(...page.documents);
    cursor = page.documents.length === 100 ? page.documents[page.documents.length - 1].$id : null;
  } while (cursor);
  return documents;
}

// Carrega os registros relacionados pedidos no select (ex.: os itens de cada
// dia, o responsável de cada venda) e pendura em cada documento. O Appwrite não
// faz essa junção sozinho, então ela é feita aqui, em lotes.
async function hydrateEmbeds(
  svc: BridgeServices,
  parentTable: string,
  docs: any[],
  embeds: EmbedSpec[],
  scopeAgencyId: string | null,
): Promise<void> {
  if (!docs.length || !embeds.length) return;
  for (const embed of embeds) {
    const rel = resolveRelation(parentTable, embed);
    if (!rel) {
      console.warn(`[dados] relação desconhecida: ${parentTable} → ${embed.table}`);
      for (const d of docs) d[embed.alias] = null;
      continue;
    }
    const scoped =
      scopeAgencyId && COLLECTION_FIELDS[embed.table]?.agency_id ? [Query.equal('agency_id', scopeAgencyId)] : [];
    let related: any[] = [];
    try {
      if (rel.kind === 'one') {
        const ids = Array.from(new Set(docs.map((d) => d[rel.column]).filter((v) => typeof v === 'string' && v)));
        for (const part of chunk(ids, 100)) {
          related.push(...(await listAll(svc, embed.table, [Query.equal('$id', part), ...scoped])));
        }
        related = related.map((r) => normalizeDoc(r, embed.table));
        await hydrateEmbeds(svc, embed.table, related, embed.embeds, scopeAgencyId);
        const byId = new Map(related.map((r) => [r.id, r]));
        for (const d of docs) d[embed.alias] = byId.get(d[rel.column]) ?? null;
      } else {
        const ids = Array.from(new Set(docs.map((d) => d.id).filter(Boolean)));
        for (const part of chunk(ids, 100)) {
          related.push(...(await listAll(svc, embed.table, [Query.equal(rel.column, part), ...scoped])));
        }
        related = related.map((r) => normalizeDoc(r, embed.table));
        related.sort(
          (x, y) =>
            (x.sort_order ?? 0) - (y.sort_order ?? 0) || String(x.created_at).localeCompare(String(y.created_at)),
        );
        await hydrateEmbeds(svc, embed.table, related, embed.embeds, scopeAgencyId);
        const groups = new Map<string, any[]>();
        for (const r of related) {
          const key = r[rel.column];
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(r);
        }
        for (const d of docs) d[embed.alias] = groups.get(d.id) ?? [];
      }
    } catch (err) {
      console.error(`[dados] falha ao carregar ${embed.table} de ${parentTable}:`, err);
      for (const d of docs) d[embed.alias] = rel.kind === 'one' ? null : [];
    }
  }
}

class AppwriteQueryBuilder {
  private onConflictCol: string | null = null;
  private collectionId: string;
  private queries: string[] = [];
  private localFilters: Array<(doc: any) => boolean> = [];
  private isSingle = false;
  private isMaybeSingle = false;
  private windowStart = 0;
  private windowCount: number | null = null;
  private action: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private writePayload: any = null;
  private scopeAgencyId: string | null = null;
  private scopeApplied = false;
  private embeds: EmbedSpec[] = [];
  private headOnly = false;
  private localSorts: Array<{ column: string; ascending: boolean }> = [];

  constructor(collectionId: string, private svc: BridgeServices) {
    this.collectionId = collectionId;
  }

  select(columns?: string, options?: { count?: string; head?: boolean }) {
    // `.insert(...).select()` e `.update(...).select()` mantêm a escrita e
    // apenas pedem o registro resultante: a operação já definida é preservada.
    if (columns) this.embeds = parseSelect(columns).embeds;
    if (options?.head) this.headOnly = true;
    return this;
  }

  /**
   * Restringe a operação a uma agência (uso no servidor, que tem acesso total
   * pela chave de API): filtra leituras, edições e exclusões por `agency_id` e
   * grava `agency_id` nas inserções. É a separação entre agências no servidor.
   */
  withAgencyScope(agencyId: string) {
    this.scopeAgencyId = agencyId;
    return this;
  }

  insert(values: any | any[]) {
    this.action = 'insert';
    this.writePayload = values;
    return this;
  }

  upsert(values: any | any[], opts?: { onConflict?: string }) {
    this.action = 'upsert';
    this.writePayload = values;
    if (opts?.onConflict) {
      this.onConflictCol = opts.onConflict;
    }
    return this;
  }

  update(values: any) {
    this.action = 'update';
    this.writePayload = values;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    if (value === null || value === undefined) return this;
    const col = column === 'id' ? '$id' : column;
    this.queries.push(Query.equal(col, value));
    return this;
  }

  neq(column: string, value: any) {
    if (value === null || value === undefined) return this;
    const col = column === 'id' ? '$id' : column;
    this.queries.push(Query.notEqual(col, value));
    return this;
  }

  in(column: string, values: any[]) {
    if (!values || values.length === 0) return this;
    const col = column === 'id' ? '$id' : column;
    this.queries.push(Query.equal(col, values));
    return this;
  }

  like(column: string, pattern: string) {
    this.localFilters.push((doc) => matchesLike(doc[column], pattern, false));
    return this;
  }

  ilike(column: string, pattern: string) {
    this.localFilters.push((doc) => matchesLike(doc[column], pattern, true));
    return this;
  }

  is(column: string, value: any) {
    const col = column === 'id' ? '$id' : column;
    if (value === null) {
      this.queries.push(Query.isNull(col));
    } else {
      this.queries.push(Query.equal(col, value));
    }
    return this;
  }

  not(column: string, operator: string, value: any) {
    const col = column === 'id' ? '$id' : column;
    if (operator === 'is' && value === null) {
      this.queries.push(Query.isNotNull(col));
    } else {
      this.queries.push(Query.notEqual(col, value));
    }
    return this;
  }

  gte(column: string, value: any) {
    const col = column === 'id' ? '$id' : column;
    this.queries.push(Query.greaterThanEqual(col, value));
    return this;
  }

  lte(column: string, value: any) {
    const col = column === 'id' ? '$id' : column;
    this.queries.push(Query.lessThanEqual(col, value));
    return this;
  }

  gt(column: string, value: any) {
    const col = column === 'id' ? '$id' : column;
    this.queries.push(Query.greaterThan(col, value));
    return this;
  }

  lt(column: string, value: any) {
    const col = column === 'id' ? '$id' : column;
    this.queries.push(Query.lessThan(col, value));
    return this;
  }

  contains(column: string, values: any[]) {
    const col = column === 'id' ? '$id' : column;
    this.queries.push(Query.contains(col, values));
    return this;
  }

  or(expression: string) {
    const predicates = expression.split(',').flatMap((part) => {
      const match = /^([^.]*)\.(ilike|like|eq)\.(.*)$/.exec(part);
      if (!match) return [];
      const [, field, op, value] = match;
      return [(doc: any) => op === 'eq'
        ? String(doc[field] ?? '') === value
        : matchesLike(doc[field], value, op === 'ilike')];
    });
    if (predicates.length > 0) {
      this.localFilters.push((doc) => predicates.some((predicate) => predicate(doc)));
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    const ascending = options?.ascending ?? true;
    // Registros migrados trazem a data no campo; os novos só têm a data do
    // Appwrite. Ordenar depois de ler usa a data certa nos dois casos.
    if (column === 'created_at' || column === 'updated_at') {
      this.localSorts.push({ column, ascending });
      return this;
    }
    const col = column === 'id' ? '$createdAt' : column;
    if (ascending) {
      this.queries.push(Query.orderAsc(col));
    } else {
      this.queries.push(Query.orderDesc(col));
    }
    return this;
  }

  limit(count: number) {
    this.windowCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.windowStart = from;
    this.windowCount = to - from + 1;
    return this;
  }

  single() {
    this.isSingle = true;
    // Numa leitura basta um registro; numa escrita o filtro decide o alcance.
    if (this.action === 'select') this.windowCount = 1;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    if (this.action === 'select') this.windowCount = 1;
    return this;
  }

  private async listMatchingDocuments() {
    if (this.windowCount !== null && this.localFilters.length === 0 && this.localSorts.length === 0) {
      return this.svc.databases.listDocuments(APPWRITE_DATABASE_ID, this.collectionId, [
        ...this.queries,
        ...(this.windowStart ? [Query.offset(this.windowStart)] : []),
        Query.limit(this.windowCount),
      ]);
    }

    // Appwrite devolve apenas 25 documentos sem paginação. As telas e as
    // atualizações em lote esperam todos os registros da consulta.
    const documents = await listAll(this.svc, this.collectionId, this.queries);
    const total = documents.length;
    if (this.localFilters.length === 0 && this.localSorts.length === 0) return { documents, total };
    const matching = documents.filter((doc) => this.localFilters.every((filter) => filter(doc)));
    if (this.localSorts.length > 0) {
      const dateOf = (doc: any, column: string) =>
        String(doc[column] || (column === 'created_at' ? doc.$createdAt : doc.$updatedAt) || '');
      matching.sort((x, y) => {
        for (const { column, ascending } of this.localSorts) {
          const diff = dateOf(x, column).localeCompare(dateOf(y, column));
          if (diff !== 0) return ascending ? diff : -diff;
        }
        return 0;
      });
    }
    return {
      documents: this.windowCount === null
        ? matching
        : matching.slice(this.windowStart, this.windowStart + this.windowCount),
      total: matching.length,
    };
  }

  async execute(): Promise<{ data: any; error: any; count?: number }> {
    try {
      const scope = this.scopeAgencyId;
      if (scope && !this.scopeApplied && this.action !== 'insert' && this.action !== 'upsert') {
        this.queries.push(Query.equal('agency_id', scope));
        this.scopeApplied = true;
      }
      if (this.action === 'select') {
        if (this.headOnly && this.localFilters.length === 0) {
          // Só a contagem: uma página mínima já traz o total.
          const res = await this.svc.databases.listDocuments(APPWRITE_DATABASE_ID, this.collectionId, [
            ...this.queries,
            Query.limit(1),
          ]);
          return { data: null, error: null, count: res.total };
        }
        const res = await this.listMatchingDocuments();
        if (this.headOnly) return { data: null, error: null, count: res.total };
        const docs = res.documents.map((d: any) => normalizeDoc(d, this.collectionId));
        await hydrateEmbeds(this.svc, this.collectionId, docs, this.embeds, scope);

        if (this.isSingle) {
          if (docs.length === 0) {
            return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
          }
          return { data: docs[0], error: null };
        }

        if (this.isMaybeSingle) {
          return { data: docs[0] || null, error: null };
        }

        return { data: docs, error: null, count: res.total };
      }

      if (this.action === 'insert' || this.action === 'upsert') {
        const items = Array.isArray(this.writePayload) ? this.writePayload : [this.writePayload];
        const results = [];

        for (const rawItem of items) {
          const item = scope ? { ...rawItem, agency_id: scope } : rawItem;
          const payload = preparePayload(this.collectionId, item);
          let targetId: string | null = null;

          // Se há onConflict (ex: 'key' em system_settings)
          if (this.onConflictCol && item[this.onConflictCol] !== undefined) {
            try {
              const existing = await this.svc.databases.listDocuments(
                APPWRITE_DATABASE_ID,
                this.collectionId,
                [
                  Query.equal(this.onConflictCol, item[this.onConflictCol]),
                  ...(scope ? [Query.equal('agency_id', scope)] : []),
                  Query.limit(1),
                ]
              );
              if (existing.documents.length > 0) {
                targetId = existing.documents[0].$id;
              }
            } catch {}
          } else if (item.id) {
            const candidate = getValidDocId(item.id);
            try {
              const existing = await this.svc.databases.getDocument(APPWRITE_DATABASE_ID, this.collectionId, candidate);
              if (existing && scope && (existing as any).agency_id !== scope) {
                throw Object.assign(new Error('Registro de outra agência.'), { code: 403, scopeViolation: true });
              }
              if (existing) targetId = candidate;
            } catch (lookupErr: any) {
              if (lookupErr?.scopeViolation) throw lookupErr;
            }
          }

          let doc;
          if (targetId) {
            doc = await this.svc.databases.updateDocument(APPWRITE_DATABASE_ID, this.collectionId, targetId, payload);
          } else {
            const docId = getValidDocId(item.id);
            try {
              doc = await this.svc.databases.createDocument(APPWRITE_DATABASE_ID, this.collectionId, docId, payload);
            } catch (createErr: any) {
              if ((createErr.code === 409 || createErr.type === 'document_already_exists') && !scope) {
                doc = await this.svc.databases.updateDocument(APPWRITE_DATABASE_ID, this.collectionId, docId, payload);
              } else {
                throw createErr;
              }
            }
          }
          results.push(normalizeDoc(doc, this.collectionId));
        }

        await hydrateEmbeds(this.svc, this.collectionId, results, this.embeds, scope);
        const data = Array.isArray(this.writePayload) && !this.isSingle && !this.isMaybeSingle ? results : results[0];
        return { data, error: null };
      }

      if (this.action === 'update') {
        // Encontra o documento pelo query ou ID
        const list = await this.listMatchingDocuments();
        if (list.documents.length === 0) {
          return { data: null, error: null };
        }

        const payload = preparePayload(this.collectionId, this.writePayload);
        const updatedDocs = [];
        for (const target of list.documents) {
          const updated = await this.svc.databases.updateDocument(APPWRITE_DATABASE_ID, this.collectionId, target.$id, payload);
          updatedDocs.push(normalizeDoc(updated, this.collectionId));
        }

        await hydrateEmbeds(this.svc, this.collectionId, updatedDocs, this.embeds, scope);
        const one = updatedDocs.length === 1 || this.isSingle || this.isMaybeSingle;
        return { data: one ? updatedDocs[0] : updatedDocs, error: null };
      }

      if (this.action === 'delete') {
        const list = await this.listMatchingDocuments();
        for (const target of list.documents) {
          await this.svc.databases.deleteDocument(APPWRITE_DATABASE_ID, this.collectionId, target.$id);
        }
        return { data: null, error: null };
      }

      return { data: null, error: null };
    } catch (err: any) {
      console.error(`[Appwrite Bridge Error on ${this.collectionId}]:`, err);
      return {
        data: null,
        error: { ...err, message: err.message || 'Erro na operação do banco', code: err.code, type: err.type },
      };
    }
  }

  // Permite uso com await direto: const { data } = await db.from('...').select()
  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// ── Bridge Auth ───────────────────────────────────────────────────
class AppwriteAuthBridge {
  private authListeners: ((event: string, session: any) => void)[] = [];

  private notifyAuth(event: string, session: any) {
    this.authListeners.forEach((cb) => {
      try {
        cb(event, session);
      } catch (err) {
        console.error("[AuthListener Error]:", err);
      }
    });
  }

  async getSession() {
    try {
      const user = await appwriteAuthService.getCurrentUser();
      if (!user) return { data: { session: null }, error: null };
      const session = {
        access_token: 'appwrite_session_active',
        user: {
          id: user.id,
          email: user.email,
          user_metadata: { name: user.name },
        },
      };
      return { data: { session: session as any }, error: null };
    } catch (err: any) {
      return { data: { session: null }, error: err };
    }
  }

  async getUser() {
    try {
      const user = await appwriteAuthService.getCurrentUser();
      if (!user) return { data: { user: null }, error: null };
      return {
        data: {
          user: {
            id: user.id,
            email: user.email,
            user_metadata: { name: user.name },
          } as any,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: { user: null }, error: err };
    }
  }

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const user = await appwriteAuthService.login(email, password);
      const userObj = { id: user.id, email: user.email, user_metadata: { name: user.name } };
      return {
        data: {
          user: userObj,
          session: { access_token: 'appwrite_session_active', user: userObj } as any,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: { message: err.message } };
    }
  }

  async signInWithOAuth({ provider }: { provider: string }) {
    if (provider === 'google') {
      appwriteAuthService.loginWithGoogle();
      return { data: { provider: 'google', url: '' }, error: null };
    }
    return { data: null, error: { message: `Provedor ${provider} não suportado.` } };
  }

  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { name?: string } } }) {
    try {
      const name = options?.data?.name || email.split('@')[0];
      const user = await appwriteAuthService.register(name, email, password);
      const userObj = { id: user.id, email: user.email, user_metadata: { name: user.name } };
      return {
        data: {
          user: userObj,
          session: { access_token: 'appwrite_session_active', user: userObj } as any,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: { message: err.message } };
    }
  }

  async signOut() {
    try {
      await appwriteAuthService.logout();
    } finally {
      this.notifyAuth("SIGNED_OUT", null);
    }
    return { error: null };
  }

  async updateUser({ password }: { password?: string }) {
    try {
      if (password) {
        await account.updatePassword(password);
      }
      const user = await appwriteAuthService.getCurrentUser();
      return { data: { user }, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    this.authListeners.push(callback);
    // Dispara estado inicial
    this.getSession().then(({ data }) => {
      callback('INITIAL_SESSION', data.session);
    });

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.authListeners = this.authListeners.filter((cb) => cb !== callback);
          },
        },
      },
    };
  }
}

// ── Arquivos ──────────────────────────────────────────────────────
// As telas identificam cada arquivo por um caminho ("agência/viagem/nome.pdf").
// O Appwrite só aceita IDs curtos, então cada caminho vira um ID fixo de 33
// caracteres. Antes o ID era o começo do caminho, e todos os arquivos de uma
// agência disputavam o mesmo ID: só o primeiro envio dava certo.
function fileIdFor(path: string): string {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < path.length; i++) {
    const k = path.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return `f${hex(h1 ^ h2 ^ h3 ^ h4)}${hex(h2 ^ h1)}${hex(h3 ^ h1)}${hex(h4 ^ h1)}`;
}

// ID que os envios antigos usavam (para continuar abrindo o que já existe).
function legacyFileIdFor(path: string): string {
  return getValidDocId(path.replace(/[^a-zA-Z0-9]/g, '-'));
}

// O projeto tem um bucket só. Os nomes que o código usa apontam para ele.
function resolveBucket(bucketId: string): string {
  return bucketId === 'library-assets' ? APPWRITE_BUCKET_ID : bucketId;
}

const isBrowser = typeof window !== 'undefined';

class AppwriteStorageBridge {
  private urlCache = new Map<string, Promise<string | null>>();

  constructor(private svc: BridgeServices) {}

  // Cabeçalhos de quem está pedindo: sessão do usuário no navegador, chave de
  // API no servidor.
  private authHeaders(): Record<string, string> {
    const source = (this.svc.storage.client.headers ?? {}) as Record<string, string>;
    const headers: Record<string, string> = {};
    for (const name of ['X-Appwrite-Project', 'X-Appwrite-Key', 'X-Appwrite-JWT']) {
      if (source[name]) headers[name] = source[name];
    }
    if (isBrowser) {
      try {
        const fallback = window.localStorage.getItem('cookieFallback');
        if (fallback) headers['X-Fallback-Cookies'] = fallback;
      } catch {}
    }
    return headers;
  }

  // Baixa o conteúdo do arquivo. Tenta o ID novo e, se não existir, o antigo.
  private async fetchFile(bucketId: string, path: string): Promise<Blob | null> {
    for (const fileId of [fileIdFor(path), legacyFileIdFor(path)]) {
      try {
        const url = this.svc.storage.getFileView(bucketId, fileId);
        const res = await fetch(url, {
          headers: this.authHeaders(),
          ...(isBrowser ? { credentials: 'include' as const } : {}),
        });
        if (res.ok) return await res.blob();
        if (res.status !== 404) return null;
      } catch {
        return null;
      }
    }
    return null;
  }

  from(rawBucketId: string = APPWRITE_BUCKET_ID) {
    const bucketId = resolveBucket(rawBucketId);
    const storage = this.svc.storage;
    const self = this;
    const cacheKey = (path: string) => `${bucketId}/${path}`;

    const api = {
      async upload(
        path: string,
        content: File | Blob | ArrayBuffer | Uint8Array,
        options?: { contentType?: string; upsert?: boolean },
      ) {
        try {
          const name = path.split('/').pop() || 'arquivo';
          const type = options?.contentType || (content as Blob).type || 'application/octet-stream';
          const file =
            content instanceof File && content.name
              ? content
              : new File([content as BlobPart], name, { type });
          const fileId = fileIdFor(path);
          try {
            await storage.createFile(bucketId, fileId, file);
          } catch (err: any) {
            if (!(options?.upsert && (err?.code === 409 || err?.type === 'storage_file_already_exists'))) throw err;
            await storage.deleteFile(bucketId, fileId);
            await storage.createFile(bucketId, fileId, file);
          }
          self.urlCache.delete(cacheKey(path));
          return { data: { path }, error: null };
        } catch (err: any) {
          console.error('[arquivos] falha ao enviar:', err);
          return { data: null, error: { message: err?.message || 'Falha ao enviar o arquivo.', ...err } };
        }
      },

      /** Conteúdo do arquivo (uso no servidor e para cópias). */
      async download(path: string) {
        const blob = await self.fetchFile(bucketId, path);
        if (!blob) return { data: null, error: { message: 'Arquivo não encontrado.' } };
        return { data: blob, error: null };
      },

      async copy(fromPath: string, toPath: string) {
        const { data: blob, error } = await api.download(fromPath);
        if (error || !blob) return { data: null, error: error ?? { message: 'Arquivo não encontrado.' } };
        return api.upload(toPath, blob, { contentType: blob.type || undefined });
      },

      getPublicUrl(path: string) {
        try {
          return { data: { publicUrl: String(storage.getFileView(bucketId, fileIdFor(path))) } };
        } catch {
          return { data: { publicUrl: '' } };
        }
      },

      // Endereço para mostrar ou baixar o arquivo. No navegador, o arquivo é
      // lido com a sessão do usuário e entregue como endereço local: um link
      // direto para o Appwrite depende de cookie de terceiros, que o Safari e o
      // iPhone bloqueiam. No servidor, quem precisa do conteúdo usa download().
      async createSignedUrl(path: string, _expiresIn: number = 3600, _options?: { download?: string | boolean }) {
        if (!isBrowser) {
          return { data: { signedUrl: String(storage.getFileView(bucketId, fileIdFor(path))) }, error: null };
        }
        const key = cacheKey(path);
        if (!self.urlCache.has(key)) {
          self.urlCache.set(
            key,
            self.fetchFile(bucketId, path).then((blob) => (blob ? URL.createObjectURL(blob) : null)),
          );
        }
        const signedUrl = await self.urlCache.get(key)!;
        if (!signedUrl) return { data: null, error: { message: 'Arquivo não encontrado.' } };
        return { data: { signedUrl }, error: null };
      },

      async remove(paths: string[]) {
        for (const path of paths) {
          self.urlCache.delete(cacheKey(path));
          try {
            await storage.deleteFile(bucketId, fileIdFor(path));
          } catch {
            try {
              await storage.deleteFile(bucketId, legacyFileIdFor(path));
            } catch {}
          }
        }
        return { data: paths, error: null };
      },
    };
    return api;
  }
}

// ── Bridge Realtime / Channels ────────────────────────────────────
class AppwriteChannelBridge {
  private name: string;
  private unsubscribeFn?: () => void;

  constructor(name: string) {
    this.name = name;
  }

  on(_event: string, filter: any, callback: (payload: any) => void) {
    try {
      if (filter?.table && client) {
        const channelName = `databases.${APPWRITE_DATABASE_ID}.collections.${filter.table}.documents`;
        this.unsubscribeFn = client.subscribe(channelName, (response) => {
          callback(response);
        });
      }
    } catch (e) {
      console.warn('[Realtime bridge warning]:', e);
    }
    return this;
  }

  subscribe(callback?: (status: string) => void) {
    if (callback) callback('SUBSCRIBED');
    return this;
  }

  unsubscribe() {
    if (this.unsubscribeFn) {
      try {
        this.unsubscribeFn();
      } catch {}
    }
  }
}

// Cliente de dados (consultas encadeadas). O mesmo código atende o navegador (sessão do
// usuário) e o servidor (chave de API), mudando só os serviços do Appwrite.
export function createAppwriteBridge(svc: BridgeServices) {
  const databases = svc.databases;
  return {
  from(collectionName: string) {
    return new AppwriteQueryBuilder(collectionName, svc);
  },
  auth: new AppwriteAuthBridge(),
  storage: new AppwriteStorageBridge(svc),
  channel(name: string) {
    return new AppwriteChannelBridge(name);
  },
  removeChannel(ch: any) {
    if (ch && typeof ch.unsubscribe === 'function') {
      ch.unsubscribe();
    }
  },
  rpc(fnName: string, args: Record<string, any> = {}) {
    const execute = async () => {
      try {
        if (fnName === 'provision_agency') {
          const currentUser = await appwriteAuthService.getCurrentUser();
          if (!currentUser) return { data: null, error: { message: 'Sessão expirada. Faça login novamente.' } };
          const userId = currentUser.id;
          const userEmail = args._email || currentUser.email || '';
          const userName = args._user_name || currentUser.name || 'Administrador';

          // Nunca cria uma segunda agência para quem já tem uma (duas abas ou
          // dois carregamentos ao mesmo tempo criavam agências repetidas).
          const already = await databases.listDocuments(APPWRITE_DATABASE_ID, 'agency_members', [
            Query.equal('user_id', userId),
            Query.limit(1),
          ]);
          if (already.documents.length > 0) {
            return { data: normalizeDoc(already.documents[0]), error: null };
          }

          const agencyId = ID.unique();
          const now = new Date().toISOString();

          await databases.createDocument(
            APPWRITE_DATABASE_ID,
            'agencies',
            agencyId,
            {
              name: args._name || `Agência de ${userName}`,
              slug: args._slug || `agencia-${Date.now().toString(36)}`,
              email: userEmail,
              created_at: now,
              updated_at: now,
            }
          );

          const memberId = ID.unique();
          let member: any;
          try {
            member = await databases.createDocument(
              APPWRITE_DATABASE_ID,
              'agency_members',
              memberId,
              {
                agency_id: agencyId,
                user_id: userId,
                name: userName,
                email: userEmail,
                role: 'admin',
                status: 'active',
                is_active: true,
                avatar_color: args._avatar_color || '#ff7a1a',
                pref_leads_mine: false,
                pref_tasks_mine: false,
                pref_agenda_mine: false,
                created_at: now,
                updated_at: now,
              }
            );
          } catch (memberErr) {
            // Sem o membro, a agência ficaria órfã: desfaz.
            try {
              await databases.deleteDocument(APPWRITE_DATABASE_ID, 'agencies', agencyId);
            } catch {}
            throw memberErr;
          }

          const memberObj = {
            id: member.$id,
            agency_id: agencyId,
            user_id: userId,
            name: member.name,
            email: member.email,
            phone: member.phone || '',
            role: member.role,
            avatar_color: member.avatar_color,
            is_active: member.is_active,
            pref_leads_mine: member.pref_leads_mine,
          };

          return { data: memberObj, error: null };
        }

        if (fnName === 'get_user_agency_id') {
          const currentUser = await appwriteAuthService.getCurrentUser();
          if (!currentUser) return { data: null, error: null };
          let res = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            'agency_members',
            [Query.equal('user_id', currentUser.id), Query.limit(1)]
          );
          if (res.documents.length === 0 && currentUser.email) {
            res = await databases.listDocuments(
              APPWRITE_DATABASE_ID,
              'agency_members',
              [Query.equal('email', currentUser.email.toLowerCase().trim()), Query.limit(1)]
            );
          }
          if (res.documents.length === 0) return { data: null, error: null };
          return { data: res.documents[0].agency_id, error: null };
        }

        if (fnName === 'has_role') {
          const currentUser = await appwriteAuthService.getCurrentUser();
          if (!currentUser) return { data: false, error: null };
          const wanted = String(args._role || args.role || '').toLowerCase();
          const res = await databases.listDocuments(APPWRITE_DATABASE_ID, 'agency_members', [
            Query.equal('user_id', currentUser.id),
            Query.limit(5),
          ]);
          const roles = res.documents.filter((m: any) => m.is_active !== false).map((m: any) => String(m.role || '').toLowerCase());
          return { data: wanted ? roles.includes(wanted) : roles.length > 0, error: null };
        }

        if (fnName === 'get_shared_itinerary') {
          const doc = await databases.getDocument(
            APPWRITE_DATABASE_ID,
            'crm_itineraries',
            args._id
          );
          return { data: { ...doc, id: doc.$id }, error: null };
        }

        console.warn(`[dados] operação "${fnName}" não existe no Appwrite.`);
        return { data: null, error: { message: `Operação indisponível: ${fnName}` } };
      } catch (err: any) {
        console.error(`[RPC ${fnName} error]:`, err);
        return { data: null, error: { message: err.message || `Erro ao executar ${fnName}` } };
      }
    };

    const promise = execute();
    return {
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      single: () => promise,
      maybeSingle: () => promise,
    };
  },
};
}

// Cliente do navegador, autenticado pela sessão do usuário no Appwrite.
export const appwriteDb = createAppwriteBridge({ databases, storage });
