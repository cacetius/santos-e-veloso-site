// Testes de segurança da API. Rodar com: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lojaFalsa } from "./loja-falsa.mjs";
import { rotaLogin, rotaImoveis, rotaFotos, criarToken, tokenValido, validarDados, LIMITES } from "../netlify/lib/api.mjs";

const SENHA = "senha-de-teste-123", SEGREDO = "x".repeat(40);
const env = k => ({ ADMIN_SENHA: SENHA, SESSAO_SEGREDO: SEGREDO })[k];
const base = "https://site.test";
const req = (path, o = {}) => new Request(base + path, o);
const seed = JSON.parse(readFileSync(new URL("../public/imoveis.json", import.meta.url)));
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function entrar(store, ip = "1.1.1.1") {
  const r = await rotaLogin(req("/api/login", { method: "POST", body: JSON.stringify({ senha: SENHA }) }), { store, env, ip });
  assert.equal(r.status, 200);
  return (await r.json()).token;
}
const put = (token, corpo) => req("/api/imoveis", { method: "PUT", headers: token ? { authorization: "Bearer " + token } : {}, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });

test("visitante consegue ver os imóveis, mas não alterar", async () => {
  const store = lojaFalsa();
  assert.equal((await rotaImoveis(req("/api/imoveis"), { store, env })).status, 404); // vazio: site usa imoveis.json
  assert.equal((await rotaImoveis(put(null, seed), { store, env })).status, 401);
  assert.equal(store.m.has("dados"), false);
});

test("token falso, adulterado ou vencido é recusado", async () => {
  const store = lojaFalsa();
  const bom = criarToken(SEGREDO);
  const [p, s] = bom.split(".");
  const adulterado = Buffer.from(JSON.stringify({ exp: Date.now() + 9e12 })).toString("base64url") + "." + s;
  const vencido = criarToken(SEGREDO, Date.now() - LIMITES.sessaoMs - 1000);
  const outroSegredo = criarToken("y".repeat(40));
  for (const t of ["abc", "a.b", adulterado, vencido, outroSegredo, p, bom + ".x", "x".repeat(500)]) {
    assert.equal(tokenValido(t, SEGREDO), false, t.slice(0, 30));
    assert.equal((await rotaImoveis(put(t, seed), { store, env })).status, 401);
  }
  assert.equal(tokenValido(bom, SEGREDO), true);
});

test("senha errada é recusada e bloqueia depois de 5 tentativas", async () => {
  const store = lojaFalsa();
  const tentar = (senha, ip = "9.9.9.9") => rotaLogin(req("/api/login", { method: "POST", body: JSON.stringify({ senha }) }), { store, env, ip });
  for (let n = 0; n < 5; n++) assert.equal((await tentar("errada")).status, 401);
  assert.equal((await tentar(SENHA)).status, 429, "bloqueia mesmo com a senha certa durante a janela");
  assert.equal((await tentar(SENHA, "8.8.8.8")).status, 200, "outro aparelho não é afetado");
  const depois = await rotaLogin(req("/api/login", { method: "POST", body: JSON.stringify({ senha: SENHA }) }), { store, env, ip: "9.9.9.9", agora: Date.now() + LIMITES.janelaMs + 1000 });
  assert.equal(depois.status, 200, "libera depois de 15 minutos");
});

test("senha não pode ser burlada com tipos estranhos", async () => {
  const store = lojaFalsa();
  for (const corpo of [{ senha: [SENHA] }, { senha: { $ne: "" } }, { senha: null }, {}, "lixo", "x".repeat(5000)]) {
    const r = await rotaLogin(req("/api/login", { method: "POST", body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) }), { store, env, ip: "2.2.2." + Math.random() });
    assert.notEqual(r.status, 200, JSON.stringify(corpo).slice(0, 40));
  }
});

test("servidor sem senha configurada nunca libera o painel", async () => {
  const store = lojaFalsa();
  for (const e of [() => undefined, k => ({ ADMIN_SENHA: "", SESSAO_SEGREDO: SEGREDO })[k], k => ({ ADMIN_SENHA: "curta", SESSAO_SEGREDO: SEGREDO })[k], k => ({ ADMIN_SENHA: SENHA, SESSAO_SEGREDO: "curto" })[k]]) {
    const r = await rotaLogin(req("/api/login", { method: "POST", body: JSON.stringify({ senha: "" }) }), { store, env: e, ip: "3.3.3.3" });
    assert.equal(r.status, 500);
    assert.equal((await rotaImoveis(put(criarToken("curto"), seed), { store, env: e })).status, 500);
  }
});

test("corretor logado salva, e a versão anterior fica guardada", async () => {
  const store = lojaFalsa(), token = await entrar(store);
  assert.equal((await rotaImoveis(put(token, seed), { store, env })).status, 200);
  const novo = structuredClone(seed); novo.imoveis[0].titulo = "Título novo";
  const r = await rotaImoveis(put(token, novo), { store, env });
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(store.m.get("dados")).imoveis[0].titulo, "Título novo");
  assert.equal(JSON.parse(store.m.get("dados-anterior")).imoveis[0].titulo, seed.imoveis[0].titulo);
  const g = await rotaImoveis(req("/api/imoveis"), { store, env });
  assert.equal(g.status, 200);
  assert.equal(g.headers.get("x-content-type-options"), "nosniff");
});

test("texto com código malicioso é neutralizado", () => {
  const d = structuredClone(seed);
  d.imoveis[0].titulo = '<script>alert(1)</script>Casa';
  d.imoveis[0].desc = '<img src=x onerror=alert(1)>';
  d.imoveis[0].feat = ['<b>ok</b>'];
  const { dados } = validarDados(d);
  const tudo = JSON.stringify(dados);
  assert.equal(/[<>]/.test(tudo), false);
});

test("dados inválidos são recusados", () => {
  const casos = [
    d => { d.imoveis[0].fotos = ["javascript:alert(1)"]; },
    d => { d.imoveis[0].fotos = ["https://site-estranho.com/x.jpg"]; },
    d => { d.imoveis[0].fotos = ["/api/fotos/../../segredo"]; },
    d => { d.imoveis[1].cod = d.imoveis[0].cod; },
    d => { d.imoveis[0].cod = "<x>"; },
    d => { d.imoveis[0].preco = -5; },
    d => { d.imoveis[0].preco = "abc"; },
    d => { d.imoveis[0].titulo = ""; },
    d => { d.config.whatsapp = "123"; },
    d => { d.imoveis = Array(LIMITES.imoveis + 1).fill(d.imoveis[0]); },
    d => { d.imoveis = "não é lista"; }
  ];
  for (const muda of casos) { const d = structuredClone(seed); muda(d); assert.ok(validarDados(d).erro, muda.toString()); }
  assert.ok(validarDados(null).erro); assert.ok(validarDados([]).erro);
});

test("envio grande demais é recusado sem travar", async () => {
  const store = lojaFalsa(), token = await entrar(store);
  const r = await rotaImoveis(put(token, "x".repeat(LIMITES.corpoDados + 10)), { store, env });
  assert.equal(r.status, 413);
});

test("fotos: só com login, só imagem de verdade, até 4 MB", async () => {
  const store = lojaFalsa(), token = await entrar(store);
  const up = (corpo, tipo, tok = token) => rotaFotos(req("/api/fotos", { method: "POST", headers: { "content-type": tipo, ...(tok ? { authorization: "Bearer " + tok } : {}) }, body: corpo }), { store, env });
  assert.equal((await up(PNG, "image/png", null)).status, 401);
  assert.equal((await up(new TextEncoder().encode("<html>"), "image/png")).status, 415, "arquivo disfarçado de imagem");
  assert.equal((await up(PNG, "text/html")).status, 415);
  assert.equal((await up(PNG, "image/svg+xml")).status, 415, "SVG pode conter script");
  const big = new Uint8Array(LIMITES.foto + 1); big.set(PNG);
  assert.equal((await up(big, "image/png")).status, 413);
  const ok = await up(PNG, "image/png");
  assert.equal(ok.status, 201);
  const { url } = await ok.json();
  assert.match(url, /^\/api\/fotos\/[0-9a-f-]{36}\.png$/);
  const g = await rotaFotos(req(url), { store, env });
  assert.equal(g.status, 200);
  assert.equal(g.headers.get("content-type"), "image/png");
  assert.equal(g.headers.get("x-content-type-options"), "nosniff");
});

test("fotos: não dá para ler outros arquivos do servidor", async () => {
  const store = lojaFalsa();
  store.m.set("dados", "{}"); store.m.set("login/abc", "{}");
  for (const p of ["/api/fotos/..%2Fdados", "/api/fotos/../dados", "/api/fotos/dados", "/api/fotos/login%2Fabc", "/api/fotos/x.svg"]) {
    const r = await rotaFotos(req(p), { store, env });
    assert.equal(r.status, 404, p);
  }
});

test("métodos não previstos são recusados", async () => {
  const store = lojaFalsa();
  assert.equal((await rotaImoveis(req("/api/imoveis", { method: "DELETE" }), { store, env })).status, 405);
  assert.equal((await rotaLogin(req("/api/login"), { store, env, ip: "x" })).status, 405);
  assert.equal((await rotaFotos(req("/api/fotos", { method: "DELETE" }), { store, env })).status, 405);
});
