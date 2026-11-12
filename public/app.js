/* Os imóveis vêm do servidor (/api/imoveis), editados pelo painel (Ctrl+Alt+L).
   Se o servidor ainda não tiver dados, usa public/imoveis.json. */
let CONFIG = { whatsapp: "5512991239366" };
const CORRETORES = {
  juan: { nome: "Juan Veloso", numero: "5512991239366", exibicao: "(12) 99123-9366" },
  leandro: { nome: "Leandro", numero: "5512974022184", exibicao: "(12) 97402-2184" }
};
let IMOVEIS = [];

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const brl = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
const wa = (txt, numero = CONFIG.whatsapp) => `https://wa.me/${numero}?text=${encodeURIComponent(txt)}`;
const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
const local = i => [i.bairro,i.cidade].filter(Boolean).join(" · ");
const ICON = {
  urb:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M3 11 12 4l9 7v9H3z"/><path d="M10 20v-6h4v6"/></svg>',
  cond:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M3 20h18M5 20V9l4-3 4 3v11M13 20v-8l3-2 3 2v8"/></svg>',
  rur:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M2 19c4-6 7-6 10-2 3-5 6-5 10 2z"/><circle cx="17" cy="6" r="2"/></svg>',
  inv:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M4 20V10l8-6 8 6v10z"/><path d="M8 20v-5h8v5M4 13h16"/></svg>'
};
const WA_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.3 2.5 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.6-.1 1.2z"/></svg>';
const pic = (i,src,extra="") => src
  ? `<div class="pic" style="background-image:url('${esc(src)}')" role="img" aria-label="Foto de ${esc(i.titulo)}">${extra}</div>`
  : `<div class="pic ${i.ph}" role="img" aria-label="Imagem ilustrativa">${ICON[i.ph]}${extra}</div>`;
const precoHTML = i => i.preco ? `<span class="price">${brl(i.preco)}</span>` : `<span class="price c">Consulte o valor</span>`;

/* toast */
let tt;
function toast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(tt); tt=setTimeout(()=>t.classList.remove("show"),1800); }

/* lista */
let cat = "";
function card(i){
  return `<div class="card" role="button" tabindex="0" data-open="${i.cod}" aria-label="${esc(i.titulo)}, ${esc(local(i))}">
    ${pic(i,i.fotos[0],`<span class="glass tag">${esc(i.cat)}</span><span class="glass cod">${i.cod}</span>`)}
    <div class="info">${precoHTML(i)}<h3>${esc(i.titulo)}</h3>
      <p class="meta">${esc(local(i))}${i.specs.length?`<span class="dot">·</span>${esc(i.specs.slice(0,2).join(" · "))}`:""}</p></div>
  </div>`;
}
function filtrados(){
  const q=norm($("q").value.trim()), cid=$("m-cid").value, max=Number($("m-max").value)||0;
  return IMOVEIS.filter(i=>(!cat||i.cat===cat)&&(!cid||i.cidade===cid)&&(!max||i.preco==null||i.preco<=max)
    &&(!q||norm([i.cod,i.titulo,i.bairro,i.cidade,i.cat].join(" ")).includes(q)));
}
function renderAll(){
  const cats = [...new Set(IMOVEIS.map(i=>i.cat))];
  if(cat && !cats.includes(cat)) cat = "";
  $("chips").innerHTML = ["",...cats].map(c=>`<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c===cat}">${c||"Todos"}</button>`).join("");
  $("m-cid-t").textContent = $("m-cid").selectedOptions[0].text;
  $("m-max-t").textContent = $("m-max").selectedOptions[0].text;
  $("q-clear").hidden = !$("q").value;
  const l = filtrados();
  $("count").textContent = `${l.length} ${l.length===1?"imóvel":"imóveis"}`;
  $("list").innerHTML = l.length ? l.map(card).join("") : `<div class="empty" style="grid-column:1/-1">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <b>Nenhum imóvel encontrado</b><span>Conte o que você procura e o corretor avisa quando entrar algo.</span>
      <a class="btn wa" style="max-width:280px" target="_blank" rel="noopener" href="${wa("Olá, Juan! Procurei no site e não achei o imóvel que quero. Pode me ajudar?")}">Avisar o corretor</a></div>`;
}
$("chips").addEventListener("click",e=>{const b=e.target.closest("[data-cat]"); if(b){cat=b.dataset.cat; renderAll();}});
["q","m-cid","m-max"].forEach(id=>$(id).addEventListener("input",renderAll));
$("q-clear").addEventListener("click",()=>{$("q").value=""; renderAll(); $("q").focus();});
document.addEventListener("click",e=>{
  const o=e.target.closest("[data-open]"); if(o) location.hash = o.dataset.open;
});
document.addEventListener("keydown",e=>{
  const o=e.target.closest&&e.target.closest("[data-open]");
  if(o && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); location.hash=o.dataset.open; }
  if(e.key==="Escape" && !$("sheet-wrap").hidden) closeSheet();
});

/* abas */
const TABS = ["imoveis","financiar","anunciar","contato"];
let tabAtual = "imoveis";
function showTab(t){
  tabAtual = t;
  TABS.forEach(x=>$("v-"+x).hidden = x!==t);
  document.querySelectorAll(".tab").forEach(b=>{ if(b.dataset.tab===t) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current"); });
  $("nav-t").textContent = $("v-"+t).dataset.title;
  window.scrollTo(0,0); onScroll();
}
$("tabs").addEventListener("click",e=>{
  const b=e.target.closest(".tab"); if(!b) return;
  if(b.dataset.tab===tabAtual){ window.scrollTo({top:0,behavior:"smooth"}); return; }
  history.replaceState(null,"",b.dataset.tab==="imoveis" ? location.pathname : "#"+b.dataset.tab);
  showTab(b.dataset.tab);
});
function onScroll(){ $("nav").classList.toggle("solid", window.scrollY > (tabAtual==="imoveis"?150:40)); }
window.addEventListener("scroll",onScroll,{passive:true});

/* ficha do imóvel (sheet) */
function openSheet(i){
  const fotos = i.fotos.length ? i.fotos : [null];
  const amanha = new Date(Date.now()+864e5).toISOString().slice(0,10);
  $("sheet-body").innerHTML = `
    <div class="gallery" id="gal">${fotos.map(f=>pic(i,f)).join("")}</div>
    ${fotos.length>1?`<div class="dots" id="dots">${fotos.map((_,k)=>`<span class="${k?"":"on"}"></span>`).join("")}</div>`:""}
    <div class="in">
      <div class="dhead">${precoHTML(i)}<h2 id="d-tit">${esc(i.titulo)}</h2><p class="meta">${esc(local(i))} · Código ${i.cod}</p></div>
      <div class="acts">
        <a class="act" target="_blank" rel="noopener" href="${wa(`Olá, Juan! Tenho interesse no imóvel ${i.cod}: ${i.titulo}. Pode me passar mais informações?`)}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4.2A2.5 2.5 0 0 1 4 13.5z"/></svg>Mensagem</a>
        <button type="button" class="act" id="share"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>Compartilhar</button>
      </div>
      ${i.specs.length?`<div class="spec">${i.specs.map(s=>`<span>${esc(s)}</span>`).join("")}</div>`:""}
      <p class="desc">${esc(i.desc)}</p>
      <p class="cap">Características</p>
      <div class="group">${i.feat.map(f=>`<div class="row"><svg class="check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M4 12.5l5 5L20 6"/></svg><span class="k">${esc(f)}</span></div>`).join("")}
        <a class="row" target="_blank" rel="noopener" href="https://maps.apple.com/?q=${encodeURIComponent([i.bairro,i.cidade,"SP"].filter(Boolean).join(", "))}"><span class="k" style="color:var(--tint)">Ver região no mapa</span><svg class="chev" width="8" height="13" viewBox="0 0 8 13" aria-hidden="true"><path d="M1 1l5.5 5.5L1 12" fill="none" stroke="currentColor" stroke-width="2"/></svg></a>
      </div>
      <form id="vis" novalidate>
        <p class="cap">Agendar visita</p>
        <div class="group">
          <label class="row" for="v-dia"><span class="k">Dia</span><input type="date" id="v-dia" min="${amanha}" value="${amanha}"></label>
          <label class="row" for="v-per"><span class="k">Período</span><select id="v-per"><option>Manhã</option><option>Tarde</option><option>Sábado de manhã</option></select></label>
          <label class="row" for="v-nome"><span class="k">Nome</span><input id="v-nome" autocomplete="name" placeholder="Seu nome"></label>
        </div>
        <p class="err" id="v-err" hidden>Informe o seu nome para agendar.</p>
        <div class="stackb"><button class="btn wa" type="submit">Pedir visita pelo WhatsApp</button></div>
      </form>
      <p class="foot">Valores e disponibilidade sujeitos a alteração. ${i.fotos.length?"":"Imagem ilustrativa."}</p>
    </div>`;
  $("vis").addEventListener("submit",e=>{
    e.preventDefault();
    const nome=$("v-nome").value.trim(); $("v-err").hidden=!!nome; if(!nome) return;
    const dia=$("v-dia").value.split("-").reverse().join("/");
    abrirWA(`Olá, Juan! Quero agendar uma visita ao imóvel ${i.cod} (${i.titulo}).\nDia: ${dia}\nPeríodo: ${$("v-per").value}\nNome: ${nome}`);
  });
  $("share").addEventListener("click",async()=>{
    const url = location.origin + location.pathname + "#" + i.cod;
    const dados = {title:i.titulo, text:`${i.titulo} · ${local(i)} · Santos & Veloso`, url};
    try { if(navigator.share){ await navigator.share(dados); return; } } catch(e){ if(e.name==="AbortError") return; }
    try { await navigator.clipboard.writeText(url); toast("Link copiado"); } catch(e){ toast(url); }
  });
  const gal=$("gal"), dots=$("dots");
  if(dots) gal.addEventListener("scroll",()=>{ const k=Math.round(gal.scrollLeft/gal.clientWidth); [...dots.children].forEach((d,j)=>d.classList.toggle("on",j===k)); },{passive:true});
  const w=$("sheet-wrap"); w.hidden=false; document.body.style.overflow="hidden";
  $("sheet-body").scrollTop=0;
  requestAnimationFrame(()=>requestAnimationFrame(()=>w.classList.add("open")));
  document.title = `${i.titulo} · Santos & Veloso`;
  setTimeout(()=>$("sheet-x").focus({preventScroll:true}),50);
}
function closeSheet(){
  const w=$("sheet-wrap"); if(w.hidden) return;
  w.classList.remove("open"); $("sheet").style.transform="";
  document.body.style.overflow=""; document.title="Santos & Veloso Consultoria Imobiliária";
  if(/^#SV-/i.test(location.hash)) history.replaceState(null,"",location.pathname+(tabAtual!=="imoveis"?"#"+tabAtual:""));
  setTimeout(()=>{ if(!w.classList.contains("open")) w.hidden=true; },380);
}
$("sheet-x").addEventListener("click",closeSheet);
$("sheet-wrap").addEventListener("click",e=>{ if(e.target.id==="sheet-wrap") closeSheet(); });
/* arrastar para baixo para fechar */
(()=>{ let y0=null, dy=0; const s=$("sheet"), g=$("grab");
  g.addEventListener("pointerdown",e=>{ y0=e.clientY; dy=0; s.style.transition="none"; g.setPointerCapture(e.pointerId); });
  g.addEventListener("pointermove",e=>{ if(y0==null) return; dy=Math.max(0,e.clientY-y0); s.style.transform=`translateY(${dy}px)`; });
  const fim=()=>{ if(y0==null) return; y0=null; s.style.transition=""; if(dy>110) closeSheet(); else s.style.transform=""; };
  g.addEventListener("pointerup",fim); g.addEventListener("pointercancel",fim);
})();

function abrirWA(msg, numero){ const u=wa(msg,numero); const w=window.open(u,"_blank","noopener"); if(!w) location.href=u; }

/* rotas: #SV-01 abre a ficha; #financiar etc. abre a aba */
function route(){
  const h = decodeURIComponent(location.hash.slice(1));
  const i = IMOVEIS.find(x=>x.cod.toLowerCase()===h.toLowerCase());
  if(i){ openSheet(i); return; }
  closeSheet();
  if(TABS.includes(h)) showTab(h); else if(!h) showTab(tabAtual);
}
window.addEventListener("hashchange",route);

/* anunciar */
$("vform").addEventListener("submit",e=>{
  e.preventDefault();
  const cid=$("vcid").value.trim(), nome=$("vnome").value.trim();
  $("verr").hidden=!!(cid&&nome); if(!cid||!nome) return;
  abrirWA(`Olá, Leandro! Quero anunciar meu imóvel para venda.\nTipo: ${$("vtipo").value}\nLocal: ${cid}\nDetalhes: ${$("vdesc").value.trim()||"-"}\nNome: ${nome}`, CORRETORES.leandro.numero);
});

/* aplica dados (no carregamento e depois que o painel salva) */
export function aplicarDados(d){
  CONFIG = { whatsapp: d.config?.whatsapp || CONFIG.whatsapp };
  if (CONFIG.whatsapp === "5512974022184") CONFIG.whatsapp = "5512991239366";
  IMOVEIS = Array.isArray(d.imoveis) ? d.imoveis.map(i=>({ fotos:[], specs:[], feat:[], ...i })) : [];
  const sel = $("m-cid"), atual = sel.value;
  sel.innerHTML = '<option value="">Todas as cidades</option>' + [...new Set(IMOVEIS.map(i=>i.cidade))].map(c=>`<option>${esc(c)}</option>`).join("");
  if([...sel.options].some(o=>o.value===atual)) sel.value = atual;
  const mensagem = "Olá! Gostaria de falar sobre um imóvel da Santos & Veloso.";
  $("broker-menu").innerHTML = Object.values(CORRETORES).map(c =>
    `<a class="broker-option" href="${wa(mensagem,c.numero)}" target="_blank" rel="noopener">${esc(c.nome)}<small>${c.exibicao}</small></a>`
  ).join("");
  $("broker-contacts").innerHTML = Object.values(CORRETORES).map(c =>
    `<a class="row ic" href="${wa(mensagem,c.numero)}" target="_blank" rel="noopener"><span class="ico" style="background:#25d366">${WA_ICON}</span><span class="k">WhatsApp · ${esc(c.nome)}</span><span class="v">${c.exibicao}</span></a>`
  ).join("");
  $("broker-toggle").onclick = () => {
    const menu = $("broker-menu"), aberto = menu.hidden;
    menu.hidden = !aberto;
    $("broker-toggle").setAttribute("aria-expanded", String(aberto));
  };
  renderAll();
}
export const dadosAtuais = () => ({ config: { ...CONFIG }, imoveis: structuredClone(IMOVEIS) });

document.addEventListener("click",e=>{
  if(!e.target.closest(".broker-picker")) {
    $("broker-menu").hidden = true;
    $("broker-toggle").setAttribute("aria-expanded","false");
  }
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape") {
    $("broker-menu").hidden = true;
    $("broker-toggle").setAttribute("aria-expanded","false");
  }
});

async function carregar(){
  $("count").textContent = "Carregando imóveis…";
  for (const url of ["/api/imoveis", "imoveis.json"]) {
    try { const r = await fetch(url, { cache: "no-cache" }); if (r.ok) { aplicarDados(await r.json()); route(); return; } } catch (e) {}
  }
  $("count").textContent = "Não foi possível carregar os imóveis. Atualize a página.";
}

/* painel de edição: Ctrl+Alt+L (no Mac, Cmd+Option+L) ou segurar o logo por 2 segundos no celular.
   O atalho só abre a tela de senha; quem confere a senha é o servidor. */
function abrirPainel(){
  if(location.hostname.endsWith(".github.io")){ toast("O painel de edição está disponível na versão Netlify."); return; }
  import("./admin.js").then(m=>m.abrir({ dadosAtuais, aplicarDados, toast }));
}
document.addEventListener("keydown",e=>{
  if(e.code==="KeyL" && e.altKey && (e.ctrlKey||e.metaKey)){ e.preventDefault(); abrirPainel(); }
});
(()=>{ let t; const logo=document.querySelector(".brand-logo");
  if(!logo) return;
  const parar=()=>clearTimeout(t);
  logo.addEventListener("pointerdown",()=>{ t=setTimeout(abrirPainel,2000); });
  ["pointerup","pointerleave","pointercancel"].forEach(ev=>logo.addEventListener(ev,parar));
  logo.addEventListener("contextmenu",e=>e.preventDefault());
})();

carregar();
