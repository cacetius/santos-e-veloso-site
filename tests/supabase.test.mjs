import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stored = new Map();
globalThis.window = {
  SV_SUPABASE_CONFIG: {
    url: "https://demo-project.supabase.co",
    anonKey: "sb_publishable_test_key"
  }
};
globalThis.sessionStorage = {
  getItem: key => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: key => stored.delete(key)
};

const {
  getSiteContent,
  hasSession,
  isSupabaseConfigured,
  saveSiteContent,
  signIn,
  signOut,
  uploadSitePhoto
} = await import("../public/supabase.js");
const originalFetch = globalThis.fetch;
const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" }
});
const clear = () => stored.clear();

test("public catalog reads use only the public key", async () => {
  clear();
  const data = { imoveis: [{ cod: "SV-01" }] };
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /\/rest\/v1\/site_content\?select=data&id=eq\.1$/);
    assert.equal(options.headers.apikey, "sb_publishable_test_key");
    assert.equal(options.headers.authorization, "Bearer sb_publishable_test_key");
    return response([{ data }]);
  };
  try {
    assert.equal(isSupabaseConfigured(), true);
    assert.deepEqual(await getSiteContent(), data);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin login saves using the authenticated user's token", async () => {
  clear();
  const data = { config: { whatsapp: "5512991239366" }, imoveis: [] };
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/auth/v1/token?grant_type=password")) {
      assert.deepEqual(JSON.parse(options.body), { email: "admin@example.com", password: "a-strong-password" });
      return response({ access_token: "user-access-token", refresh_token: "user-refresh-token", expires_in: 3600 });
    }
    return response([{ id: 1, data }]);
  };
  try {
    await signIn(" Admin@Example.com ", "a-strong-password");
    assert.equal(hasSession(), true);
    assert.deepEqual(await saveSiteContent(data), data);
    assert.equal(calls[1].options.headers.authorization, "Bearer user-access-token");
    assert.deepEqual(JSON.parse(calls[1].options.body), { data });
  } finally {
    globalThis.fetch = originalFetch;
    clear();
  }
});

test("expired admin sessions refresh before a write", async () => {
  clear();
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("grant_type=password")) {
      return response({ access_token: "old-token", refresh_token: "refresh-token", expires_in: 0 });
    }
    if (String(url).includes("grant_type=refresh_token")) {
      return response({ access_token: "fresh-token", refresh_token: "rotated-refresh", expires_in: 3600 });
    }
    return response([{ id: 1, data: { imoveis: [] } }]);
  };
  try {
    await signIn("admin@example.com", "a-strong-password");
    await saveSiteContent({ imoveis: [] });
    assert.equal(calls[1].options.headers.apikey, "sb_publishable_test_key");
    assert.equal(calls[2].options.headers.authorization, "Bearer fresh-token");
  } finally {
    globalThis.fetch = originalFetch;
    clear();
  }
});

test("photo uploads require an authenticated session and use the public bucket URL", async () => {
  clear();
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("grant_type=password")) {
      return response({ access_token: "user-access-token", refresh_token: "user-refresh-token", expires_in: 3600 });
    }
    assert.match(String(url), /\/storage\/v1\/object\/property-photos\/[0-9a-f-]+\.jpg$/);
    assert.equal(options.headers.authorization, "Bearer user-access-token");
    assert.equal(options.headers["content-type"], "image/jpeg");
    return response({ Key: "property-photos/photo.jpg" });
  };
  try {
    await signIn("admin@example.com", "a-strong-password");
    const url = await uploadSitePhoto(new Blob(["jpeg"], { type: "image/jpeg" }));
    assert.match(url, /^https:\/\/demo-project\.supabase\.co\/storage\/v1\/object\/public\/property-photos\/[0-9a-f-]+\.jpg$/);
  } finally {
    globalThis.fetch = originalFetch;
    clear();
  }
});

test("logout revokes and clears the local session", async () => {
  clear();
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("grant_type=password")) {
      return response({ access_token: "user-access-token", refresh_token: "user-refresh-token", expires_in: 3600 });
    }
    assert.match(String(url), /\/auth\/v1\/logout\?scope=local$/);
    assert.equal(options.headers.authorization, "Bearer user-access-token");
    return new Response(null, { status: 204 });
  };
  try {
    await signIn("admin@example.com", "a-strong-password");
    await signOut();
    assert.equal(hasSession(), false);
  } finally {
    globalThis.fetch = originalFetch;
    clear();
  }
});

test("database policies require administrator membership for every write", () => {
  const sql = readFileSync(new URL("../supabase/setup.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table public\.site_content enable row level security/i);
  assert.match(sql, /alter table public\.site_admins enable row level security/i);
  assert.match(sql, /create policy "Admins can update site content"[\s\S]*?for update[\s\S]*?public\.site_admins/i);
  assert.match(sql, /create policy "Admins can upload property photos"[\s\S]*?for insert[\s\S]*?public\.site_admins/i);
  assert.doesNotMatch(sql, /create policy[^;]*on public\.site_content for insert/i);
});
