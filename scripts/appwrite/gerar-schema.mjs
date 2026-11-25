#!/usr/bin/env node
// Lê os campos reais de cada coleção do Appwrite e reescreve
// src/integrations/appwrite/schema.ts. Só lê o Appwrite; não altera nada lá.
//
// Uso: APPWRITE_ADMIN_KEY=<chave de leitura> node scripts/appwrite/gerar-schema.mjs
// Escopos: collections.read, attributes.read.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exigirChave, listarColecoes } from "./comum.mjs";

exigirChave();
const TIPO = { string: "s", text: "s", double: "n", integer: "i", boolean: "b", datetime: "s", email: "s", url: "s", enum: "s", ip: "s" };

const colecoes = (await listarColecoes()).sort((a, b) => a.$id.localeCompare(b.$id));
const hoje = new Date().toLocaleDateString("pt-BR");
const linhas = [
  `// Campos reais de cada coleção do Appwrite (gerado em ${hoje} por scripts/appwrite/gerar-schema.mjs).`,
  "// A camada de dados usa este mapa para gravar só o que a coleção aceita e no",
  "// tipo certo. Ao criar ou mudar um campo no Appwrite, gere este arquivo de novo.",
  "//",
  '// Tipos: "s" texto, "n" número, "i" inteiro, "b" verdadeiro/falso. `size` é o',
  "// limite de caracteres; `array` marca listas.",
  'export type FieldSpec = { type: "s" | "n" | "i" | "b"; size?: number; array?: boolean; required?: boolean };',
  "",
  "export const COLLECTION_FIELDS: Record<string, Record<string, FieldSpec>> = {",
];
for (const c of colecoes) {
  linhas.push(`  ${c.$id}: {`);
  for (const a of c.attributes || []) {
    if (a.status && a.status !== "available") continue;
    const t = TIPO[a.type] || "s";
    const partes = [`type: "${t}"`];
    if (a.size && t === "s" && a.type !== "text") partes.push(`size: ${a.size}`);
    if (a.array) partes.push("array: true");
    if (a.required) partes.push("required: true");
    linhas.push(`    ${a.key}: { ${partes.join(", ")} },`);
  }
  linhas.push("  },");
}
linhas.push("};", "");

const destino = fileURLToPath(new URL("../../src/integrations/appwrite/schema.ts", import.meta.url));
writeFileSync(destino, linhas.join("\n"));
console.log(`${colecoes.length} coleções gravadas em src/integrations/appwrite/schema.ts`);
