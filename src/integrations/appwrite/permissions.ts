// Permissões por agência. Cada agência é um time do Appwrite com o mesmo id da
// agência; todo registro dela pode ser lido, alterado e apagado só pelo time.
import { Permission, Role } from 'appwrite';

const TEAM_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;

export function agencyPermissions(agencyId: string | null | undefined): string[] | undefined {
  if (!agencyId || !TEAM_ID.test(agencyId)) return undefined;
  const team = Role.team(agencyId);
  return [Permission.read(team), Permission.update(team), Permission.delete(team)];
}

/**
 * Coleções que só o servidor lê e grava (com a chave de API): configurações com
 * segredos, financeiro e pagamentos. Os documentos não dão acesso a ninguém.
 */
export const SERVER_ONLY = new Set(['system_settings', 'crm_transactions', 'agency_payment_settings']);

// Agência ativa no navegador. O servidor não usa: lá a agência vem do escopo
// ou do próprio registro.
let currentAgencyId: string | null = null;
export function setCurrentAgency(id: string | null) {
  currentAgencyId = id;
}
export function getCurrentAgency() {
  return typeof window === 'undefined' ? null : currentAgencyId;
}
