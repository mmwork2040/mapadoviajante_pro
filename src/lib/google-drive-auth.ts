// Acesso ao Google Drive pelo login do Google do próprio usuário.
//
// O login é o OAuth do Appwrite. Quando a pessoa autoriza o Drive, o Appwrite
// guarda o token do Google na sessão dela; aqui só lemos esse token para
// mandar junto das chamadas do Drive. Cada pessoa enxerga os arquivos da
// própria conta (inclusive as pastas compartilhadas com ela).
import { account } from "@/integrations/appwrite/client";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

/** Token do Google da sessão atual, renovado se estiver vencendo. `null` = não conectado. */
export async function getGoogleDriveToken(): Promise<string | null> {
  try {
    let session = await account.getSession("current");
    if (session.provider !== "google" || !session.providerAccessToken) return null;
    const expiry = Date.parse(session.providerAccessTokenExpiry || "");
    if (Number.isFinite(expiry) && expiry - Date.now() < 60_000) {
      session = await account.updateSession("current");
    }
    return session.providerAccessToken || null;
  } catch {
    return null;
  }
}

/**
 * Leva a pessoa ao Google para entrar e autorizar a leitura do Drive, e volta
 * para a tela em que ela estava.
 */
export function connectGoogleDrive(): void {
  const back = window.location.href;
  account.createOAuth2Session("google" as never, back, back, [DRIVE_SCOPE]);
}
