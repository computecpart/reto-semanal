import { describe, expect, it } from "vitest";

import { getSafePostLoginPath } from "@/lib/auth/safe-redirect";
import { resolveAdminAccess } from "@/lib/permissions/admin-access";
import { getProfileRpcErrorMessage } from "@/lib/profile/rpc-errors";

describe("acceso a /admin", () => {
  it("rechaza a participant", () => {
    expect(resolveAdminAccess("participant")).toBe("forbidden");
  });

  it.each(["admin", "superadmin"])("permite a %s", (role) => {
    expect(resolveAdminAccess(role)).toBe("allow");
  });

  it("envía al login sin sesión", () => {
    expect(resolveAdminAccess(null)).toBe("login");
    expect(resolveAdminAccess(undefined)).toBe("login");
  });

  it.each(["Admin", "owner", "", 1, {}])("falla cerrado ante el rol desconocido %s", (role) => {
    expect(resolveAdminAccess(role)).toBe("forbidden");
  });
});

describe("redirección posterior al login", () => {
  it.each(["/admin", "/app/perfil"])("permite la ruta interna %s", (path) => {
    expect(getSafePostLoginPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/app/perfil?x=1",
    "javascript:alert(1)",
    ["/admin"],
    undefined,
  ])("usa el perfil ante el destino no permitido %s", (path) => {
    expect(getSafePostLoginPath(path)).toBe("/app/perfil");
  });
});

describe("errores del RPC de perfil", () => {
  it("traduce la violación de unicidad del alias", () => {
    expect(getProfileRpcErrorMessage({ code: "23505", message: "duplicate key" })).toMatch(
      /alias ya está en uso/,
    );
  });

  it("muestra los mensajes propios de PostgreSQL", () => {
    expect(
      getProfileRpcErrorMessage({ code: "22023", message: "El alias no está permitido." }),
    ).toBe("El alias no está permitido.");
  });

  it("oculta mensajes internos desconocidos", () => {
    expect(
      getProfileRpcErrorMessage({
        code: "XX000",
        message: 'relation "private.user_roles" does not exist',
      }),
    ).toBe("No fue posible guardar el perfil. Inténtalo de nuevo.");
  });
});
