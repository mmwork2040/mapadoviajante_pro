import { useCallback, useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem("mv-theme")) as
      | "light"
      | "dark"
      | null;
    const initial = stored || "light";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem("mv-theme", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}

export function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0),
  );
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function initials(name: string | null | undefined): string {
  if (!name) return "??";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}
