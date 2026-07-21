import { createFileRoute, Outlet } from "@tanstack/react-router";

export interface ClientMember {
  id: string;
  name: string;
  relationship: string;
  client_id?: string | null;
}

export function extractMembers(prefs: unknown): ClientMember[] {
  if (!prefs || typeof prefs !== "object") return [];
  const raw = (prefs as Record<string, unknown>).members;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => {
      if (!m || typeof m !== "object") return null;
      const o = m as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim() : "";
      if (!name) return null;
      return {
        id:
          typeof o.id === "string" && o.id
            ? o.id
            : (globalThis.crypto?.randomUUID?.() ?? String(Math.random())),
        name,
        relationship: typeof o.relationship === "string" ? o.relationship : "",
        client_id: typeof o.client_id === "string" ? o.client_id : null,
      } as ClientMember;
    })
    .filter((m): m is ClientMember => !!m);
}

export const Route = createFileRoute("/_app/clientes")({
  component: () => <Outlet />,
});