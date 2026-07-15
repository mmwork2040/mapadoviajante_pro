import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function SearchBar({ value, onChange, className = "", placeholder = "Buscar…", ...rest }: Props) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 focus-within:border-primary ${className}`}
    >
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none"
      />
    </div>
  );
}
