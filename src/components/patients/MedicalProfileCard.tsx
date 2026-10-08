import { useState } from 'react';
import { HeartPulse, Lock } from 'lucide-react';
import { Button, Card } from '../ui';
import { saveMedicalProfile } from '../../services/medicalProfileService';
import { formatLongDateInTimezone } from '../../utils/timezone';
import type { MedicalProfile, MedicalProfileInput } from '../../types';

const FIELDS: { key: keyof MedicalProfileInput; label: string; placeholder: string; rows: number }[] = [
  { key: 'allergies', label: 'Alergias', placeholder: 'Ej. Penicilina, látex, anestesia...', rows: 2 },
  { key: 'medicalHistory', label: 'Enfermedades y antecedentes', placeholder: 'Ej. Diabetes, hipertensión, cirugías previas, embarazo...', rows: 3 },
  { key: 'medications', label: 'Medicamentos que toma', placeholder: 'Nombre y para qué los toma', rows: 3 },
  { key: 'importantNotes', label: 'Notas importantes', placeholder: 'Lo que cualquier doctor debe saber antes de atenderlo', rows: 3 },
];

interface MedicalProfileCardProps {
  clientId: string;
  profile: MedicalProfile | null;
  timezone: string;
  onSaved: (profile: MedicalProfile) => void;
}

/** Historial médico del paciente: se lee y se edita aquí. Solo dueño y doctores. */
export default function MedicalProfileCard({ clientId, profile, timezone, onSaved }: MedicalProfileCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MedicalProfileInput>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setDraft({
      allergies: profile?.allergies,
      medicalHistory: profile?.medicalHistory,
      medications: profile?.medications,
      importantNotes: profile?.importantNotes,
    });
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await saveMedicalProfile(clientId, draft);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    onSaved(result.data);
    setEditing(false);
  }

  if (editing) {
    return (
      <Card className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`mp-${f.key}`} className="block text-sm font-medium text-slate-700 mb-1">
              {f.label}
            </label>
            <textarea
              id={`mp-${f.key}`}
              rows={f.rows}
              maxLength={4000}
              value={draft[f.key] ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
            />
          </div>
        ))}
        {error && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar historial'}
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </Card>
    );
  }

  const filled = profile ? FIELDS.filter((f) => profile[f.key]) : [];

  return (
    <div className="space-y-3">
      {filled.length === 0 ? (
        <Card>
          <div className="text-center py-4">
            <HeartPulse size={32} className="mx-auto text-brand-600" />
            <p className="text-sm font-medium text-slate-900 mt-2">Todavía no hay historial médico</p>
            <p className="text-sm text-slate-500 mt-1">Anota alergias, enfermedades y medicamentos para atenderlo con seguridad.</p>
            <Button className="mt-3" onClick={startEdit}>
              Completar historial médico
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {filled.map((f) => (
            <Card key={f.key}>
              <p className="text-xs text-slate-500 mb-1">{f.label}</p>
              <p className="text-sm text-slate-900 whitespace-pre-line">{profile?.[f.key]}</p>
            </Card>
          ))}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Actualizado el {profile ? formatLongDateInTimezone(profile.updatedAt, timezone) : ''}
            </p>
            <Button variant="secondary" size="sm" onClick={startEdit}>
              Editar historial
            </Button>
          </div>
        </>
      )}
      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <Lock size={12} /> Solo el dueño y los médicos ven este historial. La recepción no.
      </p>
    </div>
  );
}
