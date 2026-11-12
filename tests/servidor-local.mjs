// Servidor local para testar o site e o painel sem a Netlify.
// Uso: ADMIN_SENHA=... SESSAO_SEGREDO=... node tests/servidor-local.mjs   (abre em http://localhost:8888)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { rotaImoveis, rotaLogin, rotaFotos } from "../netlify/lib/api.mjs";
import { lojaFalsa } from "./loja-falsa.mjs";

const PUB = resolve(fileURLToPath(new URL("../public/", import.meta.url)));
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png" };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
export const store = lojaFalsa();
const env = k => process.env[k];

export const servidor = createServer(async (rq, rs) => {
  const url = new URL(rq.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) {
      const corpo = ["GET", "HEAD"].includes(rq.method) ? undefined : await new Promise(r => { const c = []; rq.on("data", d => c.push(d)); rq.on("end", () => r(Buffer.concat(c))); });
      const req = new Request(url, { method: rq.method, headers: rq.headers, body: corpo });
      const rota = url.pathname === "/api/login" ? rotaLogin : url.pathname === "/api/imoveis" ? rotaImoveis : url.pathname.startsWith("/api/fotos") ? rotaFotos : null;
      const r = rota ? await rota(req, { store, env, ip: rq.socket.remoteAddress }) : new Response("{}", { status: 404 });
      rs.writeHead(r.status, Object.fromEntries(r.headers)); rs.end(Buffer.from(await r.arrayBuffer())); return;
    }
    const caminho = decodeURIComponent(url.pathname).replace(/^[/\\]+/, "") || "index.html";
    const arq = resolve(PUB, caminho);
    if (arq !== PUB && !arq.startsWith(PUB + sep)) { rs.writeHead(403); rs.end(); return; }
    const dados = await readFile(arq);
    rs.writeHead(200, { "content-type": TIPOS[extname(arq)] || "application/octet-stream", "content-security-policy": CSP });
    rs.end(dados);
  } catch { rs.writeHead(404); rs.end("não encontrado"); }
});
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) servidor.listen(8888, "127.0.0.1", () => console.log("http://localhost:8888"));
