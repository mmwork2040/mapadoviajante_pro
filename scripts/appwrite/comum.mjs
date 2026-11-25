// Acesso ao Appwrite pelos scripts de manutenção. A chave vem de
// APPWRITE_ADMIN_KEY e nunca é gravada em arquivo.
export const ENDPOINT = (process.env.APPWRITE_ENDPOINT || "https://appwrite.agenc-ia.net/v1").replace(/\/$/, "");
export const PROJECT = process.env.APPWRITE_PROJECT_ID || "6abdb8190017d98565f5";
export const DATABASE = process.env.APPWRITE_DATABASE_ID || "6abdb82f002c563b2ad3";
const KEY = process.env.APPWRITE_ADMIN_KEY;

export function exigirChave() {
  if (!KEY) {
    console.error("Defina APPWRITE_ADMIN_KEY com uma chave de API do Appwrite.");
    process.exit(1);
  }
}

export async function api(method, path, body) {
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
    const err = new Error(`${method} ${path} -> ${res.status}: ${json.message || text}`);
    err.status = res.status;
    err.type = json.type;
    throw err;
  }
  return json;
}

const limite = (n) => encodeURIComponent(JSON.stringify({ method: "limit", values: [n] }));
const pular = (n) => encodeURIComponent(JSON.stringify({ method: "offset", values: [n] }));

export async function listarColecoes() {
  const todas = [];
  for (let offset = 0; ; offset += 100) {
    const page = await api("GET", `/databases/${DATABASE}/collections?queries[]=${limite(100)}&queries[]=${pular(offset)}`);
    const itens = page.collections || [];
    todas.push(...itens);
    if (itens.length < 100) break;
  }
  return todas;
}
