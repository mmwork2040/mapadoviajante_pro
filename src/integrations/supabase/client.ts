// Redirecionado 100% para o Banco de Dados e Auth do Appwrite (VPS)
import { appwriteSupabaseClient } from '@/integrations/appwrite/bridge';

export const supabase = appwriteSupabaseClient as any;
