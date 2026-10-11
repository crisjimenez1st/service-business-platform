import { PLAN_PRICE_USD, TRIAL_DAYS } from '../config/plan';

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export const TERMS: LegalDoc = {
  title: 'Términos de uso',
  intro:
    'Estos términos explican cómo se usa OneFlow Med. Al crear una cuenta aceptas lo que sigue. Están escritos en lenguaje sencillo a propósito.',
  sections: [
    {
      title: '1. Qué es OneFlow Med',
      paragraphs: [
        'OneFlow Med es un sistema en línea para que consultorios y clínicas gestionen su agenda, sus pacientes, sus cobros y su comunicación con ellos. Es una herramienta de gestión: no brinda atención médica ni reemplaza el criterio del profesional de salud.',
      ],
    },
    {
      title: '2. Tu cuenta',
      paragraphs: [
        'Eres responsable de mantener tu contraseña en secreto y de lo que se haga con tu cuenta. El dueño de la clínica decide quién de su equipo (doctor o recepción) entra y qué puede ver. Avísanos si sospechas que alguien accedió sin permiso.',
      ],
    },
    {
      title: '3. Los datos de tus pacientes',
      paragraphs: [
        'Los datos de tus pacientes son tuyos: tú decides qué registrar y para qué. OneFlow Med los guarda y procesa solo para darte el servicio, siguiendo tus instrucciones. No los vendemos ni los usamos para publicidad.',
        'Tú, como clínica, eres responsable de contar con la autorización de tus pacientes para registrar sus datos y contactarlos, y de usar el sistema conforme a las leyes que te apliquen. El historial clínico solo lo ven el dueño y el doctor de tu clínica.',
      ],
    },
    {
      title: '4. Uso permitido',
      paragraphs: [
        'No uses el sistema para actividades ilegales, para enviar mensajes no solicitados masivos, ni para intentar acceder a datos de otras clínicas. Podemos suspender cuentas que pongan en riesgo a otros usuarios.',
      ],
    },
    {
      title: '5. Plan y pagos',
      paragraphs: [
        `Puedes probar OneFlow Med gratis durante ${TRIAL_DAYS} días. Después, el plan cuesta US$${PLAN_PRICE_USD} al mes. Si no lo activas, tu cuenta queda en solo lectura hasta que lo hagas; no borramos tus datos por eso.`,
      ],
    },
    {
      title: '6. Disponibilidad y respaldos',
      paragraphs: [
        'Trabajamos para que el sistema esté disponible, pero no podemos garantizar que funcione sin interrupciones. Te recomendamos exportar periódicamente la información que sea crítica para tu consultorio.',
      ],
    },
    {
      title: '7. Cierre de la cuenta y eliminación de datos',
      paragraphs: [
        'Puedes dejar de usar el servicio cuando quieras. Si pides que eliminemos tu cuenta y sus datos, lo haremos, salvo lo que la ley nos obligue a conservar.',
      ],
    },
    {
      title: '8. Cambios en estos términos',
      paragraphs: [
        'Si cambiamos estos términos de forma importante, te avisaremos dentro del sistema. Seguir usándolo después del aviso significa que los aceptas.',
      ],
    },
    {
      title: '9. Ley aplicable',
      paragraphs: ['Estos términos se rigen por las leyes de Nicaragua.'],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  title: 'Política de privacidad',
  intro:
    'Aquí te explicamos qué datos guarda OneFlow Med, para qué, dónde y quién puede verlos. Los datos de salud son sensibles y los tratamos con ese cuidado.',
  sections: [
    {
      title: '1. Qué datos guardamos',
      paragraphs: [
        'De tu cuenta: correo, nombre de la clínica y configuración.',
        'De tus pacientes (lo que tú registres): nombre, teléfono, fecha de nacimiento, citas, planes de tratamiento, pagos y, cuando lo llenan el doctor o el dueño, antecedentes médicos, alergias y notas de cada atención.',
      ],
    },
    {
      title: '2. Para qué los usamos',
      paragraphs: [
        'Solo para darte el servicio: mostrar tu agenda y expedientes, calcular cobros, recordar citas y preparar los mensajes que tú decides enviar. No vendemos datos ni los usamos para publicidad de terceros.',
      ],
    },
    {
      title: '3. Dónde se guardan y cómo se protegen',
      paragraphs: [
        'Los datos se guardan en una base de datos en la nube (Supabase, sobre infraestructura de Amazon Web Services). Viajan cifrados por internet (TLS) y se almacenan cifrados. Cada clínica está aislada de las demás: una clínica nunca puede ver los datos de otra.',
        'Dentro de tu clínica, cada persona ve solo lo que su rol permite: el historial clínico solo lo ven el dueño y el doctor; la recepción ve contactos, citas y cobros.',
      ],
    },
    {
      title: '4. Mensajes y enlaces para pacientes',
      paragraphs: [
        'Los mensajes de WhatsApp se abren desde tu propio dispositivo para que tú los envíes. Los enlaces que se comparten con pacientes (confirmar cita, reservar, recibos) muestran solo lo mínimo necesario, como nombre de pila, fecha y hora, y no incluyen información clínica.',
      ],
    },
    {
      title: '5. Tus derechos y los de tus pacientes',
      paragraphs: [
        'Puedes ver, corregir y eliminar los datos de tus pacientes desde el sistema. Si un paciente pide acceso, corrección o eliminación de sus datos, la clínica puede atenderlo; si necesitas ayuda, escríbenos y te apoyamos.',
      ],
    },
    {
      title: '6. Cuánto tiempo los conservamos',
      paragraphs: [
        'Conservamos los datos mientras tu cuenta esté activa. Si cierras tu cuenta y nos lo pides, los eliminamos, salvo lo que la ley nos obligue a guardar.',
      ],
    },
    {
      title: '7. Menores de edad',
      paragraphs: [
        'La clínica puede registrar pacientes menores con la autorización de su madre, padre o tutor. OneFlow Med no está dirigido a que menores creen cuentas propias.',
      ],
    },
    {
      title: '8. Cambios en esta política',
      paragraphs: ['Si cambiamos esta política de forma importante, te avisaremos dentro del sistema.'],
    },
  ],
};
