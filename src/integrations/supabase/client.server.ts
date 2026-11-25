// Cliente de dados do servidor (chave de API do Appwrite). Só para código de servidor.
import { getServerBridge } from '@/integrations/appwrite/server';

export const supabaseAdmin = getServerBridge() as any;
