import { getStore } from "@netlify/blobs";
import { rotaLogin } from "../lib/api.mjs";

const env = k => globalThis.Netlify?.env?.get(k) ?? process.env[k];

export default (req, context) =>
  rotaLogin(req, { store: getStore({ name: "santos-veloso", consistency: "strong" }), env, ip: context.ip });

export const config = { path: "/api/login" };
