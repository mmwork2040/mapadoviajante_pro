import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getFinanceAccess, type FinanceAccess } from "@/lib/finance.functions";

const NO_ACCESS: FinanceAccess = { canView: false, canEdit: false };

/** O que o usuário logado pode fazer no financeiro (decidido pelo servidor). */
export function useFinanceAccess() {
  const { session, member } = useAuth();
  const q = useQuery({
    queryKey: ["finance-access", member?.id ?? null],
    queryFn: () => getFinanceAccess(),
    enabled: !!session && !!member,
    staleTime: 60_000,
  });
  return { ...(q.data ?? NO_ACCESS), isLoading: q.isLoading };
}
