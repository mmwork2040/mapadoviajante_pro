import { createMiddleware } from '@tanstack/react-start'

// Registrado como `functionMiddleware` global em `src/start.ts`: toda chamada
// de server function feita pelo navegador leva o JWT do usuário no Appwrite.
// O servidor confere esse token em auth-middleware.ts.

// O JWT do Appwrite vale 15 minutos; renovamos com folga para não gastar o
// limite de criação de tokens a cada chamada.
const JWT_REUSE_MS = 10 * 60 * 1000
let cached: { jwt: string; userId: string; at: number } | null = null
let pending: Promise<string | null> | null = null

async function getAppwriteJwt(): Promise<string | null> {
  const { account } = await import('@/integrations/appwrite/client')
  let userId: string
  try {
    userId = (await account.get()).$id
  } catch {
    cached = null
    return null // sem sessão
  }
  if (cached && cached.userId === userId && Date.now() - cached.at < JWT_REUSE_MS) {
    return cached.jwt
  }
  if (!pending) {
    pending = account
      .createJWT()
      .then(({ jwt }) => {
        cached = { jwt, userId, at: Date.now() }
        return jwt
      })
      .catch((err) => {
        console.warn('[auth] não foi possível gerar o token de sessão:', err)
        return null
      })
      .finally(() => {
        pending = null
      })
  }
  return pending
}

export const attachAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const token = typeof window === 'undefined' ? null : await getAppwriteJwt()
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
)
