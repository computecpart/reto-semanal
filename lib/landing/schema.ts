import { z } from "zod";

/**
 * Landing pages are an ordered list of typed sections (Shopify-style). The
 * admin composes them; the renderer only understands these shapes.
 *
 * Security model:
 * - Images are storage paths inside the `landing-assets` bucket, never URLs.
 * - Calls to action point to fixed internal destinations, never free links.
 * - Rich text is Markdown rendered without raw HTML (see SafeMarkdown).
 */

export const LANDING_ASSET_BUCKET = "landing-assets";
export const MAX_SECTIONS = 30;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const ASSET_PATH_PATTERN = new RegExp(`^campaigns/${UUID}/${UUID}\\.(?:png|jpe?g|webp)$`);

export const ACCENTS = ["cobalto", "esmeralda", "ambar", "carmesi", "violeta", "cian"] as const;
export const SURFACES = ["claro", "oscuro"] as const;
export const CTA_TARGETS = ["registro", "login", "reglas"] as const;

export type Accent = (typeof ACCENTS)[number];
export type Surface = (typeof SURFACES)[number];
export type CtaTarget = (typeof CTA_TARGETS)[number];

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function text(max: number, min = 0) {
  return z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .min(min, min > 0 ? "Este campo es obligatorio." : undefined)
    .refine((value) => !CONTROL_CHARACTERS.test(value), "Contiene caracteres no permitidos.");
}

const assetPath = z
  .string()
  .regex(ASSET_PATH_PATTERN, "La imagen debe subirse desde el editor.");

const image = z
  .object({
    alt: text(160),
    path: assetPath,
  })
  .nullable();

const sectionBase = {
  id: z.string().regex(new RegExp(`^${UUID}$`)),
  visible: z.boolean(),
};

export const heroSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("hero"),
  eyebrow: text(60),
  headline: text(120, 1),
  subtitle: text(320),
  primaryCtaLabel: text(40, 1),
  secondaryCtaLabel: text(40),
  layout: z.enum(["split", "background", "centered"]),
  image,
  // Added after launch: defaults keep previously stored content valid.
  highlights: z.array(text(40, 1)).max(4, "Máximo 4 destacados.").default([]),
  showCountdown: z.boolean().default(true),
});

export const prizeSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("prize"),
  heading: text(80, 1),
  note: text(400),
  image,
});

export const stepsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("steps"),
  heading: text(80, 1),
  steps: z
    .array(z.object({ body: text(240), title: text(60, 1) }))
    .min(1, "Agrega al menos un paso.")
    .max(6, "Máximo 6 pasos."),
});

export const datesSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("dates"),
  heading: text(80, 1),
  note: text(300),
});

export const richTextSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("rich_text"),
  heading: text(80),
  body: text(5000, 1),
});

export const imageBannerSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("image_banner"),
  caption: text(200),
  image: z.object({ alt: text(160, 1), path: assetPath }),
});

export const faqSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("faq"),
  heading: text(80, 1),
  items: z
    .array(z.object({ answer: text(800, 1), question: text(160, 1) }))
    .min(1, "Agrega al menos una pregunta.")
    .max(12, "Máximo 12 preguntas."),
});

export const ctaSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("cta"),
  heading: text(100, 1),
  body: text(300),
  ctaLabel: text(40, 1),
  target: z.enum(CTA_TARGETS),
});

export const rankingPreviewSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("ranking_preview"),
  heading: text(80, 1),
  note: text(240),
  limit: z.number().int().min(3, "Mínimo 3.").max(10, "Máximo 10."),
});

export const upcomingActivitiesSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("upcoming_activities"),
  heading: text(80, 1),
  note: text(240),
});

export const logosSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("logos"),
  heading: text(80),
  includeOrganizer: z.boolean().default(true),
  logos: z.array(z.object({ alt: text(120, 1), path: assetPath })).max(6, "Máximo 6 logos."),
});

export const sectionSchema = z.discriminatedUnion("type", [
  heroSectionSchema,
  prizeSectionSchema,
  stepsSectionSchema,
  datesSectionSchema,
  richTextSectionSchema,
  imageBannerSectionSchema,
  faqSectionSchema,
  ctaSectionSchema,
  rankingPreviewSectionSchema,
  upcomingActivitiesSectionSchema,
  logosSectionSchema,
]);

export type LandingSection = z.infer<typeof sectionSchema>;
export type SectionType = LandingSection["type"];
export type SectionOf<T extends SectionType> = Extract<LandingSection, { type: T }>;

export const SECTION_TYPES = [
  "hero",
  "prize",
  "steps",
  "dates",
  "rich_text",
  "image_banner",
  "faq",
  "cta",
  "ranking_preview",
  "upcoming_activities",
  "logos",
] as const satisfies readonly SectionType[];

export const SECTION_LABELS: Readonly<Record<SectionType, string>> = {
  cta: "Llamada a la acción",
  dates: "Fechas",
  faq: "Preguntas frecuentes",
  hero: "Portada principal (hero)",
  image_banner: "Imagen destacada",
  logos: "Logos y patrocinadores",
  prize: "Premio",
  ranking_preview: "Top del ranking",
  rich_text: "Texto libre",
  steps: "Cómo participar",
  upcoming_activities: "Próximas actividades",
};

export const themeSchema = z.object({
  accent: z.enum(ACCENTS),
  logo: image,
  surface: z.enum(SURFACES),
});

export type LandingTheme = z.infer<typeof themeSchema>;

export const landingContentSchema = z
  .object({
    sections: z.array(sectionSchema).max(MAX_SECTIONS, `Máximo ${MAX_SECTIONS} secciones.`),
    theme: themeSchema,
  })
  .superRefine((content, context) => {
    const ids = new Set<string>();

    content.sections.forEach((section, index) => {
      if (ids.has(section.id)) {
        context.addIssue({ code: "custom", message: "Sección duplicada.", path: ["sections", index] });
      }

      ids.add(section.id);
    });

    if (content.sections.filter((section) => section.type === "hero").length > 1) {
      context.addIssue({
        code: "custom",
        message: "Solo puede haber una portada principal (hero).",
        path: ["sections"],
      });
    }
  });

export type LandingContent = z.infer<typeof landingContentSchema>;

export const DEFAULT_THEME: LandingTheme = { accent: "cobalto", logo: null, surface: "claro" };

/**
 * Lenient parse for rendering stored content: invalid sections are dropped
 * instead of breaking the public page (defense in depth against content that
 * bypassed the editor).
 */
export function readLandingContent(raw: unknown): LandingContent {
  const value = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const theme = themeSchema.safeParse(value.theme);
  const rawSections = Array.isArray(value.sections) ? value.sections.slice(0, MAX_SECTIONS) : [];
  const sections: LandingSection[] = [];

  for (const candidate of rawSections) {
    const parsed = sectionSchema.safeParse(candidate);

    if (parsed.success) {
      sections.push(parsed.data);
    }
  }

  return { sections, theme: theme.success ? theme.data : DEFAULT_THEME };
}
