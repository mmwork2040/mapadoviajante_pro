import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createAgencyScopedBridge, verifyAppwriteJwt } from '@/integrations/appwrite/server';
import { findMembership } from '@/lib/server/authz';

/**
 * Exige um usuário logado em toda server function que usa este middleware.
 * O navegador envia `Authorization: Bearer <JWT do Appwrite>` (auth-attacher.ts);
 * aqui o token é conferido no Appwrite e o contexto recebe o usuário real.
 *
 * Atenção: estar logado não basta para ações de admin ou de outra agência.
 * Use `getMembership` / `requireAdmin` de `@/lib/server/authz` para isso.
 * O `context.supabase` já vem limitado à agência do usuário.
 */
export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const authHeader = getRequest()?.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token || token.split('.').length !== 3) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const user = await verifyAppwriteJwt(token);
    if (!user) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    // Agência ativa do usuário (null se não tiver). O cliente de dados entregue
    // às funções só enxerga e grava registros dessa agência.
    const membership = await findMembership({ userId: user.id, userEmail: user.email });

    return next({
      context: {
        supabase: createAgencyScopedBridge(membership?.agencyId ?? null) as any,
        userId: user.id,
        userEmail: user.email,
        membership,
        claims: { sub: user.id, email: user.email },
      },
    });
  },
);
