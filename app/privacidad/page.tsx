import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidad | Reto Semanal",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad" updatedAt="Última actualización: 21 de octubre de 2026">
      <p>
        Esta política explica qué datos recoge la plataforma, para qué los usa y quién puede
        verlos. Responsable: <strong>Digit@l Solutions</strong> (soporte@digitalsolutions.com.sv).
      </p>

      <h2>1. Datos que recogemos</h2>
      <ul>
        <li>Nombre, apellido y alias.</li>
        <li>Correo electrónico y teléfono.</li>
        <li>Fecha de nacimiento y declaración de mayoría o minoría de edad.</li>
        <li>Departamento de El Salvador.</li>
        <li>El avatar elegido entre los avatares oficiales. No recogemos fotografías.</li>
        <li>Tu actividad en la campaña: participaciones, puntos y canjes.</li>
      </ul>
      <p>
        Tu contraseña la gestiona el servicio de autenticación y nunca es visible para el equipo
        organizador.
      </p>

      <h2>2. Para qué los usamos</h2>
      <ul>
        <li>Crear y proteger tu cuenta.</li>
        <li>Gestionar tu participación, tus puntos y la clasificación.</li>
        <li>Verificar requisitos de edad y contactar a la persona ganadora.</li>
        <li>Prevenir fraudes y hacer cumplir las reglas.</li>
      </ul>

      <h2>3. Quién puede verlos</h2>
      <ul>
        <li>
          Otras personas participantes solo ven tu alias, tu avatar, tus puntos y, si la campaña
          lo configura así, tu nombre.
        </li>
        <li>
          Tu correo, fecha de nacimiento, edad y departamento nunca se muestran públicamente.
        </li>
        <li>El equipo administrador de la campaña accede a tus datos para gestionarla.</li>
        <li>No vendemos ni cedemos tus datos con fines publicitarios.</li>
        <li>Las comunicaciones comerciales solo se envían con tu consentimiento separado.</li>
      </ul>

      <h2>4. Dónde se guardan</h2>
      <p>
        Los datos se almacenan en servicios de infraestructura en la nube (Supabase y Vercel),
        que pueden estar ubicados fuera de El Salvador, con acceso restringido y cifrado en
        tránsito.
      </p>

      <h2>5. Cuánto tiempo</h2>
      <p>
        Conservamos los datos mientras dure la campaña y el tiempo necesario para entregar el
        premio y atender reclamaciones. Después se eliminan o anonimizan.
      </p>

      <h2>6. Personas menores de edad</h2>
      <p>
        Si eres menor de edad, debes participar con el conocimiento y la autorización de tu
        madre, padre o representante legal.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        Puedes consultar y corregir tus datos editables desde tu perfil. Para solicitar acceso,
        rectificación de otros datos o la eliminación de tu cuenta, escribe a{" "}
        <a className="font-semibold underline" href="mailto:soporte@digitalsolutions.com.sv">soporte@digitalsolutions.com.sv</a>.
      </p>
    </LegalPage>
  );
}
