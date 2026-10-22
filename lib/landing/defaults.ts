import {
  DEFAULT_THEME,
  type LandingContent,
  type LandingSection,
  type SectionType,
} from "./schema";

function newId(): string {
  return globalThis.crypto.randomUUID();
}

export function createSection(type: SectionType): LandingSection {
  const base = { id: newId(), visible: true };

  switch (type) {
    case "hero":
      return {
        ...base,
        eyebrow: "Reto Semanal",
        headline: "¿Quieres ganarte una PC?",
        highlights: ["Participar es gratis", "Trivias semanales", "Misiones en vivo"],
        image: null,
        layout: "split",
        primaryCtaLabel: "Participar ahora",
        secondaryCtaLabel: "Iniciar sesión",
        showCountdown: true,
        subtitle:
          "Completa los retos de cada semana, suma puntos y compite por el premio mayor.",
        type,
      };
    case "prize":
      return { ...base, heading: "El premio", image: null, note: "", type };
    case "steps":
      return {
        ...base,
        heading: "Cómo participar",
        steps: [
          { body: "Regístrate con tu correo y elige tu alias y avatar.", title: "Crea tu cuenta" },
          { body: "Responde los cuestionarios y canjea los códigos de cada semana.", title: "Completa retos" },
          { body: "Cada reto suma puntos a tu marcador en el ranking.", title: "Suma puntos" },
          { body: "Al cierre, la persona con más puntos gana el premio.", title: "Gana" },
        ],
        type,
      };
    case "dates":
      return { ...base, heading: "Fechas de la campaña", note: "", type };
    case "rich_text":
      return { ...base, body: "Escribe aquí tu contenido.", heading: "", type };
    case "image_banner":
      return {
        ...base,
        caption: "",
        // Placeholder path is invalid on purpose: the editor requires an upload.
        image: { alt: "", path: "" },
        type,
      };
    case "faq":
      return {
        ...base,
        heading: "Preguntas frecuentes",
        items: [
          {
            answer: "Cualquier persona registrada que cumpla las reglas de la campaña.",
            question: "¿Quién puede participar?",
          },
        ],
        type,
      };
    case "cta":
      return {
        ...base,
        body: "El registro toma menos de dos minutos.",
        ctaLabel: "Participar ahora",
        heading: "¿Listo para el reto?",
        target: "registro",
        type,
      };
    case "upcoming_activities":
      return {
        ...base,
        heading: "Próximas trivias",
        note: "Inicia sesión para participar cuando abran.",
        type,
      };
    case "logos":
      return { ...base, heading: "Una campaña de", includeOrganizer: true, logos: [], type };
    case "ranking_preview":
      return {
        ...base,
        heading: "Top del ranking",
        limit: 5,
        note: "Se muestra solo si el ranking es público.",
        type,
      };
  }
}

export function createDefaultLanding(): LandingContent {
  return {
    sections: [
      createSection("hero"),
      createSection("prize"),
      createSection("steps"),
      createSection("dates"),
      createSection("faq"),
      createSection("cta"),
    ],
    theme: DEFAULT_THEME,
  };
}

export const DEFAULT_RULES_MARKDOWN = `## 1. Cuenta personal

- Cada persona puede tener una sola cuenta.
- Los datos de registro deben ser reales; se usan para validar al ganador.

## 2. Puntos

- Los puntos los asigna exclusivamente el sistema o el equipo organizador.
- Cada actividad puntúa una sola vez por participante.

## 3. Juego limpio

- Está prohibido usar varias cuentas, automatizaciones o compartir respuestas y códigos.
- El equipo organizador puede suspender o descalificar cuentas que incumplan estas reglas.

## 4. Premio y desempate

- Describe aquí el premio, cómo se determina al ganador y el criterio de desempate.
`;
