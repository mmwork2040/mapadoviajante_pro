import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

// Leva o token do Google do usuário até as funções do Drive.
// No navegador: lê o token da sessão (login do Google) e manda no cabeçalho.
// No servidor: entrega o token em `context.googleToken` (null = não conectado).
export const googleDriveAuth = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    let token: string | null = null;
    if (typeof window !== "undefined") {
      const { getGoogleDriveToken } = await import("@/lib/google-drive-auth");
      token = await getGoogleDriveToken();
    }
    return next({ headers: token ? { "X-Google-Token": token } : {} });
  })
  .server(async ({ next }) => {
    const raw = (getRequest()?.headers.get("x-google-token") || "").trim();
    const googleToken = /^[\w.~+/=-]{20,4096}$/.test(raw) ? raw : null;
    return next({ context: { googleToken } });
  });
