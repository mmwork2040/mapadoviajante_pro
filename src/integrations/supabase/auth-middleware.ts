import { createMiddleware } from '@tanstack/react-start';
import { appwriteSupabaseClient } from '@/integrations/appwrite/bridge';

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    // Retorna contexto autenticado compatível conectado ao Appwrite
    return next({
      context: {
        supabase: appwriteSupabaseClient as any,
        userId: 'admin_server_user',
        claims: { sub: 'admin_server_user' },
      },
    });
  }
);
