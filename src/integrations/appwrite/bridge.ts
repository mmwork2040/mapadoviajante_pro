import { databases, storage, account, APPWRITE_DATABASE_ID, APPWRITE_BUCKET_ID, Query, ID } from './client';
import { appwriteAuthService } from '@/services/appwriteAuthService';

// Normaliza o documento do Appwrite para ser 100% compatível com a interface do Supabase
function normalizeDoc(doc: any): any {
  if (!doc || typeof doc !== 'object') return doc;
  const normalized = { ...doc };
  normalized.id = doc.id || doc.$id;
  normalized.created_at = doc.created_at || doc.$createdAt;
  normalized.updated_at = doc.updated_at || doc.$updatedAt;

  // Tratar campos JSON que foram serializados como string
  const jsonFields = ['settings', 'preferences', 'profile', 'benefits', 'checklists', 'knowledge_sources', 'value'];
  for (const field of jsonFields) {
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

// Prepara o payload para escrita no Appwrite, serializando objetos e removendo metadados $
function preparePayload(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const payload: Record<string, any> = {};

  for (const [k, v] of Object.entries(data)) {
    // Ignorar campos de sistema
    if (k.startsWith('$')) continue;
    if (k === 'id') continue; // ID do documento é passado como documentId no Appwrite

    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      payload[k] = JSON.stringify(v);
    } else {
      payload[k] = v;
    }
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

class AppwriteQueryBuilder {
  private collectionId: string;
  private queries: string[] = [];
  private isSingle = false;
  private isMaybeSingle = false;
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private writePayload: any = null;

  constructor(collectionId: string) {
    this.collectionId = collectionId;
  }

  select(_columns?: string, _options?: { count?: string; head?: boolean }) {
    this.action = 'select';
    return this;
  }

  insert(values: any | any[]) {
    this.action = 'insert';
    this.writePayload = values;
    return this;
  }

  upsert(values: any | any[], _opts?: any) {
    this.action = 'insert';
    this.writePayload = values;
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
    const cleanPattern = pattern.replace(/%/g, '');
    this.queries.push(Query.search(column, cleanPattern));
    return this;
  }

  ilike(column: string, pattern: string) {
    return this.like(column, pattern);
  }

  order(column: string, options?: { ascending?: boolean }) {
    const ascending = options?.ascending ?? true;
    const col = column === 'id' ? '$createdAt' : column;
    if (ascending) {
      this.queries.push(Query.orderAsc(col));
    } else {
      this.queries.push(Query.orderDesc(col));
    }
    return this;
  }

  limit(count: number) {
    this.queries.push(Query.limit(count));
    return this;
  }

  range(from: number, to: number) {
    this.queries.push(Query.offset(from));
    this.queries.push(Query.limit(to - from + 1));
    return this;
  }

  single() {
    this.isSingle = true;
    this.queries.push(Query.limit(1));
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    this.queries.push(Query.limit(1));
    return this;
  }

  async execute(): Promise<{ data: any; error: any; count?: number }> {
    try {
      if (this.action === 'select') {
        const res = await databases.listDocuments(APPWRITE_DATABASE_ID, this.collectionId, this.queries);
        const docs = res.documents.map(normalizeDoc);

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

      if (this.action === 'insert') {
        const items = Array.isArray(this.writePayload) ? this.writePayload : [this.writePayload];
        const results = [];

        for (const item of items) {
          const docId = getValidDocId(item.id);
          const payload = preparePayload(item);
          const doc = await databases.createDocument(APPWRITE_DATABASE_ID, this.collectionId, docId, payload);
          results.push(normalizeDoc(doc));
        }

        const data = Array.isArray(this.writePayload) ? results : results[0];
        return { data, error: null };
      }

      if (this.action === 'update') {
        // Encontra o documento pelo query ou ID
        const list = await databases.listDocuments(APPWRITE_DATABASE_ID, this.collectionId, this.queries);
        if (list.documents.length === 0) {
          return { data: null, error: null };
        }

        const payload = preparePayload(this.writePayload);
        const updatedDocs = [];
        for (const target of list.documents) {
          const updated = await databases.updateDocument(APPWRITE_DATABASE_ID, this.collectionId, target.$id, payload);
          updatedDocs.push(normalizeDoc(updated));
        }

        return { data: updatedDocs.length === 1 ? updatedDocs[0] : updatedDocs, error: null };
      }

      if (this.action === 'delete') {
        const list = await databases.listDocuments(APPWRITE_DATABASE_ID, this.collectionId, this.queries);
        for (const target of list.documents) {
          await databases.deleteDocument(APPWRITE_DATABASE_ID, this.collectionId, target.$id);
        }
        return { data: null, error: null };
      }

      return { data: null, error: null };
    } catch (err: any) {
      console.error(`[Appwrite Bridge Error on ${this.collectionId}]:`, err);
      return { data: null, error: { message: err.message || 'Erro na operação do banco', ...err } };
    }
  }

  // Permite uso com await direto: const { data } = await supabase.from('...').select()
  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// ── Bridge Auth ───────────────────────────────────────────────────
class AppwriteAuthBridge {
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
    await appwriteAuthService.logout();
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
    // Dispara estado inicial
    this.getSession().then(({ data }) => {
      callback('INITIAL_SESSION', data.session);
    });

    return {
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    };
  }
}

// ── Bridge Storage ────────────────────────────────────────────────
class AppwriteStorageBridge {
  from(bucketId: string = APPWRITE_BUCKET_ID) {
    return {
      async upload(path: string, file: File) {
        try {
          const fileId = getValidDocId(path.replace(/[^a-zA-Z0-9]/g, '-'));
          const created = await storage.createFile(bucketId, fileId, file);
          return { data: { path: created.$id }, error: null };
        } catch (err: any) {
          return { data: null, error: err };
        }
      },
      getPublicUrl(fileId: string) {
        try {
          const url = storage.getFileView(bucketId, fileId);
          return { data: { publicUrl: url.toString() } };
        } catch {
          return { data: { publicUrl: '' } };
        }
      },
      async createSignedUrl(path: string, _expiresIn: number = 3600) {
        try {
          const url = storage.getFileView(bucketId, path);
          return { data: { signedUrl: url.toString() }, error: null };
        } catch (err: any) {
          return { data: null, error: err };
        }
      },
      async remove(paths: string[]) {
        try {
          for (const path of paths) {
            try {
              await storage.deleteFile(bucketId, path);
            } catch {}
          }
          return { data: paths, error: null };
        } catch (err: any) {
          return { data: null, error: err };
        }
      },
    };
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

// Cliente exportado compatível com Supabase
export const appwriteSupabaseClient = {
  from(collectionName: string) {
    return new AppwriteQueryBuilder(collectionName);
  },
  auth: new AppwriteAuthBridge(),
  storage: new AppwriteStorageBridge(),
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
          const userId = currentUser?.id || ID.unique();
          const userEmail = args._email || currentUser?.email || '';
          const userName = args._user_name || currentUser?.name || 'Administrador';

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
          const member = await databases.createDocument(
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
          const res = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            'agency_members',
            [Query.equal('user_id', currentUser.id), Query.limit(1)]
          );
          if (res.documents.length === 0) return { data: null, error: null };
          return { data: res.documents[0].agency_id, error: null };
        }

        if (fnName === 'has_role') {
          return { data: true, error: null };
        }

        if (fnName === 'get_shared_itinerary') {
          const doc = await databases.getDocument(
            APPWRITE_DATABASE_ID,
            'crm_itineraries',
            args._id
          );
          return { data: { ...doc, id: doc.$id }, error: null };
        }

        return { data: null, error: null };
      } catch (err: any) {
        console.error(`[RPC ${fnName} error]:`, err);
        return { data: null, error: { message: err.message || `Erro ao executar ${fnName}` } };
      }
    };

    const promise = execute();
    return {
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      single: async () => execute(),
      maybeSingle: async () => execute(),
    };
  },
};
