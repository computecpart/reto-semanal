// Herramienta administrativa sobre la Management API de Supabase.
// Lee SUPABASE_ACCESS_TOKEN y SUPABASE_PROJECT_REF de .env.seed.local.
//
//   node scripts/supabase-mgmt.mjs query "select ..."      SQL de solo lectura
//   node scripts/supabase-mgmt.mjs auth:get [clave ...]    Configuración de Auth (secretos ocultos)
//   node scripts/supabase-mgmt.mjs auth:patch archivo.json Cambia la configuración de Auth
//
// Los cambios de esquema SIEMPRE van por supabase/migrations + `supabase db push`,
// nunca por `query`. El proyecto enlazado es PRODUCCIÓN.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envFile = resolve(import.meta.dirname, "..", ".env.seed.local");

if (!existsSync(envFile)) {
  console.error("No existe .env.seed.local.");
  process.exit(1);
}

process.loadEnvFile(envFile);

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const ref = process.env.SUPABASE_PROJECT_REF?.trim();

if (!token || !ref) {
  console.error("Faltan SUPABASE_ACCESS_TOKEN o SUPABASE_PROJECT_REF en .env.seed.local.");
  process.exit(1);
}

const WRITE_SQL = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|comment|vacuum|reindex|cluster|copy|call|do)\b/i;
const SECRET_KEY = /(secret|pass|password|key|token)$/i;

async function api(path, init = {}) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(response.status, body);
    process.exit(1);
  }

  return body;
}

function printConfig(config, keys) {
  const selected = keys.length > 0 ? keys : Object.keys(config).sort();

  for (const key of selected) {
    const value = config[key];
    const shown = SECRET_KEY.test(key) && value ? "<oculto>" : JSON.stringify(value);
    console.log(`${key.padEnd(52)} ${shown}`);
  }
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "query": {
    const sql = args.join(" ");

    if (!sql) {
      console.error('Uso: query "select ..."');
      process.exit(1);
    }

    if (WRITE_SQL.test(sql)) {
      console.error("Rechazado: `query` es solo de lectura. Usa una migración.");
      process.exit(1);
    }

    console.log(JSON.stringify(await api("/database/query", {
      body: JSON.stringify({ query: sql }),
      method: "POST",
    }), null, 2));
    break;
  }
  case "auth:get":
    printConfig(await api("/config/auth"), args);
    break;
  case "auth:patch": {
    if (!args[0]) {
      console.error("Uso: auth:patch archivo.json");
      process.exit(1);
    }

    const patch = JSON.parse(readFileSync(args[0], "utf8"));
    const updated = await api("/config/auth", { body: JSON.stringify(patch), method: "PATCH" });
    printConfig(updated, Object.keys(patch));
    break;
  }
  default:
    console.error("Comandos: query, auth:get, auth:patch");
    process.exit(1);
}
