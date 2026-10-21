// Promueve, una única vez, al primer superadmin de un proyecto Supabase.
//
// Requisitos previos:
//   1. La persona se registró en la app, verificó su correo y tiene perfil completo.
//   2. .env.seed.local contiene las variables de .env.seed.example.
//
// Uso: npm run bootstrap:superadmin -- --confirm=<project-ref> [--allow-production]
//
// El RPC public.bootstrap_first_superadmin solo acepta la credencial
// service_role, es idempotente y se niega si ya existe un superadmin.
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { resolveBootstrapTarget } from "./lib/supabase-target.mjs";

const envFile = resolve(import.meta.dirname, "..", ".env.seed.local");

if (!existsSync(envFile)) {
  console.error("No existe .env.seed.local. Cópialo desde .env.seed.example y complétalo.");
  process.exit(1);
}

// Only the isolated seed file is loaded; .env.local is never read here.
process.loadEnvFile(envFile);

let target;

try {
  target = resolveBootstrapTarget(process.env, process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

console.log(`Proyecto: ${target.projectRef} (${target.environment})`);
console.log(`Usuario objetivo: ${target.email}`);

const supabase = createClient(target.url, target.secretKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});

const { data, error } = await supabase.rpc("bootstrap_first_superadmin", {
  p_email: target.email,
});

if (error) {
  console.error(`Bootstrap rechazado: ${error.message}`);
  process.exit(1);
}

console.log(`Listo. El usuario ${data} es superadmin. Cierra y vuelve a abrir su sesión.`);
