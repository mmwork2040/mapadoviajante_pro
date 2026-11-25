// Acesso ao Appwrite pelo servidor. Nunca importe este arquivo em código que
// roda no navegador: ele lê a chave de API do ambiente do servidor.
import { Client, Databases, Storage } from 'appwrite';
import { createAppwriteBridge } from './bridge';

type ServerBridge = ReturnType<typeof createAppwriteBridge>;

export type AppwriteUserIdentity = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export function appwriteServerConfig() {
  const env = process.env;
  return {
    endpoint: (env.APPWRITE_ENDPOINT || env.VITE_APPWRITE_ENDPOINT || 'https://appwrite.agenc-ia.net/v1')
      .trim()
      .replace(/\/$/, ''),
    project: (env.APPWRITE_PROJECT_ID || env.VITE_APPWRITE_PROJECT_ID || '6abdb8190017d98565f5').trim(),
    key: (env.APPWRITE_API_KEY || '').trim(),
  };
}

let cachedBridge: ServerBridge | null = null;
let warnedMissingKey = false;

/**
 * Cliente de dados do servidor. Com `APPWRITE_API_KEY` configurada, age com a
 * chave de API (as funções do servidor precisam conferir agência e papel antes
 * de ler ou gravar). Sem a chave, cai no acesso anônimo, que era o
 * comportamento anterior, e avisa no log.
 */
export function getServerBridge(): ServerBridge {
  if (cachedBridge) return cachedBridge;
  const cfg = appwriteServerConfig();
  const client = new Client().setEndpoint(cfg.endpoint).setProject(cfg.project);
  if (cfg.key) {
    client.headers['X-Appwrite-Key'] = cfg.key;
    client.headers['x-sdk-platform'] = 'server';
  } else if (!warnedMissingKey) {
    warnedMissingKey = true;
    console.warn('[appwrite] APPWRITE_API_KEY não configurada: o servidor está acessando o banco sem chave.');
  }
  cachedBridge = createAppwriteBridge({ databases: new Databases(client), storage: new Storage(client) });
  return cachedBridge;
}

/**
 * Confere um JWT emitido pelo Appwrite para o usuário logado (account.createJWT)
 * e devolve quem ele é. Devolve null se o token for inválido, vencido ou se a
 * conta estiver bloqueada.
 */
export async function verifyAppwriteJwt(jwt: string): Promise<AppwriteUserIdentity | null> {
  const cfg = appwriteServerConfig();
  let res: Response;
  try {
    res = await fetch(`${cfg.endpoint}/account`, {
      headers: {
        'X-Appwrite-Project': cfg.project,
        'X-Appwrite-JWT': jwt,
      },
    });
  } catch (err) {
    console.error('[appwrite] falha ao validar sessão:', err);
    throw new Error('Não foi possível validar sua sessão. Tente novamente.');
  }
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) {
    console.error('[appwrite] resposta inesperada ao validar sessão:', res.status);
    throw new Error('Não foi possível validar sua sessão. Tente novamente.');
  }
  const user = (await res.json()) as {
    $id?: string;
    email?: string;
    name?: string;
    emailVerification?: boolean;
    status?: boolean;
  };
  if (!user.$id || user.status === false) return null;
  return {
    id: user.$id,
    email: (user.email || '').trim().toLowerCase(),
    name: user.name || '',
    emailVerified: !!user.emailVerification,
  };
}

/**
 * Coleções que pertencem a uma agência (têm `agency_id`). No servidor, toda
 * operação nelas passa a valer só para a agência do usuário.
 */
export const AGENCY_SCOPED_COLLECTIONS = new Set([
  'agency_members',
  'agency_payment_settings',
  'crm_ai_config',
  'crm_clients',
  'crm_itineraries',
  'crm_lead_activities',
  'crm_lead_documents',
  'crm_leads',
  'crm_library_destinations',
  'crm_library_items',
  'crm_notifications',
  'crm_tasks',
  'crm_transactions',
  'crm_trip_expenses',
]);

/**
 * Cliente do servidor limitado a uma agência.
 * Coleções sem `agency_id` (ex.: dias e atividades de roteiro) não são
 * filtradas aqui; quem as usa precisa conferir o roteiro dono antes.
 */
export function createAgencyScopedBridge(agencyId: string | null): ServerBridge {
  const base = getServerBridge();
  return {
    ...base,
    from(collectionName: string) {
      const qb = base.from(collectionName);
      if (!AGENCY_SCOPED_COLLECTIONS.has(collectionName)) return qb;
      if (!agencyId) throw new Error('Sem agência ativa.');
      return qb.withAgencyScope(agencyId);
    },
    rpc() {
      throw new Error('Operação indisponível no servidor.');
    },
  } as ServerBridge;
}
