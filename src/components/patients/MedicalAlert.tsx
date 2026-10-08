import { AlertTriangle } from 'lucide-react';
import type { MedicalProfile } from '../../types';

/** Franja de aviso con lo más importante del paciente (alergias y notas importantes). No se pinta si no hay nada. */
export default function MedicalAlert({ profile }: { profile: MedicalProfile | null | undefined }) {
  if (!profile || (!profile.allergies && !profile.importantNotes)) return null;
  return (
    <div role="note" className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
      <AlertTriangle size={24} className="text-red-600 shrink-0 mt-0.5" />
      <div className="min-w-0 space-y-1 text-sm text-red-900">
        <p className="font-semibold text-red-800">Importante</p>
        {profile.allergies && (
          <p className="whitespace-pre-line">
            <span className="font-medium">Alergias:</span> {profile.allergies}
          </p>
        )}
        {profile.importantNotes && <p className="whitespace-pre-line">{profile.importantNotes}</p>}
      </div>
    </div>
  );
}
