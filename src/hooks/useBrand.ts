import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getMyBrand } from "@/lib/brand.functions";
import { applyBrandColor, cacheBrand, readCachedBrand, type Brand } from "@/lib/brand";

/**
 * Marca da agência do usuário logado. Aplica a cor principal na tela e guarda
 * uma cópia local para o próximo carregamento não piscar a cor do produto.
 */
export function useBrand(): Brand | null {
  const { member } = useAuth();
  const agencyId = member?.agency_id ?? null;
  const q = useQuery({
    queryKey: ["brand", agencyId],
    queryFn: () => getMyBrand(),
    enabled: Boolean(agencyId),
    staleTime: 5 * 60 * 1000,
    retry: false,
    placeholderData: () => (typeof window === "undefined" ? undefined : readCachedBrand(agencyId) ?? undefined),
  });
  // Se a leitura falhar (sem rede, servidor fora), continua com a última marca conhecida.
  const brand = q.data ?? (q.isError && typeof window !== "undefined" ? readCachedBrand(agencyId) : null);

  useEffect(() => {
    if (!agencyId || q.isPlaceholderData) return;
    if (q.isSuccess) {
      cacheBrand(brand);
      applyBrandColor(brand?.primary);
    }
  }, [agencyId, brand, q.isSuccess, q.isPlaceholderData]);

  return brand;
}
