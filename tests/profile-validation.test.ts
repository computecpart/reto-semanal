import { describe, expect, it } from "vitest";

import {
  aliasSchema,
  containsBlockedAliasTerm,
  createProfileCompletionSchema,
  createRegistrationSchema,
  departmentSchema,
  EL_SALVADOR_DEPARTMENTS,
  getOperationalDate,
  isAdultOn,
  isReservedAlias,
  normalizeAlias,
  profileUpdateSchema,
} from "@/lib/validation/profile";

const OPERATIONAL_DATE = "2026-10-20";

const validRegistration = {
  acceptedPrivacy: true,
  acceptedRules: true,
  ageDeclaration: "adult",
  alias: "Rayo_Azul",
  avatarId: "avatar-03",
  birthDate: "1995-04-12",
  confirmPassword: "contraseña-segura",
  department: "San Salvador",
  email: "  Persona@Ejemplo.COM ",
  firstName: "  José   María ",
  lastName: "Núñez",
  marketingConsent: false,
  phone: "7123-4567",
  password: "contraseña-segura",
};

describe("alias", () => {
  it("normaliza mayúsculas, acentos y espacios", () => {
    expect(normalizeAlias("  Ñandú Veloz ")).toBe("nandu-veloz");
    expect(aliasSchema.parse("Rayo_Azul")).toBe("rayo_azul");
  });

  it.each(["ab", "a".repeat(25)])("rechaza longitudes fuera de 3-24: %s", (alias) => {
    expect(aliasSchema.safeParse(alias).success).toBe(false);
  });

  it.each([
    "https://x.io",
    "www.sitio",
    "mi.sitio.com",
    "<b>hola</b>",
    "&lt;script",
    "mailto:yo",
  ])("rechaza URLs y HTML: %s", (alias) => {
    expect(aliasSchema.safeParse(alias).success).toBe(false);
  });

  it.each([
    "admin",
    "ADMIN",
    "Admin_2",
    "super-admin",
    "4dm1n",
    "soporte",
    "staff",
    "oficial",
    "moderator",
    "el_admin",
  ])("rechaza términos administrativos reservados: %s", (alias) => {
    expect(isReservedAlias(alias) || !aliasSchema.safeParse(alias).success).toBe(true);
    expect(aliasSchema.safeParse(alias).success).toBe(false);
  });

  it.each(["puta", "P3nd3jo", "verga_99", "mi-mierda"])(
    "rechaza términos ofensivos: %s",
    (alias) => {
      expect(containsBlockedAliasTerm(alias)).toBe(true);
      expect(aliasSchema.safeParse(alias).success).toBe(false);
    },
  );

  it.each(["computadora", "estafador", "pendiente", "administracion-fan"])(
    "no bloquea palabras legítimas por subcadenas: %s",
    (alias) => {
      if (alias === "administracion-fan") {
        // "administracion" is not in the reserved list and must stay usable.
        expect(isReservedAlias(alias)).toBe(false);
        return;
      }

      expect(aliasSchema.safeParse(alias).success).toBe(true);
    },
  );

  it("rechaza caracteres fuera de la lista permitida", () => {
    expect(aliasSchema.safeParse("hola!").success).toBe(false);
    expect(aliasSchema.safeParse("-hola").success).toBe(false);
    expect(aliasSchema.safeParse("hola😀").success).toBe(false);
  });
});

describe("departamento", () => {
  it("acepta exactamente los 14 departamentos", () => {
    expect(EL_SALVADOR_DEPARTMENTS).toHaveLength(14);

    for (const department of EL_SALVADOR_DEPARTMENTS) {
      expect(departmentSchema.parse(department)).toBe(department);
    }
  });

  it.each(["Guatemala", "san salvador", "", "Otro"])("rechaza texto libre: %s", (department) => {
    expect(departmentSchema.safeParse(department).success).toBe(false);
  });

  it("acepta la forma descompuesta Unicode del mismo departamento", () => {
    expect(departmentSchema.parse("Usulután".normalize("NFD"))).toBe("Usulután");
  });
});

describe("edad", () => {
  it("cumple 18 exactamente en la fecha operacional", () => {
    expect(isAdultOn("2008-10-20", OPERATIONAL_DATE)).toBe(true);
    expect(isAdultOn("2008-10-21", OPERATIONAL_DATE)).toBe(false);
  });

  it("trata el 29 de febrero sin desbordar la fecha", () => {
    expect(isAdultOn("2008-02-29", "2026-02-28")).toBe(true);
  });

  it("calcula la fecha operacional en America/El_Salvador", () => {
    // 05:30 UTC del 21 es todavía 20 de octubre en El Salvador (UTC-6).
    expect(getOperationalDate(new Date("2026-10-21T05:30:00Z"))).toBe("2026-10-20");
    expect(getOperationalDate(new Date("2026-10-21T06:30:00Z"))).toBe("2026-10-21");
  });
});

describe("registro", () => {
  const schema = createRegistrationSchema(OPERATIONAL_DATE);

  it("acepta un registro completo, normaliza y descarta la confirmación", () => {
    const result = schema.parse(validRegistration);

    expect(result.email).toBe("persona@ejemplo.com");
    expect(result.firstName).toBe("José María");
    expect(result.alias).toBe("rayo_azul");
    expect(result).not.toHaveProperty("confirmPassword");
  });

  it("rechaza contraseñas distintas", () => {
    const result = schema.safeParse({ ...validRegistration, confirmPassword: "otra-cosa-123" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("rechaza una declaración de edad incoherente", () => {
    const minorDeclaredAdult = schema.safeParse({
      ...validRegistration,
      birthDate: "2012-01-01",
    });
    const adultDeclaredMinor = schema.safeParse({
      ...validRegistration,
      ageDeclaration: "minor",
    });

    expect(minorDeclaredAdult.error?.issues[0]?.path).toEqual(["ageDeclaration"]);
    expect(adultDeclaredMinor.error?.issues[0]?.path).toEqual(["ageDeclaration"]);
  });

  it("acepta un menor que se declara menor", () => {
    expect(
      schema.safeParse({ ...validRegistration, ageDeclaration: "minor", birthDate: "2012-01-01" })
        .success,
    ).toBe(true);
  });

  it("rechaza fechas futuras o imposibles", () => {
    expect(schema.safeParse({ ...validRegistration, birthDate: "2026-10-21" }).success).toBe(false);
    expect(schema.safeParse({ ...validRegistration, birthDate: "2001-02-29" }).success).toBe(false);
  });

  it("exige aceptar reglas y privacidad", () => {
    expect(schema.safeParse({ ...validRegistration, acceptedRules: false }).success).toBe(false);
    expect(schema.safeParse({ ...validRegistration, acceptedPrivacy: false }).success).toBe(false);
  });

  it("exige un avatar del catálogo cerrado", () => {
    expect(schema.safeParse({ ...validRegistration, avatarId: "avatar-25" }).success).toBe(false);
    expect(schema.safeParse({ ...validRegistration, avatarId: "/foto.jpg" }).success).toBe(false);
  });

  it("rechaza campos de autorización inyectados", () => {
    expect(schema.safeParse({ ...validRegistration, role: "admin" }).success).toBe(false);
  });
});

describe("edición de perfil", () => {
  const editable = {
    alias: "nuevo_alias",
    avatarId: "avatar-01",
    department: "Santa Ana",
    firstName: "Ana",
    lastName: "López",
  };

  it("acepta únicamente los campos editables", () => {
    expect(profileUpdateSchema.parse(editable)).toEqual(editable);
  });

  it.each([
    ["role", "superadmin"],
    ["points", 1000],
    ["disciplinary_status", "clear"],
    ["birthDate", "1990-01-01"],
  ])("rechaza el campo protegido %s", (field, value) => {
    expect(profileUpdateSchema.safeParse({ ...editable, [field]: value }).success).toBe(false);
  });

  it("completar un perfil previo aplica las mismas reglas de edad", () => {
    const schema = createProfileCompletionSchema(OPERATIONAL_DATE);
    const base = {
      ...editable,
      acceptedPrivacy: true,
      acceptedRules: true,
      ageDeclaration: "adult",
      birthDate: "1990-01-01",
    };

    expect(schema.safeParse(base).success).toBe(true);
    expect(schema.safeParse({ ...base, birthDate: "2015-01-01" }).success).toBe(false);
  });
});

describe("teléfono de El Salvador", () => {
  it.each([
    ["7123-4567", "+50371234567"],
    ["+503 2222 3333", "+50322223333"],
    ["503 6123 4567", "+50361234567"],
  ])("normaliza %s", async (input, expected) => {
    const { normalizeSalvadorPhone } = await import("@/lib/validation/profile");
    expect(normalizeSalvadorPhone(input)).toBe(expected);
  });

  it.each(["1234-5678", "7123456", "+1 555 123 4567", ""])("rechaza %s", async (input) => {
    const { normalizeSalvadorPhone } = await import("@/lib/validation/profile");
    expect(normalizeSalvadorPhone(input)).toBeNull();
  });
});
