import type { CSSProperties } from "react";

import type { Accent, LandingTheme } from "./schema";

interface AccentPalette {
  accent: string;
  contrast: string;
  label: string;
  soft: string;
  strong: string;
}

// Closed palette: every pair meets WCAG AA for text on the accent color.
export const ACCENT_PALETTES: Readonly<Record<Accent, AccentPalette>> = {
  ambar: { accent: "#f2a516", contrast: "#0b1020", label: "Ámbar", soft: "#fff1cf", strong: "#b26f00" },
  carmesi: { accent: "#d62f45", contrast: "#ffffff", label: "Carmesí", soft: "#ffe0e4", strong: "#9c1428" },
  cian: { accent: "#0ea5b7", contrast: "#0b1020", label: "Cian", soft: "#d5f6fa", strong: "#06707c" },
  cobalto: { accent: "#2f5bea", contrast: "#ffffff", label: "Cobalto", soft: "#dfe7ff", strong: "#1d3fb8" },
  esmeralda: { accent: "#137a46", contrast: "#ffffff", label: "Esmeralda", soft: "#d6f5e3", strong: "#0b5a32" },
  violeta: { accent: "#7b4ce0", contrast: "#ffffff", label: "Violeta", soft: "#ebe2ff", strong: "#5530ad" },
};

export function themeStyle(theme: LandingTheme): CSSProperties {
  const palette = ACCENT_PALETTES[theme.accent];

  return {
    "--accent": palette.accent,
    "--accent-contrast": palette.contrast,
    "--accent-soft": palette.soft,
    "--accent-strong": palette.strong,
  } as CSSProperties;
}
