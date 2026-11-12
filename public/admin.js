// Painel de edição. Carregado só quando alguém aperta Ctrl+Alt+L.
// Este arquivo não guarda senha nem decide nada: todo pedido de alteração vai para o servidor,
// que confere a sessão. Sem a senha, este painel não consegue salvar nada.

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CHAVE = "sv-sessao";
let ctx, raiz, rascunho, alterado = false, editando = null;

function sessao() {
  try { const s = JSON.parse(sessionStorage.getItem(CHAVE) || "null"); return s && s.expira > Date.now() ? s : null; } catch { return null; }
}
function salvarSessao(s) { try { s ? sessionStorage.setItem(CHAVE, JSON.stringify(s)) : sessionStorage.removeItem(CHAVE); } catch {} }

async function api(url, opts = {}) {
  const s = sessao();
  const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), ...(s ? { authorization: "Bearer " + s.token } : {}) } });
  let corpo = {}; try { corpo = await r.json(); } catch {}
  if (r.status === 401 && url !== "/api/login") { salvarSessao(null); telaLogin("Sua sessão expirou. Entre de novo."); throw new Error("sessao"); }
  if (!r.ok) throw new Error(corpo.erro || "Não foi possível concluir. Verifique a internet e tente de novo.");
  return corpo;
}

export function abrir(c) {
  ctx = c;
  if (!raiz) {
    raiz = document.createElement("div");
    raiz.className = "sheet-wrap adm";
    raiz.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Editar imóveis"><div class="scroll" id="adm"></div></div>`;
    document.body.append(raiz);
    raiz.addEventListener("click", e => { if (e.target === raiz) fechar(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && raiz.classList.contains("open")) fechar(); });
  }
  raiz.hidden = false; document.body.style.overflow = "hidden";
  requestAnimationFrame(() => requestAnimationFrame(() => raiz.classList.add("open")));
  sessao() ? painel() : telaLogin();
}
function fechar() {
  if (alterado && !raiz.dataset.confirmar) {
    raiz.dataset.confirmar = "1";
    ctx.toast("Há alterações não salvas. Toque fora de novo para descartar.");
    setTimeout(() => delete raiz.dataset.confirmar, 3000);
    return;
  }
  delete raiz.dataset.confirmar;
  alterado = false; editando = null;
  raiz.classList.remove("open"); document.body.style.overflow = "";
  setTimeout(() => { if (!raiz.classList.contains("open")) raiz.hidden = true; }, 380);
}
const $a = sel => raiz.querySelector(sel);
const barra = (esq, titulo, dir) => `<div class="adm-bar">${esq}<b>${esc(titulo)}</b>${dir}</div>`;

/* ---------- login ---------- */
function telaLogin(msg = "") {
  $a("#adm").innerHTML = `
    ${barra(`<button type="button" class="lnk" data-a="fechar">Cancelar</button>`, "Área do corretor", `<span></span>`)}
    <div class="in">
      <div class="brand"><div class="logo" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>
        <h1>Editar imóveis</h1><p>Digite a senha do painel.</p></div>
      <form id="f-login" novalidate>
        <div class="group"><label class="row" for="adm-senha"><span class="k">Senha</span><input id="adm-senha" type="password" autocomplete="current-password" required></label></div>
        <p class="err" id="adm-err" ${msg ? "" : "hidden"}>${esc(msg)}</p>
        <div class="stackb"><button class="btn" type="submit">Entrar</button></div>
      </form>
    </div>`;
  $a("[data-a=fechar]").onclick = fechar;
  const f = $a("#f-login");
  f.onsubmit = async e => {
    e.preventDefault();
    const senha = $a("#adm-senha").value, err = $a("#adm-err"), b = f.querySelector("button");
    if (!senha) { err.textContent = "Digite a senha."; err.hidden = false; return; }
    b.disabled = true; b.textContent = "Entrando…";
    try {
      const r = await api("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ senha }) });
      salvarSessao({ token: r.token, expira: r.expira });
      painel();
    } catch (x) { if (x.message !== "sessao") { err.textContent = x.message; err.hidden = false; } b.disabled = false; b.textContent = "Entrar"; }
  };
  setTimeout(() => $a("#adm-senha")?.focus(), 300);
}

/* ---------- lista ---------- */
function painel() {
  if (!rascunho || !alterado) rascunho = ctx.dadosAtuais();
  editando = null;
  const r = rascunho;
  $a("#adm").innerHTML = `
    ${barra(`<button type="button" class="lnk" data-a="sair">Sair</button>`, "Editar imóveis", `<button type="button" class="lnk b" data-a="salvar">Salvar</button>`)}
    <div class="in">
      <p class="adm-status ${alterado ? "pend" : ""}">${alterado ? "Alterações não salvas" : "Tudo salvo"}</p>
      <p class="cap">Imóveis (${r.imoveis.length})</p>
      <div class="group">
        ${r.imoveis.map((i, k) => `<button type="button" class="row" data-ed="${k}">
          <span class="adm-th ${esc(i.ph)}" ${i.fotos[0] ? `style="background-image:url('${esc(i.fotos[0])}')"` : ""}></span>
          <span class="k"><b>${esc(i.titulo)}</b><br><span class="meta">${esc(i.cod)} · ${esc(i.cidade)} · ${i.preco ? esc(i.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })) : "Consulte"}</span></span>
          <svg class="chev" width="8" height="13" viewBox="0 0 8 13" aria-hidden="true"><path d="M1 1l5.5 5.5L1 12" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>`).join("")}
        <button type="button" class="row" data-a="novo"><span class="k" style="color:var(--tint)">＋ Adicionar imóvel</span></button>
      </div>
      <div class="stackb"><button class="btn" type="button" data-a="salvar">Salvar no site</button></div>
      <p class="foot">O site guarda automaticamente a versão anterior a cada salvamento.</p>
    </div>`;
  raiz.querySelectorAll("[data-ed]").forEach(b => b.onclick = () => editor(Number(b.dataset.ed)));
  $a("[data-a=novo]").onclick = () => {
    const nums = r.imoveis.map(i => Number((i.cod.match(/\d+$/) || [0])[0]));
    const cod = "SV-" + String(Math.max(0, ...nums) + 1).padStart(2, "0");
    r.imoveis.push({ cod, cat: "Casas", ph: "urb", cidade: "Taubaté", bairro: "", titulo: "", preco: null, fotos: [], specs: [], desc: "", feat: [] });
    marcar(); editor(r.imoveis.length - 1);
  };
  raiz.querySelectorAll("[data-a=salvar]").forEach(b => b.onclick = salvar);
  $a("[data-a=sair]").onclick = () => { salvarSessao(null); alterado = false; rascunho = null; fechar(); ctx.toast("Você saiu do painel"); };
}
function marcar() { alterado = true; const s = $a(".adm-status"); if (s) { s.textContent = "Alterações não salvas"; s.classList.add("pend"); } }

async function salvar() {
  if (editando !== null && !lerEditor()) return;
  const bs = raiz.querySelectorAll("[data-a=salvar]");
  bs.forEach(b => { b.disabled = true; });
  try {
    const r = await api("/api/imoveis", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(rascunho) });
    ctx.aplicarDados(r.dados); rascunho = ctx.dadosAtuais(); alterado = false;
    ctx.toast("Salvo. O site já está atualizado.");
    painel();
  } catch (x) { if (x.message !== "sessao") ctx.toast(x.message); bs.forEach(b => { b.disabled = false; }); }
}

/* ---------- editor de um imóvel ---------- */
function editor(k) {
  editando = k;
  const i = rascunho.imoveis[k], cats = [...new Set(rascunho.imoveis.map(x => x.cat).concat(["Casas", "Apartamentos", "Terrenos", "Rurais", "Comerciais"]))];
  $a("#adm").innerHTML = `
    ${barra(`<button type="button" class="lnk" data-a="voltar">‹ Imóveis</button>`, i.titulo || "Novo imóvel", `<button type="button" class="lnk b" data-a="salvar">Salvar</button>`)}
    <div class="in">
      <p class="cap">Fotos</p>
      <div class="adm-fotos" id="a-fotos"></div>
      <label class="btn gray" for="a-up" style="margin-top:10px">Adicionar fotos</label>
      <input id="a-up" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>
      <p class="foot">A primeira foto aparece na vitrine. Fotos grandes são reduzidas automaticamente.</p>
      <p class="cap">Principal</p>
      <div class="group">
        <label class="row" for="e-cod"><span class="k">Código</span><input id="e-cod" value="${esc(i.cod)}"></label>
        <label class="row" for="e-tit"><span class="k">Título</span><input id="e-tit" value="${esc(i.titulo)}" placeholder="Ex.: Casa térrea no Independência"></label>
        <label class="row" for="e-cat"><span class="k">Tipo</span><input id="e-cat" list="e-cats" value="${esc(i.cat)}"></label>
        <datalist id="e-cats">${cats.map(c => `<option value="${esc(c)}">`).join("")}</datalist>
        <label class="row" for="e-preco"><span class="k">Preço (R$)</span><input id="e-preco" inputmode="numeric" value="${i.preco ?? ""}" placeholder="Vazio = Consulte"></label>
      </div>
      <p class="cap">Local</p>
      <div class="group">
        <label class="row" for="e-cid"><span class="k">Cidade</span><input id="e-cid" value="${esc(i.cidade)}"></label>
        <label class="row" for="e-bai"><span class="k">Bairro</span><input id="e-bai" value="${esc(i.bairro)}"></label>
      </div>
      <p class="cap">Detalhes</p>
      <div class="group">
        <label class="row stack" for="e-specs"><span class="k">Medidas e números</span><input id="e-specs" style="text-align:left" value="${esc(i.specs.join(", "))}" placeholder="94 m², 3 quartos, 1 suíte"></label>
        <label class="row stack" for="e-desc"><span class="k">Descrição</span><textarea id="e-desc" rows="4">${esc(i.desc)}</textarea></label>
        <label class="row stack" for="e-feat"><span class="k">Características (uma por linha)</span><textarea id="e-feat" rows="4">${esc(i.feat.join("\n"))}</textarea></label>
        <label class="row" for="e-ph"><span class="k">Imagem sem foto</span><select id="e-ph">
          ${[["urb", "Casa / apartamento"], ["cond", "Condomínio"], ["rur", "Rural"], ["inv", "Comercial"]].map(([v, t]) => `<option value="${v}" ${i.ph === v ? "selected" : ""}>${t}</option>`).join("")}
        </select></label>
      </div>
      <p class="err" id="e-err" hidden></p>
      <div class="stackb">
        <button class="btn" type="button" data-a="salvar">Salvar no site</button>
        <button class="btn gray del" type="button" data-a="excluir">Excluir imóvel</button>
      </div>
    </div>`;
  fotos();
  raiz.querySelectorAll("#adm input:not([type=file]), #adm textarea, #adm select").forEach(el => el.addEventListener("input", marcar));
  $a("[data-a=voltar]").onclick = () => { if (lerEditor()) painel(); };
  raiz.querySelectorAll("[data-a=salvar]").forEach(b => b.onclick = salvar);
  $a("[data-a=excluir]").onclick = e => {
    const b = e.currentTarget;
    if (!b.dataset.ok) { b.dataset.ok = "1"; b.textContent = "Toque de novo para excluir"; setTimeout(() => { delete b.dataset.ok; b.textContent = "Excluir imóvel"; }, 3000); return; }
    rascunho.imoveis.splice(k, 1); marcar(); painel(); ctx.toast("Imóvel removido. Toque em Salvar para publicar.");
  };
  $a("#a-up").onchange = e => enviarFotos([...e.target.files]);
}
function lerEditor() {
  const i = rascunho.imoveis[editando], v = id => $a("#" + id).value.trim();
  const preco = v("e-preco").replace(/\D/g, "");
  Object.assign(i, {
    cod: v("e-cod").toUpperCase(), titulo: v("e-tit"), cat: v("e-cat"), cidade: v("e-cid"), bairro: v("e-bai"),
    preco: preco ? Number(preco) : null, ph: v("e-ph"), desc: v("e-desc"),
    specs: v("e-specs").split(",").map(s => s.trim()).filter(Boolean),
    feat: v("e-feat").split("\n").map(s => s.trim()).filter(Boolean)
  });
  const erro = !/^[A-Z]{2,4}-\d{1,4}$/.test(i.cod) ? "Código no formato SV-08."
    : rascunho.imoveis.some((x, j) => j !== editando && x.cod === i.cod) ? `O código ${i.cod} já existe.`
    : i.titulo.length < 3 ? "Escreva um título." : !i.cat ? "Informe o tipo." : !i.cidade ? "Informe a cidade." : "";
  const el = $a("#e-err"); el.textContent = erro; el.hidden = !erro;
  if (erro) el.scrollIntoView({ block: "center" });
  return !erro;
}
function fotos() {
  const i = rascunho.imoveis[editando], box = $a("#a-fotos");
  box.innerHTML = i.fotos.length ? i.fotos.map((f, k) => `<div class="adm-foto" style="background-image:url('${esc(f)}')">
      ${k ? `<button type="button" data-p="${k}" aria-label="Usar como capa">★</button>` : `<span class="capa">Capa</span>`}
      <button type="button" data-r="${k}" aria-label="Remover foto">✕</button></div>`).join("")
    : `<p class="meta" style="margin:0">Nenhuma foto ainda.</p>`;
  box.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { i.fotos.splice(Number(b.dataset.r), 1); marcar(); fotos(); });
  box.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { const [f] = i.fotos.splice(Number(b.dataset.p), 1); i.fotos.unshift(f); marcar(); fotos(); });
}
async function reduzir(arquivo) {
  const bmp = await createImageBitmap(arquivo);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(res, "image/jpeg", 0.82));
}
async function enviarFotos(arquivos) {
  const i = rascunho.imoveis[editando], lbl = $a("label[for=a-up]");
  for (const [n, a] of arquivos.entries()) {
    if (i.fotos.length >= 12) { ctx.toast("Máximo de 12 fotos por imóvel."); break; }
    lbl.textContent = `Enviando ${n + 1} de ${arquivos.length}…`;
    try {
      const blob = await reduzir(a);
      const r = await api("/api/fotos", { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
      i.fotos.push(r.url); marcar(); fotos();
    } catch (x) { if (x.message === "sessao") return; ctx.toast(`${a.name}: ${x.message}`); }
  }
  lbl.textContent = "Adicionar fotos"; $a("#a-up").value = "";
}
