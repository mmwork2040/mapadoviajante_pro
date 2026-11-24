#!/usr/bin/env node
// Fecha o banco do Appwrite para acesso anônimo.
//
// Para cada coleção do banco e para o bucket de arquivos:
//   - permissões passam a ser só de usuários logados ("users")
//   - desliga a segurança por documento/arquivo (os registros antigos guardam
//     permissão "any" dentro deles e continuariam abertos com ela ligada)
//
// Uso (Node 18 ou mais novo):
//   APPWRITE_ADMIN_KEY=<chave> node scripts/fechar-banco-appwrite.mjs          -> só mostra o que vai mudar
//   APPWRITE_ADMIN_KEY=<chave> node scripts/fechar-banco-appwrite.mjs --aplicar -> aplica
//
// A chave precisa dos escopos: collections.read, collections.write,
// buckets.read, buckets.write. Crie uma chave temporária e apague depois.

const ENDPOINT = (process.env.APPWRITE_ENDPOINT || "https://appwrite.agenc-ia.net/v1").replace(/\/$/, "");
const PROJECT = process.env.APPWRITE_PROJECT_ID || "6abdb8190017d98565f5";
const DATABASE = process.env.APPWRITE_DATABASE_ID || "6abdb82f002c563b2ad3";
const BUCKETS = (process.env.APPWRITE_BUCKETS || "trip-attachments").split(",").map((b) => b.trim()).filter(Boolean);
const KEY = process.env.APPWRITE_ADMIN_KEY;
const APPLY = process.argv.includes("--aplicar");

const LOGGED_IN = ['create("users")', 'read("users")', 'update("users")', 'delete("users")'];

if (!KEY) {
  console.error("Defina APPWRITE_ADMIN_KEY com uma chave de API do Appwrite.");
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${ENDPOINT}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": PROJECT,
      "X-Appwrite-Key": KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${json.message || text}`);
  }
  return json;
}

function isOpen(perms) {
  return (perms || []).some((p) => p.includes('"any"') || p.includes('"guests"'));
}

function describe(perms) {
  return (perms || []).length ? perms.join(", ") : "(nenhuma)";
}

async function listCollections() {
  const all = [];
  let offset = 0;
  for (;;) {
    const q = encodeURIComponent(JSON.stringify({ method: "limit", values: [100] }));
    const o = encodeURIComponent(JSON.stringify({ method: "offset", values: [offset] }));
    const page = await api("GET", `/databases/${DATABASE}/collections?queries[]=${q}&queries[]=${o}`);
    const items = page.collections || [];
    all.push(...items);
    if (items.length < 100) break;
    offset += 100;
  }
  return all;
}

async function main() {
  console.log(APPLY ? "MODO: aplicar mudanças\n" : "MODO: só mostrar (use --aplicar para mudar)\n");
  let changes = 0;
  let failures = 0;

  const collections = await listCollections();
  console.log(`Coleções encontradas: ${collections.length}\n`);
  for (const c of collections) {
    const open = isOpen(c.$permissions);
    const needs = open || c.documentSecurity || describe(c.$permissions) !== describe(LOGGED_IN);
    console.log(`- ${c.$id}${open ? "  [ABERTA PARA QUALQUER PESSOA]" : ""}`);
    console.log(`    permissões: ${describe(c.$permissions)}`);
    console.log(`    segurança por documento: ${c.documentSecurity ? "ligada" : "desligada"}`);
    if (!needs) {
      console.log("    ok, nada a mudar");
      continue;
    }
    changes++;
    if (!APPLY) {
      console.log("    -> vai ficar: só usuários logados, segurança por documento desligada");
      continue;
    }
    try {
      await api("PUT", `/databases/${DATABASE}/collections/${c.$id}`, {
        name: c.name,
        permissions: LOGGED_IN,
        documentSecurity: false,
        enabled: c.enabled !== false,
      });
      console.log("    -> FECHADA");
    } catch (err) {
      failures++;
      console.log(`    -> ERRO: ${err.message}`);
    }
  }

  console.log("");
  for (const id of BUCKETS) {
    let b;
    try {
      b = await api("GET", `/storage/buckets/${id}`);
    } catch (err) {
      failures++;
      console.log(`- bucket ${id}: ERRO ao ler: ${err.message}`);
      continue;
    }
    const open = isOpen(b.$permissions);
    console.log(`- bucket ${b.$id}${open ? "  [ABERTO PARA QUALQUER PESSOA]" : ""}`);
    console.log(`    permissões: ${describe(b.$permissions)}`);
    console.log(`    segurança por arquivo: ${b.fileSecurity ? "ligada" : "desligada"}`);
    const needs = open || b.fileSecurity || describe(b.$permissions) !== describe(LOGGED_IN);
    if (!needs) {
      console.log("    ok, nada a mudar");
      continue;
    }
    changes++;
    if (!APPLY) {
      console.log("    -> vai ficar: só usuários logados, segurança por arquivo desligada");
      continue;
    }
    try {
      await api("PUT", `/storage/buckets/${b.$id}`, {
        name: b.name,
        permissions: LOGGED_IN,
        fileSecurity: false,
        enabled: b.enabled !== false,
        maximumFileSize: b.maximumFileSize,
        allowedFileExtensions: b.allowedFileExtensions,
        compression: b.compression,
        encryption: b.encryption,
        antivirus: b.antivirus,
      });
      console.log("    -> FECHADO");
    } catch (err) {
      failures++;
      console.log(`    -> ERRO: ${err.message}`);
    }
  }

  console.log("");
  if (!APPLY) {
    console.log(`${changes} item(ns) para mudar. Rode de novo com --aplicar para fechar.`);
  } else {
    console.log(`Concluído: ${changes - failures} item(ns) fechado(s), ${failures} erro(s).`);
  }
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error("Falhou:", err.message);
  process.exit(1);
});
