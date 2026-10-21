import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Reglas de participación | Reto Semanal",
};

// Static until campaign rules become editable and versioned in the database.
export default function RulesPage() {
  return (
    <LegalPage title="Reglas de participación" updatedAt="21 de octubre de 2026">
      <p>
        Al crear tu cuenta en Reto Semanal aceptas estas reglas. Las fechas, el premio y las
        bases específicas de cada campaña se publican dentro de la plataforma.
      </p>

      <h2>1. Cuenta personal</h2>
      <ul>
        <li>Cada persona puede tener una sola cuenta.</li>
        <li>Los datos de registro deben ser reales; se usan para validar al ganador.</li>
        <li>La cuenta es personal e intransferible. No compartas tu contraseña ni tus códigos.</li>
      </ul>

      <h2>2. Alias y avatar</h2>
      <ul>
        <li>El alias es público y debe ser respetuoso.</li>
        <li>
          No se permiten alias ofensivos, que suplanten a otra persona o que imiten cuentas
          oficiales u organizadoras.
        </li>
        <li>Solo se pueden usar los avatares oficiales de la plataforma.</li>
      </ul>

      <h2>3. Puntos y actividades</h2>
      <ul>
        <li>Los puntos los asigna exclusivamente el sistema o el equipo organizador.</li>
        <li>Cada actividad puntúa una sola vez por participante.</li>
        <li>
          La hora válida para cada actividad es la del servidor, en la zona horaria de El
          Salvador.
        </li>
        <li>
          Las correcciones de puntos se registran como movimientos visibles; nunca se borran
          en silencio.
        </li>
      </ul>

      <h2>4. Juego limpio</h2>
      <ul>
        <li>
          Está prohibido usar varias cuentas, automatizaciones, explotar errores o compartir
          respuestas o códigos con fines de ventaja.
        </li>
        <li>
          El equipo organizador puede suspender o descalificar cuentas que incumplan estas
          reglas. Toda medida queda registrada con su motivo.
        </li>
      </ul>

      <h2>5. Premio</h2>
      <ul>
        <li>
          El premio, la forma de determinar al ganador y el criterio de desempate se publican
          en la campaña activa.
        </li>
        <li>
          Para entregar el premio se verificará la identidad de la persona ganadora. Si es menor
          de edad, la entrega se hará con la autorización de su madre, padre o representante
          legal.
        </li>
      </ul>

      <h2>6. Cambios</h2>
      <p>
        Si estas reglas cambian de forma importante, se avisará dentro de la plataforma y podrá
        solicitarse una nueva aceptación.
      </p>
    </LegalPage>
  );
}
