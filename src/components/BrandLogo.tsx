import { PRODUCT, type Brand } from "@/lib/brand";

type Props = {
  /** Marca da agência. Sem ela (ou sem logo), aparece a marca do produto. */
  brand?: Brand | null;
  /** Altura da logo, em classes do Tailwind. */
  heightClass?: string;
  /** Só o símbolo, sem o nome (menu recolhido). */
  compact?: boolean;
  /** Tamanho do nome do produto. */
  nameClass?: string;
};

/**
 * Logo do sistema (white-label): a da agência quando ela configurou uma;
 * senão, o símbolo e o nome do produto.
 */
export function BrandLogo({ brand, heightClass = "h-9", compact = false, nameClass = "text-[15px]" }: Props) {
  if (brand?.logoUrl) {
    const fit = `${heightClass} w-auto object-contain ${compact ? "max-w-10" : "max-w-[168px]"}`;
    return (
      <>
        <img src={brand.logoUrl} alt={brand.name} className={`block dark:hidden ${fit}`} />
        <img src={brand.logoDarkUrl || brand.logoUrl} alt={brand.name} className={`hidden dark:block ${fit}`} />
      </>
    );
  }
  return (
    <>
      <img src={PRODUCT.mark} alt={compact ? PRODUCT.name : ""} className={`${heightClass} aspect-square w-auto shrink-0 rounded-lg`} />
      {!compact && (
        <span className={`font-display font-bold leading-[1.1] tracking-tight ${nameClass}`}>
          Mapa do Viajante <span className="text-primary">PRO</span>
        </span>
      )}
    </>
  );
}
