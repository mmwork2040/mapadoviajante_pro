import { useState } from "react";
import { Star } from "lucide-react";

interface StarRatingSelectProps {
  /** Valor atual como string ("" = qualquer, "1".."5"). */
  value: string;
  onChange: (value: string) => void;
  max?: number;
}

/**
 * Seleção de estrelas por clique. Clicar na mesma estrela já selecionada limpa
 * a seleção (volta para "Qualquer"). Passar o mouse mostra o preview.
 */
export function StarRatingSelect({ value, onChange, max = 5 }: StarRatingSelectProps) {
  const [hover, setHover] = useState(0);
  const current = Number(value) || 0;
  const active = hover || current;

  return (
    <div className="mt-1 flex items-center gap-1.5">
      <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: max }, (_, i) => i + 1).map((s) => (
          <button
            key={s}
            type="button"
            aria-label={`${s} estrela(s) ou mais`}
            onMouseEnter={() => setHover(s)}
            onClick={() => onChange(current === s ? "" : String(s))}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              className={
                s <= active
                  ? "h-5 w-5 fill-amber-400 text-amber-400"
                  : "h-5 w-5 text-muted-foreground/40"
              }
            />
          </button>
        ))}
      </div>
      <span className="text-[11px] text-muted-foreground">
        {current ? `${current} ou mais` : "Qualquer"}
      </span>
    </div>
  );
}
