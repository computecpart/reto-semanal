"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState, useTransition } from "react";

import { FormStatus, fieldClassName, labelClassName } from "@/components/admin/admin-ui";
import {
  publishLandingAction,
  restoreLandingVersionAction,
  saveLandingDraftAction,
} from "@/lib/campaign/actions";
import { buildLandingAssetPath, landingAssetUrl } from "@/lib/landing/assets";
import { createSection } from "@/lib/landing/defaults";
import {
  ACCENTS,
  CTA_TARGETS,
  IMAGE_MIME_TYPES,
  LANDING_ASSET_BUCKET,
  MAX_IMAGE_BYTES,
  MAX_SECTIONS,
  SECTION_LABELS,
  SECTION_TYPES,
  landingContentSchema,
  type LandingContent,
  type LandingSection,
  type LandingTheme,
  type SectionOf,
  type SectionType,
} from "@/lib/landing/schema";
import { ACCENT_PALETTES } from "@/lib/landing/theme";
import { createClient } from "@/lib/supabase/client";

type Notice = { message: string; tone: "error" | "info" | "success" } | null;
type AutosaveState = "idle" | "saving" | "saved" | "invalid" | "error";

const AUTOSAVE_DELAY_MS = 800;
type ImageValue = { alt: string; path: string } | null;

const buttonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400";

function Field({ children, hint, id, label }: { children: ReactNode; hint?: string; id: string; label: string }) {
  return (
    <div>
      <label className={labelClassName} htmlFor={id}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function TextInput({
  id,
  label,
  max,
  onChange,
  value,
  hint,
}: {
  hint?: string;
  id: string;
  label: string;
  max: number;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Field hint={hint} id={id} label={label}>
      <input className={fieldClassName} id={id} maxLength={max} onChange={(event) => onChange(event.target.value)} value={value} />
    </Field>
  );
}

function TextArea({
  id,
  label,
  max,
  onChange,
  rows = 3,
  value,
  hint,
}: {
  hint?: string;
  id: string;
  label: string;
  max: number;
  onChange: (value: string) => void;
  rows?: number;
  value: string;
}) {
  return (
    <Field hint={hint} id={id} label={label}>
      <textarea className={fieldClassName} id={id} maxLength={max} onChange={(event) => onChange(event.target.value)} rows={rows} value={value} />
    </Field>
  );
}

function ImageField({
  campaignId,
  id,
  label,
  onChange,
  required = false,
  value,
}: {
  campaignId: string;
  id: string;
  label: string;
  onChange: (value: ImageValue) => void;
  required?: boolean;
  value: ImageValue;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const url = landingAssetUrl(value?.path);

  async function upload(file: File) {
    setError("");

    if (!IMAGE_MIME_TYPES.some((type) => type === file.type)) {
      setError("Formato no permitido. Usa PNG, JPEG o WebP.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setError("La imagen supera 3 MB.");
      return;
    }

    const path = buildLandingAssetPath(campaignId, file.type);

    if (!path) {
      setError("No fue posible preparar la imagen.");
      return;
    }

    setUploading(true);
    // Storage RLS only lets administrators write into this bucket.
    const { error: uploadError } = await createClient()
      .storage.from(LANDING_ASSET_BUCKET)
      .upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: false });
    setUploading(false);

    if (uploadError) {
      setError("No fue posible subir la imagen. Verifica tu sesión e inténtalo de nuevo.");
      return;
    }

    onChange({ alt: value?.alt ?? "", path });
  }

  return (
    <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-800">
        {label}
        {required ? "" : " (opcional)"}
      </legend>
      {url ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-100">
          <Image alt="" className="object-contain" fill sizes="400px" src={url} unoptimized />
        </div>
      ) : (
        <p className="text-sm text-slate-500">Sin imagen.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className={`${buttonClassName} cursor-pointer`}>
          {uploading ? "Subiendo…" : url ? "Reemplazar imagen" : "Subir imagen"}
          <input
            accept={IMAGE_MIME_TYPES.join(",")}
            className="sr-only"
            disabled={uploading}
            id={id}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";

              if (file) {
                void upload(file);
              }
            }}
            type="file"
          />
        </label>
        {url && !required ? (
          <button className={buttonClassName} onClick={() => onChange(null)} type="button">
            Quitar imagen
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {value?.path ? (
        <TextInput
          hint="Describe la imagen para lectores de pantalla."
          id={`${id}-alt`}
          label="Texto alternativo"
          max={160}
          onChange={(alt) => onChange({ alt, path: value.path })}
          value={value.alt}
        />
      ) : null}
      <p className="text-xs text-slate-500">PNG, JPEG o WebP de hasta 3 MB.</p>
    </fieldset>
  );
}

function SectionForm({
  campaignId,
  onChange,
  section,
}: {
  campaignId: string;
  onChange: (section: LandingSection) => void;
  section: LandingSection;
}) {
  const id = section.id;

  switch (section.type) {
    case "hero": {
      const set = (patch: Partial<SectionOf<"hero">>) => onChange({ ...section, ...patch });
      return (
        <div className="space-y-4">
          <TextInput id={`${id}-eyebrow`} label="Etiqueta superior" max={60} onChange={(eyebrow) => set({ eyebrow })} value={section.eyebrow} />
          <TextInput id={`${id}-headline`} label="Titular" max={120} onChange={(headline) => set({ headline })} value={section.headline} />
          <TextArea id={`${id}-subtitle`} label="Subtítulo" max={320} onChange={(subtitle) => set({ subtitle })} value={section.subtitle} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput id={`${id}-cta1`} label="Botón principal (registro)" max={40} onChange={(primaryCtaLabel) => set({ primaryCtaLabel })} value={section.primaryCtaLabel} />
            <TextInput hint="Vacío para ocultarlo." id={`${id}-cta2`} label="Botón secundario (login)" max={40} onChange={(secondaryCtaLabel) => set({ secondaryCtaLabel })} value={section.secondaryCtaLabel} />
          </div>
          <Field id={`${id}-layout`} label="Diseño">
            <select className={fieldClassName} id={`${id}-layout`} onChange={(event) => set({ layout: event.target.value as SectionOf<"hero">["layout"] })} value={section.layout}>
              <option value="split">Texto e imagen lado a lado</option>
              <option value="background">Imagen de fondo a pantalla completa</option>
              <option value="centered">Centrado con imagen debajo</option>
            </select>
          </Field>
          <ImageField campaignId={campaignId} id={`${id}-image`} label="Imagen" onChange={(image) => set({ image })} value={section.image} />
        </div>
      );
    }
    case "prize": {
      const set = (patch: Partial<SectionOf<"prize">>) => onChange({ ...section, ...patch });
      return (
        <div className="space-y-4">
          <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
            El título y la descripción del premio se editan en la pestaña «Datos» de la campaña.
          </p>
          <TextInput id={`${id}-heading`} label="Encabezado" max={80} onChange={(heading) => set({ heading })} value={section.heading} />
          <TextArea id={`${id}-note`} label="Nota adicional" max={400} onChange={(note) => set({ note })} value={section.note} />
          <ImageField campaignId={campaignId} id={`${id}-image`} label="Foto del premio" onChange={(image) => set({ image })} value={section.image} />
        </div>
      );
    }
    case "steps": {
      const set = (patch: Partial<SectionOf<"steps">>) => onChange({ ...section, ...patch });
      const setStep = (index: number, patch: Partial<SectionOf<"steps">["steps"][number]>) =>
        set({ steps: section.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)) });
      return (
        <div className="space-y-4">
          <TextInput id={`${id}-heading`} label="Encabezado" max={80} onChange={(heading) => set({ heading })} value={section.heading} />
          {section.steps.map((step, index) => (
            <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4" key={index}>
              <legend className="px-1 text-sm font-semibold">Paso {index + 1}</legend>
              <TextInput id={`${id}-step-${index}-title`} label="Título" max={60} onChange={(title) => setStep(index, { title })} value={step.title} />
              <TextArea id={`${id}-step-${index}-body`} label="Descripción" max={240} onChange={(body) => setStep(index, { body })} rows={2} value={step.body} />
              <button className={buttonClassName} disabled={section.steps.length <= 1} onClick={() => set({ steps: section.steps.filter((_, i) => i !== index) })} type="button">
                Quitar paso
              </button>
            </fieldset>
          ))}
          <button className={buttonClassName} disabled={section.steps.length >= 6} onClick={() => set({ steps: [...section.steps, { body: "", title: "Nuevo paso" }] })} type="button">
            Añadir paso
          </button>
        </div>
      );
    }
    case "dates": {
      const set = (patch: Partial<SectionOf<"dates">>) => onChange({ ...section, ...patch });
      return (
        <div className="space-y-4">
          <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
            Las fechas se toman de los datos de la campaña.
          </p>
          <TextInput id={`${id}-heading`} label="Encabezado" max={80} onChange={(heading) => set({ heading })} value={section.heading} />
          <TextArea id={`${id}-note`} label="Nota" max={300} onChange={(note) => set({ note })} value={section.note} />
        </div>
      );
    }
    case "rich_text": {
      const set = (patch: Partial<SectionOf<"rich_text">>) => onChange({ ...section, ...patch });
      return (
        <div className="space-y-4">
          <TextInput hint="Opcional." id={`${id}-heading`} label="Encabezado" max={80} onChange={(heading) => set({ heading })} value={section.heading} />
          <TextArea hint="Markdown: ## títulos, - listas, **negritas**, [enlace](https://...). Sin HTML." id={`${id}-body`} label="Contenido" max={5000} onChange={(body) => set({ body })} rows={10} value={section.body} />
        </div>
      );
    }
    case "image_banner": {
      const set = (patch: Partial<SectionOf<"image_banner">>) => onChange({ ...section, ...patch });
      return (
        <div className="space-y-4">
          <ImageField
            campaignId={campaignId}
            id={`${id}-image`}
            label="Imagen"
            onChange={(image) => set({ image: image ?? { alt: "", path: "" } })}
            required
            value={section.image.path ? section.image : null}
          />
          <TextInput id={`${id}-caption`} label="Pie de imagen" max={200} onChange={(caption) => set({ caption })} value={section.caption} />
        </div>
      );
    }
    case "faq": {
      const set = (patch: Partial<SectionOf<"faq">>) => onChange({ ...section, ...patch });
      const setItem = (index: number, patch: Partial<SectionOf<"faq">["items"][number]>) =>
        set({ items: section.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
      return (
        <div className="space-y-4">
          <TextInput id={`${id}-heading`} label="Encabezado" max={80} onChange={(heading) => set({ heading })} value={section.heading} />
          {section.items.map((item, index) => (
            <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4" key={index}>
              <legend className="px-1 text-sm font-semibold">Pregunta {index + 1}</legend>
              <TextInput id={`${id}-q-${index}`} label="Pregunta" max={160} onChange={(question) => setItem(index, { question })} value={item.question} />
              <TextArea id={`${id}-a-${index}`} label="Respuesta" max={800} onChange={(answer) => setItem(index, { answer })} value={item.answer} />
              <button className={buttonClassName} disabled={section.items.length <= 1} onClick={() => set({ items: section.items.filter((_, i) => i !== index) })} type="button">
                Quitar pregunta
              </button>
            </fieldset>
          ))}
          <button className={buttonClassName} disabled={section.items.length >= 12} onClick={() => set({ items: [...section.items, { answer: "Respuesta", question: "Nueva pregunta" }] })} type="button">
            Añadir pregunta
          </button>
        </div>
      );
    }
    case "ranking_preview": {
      const set = (patch: Partial<SectionOf<"ranking_preview">>) => onChange({ ...section, ...patch });
      return (
        <div className="space-y-4">
          <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
            Solo aparece si en «Ranking y puntos» el ranking está visible y con audiencia pública.
          </p>
          <TextInput id={`${id}-heading`} label="Encabezado" max={80} onChange={(heading) => set({ heading })} value={section.heading} />
          <TextArea id={`${id}-note`} label="Nota" max={240} onChange={(note) => set({ note })} value={section.note} />
          <Field id={`${id}-limit`} label="Cuántos participantes mostrar">
            <select className={fieldClassName} id={`${id}-limit`} onChange={(event) => set({ limit: Number(event.target.value) })} value={section.limit}>
              {[3, 5, 10].map((value) => (
                <option key={value} value={value}>
                  Top {value}
                </option>
              ))}
            </select>
          </Field>
        </div>
      );
    }
    case "cta": {
      const set = (patch: Partial<SectionOf<"cta">>) => onChange({ ...section, ...patch });
      return (
        <div className="space-y-4">
          <TextInput id={`${id}-heading`} label="Titular" max={100} onChange={(heading) => set({ heading })} value={section.heading} />
          <TextArea id={`${id}-body`} label="Texto" max={300} onChange={(body) => set({ body })} value={section.body} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput id={`${id}-label`} label="Texto del botón" max={40} onChange={(ctaLabel) => set({ ctaLabel })} value={section.ctaLabel} />
            <Field id={`${id}-target`} label="Destino del botón">
              <select className={fieldClassName} id={`${id}-target`} onChange={(event) => set({ target: event.target.value as (typeof CTA_TARGETS)[number] })} value={section.target}>
                <option value="registro">Registro</option>
                <option value="login">Iniciar sesión</option>
                <option value="reglas">Reglas</option>
              </select>
            </Field>
          </div>
        </div>
      );
    }
  }
}

function ThemeForm({
  campaignId,
  onChange,
  theme,
}: {
  campaignId: string;
  onChange: (theme: LandingTheme) => void;
  theme: LandingTheme;
}) {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className={labelClassName}>Color de acento</legend>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ACCENTS.map((accent) => (
            <label className="cursor-pointer" key={accent}>
              <input checked={theme.accent === accent} className="peer sr-only" name="accent" onChange={() => onChange({ ...theme, accent })} type="radio" />
              <span className="flex items-center gap-3 rounded-xl border-2 border-slate-200 p-3 text-sm font-semibold peer-checked:border-sky-700 peer-focus-visible:outline-2 peer-focus-visible:outline-sky-700">
                <span aria-hidden="true" className="size-6 rounded-md border border-slate-900/20" style={{ background: ACCENT_PALETTES[accent].accent }} />
                {ACCENT_PALETTES[accent].label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="theme-surface" label="Fondo">
        <select className={fieldClassName} id="theme-surface" onChange={(event) => onChange({ ...theme, surface: event.target.value as LandingTheme["surface"] })} value={theme.surface}>
          <option value="claro">Claro</option>
          <option value="oscuro">Oscuro</option>
        </select>
      </Field>
      <ImageField campaignId={campaignId} id="theme-logo" label="Logo" onChange={(logo) => onChange({ ...theme, logo })} value={theme.logo} />
    </div>
  );
}

export function LandingEditor({
  campaignId,
  initialContent,
  publishedVersion,
  versions,
}: {
  campaignId: string;
  initialContent: LandingContent;
  publishedVersion: number;
  versions: { published_at: string; version: number }[];
}) {
  const router = useRouter();
  const [content, setContent] = useState<LandingContent>(initialContent);
  const [selected, setSelected] = useState<string>(initialContent.sections[0]?.id ?? "theme");
  const [newType, setNewType] = useState<SectionType>("rich_text");
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();
  const [autosave, setAutosave] = useState<AutosaveState>("idle");
  // Incremented on every local edit so a slow autosave never marks newer
  // edits as saved.
  const revision = useRef(0);

  // Drafts save themselves (Shopify-style): an uploaded image or edit is never
  // lost by switching tabs. Publishing stays an explicit action.
  useEffect(() => {
    if (!dirty) {
      return;
    }

    const savedRevision = revision.current;
    const timer = window.setTimeout(() => {
      if (!landingContentSchema.safeParse(content).success) {
        setAutosave("invalid");
        return;
      }

      setAutosave("saving");
      void saveLandingDraftAction(campaignId, content).then((result) => {
        if (result.status !== "success") {
          setAutosave("error");
        } else if (revision.current === savedRevision) {
          setDirty(false);
          setAutosave("saved");
        }
      });
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [campaignId, content, dirty]);

  // Warn before leaving with unsaved edits: full unloads and in-app links.
  useEffect(() => {
    if (!dirty) {
      return;
    }

    const warnUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const warnLink = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");

      if (anchor instanceof HTMLAnchorElement && anchor.target !== "_blank" && !window.confirm("Hay cambios que aún no se guardaron. ¿Salir de todas formas?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", warnUnload);
    document.addEventListener("click", warnLink, true);
    return () => {
      window.removeEventListener("beforeunload", warnUnload);
      document.removeEventListener("click", warnLink, true);
    };
  }, [dirty]);

  function update(next: LandingContent) {
    revision.current += 1;
    setContent(next);
    setDirty(true);
  }

  function updateSection(next: LandingSection) {
    update({ ...content, sections: content.sections.map((section) => (section.id === next.id ? next : section)) });
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;

    if (target < 0 || target >= content.sections.length) {
      return;
    }

    const sections = [...content.sections];
    const [moved] = sections.splice(index, 1);

    if (moved) {
      sections.splice(target, 0, moved);
      update({ ...content, sections });
    }
  }

  function remove(id: string) {
    if (!window.confirm("¿Eliminar esta sección del borrador?")) {
      return;
    }

    const sections = content.sections.filter((section) => section.id !== id);
    update({ ...content, sections });
    setSelected(sections[0]?.id ?? "theme");
  }

  function add() {
    const section = createSection(newType);
    update({ ...content, sections: [...content.sections, section] });
    setSelected(section.id);
  }

  // Same schema as the server: point the admin straight to the broken section.
  function validate(): boolean {
    const parsed = landingContentSchema.safeParse(content);

    if (parsed.success) {
      return true;
    }

    const issue = parsed.error.issues[0];
    const index = issue?.path[0] === "sections" ? issue.path[1] : undefined;
    const section = typeof index === "number" ? content.sections[index] : undefined;

    if (section) {
      setSelected(section.id);
    } else if (issue?.path[0] === "theme") {
      setSelected("theme");
    }

    setNotice({
      message: `${issue?.message ?? "Contenido no válido."}${section ? ` — ${SECTION_LABELS[section.type]}` : ""}`,
      tone: "error",
    });
    return false;
  }

  function run(action: () => Promise<{ message: string; status: string }>, onSuccess?: () => void) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setNotice({ message: result.message, tone: result.status === "success" ? "success" : "error" });

      if (result.status === "success") {
        setDirty(false);
        onSuccess?.();
        router.refresh();
      }
    });
  }

  const current = content.sections.find((section) => section.id === selected);
  const hasHero = content.sections.some((section) => section.type === "hero");

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <p className="text-sm text-slate-600">
          {dirty ? (
            <strong className={autosave === "invalid" || autosave === "error" ? "text-red-700" : "text-amber-700"}>
              {autosave === "invalid"
                ? "Sin guardar: corrige los campos incompletos"
                : autosave === "error"
                  ? "No se pudo guardar automáticamente"
                  : "Guardando…"}
            </strong>
          ) : (
            "Borrador guardado automáticamente"
          )}
          {" · "}Publicada: {publishedVersion > 0 ? `versión ${publishedVersion}` : "nunca"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={buttonClassName} disabled={pending} onClick={() => validate() && run(() => saveLandingDraftAction(campaignId, content))} type="button">
            Guardar borrador
          </button>
          <Link
            aria-disabled={dirty}
            className={`${buttonClassName} ${dirty ? "pointer-events-none opacity-50" : ""}`}
            href={`/vista-previa/portada/${campaignId}`}
            rel="noopener"
            target="_blank"
            title={dirty ? "Guarda el borrador para verlo en la vista previa" : undefined}
          >
            Vista previa
          </Link>
          <button
            className={primaryButtonClassName}
            disabled={pending}
            onClick={() => {
              if (validate() && window.confirm("¿Publicar este borrador en la portada pública?")) {
                run(() => publishLandingAction(campaignId, content));
              }
            }}
            type="button"
          >
            {pending ? "Procesando…" : "Publicar"}
          </button>
        </div>
      </div>

      {notice ? <FormStatus tone={notice.tone}>{notice.message}</FormStatus> : null}

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-4">
          <button
            className={`w-full rounded-xl border-2 p-3 text-left text-sm font-semibold ${selected === "theme" ? "border-sky-700 bg-sky-50" : "border-slate-200 bg-white"}`}
            onClick={() => setSelected("theme")}
            type="button"
          >
            Tema y logo
          </button>

          <ol className="space-y-2" aria-label="Secciones de la portada">
            {content.sections.map((section, index) => (
              <li className={`rounded-xl border-2 bg-white p-3 ${selected === section.id ? "border-sky-700" : "border-slate-200"}`} key={section.id}>
                <button className="w-full text-left text-sm font-semibold" onClick={() => setSelected(section.id)} type="button">
                  <span className={section.visible ? "" : "text-slate-400 line-through"}>{SECTION_LABELS[section.type]}</span>
                </button>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button aria-label="Subir" className={buttonClassName} disabled={index === 0} onClick={() => move(index, -1)} type="button">
                    ↑
                  </button>
                  <button aria-label="Bajar" className={buttonClassName} disabled={index === content.sections.length - 1} onClick={() => move(index, 1)} type="button">
                    ↓
                  </button>
                  <button className={buttonClassName} onClick={() => updateSection({ ...section, visible: !section.visible })} type="button">
                    {section.visible ? "Ocultar" : "Mostrar"}
                  </button>
                  <button className={buttonClassName} onClick={() => remove(section.id)} type="button">
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ol>

          <div className="space-y-2 rounded-xl border border-dashed border-slate-300 p-3">
            <label className={labelClassName} htmlFor="new-section-type">
              Añadir sección
            </label>
            <select className={fieldClassName} id="new-section-type" onChange={(event) => setNewType(event.target.value as SectionType)} value={newType}>
              {SECTION_TYPES.filter((type) => type !== "hero" || !hasHero).map((type) => (
                <option key={type} value={type}>
                  {SECTION_LABELS[type]}
                </option>
              ))}
            </select>
            <button className={`${buttonClassName} w-full`} disabled={content.sections.length >= MAX_SECTIONS} onClick={add} type="button">
              Añadir al final
            </button>
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {selected === "theme" ? (
            <>
              <h2 className="mb-5 text-lg font-bold">Tema y logo</h2>
              <ThemeForm campaignId={campaignId} onChange={(theme) => update({ ...content, theme })} theme={content.theme} />
            </>
          ) : current ? (
            <>
              <h2 className="mb-5 text-lg font-bold">{SECTION_LABELS[current.type]}</h2>
              <SectionForm campaignId={campaignId} onChange={updateSection} section={current} />
            </>
          ) : (
            <p className="text-sm text-slate-600">Selecciona una sección para editarla.</p>
          )}
        </section>
      </div>

      {versions.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold">Versiones publicadas</h2>
          <p className="mt-1 text-sm text-slate-600">
            Restaurar copia una versión anterior al borrador; después revísala y publícala.
          </p>
          <ul className="mt-4 divide-y divide-slate-200">
            {versions.map((version) => (
              <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" key={version.version}>
                <span>
                  <strong>Versión {version.version}</strong>{" "}
                  <span className="text-slate-500">
                    {new Intl.DateTimeFormat("es-SV", { dateStyle: "medium", timeStyle: "short", timeZone: "America/El_Salvador" }).format(new Date(version.published_at))}
                  </span>
                </span>
                <button
                  className={buttonClassName}
                  disabled={pending}
                  onClick={() => {
                    if (!dirty || window.confirm("Tienes cambios sin guardar que se perderán. ¿Continuar?")) {
                      // Local editor state must be replaced by the restored draft.
                      run(() => restoreLandingVersionAction(campaignId, version.version), () => window.location.reload());
                    }
                  }}
                  type="button"
                >
                  Restaurar en borrador
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
