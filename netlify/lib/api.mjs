// Regras do servidor. Toda a segurança do painel fica aqui: o navegador nunca decide quem pode editar.
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const LIMITES = {
  tentativas: 5,                 // erros de senha por janela
  janelaMs: 15 * 60 * 1000,      // 15 minutos
  sessaoMs: 8 * 60 * 60 * 1000,  // login vale 8 horas
  corpoDados: 512 * 1024,        // JSON dos imóveis
  foto: 4 * 1024 * 1024,         // 4 MB por foto
  imoveis: 200, fotosPorImovel: 12
};
const TIPOS_FOTO = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const CT_POR_EXT = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const FOTO_URL = /^\/api\/fotos\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const FOTO_CHAVE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
const IMAGENS_PADRAO = ["urb", "cond", "rur", "inv"];

const base = { "x-content-type-options": "nosniff", "cache-control": "no-store" };
export const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", ...base, ...extra } });

/* configuração vinda das variáveis de ambiente da Netlify */
export function lerConfig(env) {
  const senha = env("ADMIN_SENHA") || "", segredo = env("SESSAO_SEGREDO") || "";
  if (senha.length < 10 || segredo.length < 32) return null; // nunca roda com senha fraca ou vazia
  return { senha, segredo };
}

/* sessão: token assinado com HMAC, expira sozinho */
export function criarToken(segredo, agora = Date.now()) {
  const p = Buffer.from(JSON.stringify({ exp: agora + LIMITES.sessaoMs })).toString("base64url");
  return `${p}.${createHmac("sha256", segredo).update(p).digest("base64url")}`;
}
export function tokenValido(tok, segredo, agora = Date.now()) {
  if (typeof tok !== "string" || tok.length > 400) return false;
  const partes = tok.split(".");
  if (partes.length !== 2) return false;
  const [p, s] = partes;
  const esperado = createHmac("sha256", segredo).update(p).digest();
  const recebido = Buffer.from(s, "base64url");
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return false;
  try { const { exp } = JSON.parse(Buffer.from(p, "base64url").toString()); return Number.isFinite(exp) && exp > agora; }
  catch { return false; }
}
function autorizado(req, cfg, agora) {
  const h = req.headers.get("authorization") || "";
  return h.startsWith("Bearer ") && tokenValido(h.slice(7), cfg.segredo, agora);
}

/* lê o corpo com limite de tamanho, para ninguém travar o servidor com um envio gigante */
async function lerCorpo(req, max) {
  const decl = Number(req.headers.get("content-length") || 0);
  if (decl > max) return { erro: 413 };
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength > max) return { erro: 413 };
  return { buf };
}
async function lerJSON(req, max) {
  const { buf, erro } = await lerCorpo(req, max);
  if (erro) return { erro };
  try { return { dados: JSON.parse(new TextDecoder().decode(buf)) }; } catch { return { erro: 400 }; }
}

/* ---------- POST /api/login ---------- */
export async function rotaLogin(req, { store, env, ip, agora = Date.now() }) {
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405, { allow: "POST" });
  const cfg = lerConfig(env);
  if (!cfg) return json({ erro: "Painel não configurado no servidor." }, 500);
  const chave = "login/" + createHash("sha256").update(String(ip || "?")).digest("hex").slice(0, 32);
  let reg = (await store.get(chave, { type: "json" })) || { n: 0, desde: agora };
  if (agora - reg.desde > LIMITES.janelaMs) reg = { n: 0, desde: agora };
  if (reg.n >= LIMITES.tentativas) return json({ erro: "Muitas tentativas. Tente de novo em 15 minutos." }, 429, { "retry-after": "900" });
  const { dados, erro } = await lerJSON(req, 2048);
  if (erro) return json({ erro: "Pedido inválido." }, erro);
  const senha = typeof dados?.senha === "string" ? dados.senha : "";
  const ok = timingSafeEqual(createHash("sha256").update(senha).digest(), createHash("sha256").update(cfg.senha).digest());
  if (!ok) {
    reg.n++; await store.setJSON(chave, reg);
    return json({ erro: "Senha incorreta." }, 401);
  }
  await store.delete(chave);
  return json({ token: criarToken(cfg.segredo, agora), expira: agora + LIMITES.sessaoMs });
}

/* ---------- validação dos dados ---------- */
const texto = (v, max) => typeof v === "string"
  ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f<>]/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max)
  : "";
const listaTexto = (v, maxItens, max) => Array.isArray(v) ? v.map(x => texto(x, max).replace(/\n/g, " ")).filter(Boolean).slice(0, maxItens) : [];

export function validarDados(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return { erro: "Formato inválido." };
  const c = d.config || {};
  const whatsapp = String(c.whatsapp ?? "").replace(/\D/g, "");
  if (!/^\d{12,13}$/.test(whatsapp)) return { erro: "WhatsApp inválido: use DDI + DDD + número, ex.: 5512974022184." };
  const config = { whatsapp };
  if (!Array.isArray(d.imoveis)) return { erro: "Lista de imóveis ausente." };
  if (d.imoveis.length > LIMITES.imoveis) return { erro: `Máximo de ${LIMITES.imoveis} imóveis.` };
  const vistos = new Set(), imoveis = [];
  for (const [n, i] of d.imoveis.entries()) {
    const onde = `Imóvel ${n + 1}`;
    if (!i || typeof i !== "object") return { erro: `${onde}: formato inválido.` };
    const cod = texto(i.cod, 12).toUpperCase();
    if (!/^[A-Z]{2,4}-\d{1,4}$/.test(cod)) return { erro: `${onde}: código inválido (ex.: SV-08).` };
    if (vistos.has(cod)) return { erro: `${onde}: o código ${cod} está repetido.` };
    vistos.add(cod);
    const titulo = texto(i.titulo, 90).replace(/\n/g, " ");
    if (titulo.length < 3) return { erro: `${cod}: escreva um título.` };
    const cat = texto(i.cat, 30).replace(/\n/g, " ");
    if (!cat) return { erro: `${cod}: escolha o tipo.` };
    const cidade = texto(i.cidade, 40).replace(/\n/g, " ");
    if (!cidade) return { erro: `${cod}: informe a cidade.` };
    let preco = null;
    if (i.preco !== null && i.preco !== "" && i.preco !== undefined) {
      preco = Number(i.preco);
      if (!Number.isInteger(preco) || preco < 1 || preco > 1e9) return { erro: `${cod}: preço inválido.` };
    }
    const fotos = Array.isArray(i.fotos) ? i.fotos.filter(f => typeof f === "string" && FOTO_URL.test(f)) : [];
    if (Array.isArray(i.fotos) && fotos.length !== i.fotos.length) return { erro: `${cod}: foto com endereço não permitido.` };
    if (fotos.length > LIMITES.fotosPorImovel) return { erro: `${cod}: máximo de ${LIMITES.fotosPorImovel} fotos.` };
    imoveis.push({
      cod, cat, titulo, cidade, preco, fotos,
      ph: IMAGENS_PADRAO.includes(i.ph) ? i.ph : "urb",
      bairro: texto(i.bairro, 60).replace(/\n/g, " "),
      specs: listaTexto(i.specs, 8, 30),
      desc: texto(i.desc, 1500),
      feat: listaTexto(i.feat, 12, 60)
    });
  }
  return { dados: { config, imoveis, atualizadoEm: new Date().toISOString() } };
}

/* ---------- GET/PUT /api/imoveis ---------- */
export async function rotaImoveis(req, { store, env, agora = Date.now() }) {
  if (req.method === "GET") {
    const d = await store.get("dados", { type: "json" });
    return d ? json(d, 200, { "cache-control": "no-cache" }) : json({ vazio: true }, 404);
  }
  if (req.method !== "PUT") return json({ erro: "Método não permitido." }, 405, { allow: "GET, PUT" });
  const cfg = lerConfig(env);
  if (!cfg) return json({ erro: "Painel não configurado no servidor." }, 500);
  if (!autorizado(req, cfg, agora)) return json({ erro: "Sessão expirada. Entre de novo." }, 401);
  const { dados, erro } = await lerJSON(req, LIMITES.corpoDados);
  if (erro) return json({ erro: erro === 413 ? "Dados grandes demais." : "Pedido inválido." }, erro);
  const v = validarDados(dados);
  if (v.erro) return json({ erro: v.erro }, 400);
  const anterior = await store.get("dados", { type: "json" });
  if (anterior) await store.setJSON("dados-anterior", anterior); // cópia para desfazer
  await store.setJSON("dados", v.dados);
  return json({ ok: true, dados: v.dados });
}

/* ---------- POST /api/fotos  e  GET /api/fotos/<arquivo> ---------- */
function assinaturaOk(buf, tipo) {
  const b = buf.subarray(0, 12);
  if (tipo === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (tipo === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (tipo === "image/webp") return String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WEBP";
  return false;
}
export async function rotaFotos(req, { store, env, agora = Date.now() }) {
  const caminho = new URL(req.url).pathname;
  if (req.method === "GET") {
    const m = caminho.match(/^\/api\/fotos\/([^/]+)$/);
    if (!m || !FOTO_CHAVE.test(m[1])) return json({ erro: "Não encontrada." }, 404);
    const r = await store.get("fotos/" + m[1], { type: "arrayBuffer" });
    if (!r) return json({ erro: "Não encontrada." }, 404);
    return new Response(r, { headers: {
      "content-type": CT_POR_EXT[m[1].split(".").pop()], "x-content-type-options": "nosniff",
      "cache-control": "public, max-age=31536000, immutable", "content-security-policy": "default-src 'none'"
    } });
  }
  if (req.method !== "POST" || caminho !== "/api/fotos") return json({ erro: "Método não permitido." }, 405, { allow: "GET, POST" });
  const cfg = lerConfig(env);
  if (!cfg) return json({ erro: "Painel não configurado no servidor." }, 500);
  if (!autorizado(req, cfg, agora)) return json({ erro: "Sessão expirada. Entre de novo." }, 401);
  const tipo = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!TIPOS_FOTO[tipo]) return json({ erro: "Envie JPG, PNG ou WEBP." }, 415);
  const { buf, erro } = await lerCorpo(req, LIMITES.foto);
  if (erro) return json({ erro: "Foto maior que 4 MB." }, 413);
  if (!assinaturaOk(buf, tipo)) return json({ erro: "O arquivo não é uma imagem válida." }, 415);
  const nome = `${randomUUID()}.${TIPOS_FOTO[tipo]}`;
  await store.set("fotos/" + nome, buf);
  return json({ url: "/api/fotos/" + nome }, 201);
}
