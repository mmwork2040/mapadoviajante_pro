#!/usr/bin/env node
// Cria no Appwrite o que o app usa e ainda não existe, e amplia limites de texto
// pequenos demais. Só ACRESCENTA: não apaga nem altera nenhum registro.
//
// Uso (Node 18 ou mais novo):
//   APPWRITE_ADMIN_KEY=<chave> node scripts/appwrite/estrutura-que-falta.mjs           -> só mostra o que faria
//   APPWRITE_ADMIN_KEY=<chave> node scripts/appwrite/estrutura-que-falta.mjs --aplicar -> aplica
//
// A chave precisa dos escopos: collections.read, collections.write,
// attributes.read, attributes.write. Crie uma chave temporária e apague depois.
//
// Depois de aplicar, rode `node scripts/appwrite/gerar-schema.mjs` para o app
// conhecer os campos novos.
import { api, DATABASE, exigirChave, listarColecoes } from "./comum.mjs";

exigirChave();
const APLICAR = process.argv.includes("--aplicar");
const USUARIOS = ['create("users")', 'read("users")', 'update("users")', 'delete("users")'];

// 1) Coleções que faltam.
const COLECOES = [
  {
    id: "crm_lead_documents",
    name: "Documentos da Viagem",
    motivo: "anexos dos itens do roteiro, documentos da viagem e do cliente, aba Documentos da Biblioteca",
    atributos: [
      { key: "agency_id", size: 100, required: true },
      { key: "lead_id", size: 100 },
      { key: "itinerary_id", size: 100 },
      { key: "activity_id", size: 100 },
      { key: "name", size: 255, required: true },
      { key: "category", size: 100 },
      { key: "file_path", size: 1000 },
      { key: "mime_type", size: 255 },
      { key: "size", type: "integer" },
      { key: "content", size: 1000000 },
      { key: "created_at", size: 50 },
    ],
  },
];

// 2) Campos de texto que precisam de mais espaço.
const AMPLIAR = [
  { colecao: "system_settings", key: "value", size: 1000000, motivo: "modelos de checklist e configurações passam de 10 mil caracteres" },
  { colecao: "crm_ai_config", key: "knowledge_sources", size: 1000000, motivo: "materiais de referência da IA não cabem em 3 mil caracteres" },
  { colecao: "crm_ai_config", key: "system_prompt", size: 20000, motivo: "a tela aceita orientações de até 20 mil caracteres" },
  { colecao: "crm_library_items", key: "content", size: 100000, motivo: "conteúdo da Biblioteca limitado a 1.500 caracteres" },
  { colecao: "crm_leads", key: "checklists", size: 100000, motivo: "checklist grande não cabe em 8 mil caracteres" },
  { colecao: "crm_leads", key: "notes", size: 20000, motivo: "anotações limitadas a 4 mil caracteres" },
];

async function esperarAtributos(colecao, chaves) {
  for (let i = 0; i < 60; i++) {
    const c = await api("GET", `/databases/${DATABASE}/collections/${colecao}`);
    const prontos = (c.attributes || []).filter((a) => chaves.includes(a.key) && a.status === "available");
    if (prontos.length === chaves.length) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  console.log(APLICAR ? "MODO: aplicar\n" : "MODO: só mostrar (use --aplicar para criar)\n");
  const existentes = new Map((await listarColecoes()).map((c) => [c.$id, c]));
  let pendentes = 0;
  let falhas = 0;

  for (const col of COLECOES) {
    const atual = existentes.get(col.id);
    const tem = new Set((atual?.attributes || []).map((a) => a.key));
    const faltam = col.atributos.filter((a) => !tem.has(a.key));
    if (atual && faltam.length === 0) {
      console.log(`- coleção ${col.id}: já existe, nada a fazer`);
      continue;
    }
    pendentes++;
    console.log(`- coleção ${col.id}: ${atual ? "existe, faltam campos" : "NÃO EXISTE"}`);
    console.log(`    para quê: ${col.motivo}`);
    console.log(`    ${atual ? "campos a criar" : "criar com os campos"}: ${faltam.map((a) => a.key).join(", ")}`);
    if (!atual) console.log(`    permissões: só usuários logados (igual às outras coleções)`);
    if (!APLICAR) continue;
    try {
      if (!atual) {
        await api("POST", `/databases/${DATABASE}/collections`, {
          collectionId: col.id,
          name: col.name,
          permissions: USUARIOS,
          documentSecurity: false,
          enabled: true,
        });
      }
      for (const a of faltam) {
        if (a.type === "integer") {
          await api("POST", `/databases/${DATABASE}/collections/${col.id}/attributes/integer`, {
            key: a.key,
            required: !!a.required,
          });
        } else {
          await api("POST", `/databases/${DATABASE}/collections/${col.id}/attributes/string`, {
            key: a.key,
            size: a.size,
            required: !!a.required,
          });
        }
      }
      const ok = await esperarAtributos(col.id, col.atributos.map((a) => a.key));
      console.log(ok ? "    -> CRIADA" : "    -> criada; alguns campos ainda estão sendo preparados pelo Appwrite");
    } catch (err) {
      falhas++;
      console.log(`    -> ERRO: ${err.message}`);
    }
  }

  console.log("");
  for (const item of AMPLIAR) {
    const atual = existentes.get(item.colecao)?.attributes?.find((a) => a.key === item.key);
    if (!atual) {
      console.log(`- ${item.colecao}.${item.key}: campo não encontrado, pulei`);
      continue;
    }
    if ((atual.size || 0) >= item.size) {
      console.log(`- ${item.colecao}.${item.key}: já tem ${atual.size} caracteres, nada a fazer`);
      continue;
    }
    pendentes++;
    console.log(`- ${item.colecao}.${item.key}: ${atual.size} -> ${item.size} caracteres (${item.motivo})`);
    if (!APLICAR) continue;
    try {
      await api("PATCH", `/databases/${DATABASE}/collections/${item.colecao}/attributes/string/${item.key}`, {
        required: !!atual.required,
        default: atual.default ?? null,
        size: item.size,
      });
      console.log("    -> AMPLIADO");
    } catch (err) {
      falhas++;
      console.log(`    -> ERRO: ${err.message}`);
    }
  }

  console.log("");
  if (!APLICAR) console.log(`${pendentes} mudança(s) a fazer. Nada foi alterado. Rode de novo com --aplicar.`);
  else console.log(`Concluído: ${pendentes - falhas} feita(s), ${falhas} erro(s). Agora rode: node scripts/appwrite/gerar-schema.mjs`);
  if (falhas) process.exit(1);
}

main().catch((err) => {
  console.error("Falhou:", err.message);
  process.exit(1);
});
