import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, ClipboardList, Wallet, Megaphone, Lock } from 'lucide-react';
import OneFlowLogo from './OneFlowLogo';

const POINTS = [
  { icon: CalendarCheck, text: 'Agenda con confirmación por WhatsApp' },
  { icon: ClipboardList, text: 'Expediente e historial clínico de cada paciente' },
  { icon: Wallet, text: 'Planes de tratamiento, abonos y cobros en córdobas o dólares' },
  { icon: Megaphone, text: 'Marketing, cumpleaños y reseñas para que vuelvan' },
];

/**
 * Marco de las pantallas de acceso (login, registro, primeros pasos):
 * portada oscura de marca con el mensaje del producto y el formulario al lado.
 */
export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr] bg-surface">
      <aside className="bg-flow-hero text-white px-6 pt-10 pb-24 lg:py-16 lg:px-14 lg:flex lg:flex-col lg:justify-between">
        <div className="flex justify-center lg:justify-start">
          <OneFlowLogo size="md" tone="dark" />
        </div>
        <div className="hidden lg:block max-w-md">
          <h2 className="font-brand text-4xl font-semibold leading-tight">
            Toda tu clínica, <span className="text-flow-gradient">en un solo flujo.</span>
          </h2>
          <p className="mt-4 text-slate-300">
            No es solo un recordatorio: es el sistema donde tu consultorio atiende, cobra y hace crecer a sus pacientes.
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-flow-teal">
                  <Icon size={18} />
                </span>
                <span className="text-slate-100">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden lg:flex items-center gap-2 text-sm text-slate-400">
          <Lock size={14} /> Tus datos viajan y se guardan cifrados, y solo los ve tu equipo.
        </p>
      </aside>

      <main className="flex items-start lg:items-center justify-center px-4 pb-10 -mt-16 lg:mt-0 lg:py-10">
        <div className="w-full max-w-sm">
          <div className="mb-5 text-center lg:text-left text-white lg:text-slate-900">
            <h1 className="text-xl font-semibold">{title}</h1>
            {subtitle && <p className="text-sm mt-1 text-slate-300 lg:text-slate-500">{subtitle}</p>}
          </div>
          {children}
          <p className="mt-6 text-center text-xs text-slate-400">
            <Link to="/terminos" className="hover:text-slate-600 underline">Términos</Link>
            {' · '}
            <Link to="/privacidad" className="hover:text-slate-600 underline">Privacidad</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
