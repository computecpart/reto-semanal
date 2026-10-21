import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const forbiddenName = /^NEXT_PUBLIC_.*(?:SECRET|SERVICE_ROLE)/i;
const projectRoot = resolve(import.meta.dirname, "..");
const violations = new Set(
  Object.keys(process.env)
    .filter((name) => forbiddenName.test(name))
    .map((name) => `${name} (entorno del proceso)`),
);

const environmentFiles = readdirSync(projectRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /^\.env(?:\..+)?$/.test(entry.name))
  .map((entry) => entry.name);

for (const fileName of environmentFiles) {
  const lines = readFileSync(resolve(projectRoot, fileName), "utf8").split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/,
    );
    const variableName = match?.[1];

    if (variableName && forbiddenName.test(variableName)) {
      violations.add(`${variableName} (${fileName})`);
    }
  }
}

if (violations.size > 0) {
  throw new Error(
    `Se detectaron nombres de secretos públicos prohibidos: ${[...violations].join(", ")}`,
  );
}

