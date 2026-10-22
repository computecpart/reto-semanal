import type { Metadata, Viewport } from "next";
import { Inter, Pixelify_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

// Pixel display font is reserved for titles; body copy stays highly legible.
const pixel = Pixelify_Sans({
  display: "swap",
  subsets: ["latin", "latin-ext"],
  variable: "--font-pixel",
});

const inter = Inter({
  display: "swap",
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  description:
    "Plataforma empresarial de gamificación para la campaña Reto Semanal.",
  title: "Reto Semanal",
};

export const viewport: Viewport = {
  initialScale: 1,
  viewportFit: "cover",
  width: "device-width",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={`${pixel.variable} ${inter.variable}`} lang="es">
      <body>{children}</body>
    </html>
  );
}
