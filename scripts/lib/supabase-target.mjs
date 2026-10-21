// Pure guards for administrative scripts. They never perform I/O so they can
// be unit-tested without credentials.

const ENVIRONMENTS = new Set(["local", "demo", "production"]);
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;

export function projectRefFromUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("SUPABASE_URL no es una URL válida.");
  }

  if (["127.0.0.1", "localhost"].includes(url.hostname)) {
    return "local";
  }

  const match = /^([a-z0-9]+)\.supabase\.co$/.exec(url.hostname);

  if (url.protocol !== "https:" || !match || !PROJECT_REF_PATTERN.test(match[1])) {
    throw new Error("SUPABASE_URL debe ser https://<project-ref>.supabase.co o un entorno local.");
  }

  return match[1];
}

/**
 * Validates that every independent signal names the same project before a
 * privileged script runs: URL, declared ref, expected ref and a CLI flag.
 */
export function resolveBootstrapTarget(environment, argv) {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_PROJECT_REF",
    "EXPECTED_SUPABASE_PROJECT_REF",
    "SUPABASE_ENVIRONMENT",
    "SEED_SUPERADMIN_EMAIL",
  ];
  const missing = required.filter((name) => !environment[name]?.trim());

  if (missing.length > 0) {
    throw new Error(`Faltan variables en .env.seed.local: ${missing.join(", ")}`);
  }

  if (Object.keys(environment).some((name) => /^NEXT_PUBLIC_.*(?:SECRET|SERVICE_ROLE)/i.test(name))) {
    throw new Error("Se detectó un secreto con prefijo NEXT_PUBLIC_. Corrige el entorno.");
  }

  const kind = environment.SUPABASE_ENVIRONMENT.trim();

  if (!ENVIRONMENTS.has(kind)) {
    throw new Error("SUPABASE_ENVIRONMENT debe ser local, demo o production.");
  }

  const urlRef = projectRefFromUrl(environment.SUPABASE_URL.trim());
  const declaredRef = environment.SUPABASE_PROJECT_REF.trim();
  const expectedRef = environment.EXPECTED_SUPABASE_PROJECT_REF.trim();

  if (urlRef !== declaredRef || declaredRef !== expectedRef) {
    throw new Error(
      "SUPABASE_URL, SUPABASE_PROJECT_REF y EXPECTED_SUPABASE_PROJECT_REF no apuntan al mismo proyecto.",
    );
  }

  const confirmation = argv
    .find((argument) => argument.startsWith("--confirm="))
    ?.slice("--confirm=".length);

  if (confirmation !== declaredRef) {
    throw new Error(`Confirma el destino explícitamente con --confirm=${declaredRef}`);
  }

  if (kind === "production" && !argv.includes("--allow-production")) {
    throw new Error("Producción se rechaza por defecto. Añade --allow-production solo con autorización.");
  }

  const email = environment.SEED_SUPERADMIN_EMAIL.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("SEED_SUPERADMIN_EMAIL no es un correo válido.");
  }

  return {
    email,
    environment: kind,
    projectRef: declaredRef,
    secretKey: environment.SUPABASE_SECRET_KEY.trim(),
    url: environment.SUPABASE_URL.trim(),
  };
}
