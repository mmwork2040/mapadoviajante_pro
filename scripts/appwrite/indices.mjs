// Índices das consultas que o app faz o tempo todo (por agência, por viagem,
// por roteiro...). Só cria o que falta e só em campo que existe. Pode rodar de novo.
// Uso: node scripts/appwrite/indices.mjs [--aplicar]   (mesmas variáveis do isolar-agencias.mjs)
const E = (process.env.APPWRITE_ENDPOINT || 'https://appwrite.agenc-ia.net/v1').replace(/\/$/, '');
const P = process.env.APPWRITE_PROJECT_ID || '6abdb8190017d98565f5';
const DB = process.env.APPWRITE_DATABASE_ID || '6abdb82f002c563b2ad3';
const KEY = process.env.APPWRITE_API_KEY || 'chave-via-proxy';
const APLICAR = process.argv.includes('--aplicar');

const INDICES = {
  agency_members: [['agency_id'], ['user_id'], ['email'], ['invite_token']],
  crm_clients: [['agency_id']],
  crm_leads: [['agency_id'], ['client_id'], ['agency_id', 'status']],
  crm_lead_activities: [['lead_id']],
  crm_lead_documents: [['lead_id']],
  crm_itineraries: [['agency_id'], ['lead_id']],
  crm_itinerary_days: [['itinerary_id']],
  crm_itinerary_activities: [['day_id']],
  crm_vouchers: [['itinerary_id']],
  crm_trip_expenses: [['lead_id']],
  crm_transactions: [['agency_id']],
  crm_tasks: [['agency_id'], ['lead_id'], ['assigned_to']],
  crm_notifications: [['recipient_id']],
  crm_library_destinations: [['agency_id']],
  crm_library_items: [['agency_id']],
  crm_ai_config: [['agency_id']],
  system_settings: [['key']],
};

async function api(method, path, body) {
  const r = await fetch(E + path, { method, headers: { 'Content-Type': 'application/json', 'X-Appwrite-Project': P, 'X-Appwrite-Key': KEY }, body: body && JSON.stringify(body) });
  const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null };
}

for (const [col, lista] of Object.entries(INDICES)) {
  const c = await api('GET', `/databases/${DB}/collections/${col}`);
  if (c.status !== 200) { console.log(`${col}: coleção não existe, pulando`); continue; }
  const attrs = new Map(c.data.attributes.map((a) => [a.key, a]));
  for (const campos of lista) {
    const chave = `idx_${campos.join('_')}`.slice(0, 36);
    if (c.data.indexes.some((i) => i.key === chave || i.attributes.join() === campos.join())) continue;
    const falta = campos.filter((f) => !attrs.has(f));
    if (falta.length) { console.log(`${col}: sem o campo ${falta.join(', ')}, pulando ${chave}`); continue; }
    // Texto longo não cabe inteiro no índice: indexa o começo.
    const lengths = campos.map((f) => (attrs.get(f).type === 'string' && attrs.get(f).size > 255 ? 255 : null));
    console.log(APLICAR ? '•' : '(simulação)', `${col}: criar ${chave}`);
    if (APLICAR) {
      const r = await api('POST', `/databases/${DB}/collections/${col}/indexes`, { key: chave, type: 'key', attributes: campos, orders: campos.map(() => 'ASC'), ...(lengths.some(Boolean) ? { lengths } : {}) });
      if (r.status !== 202 && r.status !== 201) console.log(`   falhou: ${r.status} ${r.data?.message}`);
    }
  }
}
console.log(APLICAR ? 'pronto (o Appwrite monta os índices em segundo plano).' : 'simulação: nada foi alterado.');
