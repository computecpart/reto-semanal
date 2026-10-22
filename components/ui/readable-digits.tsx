import type { ReactNode } from "react";

/**
 * Pixelify Sans draws 5 and 7 ambiguously; keep pixel titles but render the
 * digits inside them with the readable score face.
 */
export function readableDigits(text: string): ReactNode {
  const parts = text.split(/(\d+)/);

  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <span className="font-score" key={index}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}
