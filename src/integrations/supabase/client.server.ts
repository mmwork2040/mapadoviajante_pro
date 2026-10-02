// Server-side Appwrite/Supabase client bridge
import { appwriteSupabaseClient } from '@/integrations/appwrite/bridge';

export const supabaseAdmin = appwriteSupabaseClient as any;
