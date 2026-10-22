import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SafeMarkdown, safeMarkdownUrl } from "@/components/markdown/safe-markdown";
import { buildLandingAssetPath, landingAssetUrl } from "@/lib/landing/assets";
import { createDefaultLanding, createSection } from "@/lib/landing/defaults";
import {
  ACCENTS,
  SECTION_TYPES,
  landingContentSchema,
  readLandingContent,
} from "@/lib/landing/schema";
import { ACCENT_PALETTES, DARK_SURFACE } from "@/lib/landing/theme";

const CAMPAIGN_ID = "11111111-2222-4333-8444-555555555555";
const ASSET = `campaigns/${CAMPAIGN_ID}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`;

describe("contenido de la portada", () => {
  it("la plantilla por defecto es válida", () => {
    expect(landingContentSchema.safeParse(createDefaultLanding()).success).toBe(true);
  });

  it.each(SECTION_TYPES.filter((type) => type !== "image_banner"))(
    "la sección nueva %s es válida",
    (type) => {
      const content = { sections: [createSection(type)], theme: createDefaultLanding().theme };
      expect(landingContentSchema.safeParse(content).success).toBe(true);
    },
  );

  it("el banner de imagen exige subir una imagen", () => {
    const content = { sections: [createSection("image_banner")], theme: createDefaultLanding().theme };
    expect(landingContentSchema.safeParse(content).success).toBe(false);
  });

  it.each([
    "https://evil.example/x.png",
    "//evil.example/x.png",
    "javascript:alert(1)",
    "campaigns/../../secret.png",
    `campaigns/${CAMPAIGN_ID}/x.svg`,
  ])("rechaza imágenes fuera del bucket: %s", (path) => {
    const hero = { ...createSection("hero"), image: { alt: "x", path } };
    const content = { sections: [hero], theme: createDefaultLanding().theme };

    expect(landingContentSchema.safeParse(content).success).toBe(false);
    expect(landingAssetUrl(path)).toBeNull();
  });

  it("acepta imágenes del bucket propio", () => {
    const hero = { ...createSection("hero"), image: { alt: "Portada", path: ASSET } };
    expect(landingContentSchema.safeParse({ sections: [hero], theme: createDefaultLanding().theme }).success).toBe(true);
  });

  it("solo admite una portada principal", () => {
    const content = { sections: [createSection("hero"), createSection("hero")], theme: createDefaultLanding().theme };
    expect(landingContentSchema.safeParse(content).success).toBe(false);
  });

  it("rechaza tipos de sección y destinos de botón desconocidos", () => {
    const theme = createDefaultLanding().theme;
    expect(landingContentSchema.safeParse({ sections: [{ ...createSection("cta"), target: "https://evil.example" }], theme }).success).toBe(false);
    expect(landingContentSchema.safeParse({ sections: [{ ...createSection("cta"), type: "script" }], theme }).success).toBe(false);
  });

  it("el contenido publicado antes de los campos nuevos sigue siendo válido", () => {
    const hero = createSection("hero");
    const legacyHero = Object.fromEntries(
      Object.entries(hero).filter(([key]) => key !== "highlights" && key !== "showCountdown"),
    );
    const result = readLandingContent({ sections: [legacyHero], theme: createDefaultLanding().theme });
    const parsed = result.sections[0];

    expect(parsed?.type).toBe("hero");
    expect(parsed?.type === "hero" ? parsed.highlights : null).toEqual([]);
    expect(parsed?.type === "hero" ? parsed.showCountdown : null).toBe(true);
  });

  it("los logos solo aceptan imágenes del bucket y como máximo seis", () => {
    const theme = createDefaultLanding().theme;
    const logos = createSection("logos");
    const withLogo = (path: string, count = 1) => ({
      sections: [{ ...logos, logos: Array.from({ length: count }, () => ({ alt: "MSI", path })) }],
      theme,
    });

    expect(landingContentSchema.safeParse(withLogo(ASSET)).success).toBe(true);
    expect(landingContentSchema.safeParse(withLogo("https://evil.example/logo.png")).success).toBe(false);
    expect(landingContentSchema.safeParse(withLogo(ASSET, 7)).success).toBe(false);
  });

  it("la lectura tolerante descarta secciones inválidas sin romper la página", () => {
    const valid = createSection("steps");
    const result = readLandingContent({
      sections: [valid, { type: "hero", headline: 42 }, "basura"],
      theme: { accent: "neón" },
    });

    expect(result.sections).toEqual([valid]);
    expect(result.theme.accent).toBe("cobalto");
  });

  it("genera rutas de imagen únicas solo para formatos permitidos", () => {
    const first = buildLandingAssetPath(CAMPAIGN_ID, "image/png");
    const second = buildLandingAssetPath(CAMPAIGN_ID, "image/png");

    expect(first).toMatch(/\.png$/);
    expect(first).not.toBe(second);
    expect(buildLandingAssetPath(CAMPAIGN_ID, "image/svg+xml")).toBeNull();
    expect(buildLandingAssetPath(CAMPAIGN_ID, "text/html")).toBeNull();
  });
});

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

describe("paleta del tema", () => {
  it.each(ACCENTS)("el acento %s cumple contraste AA con su texto", (accent) => {
    const palette = ACCENT_PALETTES[accent];
    expect(contrast(palette.accent, palette.contrast)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(ACCENTS)("el acento %s es legible sobre el fondo oscuro", (accent) => {
    const palette = ACCENT_PALETTES[accent];
    expect(contrast(palette.onDark, DARK_SURFACE.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.onDark, DARK_SURFACE.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", DARK_SURFACE.card)).toBeGreaterThanOrEqual(7);
  });
});

describe("Markdown seguro", () => {
  function render(markdown: string): string {
    return renderToStaticMarkup(createElement(SafeMarkdown, null, markdown));
  }

  it("descarta HTML crudo y scripts", () => {
    const html = render('Hola <script>alert(1)</script> <b onclick="x()">x</b>');

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
  });

  it("neutraliza enlaces peligrosos y conserva los seguros", () => {
    expect(render("[x](javascript:alert(1))")).not.toContain("javascript:");
    expect(render("[x](https://ejemplo.com)")).toContain('href="https://ejemplo.com"');
    expect(render("[reglas](/reglas)")).toContain('href="/reglas"');
  });

  it("no carga imágenes externas", () => {
    expect(render("![rastreo](https://tracker.example/pixel.png)")).not.toContain("<img");
  });

  it.each([
    ["https://a.example", "https://a.example"],
    ["mailto:a@b.co", "mailto:a@b.co"],
    ["/reglas", "/reglas"],
    ["//evil.example", ""],
    ["data:text/html;base64,xx", ""],
    ["JAVASCRIPT:alert(1)", ""],
  ])("filtra la URL %s", (input, expected) => {
    expect(safeMarkdownUrl(input)).toBe(expected);
  });
});
