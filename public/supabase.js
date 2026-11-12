const CONFIG = window.SV_SUPABASE_CONFIG || {};
const SESSION_KEY = "sv-supabase-session";
const BASE_URL = String(CONFIG.url || "").replace(/\/+$/, "");

export function isSupabaseConfigured() {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(BASE_URL) && Boolean(CONFIG.anonKey);
}

function readSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    return value?.access_token && value?.refresh_token && Number.isFinite(value.expires_at) ? value : null;
  } catch {
    return null;
  }
}

function writeSession(value) {
  if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  else sessionStorage.removeItem(SESSION_KEY);
}

function errorFrom(body, fallback) {
  const message = body?.msg || body?.message || body?.error_description || body?.error || fallback;
  const error = new Error(message);
  error.code = body?.code || body?.error || "";
  return error;
}

async function responseBody(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function refreshSession(session) {
  const response = await fetch(`${BASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: CONFIG.anonKey, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  const body = await responseBody(response);
  if (!response.ok || !body.access_token || !body.refresh_token) {
    writeSession(null);
    const error = errorFrom(body, "Sua sessão expirou. Entre novamente.");
    error.code = "SESSION_EXPIRED";
    throw error;
  }
  const updated = { ...body, expires_at: body.expires_at || Math.floor(Date.now() / 1000) + body.expires_in };
  writeSession(updated);
  return updated;
}

async function validSession() {
  const session = readSession();
  if (!session) {
    const error = new Error("Sua sessão expirou. Entre novamente.");
    error.code = "SESSION_EXPIRED";
    throw error;
  }
  if (session.expires_at * 1000 <= Date.now() + 60_000) return refreshSession(session);
  return session;
}

export function hasSession() {
  const session = readSession();
  return Boolean(session && session.expires_at * 1000 > Date.now());
}

export async function signIn(email, password) {
  if (!isSupabaseConfigured()) throw new Error("Painel ainda não configurado. Configure o projeto Supabase antes de entrar.");
  const response = await fetch(`${BASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: CONFIG.anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password })
  });
  const body = await responseBody(response);
  if (!response.ok || !body.access_token || !body.refresh_token) {
    const invalidCredentials = response.status === 400 || response.status === 401;
    throw new Error(invalidCredentials ? "E-mail ou senha incorretos." : body.message || "Não foi possível autenticar. Verifique a configuração do Supabase.");
  }
  writeSession({ ...body, expires_at: body.expires_at || Math.floor(Date.now() / 1000) + body.expires_in });
}

export async function signOut() {
  const session = readSession();
  writeSession(null);
  if (!session || !isSupabaseConfigured()) return;
  const response = await fetch(`${BASE_URL}/auth/v1/logout?scope=local`, {
    method: "POST",
    headers: { apikey: CONFIG.anonKey, authorization: `Bearer ${session.access_token}` }
  });
  if (!response.ok) throw new Error("A sessão deste navegador foi encerrada, mas não foi possível revogar a sessão remota.");
}

async function request(path, { auth = false, ...options } = {}) {
  if (!isSupabaseConfigured()) throw new Error("Painel ainda não configurado. Configure o projeto Supabase antes de entrar.");
  const headers = { apikey: CONFIG.anonKey, ...(options.headers || {}) };
  if (auth) headers.authorization = `Bearer ${(await validSession()).access_token}`;
  else headers.authorization = `Bearer ${CONFIG.anonKey}`;
  const response = await fetch(`${BASE_URL}/${path}`, { ...options, headers });
  const body = await responseBody(response);
  if (response.status === 401 && auth) {
    writeSession(null);
    const error = new Error("Sua sessão expirou. Entre novamente.");
    error.code = "SESSION_EXPIRED";
    throw error;
  }
  if (!response.ok) {
    if (response.status === 403) throw new Error("Esta conta não tem permissão para editar. Confira se o usuário está cadastrado como administrador no Supabase.");
    throw errorFrom(body, `Falha no Supabase (${response.status}).`);
  }
  return body;
}

export async function getSiteContent() {
  const rows = await request("rest/v1/site_content?select=data&id=eq.1", { cache: "no-store" });
  return Array.isArray(rows) ? rows[0]?.data || null : null;
}

export async function saveSiteContent(data) {
  const rows = await request("rest/v1/site_content?id=eq.1", {
    auth: true,
    method: "PATCH",
    headers: { "content-type": "application/json", prefer: "return=representation" },
    body: JSON.stringify({ data })
  });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("O conteúdo não foi salvo. Confira as permissões e a linha inicial no Supabase.");
  }
  return rows[0].data;
}

export async function uploadSitePhoto(blob) {
  if (blob.size > 4 * 1024 * 1024) throw new Error("A foto ficou maior que 4 MB depois da redução.");
  const name = `${crypto.randomUUID()}.jpg`;
  const session = await validSession();
  const response = await fetch(`${BASE_URL}/storage/v1/object/property-photos/${name}`, {
    method: "POST",
    headers: {
      apikey: CONFIG.anonKey,
      authorization: `Bearer ${session.access_token}`,
      "content-type": "image/jpeg",
      "x-upsert": "false"
    },
    body: blob
  });
  const body = await responseBody(response);
  if (!response.ok) {
    if (response.status === 401) {
      writeSession(null);
      const error = new Error("Sua sessão expirou. Entre novamente.");
      error.code = "SESSION_EXPIRED";
      throw error;
    }
    if (response.status === 403) throw new Error("Esta conta não tem permissão para enviar fotos. Confira o cadastro de administrador no Supabase.");
    throw errorFrom(body, `Não foi possível enviar a foto (${response.status}).`);
  }
  return `${BASE_URL}/storage/v1/object/public/property-photos/${name}`;
}
