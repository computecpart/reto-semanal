import { describe, expect, it } from "vitest";

import { isRecoveryTokenHash } from "@/lib/auth/recovery-token";

describe("token de recuperación", () => {
  const hex = "a".repeat(56);

  it("acepta el hash simple y el del flujo PKCE que envía el formulario web", () => {
    expect(isRecoveryTokenHash(hex)).toBe(true);
    expect(isRecoveryTokenHash(`pkce_${hex}`)).toBe(true);
  });

  it.each(["", "pkce_", `pkce_${"z".repeat(56)}`, `${hex}<script>`, "../etc", `x_${hex}`])(
    "rechaza %s",
    (value) => {
      expect(isRecoveryTokenHash(value)).toBe(false);
    },
  );

  it("rechaza valores que no son texto", () => {
    expect(isRecoveryTokenHash(null)).toBe(false);
    expect(isRecoveryTokenHash(42)).toBe(false);
  });
});
