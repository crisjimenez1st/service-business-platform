import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import OneFlowLogo from '../components/brand/OneFlowLogo';
import { LEGAL_UPDATED, SUPPORT_CONTACT } from '../config/legal';
import { PRIVACY, TERMS, type LegalDoc } from '../content/legal';

/** Página pública (sin sesión) con los Términos de uso o la Política de privacidad. */
export default function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const doc: LegalDoc = kind === 'terms' ? TERMS : PRIVACY;
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-flow-hero px-4 py-8 text-white">
        <div className="mx-auto max-w-2xl">
          <Link to="/login" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
            <ArrowLeft size={16} /> Volver
          </Link>
          <div className="flex justify-start">
            <OneFlowLogo size="sm" tone="dark" />
          </div>
          <h1 className="mt-5 font-brand text-3xl font-semibold">{doc.title}</h1>
          <p className="mt-1 text-sm text-slate-300">Última actualización: {LEGAL_UPDATED}</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <p className="text-slate-700">{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.title} className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">{s.title}</h2>
            {s.paragraphs.map((p) => (
              <p key={p} className="text-slate-600 leading-relaxed">
                {p}
              </p>
            ))}
          </section>
        ))}
        {SUPPORT_CONTACT && (
          <p className="text-slate-600">
            ¿Dudas? Escríbenos a <span className="font-medium text-slate-900">{SUPPORT_CONTACT}</span>.
          </p>
        )}
        <nav className="flex gap-4 border-t border-violet-100 pt-4 text-sm">
          <Link to="/terminos" className="text-brand-600 hover:text-brand-700 font-medium">
            Términos de uso
          </Link>
          <Link to="/privacidad" className="text-brand-600 hover:text-brand-700 font-medium">
            Política de privacidad
          </Link>
        </nav>
      </main>
    </div>
  );
}
