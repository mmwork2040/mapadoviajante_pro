import { PRODUCT, type Brand } from "@/lib/brand";

type Props = {
  /** Marca da agência. Sem ela (ou sem logo), aparece a marca do produto. */
  brand?: Brand | null;
  /** Altura do símbolo, em classes do Tailwind. */
  heightClass?: string;
  /** Só o símbolo, sem o nome (menu recolhido). */
  compact?: boolean;
  /** Tamanho do nome do produto. */
  nameClass?: string;
};

/**
 * Logo do sistema (white-label): a da agência quando ela configurou uma;
 * senão, a do produto: o símbolo (mapa dobrado com bússola, na versão do
 * fundo claro ou do escuro) e o nome "MapaPRO" em degradê na cor principal.
 */
export function BrandLogo({
  brand,
  heightClass = "h-9",
  compact = false,
  nameClass = "text-[22px]",
}: Props) {
  if (brand?.logoUrl) {
    const fit = `${heightClass} w-auto object-contain ${compact ? "max-w-10" : "max-w-[168px]"}`;
    return (
      <>
        <img src={brand.logoUrl} alt={brand.name} className={`block dark:hidden ${fit}`} />
        <img
          src={brand.logoDarkUrl || brand.logoUrl}
          alt={brand.name}
          className={`hidden dark:block ${fit}`}
        />
      </>
    );
  }
  const simbolo = `${heightClass} w-auto shrink-0`;
  return (
    <>
      <img
        src={PRODUCT.mark.onLight}
        alt={compact ? PRODUCT.name : ""}
        className={`block dark:hidden ${simbolo}`}
      />
      <img
        src={PRODUCT.mark.onDark}
        alt={compact ? PRODUCT.name : ""}
        className={`hidden dark:block ${simbolo}`}
      />
      {!compact && (
        <span className={`mapapro-wordmark ${nameClass}`} aria-label={PRODUCT.name}>
          {PRODUCT.shortName}
        </span>
      )}
    </>
  );
}
