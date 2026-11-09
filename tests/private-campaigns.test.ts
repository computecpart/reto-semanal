import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { getSafePostLoginPath } from "@/lib/auth/safe-redirect";
import { campaignChoices, CHOOSER_PATH, chosenDestination } from "@/lib/campaign/choices";
import { getCampaignRpcErrorMessage } from "@/lib/campaign/rpc-errors";
import { campaignBase, isCampaignSlug, parseCampaignPath } from "@/lib/campaign/scope";
import { parseScannedRedeemUrl, redeemUrl } from "@/lib/missions/schema";

const ORIGIN = "https://piensads.app";
const TOKEN = "a".repeat(32);
const migration = readFileSync(
  resolve(process.cwd(), "supabase", "migrations", "20261106000000_private_campaigns.sql"),
  "utf8",
);

describe("URL de una campaña privada", () => {
  it.each([
    ["/c/interna", "/app"],
    ["/c/interna/", "/app"],
    ["/c/interna/ranking", "/app/ranking"],
    ["/c/interna/cuestionarios/abc", "/app/cuestionarios/abc"],
    ["/c/dinamica-interna-2/canjear", "/app/canjear"],
    ["/c/interna/reglas", "/reglas"],
    ["/c/interna/aceptar-reglas", "/aceptar-reglas"],
  ])("%s usa las pantallas de %s", (pathname, internalPath) => {
    expect(parseCampaignPath(pathname)?.internalPath).toBe(internalPath);
  });

  it("nunca reescribe hacia fuera del área del participante", () => {
    for (const rest of ["admin", "admin/rifa", "login", "vista-previa/portada/1"]) {
      expect(parseCampaignPath(`/c/interna/${rest}`)?.internalPath).toBe(`/app/${rest}`);
    }
  });

  it.each(["/app", "/c", "/c/", "/c/Mayus", "/c/con_guion", "/c/a--b", "/cuestionarios/interna", "/admin/c/interna"])(
    "ignora %s",
    (pathname) => {
      expect(parseCampaignPath(pathname)).toBeNull();
    },
  );

  it("valida el identificador y la raíz de cada campaña", () => {
    expect(isCampaignSlug("msi-passport")).toBe(true);
    expect(isCampaignSlug("../admin")).toBe(false);
    expect(isCampaignSlug("x".repeat(61))).toBe(false);
    expect(isCampaignSlug(null)).toBe(false);
    expect(campaignBase(null)).toBe("/app");
    expect(campaignBase("interna")).toBe("/c/interna");
  });
});

describe("elegir campaña al iniciar sesión", () => {
  const interna = { name: "Dinámica interna", slug: "interna", status: "published" as const };

  it("quien solo está en la principal entra directo, sin elegir", () => {
    const choices = campaignChoices({ campaigns: [], primaryName: "MSI Passport", privateOnly: false });

    expect(choices.mustChoose).toBe(false);
    expect(choices.options.map((option) => option.href)).toEqual(["/app"]);
  });

  it("quien se unió con el enlace y está en la principal elige entre las dos", () => {
    const choices = campaignChoices({ campaigns: [interna], primaryName: "MSI Passport", privateOnly: false });

    expect(choices.mustChoose).toBe(true);
    expect(choices.options.map((option) => option.href)).toEqual(["/app", "/c/interna"]);
    expect(choices.joinableMain).toBeNull();
  });

  it("quien solo entró por el enlace ve su campaña y la opción de unirse a la principal", () => {
    const choices = campaignChoices({ campaigns: [interna], primaryName: "MSI Passport", privateOnly: true });

    expect(choices.options.map((option) => option.href)).toEqual(["/c/interna"]);
    expect(choices.joinableMain).toBe("MSI Passport");
    expect(choices.mustChoose).toBe(true);
  });

  it("sin campañas a la vista no hay nada que elegir", () => {
    expect(campaignChoices({ campaigns: [], primaryName: null, privateOnly: false }).mustChoose).toBe(false);
  });

  it("solo acepta como destino el panel de una campaña", () => {
    expect(chosenDestination("/app")).toBe("/app");
    expect(chosenDestination("/c/interna")).toBe("/c/interna");

    for (const value of ["/admin", "/c/interna/ranking", "/c/../admin", "https://evil.example", "//evil.example", "/c/", null, 3]) {
      expect(chosenDestination(value)).toBeNull();
    }
  });

  it("la pantalla de elección es un destino válido tras iniciar sesión", () => {
    expect(getSafePostLoginPath(CHOOSER_PATH)).toBe(CHOOSER_PATH);
  });
});

describe("publicar una segunda campaña", () => {
  it("si choca con la principal, explica cómo tener las dos activas", () => {
    const message = getCampaignRpcErrorMessage({ code: "55000", message: "Ya existe otra campaña publicada." });

    expect(message).toContain("conviértela en campaña privada");
  });
});

describe("redirección tras iniciar sesión", () => {
  it.each([
    "/c/interna",
    "/c/interna/ranking",
    "/c/interna/canjear?c=7F38-Z6DM",
    `/unirse/${TOKEN}/aceptar`,
  ])("conserva %s", (path) => {
    expect(getSafePostLoginPath(path)).toBe(path);
  });

  it.each([
    "/c/interna/../admin",
    "/c/Interna",
    "/c/interna/canjear?c=<script>",
    "/c/interna?x=1",
    "//evil.example/c/interna",
    "/unirse/corto/aceptar",
    `/unirse/${TOKEN}/aceptar/../../admin`,
  ])("rechaza %s", (path) => {
    expect(getSafePostLoginPath(path)).toBe("/app");
  });
});

describe("QR de misiones", () => {
  it("cada campaña tiene su propia página de canje", () => {
    expect(redeemUrl(ORIGIN, "7F38Z6DM")).toBe(`${ORIGIN}/app/canjear?c=7F38-Z6DM`);
    expect(redeemUrl(ORIGIN, "7F38Z6DM", "/c/interna")).toBe(`${ORIGIN}/c/interna/canjear?c=7F38-Z6DM`);
  });

  it("el escáner acepta ambos enlaces propios y nada más", () => {
    expect(parseScannedRedeemUrl(ORIGIN, `${ORIGIN}/c/interna/canjear?c=7F38Z6DM`)).toBe("7F38-Z6DM");
    expect(parseScannedRedeemUrl(ORIGIN, `${ORIGIN}/app/canjear?c=7F38Z6DM`)).toBe("7F38-Z6DM");
    expect(parseScannedRedeemUrl(ORIGIN, `https://evil.example/c/interna/canjear?c=7F38Z6DM`)).toBeNull();
    expect(parseScannedRedeemUrl(ORIGIN, `${ORIGIN}/c/interna/otra?c=7F38Z6DM`)).toBeNull();
  });
});

describe("migración de campañas privadas", () => {
  it("mantiene una sola campaña pública publicada", () => {
    expect(migration).toContain("create unique index campaigns_single_published_public");
    expect(migration).toMatch(/where status = 'published' and not is_private;/);
  });

  it("la cabecera solo sirve a miembros y al equipo", () => {
    const body = migration.slice(migration.indexOf("create function private.requested_campaign_id"));

    expect(body).toContain("public.is_admin()");
    expect(body).toContain("private.user_in_campaign((select auth.uid()), v_campaign.id)");
    expect(body).toContain("and campaigns.is_private");
  });

  it("protege las tres tablas donde se escriben puntos e inscripciones", () => {
    for (const table of ["point_events", "quiz_attempts", "reward_redemptions"]) {
      expect(migration).toContain(`before insert on public.${table}\nfor each row execute function private.enforce_campaign_participation();`);
    }
  });

  it("excluye a las cuentas invitadas del ranking y la rifa de la campaña principal", () => {
    expect(migration).toContain("private.user_in_campaign(roles.user_id, p_campaign_id)");
    expect(migration).toContain("private.user_in_campaign(profiles.id, p_campaign_id)");
  });

  it("no toca el registro cuando no hay invitación", () => {
    expect(migration).toContain("private.campaign_from_invite(v_metadata ->> 'invite_token')");
    expect(migration).toContain("coalesce(v_invited_campaign, private.current_campaign_id())");
  });

  it("no expone el token en la invitación ni en la auditoría", () => {
    const invite = migration.slice(migration.indexOf("create function public.get_campaign_invite"), migration.indexOf("create function public.get_my_campaigns"));

    expect(invite).not.toContain("'invite_token'");
    expect(migration).not.toMatch(/write_audit\([\s\S]{0,200}invite_token/);
  });
});
