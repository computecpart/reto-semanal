import type { CSSProperties } from "react";

import type { Accent, LandingTheme } from "./schema";

interface AccentPalette {
  accent: string;
  contrast: string;
  label: string;
  /** Lighter tint for small accent text on the dark surface. */
  onDark: string;
  soft: string;
  strong: string;
}

// Near-black "gamer" surface used when the theme is dark.
export const DARK_SURFACE = { card: "#13141b", frame: "#d9dce8", page: "#07080c" } as const;

// Closed palette: every pair meets WCAG AA for text on the accent color, and
// `onDark` meets AA on the dark surface (checked by tests/landing.test.ts).
export const ACCENT_PALETTES: Readonly<Record<Accent, AccentPalette>> = {
  ambar: { accent: "#f2a516", contrast: "#0b1020", label: "Ámbar", onDark: "#f5b83d", soft: "#fff1cf", strong: "#b26f00" },
  carmesi: { accent: "#e4002b", contrast: "#ffffff", label: "Rojo dragón (MSI)", onDark: "#ff4d64", soft: "#ffe0e5", strong: "#a3001f" },
  cian: { accent: "#0ea5b7", contrast: "#0b1020", label: "Cian", onDark: "#22d3ee", soft: "#d5f6fa", strong: "#06707c" },
  cobalto: { accent: "#2f5bea", contrast: "#ffffff", label: "Cobalto", onDark: "#8aa5ff", soft: "#dfe7ff", strong: "#1d3fb8" },
  esmeralda: { accent: "#137a46", contrast: "#ffffff", label: "Esmeralda", onDark: "#34d399", soft: "#d6f5e3", strong: "#0b5a32" },
  violeta: { accent: "#7b4ce0", contrast: "#ffffff", label: "Violeta", onDark: "#b69cff", soft: "#ebe2ff", strong: "#5530ad" },
};

export function themeStyle(theme: LandingTheme): CSSProperties {
  const palette = ACCENT_PALETTES[theme.accent];

  return {
    "--accent": palette.accent,
    "--accent-contrast": palette.contrast,
    "--accent-on-dark": palette.onDark,
    "--accent-soft": palette.soft,
    "--accent-strong": palette.strong,
  } as CSSProperties;
}
