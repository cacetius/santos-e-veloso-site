// Armazenamento em memória que imita o Netlify Blobs, para testes.
export function lojaFalsa() {
  const m = new Map();
  return {
    m,
    async get(k, o = {}) { if (!m.has(k)) return null; const v = m.get(k); return o.type === "json" ? JSON.parse(v) : v; },
    async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
    async set(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); }
  };
}
